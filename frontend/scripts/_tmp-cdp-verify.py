# REQ-084 临时验证驱动（Python 版）：headless Chrome + websockets（浏览器级会话 + flatten attach）。
# 场景：sprite（结构/逐帧采样/reduced-motion/点击/截图）| final（ready=false 结构+点击+剪裁截图）|
#       baseline（基线剪裁截图+outerHTML）| compare（final vs baseline 剪裁图逐像素比对）
# 用法：python _tmp-cdp-verify.py --scenario <sprite|final|baseline|compare> --port 8891
import asyncio, base64, json, os, shutil, subprocess, sys, tempfile, zlib, time
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_PORT = 9237
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_out")
os.makedirs(OUT_DIR, exist_ok=True)

def arg(name, dflt=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return dflt

SCENARIO = arg("--scenario", "sprite")
PORT = int(arg("--port", "8891"))
log = lambda *a: print("[driver]", *a, flush=True)

# ---------- 最小 PNG 解码（供区域像素比对） ----------
def decode_png(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not png")
    pos = 8
    width = height = None
    bit_depth = color_type = None
    idat = b""
    while pos < len(data):
        ln = int.from_bytes(data[pos:pos + 4], "big")
        typ = data[pos + 4:pos + 8].decode("ascii")
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == "IHDR":
            width = int.from_bytes(chunk[0:4], "big")
            height = int.from_bytes(chunk[4:8], "big")
            bit_depth = chunk[8]
            color_type = chunk[9]
        elif typ == "IDAT":
            idat += chunk
        pos += 12 + ln
    if bit_depth != 8 or color_type not in (2, 6):
        raise ValueError(f"unsupported png {bit_depth}/{color_type}")
    ch = 4 if color_type == 6 else 3
    stride = width * ch
    raw = zlib.decompress(idat)
    out = bytearray(height * stride)
    prev = bytearray(stride)
    for y in range(height):
        f = raw[y * (stride + 1)]
        row = raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)]
        cur = memoryview(out)[y * stride:(y + 1) * stride]
        for x in range(stride):
            a = cur[x - ch] if x >= ch else 0
            b = prev[x]
            c = prev[x - ch] if x >= ch else 0
            v = row[x]
            if f == 1:
                v += a
            elif f == 2:
                v += b
            elif f == 3:
                v += (a + b) >> 1
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                v += a if pa <= pb and pa <= pc else (b if pb <= pc else c)
            cur[x] = v & 0xFF
        prev[:] = bytes(cur)
    return width, height, ch, bytes(out)

# ---------- CDP（浏览器会话 + flatten attach，按 id 关联、跳过事件） ----------
class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.msg_id = 0

    async def send(self, method, params=None, session=None):
        self.msg_id += 1
        mid = self.msg_id
        m = {"id": mid, "method": method, "params": params or {}}
        if session:
            m["sessionId"] = session
        log("send", method)
        await self.ws.send(json.dumps(m))
        while True:
            msg = await asyncio.wait_for(self.ws.recv(), timeout=30)
            if not isinstance(msg, str):
                text = msg.decode("utf-8", "replace") if isinstance(msg, bytes) else str(getattr(msg, "data", msg))
            else:
                text = msg
            try:
                obj = json.loads(text)
            except Exception:
                log("unparsable ws msg", str(msg)[:100])
                continue
            if obj.get("id") == mid:
                log("resp", method, str(obj)[:120].replace("\n", " "))
                if "error" in obj:
                    raise RuntimeError(obj["error"].get("message", "cdp error"))
                return obj.get("result", {})
            # 其它 = 事件（如 Target.attachedToTarget），跳过

    async def eval(self, expr, session):
        r = await self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, session)
        if r.get("exceptionDetails"):
            raise RuntimeError("eval exception: " + json.dumps(r["exceptionDetails"])[:400])
        return (r.get("result") or {}).get("value")

async def launch_chrome():
    # 注意：DSH 临时目录下 Chrome 无法创建 profile 锁文件（拒绝访问），profile 必须放工作区内
    profile = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"_tmp_profile_{os.getpid()}")
    shutil.rmtree(profile, ignore_errors=True)
    os.makedirs(profile, exist_ok=True)
    proc = subprocess.Popen([
        CHROME, "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        f"--user-data-dir={profile}",
        "--no-first-run", "--no-default-browser-check", "--disable-extensions",
        "--disable-background-networking", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--window-size=1280,1024",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import urllib.request
    for _ in range(60):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=1) as resp:
                ver = json.loads(resp.read())
                return proc, ver["webSocketDebuggerUrl"], profile
        except Exception:
            await asyncio.sleep(0.2)
    raise RuntimeError("chrome cdp not ready")
    return proc, None, profile  # unreachable; keeps signature

STRUCT_EXPR = r"""(() => {
  const btn = document.querySelector('.landing-mascot');
  const sp = document.querySelector('.mascot-sprite.play');
  const fx = document.querySelector('.lm-fx');
  const st = document.getElementById('kf-mascotSpritePlay_5x2_10');
  const img = btn ? btn.querySelector('img') : null;
  return {
    btnClass: btn ? btn.className : null,
    btnRect: btn ? (() => { const r = btn.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
    hasImg: !!img,
    imgSrc: img ? img.getAttribute('src') : null,
    imgAlt: img ? img.getAttribute('alt') : null,
    imgAnim: img ? getComputedStyle(img).animationName : null,
    hasSprite: !!sp,
    spriteStyle: sp ? {
      w: sp.style.width, h: sp.style.height,
      bg: getComputedStyle(sp).backgroundImage,
      bs: getComputedStyle(sp).backgroundSize,
      animName: getComputedStyle(sp).animationName,
      animVar: sp.style.getPropertyValue('--sprite-anim').trim(),
      willChange: getComputedStyle(sp).willChange
    } : null,
    fxChildren: fx ? fx.children.length : null,
    kfInjected: st ? { id: st.id, len: st.textContent.length, text: st.textContent } : null,
    capText: btn ? (btn.querySelector('.lm-cap') || {}).textContent || null : null,
    capVisible: btn ? !!btn.querySelector('.lm-cap') : null,
    pathname: location.pathname
  };
})()"""

SAMPLE_EXPR = r"""(async () => {
  const el = document.querySelector('.mascot-sprite.play');
  if (!el) return { error: 'no sprite el' };
  const t0 = performance.now();
  const samples = [];
  await new Promise(res => {
    const tick = () => {
      const now = performance.now();
      samples.push({ t: Math.round(now - t0), bp: getComputedStyle(el).backgroundPosition });
      if (now - t0 > 3900) res(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return { samples };
})()"""

ANIM_STATIC_EXPR = r"""(async () => {
  const el = document.querySelector('.mascot-sprite.play');
  if (!el) return { error: 'no sprite el' };
  const t0 = performance.now();
  const bps = [];
  await new Promise(res => {
    const tick = () => {
      bps.push(getComputedStyle(el).backgroundPosition);
      if (performance.now() - t0 > 700) res(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return { animName: getComputedStyle(el).animationName, bps };
})()"""

def analyze_frames(samples):
    W, COLS = 256, 5
    expected = [f"-{k % COLS * W}px -{k // COLS * W}px" for k in range(10)]
    seen = set()
    dwell = {}
    order = []
    last = -1
    start = None
    for s in samples:
        try:
            idx = expected.index(s["bp"])
        except ValueError:
            continue
        seen.add(idx)
        if idx != last:
            if last >= 0:
                dwell[last] = dwell.get(last, 0) + s["t"] - start
            order.append(idx)
            last = idx
            start = s["t"]
    if last >= 0:
        dwell[last] = dwell.get(last, 0) + samples[-1]["t"] - start
    uniq = []
    for v in order:
        if not uniq or uniq[-1] != v:
            uniq.append(v)
    cyclic = len(uniq) >= 10 and all(uniq[j] == (uniq[0] + j) % 10 for j in range(10))
    return {
        "framesSeen": sorted(seen),
        "all10": seen == set(range(10)),
        "cyclicOk": cyclic,
        "dwellMs": {str(k): int(v) for k, v in sorted(dwell.items())},
        "samples": len(samples),
    }

async def wait_mascot(cdp, session, timeout=25):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if await cdp.eval("!!document.querySelector('.landing-mascot')", session):
            return
        await asyncio.sleep(0.12)
    raise RuntimeError("landing-mascot not mounted")

async def clip_shot(cdp, session, rect, file):
    r = await cdp.send("Page.captureScreenshot", {
        "format": "png",
        "clip": {"x": rect["x"], "y": rect["y"], "width": rect["w"], "height": rect["h"], "scale": 1},
    }, session)
    with open(file, "wb") as f:
        f.write(base64.b64decode(r["data"]))
    return file

async def main():
    proc, browser_ws, profile = await launch_chrome()
    log("chrome up; connect browser session")
    async with websockets.connect(browser_ws, origin=f"http://localhost:{CDP_PORT}", max_size=64 * 1024 * 1024) as ws:
        cdp = CDP(ws)
        result = {"scenario": SCENARIO, "ts": time.strftime("%Y-%m-%dT%H:%M:%S")}
        try:
            r = await cdp.send("Target.getTargets")
            page = next(t for t in r["result"]["targetInfos"] if t["type"] == "page")
            r = await cdp.send("Target.attachToTarget", {"targetId": page["targetId"], "flatten": True})
            session = r["result"]["sessionId"]
            log("attached", page["targetId"], "session", session)
            await cdp.send("Page.enable", session=session)
            await cdp.send("Runtime.enable", session=session)

            url = f"http://127.0.0.1:{PORT}/"
            await cdp.send("Page.navigate", {"url": url}, session)
            await wait_mascot(cdp, session)
            await asyncio.sleep(0.6)

            if SCENARIO == "sprite":
                result["structure"] = await cdp.eval(STRUCT_EXPR, session)
                log("structure ok; sampling 3.9s")
                sample = await cdp.eval(SAMPLE_EXPR, session)
                result["frames"] = analyze_frames(sample.get("samples", []))
                log("sampled", len(sample.get("samples", [])), "points")
                await cdp.send("Emulation.setEmulatedMedia",
                               {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]}, session)
                await cdp.send("Page.reload", session=session)
                await wait_mascot(cdp, session)
                await asyncio.sleep(0.3)
                rm = await cdp.eval(ANIM_STATIC_EXPR, session)
                result["reducedMotion"] = {
                    "animName": rm.get("animName"),
                    "allStaticFirstFrame": all(b == "0px 0px" for b in rm.get("bps", [])),
                    "bpSamples": len(rm.get("bps", [])),
                }
                log("reduced-motion ok; restore + shot")
                await cdp.send("Emulation.setEmulatedMedia", {"features": []}, session)
                await cdp.send("Page.reload", session=session)
                await wait_mascot(cdp, session)
                await asyncio.sleep(0.5)
                rect = await cdp.eval(
                    "(() => { const r = document.querySelector('.landing-mascot').getBoundingClientRect(); "
                    "return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()",
                    session)
                result["shot"] = await clip_shot(cdp, session, rect, os.path.join(OUT_DIR, "sprite-clip.png"))
                log("shot saved; click test")
                await cdp.eval("document.querySelector('.landing-mascot').click(); true", session)
                await asyncio.sleep(0.6)
                result["click"] = {"pathname": await cdp.eval("location.pathname", session), "expectedRedirect": "/login"}

            elif SCENARIO in ("final", "baseline"):
                await cdp.send("Emulation.setEmulatedMedia",
                               {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]}, session)
                await cdp.send("Page.reload", session=session)
                await wait_mascot(cdp, session)
                await asyncio.sleep(0.4)
                result["structure"] = await cdp.eval(STRUCT_EXPR, session)
                rect = result["structure"]["btnRect"]
                result["shot"] = await clip_shot(cdp, session, rect, os.path.join(OUT_DIR, f"{SCENARIO}-clip.png"))
                result["outerHTML"] = await cdp.eval("document.querySelector('.landing-mascot').outerHTML", session)
                if SCENARIO == "final":
                    await cdp.eval("document.querySelector('.landing-mascot').click(); true", session)
                    await asyncio.sleep(0.6)
                    result["click"] = {"pathname": await cdp.eval("location.pathname", session), "expectedRedirect": "/login"}
                log(SCENARIO, "done")

            elif SCENARIO == "compare":
                a = decode_png(open(os.path.join(OUT_DIR, "baseline-clip.png"), "rb").read())
                b = decode_png(open(os.path.join(OUT_DIR, "final-clip.png"), "rb").read())
                if a[0] != b[0] or a[1] != b[1]:
                    result["compare"] = {"sizeMismatch": True, "a": f"{a[0]}x{a[1]}", "b": f"{b[0]}x{b[1]}"}
                else:
                    ch = min(a[2], b[2])
                    total = a[0] * a[1]
                    diff = 0
                    max_delta = 0
                    for i in range(0, len(a[3]), ch):
                        d = sum(abs(a[3][i + c] - b[3][i + c]) for c in range(ch))
                        if d:
                            diff += 1
                            max_delta = max(max_delta, d)
                    result["compare"] = {"total": total, "diffPixels": diff, "maxDelta": max_delta,
                                         "identical": diff == 0}
                log("compare done", result["compare"])
        except Exception as e:
            import traceback
            result["error"] = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
            log("ERROR", result["error"])
        with open(os.path.join(OUT_DIR, f"{SCENARIO}-result.json"), "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print("RESULT_JSON_START")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print("RESULT_JSON_END")
        reader_task.cancel()
    try:
        proc.terminate()
    except Exception:
        pass
    await asyncio.sleep(0.3)
    try:
        proc.kill()
    except Exception:
        pass
    shutil.rmtree(profile, ignore_errors=True)
    sys.exit(1 if result.get("error") or (SCENARIO == "compare" and not result.get("compare", {}).get("identical")) else 0)

if __name__ == "__main__":
    asyncio.run(main())

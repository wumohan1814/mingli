"""第三轮美术素材后处理（修复版，带详细日志）。
Q 版三张：浅暖灰 #E6E2DA 背景色键控 -> RGBA -> 裁 480x600 -> WebP+PNG
Logo 一张：墨青满版 -> 擦右下水印 -> resize 192/512/180 + maskable512 -> WebP+PNG
"""
import os, sys
from PIL import Image, ImageDraw, ImageChops, ImageFilter

ART = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "art"))
MM = os.path.join(ART, "module-mascot")
PWA = os.path.join(ART, "pwa")


def log(*a):
    print(*a, flush=True)


def chroma_key(im, bg, thresh, soft):
    """色键控：与背景 bg 的最大通道差 <= thresh 透明，>= thresh+soft 不透明，中间软边。"""
    im = im.convert("RGB")
    W, H = im.size
    px = im.load()
    alpha = Image.new("L", (W, H), 0)
    pa = alpha.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            if d <= thresh:
                pa[x, y] = 0
            elif d >= thresh + soft:
                pa[x, y] = 255
            else:
                pa[x, y] = int((d - thresh) / soft * 255)
    im.putalpha(alpha)
    return im


def alpha_stats(im):
    if im.mode != "RGBA":
        return "no-alpha"
    a = im.split()[-1]
    h = a.histogram()
    n = im.size[0] * im.size[1]
    return f"t={h[0]/n*100:.1f}% o={h[255]/n*100:.1f}%"


def crop_cover(im, tw, th):
    iw, ih = im.size
    tr, ir = tw / th, iw / ih
    if ir > tr:
        nw = int(round(ih * tr)); left = (iw - nw) // 2
        box = (left, 0, left + nw, ih)
    elif ir < tr:
        nh = int(round(iw / tr)); top = (ih - nh) // 2
        box = (0, top, iw, top + nh)
    else:
        box = (0, 0, iw, ih)
    return im.crop(box).resize((tw, th), Image.LANCZOS)


def save_pair(im, d, name):
    os.makedirs(d, exist_ok=True)
    webp = os.path.join(d, name + ".webp")
    png = os.path.join(d, name + ".png")
    im.save(webp, "WEBP", quality=92, method=6)
    if im.mode == "RGBA":
        im.save(png, "PNG", optimize=True)
    else:
        im.convert("P", palette=Image.ADAPTIVE, colors=128).save(png, "PNG", optimize=True)
    return os.path.getsize(webp) / 1024, os.path.getsize(png) / 1024


# ---------- Q 版三张 ----------
log("=" * 60)
log("Q 版主图：色键控(浅灰#E6E2DA) + 480x600 + WebP+PNG")
log("=" * 60)
Q = [
    ("guoxue", "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-10-25.png", (230, 226, 218), 35, 12),
    ("xishi",  "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-10-54.png", (230, 226, 218), 35, 12),
    ("mbti",   "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-11-29.png", (230, 226, 218), 35, 12),
]
for name, rel, bg, th, soft in Q:
    src = os.path.join(ART, rel)
    if not os.path.exists(src):
        log(f"[Q] {name} MISSING {src}"); continue
    im = Image.open(src)
    log(f"\n[Q] {name} src={im.size} mode={im.mode}")
    im2 = chroma_key(im, bg, th, soft)
    log(f"  alpha: {alpha_stats(im2)}")
    im3 = crop_cover(im2, 480, 600)
    wb, pb = save_pair(im3, MM, f"{name}-mascot")
    log(f"  -> {name}-mascot.webp {wb:.1f}KB / .png {pb:.1f}KB | alpha={alpha_stats(im3)}")

# ---------- Logo ----------
log("\n" + "=" * 60)
log("PWA Logo：擦水印 + resize 多尺寸 + maskable")
log("=" * 60)
logo_src = os.path.join(PWA, "Square_PWA___app_icon_design___2026-09-08T03-09-29.png")
im = Image.open(logo_src).convert("RGB")
W, H = im.size
log(f"[PWA] src={im.size} mode={im.mode}")
# 擦右下角水印：采样左下角墨青作为填充色
fill = im.getpixel((8, H - 8))
log(f"  bg fill color (bottom-left): {fill}")
d = ImageDraw.Draw(im)
d.rectangle([760, 930, 1022, 1018], fill=fill)
# 局部轻微模糊让硬边自然
region = im.crop([750, 920, 1024, 1024])
region = region.filter(ImageFilter.GaussianBlur(6))
im.paste(region, (750, 920))
# 主稿保存
mp = os.path.join(PWA, "icon-master-1024.png")
mw = os.path.join(PWA, "icon-master-1024.webp")
im.save(mp, "PNG", optimize=True)
im.save(mw, "WEBP", quality=92, method=6)
log(f"  -> icon-master-1024.png {os.path.getsize(mp)/1024:.1f}KB / .webp {os.path.getsize(mw)/1024:.1f}KB")

for size, nm in [(192, "icon-192"), (512, "icon-512"), (180, "apple-touch-icon-180")]:
    out = im.resize((size, size), Image.LANCZOS)
    p_png = os.path.join(PWA, f"{nm}.png")
    p_webp = os.path.join(PWA, f"{nm}.webp")
    out_p = out.convert("P", palette=Image.ADAPTIVE, colors=128)
    out_p.save(p_png, "PNG", optimize=True)
    out.save(p_webp, "WEBP", quality=92, method=6)
    log(f"  -> {nm}.png {os.path.getsize(p_png)/1024:.1f}KB / .webp {os.path.getsize(p_webp)/1024:.1f}KB")

# maskable: 直接 resize（主体已在 80% 安全区），满版墨青
mk = im.resize((512, 512), Image.LANCZOS)
mk_png = os.path.join(PWA, "icon-maskable-512.png")
mk_webp = os.path.join(PWA, "icon-maskable-512.webp")
mk.convert("P", palette=Image.ADAPTIVE, colors=128).save(mk_png, "PNG", optimize=True)
mk.save(mk_webp, "WEBP", quality=92, method=6)
log(f"  -> icon-maskable-512.png {os.path.getsize(mk_png)/1024:.1f}KB / .webp {os.path.getsize(mk_webp)/1024:.1f}KB")

# ---------- 交付清单 ----------
log("\n" + "=" * 60)
log("交付目录")
log("=" * 60)
for d in [MM, PWA]:
    log(f"\n[{os.path.basename(d)}]")
    for f in sorted(os.listdir(d)):
        p = os.path.join(d, f)
        log(f"  {os.path.getsize(p)/1024:7.1f} KB  {f}")
log("\nDONE")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成「潮汕圣杯（掷筊）· 月牙形筊杯」美术资产。
- 两态共用同一月牙轮廓（可完全重合），仅明暗/材质不同。
- 平面态：朱漆平面朝上 + 下沿暗色侧壁厚度。
- 凸面态：木色凸背朝上 + 沿长轴柔和高光脊。
- 透明底，4px(@2x)留白，长轴水平，居中对称。
输出：webp 运行图(@2x/@3x) + png 母版(@4x) + 选交 pair 图 + svg 矢量源 + 验收对比图。
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw

SS = 4  # 超采样倍数（抗锯齿）

# 画布（@2x 基准 192x80；按比例缩放生成其它尺寸）
PALETTE = {
    "redHi":   (224, 112, 92),    # #E0705C 朱漆高光
    "redMid":  (200, 68, 46),     # #C8442E 朱漆主
    "redBase": (179, 38, 30),     # #B3261E 朱漆
    "redDark": (126, 27, 22),     # #7E1B16 暗部
    "sideDark":(76, 46, 18),      # #4C2E12 侧壁/木暗
    "woodHi":  (212, 176, 106),   # #D4B06A 脊线高光
    "woodMid": (169, 122, 60),    # #A97A3C 木本色
    "woodLow": (122, 77, 34),     # #7A4D22 木中暗
    "gold":    (184, 137, 62),    # #B8893E 描金边
}

def _cubic(p0, c1, c2, p1, n):
    pts = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt**3*p0[0] + 3*mt*mt*t*c1[0] + 3*mt*t*t*c2[0] + t**3*p1[0]
        y = mt**3*p0[1] + 3*mt*mt*t*c1[1] + 3*mt*t*t*c2[1] + t**3*p1[1]
        pts.append((x, y))
    return pts

def crescent_polygon(W, H, n_top=64, n_end=20, n_bot=64):
    """半月/月牙轮廓（长轴水平，左右镜像对称）：
    上缘 = 强拱弧（外背），下缘 = 微下垂浅弧（近直），两端圆钝收口。
    中部厚、两端圆钝——是「木片半月」而非香蕉/腰果。"""
    sx, sy = W / 192.0, H / 80.0
    def P(x, y): return (x * sx, y * sy)
    # 基准点（@2x 192x80 画布，中心 96,40）
    Lt = P(16, 40)      # 左端上角
    Rt = P(176, 40)     # 右端上角
    Rb = P(176, 56)     # 右端下角
    Lb = P(16, 56)      # 左端下角
    capR = 8 * sx       # 端部半圆半径
    pts = []
    # 1) 上缘：Lt -> Rt，强拱，中央峰 y≈6
    pts += _cubic(Lt, P(56, -5.3), P(136, -5.3), Rt, n_top)
    # 2) 右端半圆：Rt -> Rb，经 (184,48)
    cy = (Rt[1] + Rb[1]) / 2.0
    for i in range(1, n_end + 1):
        a = -math.pi/2 + math.pi * i / n_end
        pts.append((Rt[0] + capR*math.cos(a), cy + capR*math.sin(a)))
    # 3) 下缘：Rb -> Lb，微下垂，中央 y≈70
    pts += _cubic(Rb, P(60, 74.7), P(132, 74.7), Lb, n_bot)
    # 4) 左端半圆：Lb -> Lt，经 (8,48)
    cy = (Lt[1] + Lb[1]) / 2.0
    for i in range(1, n_end + 1):
        a = math.pi/2 + math.pi * i / n_end
        pts.append((Lt[0] + capR*math.cos(a), cy + capR*math.sin(a)))
    return pts

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i]-a[i])*t)) for i in range(3))

def render_state(W, H, mode, stroke_w_frac=1.5):
    """渲染单态（平面/凸面）到 W×H 的 RGBA ndarray（已抗锯齿）。"""
    HW, HH = W * SS, H * SS
    pts = crescent_polygon(HW, HH)

    # 1) 遮罩
    mask_img = Image.new('L', (HW, HH), 0)
    ImageDraw.Draw(mask_img).polygon(pts, fill=255)
    mask = np.asarray(mask_img, dtype=bool)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise RuntimeError("empty mask")

    # 逐列上下界（用于纵向归一化 shading）
    col_min = np.full(HW, HW, dtype=np.int64)
    col_max = np.full(HW, -1, dtype=np.int64)
    np.minimum.at(col_min, xs, ys)
    np.maximum.at(col_max, xs, ys)

    center = col_min[xs] + (col_max[xs] - col_min[xs]) / 2.0
    half = np.maximum((col_max[xs] - col_min[xs]) / 2.0, 1.0)
    v = (ys - center) / half                      # [-1,1]，0=中线
    vert_top = (col_max[xs] - ys) / np.maximum((col_max[xs] - col_min[xs]), 1.0)  # 顶=1 底=0

    col = np.zeros((HH, HW, 3), dtype=np.float64)

    if mode == "flat":
        redHi, redMid, redBase, redDark = (np.array(PALETTE["redHi"], float),
                                           np.array(PALETTE["redMid"], float),
                                           np.array(PALETTE["redBase"], float),
                                           np.array(PALETTE["redDark"], float))
        sideDark = np.array(PALETTE["sideDark"], float)
        # 平面 = 中间调大色块（#B3261E→#C8442E），仅上缘一点高光
        base = redBase[None, :] + (redMid - redBase)[None, :] * vert_top[:, None]
        rim = np.clip((vert_top - 0.78) / 0.22, 0.0, 1.0)   # 顶部 22% 渐入高光
        base = base + (redHi - redMid)[None, :] * rim[:, None] * 0.85
        # 下沿侧壁厚度（4–6px @2x）
        sideThk = 6.0 * SS
        depth = (col_max[xs] - ys).astype(float)        # 距底边
        strip = np.clip(1.0 - depth / sideThk, 0.0, 1.0)
        c = base * (1 - strip)[:, None] + sideDark[None, :] * strip[:, None]
    else:  # convex
        edgeDark = np.array(PALETTE["sideDark"], float)
        woodMid = np.array(PALETTE["woodMid"], float)
        woodLow = np.array(PALETTE["woodLow"], float)
        woodHi = np.array(PALETTE["woodHi"], float)
        av = np.abs(v)
        rf = np.cos(av * math.pi / 2.0)                  # 中线脊=1，边缘=0
        # 基础：暗边 -> 木中，沿脊升起
        c = edgeDark[None, :] + (woodMid - edgeDark)[None, :] * rf[:, None]
        # 脊线高光（收窄，避免发金过亮）
        c = c + (woodHi - woodMid)[None, :] * (rf ** 2.6)[:, None] * 0.5
        # 顶左光轻微提亮
        c = c * (0.88 + 0.12 * vert_top[:, None])
        c = np.clip(c, 0, 255)

    col[ys, xs] = np.clip(c, 0, 255)

    # 2) 描金边（仅在遮罩内）
    gold = PALETTE["gold"]
    stroke = Image.new('RGBA', (HW, HH), (0, 0, 0, 0))
    ImageDraw.Draw(stroke).polygon(pts, outline=gold + (255,), width=max(1, int(SS * stroke_w_frac)))
    sa = np.asarray(stroke)
    sm = sa[:, :, 3] > 0
    sel = sm & mask
    col[sel] = gold
    alpha = mask.astype(np.uint8) * 255  # 描边仅保留遮罩内部分，禁止外溢

    rgba = np.zeros((HH, HW, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(col, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = alpha
    return rgba

def to_pil(rgba):
    return Image.fromarray(rgba, 'RGBA')

def save_webp_png(rgba_hi, W, H, base, name_webp, name_png=None):
    """rgba_hi 为超采样大图；下采样到 W×H 存 webp，原大图存 png(母版)。"""
    img = to_pil(rgba_hi).resize((W, H), Image.LANCZOS)
    os.makedirs(os.path.dirname(base), exist_ok=True)
    wp = os.path.join(base, name_webp)
    img.save(wp, "WEBP", lossless=True)
    if name_png:
        pp = os.path.join(base, name_png)
        to_pil(rgba_hi).save(pp, "PNG")
        return wp, pp
    return wp, None

def svg_path_d(W, H):
    pts = crescent_polygon(W, H)
    d = "M %.2f %.2f " % pts[0]
    for p in pts[1:]:
        d += "L %.2f %.2f " % p
    d += "Z"
    return d

def write_svg(W, H, mode, path):
    d = svg_path_d(W, H)
    if mode == "flat":
        fills = '''
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E0705C"/>
      <stop offset="25%" stop-color="#C8442E"/>
      <stop offset="100%" stop-color="#B3261E"/>
    </linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7E1B16" stop-opacity="0"/>
      <stop offset="82%" stop-color="#7E1B16" stop-opacity="0"/>
      <stop offset="100%" stop-color="#4C2E12" stop-opacity="1"/>
    </linearGradient>'''
        body = '<path d="%s" fill="url(#g)"/>\n  <path d="%s" fill="url(#side)"/>' % (d, d)
    else:
        fills = '''
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4C2E12"/>
      <stop offset="35%" stop-color="#A97A3C"/>
      <stop offset="50%" stop-color="#C0965A"/>
      <stop offset="65%" stop-color="#A97A3C"/>
      <stop offset="100%" stop-color="#4C2E12"/>
    </linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7A4D22" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#4C2E12" stop-opacity="0.15"/>
    </linearGradient>'''
        body = '<path d="%s" fill="url(#g)"/>\n  <path d="%s" fill="url(#side)"/>' % (d, d)
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">
  <defs>%s
  </defs>
  %s
  <path d="%s" fill="none" stroke="#B8893E" stroke-width="1"/>
</svg>''' % (W, H, W, H, fills, body, d)
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)

def build_pair(W, H):
    """选交：平面(左) + 凸面(右) 并排（圣杯组合静态小图）。
    两枚等比缩放（0.42x），间距 26px(@2x)，垂直居中，保持长宽比不变形。"""
    scale = 0.42
    pw, ph = int(W * scale), int(H * scale)      # 80 x 33 (@2x)
    gap = int(26 * (W / 192.0))
    total = pw * 2 + gap
    x0 = (W - total) // 2
    y0 = (H - ph) // 2
    flat = to_pil(render_state(W, H, "flat")).resize((pw, ph), Image.LANCZOS)
    conv = to_pil(render_state(W, H, "convex")).resize((pw, ph), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(flat, (x0, y0))
    canvas.alpha_composite(conv, (x0 + pw + gap, y0))
    return np.asarray(canvas)

def build_verify(flat_rgba, conv_rgba, W=192, H=80):
    """验收对比图：原图 / 缩到96x40黑底 / 灰度。"""
    flat = to_pil(flat_rgba).resize((W, H), Image.LANCZOS)
    conv = to_pil(conv_rgba).resize((W, H), Image.LANCZOS)
    sw, sh = 96, 40
    f_small = flat.resize((sw, sh), Image.LANCZOS)
    c_small = conv.resize((sw, sh), Image.LANCZOS)
    # 黑底
    bg = Image.new('RGBA', (sw, sh), (10, 10, 14, 255))
    f_on = Image.new('RGBA', (sw, sh), (10, 10, 14, 255)); f_on.alpha_composite(f_small, (0, 0))
    c_on = Image.new('RGBA', (sw, sh), (10, 10, 14, 255)); c_on.alpha_composite(c_small, (0, 0))
    # 灰度
    f_g = f_small.convert('L').convert('RGB')
    c_g = c_small.convert('L').convert('RGB')
    # 拼版
    cell_w, cell_h = sw, sh
    pad = 16
    label_h = 22
    cols = 3
    rows = 2
    Wc = cols * cell_w + (cols + 1) * pad
    Hc = rows * cell_h + (rows + 1) * pad + label_h
    out = Image.new('RGB', (Wc, Hc), (20, 20, 24))
    from PIL import ImageFont
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    def place(img, x, y, title):
        out.paste(img, (x, y))
        # 简易标题（白字）
        d = ImageDraw.Draw(out)
        d.text((x, y - label_h + 4), title, fill=(220, 220, 220), font=font)
    # 行1: 原图并排
    out.paste(flat, (pad, pad + label_h)); 
    out.paste(conv, (pad + cell_w + pad, pad + label_h))
    ImageDraw.Draw(out).text((pad, pad - 2), "original @2x  (L=flat / R=convex)", fill=(220,220,220), font=font)
    # 行2: 缩96x40 黑底 + 灰度
    y2 = pad + label_h + cell_h + pad
    out.paste(f_on, (pad, y2 + label_h))
    out.paste(c_on, (pad + cell_w + pad, y2 + label_h))
    out.paste(f_g, (pad + 2*(cell_w + pad), y2 + label_h))
    ImageDraw.Draw(out).text((pad, y2 - 2), "96x40 black bg  FLAT", fill=(220,220,220), font=font)
    ImageDraw.Draw(out).text((pad + cell_w + pad, y2 - 2), "96x40 black bg  CONVEX", fill=(220,220,220), font=font)
    ImageDraw.Draw(out).text((pad + 2*(cell_w + pad), y2 - 2), "96x40 grayscale FLAT", fill=(220,220,220), font=font)
    return out

def main():
    root = r"C:\Users\wumoh\Documents\Vibecoding\mingli"
    run_dir = os.path.join(root, "frontend", "public", "art", "shengbei")
    arc_dir = os.path.join(root, "_archive", "美术-素材原件", "art", "shengbei")
    os.makedirs(run_dir, exist_ok=True)
    os.makedirs(arc_dir, exist_ok=True)

    # @2x 运行图（192x80）
    W2, H2 = 192, 80
    flat2 = render_state(W2, H2, "flat")
    conv2 = render_state(W2, H2, "convex")
    to_pil(flat2).resize((W2, H2), Image.LANCZOS).save(os.path.join(run_dir, "shengbei-flat.webp"), "WEBP", lossless=True)
    to_pil(conv2).resize((W2, H2), Image.LANCZOS).save(os.path.join(run_dir, "shengbei-convex.webp"), "WEBP", lossless=True)

    # @3x 运行图（288x120）
    W3, H3 = 288, 120
    to_pil(render_state(W3, H3, "flat")).resize((W3, H3), Image.LANCZOS).save(os.path.join(run_dir, "shengbei-flat@3x.webp"), "WEBP", lossless=True)
    to_pil(render_state(W3, H3, "convex")).resize((W3, H3), Image.LANCZOS).save(os.path.join(run_dir, "shengbei-convex@3x.webp"), "WEBP", lossless=True)

    # 母版 PNG（@4x = 384x160 超采样原图，长边 >= 300）
    Wm, Hm = 384, 160
    to_pil(render_state(Wm, Hm, "flat")).save(os.path.join(arc_dir, "shengbei-flat.png"), "PNG")
    to_pil(render_state(Wm, Hm, "convex")).save(os.path.join(arc_dir, "shengbei-convex.png"), "PNG")

    # 选交 pair（运行图 @2x + 母版 @4x）
    to_pil(build_pair(W2, H2)).resize((W2, H2), Image.LANCZOS).save(os.path.join(run_dir, "shengbei-pair.webp"), "WEBP", lossless=True)
    to_pil(build_pair(Wm, Hm)).save(os.path.join(arc_dir, "shengbei-pair.png"), "PNG")

    # SVG 矢量源（留档）
    write_svg(W2, H2, "flat", os.path.join(arc_dir, "shengbei-flat.svg"))
    write_svg(W2, H2, "convex", os.path.join(arc_dir, "shengbei-convex.svg"))

    print("OK")
    for p in [os.path.join(run_dir, n) for n in
              ["shengbei-flat.webp", "shengbei-convex.webp",
               "shengbei-flat@3x.webp", "shengbei-convex@3x.webp", "shengbei-pair.webp"]] + \
             [os.path.join(arc_dir, n) for n in
              ["shengbei-flat.png", "shengbei-convex.png", "shengbei-pair.png",
               "shengbei-flat.svg", "shengbei-convex.svg"]]:
        print("  ", p, os.path.getsize(p) if os.path.exists(p) else "MISSING")

if __name__ == "__main__":
    main()

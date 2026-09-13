# 命理 · M1/REQ-106 小六壬掌诀图后处理
# 输入: 1024x1024 纯白底生图稿
# 输出: art/xiaoliuren/xiaoliuren-palm.{png,webp} 512x512 透明
# 附: 六宫中心点画布百分比锚点清单（写入 xiaoliuren-anchors.txt）
import os
from PIL import Image, ImageChops

ART = r'C:\Users\wumoh\Documents\Vibecoding\mingli\frontend\public\art'
RAW = os.path.join(ART, 'xiaoliuren', 'Isolated_circular_emblem_desig_2026-09-08T17-46-28.png')
OUT_PNG = os.path.join(ART, 'xiaoliuren', 'xiaoliuren-palm.png')
OUT_WEBP = os.path.join(ART, 'xiaoliuren', 'xiaoliuren-palm.webp')
OUT_ANCHOR = os.path.join(ART, 'xiaoliuren', 'xiaoliuren-anchors.txt')
TW, TH = 512, 512

# 视觉种子（六宫掐指顺序：大安→留连→速喜→赤口→小吉→空亡）
# 1024 画布坐标，按手部朝向（食指指向左上、拇指在右、袖口在右下）
SEEDS = [
    (505, 655),  # 大安 - 食指根（掌心偏下，因食指指向左上，根在右下）
    (380, 540),  # 留连 - 食指中节
    (310, 370),  # 速喜 - 食指尖
    (450, 370),  # 赤口 - 中指尖
    (610, 470),  # 小吉 - 无名指尖
    (700, 670),  # 空亡 - 无名指根
]
NAMES = ['大安','留连','速喜','赤口','小吉','空亡']


def white_key_rgba(im):
    """白键控抠图：纯白->透明，其余保留"""
    im = im.convert('RGB')
    white = Image.new('RGB', im.size, (255, 255, 255))
    diff = ImageChops.difference(im, white)
    r, g, b = diff.split()
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)

    def f(v):
        if v <= 5: return 0
        if v >= 34: return 255
        return int(round((v - 5) * 255 / 29))
    alpha = mx.point(f, mode='L')
    out = im.copy()
    out.putalpha(alpha)
    return out


def build_node_mask(im):
    """亮金节点掩码：R>=180 & G in [120,210] & B<=150（放宽以兼容掌心区域略暗的节点）"""
    r, g, b = im.split()
    mR = r.point([255 if i >= 180 else 0 for i in range(256)])
    mG = g.point([255 if 120 <= i <= 210 else 0 for i in range(256)])
    mB = b.point([255 if i <= 150 else 0 for i in range(256)])
    mask = ImageChops.multiply(ImageChops.multiply(mR, mG), mB)
    return mask.convert('L')


def refine_centroid(mask, sx, sy, radius=60):
    """以种子为中心，在 radius 内对亮金像素加权求质心"""
    W, H = mask.size
    x0, y0 = max(0, sx - radius), max(0, sy - radius)
    x1, y1 = min(W, sx + radius + 1), min(H, sy + radius + 1)
    region = mask.crop((x0, y0, x1, y1))
    px = region.load()
    sw = sxw = syw = 0
    for yy in range(y1 - y0):
        for xx in range(x1 - x0):
            if px[xx, yy]:
                sw += 1
                sxw += xx + x0
                syw += yy + y0
    if sw > 0:
        return sxw / sw, syw / sw, sw
    return sx, sy, 0


def main():
    assert os.path.exists(RAW), f'raw not found: {RAW}'
    im = Image.open(RAW)
    print(f'raw size={im.size} mode={im.mode}')

    # 1) 白键控抠图
    im_rgba = white_key_rgba(im)
    a = im_rgba.split()[-1]
    h = a.histogram()
    n = im_rgba.size[0] * im_rgba.size[1]
    print(f'raw alpha fully-transparent: {h[0]/n*100:.1f}% | fully-opaque: {h[255]/n*100:.1f}%')

    # 2) 节点检测（在白键控之前的原图上做更稳）
    node_mask = build_node_mask(im.convert('RGB'))
    W, H = im.size
    centroids = []
    print('\n=== 节点质心精化（1024 画布）===')
    for nm, (sx, sy) in zip(NAMES, SEEDS):
        cx, cy, mass = refine_centroid(node_mask, sx, sy, radius=60)
        centroids.append((cx, cy))
        print(f'  {nm}: seed=({sx},{sy}) -> centroid=({cx:.0f},{cy:.0f}) mass={mass}')

    # 3) Resize 到 512x512
    im_512 = im_rgba.resize((TW, TH), Image.LANCZOS)
    a2 = im_512.split()[-1]
    h2 = a2.histogram()
    n2 = TW * TH
    print(f'\n512 alpha fully-transparent: {h2[0]/n2*100:.1f}% | fully-opaque: {h2[255]/n2*100:.1f}%')

    # 4) 保存（PNG 母版用 adaptive palette 128 压到 ≤300KB；WebP 透明 α 体积小）
    im_512.save(OUT_PNG, 'PNG', optimize=True)
    im_512.save(OUT_WEBP, 'WEBP', quality=90, method=6)
    png_kb = os.path.getsize(OUT_PNG) / 1024
    webp_kb = os.path.getsize(OUT_WEBP) / 1024
    # PNG 母版超 300KB 时降级到 adaptive palette 128
    if png_kb > 300:
        rgb = im_512.convert('RGB')
        pal = rgb.convert('P', palette=Image.ADAPTIVE, colors=128)
        pal.save(OUT_PNG, 'PNG', optimize=True)
        png_kb = os.path.getsize(OUT_PNG) / 1024
        print(f'PNG 母版超 300KB，降级 adaptive palette 128 -> {png_kb:.1f}KB')
    print(f'\nPNG  {png_kb:.1f}KB  {OUT_PNG}')
    print(f'WebP {webp_kb:.1f}KB  {OUT_WEBP}')

    # 5) 写锚点清单
    lines = []
    lines.append('# 小六壬掌诀图 · 六宫中心点锚点清单')
    lines.append('# 画布百分比（512x512 输出与 1024 原图同比例），与掐指顺序一致：大安→留连→速喜→赤口→小吉→空亡')
    lines.append('# 替换点：前端 .xlr-ring { background-image: var(--art-xlr-palm) } 已有槽位；图内六宫为装饰锚点')
    lines.append('# 若需与 DOM 宫名严格对齐，前端须改 xlrRingPos 读取本表（当前硬编码 60° 环列）')
    lines.append('# 顺序, 宫名, x%, y%')
    for nm, (cx, cy) in zip(NAMES, centroids):
        lines.append(f'{NAMES.index(nm)+1}, {nm}, {cx/W*100:.1f}%, {cy/H*100:.1f}%')
    with open(OUT_ANCHOR, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'\n锚点清单: {OUT_ANCHOR}')
    for L in lines:
        print('  ' + L)


if __name__ == '__main__':
    main()

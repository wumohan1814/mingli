"""压缩 Q版 PNG 母版到 <=300KB + 归档废稿 + 删冗余主稿。"""
import os, shutil
from PIL import Image

ART = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "art"))
MM = os.path.join(ART, "module-mascot")
PWA = os.path.join(ART, "pwa")
DRAFT = os.path.join(ART, "_drafts_r3")
os.makedirs(DRAFT, exist_ok=True)


def log(*a):
    print(*a, flush=True)


# 1) 压 Q版 PNG 母版（palette，保留 alpha）
for n in ["guoxue", "xishi", "mbti"]:
    p = os.path.join(MM, f"{n}-mascot.png")
    im = Image.open(p).convert("RGBA")
    pim = im.convert("P", palette=Image.ADAPTIVE, colors=200)
    pim.save(p, "PNG", optimize=True)
    log(f"{n}-mascot.png -> {os.path.getsize(p)/1024:.1f}KB")

# 2) 删冗余主稿（03-09-29 原稿保留作为溯源）
for f in ["icon-master-1024.png", "icon-master-1024.webp"]:
    fp = os.path.join(PWA, f)
    if os.path.exists(fp):
        os.remove(fp); log("removed redundant", f)

# 3) 归档废稿（不删，保留可回溯）
old = [
    "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-00-29.png",
    "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-00-30.png",
    "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-00-32.png",
    "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-07-04.png",
    "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-07-26.png",
    "module-mascot/Isolated_chibi__super_deformed_2026-09-08T03-07-53.png",
    "pwa/Square_PWA___app_icon_design___2026-09-08T03-00-38.png",
    "pwa/Square_PWA___app_icon_design___2026-09-08T03-08-13.png",
]
for rel in old:
    s = os.path.join(ART, rel)
    if os.path.exists(s):
        shutil.move(s, os.path.join(DRAFT, os.path.basename(s)))
        log("archived", os.path.basename(s))

# 4) 最终目录确认
log("\n=== module-mascot ===")
for f in sorted(os.listdir(MM)):
    log(f"  {os.path.getsize(os.path.join(MM,f))/1024:7.1f} KB  {f}")
log("=== pwa ===")
for f in sorted(os.listdir(PWA)):
    log(f"  {os.path.getsize(os.path.join(PWA,f))/1024:7.1f} KB  {f}")
log("DONE")

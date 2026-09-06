# -*- coding: utf-8 -*-
"""注册图形验证码：进程内内存存储 + PIL 生成 PNG（单进程单 worker 场景适用）。

设计：
  - _store: captcha_id -> (code, expire_ts)，纯内存字典，进程内有效；
    验证码明文不落文件、不写日志。
  - generate_captcha(): 4 位验证码（去易混淆 0/O/1/I/L，大写字母+数字），
    用 PIL 生成 120x40 PNG（白底、逐字符随机颜色/角度、2~3 干扰线 + 噪点），
    存 5 分钟 TTL，顺带清理过期项，返回 {captcha_id, image(dataURL)}。
  - verify_captcha(): 大小写不敏感比对，比对即作废（一次性），
    不存在/过期/不匹配一律返回 False。
"""
from __future__ import annotations

import base64
import io
import random
import secrets
import time

from PIL import Image, ImageDraw, ImageFont

# 去掉易混淆字符 0/O/1/I/L（大写字母 + 数字）
_CAPTCHA_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CAPTCHA_LENGTH = 4
_CAPTCHA_TTL_SECONDS = 300  # 5 分钟
_IMAGE_SIZE = (120, 40)

# captcha_id -> (code, expire_ts)
_store: dict[str, tuple[str, float]] = {}


def _random_color(lo: int = 20, hi: int = 170) -> tuple[int, int, int]:
    """干扰/字符随机颜色（深于纯白背景，保证可读）。"""
    return (
        random.randint(lo, hi),
        random.randint(lo, hi),
        random.randint(lo, hi),
    )


def _prune_expired(now: float | None = None) -> None:
    """清理已过期的验证码条目（生成时顺带调用）。"""
    if now is None:
        now = time.time()
    for cid in [k for k, (_, exp) in _store.items() if exp <= now]:
        _store.pop(cid, None)


def generate_captcha() -> dict:
    """生成一个 4 位图形验证码。

    Returns:
        {"captcha_id": str, "image": "data:image/png;base64,..."}
    """
    code = "".join(secrets.choice(_CAPTCHA_CHARS) for _ in range(_CAPTCHA_LENGTH))
    captcha_id = secrets.token_hex(8)

    # 默认内置字体（不依赖系统字体文件）；PIL >= 10.1 支持按 size 加载 FreeType 默认字体
    try:
        font = ImageFont.load_default(size=22)
    except TypeError:  # 老版本 PIL 兜底
        font = ImageFont.load_default()

    width, height = _IMAGE_SIZE
    image = Image.new("RGB", _IMAGE_SIZE, "white")
    draw = ImageDraw.Draw(image)

    # 2~3 条随机干扰线
    for _ in range(random.randint(2, 3)):
        draw.line(
            [
                (random.randint(0, width - 1), random.randint(0, height - 1)),
                (random.randint(0, width - 1), random.randint(0, height - 1)),
            ],
            fill=_random_color(60, 210),
            width=1,
        )

    # 逐字符：先画到透明小图（按字符实际像素 bbox 预留边距），随机旋转后贴回
    for i, ch in enumerate(code):
        probe = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        pd = ImageDraw.Draw(probe)
        left, top, right, bottom = pd.textbbox((0, 0), ch, font=font)
        glyph_w, glyph_h = right - left, bottom - top
        pad = 6
        tile = Image.new(
            "RGBA", (glyph_w + pad * 2, glyph_h + pad * 2), (0, 0, 0, 0)
        )
        td = ImageDraw.Draw(tile)
        td.text(
            (pad - left, pad - top),
            ch,
            font=font,
            fill=_random_color() + (255,),
        )
        tile = tile.rotate(
            random.randint(-25, 25), resample=Image.BICUBIC, expand=True
        )
        # 每字符占用约 26px 宽的槽位，贴图居中于槽位并加小幅纵向抖动
        slot_x = 9 + i * 26
        center_x = slot_x + 13
        center_y = height // 2 + random.randint(-4, 4)
        image.paste(
            tile,
            (
                int(center_x - tile.width / 2),
                int(center_y - tile.height / 2),
            ),
            tile,
        )

    # 少量噪点
    for _ in range(random.randint(40, 70)):
        draw.point(
            (random.randint(0, width - 1), random.randint(0, height - 1)),
            fill=_random_color(0, 255),
        )

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    now = time.time()
    _store[captcha_id] = (code, now + _CAPTCHA_TTL_SECONDS)
    _prune_expired(now)  # 顺便清理过期项

    return {
        "captcha_id": captcha_id,
        "image": "data:image/png;base64," + image_b64,
    }


def verify_captcha(captcha_id: str, captcha_code: str) -> bool:
    """校验验证码：大小写不敏感；比对即删除（一次性）。

    Returns:
        True  仅当 captcha_id 存在、未过期且 code 匹配；
        不存在 / 过期 / 不匹配均返回 False。
    """
    if not captcha_id or not captcha_code:
        return False
    entry = _store.pop(captcha_id, None)  # 一次性：取出即作废
    if entry is None:
        return False
    code, expire_ts = entry
    if time.time() > expire_ts:
        return False
    return str(captcha_code).strip().lower() == code.lower()

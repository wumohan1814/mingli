"""前台公开素材接口（REQ-059）：后台配置的素材槽 → 前台按需取 URL（免登录）。

后台「素材管理」（admin /admin/assets/*）把背景图 / 卡面等写进运维库
mingli_ops.asset_slots（key → url + 蒙版），本模块只负责对外提供查询，URL 拼进
background-image 等渲染逻辑由前端任务做（本文件不做渲染）。

热更语义：每次实时查 asset_slots 表、无启动缓存 → 后台 PUT（上传/替换）/
DELETE（删除恢复默认）后前台立即生效，无需重启；未配置的槽 url 为 null，
前台据此回退既有 CSS 艺术背景。

查询方式（响应 {code, message, data} 信封，与既有接口一致）：
  - GET /api/assets?keys=a,b,c   批量（推荐：一次拿多槽，减少请求）；
                                   未配置的请求 key → url: null（不区分
                                   "请求了但没配"与 key 拼错，前端统一回退）。
                                   data.assets = {key: url|null}（既有口径）；
                                   data.masks = {key: {opacity, color}|null}
                                   （REQ-059⑧ 蒙版：仅已配置槽含非 null 值；
                                   opacity=不透明度 0~1，null 表示不启用；
                                   color=hex，null 表示默认黑 #000000）。
  - GET /api/assets/{key}         单槽查询（key=agent-1 等单独取用时方便）；
                                   data 含 url / opacity / color 三字段。
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_ops_db
from app.models.ops import AssetSlot

router = APIRouter(prefix="/api/assets", tags=["assets"])

# 单次批量 key 数上限：全部槽约 150 个（模块 3 + 方法 6 + MBTI 16 + 卡面
# 78+36 + agent 5），500 足够一次拉全，同时防滥用。
_MAX_KEYS_PER_BATCH = 500


def _split_keys(raw: str) -> list[str]:
    """逗号分隔 → 去空白 / 去重 / 保留顺序的 key 列表（空输入 → []）。"""
    seen = set()
    out = []
    for part in (raw or "").split(","):
        k = part.strip()
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


@router.get("")
def batch_assets(
    keys: str = Query(..., description="逗号分隔的素材 key，如 keys=tarot-00,INTJ,agent-1"),
    db: Session = Depends(get_ops_db),
):
    """批量返回 {key: url} 与 {key: 蒙版}：只回已配置槽；未配置的请求 key 对应
    null（前台回退 CSS；蒙版 map 未配置槽为 null）。"""
    key_list = _split_keys(keys)
    if not key_list:
        return {"code": 0, "message": "ok", "data": {"assets": {}, "masks": {}}}
    if len(key_list) > _MAX_KEYS_PER_BATCH:
        key_list = key_list[:_MAX_KEYS_PER_BATCH]
    rows = (
        db.query(AssetSlot.key, AssetSlot.url, AssetSlot.opacity, AssetSlot.mask_color)
        .filter(AssetSlot.key.in_(key_list))
        .all()
    )
    url_by_key = {row[0]: row[1] for row in rows}
    mask_by_key = {
        row[0]: {"opacity": row[2], "color": row[3]} if row[2] is not None else None
        for row in rows
    }
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "assets": {k: url_by_key.get(k) for k in key_list},
            "masks": {k: mask_by_key.get(k) for k in key_list},
        },
    }


@router.get("/{key}")
def get_asset(key: str, db: Session = Depends(get_ops_db)):
    """单槽查询：url 为 null 表示未配置（前台回退 CSS 艺术背景）；opacity/color
    为该槽蒙版（REQ-059⑧），opacity=null 表示蒙版不启用、color=null 默认黑。"""
    row = db.query(AssetSlot).filter_by(key=key).first()
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "key": key,
            "url": row.url if row else None,
            "opacity": row.opacity if row else None,
            "color": row.mask_color if row else None,
        },
    }

"""统一错误码与业务异常。

错误码分段（见 docs/架构设计-产品化扩展.md §5）：
  0    成功
  1xxx 通用（1001 参数错误 / 1002 资源不存在 / 1003 冲突 / 1004 限流）
  2xxx 认证鉴权（2001 未登录 / 2002 token 过期 / 2003 无权限）
  3xxx case/档案（3001 case 不存在 / 3002 未排盘）
  4xxx 排盘/方法（4001 排盘参数无效 / 4002 方法降级）
  5xxx LLM/余额（5001 LLM 不可用 / 5002 余额不足 / 5003 计费异常）
  9xxx 系统（9000 内部错误 / 9001 数据库错误）
"""
from __future__ import annotations


# --- 错误码常量 ---
# 通用
ERR_PARAM = 1001
ERR_NOT_FOUND = 1002
ERR_CONFLICT = 1003
ERR_RATE_LIMITED = 1004
# 认证鉴权
ERR_UNAUTHORIZED = 2001
ERR_TOKEN_EXPIRED = 2002
ERR_FORBIDDEN = 2003
# case/档案
ERR_CASE_NOT_FOUND = 3001
ERR_NOT_PAIPAN = 3002
# 排盘/方法
ERR_PAIPAN_INVALID = 4001
ERR_METHOD_DEGRADED = 4002
# LLM/余额
ERR_LLM_UNAVAILABLE = 5001
ERR_INSUFFICIENT_CREDIT = 5002
ERR_BILLING = 5003
# 系统
ERR_INTERNAL = 9000
ERR_DB = 9001


# --- 错误码 -> HTTP 状态码映射 ---
def code_to_http(code: int) -> int:
    if 1000 <= code < 2000:
        return 400
    if code in (ERR_UNAUTHORIZED, ERR_TOKEN_EXPIRED):
        return 401
    if code == ERR_FORBIDDEN:
        return 403
    if 3000 <= code < 4000:
        return 404
    if 4000 <= code < 5000:
        return 422
    if 5000 <= code < 6000:
        return 502
    return 500


class BizError(Exception):
    """业务异常：带统一错误码。全局异常处理器会转成 {code, message, detail} 信封。"""

    def __init__(self, code: int, message: str, detail: str = ""):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "detail": self.detail}


# HTTP 状态码 -> 错误码（供 HTTPException 兜底映射）
_HTTP_TO_CODE = {
    400: ERR_PARAM,
    401: ERR_UNAUTHORIZED,
    403: ERR_FORBIDDEN,
    404: ERR_NOT_FOUND,
    409: ERR_CONFLICT,
    422: ERR_PARAM,
    429: ERR_RATE_LIMITED,
    500: ERR_INTERNAL,
    502: ERR_LLM_UNAVAILABLE,
    503: ERR_LLM_UNAVAILABLE,
}


def http_to_code(status_code: int) -> int:
    return _HTTP_TO_CODE.get(status_code, ERR_INTERNAL)

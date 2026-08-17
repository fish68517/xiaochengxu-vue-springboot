from secrets import compare_digest

from fastapi import Header, HTTPException, status

from app.core.config import get_settings

settings = get_settings()


def require_admin(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "ADMIN_AUTH_REQUIRED", "message": "请先登录管理后台"},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not compare_digest(token, settings.admin_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "ADMIN_TOKEN_INVALID", "message": "登录状态已失效"},
        )
    return settings.admin_username

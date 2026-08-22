from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_current_user, verify_password
from app.db.session import get_db
from app.models.entities import User
from app.schemas.api import LoginIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["身份认证"])


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.username == payload.username))
    if (
        user is None
        or not user.enabled
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "LOGIN_FAILED", "message": "账号或密码错误"},
        )
    return TokenOut(token=create_access_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.post("/logout")
def logout(_: User = Depends(get_current_user)) -> dict[str, str]:
    return {"message": "已退出登录"}

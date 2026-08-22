from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.entities import Favorite, Order, User, UserCoupon
from app.schemas.api import ProfileOut

router = APIRouter(tags=["个人中心"])


@router.get("/me", response_model=ProfileOut)
def profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    orders = db.scalars(select(Order).where(Order.user_id == current_user.id)).all()
    counts = {"pending": 0, "shipping": 0, "receiving": 0, "completed": 0, "refund": 0}
    for order in orders:
        if order.status == "PENDING_PAYMENT":
            counts["pending"] += 1
        elif order.status == "PAID":
            counts["shipping"] += 1
        elif order.status == "SHIPPED":
            counts["receiving"] += 1
        elif order.status == "COMPLETED":
            counts["completed"] += 1
    favorite_count = (
        db.scalar(select(func.count(Favorite.id)).where(Favorite.user_id == current_user.id)) or 0
    )
    coupon_count = (
        db.scalar(
            select(func.count(UserCoupon.id)).where(
                UserCoupon.user_id == current_user.id,
                UserCoupon.status == "AVAILABLE",
            )
        )
        or 0
    )
    return ProfileOut(
        id=current_user.id,
        username=current_user.username,
        nickname=current_user.nickname,
        level=current_user.level,
        points=current_user.points,
        coupon_count=coupon_count,
        favorite_count=favorite_count,
        order_counts=counts,
    )

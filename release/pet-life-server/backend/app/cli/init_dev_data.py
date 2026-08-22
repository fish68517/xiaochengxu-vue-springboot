from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import Address, Coupon, ProductCategory, User, UserCoupon


def main() -> None:
    settings = get_settings()
    if settings.app_env != "development":
        raise RuntimeError("init_dev_data can only run when APP_ENV=development")

    with SessionLocal() as db:
        categories = [("爬宠", 10), ("用品", 20), ("套餐", 30)]
        for name, sort_order in categories:
            if db.scalar(select(ProductCategory.id).where(ProductCategory.name == name)) is None:
                db.add(ProductCategory(name=name, sort_order=sort_order, enabled=True))

        user = db.scalar(select(User).where(User.username.in_(["user", "user1"])))
        if user is None:
            user = User(
                username="user",
                password_hash=hash_password("user123"),
                role="USER",
                enabled=True,
                nickname="本地商城用户",
                level=1,
                points=0,
                coupons=0,
                favorites=0,
            )
            db.add(user)
            db.flush()
        else:
            user.username = "user"
            user.password_hash = hash_password("user123")
            user.role = "USER"
            user.enabled = True

        admin = db.scalar(select(User).where(User.username == "admin"))
        if admin is None:
            admin = User(
                username="admin",
                password_hash=hash_password("admin123"),
                role="ADMIN",
                enabled=True,
                nickname="本地管理员",
                level=1,
                points=0,
                coupons=0,
                favorites=0,
            )
            db.add(admin)

        if db.scalar(select(Address.id).where(Address.user_id == user.id)) is None:
            db.add(
                Address(
                    user_id=user.id,
                    receiver_name="本地联调用户",
                    phone="13800001234",
                    province="广东省",
                    city="深圳市",
                    district="南山区",
                    detail="本地开发环境测试地址",
                    is_default=True,
                )
            )

        coupon = db.scalar(select(Coupon).where(Coupon.name == "本地开发优惠券"))
        if coupon is None:
            now = datetime.now()
            coupon = Coupon(
                name="本地开发优惠券",
                threshold_amount=Decimal("29.00"),
                discount_amount=Decimal("10.00"),
                start_at=now - timedelta(days=1),
                end_at=now + timedelta(days=30),
                enabled=True,
            )
            db.add(coupon)
            db.flush()
        if (
            db.scalar(
                select(UserCoupon.id).where(
                    UserCoupon.user_id == user.id,
                    UserCoupon.coupon_id == coupon.id,
                )
            )
            is None
        ):
            db.add(UserCoupon(user_id=user.id, coupon_id=coupon.id, status="AVAILABLE"))

        db.commit()
    print("Development accounts, address and coupon initialized in MySQL.")


if __name__ == "__main__":
    main()

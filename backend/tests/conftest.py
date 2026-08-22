import json
import os
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest

TEST_DATABASE = Path(__file__).resolve().parents[1] / "data" / "pet_life_test.db"
TEST_DATABASE.parent.mkdir(parents=True, exist_ok=True)
TEST_DATABASE.unlink(missing_ok=True)

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE.as_posix()}"
os.environ["APP_ENV"] = "test"
os.environ["JWT_SECRET"] = "test-only-secret"

from app.core.security import hash_password  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.models.entities import (  # noqa: E402
    Address,
    Coupon,
    LotteryActivity,
    LotteryPrize,
    Product,
    ProductCategory,
    User,
    UserCoupon,
)


@pytest.fixture(scope="session", autouse=True)
def database() -> None:
    Base.metadata.create_all(engine)
    now = datetime.now()
    with SessionLocal() as db:
        category = ProductCategory(name="用品", sort_order=1, enabled=True)
        db.add(category)
        db.flush()
        product = Product(
            category_id=category.id,
            name="数据库联调商品",
            category="用品",
            subtitle="用于隔离自动化测试",
            price=Decimal("39.00"),
            original_price=Decimal("49.00"),
            stock=50,
            image_key="food",
            detail_images_json="[]",
            tags="联调,MySQL",
            is_active=True,
        )
        user = User(
            username="user",
            password_hash=hash_password("user123"),
            nickname="普通用户",
            role="USER",
            enabled=True,
        )
        other = User(
            username="other",
            password_hash=hash_password("other123"),
            nickname="另一个用户",
            role="USER",
            enabled=True,
        )
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            nickname="管理员",
            role="ADMIN",
            enabled=True,
        )
        db.add_all([product, user, other, admin])
        db.flush()
        db.add(
            Address(
                user_id=user.id,
                receiver_name="测试用户",
                phone="13800001234",
                province="广东省",
                city="深圳市",
                district="南山区",
                detail="本地联调地址",
                is_default=True,
            )
        )
        coupon = Coupon(
            name="测试优惠券",
            threshold_amount=Decimal("29.00"),
            discount_amount=Decimal("10.00"),
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=30),
            enabled=True,
        )
        db.add(coupon)
        db.flush()
        db.add(UserCoupon(user_id=user.id, coupon_id=coupon.id, status="AVAILABLE"))
        activity = LotteryActivity(
            title="真实报名测试活动",
            subtitle="人数来自报名表",
            registration_start_at=now - timedelta(hours=1),
            registration_end_at=now + timedelta(days=1),
            draw_at=now + timedelta(days=2),
            status="REGISTERING",
            participant_count=0,
            prizes_json="[]",
            rules_json=json.dumps(["免费报名"], ensure_ascii=False),
            winners_json="[]",
        )
        db.add(activity)
        db.flush()
        db.add(
            LotteryPrize(
                activity_id=activity.id,
                level_name="一等奖",
                prize_name="优惠券",
                quantity=1,
                sort_order=1,
            )
        )
        db.commit()
    yield
    Base.metadata.drop_all(engine)
    engine.dispose()
    TEST_DATABASE.unlink(missing_ok=True)

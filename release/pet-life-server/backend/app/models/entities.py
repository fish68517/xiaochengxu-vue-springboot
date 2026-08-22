from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_categories.id"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(80), index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    subtitle: Mapped[str] = mapped_column(String(120))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    original_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    sales: Mapped[int] = mapped_column(Integer, default=0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    image_key: Mapped[str] = mapped_column(String(30), default="turtle")
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    detail_images_json: Mapped[str] = mapped_column(Text, default="[]")
    badge: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tags: Mapped[str] = mapped_column(String(200), default="")
    species: Mapped[str | None] = mapped_column(String(60), nullable=True)
    age: Mapped[str | None] = mapped_column(String(60), nullable=True)
    health: Mapped[str | None] = mapped_column(String(60), nullable=True)
    size: Mapped[str | None] = mapped_column(String(60), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(60), nullable=True)
    care_advice: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="USER", index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    wechat_openid: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    nickname: Mapped[str] = mapped_column(String(60))
    level: Mapped[int] = mapped_column(Integer, default=1)
    points: Mapped[int] = mapped_column(Integer, default=0)
    coupons: Mapped[int] = mapped_column(Integer, default=0)
    favorites: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    receiver_name: Mapped[str] = mapped_column(String(40))
    phone: Mapped[str] = mapped_column(String(30))
    province: Mapped[str] = mapped_column(String(40), default="")
    city: Mapped[str] = mapped_column(String(40), default="")
    district: Mapped[str] = mapped_column(String(40), default="")
    detail: Mapped[str] = mapped_column(String(240))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_favorite_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    threshold_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class LotteryActivity(Base):
    __tablename__ = "lottery_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    subtitle: Mapped[str] = mapped_column(String(160))
    registration_start_at: Mapped[datetime] = mapped_column(DateTime)
    registration_end_at: Mapped[datetime] = mapped_column(DateTime)
    draw_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(30), index=True)
    participant_count: Mapped[int] = mapped_column(Integer, default=0)
    prizes_json: Mapped[str] = mapped_column(Text, default="[]")
    rules_json: Mapped[str] = mapped_column(Text)
    winners_json: Mapped[str] = mapped_column(Text, default="[]")


class LotteryParticipant(Base):
    __tablename__ = "lottery_participants"
    __table_args__ = (UniqueConstraint("activity_id", "user_id", name="uq_activity_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("lottery_activities.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class LotteryPrize(Base):
    __tablename__ = "lottery_prizes"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("lottery_activities.id"), index=True)
    level_name: Mapped[str] = mapped_column(String(40))
    prize_name: Mapped[str] = mapped_column(String(100))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class LotteryWinner(Base):
    __tablename__ = "lottery_winners"
    __table_args__ = (
        UniqueConstraint("activity_id", "participant_id", name="uq_winner_activity_participant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("lottery_activities.id"), index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("lottery_participants.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    prize_id: Mapped[int] = mapped_column(ForeignKey("lottery_prizes.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_no: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    coupon_id: Mapped[int | None] = mapped_column(nullable=True)
    product_name: Mapped[str] = mapped_column(String(80))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    shipping_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(30), default="PENDING_PAYMENT", index=True)
    payment_status: Mapped[str] = mapped_column(String(20), default="UNPAID", index=True)
    address_name: Mapped[str] = mapped_column(String(40))
    address_phone: Mapped[str] = mapped_column(String(30))
    address_detail: Mapped[str] = mapped_column(String(240))
    remark: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    shipping_company: Mapped[str | None] = mapped_column(String(60), nullable=True)
    tracking_no: Mapped[str | None] = mapped_column(String(80), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class UserCoupon(Base):
    __tablename__ = "user_coupons"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    coupon_id: Mapped[int] = mapped_column(ForeignKey("coupons.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="AVAILABLE", index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True, index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    product_name: Mapped[str] = mapped_column(String(80))
    product_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    quantity: Mapped[int] = mapped_column(Integer)
    line_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))


class InventoryRecord(Base):
    __tablename__ = "inventory_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    change_quantity: Mapped[int] = mapped_column(Integer)
    before_stock: Mapped[int] = mapped_column(Integer)
    after_stock: Mapped[int] = mapped_column(Integer)
    business_type: Mapped[str] = mapped_column(String(30), index=True)
    business_id: Mapped[str] = mapped_column(String(60), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    provider: Mapped[str] = mapped_column(String(20), default="MANUAL")
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)
    provider_transaction_id: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True
    )
    confirmed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    operator: Mapped[str] = mapped_column(String(60), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    resource_type: Mapped[str] = mapped_column(String(50), index=True)
    resource_id: Mapped[str] = mapped_column(String(60))
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    subtitle: str
    price: Decimal
    original_price: Decimal | None
    sales: int
    stock: int
    image_key: str
    badge: str | None
    tags: list[str]
    species: str | None
    age: str | None
    health: str | None
    size: str | None
    gender: str | None
    care_advice: str | None
    is_active: bool


class LotteryActivityOut(BaseModel):
    id: int
    title: str
    subtitle: str
    registration_start_at: datetime
    registration_end_at: datetime
    draw_at: datetime
    status: str
    participant_count: int
    prizes: list[dict]
    rules: list[str]
    joined: bool


class LotteryResultOut(BaseModel):
    activity_id: int
    title: str
    status: str
    draw_at: datetime
    participant_count: int
    my_result: dict
    winners: list[dict]
    prizes: list[dict]


class JoinOut(BaseModel):
    joined: bool
    already_joined: bool
    participant_count: int
    message: str


class OrderCreate(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=20)
    use_coupon: bool = True
    address_name: str = Field(min_length=2, max_length=40)
    address_phone: str = Field(min_length=7, max_length=30)
    address_detail: str = Field(min_length=6, max_length=240)


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_no: str
    product_id: int
    product_name: str
    unit_price: Decimal
    quantity: int
    discount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal
    status: str
    address_name: str
    address_phone: str
    address_detail: str
    created_at: datetime
    paid_at: datetime | None
    shipping_company: str | None
    tracking_no: str | None
    shipped_at: datetime | None


class ProfileOut(BaseModel):
    nickname: str
    level: int
    points: int
    coupons: int
    favorites: int
    pets: list[dict]
    reminders: list[dict]
    order_counts: dict[str, int]

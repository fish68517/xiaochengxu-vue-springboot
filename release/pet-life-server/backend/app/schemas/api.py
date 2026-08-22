from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class LoginIn(BaseModel):
    username: str = Field(min_length=2, max_length=60)
    password: str = Field(min_length=6, max_length=120)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    nickname: str
    role: str
    enabled: bool
    level: int
    points: int


class TokenOut(BaseModel):
    token: str
    token_type: str = "bearer"
    user: UserOut


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sort_order: int
    enabled: bool


class ProductOut(BaseModel):
    id: int
    category_id: int | None
    name: str
    category: str
    subtitle: str
    price: Decimal
    original_price: Decimal | None
    sales: int
    stock: int
    image_key: str
    cover_url: str | None
    detail_images: list[str]
    badge: str | None
    tags: list[str]
    species: str | None
    age: str | None
    health: str | None
    size: str | None
    gender: str | None
    care_advice: str | None
    is_active: bool


class FavoriteStateOut(BaseModel):
    product_id: int
    favorite: bool


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=20)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=20)


class CartItemOut(BaseModel):
    id: int
    quantity: int
    product: ProductOut
    line_amount: Decimal


class AddressIn(BaseModel):
    receiver_name: str = Field(min_length=2, max_length=40)
    phone: str = Field(min_length=7, max_length=30)
    province: str = Field(default="", max_length=40)
    city: str = Field(default="", max_length=40)
    district: str = Field(default="", max_length=40)
    detail: str = Field(min_length=6, max_length=240)
    is_default: bool = False


class AddressOut(AddressIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class CouponOut(BaseModel):
    user_coupon_id: int
    coupon_id: int
    name: str
    threshold_amount: Decimal
    discount_amount: Decimal
    end_at: datetime
    status: str


class OrderSelectionIn(BaseModel):
    cart_item_ids: list[int] = Field(min_length=1, max_length=50)
    address_id: int
    user_coupon_id: int | None = None
    remark: str | None = Field(default=None, max_length=300)


class OrderPreviewItemOut(BaseModel):
    cart_item_id: int
    product_id: int
    product_name: str
    image_key: str
    cover_url: str | None
    unit_price: Decimal
    quantity: int
    line_amount: Decimal


class OrderPreviewOut(BaseModel):
    items: list[OrderPreviewItemOut]
    address: AddressOut
    subtotal: Decimal
    discount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal
    user_coupon_id: int | None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str
    product_image_url: str | None
    unit_price: Decimal
    quantity: int
    line_amount: Decimal


class OrderOut(BaseModel):
    id: int
    order_no: str
    user_id: int
    product_id: int
    product_name: str
    unit_price: Decimal
    quantity: int
    discount: Decimal
    shipping_fee: Decimal
    total_amount: Decimal
    status: str
    payment_status: str
    address_name: str
    address_phone: str
    address_detail: str
    remark: str | None
    created_at: datetime
    paid_at: datetime | None
    shipping_company: str | None
    tracking_no: str | None
    shipped_at: datetime | None
    items: list[OrderItemOut] = Field(default_factory=list)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_no: str
    order_id: int
    provider: str
    amount: Decimal
    status: str
    provider_transaction_id: str | None
    confirmed_at: datetime | None
    created_at: datetime


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


class ProfileOut(BaseModel):
    id: int
    username: str
    nickname: str
    level: int
    points: int
    coupon_count: int
    favorite_count: int
    order_counts: dict[str, int]

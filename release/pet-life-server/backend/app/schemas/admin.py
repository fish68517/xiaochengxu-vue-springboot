from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.api import OrderOut, PaymentOut, ProductOut


class AdminLoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=120)


class AdminLoginOut(BaseModel):
    token: str
    username: str
    environment: str


class DashboardOut(BaseModel):
    product_count: int
    active_product_count: int
    activity_count: int
    registering_activity_count: int
    participant_count: int
    order_count: int
    paid_order_count: int
    paid_amount: Decimal
    recent_orders: list[OrderOut]


class ProductAdminCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    category: str = Field(min_length=1, max_length=30)
    category_id: int | None = None
    subtitle: str = Field(min_length=2, max_length=120)
    price: Decimal = Field(gt=0)
    original_price: Decimal | None = Field(default=None, gt=0)
    stock: int = Field(default=0, ge=0)
    image_key: str = Field(default="turtle", max_length=30)
    cover_url: str | None = Field(default=None, max_length=500)
    detail_images: list[str] = Field(default_factory=list, max_length=10)
    badge: str | None = Field(default=None, max_length=20)
    tags: list[str] = Field(default_factory=list, max_length=8)
    species: str | None = Field(default=None, max_length=60)
    age: str | None = Field(default=None, max_length=60)
    health: str | None = Field(default=None, max_length=60)
    size: str | None = Field(default=None, max_length=60)
    gender: str | None = Field(default=None, max_length=60)
    care_advice: str | None = Field(default=None, max_length=1000)
    is_active: bool = True


class ProductAdminUpdate(ProductAdminCreate):
    pass


class ProductAdminOut(ProductOut):
    pass


class CategoryAdminIn(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    sort_order: int = Field(default=0, ge=0, le=9999)
    enabled: bool = True


class CategoryAdminOut(CategoryAdminIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class UserAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    nickname: str
    role: str
    enabled: bool
    created_at: datetime


class UserEnabledUpdate(BaseModel):
    enabled: bool


class PaymentAdminOut(PaymentOut):
    order_no: str
    username: str


class ActivityAdminCreate(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    subtitle: str = Field(min_length=2, max_length=160)
    registration_start_at: datetime
    registration_end_at: datetime
    draw_at: datetime
    prizes: list[dict] = Field(min_length=1)
    rules: list[str] = Field(min_length=1)


class ActivityAdminOut(BaseModel):
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
    winners: list[dict]


class ShipmentUpdate(BaseModel):
    shipping_company: str = Field(min_length=2, max_length=60)
    tracking_no: str = Field(min_length=4, max_length=80)


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    operator: str
    action: str
    resource_type: str
    resource_id: str
    detail: str
    created_at: datetime

import json
from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.api.v1.admin import router as admin_router
from app.db.session import Base, SessionLocal, engine, get_db
from app.models.entities import LotteryActivity, LotteryParticipant, Order, Product, User
from app.schemas.api import (
    JoinOut,
    LotteryActivityOut,
    LotteryResultOut,
    OrderCreate,
    OrderOut,
    ProductOut,
    ProfileOut,
)
from app.services.seed import seed_database

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(admin_router, prefix="/api/v1/admin")


def product_to_out(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        category=product.category,
        subtitle=product.subtitle,
        price=product.price,
        original_price=product.original_price,
        sales=product.sales,
        stock=product.stock,
        image_key=product.image_key,
        badge=product.badge,
        tags=[tag for tag in product.tags.split(",") if tag],
        species=product.species,
        age=product.age,
        health=product.health,
        size=product.size,
        gender=product.gender,
        care_advice=product.care_advice,
        is_active=product.is_active,
    )


def activity_to_out(activity: LotteryActivity, joined: bool) -> LotteryActivityOut:
    return LotteryActivityOut(
        id=activity.id,
        title=activity.title,
        subtitle=activity.subtitle,
        registration_start_at=activity.registration_start_at,
        registration_end_at=activity.registration_end_at,
        draw_at=activity.draw_at,
        status=activity.status,
        participant_count=activity.participant_count,
        prizes=json.loads(activity.prizes_json),
        rules=json.loads(activity.rules_json),
        joined=joined,
    )


@app.get("/health")
@app.get("/api/v1/health")
def health() -> dict:
    return {"status": "ok", "environment": settings.app_env, "database": "connected"}


@app.get("/api/v1/products", response_model=list[ProductOut])
def list_products(
    category: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ProductOut]:
    statement = select(Product).where(Product.is_active.is_(True))
    if category and category != "全部":
        statement = statement.where(Product.category == category)
    if keyword:
        statement = statement.where(Product.name.contains(keyword))
    products = db.scalars(statement.order_by(Product.id)).all()
    return [product_to_out(product) for product in products]


@app.get("/api/v1/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)) -> ProductOut:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(
            status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "商品不存在"}
        )
    return product_to_out(product)


@app.get("/api/v1/lottery/activities/current", response_model=LotteryActivityOut)
def current_activity(db: Session = Depends(get_db)) -> LotteryActivityOut:
    activity = db.scalar(select(LotteryActivity).where(LotteryActivity.id == 1))
    joined = (
        db.scalar(
            select(LotteryParticipant.id).where(
                LotteryParticipant.activity_id == 1,
                LotteryParticipant.user_id == 1,
            )
        )
        is not None
    )
    return activity_to_out(activity, joined)


@app.get("/api/v1/lottery/activities/{activity_id}", response_model=LotteryActivityOut)
def get_activity(activity_id: int, db: Session = Depends(get_db)) -> LotteryActivityOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=404, detail={"code": "ACTIVITY_NOT_FOUND", "message": "活动不存在"}
        )
    joined = (
        db.scalar(
            select(LotteryParticipant.id).where(
                LotteryParticipant.activity_id == activity_id,
                LotteryParticipant.user_id == 1,
            )
        )
        is not None
    )
    return activity_to_out(activity, joined)


@app.post("/api/v1/lottery/activities/{activity_id}/join", response_model=JoinOut)
def join_activity(activity_id: int, db: Session = Depends(get_db)) -> JoinOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=404, detail={"code": "ACTIVITY_NOT_FOUND", "message": "活动不存在"}
        )
    if activity.status != "REGISTERING" or datetime.now() > activity.registration_end_at:
        raise HTTPException(
            status_code=409,
            detail={"code": "ACTIVITY_REGISTRATION_CLOSED", "message": "报名已结束"},
        )
    db.add(LotteryParticipant(activity_id=activity_id, user_id=1))
    try:
        activity.participant_count += 1
        db.commit()
        return JoinOut(
            joined=True,
            already_joined=False,
            participant_count=activity.participant_count,
            message="报名成功",
        )
    except IntegrityError:
        db.rollback()
        return JoinOut(
            joined=True,
            already_joined=True,
            participant_count=activity.participant_count,
            message="您已报名",
        )


@app.get("/api/v1/lottery/activities/{activity_id}/result", response_model=LotteryResultOut)
def lottery_result(activity_id: int, db: Session = Depends(get_db)) -> LotteryResultOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=404, detail={"code": "ACTIVITY_NOT_FOUND", "message": "活动不存在"}
        )
    winners = json.loads(activity.winners_json)
    return LotteryResultOut(
        activity_id=activity.id,
        title=activity.title,
        status=activity.status,
        draw_at=activity.draw_at,
        participant_count=activity.participant_count,
        my_result={"won": False, "message": "感谢参与，下次好运", "points": 10},
        winners=winners,
        prizes=json.loads(activity.prizes_json),
    )


@app.post("/api/v1/orders", response_model=OrderOut)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)) -> Order:
    product = db.get(Product, payload.product_id)
    if product is None or product.stock < payload.quantity:
        raise HTTPException(
            status_code=409, detail={"code": "PRODUCT_UNAVAILABLE", "message": "商品库存不足"}
        )
    subtotal = product.price * payload.quantity
    discount = min(Decimal("30"), subtotal) if payload.use_coupon else Decimal("0")
    total = max(Decimal("0.01"), subtotal - discount)
    order = Order(
        order_no=f"PL{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:6].upper()}",
        user_id=1,
        product_id=product.id,
        product_name=product.name,
        unit_price=product.price,
        quantity=payload.quantity,
        discount=discount,
        shipping_fee=Decimal("0"),
        total_amount=total,
        address_name=payload.address_name,
        address_phone=payload.address_phone,
        address_detail=payload.address_detail,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@app.post("/api/v1/payments/local/{order_id}", response_model=OrderOut)
def local_pay(order_id: int, db: Session = Depends(get_db)) -> Order:
    if not settings.local_payment_enabled or settings.app_env != "development":
        raise HTTPException(
            status_code=403, detail={"code": "LOCAL_PAYMENT_DISABLED", "message": "本地支付已关闭"}
        )
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(
            status_code=404, detail={"code": "ORDER_NOT_FOUND", "message": "订单不存在"}
        )
    if order.status == "PENDING_PAYMENT":
        order.status = "PAID"
        order.paid_at = datetime.now()
        db.commit()
        db.refresh(order)
    return order


@app.get("/api/v1/orders", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)) -> list[Order]:
    return list(db.scalars(select(Order).where(Order.user_id == 1).order_by(Order.id.desc())).all())


@app.get("/api/v1/me", response_model=ProfileOut)
def profile(db: Session = Depends(get_db)) -> ProfileOut:
    user = db.get(User, 1)
    orders = db.scalars(select(Order).where(Order.user_id == 1)).all()
    counts = {"pending": 0, "shipping": 0, "receiving": 0, "completed": 0, "refund": 0}
    for order in orders:
        if order.status == "PENDING_PAYMENT":
            counts["pending"] += 1
        elif order.status == "PAID":
            counts["shipping"] += 1
    return ProfileOut(
        nickname=user.nickname,
        level=user.level,
        points=user.points,
        coupons=user.coupons,
        favorites=user.favorites,
        pets=[
            {
                "name": "巴西龟（小龟）",
                "age": "3岁2个月",
                "health": "健康活泼",
                "imageKey": "turtle",
            },
            {
                "name": "垂耳兔（软糖）",
                "age": "2个月15天",
                "health": "活泼好动",
                "imageKey": "rabbit",
            },
        ],
        reminders=[
            {"pet": "巴西龟（小龟）", "task": "换水提醒", "time": "今天"},
            {"pet": "垂耳兔（软糖）", "task": "牧草喂食", "time": "明天 09:00"},
        ],
        order_counts=counts,
    )

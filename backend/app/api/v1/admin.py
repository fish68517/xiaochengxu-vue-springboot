import json
from datetime import datetime
from decimal import Decimal
from secrets import SystemRandom, compare_digest

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import require_admin
from app.db.session import get_db
from app.models.entities import (
    AuditLog,
    LotteryActivity,
    LotteryParticipant,
    Order,
    Product,
    User,
)
from app.schemas.admin import (
    ActivityAdminCreate,
    ActivityAdminOut,
    AdminLoginIn,
    AdminLoginOut,
    AuditLogOut,
    DashboardOut,
    ProductAdminCreate,
    ProductAdminOut,
    ProductAdminUpdate,
    ShipmentUpdate,
)
from app.schemas.api import OrderOut

router = APIRouter(tags=["管理后台"])
settings = get_settings()


def write_audit(
    db: Session,
    operator: str,
    action: str,
    resource_type: str,
    resource_id: int | str,
    detail: str,
) -> None:
    db.add(
        AuditLog(
            operator=operator,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            detail=detail,
        )
    )


def product_out(product: Product) -> ProductAdminOut:
    return ProductAdminOut(
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
        tags=[item for item in product.tags.split(",") if item],
        species=product.species,
        age=product.age,
        health=product.health,
        size=product.size,
        gender=product.gender,
        care_advice=product.care_advice,
        is_active=product.is_active,
    )


def activity_out(activity: LotteryActivity) -> ActivityAdminOut:
    return ActivityAdminOut(
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
        winners=json.loads(activity.winners_json),
    )


@router.post("/auth/login", response_model=AdminLoginOut)
def login(payload: AdminLoginIn) -> AdminLoginOut:
    valid_username = compare_digest(payload.username, settings.admin_username)
    valid_password = compare_digest(payload.password, settings.admin_password)
    if not valid_username or not valid_password:
        raise HTTPException(
            status_code=401,
            detail={"code": "ADMIN_LOGIN_FAILED", "message": "账号或密码错误"},
        )
    return AdminLoginOut(
        token=settings.admin_token,
        username=settings.admin_username,
        environment=settings.app_env,
    )


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DashboardOut:
    recent_orders = list(db.scalars(select(Order).order_by(Order.id.desc()).limit(5)).all())
    paid_amount = db.scalar(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(
            Order.status != "PENDING_PAYMENT"
        )
    )
    return DashboardOut(
        product_count=db.scalar(select(func.count(Product.id))) or 0,
        active_product_count=db.scalar(
            select(func.count(Product.id)).where(Product.is_active.is_(True))
        )
        or 0,
        activity_count=db.scalar(select(func.count(LotteryActivity.id))) or 0,
        registering_activity_count=db.scalar(
            select(func.count(LotteryActivity.id)).where(LotteryActivity.status == "REGISTERING")
        )
        or 0,
        participant_count=db.scalar(select(func.count(LotteryParticipant.id))) or 0,
        order_count=db.scalar(select(func.count(Order.id))) or 0,
        paid_order_count=db.scalar(
            select(func.count(Order.id)).where(Order.status != "PENDING_PAYMENT")
        )
        or 0,
        paid_amount=Decimal(paid_amount),
        recent_orders=recent_orders,
    )


@router.get("/products", response_model=list[ProductAdminOut])
def list_products(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ProductAdminOut]:
    products = db.scalars(select(Product).order_by(Product.id.desc())).all()
    return [product_out(product) for product in products]


@router.post("/products", response_model=ProductAdminOut)
def create_product(
    payload: ProductAdminCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProductAdminOut:
    product = Product(
        **payload.model_dump(exclude={"tags"}),
        tags=",".join(payload.tags),
        sales=0,
    )
    db.add(product)
    db.flush()
    write_audit(db, operator, "CREATE", "PRODUCT", product.id, product.name)
    db.commit()
    db.refresh(product)
    return product_out(product)


@router.put("/products/{product_id}", response_model=ProductAdminOut)
def update_product(
    product_id: int,
    payload: ProductAdminUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProductAdminOut:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(
            status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "商品不存在"}
        )
    values = payload.model_dump(exclude={"tags"})
    for key, value in values.items():
        setattr(product, key, value)
    product.tags = ",".join(payload.tags)
    write_audit(db, operator, "UPDATE", "PRODUCT", product.id, product.name)
    db.commit()
    db.refresh(product)
    return product_out(product)


@router.delete("/products/{product_id}", response_model=ProductAdminOut)
def delete_product(
    product_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProductAdminOut:
    """Soft-delete a product so existing order references remain valid."""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "商品不存在"},
        )
    product.is_active = False
    write_audit(db, operator, "DELETE", "PRODUCT", product.id, product.name)
    db.commit()
    db.refresh(product)
    return product_out(product)


@router.get("/lottery/activities", response_model=list[ActivityAdminOut])
def list_activities(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ActivityAdminOut]:
    activities = db.scalars(select(LotteryActivity).order_by(LotteryActivity.id.desc())).all()
    return [activity_out(activity) for activity in activities]


@router.post("/lottery/activities", response_model=ActivityAdminOut)
def create_activity(
    payload: ActivityAdminCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ActivityAdminOut:
    if not (payload.registration_start_at < payload.registration_end_at < payload.draw_at):
        raise HTTPException(
            status_code=422,
            detail={"code": "ACTIVITY_TIME_INVALID", "message": "报名和开奖时间顺序不正确"},
        )
    activity = LotteryActivity(
        title=payload.title,
        subtitle=payload.subtitle,
        registration_start_at=payload.registration_start_at,
        registration_end_at=payload.registration_end_at,
        draw_at=payload.draw_at,
        status="DRAFT",
        participant_count=0,
        prizes_json=json.dumps(payload.prizes, ensure_ascii=False),
        rules_json=json.dumps(payload.rules, ensure_ascii=False),
        winners_json="[]",
    )
    db.add(activity)
    db.flush()
    write_audit(db, operator, "CREATE", "LOTTERY_ACTIVITY", activity.id, activity.title)
    db.commit()
    db.refresh(activity)
    return activity_out(activity)


@router.put("/lottery/activities/{activity_id}", response_model=ActivityAdminOut)
def update_activity(
    activity_id: int,
    payload: ActivityAdminCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ActivityAdminOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=404, detail={"code": "ACTIVITY_NOT_FOUND", "message": "活动不存在"}
        )
    if activity.status in {"DRAWING", "DRAWN", "CLOSED"}:
        raise HTTPException(
            status_code=409, detail={"code": "ACTIVITY_LOCKED", "message": "已开奖活动不可修改"}
        )
    for key in (
        "title",
        "subtitle",
        "registration_start_at",
        "registration_end_at",
        "draw_at",
    ):
        setattr(activity, key, getattr(payload, key))
    activity.prizes_json = json.dumps(payload.prizes, ensure_ascii=False)
    activity.rules_json = json.dumps(payload.rules, ensure_ascii=False)
    write_audit(db, operator, "UPDATE", "LOTTERY_ACTIVITY", activity.id, activity.title)
    db.commit()
    db.refresh(activity)
    return activity_out(activity)


@router.post("/lottery/activities/{activity_id}/publish", response_model=ActivityAdminOut)
def publish_activity(
    activity_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ActivityAdminOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=404, detail={"code": "ACTIVITY_NOT_FOUND", "message": "活动不存在"}
        )
    if activity.status not in {"DRAFT", "PUBLISHED"}:
        raise HTTPException(
            status_code=409,
            detail={"code": "ACTIVITY_STATUS_INVALID", "message": "当前状态不可发布"},
        )
    now = datetime.now()
    activity.status = "REGISTERING" if activity.registration_start_at <= now else "PUBLISHED"
    write_audit(db, operator, "PUBLISH", "LOTTERY_ACTIVITY", activity.id, activity.title)
    db.commit()
    db.refresh(activity)
    return activity_out(activity)


@router.get("/lottery/activities/{activity_id}/participants")
def list_participants(
    activity_id: int,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = db.execute(
        select(LotteryParticipant, User)
        .join(User, User.id == LotteryParticipant.user_id)
        .where(LotteryParticipant.activity_id == activity_id)
        .order_by(LotteryParticipant.id)
    ).all()
    return [
        {
            "id": participant.id,
            "user_id": user.id,
            "nickname": user.nickname,
            "joined_at": participant.joined_at,
        }
        for participant, user in rows
    ]


@router.post("/lottery/activities/{activity_id}/draw", response_model=ActivityAdminOut)
def draw_activity(
    activity_id: int,
    force: bool = Query(default=False),
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ActivityAdminOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=404, detail={"code": "ACTIVITY_NOT_FOUND", "message": "活动不存在"}
        )
    if activity.status == "DRAWN":
        return activity_out(activity)
    if not force and datetime.now() < activity.draw_at:
        raise HTTPException(
            status_code=409, detail={"code": "DRAW_TIME_NOT_REACHED", "message": "尚未到开奖时间"}
        )
    participants = list(
        db.scalars(
            select(LotteryParticipant)
            .where(LotteryParticipant.activity_id == activity_id)
            .order_by(LotteryParticipant.id)
        ).all()
    )
    if not participants:
        raise HTTPException(
            status_code=409, detail={"code": "NO_PARTICIPANTS", "message": "当前活动没有报名用户"}
        )
    activity.status = "DRAWING"
    prizes = json.loads(activity.prizes_json)
    remaining = participants.copy()
    randomizer = SystemRandom()
    winners: list[dict] = []
    for prize in prizes:
        if not remaining:
            break
        count = min(int(prize.get("quantity", 0)), len(remaining))
        selected = randomizer.sample(remaining, count)
        for participant in selected:
            user = db.get(User, participant.user_id)
            winners.append(
                {
                    "nickname": user.nickname,
                    "level": prize.get("level", "奖项"),
                    "prize": prize.get("name", "奖品"),
                    "user_id": user.id,
                }
            )
            remaining.remove(participant)
    activity.winners_json = json.dumps(winners, ensure_ascii=False)
    activity.status = "DRAWN"
    write_audit(db, operator, "DRAW", "LOTTERY_ACTIVITY", activity.id, f"winners={len(winners)}")
    db.commit()
    db.refresh(activity)
    return activity_out(activity)


@router.get("/orders", response_model=list[OrderOut])
def list_orders(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[Order]:
    return list(db.scalars(select(Order).order_by(Order.id.desc())).all())


@router.put("/orders/{order_id}/shipment", response_model=OrderOut)
def ship_order(
    order_id: int,
    payload: ShipmentUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(
            status_code=404, detail={"code": "ORDER_NOT_FOUND", "message": "订单不存在"}
        )
    if order.status not in {"PAID", "SHIPPED"}:
        raise HTTPException(
            status_code=409, detail={"code": "ORDER_NOT_PAID", "message": "只有已支付订单可以发货"}
        )
    order.shipping_company = payload.shipping_company
    order.tracking_no = payload.tracking_no
    order.shipped_at = datetime.now()
    order.status = "SHIPPED"
    write_audit(
        db, operator, "SHIP", "ORDER", order.id, f"{payload.shipping_company}:{payload.tracking_no}"
    )
    db.commit()
    db.refresh(order)
    return order


@router.get("/audit-logs", response_model=list[AuditLogOut])
def audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AuditLog]:
    return list(db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)).all())

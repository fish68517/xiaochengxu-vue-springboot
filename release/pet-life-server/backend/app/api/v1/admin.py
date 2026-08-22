import json
from datetime import datetime
from decimal import Decimal
from secrets import SystemRandom

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, require_admin, verify_password
from app.db.session import get_db
from app.models.entities import (
    AuditLog,
    LotteryActivity,
    LotteryParticipant,
    LotteryPrize,
    LotteryWinner,
    Order,
    OrderItem,
    Payment,
    Product,
    ProductCategory,
    User,
)
from app.schemas.admin import (
    ActivityAdminCreate,
    ActivityAdminOut,
    AdminLoginIn,
    AdminLoginOut,
    AuditLogOut,
    CategoryAdminIn,
    CategoryAdminOut,
    DashboardOut,
    PaymentAdminOut,
    ProductAdminCreate,
    ProductAdminOut,
    ProductAdminUpdate,
    ShipmentUpdate,
    UserAdminOut,
    UserEnabledUpdate,
)
from app.schemas.api import OrderOut, PaymentOut
from app.services.serializers import activity_prizes, order_out, product_out

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


def activity_admin_out(db: Session, activity: LotteryActivity) -> ActivityAdminOut:
    participant_count = (
        db.scalar(
            select(func.count(LotteryParticipant.id)).where(
                LotteryParticipant.activity_id == activity.id
            )
        )
        or 0
    )
    winner_rows = db.execute(
        select(LotteryWinner, User, LotteryPrize)
        .join(User, User.id == LotteryWinner.user_id)
        .join(LotteryPrize, LotteryPrize.id == LotteryWinner.prize_id)
        .where(LotteryWinner.activity_id == activity.id)
        .order_by(LotteryPrize.sort_order, LotteryWinner.id)
    ).all()
    return ActivityAdminOut(
        id=activity.id,
        title=activity.title,
        subtitle=activity.subtitle,
        registration_start_at=activity.registration_start_at,
        registration_end_at=activity.registration_end_at,
        draw_at=activity.draw_at,
        status=activity.status,
        participant_count=participant_count,
        prizes=activity_prizes(db, activity.id),
        rules=json.loads(activity.rules_json or "[]"),
        winners=[
            {
                "nickname": user.nickname,
                "level": prize.level_name,
                "prize": prize.prize_name,
                "user_id": user.id,
            }
            for _, user, prize in winner_rows
        ],
    )


def replace_prizes(db: Session, activity: LotteryActivity, prizes: list[dict]) -> None:
    db.execute(delete(LotteryPrize).where(LotteryPrize.activity_id == activity.id))
    for sort_order, prize in enumerate(prizes, start=1):
        db.add(
            LotteryPrize(
                activity_id=activity.id,
                level_name=str(prize.get("level", "奖项"))[:40],
                prize_name=str(prize.get("name", "奖品"))[:100],
                quantity=max(0, int(prize.get("quantity", 0))),
                sort_order=sort_order,
            )
        )
    activity.prizes_json = json.dumps(prizes, ensure_ascii=False)


@router.post("/auth/login", response_model=AdminLoginOut)
def login(payload: AdminLoginIn, db: Session = Depends(get_db)) -> AdminLoginOut:
    user = db.scalar(select(User).where(User.username == payload.username))
    if (
        user is None
        or user.role != "ADMIN"
        or not user.enabled
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail={"message": "管理员账号或密码错误"})
    return AdminLoginOut(
        token=create_access_token(user),
        username=user.username,
        environment=settings.app_env,
    )


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DashboardOut:
    recent_orders = list(db.scalars(select(Order).order_by(Order.id.desc()).limit(5)).all())
    paid_amount = db.scalar(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(Order.payment_status == "PAID")
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
            select(func.count(Order.id)).where(Order.payment_status == "PAID")
        )
        or 0,
        paid_amount=Decimal(paid_amount),
        recent_orders=[order_out(db, order) for order in recent_orders],
    )


@router.get("/categories", response_model=list[CategoryAdminOut])
def list_categories(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ProductCategory]:
    return list(
        db.scalars(
            select(ProductCategory).order_by(ProductCategory.sort_order, ProductCategory.id)
        ).all()
    )


@router.post("/categories", response_model=CategoryAdminOut)
def create_category(
    payload: CategoryAdminIn,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProductCategory:
    if db.scalar(select(ProductCategory.id).where(ProductCategory.name == payload.name)):
        raise HTTPException(status_code=409, detail={"message": "分类名称已存在"})
    category = ProductCategory(**payload.model_dump())
    db.add(category)
    db.flush()
    write_audit(db, operator, "CREATE", "CATEGORY", category.id, category.name)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryAdminOut)
def update_category(
    category_id: int,
    payload: CategoryAdminIn,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProductCategory:
    category = db.get(ProductCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail={"message": "分类不存在"})
    old_name = category.name
    for key, value in payload.model_dump().items():
        setattr(category, key, value)
    db.execute(
        update(Product).where(Product.category_id == category.id).values(category=category.name)
    )
    write_audit(db, operator, "UPDATE", "CATEGORY", category.id, f"{old_name}->{category.name}")
    db.commit()
    db.refresh(category)
    return category


@router.get("/products", response_model=list[ProductAdminOut])
def list_products(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ProductAdminOut]:
    return [
        product_out(product) for product in db.scalars(select(Product).order_by(Product.id.desc()))
    ]


def product_values(db: Session, payload: ProductAdminCreate) -> dict:
    values = payload.model_dump(exclude={"tags", "detail_images"})
    category = None
    if payload.category_id is not None:
        category = db.get(ProductCategory, payload.category_id)
    if category is None:
        category = db.scalar(
            select(ProductCategory).where(ProductCategory.name == payload.category)
        )
    if category is None or not category.enabled:
        raise HTTPException(status_code=422, detail={"message": "请选择有效商品分类"})
    values["category_id"] = category.id
    values["category"] = category.name
    values["tags"] = ",".join(payload.tags)
    values["detail_images_json"] = json.dumps(payload.detail_images, ensure_ascii=False)
    return values


@router.post("/products", response_model=ProductAdminOut)
def create_product(
    payload: ProductAdminCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProductAdminOut:
    product = Product(**product_values(db, payload), sales=0)
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
        raise HTTPException(status_code=404, detail={"message": "商品不存在"})
    for key, value in product_values(db, payload).items():
        setattr(product, key, value)
    product.version += 1
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
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail={"message": "商品不存在"})
    product.is_active = False
    product.version += 1
    write_audit(db, operator, "DELETE", "PRODUCT", product.id, product.name)
    db.commit()
    db.refresh(product)
    return product_out(product)


@router.get("/users", response_model=list[UserAdminOut])
def list_users(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id.desc())).all())


@router.put("/users/{user_id}/enabled", response_model=UserAdminOut)
def set_user_enabled(
    user_id: int,
    payload: UserEnabledUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail={"message": "用户不存在"})
    if user.username == operator and not payload.enabled:
        raise HTTPException(status_code=409, detail={"message": "不能停用当前管理员"})
    user.enabled = payload.enabled
    write_audit(
        db, operator, "ENABLE" if payload.enabled else "DISABLE", "USER", user.id, user.username
    )
    db.commit()
    db.refresh(user)
    return user


@router.get("/lottery/activities", response_model=list[ActivityAdminOut])
def list_activities(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ActivityAdminOut]:
    activities = db.scalars(select(LotteryActivity).order_by(LotteryActivity.id.desc())).all()
    return [activity_admin_out(db, activity) for activity in activities]


def validate_activity_time(payload: ActivityAdminCreate) -> None:
    if not payload.registration_start_at < payload.registration_end_at < payload.draw_at:
        raise HTTPException(status_code=422, detail={"message": "报名和开奖时间顺序不正确"})


@router.post("/lottery/activities", response_model=ActivityAdminOut)
def create_activity(
    payload: ActivityAdminCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ActivityAdminOut:
    validate_activity_time(payload)
    activity = LotteryActivity(
        title=payload.title,
        subtitle=payload.subtitle,
        registration_start_at=payload.registration_start_at,
        registration_end_at=payload.registration_end_at,
        draw_at=payload.draw_at,
        status="DRAFT",
        participant_count=0,
        prizes_json="[]",
        rules_json=json.dumps(payload.rules, ensure_ascii=False),
        winners_json="[]",
    )
    db.add(activity)
    db.flush()
    replace_prizes(db, activity, payload.prizes)
    write_audit(db, operator, "CREATE", "LOTTERY_ACTIVITY", activity.id, activity.title)
    db.commit()
    db.refresh(activity)
    return activity_admin_out(db, activity)


@router.put("/lottery/activities/{activity_id}", response_model=ActivityAdminOut)
def update_activity(
    activity_id: int,
    payload: ActivityAdminCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ActivityAdminOut:
    validate_activity_time(payload)
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail={"message": "活动不存在"})
    if activity.status in {"DRAWING", "DRAWN", "CLOSED"}:
        raise HTTPException(status_code=409, detail={"message": "已开奖或关闭活动不可修改"})
    for key in ("title", "subtitle", "registration_start_at", "registration_end_at", "draw_at"):
        setattr(activity, key, getattr(payload, key))
    activity.rules_json = json.dumps(payload.rules, ensure_ascii=False)
    replace_prizes(db, activity, payload.prizes)
    write_audit(db, operator, "UPDATE", "LOTTERY_ACTIVITY", activity.id, activity.title)
    db.commit()
    db.refresh(activity)
    return activity_admin_out(db, activity)


@router.post("/lottery/activities/{activity_id}/publish", response_model=ActivityAdminOut)
def publish_activity(
    activity_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ActivityAdminOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail={"message": "活动不存在"})
    if activity.status not in {"DRAFT", "PUBLISHED"}:
        raise HTTPException(status_code=409, detail={"message": "当前状态不可发布"})
    activity.status = (
        "REGISTERING" if activity.registration_start_at <= datetime.now() else "PUBLISHED"
    )
    write_audit(db, operator, "PUBLISH", "LOTTERY_ACTIVITY", activity.id, activity.title)
    db.commit()
    db.refresh(activity)
    return activity_admin_out(db, activity)


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
    activity = db.scalar(
        select(LotteryActivity).where(LotteryActivity.id == activity_id).with_for_update()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail={"message": "活动不存在"})
    if activity.status == "DRAWN":
        return activity_admin_out(db, activity)
    if not force and datetime.now() < activity.draw_at:
        raise HTTPException(status_code=409, detail={"message": "尚未到开奖时间"})
    participants = list(
        db.scalars(
            select(LotteryParticipant)
            .where(LotteryParticipant.activity_id == activity_id)
            .order_by(LotteryParticipant.id)
        ).all()
    )
    if not participants:
        raise HTTPException(status_code=409, detail={"message": "当前活动没有报名用户"})
    prizes = list(
        db.scalars(
            select(LotteryPrize)
            .where(LotteryPrize.activity_id == activity_id)
            .order_by(LotteryPrize.sort_order, LotteryPrize.id)
        ).all()
    )
    remaining = participants.copy()
    randomizer = SystemRandom()
    winner_count = 0
    for prize in prizes:
        if not remaining:
            break
        selected = randomizer.sample(remaining, min(prize.quantity, len(remaining)))
        for participant in selected:
            db.add(
                LotteryWinner(
                    activity_id=activity.id,
                    participant_id=participant.id,
                    user_id=participant.user_id,
                    prize_id=prize.id,
                )
            )
            remaining.remove(participant)
            winner_count += 1
    activity.status = "DRAWN"
    activity.participant_count = len(participants)
    activity.winners_json = "[]"
    write_audit(db, operator, "DRAW", "LOTTERY_ACTIVITY", activity.id, f"winners={winner_count}")
    db.commit()
    db.refresh(activity)
    return activity_admin_out(db, activity)


@router.get("/orders", response_model=list[OrderOut])
def list_orders(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[OrderOut]:
    return [
        order_out(db, order) for order in db.scalars(select(Order).order_by(Order.id.desc())).all()
    ]


@router.put("/orders/{order_id}/shipment", response_model=OrderOut)
def ship_order(
    order_id: int,
    payload: ShipmentUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail={"message": "订单不存在"})
    if order.status not in {"PAID", "SHIPPED"}:
        raise HTTPException(status_code=409, detail={"message": "只有已支付订单可以发货"})
    order.shipping_company = payload.shipping_company
    order.tracking_no = payload.tracking_no
    order.shipped_at = datetime.now()
    order.status = "SHIPPED"
    write_audit(
        db,
        operator,
        "SHIP",
        "ORDER",
        order.id,
        f"{payload.shipping_company}:{payload.tracking_no}",
    )
    db.commit()
    db.refresh(order)
    return order_out(db, order)


def payment_admin_out(db: Session, payment: Payment) -> PaymentAdminOut:
    order = db.get(Order, payment.order_id)
    user = db.get(User, order.user_id) if order else None
    return PaymentAdminOut(
        **PaymentOut.model_validate(payment).model_dump(),
        order_no=order.order_no if order else "-",
        username=user.username if user else "-",
    )


@router.get("/payments", response_model=list[PaymentAdminOut])
def list_payments(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[PaymentAdminOut]:
    payments = db.scalars(select(Payment).order_by(Payment.id.desc())).all()
    return [payment_admin_out(db, payment) for payment in payments]


@router.put("/payments/{payment_id}/confirm", response_model=PaymentAdminOut)
def confirm_payment(
    payment_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PaymentAdminOut:
    payment = db.scalar(select(Payment).where(Payment.id == payment_id).with_for_update())
    if payment is None:
        raise HTTPException(status_code=404, detail={"message": "付款记录不存在"})
    if payment.status == "SUCCESS":
        return payment_admin_out(db, payment)
    if payment.status != "PENDING":
        raise HTTPException(status_code=409, detail={"message": "当前付款状态不可确认"})
    order = db.scalar(select(Order).where(Order.id == payment.order_id).with_for_update())
    if order is None or order.status != "PENDING_PAYMENT" or payment.amount != order.total_amount:
        raise HTTPException(status_code=409, detail={"message": "订单状态或付款金额不一致"})
    admin = db.scalar(select(User).where(User.username == operator))
    payment.status = "SUCCESS"
    payment.confirmed_by = admin.id if admin else None
    payment.confirmed_at = datetime.now()
    order.status = "PAID"
    order.payment_status = "PAID"
    order.paid_at = datetime.now()
    for item in db.scalars(select(OrderItem).where(OrderItem.order_id == order.id)).all():
        product = db.get(Product, item.product_id)
        if product is not None:
            product.sales += item.quantity
    write_audit(db, operator, "CONFIRM", "PAYMENT", payment.id, payment.payment_no)
    db.commit()
    db.refresh(payment)
    return payment_admin_out(db, payment)


@router.put("/payments/{payment_id}/fail", response_model=PaymentAdminOut)
def fail_payment(
    payment_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PaymentAdminOut:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail={"message": "付款记录不存在"})
    if payment.status == "PENDING":
        payment.status = "FAILED"
        write_audit(db, operator, "FAIL", "PAYMENT", payment.id, payment.payment_no)
        db.commit()
        db.refresh(payment)
    return payment_admin_out(db, payment)


@router.get("/audit-logs", response_model=list[AuditLogOut])
def audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AuditLog]:
    return list(db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)).all())

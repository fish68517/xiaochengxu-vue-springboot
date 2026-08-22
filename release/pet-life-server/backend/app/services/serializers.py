import json
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    Address,
    LotteryActivity,
    LotteryParticipant,
    LotteryPrize,
    Order,
    OrderItem,
    Product,
)
from app.schemas.api import (
    AddressOut,
    LotteryActivityOut,
    OrderItemOut,
    OrderOut,
    ProductOut,
)


def _json_list(value: str | None) -> list:
    try:
        result = json.loads(value or "[]")
        return result if isinstance(result, list) else []
    except json.JSONDecodeError:
        return []


def product_out(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        category_id=product.category_id,
        name=product.name,
        category=product.category,
        subtitle=product.subtitle,
        price=product.price,
        original_price=product.original_price,
        sales=product.sales,
        stock=product.stock,
        image_key=product.image_key,
        cover_url=product.cover_url,
        detail_images=_json_list(product.detail_images_json),
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


def address_out(address: Address) -> AddressOut:
    return AddressOut.model_validate(address)


def order_out(db: Session, order: Order) -> OrderOut:
    items = list(
        db.scalars(
            select(OrderItem).where(OrderItem.order_id == order.id).order_by(OrderItem.id)
        ).all()
    )
    return OrderOut(
        id=order.id,
        order_no=order.order_no,
        user_id=order.user_id,
        product_id=order.product_id,
        product_name=order.product_name,
        unit_price=order.unit_price,
        quantity=order.quantity,
        discount=order.discount,
        shipping_fee=order.shipping_fee,
        total_amount=order.total_amount,
        status=order.status,
        payment_status=order.payment_status,
        address_name=order.address_name,
        address_phone=order.address_phone,
        address_detail=order.address_detail,
        remark=order.remark,
        created_at=order.created_at,
        paid_at=order.paid_at,
        shipping_company=order.shipping_company,
        tracking_no=order.tracking_no,
        shipped_at=order.shipped_at,
        items=[OrderItemOut.model_validate(item) for item in items],
    )


def activity_prizes(db: Session, activity_id: int) -> list[dict]:
    prizes = list(
        db.scalars(
            select(LotteryPrize)
            .where(LotteryPrize.activity_id == activity_id)
            .order_by(LotteryPrize.sort_order, LotteryPrize.id)
        ).all()
    )
    return [
        {
            "id": prize.id,
            "level": prize.level_name,
            "name": prize.prize_name,
            "quantity": prize.quantity,
            "icon": "gift" if prize.sort_order == 1 else "coupon",
        }
        for prize in prizes
    ]


def activity_out(
    db: Session,
    activity: LotteryActivity,
    user_id: int | None,
) -> LotteryActivityOut:
    participant_count = (
        db.scalar(
            select(func.count(LotteryParticipant.id)).where(
                LotteryParticipant.activity_id == activity.id
            )
        )
        or 0
    )
    joined = False
    if user_id is not None:
        joined = (
            db.scalar(
                select(LotteryParticipant.id).where(
                    LotteryParticipant.activity_id == activity.id,
                    LotteryParticipant.user_id == user_id,
                )
            )
            is not None
        )
    return LotteryActivityOut(
        id=activity.id,
        title=activity.title,
        subtitle=activity.subtitle,
        registration_start_at=activity.registration_start_at,
        registration_end_at=activity.registration_end_at,
        draw_at=activity.draw_at,
        status=activity.status,
        participant_count=participant_count,
        prizes=activity_prizes(db, activity.id),
        rules=_json_list(activity.rules_json),
        joined=joined,
    )


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))

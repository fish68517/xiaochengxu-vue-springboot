from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.entities import (
    Address,
    CartItem,
    Coupon,
    InventoryRecord,
    Order,
    OrderItem,
    Payment,
    Product,
    User,
    UserCoupon,
)
from app.schemas.api import (
    CouponOut,
    OrderOut,
    OrderPreviewItemOut,
    OrderPreviewOut,
    OrderSelectionIn,
    PaymentOut,
)
from app.services.serializers import address_out, money, order_out

router = APIRouter(tags=["订单与付款"])


def _load_selection(
    db: Session,
    payload: OrderSelectionIn,
    user_id: int,
    *,
    lock: bool,
) -> tuple[list[tuple[CartItem, Product]], Address, UserCoupon | None, Decimal, Decimal]:
    address = db.scalar(
        select(Address).where(Address.id == payload.address_id, Address.user_id == user_id)
    )
    if address is None:
        raise HTTPException(status_code=404, detail={"message": "收货地址不存在"})

    item_ids = list(dict.fromkeys(payload.cart_item_ids))
    statement = (
        select(CartItem, Product)
        .join(Product, Product.id == CartItem.product_id)
        .where(CartItem.user_id == user_id, CartItem.id.in_(item_ids))
        .order_by(CartItem.id)
    )
    if lock:
        statement = statement.with_for_update()
    rows = list(db.execute(statement).all())
    if len(rows) != len(item_ids):
        raise HTTPException(status_code=404, detail={"message": "购物车商品不存在或不属于当前用户"})

    subtotal = Decimal("0")
    for item, product in rows:
        if not product.is_active:
            raise HTTPException(status_code=409, detail={"message": f"{product.name} 已下架"})
        if product.stock < item.quantity:
            raise HTTPException(status_code=409, detail={"message": f"{product.name} 库存不足"})
        subtotal += product.price * item.quantity

    user_coupon = None
    discount = Decimal("0")
    if payload.user_coupon_id is not None:
        user_coupon = db.scalar(
            select(UserCoupon).where(
                UserCoupon.id == payload.user_coupon_id,
                UserCoupon.user_id == user_id,
                UserCoupon.status == "AVAILABLE",
            )
        )
        if user_coupon is None:
            raise HTTPException(status_code=409, detail={"message": "优惠券不可用"})
        coupon = db.get(Coupon, user_coupon.coupon_id)
        now = datetime.now()
        if (
            coupon is None
            or not coupon.enabled
            or coupon.start_at > now
            or coupon.end_at < now
            or subtotal < coupon.threshold_amount
        ):
            raise HTTPException(status_code=409, detail={"message": "优惠券不满足使用条件"})
        discount = min(subtotal, coupon.discount_amount)
    return rows, address, user_coupon, money(subtotal), money(discount)


@router.get("/coupons/available", response_model=list[CouponOut])
def available_coupons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CouponOut]:
    now = datetime.now()
    rows = db.execute(
        select(UserCoupon, Coupon)
        .join(Coupon, Coupon.id == UserCoupon.coupon_id)
        .where(
            UserCoupon.user_id == current_user.id,
            UserCoupon.status == "AVAILABLE",
            Coupon.enabled.is_(True),
            Coupon.start_at <= now,
            Coupon.end_at >= now,
        )
        .order_by(Coupon.end_at)
    ).all()
    return [
        CouponOut(
            user_coupon_id=user_coupon.id,
            coupon_id=coupon.id,
            name=coupon.name,
            threshold_amount=coupon.threshold_amount,
            discount_amount=coupon.discount_amount,
            end_at=coupon.end_at,
            status=user_coupon.status,
        )
        for user_coupon, coupon in rows
    ]


@router.post("/orders/preview", response_model=OrderPreviewOut)
def preview_order(
    payload: OrderSelectionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderPreviewOut:
    rows, address, user_coupon, subtotal, discount = _load_selection(
        db, payload, current_user.id, lock=False
    )
    shipping_fee = Decimal("0.00")
    return OrderPreviewOut(
        items=[
            OrderPreviewItemOut(
                cart_item_id=item.id,
                product_id=product.id,
                product_name=product.name,
                image_key=product.image_key,
                cover_url=product.cover_url,
                unit_price=product.price,
                quantity=item.quantity,
                line_amount=money(product.price * item.quantity),
            )
            for item, product in rows
        ],
        address=address_out(address),
        subtotal=subtotal,
        discount=discount,
        shipping_fee=shipping_fee,
        total_amount=money(max(Decimal("0.01"), subtotal - discount + shipping_fee)),
        user_coupon_id=user_coupon.id if user_coupon else None,
    )


@router.post("/orders", response_model=OrderOut)
def create_order(
    payload: OrderSelectionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderOut:
    rows, address, user_coupon, subtotal, discount = _load_selection(
        db, payload, current_user.id, lock=True
    )
    shipping_fee = Decimal("0.00")
    total = money(max(Decimal("0.01"), subtotal - discount + shipping_fee))
    first_item, first_product = rows[0]
    order = Order(
        order_no=f"PL{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:6].upper()}",
        user_id=current_user.id,
        product_id=first_product.id,
        coupon_id=user_coupon.id if user_coupon else None,
        product_name=first_product.name
        if len(rows) == 1
        else f"{first_product.name}等{len(rows)}件",
        unit_price=first_product.price,
        quantity=sum(item.quantity for item, _ in rows),
        discount=discount,
        shipping_fee=shipping_fee,
        total_amount=total,
        status="PENDING_PAYMENT",
        payment_status="UNPAID",
        address_name=address.receiver_name,
        address_phone=address.phone,
        address_detail=" ".join(
            value
            for value in (address.province, address.city, address.district, address.detail)
            if value
        ),
        remark=payload.remark,
    )
    db.add(order)
    db.flush()
    for item, product in rows:
        before_stock = product.stock
        product.stock -= item.quantity
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                product_image_url=product.cover_url,
                unit_price=product.price,
                quantity=item.quantity,
                line_amount=money(product.price * item.quantity),
            )
        )
        db.add(
            InventoryRecord(
                product_id=product.id,
                change_quantity=-item.quantity,
                before_stock=before_stock,
                after_stock=product.stock,
                business_type="ORDER_CREATE",
                business_id=str(order.id),
            )
        )
    if user_coupon is not None:
        user_coupon.status = "USED"
        user_coupon.order_id = order.id
        user_coupon.used_at = datetime.now()
    db.execute(delete(CartItem).where(CartItem.id.in_([item.id for item, _ in rows])))
    db.commit()
    db.refresh(order)
    return order_out(db, order)


def owned_order(db: Session, order_id: int, user_id: int, *, lock: bool = False) -> Order:
    statement = select(Order).where(Order.id == order_id, Order.user_id == user_id)
    if lock:
        statement = statement.with_for_update()
    order = db.scalar(statement)
    if order is None:
        raise HTTPException(status_code=404, detail={"message": "订单不存在"})
    return order


@router.get("/orders", response_model=list[OrderOut])
def list_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrderOut]:
    orders = db.scalars(
        select(Order).where(Order.user_id == current_user.id).order_by(Order.id.desc())
    ).all()
    return [order_out(db, order) for order in orders]


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderOut:
    return order_out(db, owned_order(db, order_id, current_user.id))


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = owned_order(db, order_id, current_user.id, lock=True)
    if order.status != "PENDING_PAYMENT":
        raise HTTPException(status_code=409, detail={"message": "只有待付款订单可以取消"})
    items = db.scalars(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    for item in items:
        product = db.scalar(select(Product).where(Product.id == item.product_id).with_for_update())
        if product is not None:
            before_stock = product.stock
            product.stock += item.quantity
            db.add(
                InventoryRecord(
                    product_id=product.id,
                    change_quantity=item.quantity,
                    before_stock=before_stock,
                    after_stock=product.stock,
                    business_type="ORDER_CANCEL",
                    business_id=str(order.id),
                )
            )
    if order.coupon_id is not None:
        user_coupon = db.get(UserCoupon, order.coupon_id)
        if user_coupon is not None:
            user_coupon.status = "AVAILABLE"
            user_coupon.order_id = None
            user_coupon.used_at = None
    payments = db.scalars(select(Payment).where(Payment.order_id == order.id)).all()
    for payment in payments:
        if payment.status == "PENDING":
            payment.status = "FAILED"
    order.status = "CANCELLED"
    order.cancelled_at = datetime.now()
    db.commit()
    db.refresh(order)
    return order_out(db, order)


@router.post("/orders/{order_id}/payment-request", response_model=PaymentOut)
def request_payment(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Payment:
    order = owned_order(db, order_id, current_user.id, lock=True)
    if order.status != "PENDING_PAYMENT":
        raise HTTPException(status_code=409, detail={"message": "订单状态不允许付款"})
    payment = db.scalar(
        select(Payment).where(Payment.order_id == order.id, Payment.status == "PENDING")
    )
    if payment is None:
        payment = Payment(
            payment_no=f"PM{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:8].upper()}",
            order_id=order.id,
            provider="MANUAL",
            amount=order.total_amount,
            status="PENDING",
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
    return payment


@router.get("/orders/{order_id}/payment", response_model=PaymentOut)
def get_payment(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Payment:
    order = owned_order(db, order_id, current_user.id)
    payment = db.scalar(
        select(Payment).where(Payment.order_id == order.id).order_by(Payment.id.desc())
    )
    if payment is None:
        raise HTTPException(status_code=404, detail={"message": "付款请求不存在"})
    return payment

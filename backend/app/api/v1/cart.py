from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.entities import CartItem, Product, User
from app.schemas.api import CartItemCreate, CartItemOut, CartItemUpdate
from app.services.serializers import money, product_out

router = APIRouter(prefix="/cart", tags=["购物车"])


def serialize_item(item: CartItem, product: Product) -> CartItemOut:
    return CartItemOut(
        id=item.id,
        quantity=item.quantity,
        product=product_out(product),
        line_amount=money(Decimal(product.price) * item.quantity),
    )


def owned_item(db: Session, item_id: int, user_id: int) -> CartItem:
    item = db.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user_id))
    if item is None:
        raise HTTPException(status_code=404, detail={"message": "购物车商品不存在"})
    return item


@router.get("", response_model=list[CartItemOut])
def list_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CartItemOut]:
    rows = db.execute(
        select(CartItem, Product)
        .join(Product, Product.id == CartItem.product_id)
        .where(CartItem.user_id == current_user.id)
        .order_by(CartItem.id.desc())
    ).all()
    return [serialize_item(item, product) for item, product in rows]


@router.post("/items", response_model=CartItemOut)
def add_cart_item(
    payload: CartItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CartItemOut:
    product = db.get(Product, payload.product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=404, detail={"message": "商品不存在或已下架"})
    item = db.scalar(
        select(CartItem).where(
            CartItem.user_id == current_user.id,
            CartItem.product_id == payload.product_id,
        )
    )
    if item is None:
        item = CartItem(
            user_id=current_user.id,
            product_id=payload.product_id,
            quantity=payload.quantity,
        )
        db.add(item)
    else:
        item.quantity = min(20, item.quantity + payload.quantity)
    if item.quantity > product.stock:
        raise HTTPException(status_code=409, detail={"message": "商品库存不足"})
    db.commit()
    db.refresh(item)
    return serialize_item(item, product)


@router.put("/items/{item_id}", response_model=CartItemOut)
def update_cart_item(
    item_id: int,
    payload: CartItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CartItemOut:
    item = owned_item(db, item_id, current_user.id)
    product = db.get(Product, item.product_id)
    if product is None or not product.is_active or payload.quantity > product.stock:
        raise HTTPException(status_code=409, detail={"message": "商品库存不足或已下架"})
    item.quantity = payload.quantity
    db.commit()
    db.refresh(item)
    return serialize_item(item, product)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    item = owned_item(db, item_id, current_user.id)
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    db.execute(delete(CartItem).where(CartItem.user_id == current_user.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.entities import Favorite, Product, ProductCategory, User
from app.schemas.api import CategoryOut, FavoriteStateOut, ProductOut
from app.services.serializers import product_out

router = APIRouter(tags=["商品"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[ProductCategory]:
    return list(
        db.scalars(
            select(ProductCategory)
            .where(ProductCategory.enabled.is_(True))
            .order_by(ProductCategory.sort_order, ProductCategory.id)
        ).all()
    )


@router.get("/products", response_model=list[ProductOut])
def list_products(
    category: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    sort_by: str = Query(default="default", pattern="^(default|sales|price|newest)$"),
    db: Session = Depends(get_db),
) -> list[ProductOut]:
    statement = select(Product).where(Product.is_active.is_(True))
    if category and category != "全部":
        statement = statement.where(Product.category == category)
    if keyword:
        statement = statement.where(Product.name.contains(keyword))
    if sort_by == "sales":
        statement = statement.order_by(Product.sales.desc(), Product.id.desc())
    elif sort_by == "price":
        statement = statement.order_by(Product.price, Product.id)
    elif sort_by == "newest":
        statement = statement.order_by(Product.created_at.desc(), Product.id.desc())
    else:
        statement = statement.order_by(Product.id)
    return [product_out(product) for product in db.scalars(statement).all()]


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)) -> ProductOut:
    product = db.get(Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "商品不存在或已下架"},
        )
    return product_out(product)


@router.get("/products/{product_id}/favorite", response_model=FavoriteStateOut)
def get_favorite(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FavoriteStateOut:
    favorite = db.scalar(
        select(Favorite.id).where(
            Favorite.user_id == current_user.id,
            Favorite.product_id == product_id,
        )
    )
    return FavoriteStateOut(product_id=product_id, favorite=favorite is not None)


@router.put("/products/{product_id}/favorite", response_model=FavoriteStateOut)
def add_favorite(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FavoriteStateOut:
    product = db.get(Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=404, detail={"message": "商品不存在或已下架"})
    db.add(Favorite(user_id=current_user.id, product_id=product_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return FavoriteStateOut(product_id=product_id, favorite=True)


@router.delete("/products/{product_id}/favorite", response_model=FavoriteStateOut)
def remove_favorite(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FavoriteStateOut:
    db.execute(
        delete(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.product_id == product_id,
        )
    )
    db.commit()
    return FavoriteStateOut(product_id=product_id, favorite=False)

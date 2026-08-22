from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.entities import Address, User
from app.schemas.api import AddressIn, AddressOut

router = APIRouter(prefix="/addresses", tags=["收货地址"])


def owned_address(db: Session, address_id: int, user_id: int) -> Address:
    address = db.scalar(select(Address).where(Address.id == address_id, Address.user_id == user_id))
    if address is None:
        raise HTTPException(status_code=404, detail={"message": "收货地址不存在"})
    return address


def unset_defaults(db: Session, user_id: int) -> None:
    db.execute(update(Address).where(Address.user_id == user_id).values(is_default=False))


@router.get("", response_model=list[AddressOut])
def list_addresses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Address]:
    return list(
        db.scalars(
            select(Address)
            .where(Address.user_id == current_user.id)
            .order_by(Address.is_default.desc(), Address.id.desc())
        ).all()
    )


@router.post("", response_model=AddressOut)
def create_address(
    payload: AddressIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Address:
    has_address = db.scalar(select(Address.id).where(Address.user_id == current_user.id))
    values = payload.model_dump()
    values["is_default"] = payload.is_default or has_address is None
    if values["is_default"]:
        unset_defaults(db, current_user.id)
    address = Address(user_id=current_user.id, **values)
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.put("/{address_id}", response_model=AddressOut)
def update_address(
    address_id: int,
    payload: AddressIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Address:
    address = owned_address(db, address_id, current_user.id)
    if payload.is_default:
        unset_defaults(db, current_user.id)
    for key, value in payload.model_dump().items():
        setattr(address, key, value)
    db.commit()
    db.refresh(address)
    return address


@router.put("/{address_id}/default", response_model=AddressOut)
def set_default_address(
    address_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Address:
    address = owned_address(db, address_id, current_user.id)
    unset_defaults(db, current_user.id)
    address.is_default = True
    db.commit()
    db.refresh(address)
    return address


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    address = owned_address(db, address_id, current_user.id)
    was_default = address.is_default
    db.delete(address)
    db.flush()
    if was_default:
        replacement = db.scalar(
            select(Address).where(Address.user_id == current_user.id).order_by(Address.id.desc())
        )
        if replacement is not None:
            replacement.is_default = True
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

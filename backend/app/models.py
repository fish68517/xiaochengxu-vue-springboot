from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(24), index=True)
    phone: Mapped[str] = mapped_column(String(24), default="")
    building_id: Mapped[int | None] = mapped_column(ForeignKey("buildings.id"), nullable=True)
    house_id: Mapped[int | None] = mapped_column(ForeignKey("houses.id"), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    wechat_openid: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Building(Base):
    __tablename__ = "buildings"
    id: Mapped[int] = mapped_column(primary_key=True)
    community_name: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(50))


class House(Base):
    __tablename__ = "houses"
    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"), index=True)
    room_no: Mapped[str] = mapped_column(String(32))
    resident_code: Mapped[str] = mapped_column(String(64), unique=True)
    owner_name: Mapped[str] = mapped_column(String(64))
    building: Mapped[Building] = relationship()
    __table_args__ = (UniqueConstraint("building_id", "room_no", name="uq_house_building_room"),)


class FeeItem(Base):
    __tablename__ = "fee_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(255), default="")
    default_amount_fen: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Bill(Base):
    __tablename__ = "bills"
    id: Mapped[int] = mapped_column(primary_key=True)
    bill_no: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    billing_period: Mapped[str] = mapped_column(String(32))
    total_amount_fen: Mapped[int] = mapped_column(Integer)
    paid_amount_fen: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)
    generated_by: Mapped[str] = mapped_column(String(20), default="MANUAL")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    house: Mapped[House] = relationship()
    items: Mapped[list["BillItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    __table_args__ = (UniqueConstraint("house_id", "billing_period", "title", name="uq_bill_house_period_title"),)


class BillItem(Base):
    __tablename__ = "bill_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    bill_id: Mapped[int] = mapped_column(ForeignKey("bills.id", ondelete="CASCADE"), index=True)
    fee_item_id: Mapped[int] = mapped_column(ForeignKey("fee_items.id"))
    fee_item_code: Mapped[str] = mapped_column(String(32))
    fee_item_name: Mapped[str] = mapped_column(String(100))
    amount_fen: Mapped[int] = mapped_column(Integer)
    remark: Mapped[str] = mapped_column(String(255), default="")


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    payment_no: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    bill_id: Mapped[int] = mapped_column(ForeignKey("bills.id"), index=True)
    amount_fen: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="CREATED")
    provider: Mapped[str] = mapped_column(String(20), default="MANUAL")
    provider_transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    bill: Mapped[Bill] = relationship()


class Receipt(Base):
    __tablename__ = "receipts"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_no: Mapped[str] = mapped_column(String(64), unique=True)
    bill_id: Mapped[int] = mapped_column(ForeignKey("bills.id"))
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"))
    applicant_name: Mapped[str] = mapped_column(String(64))
    phone: Mapped[str] = mapped_column(String(24))
    title: Mapped[str] = mapped_column(String(100), default="")
    remark: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RepairOrder(Base):
    __tablename__ = "repair_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_no: Mapped[str] = mapped_column(String(64), unique=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), index=True)
    description: Mapped[str] = mapped_column(Text)
    image_urls: Mapped[list] = mapped_column(JSON, default=list)
    contact_name: Mapped[str] = mapped_column(String(64))
    contact_phone: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    progress_text: Mapped[str] = mapped_column(String(255), default="")
    result_text: Mapped[str] = mapped_column(String(255), default="")
    completion_images: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    house: Mapped[House] = relationship()
    technician: Mapped[User | None] = relationship()


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"), index=True)
    elevator_name: Mapped[str] = mapped_column(String(64))
    maintenance_date: Mapped[date] = mapped_column(Date)
    title: Mapped[str] = mapped_column(String(180))
    pdf_url: Mapped[str] = mapped_column(String(255), default="")
    file_size: Mapped[int] = mapped_column(BigInteger, default=0)
    uploader_name: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Renovation(Base):
    __tablename__ = "renovations"
    id: Mapped[int] = mapped_column(primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), index=True)
    applicant_name: Mapped[str] = mapped_column(String(64))
    phone: Mapped[str] = mapped_column(String(24))
    plan: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(32), default="DEPOSIT_UNPAID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notice(Base):
    __tablename__ = "notices"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class NotificationOutbox(Base):
    __tablename__ = "notification_outbox"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    recipient: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    batch_no: Mapped[str] = mapped_column(String(64), unique=True)
    filename: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(20), default="PREVIEWED")
    rows_json: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

import csv
import io
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openpyxl import load_workbook
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .adapters import notification_service, storage_service
from .config import settings
from .database import get_db
from .models import (
    Bill, BillItem, FeeItem, House, ImportBatch, MaintenanceRecord, Notice,
    Payment, Receipt, RepairOrder, Renovation, User,
)


app = FastAPI(title="加装电梯后期管理平台 API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=storage_service.root), name="uploads")


def response(data=None, message="操作成功"):
    return {"code": 0, "message": message, "data": data}


def current_user(db: Session, username: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if not user:
        raise HTTPException(401, "development 测试账号不存在")
    return user


def money(fen: int) -> str:
    return f"{fen / 100:.2f}"


def house_label(house: House) -> str:
    return f"{house.building.community_name}{house.building.name} {house.room_no}"


def bill_data(bill: Bill) -> dict:
    effective_status = "OVERDUE" if bill.status == "PENDING" and bill.due_date < date.today() else bill.status
    return {
        "id": bill.id,
        "billNo": bill.bill_no,
        "houseId": bill.house_id,
        "houseDisplayName": house_label(bill.house),
        "title": bill.title,
        "billingPeriod": bill.billing_period,
        "totalAmountFen": bill.total_amount_fen,
        "totalAmount": money(bill.total_amount_fen),
        "paidAmountFen": bill.paid_amount_fen,
        "dueDate": bill.due_date.isoformat(),
        "status": effective_status,
        "generatedBy": bill.generated_by,
        "createdAt": bill.created_at.isoformat(),
        "paidAt": bill.paid_at.isoformat() if bill.paid_at else None,
        "items": [{
            "id": item.id,
            "feeItemCode": item.fee_item_code,
            "feeItemName": item.fee_item_name,
            "amountFen": item.amount_fen,
            "amount": money(item.amount_fen),
            "remark": item.remark,
        } for item in bill.items],
    }


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(1))
    return response({
        "status": "ok", "appEnv": settings.app_env, "database": "mysql",
        "authMode": settings.auth_mode, "paymentMode": settings.payment_mode,
        "storageBackend": settings.storage_backend, "notificationMode": settings.notification_mode,
    })


@app.get("/api/dev/session")
def dev_session(username: str = "owner_101", db: Session = Depends(get_db)):
    user = current_user(db, username)
    house = db.scalar(select(House).options(selectinload(House.building)).where(House.id == user.house_id)) if user.house_id else None
    return response({
        "username": user.username, "displayName": user.display_name, "role": user.role,
        "phone": user.phone, "house": {"id": house.id, "displayName": house_label(house), "buildingId": house.building_id} if house else None,
    })


@app.get("/api/bills/my")
def my_bills(status: str | None = None, x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    if user.role != "OWNER" or not user.house_id:
        raise HTTPException(403, "仅业主可查看本人房屋账单")
    query = select(Bill).options(selectinload(Bill.house).selectinload(House.building), selectinload(Bill.items)).where(Bill.house_id == user.house_id).order_by(Bill.created_at.desc())
    bills = db.scalars(query).all()
    items = [bill_data(item) for item in bills]
    if status:
        items = [item for item in items if item["status"] == status]
    return response(items)


@app.get("/api/bills/{bill_id}")
def bill_detail(bill_id: int, x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    bill = db.scalar(select(Bill).options(selectinload(Bill.house).selectinload(House.building), selectinload(Bill.items)).where(Bill.id == bill_id))
    if not bill:
        raise HTTPException(404, "账单不存在")
    if user.role == "OWNER" and bill.house_id != user.house_id:
        raise HTTPException(403, "无权查看其他房屋账单")
    return response(bill_data(bill))


class MockPaymentRequest(BaseModel):
    billId: int
    result: str = "success"


@app.post("/api/payments/mock")
def mock_payment(payload: MockPaymentRequest, x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    if settings.payment_mode != "mock":
        raise HTTPException(409, "当前环境未启用 Mock 支付")
    user = current_user(db, x_dev_user)
    bill = db.scalar(select(Bill).where(Bill.id == payload.billId).with_for_update())
    if not bill:
        raise HTTPException(404, "账单不存在")
    if user.role != "OWNER" or bill.house_id != user.house_id:
        raise HTTPException(403, "无权支付此账单")
    if bill.status == "PAID":
        existing = db.scalar(select(Payment).where(Payment.bill_id == bill.id, Payment.status == "SUCCESS"))
        return response({"status": "SUCCESS", "paymentId": existing.id if existing else None, "idempotent": True}, "账单已支付")
    payment = Payment(payment_no=f"MP{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:6]}", bill_id=bill.id, amount_fen=bill.total_amount_fen, provider="MOCK")
    db.add(payment)
    db.flush()
    if payload.result == "cancel":
        payment.status = "CLOSED"
        db.commit()
        return response({"status": "CLOSED", "paymentId": payment.id}, "已取消支付")
    if payload.result == "fail":
        payment.status = "FAILED"
        db.commit()
        return response({"status": "FAILED", "paymentId": payment.id}, "模拟支付失败")
    payment.status = "SUCCESS"
    payment.paid_at = datetime.utcnow()
    payment.provider_transaction_id = f"MOCK-{payment.payment_no}"
    bill.status = "PAID"
    bill.paid_amount_fen = bill.total_amount_fen
    bill.paid_at = payment.paid_at
    notification_service.send(db, "PAYMENT_SUCCESS", user.username, {"billId": bill.id, "paymentId": payment.id})
    db.commit()
    return response({"status": "SUCCESS", "paymentId": payment.id, "amountFen": payment.amount_fen})


@app.get("/api/payments/my")
def my_payments(x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    payments = db.scalars(select(Payment).join(Bill).where(Bill.house_id == user.house_id).order_by(Payment.created_at.desc())).all()
    return response([{"id": p.id, "paymentNo": p.payment_no, "billId": p.bill_id, "amount": money(p.amount_fen), "status": p.status, "paidAt": p.paid_at.isoformat() if p.paid_at else None} for p in payments])


class ReceiptRequest(BaseModel):
    billId: int
    applicantName: str
    phone: str
    title: str = ""
    remark: str = ""


@app.post("/api/receipts")
def create_receipt(payload: ReceiptRequest, x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    bill = db.scalar(select(Bill).where(Bill.id == payload.billId, Bill.house_id == user.house_id))
    if not bill or bill.status != "PAID":
        raise HTTPException(409, "仅已缴账单可以申请收据")
    payment = db.scalar(select(Payment).where(Payment.bill_id == bill.id, Payment.status == "SUCCESS"))
    if not payment:
        raise HTTPException(409, "未找到成功缴费记录")
    existing = db.scalar(select(Receipt).where(Receipt.bill_id == bill.id))
    if existing:
        return response({"id": existing.id, "status": existing.status}, "已提交过收据申请")
    receipt = Receipt(application_no=f"RC{datetime.now():%Y%m%d%H%M%S}", bill_id=bill.id, payment_id=payment.id, applicant_name=payload.applicantName, phone=payload.phone, title=payload.title, remark=payload.remark)
    db.add(receipt)
    notification_service.send(db, "RECEIPT_APPLIED", "admin_01", {"billId": bill.id})
    db.commit()
    return response({"id": receipt.id, "status": receipt.status})


@app.get("/api/receipts/my")
def my_receipts(x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    receipts = db.scalars(select(Receipt).join(Bill).where(Bill.house_id == user.house_id).order_by(Receipt.created_at.desc())).all()
    return response([{"id": item.id, "applicationNo": item.application_no, "billId": item.bill_id, "status": item.status, "createdAt": item.created_at.isoformat()} for item in receipts])


class RepairRequest(BaseModel):
    description: str
    contactName: str
    contactPhone: str
    imageUrls: list[str] = []


@app.get("/api/repairs/my")
def my_repairs(x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    repairs = db.scalars(select(RepairOrder).options(selectinload(RepairOrder.house).selectinload(House.building), selectinload(RepairOrder.technician)).where(RepairOrder.house_id == user.house_id).order_by(RepairOrder.created_at.desc())).all()
    return response([repair_data(item) for item in repairs])


def repair_data(item: RepairOrder) -> dict:
    return {"id": item.id, "orderNo": item.order_no, "house": house_label(item.house), "description": item.description, "status": item.status, "contactName": item.contact_name, "contactPhone": item.contact_phone, "progressText": item.progress_text, "resultText": item.result_text, "technicianName": item.technician.display_name if item.technician else None, "createdAt": item.created_at.isoformat()}


@app.post("/api/repairs")
def create_repair(payload: RepairRequest, x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    if not user.house_id:
        raise HTTPException(409, "请先绑定房屋")
    repair = RepairOrder(order_no=f"BX{datetime.now():%Y%m%d%H%M%S}", house_id=user.house_id, description=payload.description, image_urls=payload.imageUrls, contact_name=payload.contactName, contact_phone=payload.contactPhone)
    db.add(repair)
    notification_service.send(db, "REPAIR_CREATED", "admin_01", {"orderNo": repair.order_no})
    db.commit()
    return response({"id": repair.id, "orderNo": repair.order_no})


@app.get("/api/technician/repairs")
def technician_repairs(x_dev_user: str = Header("technician_01"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    if user.role != "TECHNICIAN":
        raise HTTPException(403, "仅维修师傅可访问")
    items = db.scalars(select(RepairOrder).options(selectinload(RepairOrder.house).selectinload(House.building), selectinload(RepairOrder.technician)).where((RepairOrder.technician_id == user.id) | (RepairOrder.technician_id.is_(None))).order_by(RepairOrder.created_at.desc())).all()
    return response([repair_data(item) for item in items])


class RepairAction(BaseModel):
    action: str
    text: str = ""


@app.post("/api/technician/repairs/{repair_id}/action")
def technician_action(repair_id: int, payload: RepairAction, x_dev_user: str = Header("technician_01"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    item = db.scalar(select(RepairOrder).where(RepairOrder.id == repair_id).with_for_update())
    if not item:
        raise HTTPException(404, "工单不存在")
    if item.technician_id not in (None, user.id):
        raise HTTPException(403, "该工单未派给当前师傅")
    item.technician_id = user.id
    if payload.action in ("accept", "progress"):
        item.status = "REPAIRING"
        item.progress_text = payload.text or "维修师傅已接单，正在处理中"
    elif payload.action == "complete":
        item.status = "COMPLETED"
        item.result_text = payload.text or "故障已处理，电梯恢复正常运行"
    else:
        raise HTTPException(400, "不支持的工单动作")
    notification_service.send(db, "REPAIR_STATUS_CHANGED", f"house:{item.house_id}", {"orderNo": item.order_no, "status": item.status})
    db.commit()
    return response({"id": item.id, "status": item.status})


@app.get("/api/maintenance-records")
def maintenance_records(x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    if user.role == "OWNER" and not user.building_id:
        raise HTTPException(403, "未绑定楼栋")
    query = select(MaintenanceRecord).order_by(MaintenanceRecord.maintenance_date.desc())
    if user.role == "OWNER":
        query = query.where(MaintenanceRecord.building_id == user.building_id)
    items = db.scalars(query).all()
    return response([{"id": item.id, "title": item.title, "buildingId": item.building_id, "elevatorName": item.elevator_name, "maintenanceDate": item.maintenance_date.isoformat(), "pdfUrl": item.pdf_url, "fileSize": item.file_size, "uploaderName": item.uploader_name} for item in items])


@app.get("/api/notices")
def notices(db: Session = Depends(get_db)):
    items = db.scalars(select(Notice).order_by(Notice.pinned.desc(), Notice.published_at.desc())).all()
    return response([{"id": item.id, "title": item.title, "category": item.category, "content": item.content, "pinned": item.pinned, "publishedAt": item.published_at.isoformat()} for item in items])


@app.get("/api/renovations/my")
def my_renovations(x_dev_user: str = Header("owner_101"), db: Session = Depends(get_db)):
    user = current_user(db, x_dev_user)
    items = db.scalars(select(Renovation).where(Renovation.house_id == user.house_id).order_by(Renovation.created_at.desc())).all()
    return response([{"id": item.id, "applicantName": item.applicant_name, "phone": item.phone, "plan": item.plan, "status": item.status, "createdAt": item.created_at.isoformat()} for item in items])


@app.post("/api/uploads")
async def upload(file: UploadFile = File(...), folder: str = "common"):
    result = await storage_service.save(file, folder)
    return response(result)


@app.get("/api/admin/dashboard")
def admin_dashboard(db: Session = Depends(get_db)):
    pending = db.scalar(select(func.count()).select_from(RepairOrder).where(RepairOrder.status == "PENDING")) or 0
    arrears = db.scalar(select(func.count()).select_from(Bill).where(Bill.status == "OVERDUE")) or 0
    receivable = db.scalar(select(func.sum(Bill.total_amount_fen)).where(Bill.status.in_(["PENDING", "OVERDUE"]))) or 0
    paid = db.scalar(select(func.sum(Bill.paid_amount_fen))) or 0
    return response({"pendingRepairs": pending, "arrearsHouseholds": arrears, "receivable": money(receivable), "paid": money(paid), "maintenanceCount": db.scalar(select(func.count()).select_from(MaintenanceRecord)) or 0, "noticeCount": db.scalar(select(func.count()).select_from(Notice)) or 0})


@app.get("/api/admin/fee-items")
def admin_fee_items(db: Session = Depends(get_db)):
    items = db.scalars(select(FeeItem).order_by(FeeItem.sort_order)).all()
    return response([{"id": item.id, "code": item.code, "name": item.name, "description": item.description, "defaultAmount": money(item.default_amount_fen or 0), "enabled": item.enabled, "sortOrder": item.sort_order} for item in items])


@app.get("/api/admin/bills")
def admin_bills(db: Session = Depends(get_db)):
    items = db.scalars(select(Bill).options(selectinload(Bill.house).selectinload(House.building), selectinload(Bill.items)).order_by(Bill.created_at.desc())).all()
    return response([bill_data(item) for item in items])


def parse_upload(filename: str, content: bytes) -> list[dict]:
    required = ["communityName", "buildingName", "roomNo", "residentCode", "billingPeriod", "billTitle", "feeItemCode", "feeItemName", "amountYuan", "dueDate"]
    if filename.lower().endswith(".csv"):
        text = content.decode("utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(text)))
    elif filename.lower().endswith((".xlsx", ".xlsm")):
        book = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = book.active
        values = list(sheet.iter_rows(values_only=True))
        headers = [str(v or "") for v in values[0]]
        rows = [dict(zip(headers, row)) for row in values[1:]]
    else:
        raise HTTPException(400, "仅支持 CSV 或 XLSX")
    if not rows:
        raise HTTPException(400, "导入文件没有数据")
    missing = [field for field in required if field not in rows[0]]
    if missing:
        raise HTTPException(400, f"缺少字段：{', '.join(missing)}")
    return rows


@app.post("/api/admin/billing-imports/parse")
async def parse_billing_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    raw_rows = parse_upload(file.filename or "", content)
    preview = []
    seen = set()
    for index, row in enumerate(raw_rows, 2):
        errors = []
        house = db.scalar(select(House).where(House.room_no == str(row.get("roomNo", "")).strip(), House.resident_code == str(row.get("residentCode", "")).strip()))
        fee = db.scalar(select(FeeItem).where(FeeItem.code == str(row.get("feeItemCode", "")).strip(), FeeItem.enabled.is_(True)))
        try:
            amount_fen = int(round(float(row.get("amountYuan")) * 100))
            if amount_fen < 0:
                errors.append("金额不能小于0")
        except (TypeError, ValueError):
            amount_fen = 0
            errors.append("金额格式错误")
        try:
            due = date.fromisoformat(str(row.get("dueDate"))[:10])
        except ValueError:
            due = None
            errors.append("截止日期格式错误")
        if not house:
            errors.append("房号不存在或住户编码不匹配")
        if not fee:
            errors.append("费用项目不存在或未启用")
        key = (row.get("buildingName"), row.get("roomNo"), row.get("billingPeriod"), row.get("billTitle"), row.get("feeItemCode"))
        if key in seen:
            errors.append("文件内重复费用项")
        seen.add(key)
        preview.append({"rowNo": index, **{key: str(row.get(key, "") or "") for key in row}, "amountFen": amount_fen, "dueDate": due.isoformat() if due else "", "houseId": house.id if house else None, "feeItemId": fee.id if fee else None, "valid": not errors, "errors": errors})
    batch = ImportBatch(batch_no=f"IMP{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:4]}", filename=file.filename or "", rows_json=preview)
    db.add(batch)
    db.commit()
    return response({"batchId": batch.id, "batchNo": batch.batch_no, "validCount": sum(1 for row in preview if row["valid"]), "invalidCount": sum(1 for row in preview if not row["valid"]), "rows": preview})


@app.post("/api/admin/billing-imports/{batch_id}/commit")
def commit_billing_import(batch_id: int, db: Session = Depends(get_db)):
    batch = db.scalar(select(ImportBatch).where(ImportBatch.id == batch_id).with_for_update())
    if not batch:
        raise HTTPException(404, "导入批次不存在")
    if batch.status == "COMMITTED":
        return response({"batchId": batch.id, "idempotent": True}, "该批次已经提交")
    groups: dict[tuple, list[dict]] = {}
    for row in batch.rows_json:
        if row["valid"]:
            key = (row["houseId"], row["billingPeriod"], row["billTitle"], row["dueDate"])
            groups.setdefault(key, []).append(row)
    created = 0
    skipped = 0
    for (house_id, period, title, due), rows in groups.items():
        existing = db.scalar(select(Bill).where(Bill.house_id == house_id, Bill.billing_period == period, Bill.title == title))
        if existing:
            skipped += 1
            continue
        bill = Bill(bill_no=f"BILL-{house_id}-{period}-{uuid4().hex[:5]}", house_id=house_id, title=title, billing_period=period, due_date=date.fromisoformat(due), status="PENDING", generated_by="IMPORT", total_amount_fen=sum(row["amountFen"] for row in rows))
        db.add(bill)
        db.flush()
        for row in rows:
            bill.items.append(BillItem(bill_id=bill.id, fee_item_id=row["feeItemId"], fee_item_code=row["feeItemCode"], fee_item_name=row["feeItemName"], amount_fen=row["amountFen"], remark=row.get("remark", "")))
        created += 1
    batch.status = "COMMITTED"
    notification_service.send(db, "BILLS_IMPORTED", "admin_01", {"batchId": batch.id, "created": created})
    db.commit()
    return response({"batchId": batch.id, "createdBills": created, "skippedBills": skipped})


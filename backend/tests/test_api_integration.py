from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.database import SessionLocal
from app.main import app
from app.models import Bill, BillItem, Notice, NotificationOutbox, Payment, RepairOrder, Renovation


client = TestClient(app)


def login(username: str, password: str) -> dict[str, str]:
    result = client.post("/api/auth/login", json={"username": username, "password": password})
    assert result.status_code == 200, result.text
    return {"Authorization": f"Bearer {result.json()['data']['token']}"}


def test_database_login_and_role_isolation():
    admin = login("admin_01", "Admin@123456")
    owner = login("owner_101", "Owner@123456")
    technician = login("technician_01", "Tech@123456")

    assert client.get("/api/admin/dashboard", headers=admin).status_code == 200
    assert client.get("/api/bills/my", headers=owner).status_code == 200
    assert client.get("/api/technician/repairs", headers=technician).status_code == 200
    assert client.get("/api/admin/dashboard", headers=owner).status_code == 403
    assert client.get("/api/admin/dashboard").status_code == 401


def test_notice_owner_repair_and_payment_mysql_closed_loop():
    admin = login("admin_01", "Admin@123456")
    owner = login("owner_101", "Owner@123456")
    technician = login("technician_01", "Tech@123456")
    marker = uuid4().hex[:8]
    notice_title = f"MySQL联调公告-{marker}"
    repair_description = f"MySQL联调报修-{marker}：电梯按钮无响应"
    bill_title = f"MySQL联调账单-{marker}"
    notice_id = repair_id = renovation_id = bill_id = payment_id = None
    repair_order_no = None

    try:
        result = client.post("/api/admin/notices", headers=admin, json={
            "title": notice_title, "category": "电梯通知", "content": "由自动化联调写入MySQL", "pinned": False,
        })
        assert result.status_code == 200, result.text
        notice_id = result.json()["data"]["id"]
        notices = client.get("/api/notices", headers=owner).json()["data"]
        assert any(item["id"] == notice_id and item["title"] == notice_title for item in notices)

        result = client.post("/api/repairs", headers=owner, json={
            "description": repair_description, "contactName": "张先生", "contactPhone": "13800008888", "imageUrls": [],
        })
        assert result.status_code == 200, result.text
        repair_id = result.json()["data"]["id"]
        repair_order_no = result.json()["data"]["orderNo"]
        assert any(item["id"] == repair_id for item in client.get("/api/technician/repairs", headers=technician).json()["data"])
        assert client.post(f"/api/technician/repairs/{repair_id}/action", headers=technician, json={"action": "accept", "text": "已接单"}).status_code == 200
        assert client.post(f"/api/technician/repairs/{repair_id}/action", headers=technician, json={"action": "complete", "text": "联调完工"}).status_code == 200
        owner_repairs = client.get("/api/repairs/my", headers=owner).json()["data"]
        assert next(item for item in owner_repairs if item["id"] == repair_id)["status"] == "COMPLETED"

        result = client.post("/api/renovations", headers=owner, json={
            "applicantName": "张先生", "phone": "13800008888", "plan": f"MySQL联调装修-{marker}",
        })
        assert result.status_code == 200, result.text
        renovation_id = result.json()["data"]["id"]
        assert client.put(f"/api/admin/renovations/{renovation_id}/status", headers=admin, json={"status": "COMPLETED"}).status_code == 200
        owner_renovations = client.get("/api/renovations/my", headers=owner).json()["data"]
        assert next(item for item in owner_renovations if item["id"] == renovation_id)["status"] == "COMPLETED"

        fee_id = client.get("/api/admin/fee-items", headers=admin).json()["data"][0]["id"]
        result = client.post("/api/admin/bills", headers=admin, json={
            "houseId": 1, "title": bill_title, "billingPeriod": f"T-{marker}",
            "dueDate": (date.today() + timedelta(days=30)).isoformat(),
            "items": [{"feeItemId": fee_id, "amountFen": 1234, "remark": "联调"}],
        })
        assert result.status_code == 200, result.text
        bill_id = result.json()["data"]["id"]
        result = client.post("/api/payments/manual-request", headers=owner, json={"billId": bill_id})
        assert result.status_code == 200, result.text
        payment_id = result.json()["data"]["paymentId"]
        assert client.post(f"/api/admin/payments/{payment_id}/confirm", headers=admin, json={"referenceNo": f"TEST-{marker}"}).status_code == 200
        bill = client.get(f"/api/bills/{bill_id}", headers=owner).json()["data"]
        assert bill["status"] == "PAID"
        assert bill["paidAmountFen"] == 1234
    finally:
        with SessionLocal() as db:
            if payment_id:
                db.execute(delete(Payment).where(Payment.id == payment_id))
            if bill_id:
                db.execute(delete(BillItem).where(BillItem.bill_id == bill_id))
                db.execute(delete(Bill).where(Bill.id == bill_id))
            if repair_id:
                db.execute(delete(RepairOrder).where(RepairOrder.id == repair_id))
            if renovation_id:
                db.execute(delete(Renovation).where(Renovation.id == renovation_id))
            if notice_id:
                db.execute(delete(Notice).where(Notice.id == notice_id))
            outbox_items = db.scalars(select(NotificationOutbox).where(NotificationOutbox.event_type.in_([
                "NOTICE_PUBLISHED", "REPAIR_CREATED", "REPAIR_STATUS_CHANGED", "RENOVATION_CREATED",
                "BILL_CREATED", "MANUAL_PAYMENT_REQUESTED", "PAYMENT_CONFIRMED",
            ]))).all()
            for item in outbox_items:
                if marker in str(item.payload):
                    db.delete(item)
                elif bill_id and item.payload.get("billId") == bill_id:
                    db.delete(item)
                elif payment_id and item.payload.get("paymentId") == payment_id:
                    db.delete(item)
                elif repair_order_no and item.payload.get("orderNo") == repair_order_no:
                    db.delete(item)
            db.commit()

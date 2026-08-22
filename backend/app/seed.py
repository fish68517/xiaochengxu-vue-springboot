from datetime import date, datetime, timedelta

from sqlalchemy import select

from .database import SessionLocal
from .models import (
    Bill, BillItem, Building, FeeItem, House, MaintenanceRecord, Notice,
    RepairOrder, Renovation, User,
)
from .security import hash_password


FEE_ITEMS = [
    ("ELECTRIC", "电梯相关电费", 80_00),
    ("PARTS", "电梯零件费", 50_00),
    ("MAINT", "维护保养费", 90_00),
    ("LABOR", "人工费", 40_00),
    ("COMM", "通讯费", 10_00),
    ("ANNUAL", "年审费用", 20_00),
    ("CLEAN", "清洁费", 18_00),
    ("INSURANCE", "保险费", 30_00),
    ("SAFETY", "安全管理员服务费", 50_00),
]


def create_bill(db, house, no, title, period, due, status, amounts):
    bill = Bill(
        bill_no=no,
        house_id=house.id,
        title=title,
        billing_period=period,
        due_date=due,
        status=status,
        generated_by="IMPORT",
        total_amount_fen=sum(amount for _, amount in amounts),
        paid_amount_fen=sum(amount for _, amount in amounts) if status == "PAID" else 0,
        paid_at=datetime.utcnow() - timedelta(days=15) if status == "PAID" else None,
    )
    db.add(bill)
    db.flush()
    fee_map = {item.code: item for item in db.scalars(select(FeeItem)).all()}
    for code, amount in amounts:
        fee = fee_map[code]
        bill.items.append(BillItem(
            fee_item_id=fee.id,
            fee_item_code=fee.code,
            fee_item_name=fee.name,
            amount_fen=amount,
        ))
    return bill


def seed() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)):
            print("Seed skipped: users already exist")
            return

        b1 = Building(community_name="五山新苑", name="1栋")
        b2 = Building(community_name="五山新苑", name="2栋")
        db.add_all([b1, b2])
        db.flush()

        h101 = House(building_id=b1.id, room_no="101室", resident_code="H1101", owner_name="张先生")
        h102 = House(building_id=b1.id, room_no="102室", resident_code="H1102", owner_name="陈先生")
        h201 = House(building_id=b2.id, room_no="201室", resident_code="H2201", owner_name="王女士")
        db.add_all([h101, h102, h201])
        db.flush()

        owner101 = User(username="owner_101", display_name="张先生", role="OWNER", phone="13800008888", building_id=b1.id, house_id=h101.id, password_hash=hash_password("Owner@123456"))
        owner102 = User(username="owner_102", display_name="陈先生", role="OWNER", phone="13800006666", building_id=b1.id, house_id=h102.id, password_hash=hash_password("Owner@123456"))
        tech = User(username="technician_01", display_name="李师傅", role="TECHNICIAN", phone="13800008886", password_hash=hash_password("Tech@123456"))
        admin = User(username="admin_01", display_name="系统管理员", role="ADMIN", phone="13800000001", password_hash=hash_password("Admin@123456"))
        db.add_all([owner101, owner102, tech, admin])

        for index, (code, name, default) in enumerate(FEE_ITEMS):
            db.add(FeeItem(code=code, name=name, default_amount_fen=default, enabled=True, sort_order=index + 1))
        db.flush()

        create_bill(db, h101, "BILL-101-202608", "2026年8月电梯后期管理费", "2026-08", date(2026, 8, 31), "PENDING", [
            ("ELECTRIC", 80_00), ("MAINT", 118_00), ("PARTS", 70_00), ("LABOR", 42_00),
            ("COMM", 12_00), ("ANNUAL", 26_00), ("CLEAN", 18_00), ("INSURANCE", 22_00),
        ])
        create_bill(db, h102, "BILL-102-202608", "2026年8月电梯后期管理费", "2026-08", date(2026, 8, 31), "PENDING", [
            ("ELECTRIC", 98_00), ("MAINT", 130_00), ("PARTS", 76_00), ("LABOR", 46_00),
            ("COMM", 14_00), ("ANNUAL", 28_00), ("CLEAN", 18_00), ("INSURANCE", 18_00),
        ])
        create_bill(db, h101, "BILL-101-202605", "2026年5月电梯后期管理费", "2026-05", date(2026, 5, 31), "OVERDUE", [
            ("ELECTRIC", 76_00), ("MAINT", 112_00), ("PARTS", 62_00), ("LABOR", 40_00), ("SAFETY", 56_00),
        ])
        create_bill(db, h101, "BILL-101-202602", "2026年2月电梯后期管理费", "2026-02", date(2026, 2, 28), "PAID", [
            ("ELECTRIC", 80_00), ("MAINT", 118_00), ("PARTS", 70_00), ("LABOR", 42_00), ("COMM", 12_00), ("ANNUAL", 26_00), ("CLEAN", 18_00), ("INSURANCE", 22_00),
        ])

        db.add_all([
            Notice(title="关于电梯年度检验的通知", category="电梯通知", content="本栋电梯年度检验将于本周五进行，请合理安排出行。", pinned=True),
            Notice(title="2026年8月管理费缴费提醒", category="缴费通知", content="本期账单已经生成，请业主在截止日期前完成缴费。"),
            Notice(title="8月份电梯维保安排", category="维保通知", content="本月例行维护时间为8月20日 09:00—11:00。"),
        ])
        db.add_all([
            MaintenanceRecord(building_id=b1.id, elevator_name="1号电梯", maintenance_date=date(2026, 8, 10), title="2026年8月维保报告", pdf_url="", file_size=1_210_000, uploader_name="李师傅"),
            MaintenanceRecord(building_id=b1.id, elevator_name="1号电梯", maintenance_date=date(2026, 7, 10), title="2026年7月维保报告", pdf_url="", file_size=1_180_000, uploader_name="李师傅"),
            MaintenanceRecord(building_id=b2.id, elevator_name="2号电梯", maintenance_date=date(2026, 8, 12), title="2026年8月维保报告", pdf_url="", file_size=1_050_000, uploader_name="王师傅"),
        ])
        db.add_all([
            RepairOrder(order_no="BX20260817001", house_id=h101.id, description="电梯运行时有异常响声", image_urls=[], contact_name="张先生", contact_phone="13800008888", status="PENDING"),
            RepairOrder(order_no="BX20260812002", house_id=h102.id, description="楼层按键灯不亮", image_urls=[], contact_name="陈先生", contact_phone="13800006666", status="REPAIRING", technician_id=tech.id, progress_text="已接单，正在检查控制面板"),
        ])
        db.add(Renovation(house_id=h101.id, applicant_name="张先生", phone="13800008888", plan="室内墙面及地面翻新", status="DEPOSIT_UNPAID"))
        db.commit()
        print("Seed complete")


if __name__ == "__main__":
    seed()

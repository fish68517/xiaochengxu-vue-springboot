from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.database import SessionLocal
from app.main import app
from app.models import Building, House, NotificationOutbox, User


client = TestClient(app)


def test_owner_and_technician_registration_and_login_type():
    marker = uuid4().hex[:10]
    owner_username = f"owner_{marker}"
    technician_username = f"tech_{marker}"
    resident_code = f"TEST-HOUSE-{marker}"
    building_id = house_id = owner_id = technician_id = None

    try:
        with SessionLocal() as db:
            building = Building(community_name=f"联调小区{marker}", name="测试楼")
            db.add(building)
            db.flush()
            building_id = building.id
            house = House(building_id=building.id, room_no=f"{marker}室", resident_code=resident_code, owner_name="联调业主")
            db.add(house)
            db.commit()
            house_id = house.id

        owner_result = client.post("/api/auth/register", json={
            "username": owner_username,
            "password": "Owner@123456",
            "displayName": "联调业主",
            "phone": "13800001111",
            "role": "OWNER",
            "residentCode": resident_code,
        })
        assert owner_result.status_code == 200, owner_result.text
        owner_id = owner_result.json()["data"]["id"]
        assert owner_result.json()["data"]["enabled"] is True
        assert owner_result.json()["data"]["requiresApproval"] is False

        duplicate_house = client.post("/api/auth/register", json={
            "username": f"duplicate_{marker}",
            "password": "Owner@123456",
            "displayName": "重复业主",
            "phone": "13800002222",
            "role": "OWNER",
            "residentCode": resident_code,
        })
        assert duplicate_house.status_code == 409

        assert client.post("/api/auth/login", json={
            "username": owner_username, "password": "Owner@123456", "loginType": "OWNER",
        }).status_code == 200
        assert client.post("/api/auth/login", json={
            "username": owner_username, "password": "Owner@123456", "loginType": "TECHNICIAN",
        }).status_code == 403

        technician_result = client.post("/api/auth/register", json={
            "username": technician_username,
            "password": "Tech@123456",
            "displayName": "联调师傅",
            "phone": "13800003333",
            "role": "TECHNICIAN",
        })
        assert technician_result.status_code == 200, technician_result.text
        technician_id = technician_result.json()["data"]["id"]
        assert technician_result.json()["data"]["enabled"] is False
        assert technician_result.json()["data"]["requiresApproval"] is True
        assert client.post("/api/auth/login", json={
            "username": technician_username, "password": "Tech@123456", "loginType": "TECHNICIAN",
        }).status_code == 403

        admin_login = client.post("/api/auth/login", json={"username": "admin_01", "password": "Admin@123456"})
        assert admin_login.status_code == 200, admin_login.text
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['data']['token']}"}
        enable_result = client.put(f"/api/admin/users/{technician_id}", headers=admin_headers, json={
            "username": technician_username,
            "displayName": "联调师傅",
            "role": "TECHNICIAN",
            "phone": "13800003333",
            "buildingId": None,
            "houseId": None,
            "password": None,
            "enabled": True,
        })
        assert enable_result.status_code == 200, enable_result.text
        assert client.post("/api/auth/login", json={
            "username": technician_username, "password": "Tech@123456", "loginType": "TECHNICIAN",
        }).status_code == 200
    finally:
        with SessionLocal() as db:
            usernames = {owner_username, technician_username, f"duplicate_{marker}"}
            outbox_items = db.scalars(select(NotificationOutbox).where(NotificationOutbox.event_type == "USER_REGISTERED")).all()
            for item in outbox_items:
                if item.payload.get("username") in usernames:
                    db.delete(item)
            if owner_id:
                db.execute(delete(User).where(User.id == owner_id))
            if technician_id:
                db.execute(delete(User).where(User.id == technician_id))
            if house_id:
                db.execute(delete(House).where(House.id == house_id))
            if building_id:
                db.execute(delete(Building).where(Building.id == building_id))
            db.commit()

from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app


def admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/admin/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_admin_requires_login() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/dashboard")
        assert response.status_code == 401


def test_admin_product_activity_order_and_audit_closed_loop() -> None:
    with TestClient(app) as client:
        headers = admin_headers(client)

        product_payload = {
            "name": "后台联调测试用品",
            "category": "用品",
            "subtitle": "验证商品完整 CRUD",
            "price": "12.80",
            "original_price": "15.80",
            "stock": 20,
            "image_key": "food",
            "badge": "联调",
            "tags": ["CRUD", "MySQL"],
            "species": None,
            "age": None,
            "health": None,
            "size": "测试规格",
            "gender": None,
            "care_advice": "测试数据",
            "is_active": True,
        }
        created = client.post("/api/v1/admin/products", headers=headers, json=product_payload)
        assert created.status_code == 200
        product_id = created.json()["id"]

        product_payload["stock"] = 21
        updated = client.put(
            f"/api/v1/admin/products/{product_id}",
            headers=headers,
            json=product_payload,
        )
        assert updated.json()["stock"] == 21

        deleted = client.delete(f"/api/v1/admin/products/{product_id}", headers=headers)
        assert deleted.status_code == 200
        assert deleted.json()["is_active"] is False

        now = datetime.now()
        activity = client.post(
            "/api/v1/admin/lottery/activities",
            headers=headers,
            json={
                "title": "管理后台测试活动",
                "subtitle": "验证活动创建与发布",
                "registration_start_at": (now - timedelta(minutes=1)).isoformat(),
                "registration_end_at": (now + timedelta(days=2)).isoformat(),
                "draw_at": (now + timedelta(days=3)).isoformat(),
                "prizes": [{"level": "一等奖", "name": "优惠券", "quantity": 1}],
                "rules": ["免费报名", "到点开奖"],
            },
        )
        assert activity.status_code == 200
        activity_id = activity.json()["id"]
        published = client.post(
            f"/api/v1/admin/lottery/activities/{activity_id}/publish",
            headers=headers,
        )
        assert published.json()["status"] == "REGISTERING"

        order = client.post(
            "/api/v1/orders",
            json={
                "product_id": 1,
                "quantity": 1,
                "use_coupon": False,
                "address_name": "联调用户",
                "address_phone": "13800001234",
                "address_detail": "本地测试地址",
            },
        )
        order_id = order.json()["id"]
        paid = client.post(f"/api/v1/payments/local/{order_id}")
        assert paid.json()["status"] == "PAID"
        shipped = client.put(
            f"/api/v1/admin/orders/{order_id}/shipment",
            headers=headers,
            json={"shipping_company": "顺丰速运", "tracking_no": "SF1234567890"},
        )
        assert shipped.json()["status"] == "SHIPPED"

        dashboard = client.get("/api/v1/admin/dashboard", headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()["product_count"] >= 7
        assert dashboard.json()["order_count"] >= 1

        audits = client.get("/api/v1/admin/audit-logs", headers=headers)
        assert {item["action"] for item in audits.json()} >= {
            "CREATE",
            "UPDATE",
            "DELETE",
            "PUBLISH",
            "SHIP",
        }

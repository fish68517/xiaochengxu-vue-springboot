from fastapi.testclient import TestClient

from app.main import app


def admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def user_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"username": "user", "password": "user123"})
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_admin_requires_database_role() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/admin/dashboard").status_code == 401
        assert (
            client.get("/api/v1/admin/dashboard", headers=user_headers(client)).status_code == 403
        )


def test_admin_product_user_payment_order_and_audit_closed_loop() -> None:
    with TestClient(app) as client:
        headers = admin_headers(client)
        categories = client.get("/api/v1/admin/categories", headers=headers).json()
        category_id = categories[0]["id"]
        product_payload = {
            "name": "后台 CRUD 测试商品",
            "category": "用品",
            "category_id": category_id,
            "subtitle": "验证数据库闭环",
            "price": "12.80",
            "original_price": "15.80",
            "stock": 20,
            "image_key": "food",
            "cover_url": None,
            "detail_images": [],
            "badge": "联调",
            "tags": ["CRUD", "MySQL"],
            "species": None,
            "age": None,
            "health": None,
            "size": "测试规格",
            "gender": None,
            "care_advice": "自动化测试",
            "is_active": True,
        }
        created = client.post("/api/v1/admin/products", headers=headers, json=product_payload)
        assert created.status_code == 200
        product_id = created.json()["id"]
        product_payload["stock"] = 21
        assert (
            client.put(
                f"/api/v1/admin/products/{product_id}", headers=headers, json=product_payload
            ).json()["stock"]
            == 21
        )
        assert (
            client.delete(f"/api/v1/admin/products/{product_id}", headers=headers).json()[
                "is_active"
            ]
            is False
        )

        users = client.get("/api/v1/admin/users", headers=headers)
        assert users.status_code == 200
        assert {user["username"] for user in users.json()} >= {"user", "other"}

        regular_headers = user_headers(client)
        product = client.get("/api/v1/products").json()[0]
        cart = client.post(
            "/api/v1/cart/items",
            headers=regular_headers,
            json={"product_id": product["id"], "quantity": 1},
        ).json()
        address = client.get("/api/v1/addresses", headers=regular_headers).json()[0]
        selection = {
            "cart_item_ids": [cart["id"]],
            "address_id": address["id"],
            "user_coupon_id": None,
        }
        order = client.post("/api/v1/orders", headers=regular_headers, json=selection).json()
        payment = client.post(
            f"/api/v1/orders/{order['id']}/payment-request", headers=regular_headers
        ).json()

        listed_payments = client.get("/api/v1/admin/payments", headers=headers)
        assert listed_payments.status_code == 200
        assert any(item["id"] == payment["id"] for item in listed_payments.json())
        confirmed = client.put(f"/api/v1/admin/payments/{payment['id']}/confirm", headers=headers)
        assert confirmed.json()["status"] == "SUCCESS"
        assert (
            client.put(f"/api/v1/admin/payments/{payment['id']}/confirm", headers=headers).json()[
                "status"
            ]
            == "SUCCESS"
        )

        shipped = client.put(
            f"/api/v1/admin/orders/{order['id']}/shipment",
            headers=headers,
            json={"shipping_company": "顺丰速运", "tracking_no": "SF1234567890"},
        )
        assert shipped.json()["status"] == "SHIPPED"
        assert (
            client.get(f"/api/v1/orders/{order['id']}", headers=regular_headers).json()[
                "tracking_no"
            ]
            == "SF1234567890"
        )

        dashboard = client.get("/api/v1/admin/dashboard", headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()["paid_order_count"] >= 1
        actions = {
            item["action"]
            for item in client.get("/api/v1/admin/audit-logs", headers=headers).json()
        }
        assert {"CREATE", "UPDATE", "DELETE", "CONFIRM", "SHIP"} <= actions

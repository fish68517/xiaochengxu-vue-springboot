from fastapi.testclient import TestClient

from app.main import app


def login(client: TestClient, username: str = "user", password: str = "user123") -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_health_products_and_database_login() -> None:
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"
        assert (
            client.post(
                "/api/v1/auth/login", json={"username": "user", "password": "wrong123"}
            ).status_code
            == 401
        )
        headers = login(client)
        assert client.get("/api/v1/auth/me", headers=headers).json()["username"] == "user"
        products = client.get("/api/v1/products").json()
        assert products[0]["name"] == "数据库联调商品"
        categories = client.get("/api/v1/categories").json()
        assert categories[0]["name"] == "用品"


def test_cart_address_coupon_order_payment_and_cancel_closed_loop() -> None:
    with TestClient(app) as client:
        headers = login(client)
        product = client.get("/api/v1/products").json()[0]
        added = client.post(
            "/api/v1/cart/items", headers=headers, json={"product_id": product["id"], "quantity": 2}
        )
        assert added.status_code == 200
        cart_item = added.json()
        assert client.get("/api/v1/cart", headers=headers).json()[0]["quantity"] == 2

        address = client.get("/api/v1/addresses", headers=headers).json()[0]
        coupon = client.get("/api/v1/coupons/available", headers=headers).json()[0]
        selection = {
            "cart_item_ids": [cart_item["id"]],
            "address_id": address["id"],
            "user_coupon_id": coupon["user_coupon_id"],
            "remark": "服务端金额测试",
        }
        preview = client.post("/api/v1/orders/preview", headers=headers, json=selection)
        assert preview.status_code == 200
        assert preview.json()["subtotal"] == "78.00"
        assert preview.json()["discount"] == "10.00"
        assert preview.json()["total_amount"] == "68.00"

        created = client.post("/api/v1/orders", headers=headers, json=selection)
        assert created.status_code == 200
        order = created.json()
        assert order["total_amount"] == "68.00"
        assert len(order["items"]) == 1
        assert client.get("/api/v1/cart", headers=headers).json() == []

        payment = client.post(f"/api/v1/orders/{order['id']}/payment-request", headers=headers)
        assert payment.status_code == 200
        assert payment.json()["status"] == "PENDING"
        assert (
            client.post(f"/api/v1/orders/{order['id']}/payment-request", headers=headers).json()[
                "id"
            ]
            == payment.json()["id"]
        )

        cancelled = client.post(f"/api/v1/orders/{order['id']}/cancel", headers=headers)
        assert cancelled.json()["status"] == "CANCELLED"
        assert (
            client.get("/api/v1/coupons/available", headers=headers).json()[0]["status"]
            == "AVAILABLE"
        )


def test_user_data_isolation_and_real_lottery_count() -> None:
    with TestClient(app) as client:
        user_headers = login(client)
        other_headers = login(client, "other", "other123")
        product_id = client.get("/api/v1/products").json()[0]["id"]
        client.post(
            "/api/v1/cart/items",
            headers=user_headers,
            json={"product_id": product_id, "quantity": 1},
        )
        assert client.get("/api/v1/cart", headers=other_headers).json() == []
        assert client.get("/api/v1/addresses", headers=other_headers).json() == []

        activity = client.get("/api/v1/lottery/activities/current", headers=user_headers).json()
        joined = client.post(
            f"/api/v1/lottery/activities/{activity['id']}/join", headers=user_headers
        )
        assert joined.json()["participant_count"] == 1
        repeated = client.post(
            f"/api/v1/lottery/activities/{activity['id']}/join", headers=user_headers
        )
        assert repeated.json()["already_joined"] is True
        assert repeated.json()["participant_count"] == 1

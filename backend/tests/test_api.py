from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_products_and_activity() -> None:
    with TestClient(app) as client:
        products = client.get("/api/v1/products").json()
        assert len(products) >= 6
        assert {item["category"] for item in products} == {"爬宠", "用品", "套餐"}
        activity = client.get("/api/v1/lottery/activities/current").json()
        assert activity["status"] == "REGISTERING"


def test_order_amount_comes_from_server() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/orders",
            json={
                "product_id": 1,
                "quantity": 1,
                "use_coupon": True,
                "address_name": "张小萌",
                "address_phone": "13800001234",
                "address_detail": "广东省深圳市南山区科技园路创新大厦B座1202室",
            },
        )
        assert response.status_code == 200
        assert response.json()["total_amount"] == "9.00"

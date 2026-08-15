"""Regression and edge-case API tests for the getsub storefront."""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values


frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from the environment and frontend/.env")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

backend_env = dotenv_values("/app/backend/.env")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or backend_env.get("ADMIN_PASSWORD")


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def run_id():
    return uuid.uuid4().hex[:10]


@pytest.fixture(scope="session")
def admin_token(api_client):
    if not ADMIN_PASSWORD:
        pytest.skip("ADMIN_PASSWORD unavailable; /app/memory/test_credentials.md contains no usable credentials")
    response = api_client.post(
        f"{API}/admin/login",
        json={"password": ADMIN_PASSWORD},
        headers={"X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 200 + 1}"},
    )
    if response.status_code != 200:
        pytest.fail(f"Admin authentication failed: {response.status_code} {response.text[:300]}")
    token = response.json().get("token")
    if not isinstance(token, str) or not token:
        pytest.fail("Admin login response did not contain a non-empty token")
    return token


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def products(api_client):
    response = api_client.get(f"{API}/products")
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture(scope="session")
def plans(products):
    return {
        plan["plan_id"]: (product, plan)
        for product in products
        for plan in product.get("plans", [])
    }


@pytest.fixture(scope="session")
def recharge_order(api_client, plans, run_id):
    product, plan = plans["youtube-monthly"]
    response = api_client.post(
        f"{API}/orders",
        json={
            "plan_id": plan["plan_id"],
            "delivery_type": "recharge",
            "months": 1,
            "buyer_email": f"TEST_recharge_{run_id}@example.com",
        },
    )
    assert response.status_code == 200, response.text
    order = response.json()
    assert order["service"] == product["slug"]
    return order


# Root and seeded product catalogue.
class TestCatalogue:
    def test_api_root(self, api_client):
        response = api_client.get(f"{API}/")
        assert response.status_code == 200
        assert response.json() == {"message": "Hello World"}

    def test_list_products_seeded_and_structured(self, products):
        assert isinstance(products, list)
        assert {p["slug"] for p in products} >= {"youtube", "spotify"}
        for slug in ("youtube", "spotify"):
            product = next(p for p in products if p["slug"] == slug)
            assert product["status"] == "active"
            assert isinstance(product["id"], str) and product["id"]
            assert len(product["plans"]) == 3
            assert {p["name"] for p in product["plans"]} == {"Monthly", "12 months", "Shared seat"}
            assert len(product["perks"]) >= 4
            assert len(product["faqs"]) >= 5
            assert "_id" not in product

    @pytest.mark.parametrize("slug", ["youtube", "spotify"])
    def test_get_seeded_product(self, api_client, slug):
        response = api_client.get(f"{API}/products/{slug}")
        assert response.status_code == 200
        product = response.json()
        assert product["slug"] == slug
        assert product["status"] == "active"
        assert all(isinstance(plan["price"], (int, float)) and plan["price"] > 0 for plan in product["plans"])

    def test_requested_domain_subs_product_route(self, api_client):
        response = api_client.get(f"{API}/products/domain-subs")
        assert response.status_code == 200, "Review request says /api/products/domain-subs works, but it did not"
        assert response.json()["slug"] == "domain-subs"

    def test_unknown_product_is_404(self, api_client):
        response = api_client.get(f"{API}/products/TEST-does-not-exist")
        assert response.status_code == 404
        assert response.json()["detail"] == "Product not found"


# Admin authentication, authorization, and brute-force lockout.
class TestAdminAuth:
    def test_wrong_password_is_rejected(self, api_client):
        response = api_client.post(
            f"{API}/admin/login",
            json={"password": "TEST_definitely_wrong"},
            headers={"X-Forwarded-For": "198.51.100.10"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Wrong password"

    def test_fifth_failure_locks_ip(self, api_client):
        ip = f"203.0.113.{uuid.uuid4().int % 200 + 1}"
        statuses = []
        for _ in range(5):
            response = api_client.post(
                f"{API}/admin/login",
                json={"password": "TEST_wrong_for_lockout"},
                headers={"X-Forwarded-For": ip},
            )
            statuses.append(response.status_code)
        assert statuses[:4] == [401, 401, 401, 401]
        assert statuses[4] == 429
        assert "15 minutes" in response.json()["detail"]
        blocked = api_client.post(
            f"{API}/admin/login",
            json={"password": ADMIN_PASSWORD or "unavailable"},
            headers={"X-Forwarded-For": ip},
        )
        assert blocked.status_code == 429

    def test_admin_me_with_valid_jwt(self, api_client, admin_headers):
        response = api_client.get(f"{API}/admin/me", headers=admin_headers)
        assert response.status_code == 200
        assert response.json() == {"role": "admin"}

    @pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer invalid-token"}])
    def test_admin_me_rejects_invalid_auth(self, api_client, headers):
        response = api_client.get(f"{API}/admin/me", headers=headers)
        assert response.status_code == 401
        assert isinstance(response.json().get("detail"), str)


# Notify capture and protected signup listing.
class TestNotify:
    def test_invalid_notify_email_rejected(self, api_client):
        response = api_client.post(
            f"{API}/notify", json={"product_slug": "youtube", "email": "not-an-email"}
        )
        assert response.status_code in (400, 422)
        assert "detail" in response.json()

    def test_notify_is_idempotent_and_admin_listed(self, api_client, admin_headers, run_id):
        email = f"test_notify_{run_id}@example.com"
        payload = {"product_slug": "youtube", "email": email.upper()}
        first = api_client.post(f"{API}/notify", json=payload)
        second = api_client.post(f"{API}/notify", json=payload)
        assert first.status_code == second.status_code == 200
        assert first.json() == second.json() == {"ok": True}
        listed = api_client.get(f"{API}/admin/notify-signups", headers=admin_headers)
        assert listed.status_code == 200
        matches = [s for s in listed.json() if s["email"] == email]
        assert len(matches) == 1
        assert matches[0]["product_slug"] == "youtube"
        assert "_id" not in matches[0]

    def test_notify_list_requires_admin(self, api_client):
        response = api_client.get(f"{API}/admin/notify-signups")
        assert response.status_code == 401


# Full admin product create/read/update/delete and validation.
class TestAdminProductCRUD:
    def test_create_update_delete_product_persists(self, api_client, admin_headers, run_id):
        slug = f"test-product-{run_id}"
        payload = {
            "slug": slug,
            "name": "TEST Product",
            "status": "coming_soon",
            "color": "#123456",
            "tagline": "TEST tagline",
            "hero_title": "TEST hero",
            "brief": "TEST brief",
            "from_price": 2.5,
            "official_price": 9.5,
            "highlights": ["TEST highlight"],
            "perks": [{"t": "TEST perk", "d": "TEST description"}],
            "faqs": [{"q": "TEST question?", "a": "TEST answer"}],
            "plans": [{"name": "TEST Basic", "price": 2.5, "official": 9.5}],
            "sort_order": 999,
        }
        product_id = None
        try:
            created_response = api_client.post(f"{API}/admin/products", json=payload, headers=admin_headers)
            assert created_response.status_code == 200, created_response.text
            created = created_response.json()
            product_id = created["id"]
            assert created["slug"] == slug
            assert created["plans"][0]["plan_id"].startswith(f"{slug}-")
            assert "_id" not in created

            duplicate = api_client.post(f"{API}/admin/products", json=payload, headers=admin_headers)
            assert duplicate.status_code == 400
            assert duplicate.json()["detail"] == "Slug already exists"

            fetched = api_client.get(f"{API}/products/{slug}")
            assert fetched.status_code == 200
            assert fetched.json()["name"] == "TEST Product"

            payload["name"] = "TEST Product Updated"
            payload["status"] = "active"
            updated_response = api_client.put(
                f"{API}/admin/products/{product_id}", json=payload, headers=admin_headers
            )
            assert updated_response.status_code == 200, updated_response.text
            assert updated_response.json()["name"] == "TEST Product Updated"
            persisted = api_client.get(f"{API}/products/{slug}")
            assert persisted.status_code == 200
            assert persisted.json()["name"] == "TEST Product Updated"
            assert persisted.json()["status"] == "active"
        finally:
            if product_id:
                deleted = api_client.delete(f"{API}/admin/products/{product_id}", headers=admin_headers)
                assert deleted.status_code in (200, 404)
                missing = api_client.get(f"{API}/products/{slug}")
                assert missing.status_code == 404

    def test_negative_plan_price_is_rejected(self, api_client, admin_headers, run_id):
        slug = f"test-negative-{run_id}"
        payload = {
            "slug": slug,
            "name": "TEST Negative Price",
            "plans": [{"name": "Bad plan", "price": -5, "official": -10}],
        }
        response = api_client.post(f"{API}/admin/products", json=payload, headers=admin_headers)
        if response.status_code == 200:
            api_client.delete(f"{API}/admin/products/{response.json()['id']}", headers=admin_headers)
        assert response.status_code == 422, "Negative prices must fail request validation"

    def test_product_mutations_require_admin(self, api_client, run_id):
        response = api_client.post(
            f"{API}/admin/products",
            json={"slug": f"test-noauth-{run_id}", "name": "TEST Unauthorized"},
        )
        assert response.status_code == 401


# Simulated checkout order creation, persistence, validation, and redaction.
class TestOrders:
    def test_recharge_order_create_and_get(self, api_client, recharge_order, plans):
        _, plan = plans["youtube-monthly"]
        assert recharge_order["plan_id"] == plan["plan_id"]
        assert recharge_order["delivery_type"] == "recharge"
        assert recharge_order["months"] == 1
        assert recharge_order["price"] == plan["price"]
        assert recharge_order["official"] == plan["official"]
        assert recharge_order["status"] == "awaiting_credentials"
        assert recharge_order["payment_status"] == "simulated"
        assert isinstance(recharge_order["access_token"], str) and len(recharge_order["access_token"]) >= 20
        assert "account_password" not in recharge_order
        fetched = api_client.get(f"{API}/orders/{recharge_order['access_token']}")
        assert fetched.status_code == 200
        assert fetched.json()["id"] == recharge_order["id"]
        assert fetched.json()["credentials_submitted"] is False
        assert "account_password" not in fetched.json()
        assert "_id" not in fetched.json()

    def test_shared_duration_and_total(self, api_client, plans, run_id):
        _, plan = plans["spotify-shared"]
        response = api_client.post(
            f"{API}/orders",
            json={
                "plan_id": plan["plan_id"],
                "delivery_type": "shared",
                "months": 16,
                "buyer_email": f"TEST_shared_{run_id}@example.com",
            },
        )
        assert response.status_code == 200, response.text
        order = response.json()
        assert order["delivery_type"] == "shared"
        assert order["months"] == 16
        assert order["price"] == round(plan["price"] * 16, 2)
        assert order["official"] == round(plan["official"] * 16, 2)
        assert order["status"] == "processing"

    @pytest.mark.parametrize(
        "payload, expected",
        [
            ({"plan_id": "TEST_missing", "delivery_type": "preplanned", "months": 1, "buyer_email": "TEST_user@example.com"}, 404),
            ({"plan_id": "youtube-monthly", "delivery_type": "shared", "months": 1, "buyer_email": "TEST_user@example.com"}, 400),
            ({"plan_id": "youtube-shared", "delivery_type": "shared", "months": 2, "buyer_email": "TEST_user@example.com"}, 400),
        ],
    )
    def test_invalid_order_options(self, api_client, payload, expected):
        response = api_client.post(f"{API}/orders", json=payload)
        assert response.status_code == expected
        assert isinstance(response.json().get("detail"), str)

    def test_malformed_buyer_email_is_rejected(self, api_client):
        response = api_client.post(
            f"{API}/orders",
            json={
                "plan_id": "youtube-monthly",
                "delivery_type": "preplanned",
                "months": 1,
                "buyer_email": "TEST_invalid@",
            },
        )
        assert response.status_code in (400, 422), "Malformed buyer email was accepted and an order was created"

    def test_unknown_order_is_404(self, api_client):
        response = api_client.get(f"{API}/orders/TEST_invalid_token")
        assert response.status_code == 404
        assert response.json()["detail"] == "Order not found"

    def test_credentials_only_allowed_for_recharge(self, api_client, plans, run_id):
        _, plan = plans["youtube-annual"]
        created = api_client.post(
            f"{API}/orders",
            json={
                "plan_id": plan["plan_id"],
                "delivery_type": "preplanned",
                "months": 1,
                "buyer_email": f"TEST_preplanned_{run_id}@example.com",
            },
        )
        assert created.status_code == 200
        response = api_client.post(
            f"{API}/orders/{created.json()['access_token']}/credentials",
            json={"gmail": "TEST_user@gmail.com", "account_password": "TEST_password"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "This order does not need credentials"


# Buyer/admin credentials, chat, and status integration.
class TestRechargeWorkflow:
    def test_submit_credentials_updates_status_without_buyer_password_leak(self, api_client, recharge_order):
        token = recharge_order["access_token"]
        response = api_client.post(
            f"{API}/orders/{token}/credentials",
            json={"gmail": "TEST_buyer@gmail.com", "account_password": "TEST_secret_password"},
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True}
        fetched = api_client.get(f"{API}/orders/{token}")
        assert fetched.status_code == 200
        order = fetched.json()
        assert order["gmail"] == "TEST_buyer@gmail.com"
        assert order["credentials_submitted"] is True
        assert order["status"] == "processing"
        assert "account_password" not in order

    def test_buyer_and_admin_chat_round_trip(self, api_client, admin_headers, recharge_order, run_id):
        token = recharge_order["access_token"]
        order_id = recharge_order["id"]
        buyer_text = f"TEST buyer message {run_id}"
        admin_text = f"TEST admin reply {run_id}"
        buyer_post = api_client.post(f"{API}/orders/{token}/messages", json={"text": buyer_text})
        assert buyer_post.status_code == 200
        assert buyer_post.json()["sender"] == "buyer"
        assert buyer_post.json()["text"] == buyer_text
        admin_get = api_client.get(f"{API}/admin/orders/{order_id}/messages", headers=admin_headers)
        assert admin_get.status_code == 200
        assert any(m["text"] == buyer_text and m["sender"] == "buyer" for m in admin_get.json())
        admin_post = api_client.post(
            f"{API}/admin/orders/{order_id}/messages",
            json={"text": admin_text},
            headers=admin_headers,
        )
        assert admin_post.status_code == 200
        assert admin_post.json()["sender"] == "admin"
        buyer_get = api_client.get(f"{API}/orders/{token}/messages")
        assert buyer_get.status_code == 200
        assert any(m["text"] == admin_text and m["sender"] == "admin" for m in buyer_get.json())
        assert all("_id" not in message for message in buyer_get.json())

    def test_whitespace_only_chat_is_rejected(self, api_client, recharge_order):
        response = api_client.post(
            f"{API}/orders/{recharge_order['access_token']}/messages", json={"text": "   "}
        )
        assert response.status_code == 422, "Whitespace-only messages must not be persisted"

    def test_admin_lists_order_and_updates_status(self, api_client, admin_headers, recharge_order):
        listed = api_client.get(f"{API}/admin/orders", headers=admin_headers)
        assert listed.status_code == 200
        order = next(o for o in listed.json() if o["id"] == recharge_order["id"])
        assert order["buyer_email"] == recharge_order["buyer_email"]
        assert "_id" not in order
        updated = api_client.patch(
            f"{API}/admin/orders/{recharge_order['id']}",
            json={"status": "completed"},
            headers=admin_headers,
        )
        assert updated.status_code == 200
        assert updated.json() == {"ok": True}
        persisted = api_client.get(f"{API}/orders/{recharge_order['access_token']}")
        assert persisted.status_code == 200
        assert persisted.json()["status"] == "completed"

    def test_admin_order_endpoints_require_auth(self, api_client, recharge_order):
        listed = api_client.get(f"{API}/admin/orders")
        patched = api_client.patch(
            f"{API}/admin/orders/{recharge_order['id']}", json={"status": "processing"}
        )
        assert listed.status_code == 401
        assert patched.status_code == 401

"""Public API regression tests for buyer auth, account orders, live support, and legacy order chat."""
import os
import uuid
from datetime import datetime

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient


frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or backend_env.get("ADMIN_PASSWORD")
RUN_ID = uuid.uuid4().hex[:10]
TEST_USER_IDS = []
TEST_ORDER_IDS = []
TEST_TICKET_IDS = []


def new_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def register_user(label="buyer", password="Test1234"):
    session = new_session()
    payload = {
        "name": f"TEST {label.title()} User",
        "email": f"TEST_{label}_{RUN_ID}_{uuid.uuid4().hex[:6]}@example.com".lower(),
        "password": password,
    }
    response = session.post(f"{API}/auth/register", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    TEST_USER_IDS.append(data["user_id"])
    return session, payload, data, response


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_records():
    yield
    mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")
    if not mongo_url or not db_name:
        return
    client = MongoClient(mongo_url)
    db = client[db_name]
    if TEST_TICKET_IDS:
        db.ticket_messages.delete_many({"ticket_id": {"$in": TEST_TICKET_IDS}})
        db.tickets.delete_many({"id": {"$in": TEST_TICKET_IDS}})
    if TEST_ORDER_IDS:
        db.messages.delete_many({"order_id": {"$in": TEST_ORDER_IDS}})
        db.orders.delete_many({"id": {"$in": TEST_ORDER_IDS}})
    if TEST_USER_IDS:
        db.login_attempts.delete_many({"identifier": {"$regex": RUN_ID}})
        db.users.delete_many({"user_id": {"$in": TEST_USER_IDS}})
    client.close()


@pytest.fixture(scope="session")
def buyer_account():
    return register_user("primary")


@pytest.fixture(scope="session")
def buyer_session(buyer_account):
    return buyer_account[0]


@pytest.fixture(scope="session")
def buyer_payload(buyer_account):
    return buyer_account[1]


@pytest.fixture(scope="session")
def buyer_data(buyer_account):
    return buyer_account[2]


@pytest.fixture(scope="session")
def admin_headers():
    if not ADMIN_PASSWORD:
        pytest.skip("Admin credentials are unavailable")
    response = requests.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD}, timeout=20)
    assert response.status_code == 200, response.text
    token = response.json().get("token")
    assert isinstance(token, str) and token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def youtube_plan():
    response = requests.get(f"{API}/products/youtube", timeout=20)
    assert response.status_code == 200, response.text
    product = response.json()
    plan = next(item for item in product["plans"] if item["plan_id"] == "youtube-monthly")
    return product, plan


@pytest.fixture(scope="session")
def recharge_order(buyer_session, buyer_data, youtube_plan):
    product, plan = youtube_plan
    response = buyer_session.post(
        f"{API}/orders",
        json={"plan_id": plan["plan_id"], "delivery_type": "recharge", "months": 1},
    )
    assert response.status_code == 200, response.text
    order = response.json()
    TEST_ORDER_IDS.append(order["id"])
    assert order["user_id"] == buyer_data["user_id"]
    assert order["buyer_email"] == buyer_data["email"]
    assert order["service"] == product["slug"]
    return order


# Buyer registration, cookie sessions, login validation, refresh, logout, and lockout.
class TestBuyerAuth:
    def test_register_logs_in_and_sets_secure_httponly_cookies(self, buyer_account):
        session, payload, data, response = buyer_account
        assert data == {
            "user_id": data["user_id"],
            "email": payload["email"],
            "name": payload["name"],
            "picture": None,
        }
        set_cookie = response.headers.get("Set-Cookie", "").lower()
        assert "access_token=" in set_cookie and "refresh_token=" in set_cookie
        assert set_cookie.count("httponly") >= 2
        assert set_cookie.count("secure") >= 2
        assert set_cookie.count("samesite=none") >= 2
        me = session.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == payload["email"]

    def test_password_hash_uses_bcrypt_2b(self, buyer_data):
        mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")
        client = MongoClient(mongo_url)
        user = client[db_name].users.find_one({"user_id": buyer_data["user_id"]})
        client.close()
        assert isinstance(user["password_hash"], str)
        assert user["password_hash"].startswith("$2b$")

    def test_duplicate_email_registration_is_clear_400(self, buyer_payload):
        response = requests.post(f"{API}/auth/register", json=buyer_payload, timeout=20)
        assert response.status_code == 400
        assert response.json()["detail"] == "An account with this email already exists"

    @pytest.mark.parametrize(
        "payload",
        [
            {"name": "TEST Short", "email": f"short_{RUN_ID}@example.com", "password": "12345"},
            {"name": "TEST Bad Email", "email": "not-an-email", "password": "Test1234"},
        ],
    )
    def test_registration_validation(self, payload):
        response = requests.post(f"{API}/auth/register", json=payload, timeout=20)
        assert response.status_code == 422
        assert isinstance(response.json().get("detail"), list)

    def test_email_password_sign_in(self, buyer_payload):
        session = new_session()
        response = session.post(
            f"{API}/auth/login",
            json={"email": buyer_payload["email"].upper(), "password": buyer_payload["password"]},
        )
        assert response.status_code == 200, response.text
        assert response.json()["email"] == buyer_payload["email"]
        assert session.get(f"{API}/auth/me").status_code == 200

    def test_wrong_password_is_401_then_fifth_failure_is_429(self):
        _, payload, _, _ = register_user("lockout")
        statuses = []
        for _ in range(5):
            response = requests.post(
                f"{API}/auth/login",
                json={"email": payload["email"], "password": "Wrong1234"},
                timeout=20,
            )
            statuses.append(response.status_code)
            if response.status_code == 401:
                assert response.json()["detail"] == "Invalid email or password"
        assert statuses[:4] == [401, 401, 401, 401]
        assert statuses[4] == 429
        assert "15 minutes" in response.json()["detail"]

    def test_refresh_reissues_access_cookie(self, buyer_payload):
        session = new_session()
        login = session.post(f"{API}/auth/login", json={"email": buyer_payload["email"], "password": buyer_payload["password"]})
        assert login.status_code == 200
        for cookie in list(session.cookies):
            if cookie.name == "access_token":
                session.cookies.clear(cookie.domain, cookie.path, cookie.name)
        assert session.get(f"{API}/auth/me").status_code == 401
        refreshed = session.post(f"{API}/auth/refresh")
        assert refreshed.status_code == 200, refreshed.text
        assert refreshed.json()["email"] == buyer_payload["email"]
        assert session.get(f"{API}/auth/me").status_code == 200

    def test_logout_clears_session(self, buyer_payload):
        session = new_session()
        assert session.post(f"{API}/auth/login", json={"email": buyer_payload["email"], "password": buyer_payload["password"]}).status_code == 200
        response = session.post(f"{API}/auth/logout", json={})
        assert response.status_code == 200
        assert response.json() == {"ok": True}
        assert session.get(f"{API}/auth/me").status_code == 401

    def test_fake_google_session_is_rejected(self):
        response = requests.post(f"{API}/auth/google/session", json={"session_id": "TEST_invalid_session"}, timeout=20)
        assert response.status_code == 401
        assert response.json()["detail"] == "Could not verify Google session"


# Credentialed CORS and authenticated account order ownership.
class TestAccountOrders:
    def test_cors_preflight_supports_credentials_for_public_origin(self):
        response = requests.options(
            f"{API}/auth/me",
            headers={
                "Origin": BASE_URL,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type",
            },
            timeout=20,
        )
        assert response.status_code in (200, 204)
        assert response.headers.get("access-control-allow-credentials") == "true"
        assert response.headers.get("access-control-allow-origin") == BASE_URL

    def test_order_create_requires_login(self, youtube_plan):
        _, plan = youtube_plan
        response = requests.post(
            f"{API}/orders",
            json={"plan_id": plan["plan_id"], "delivery_type": "preplanned", "months": 1},
            timeout=20,
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_authenticated_order_derives_buyer_and_persists(self, buyer_session, buyer_data, recharge_order):
        assert recharge_order["buyer_email"] == buyer_data["email"]
        assert recharge_order["user_id"] == buyer_data["user_id"]
        assert "account_password" not in recharge_order and "_id" not in recharge_order
        fetched = requests.get(f"{API}/orders/{recharge_order['access_token']}", timeout=20)
        assert fetched.status_code == 200
        assert fetched.json()["id"] == recharge_order["id"]
        mine = buyer_session.get(f"{API}/my/orders")
        assert mine.status_code == 200
        match = next(order for order in mine.json() if order["id"] == recharge_order["id"])
        assert match["buyer_email"] == buyer_data["email"]
        assert match["access_token"] == recharge_order["access_token"]

    def test_my_orders_is_auth_required_and_isolated(self, recharge_order):
        assert requests.get(f"{API}/my/orders", timeout=20).status_code == 401
        other_session, _, other_data, _ = register_user("isolated")
        response = other_session.get(f"{API}/my/orders")
        assert response.status_code == 200
        assert all(order["user_id"] == other_data["user_id"] for order in response.json())
        assert recharge_order["id"] not in {order["id"] for order in response.json()}


# Buyer/admin support ticket round trip, status changes, and access control.
class TestLiveSupportTickets:
    def test_ticket_round_trip_and_status_toggle(self, buyer_session, buyer_data, admin_headers):
        buyer_text = f"TEST buyer support {RUN_ID} {datetime.utcnow().isoformat()}"
        admin_text = f"TEST admin support {RUN_ID}"
        created = buyer_session.post(f"{API}/tickets/mine/messages", json={"text": buyer_text})
        assert created.status_code == 200, created.text
        buyer_message = created.json()
        assert buyer_message["sender"] == "buyer" and buyer_message["text"] == buyer_text

        ticket_response = buyer_session.get(f"{API}/tickets/mine")
        assert ticket_response.status_code == 200
        ticket = ticket_response.json()
        TEST_TICKET_IDS.append(ticket["id"])
        assert ticket["user_id"] == buyer_data["user_id"]
        assert ticket["buyer_email"] == buyer_data["email"]
        assert ticket["status"] == "open"

        listed = requests.get(f"{API}/admin/tickets", headers=admin_headers, timeout=20)
        assert listed.status_code == 200
        listed_ticket = next(item for item in listed.json() if item["id"] == ticket["id"])
        assert listed_ticket["last_message_sender"] == "buyer"

        admin_history = requests.get(f"{API}/admin/tickets/{ticket['id']}/messages", headers=admin_headers, timeout=20)
        assert admin_history.status_code == 200
        assert any(msg["sender"] == "buyer" and msg["text"] == buyer_text for msg in admin_history.json())

        replied = requests.post(
            f"{API}/admin/tickets/{ticket['id']}/messages",
            json={"text": admin_text},
            headers=admin_headers,
            timeout=20,
        )
        assert replied.status_code == 200, replied.text
        assert replied.json()["sender"] == "admin" and replied.json()["text"] == admin_text

        buyer_history = buyer_session.get(f"{API}/tickets/mine/messages")
        assert buyer_history.status_code == 200
        assert any(msg["sender"] == "admin" and msg["text"] == admin_text for msg in buyer_history.json())
        assert all("_id" not in msg for msg in buyer_history.json())

        resolved = requests.patch(
            f"{API}/admin/tickets/{ticket['id']}",
            json={"status": "resolved"},
            headers=admin_headers,
            timeout=20,
        )
        assert resolved.status_code == 200 and resolved.json() == {"ok": True}
        assert buyer_session.get(f"{API}/tickets/mine").json()["status"] == "resolved"

        reopened = requests.patch(
            f"{API}/admin/tickets/{ticket['id']}",
            json={"status": "open"},
            headers=admin_headers,
            timeout=20,
        )
        assert reopened.status_code == 200
        assert buyer_session.get(f"{API}/tickets/mine").json()["status"] == "open"

    def test_ticket_endpoints_require_correct_role(self, buyer_session, admin_headers):
        assert requests.get(f"{API}/tickets/mine/messages", timeout=20).status_code == 401
        assert requests.get(f"{API}/admin/tickets", timeout=20).status_code == 401
        unknown = requests.post(
            f"{API}/admin/tickets/TEST_missing/messages",
            json={"text": "TEST hello"},
            headers=admin_headers,
            timeout=20,
        )
        assert unknown.status_code == 404
        assert unknown.json()["detail"] == "Ticket not found"

    def test_whitespace_support_message_is_rejected(self, buyer_session):
        response = buyer_session.post(f"{API}/tickets/mine/messages", json={"text": "   "})
        assert response.status_code == 422
        assert isinstance(response.json().get("detail"), list)


# Existing order-token credentials and chat remain separate from account support tickets.
class TestLegacyOrderTokenChat:
    def test_recharge_credentials_and_order_chat_still_work(self, buyer_session, recharge_order, admin_headers):
        credentials = buyer_session.post(
            f"{API}/orders/{recharge_order['access_token']}/credentials",
            json={"gmail": f"TEST_{RUN_ID}@gmail.com", "account_password": "TEST_secret"},
        )
        assert credentials.status_code == 200
        assert credentials.json() == {"ok": True}

        buyer_text = f"TEST order OTP {RUN_ID}"
        admin_text = f"TEST order reply {RUN_ID}"
        buyer_post = requests.post(
            f"{API}/orders/{recharge_order['access_token']}/messages",
            json={"text": buyer_text},
            timeout=20,
        )
        assert buyer_post.status_code == 200
        assert buyer_post.json()["sender"] == "buyer"

        admin_get = requests.get(
            f"{API}/admin/orders/{recharge_order['id']}/messages",
            headers=admin_headers,
            timeout=20,
        )
        assert any(msg["text"] == buyer_text for msg in admin_get.json())
        admin_post = requests.post(
            f"{API}/admin/orders/{recharge_order['id']}/messages",
            json={"text": admin_text},
            headers=admin_headers,
            timeout=20,
        )
        assert admin_post.status_code == 200
        buyer_get = requests.get(f"{API}/orders/{recharge_order['access_token']}/messages", timeout=20)
        assert any(msg["sender"] == "admin" and msg["text"] == admin_text for msg in buyer_get.json())

    def test_old_support_endpoints_are_removed(self):
        assert requests.get(f"{API}/support", timeout=20).status_code in (404, 405)
        assert requests.get(f"{API}/admin/support", timeout=20).status_code in (404, 405)

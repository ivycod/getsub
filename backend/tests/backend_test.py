"""Backend API tests for getsub storefront."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    # fallback for local runs — read from frontend/.env
    from pathlib import Path
    envp = Path("/app/frontend/.env")
    for line in envp.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_PASSWORD = "admin-getsub-2026"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ------- Products / seed -------
def test_list_products_seeded(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    data = r.json()
    slugs = {p["slug"] for p in data}
    assert "youtube" in slugs and "spotify" in slugs


def test_get_product_youtube(s):
    r = s.get(f"{API}/products/youtube")
    assert r.status_code == 200
    p = r.json()
    assert p["slug"] == "youtube"
    assert p["status"] == "active"
    assert len(p["plans"]) >= 1
    assert len(p["perks"]) >= 1
    assert len(p["faqs"]) >= 1


def test_get_product_404(s):
    r = s.get(f"{API}/products/does-not-exist")
    assert r.status_code == 404


# ------- Notify signup -------
def test_notify_invalid_email(s):
    r = s.post(f"{API}/notify", json={"product_slug": "youtube", "email": "notanemail"})
    assert r.status_code in (400, 422)


def test_notify_valid_email(s):
    r = s.post(f"{API}/notify", json={"product_slug": "youtube", "email": "TEST_notify@example.com"})
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ------- Admin auth -------
def test_admin_login_wrong(s):
    r = s.post(f"{API}/admin/login", json={"password": "WRONG-PASSWORD"})
    assert r.status_code in (401, 429)


def test_admin_me(admin_headers, s):
    r = s.get(f"{API}/admin/me", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_admin_unauthorized(s):
    r = s.get(f"{API}/admin/me")
    assert r.status_code == 401


# ------- Admin products CRUD -------
def test_admin_product_crud(s, admin_headers):
    slug = f"test-prod-{int(time.time())}"
    payload = {
        "slug": slug, "name": "TEST Product", "status": "coming_soon",
        "color": "#000000", "tagline": "t", "hero_title": "h", "brief": "b",
        "from_price": 1.0, "official_price": 2.0,
        "highlights": ["a"],
        "perks": [{"t": "p"}],
        "faqs": [{"q": "q", "a": "a"}],
        "plans": [{"name": "Basic", "price": 1.0, "official": 2.0}],
        "sort_order": 99,
    }
    r = s.post(f"{API}/admin/products", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    created = r.json()
    pid = created["id"]

    # GET
    r = s.get(f"{API}/products/{slug}")
    assert r.status_code == 200
    assert r.json()["name"] == "TEST Product"

    # UPDATE
    payload["name"] = "TEST Product Updated"
    payload["status"] = "active"
    r = s.put(f"{API}/admin/products/{pid}", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "TEST Product Updated"

    r = s.get(f"{API}/products/{slug}")
    assert r.json()["name"] == "TEST Product Updated"

    # DELETE
    r = s.delete(f"{API}/admin/products/{pid}", headers=admin_headers)
    assert r.status_code == 200
    r = s.get(f"{API}/products/{slug}")
    assert r.status_code == 404


# ------- Orders (simulated) -------
@pytest.fixture(scope="session")
def created_order(s):
    r = s.post(f"{API}/orders", json={
        "plan_id": "youtube-monthly",
        "delivery_type": "recharge",
        "months": 1,
        "buyer_email": "TEST_buyer@example.com",
    })
    assert r.status_code == 200, r.text
    return r.json()


def test_order_invalid_email(s):
    r = s.post(f"{API}/orders", json={
        "plan_id": "youtube-monthly", "delivery_type": "preplanned",
        "months": 1, "buyer_email": "bad",
    })
    assert r.status_code in (400, 422)


def test_order_unknown_plan(s):
    r = s.post(f"{API}/orders", json={
        "plan_id": "does-not-exist", "delivery_type": "preplanned",
        "months": 1, "buyer_email": "TEST_a@example.com",
    })
    assert r.status_code == 404


def test_order_created_simulated(created_order):
    assert created_order["payment_status"] == "simulated"
    assert created_order["status"] == "awaiting_credentials"
    assert "access_token" in created_order
    assert "account_password" not in created_order  # never leaked


def test_get_order_by_token(s, created_order):
    r = s.get(f"{API}/orders/{created_order['access_token']}")
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == created_order["id"]
    assert d["credentials_submitted"] is False


def test_admin_orders_list_contains_new(s, admin_headers, created_order):
    r = s.get(f"{API}/admin/orders", headers=admin_headers)
    assert r.status_code == 200
    ids = {o["id"] for o in r.json()}
    assert created_order["id"] in ids


# ------- Recharge flow: credentials + chat -------
def test_submit_credentials_and_chat(s, created_order):
    tok = created_order["access_token"]
    r = s.post(f"{API}/orders/{tok}/credentials", json={
        "gmail": "TEST_buyer@gmail.com", "account_password": "hunter2",
    })
    assert r.status_code == 200

    # gmail persisted, password never leaked
    r = s.get(f"{API}/orders/{tok}")
    d = r.json()
    assert d["gmail"] == "TEST_buyer@gmail.com"
    assert d["credentials_submitted"] is True
    assert "account_password" not in d
    assert d["status"] == "processing"

    # post buyer message
    r = s.post(f"{API}/orders/{tok}/messages", json={"text": "hello"})
    assert r.status_code == 200
    msg = r.json()
    assert msg["sender"] == "buyer"

    # get messages
    r = s.get(f"{API}/orders/{tok}/messages")
    assert r.status_code == 200
    assert any(m["text"] == "hello" for m in r.json())


# ------- Notify signups admin list -------
def test_admin_notify_signups(s, admin_headers):
    r = s.get(f"{API}/admin/notify-signups", headers=admin_headers)
    assert r.status_code == 200
    emails = [x["email"] for x in r.json()]
    assert "test_notify@example.com" in emails


# ------- Buyer auth (merged branch) -------
BUYER_EMAIL = "buyer1@test.com"
BUYER_PASSWORD = "pass12345"


@pytest.fixture(scope="session")
def buyer_session():
    """Session with httpOnly cookies for buyer1@test.com. Creates account if missing."""
    sess = requests.Session()
    # Try login first
    r = sess.post(f"{API}/auth/login", json={"email": BUYER_EMAIL, "password": BUYER_PASSWORD})
    if r.status_code != 200:
        # Register
        r = sess.post(f"{API}/auth/register", json={"email": BUYER_EMAIL, "password": BUYER_PASSWORD, "name": "Buyer One"})
        assert r.status_code == 200, f"buyer register failed: {r.status_code} {r.text}"
    return sess


def test_auth_register_duplicate_or_login(buyer_session):
    # buyer_session already created — a fresh register should fail with 400
    r = requests.post(f"{API}/auth/register", json={"email": BUYER_EMAIL, "password": BUYER_PASSWORD, "name": "Dup"})
    assert r.status_code == 400


def test_auth_me_returns_user(buyer_session):
    r = buyer_session.get(f"{API}/auth/me")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["email"] == BUYER_EMAIL
    assert "password_hash" not in d


def test_auth_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": BUYER_EMAIL, "password": "wrong-password-xx"})
    assert r.status_code in (401, 429)


def test_auth_me_unauthenticated():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_google_session_bad_session_id():
    r = requests.post(f"{API}/auth/google/session", json={"session_id": "invalid-session-id-xyz"})
    assert r.status_code == 401


# ------- Support tickets (buyer + admin) -------
def test_buyer_tickets_empty_initially(buyer_session):
    # Fresh buyer may or may not have ticket yet; endpoint should return list (possibly [])
    r = buyer_session.get(f"{API}/tickets/mine/messages")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_buyer_tickets_requires_auth():
    r = requests.get(f"{API}/tickets/mine/messages")
    assert r.status_code == 401


def test_buyer_send_ticket_message(buyer_session):
    r = buyer_session.post(f"{API}/tickets/mine/messages", json={"text": "TEST support hello"})
    assert r.status_code == 200, r.text
    msg = r.json()
    assert msg["sender"] == "buyer"
    assert msg["text"] == "TEST support hello"

    # verify GET returns it
    r = buyer_session.get(f"{API}/tickets/mine/messages")
    assert r.status_code == 200
    assert any(m["text"] == "TEST support hello" for m in r.json())


def test_admin_lists_ticket(s, admin_headers, buyer_session):
    r = s.get(f"{API}/admin/tickets", headers=admin_headers)
    assert r.status_code == 200
    tickets = r.json()
    assert any(t.get("buyer_email") == BUYER_EMAIL for t in tickets)


def test_admin_reply_to_ticket(s, admin_headers, buyer_session):
    r = s.get(f"{API}/admin/tickets", headers=admin_headers)
    ticket = next(t for t in r.json() if t.get("buyer_email") == BUYER_EMAIL)
    tid = ticket["id"]
    r = s.post(f"{API}/admin/tickets/{tid}/messages", json={"text": "TEST admin reply"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["sender"] == "admin"

    # buyer sees it
    r = buyer_session.get(f"{API}/tickets/mine/messages")
    assert any(m["text"] == "TEST admin reply" and m["sender"] == "admin" for m in r.json())


def test_auth_logout(buyer_session):
    r = buyer_session.post(f"{API}/auth/logout")
    assert r.status_code == 200
    # after logout, me should be 401 (cookies cleared on same session)
    r = buyer_session.get(f"{API}/auth/me")
    assert r.status_code == 401

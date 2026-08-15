"""Targeted iteration 8 tests for CORS, session refresh, duplicate races, and auth/ticket smoke."""
import concurrent.futures
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
PUBLIC_ORIGIN = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
PUBLIC_API = f"{PUBLIC_ORIGIN}/api"
DIRECT_API = "http://localhost:8001/api"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or backend_env.get("ADMIN_PASSWORD")
RUN_ID = uuid.uuid4().hex[:10]
created_user_ids = []
created_order_ids = []
created_ticket_ids = []


def register(email=None):
    session = requests.Session()
    payload = {
        "name": "TEST Iteration 8 Buyer",
        "email": email or f"test_iter8_{RUN_ID}_{uuid.uuid4().hex[:5]}@example.com",
        "password": "Test1234",
    }
    response = session.post(f"{PUBLIC_API}/auth/register", json=payload, timeout=30)
    if response.status_code == 200:
        created_user_ids.append(response.json()["user_id"])
    return session, payload, response


@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")
    client = MongoClient(mongo_url)
    db = client[db_name]
    if created_ticket_ids:
        db.ticket_messages.delete_many({"ticket_id": {"$in": created_ticket_ids}})
        db.tickets.delete_many({"id": {"$in": created_ticket_ids}})
    if created_order_ids:
        db.orders.delete_many({"id": {"$in": created_order_ids}})
    if created_user_ids:
        db.users.delete_many({"user_id": {"$in": created_user_ids}})
    client.close()


# Backend CORS must support exact-origin credentialed requests at the FastAPI process.
class TestDirectBackendCors:
    @pytest.mark.parametrize("method", ["OPTIONS", "GET"])
    def test_auth_me_exact_origin_credentials(self, method):
        headers = {"Origin": PUBLIC_ORIGIN}
        if method == "OPTIONS":
            headers.update({"Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "content-type"})
            response = requests.options(f"{DIRECT_API}/auth/me", headers=headers, timeout=20)
            assert response.status_code in (200, 204)
        else:
            response = requests.get(f"{DIRECT_API}/auth/me", headers=headers, timeout=20)
            assert response.status_code == 401
            assert response.json() == {"detail": "Not authenticated"}
        assert response.headers.get("Access-Control-Allow-Origin") == PUBLIC_ORIGIN
        assert response.headers.get("Access-Control-Allow-Credentials") == "true"


# Buyer registration/login remain functional and duplicate races return controlled 400 errors.
class TestAuthFixes:
    def test_register_and_login_after_async_bcrypt_change(self):
        session, payload, registered = register()
        assert registered.status_code == 200, registered.text
        data = registered.json()
        assert data["email"] == payload["email"]
        assert data["name"] == payload["name"]
        login_session = requests.Session()
        logged_in = login_session.post(f"{PUBLIC_API}/auth/login", json={"email": payload["email"], "password": payload["password"]}, timeout=30)
        assert logged_in.status_code == 200, logged_in.text
        assert logged_in.json()["user_id"] == data["user_id"]
        assert login_session.get(f"{PUBLIC_API}/auth/me", timeout=20).json()["email"] == payload["email"]

    def test_simultaneous_duplicate_registration_returns_200_and_clean_400(self):
        email = f"test_race_{RUN_ID}@example.com"
        payload = {"name": "TEST Race Buyer", "email": email, "password": "Test1234"}
        barrier = __import__("threading").Barrier(2)

        def submit():
            barrier.wait(timeout=5)
            return requests.post(f"{PUBLIC_API}/auth/register", json=payload, timeout=30)

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: submit(), range(2)))
        statuses = sorted(r.status_code for r in responses)
        assert statuses == [200, 400], [(r.status_code, r.text) for r in responses]
        winner = next(r for r in responses if r.status_code == 200).json()
        created_user_ids.append(winner["user_id"])
        duplicate = next(r for r in responses if r.status_code == 400)
        assert duplicate.json() == {"detail": "An account with this email already exists"}


# Quick public-API smoke covers authenticated order persistence and buyer/admin support round trip.
class TestTargetedSmoke:
    def test_order_and_live_ticket_round_trip(self):
        buyer, payload, registered = register()
        assert registered.status_code == 200, registered.text
        product_response = requests.get(f"{PUBLIC_API}/products/youtube", timeout=20)
        assert product_response.status_code == 200
        product = product_response.json()
        plan = next(p for p in product["plans"] if p["plan_id"] == "youtube-monthly")
        created = buyer.post(f"{PUBLIC_API}/orders", json={"plan_id": plan["plan_id"], "delivery_type": "preplanned", "months": 1}, timeout=20)
        assert created.status_code == 200, created.text
        order = created.json()
        created_order_ids.append(order["id"])
        mine = buyer.get(f"{PUBLIC_API}/my/orders", timeout=20)
        assert mine.status_code == 200
        assert any(o["id"] == order["id"] and o["buyer_email"] == payload["email"] for o in mine.json())

        buyer_text = f"TEST Iter8 buyer {RUN_ID}"
        sent = buyer.post(f"{PUBLIC_API}/tickets/mine/messages", json={"text": buyer_text}, timeout=20)
        assert sent.status_code == 200, sent.text
        ticket = buyer.get(f"{PUBLIC_API}/tickets/mine", timeout=20).json()
        created_ticket_ids.append(ticket["id"])

        admin_login = requests.post(f"{PUBLIC_API}/admin/login", json={"password": ADMIN_PASSWORD}, timeout=20)
        assert admin_login.status_code == 200, admin_login.text
        headers = {"Authorization": f"Bearer {admin_login.json()['token']}"}
        admin_text = f"TEST Iter8 admin {RUN_ID}"
        reply = requests.post(f"{PUBLIC_API}/admin/tickets/{ticket['id']}/messages", json={"text": admin_text}, headers=headers, timeout=20)
        assert reply.status_code == 200, reply.text
        assert reply.json()["sender"] == "admin" and reply.json()["text"] == admin_text
        history = buyer.get(f"{PUBLIC_API}/tickets/mine/messages", timeout=20)
        assert any(m["sender"] == "admin" and m["text"] == admin_text for m in history.json())
        resolved = requests.patch(f"{PUBLIC_API}/admin/tickets/{ticket['id']}", json={"status": "resolved"}, headers=headers, timeout=20)
        assert resolved.status_code == 200 and resolved.json() == {"ok": True}
        assert buyer.get(f"{PUBLIC_API}/tickets/mine", timeout=20).json()["status"] == "resolved"

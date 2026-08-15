from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import secrets
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import jwt
import resend
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ['JWT_SECRET']
ADMIN_PASSWORD = os.environ['ADMIN_PASSWORD']
JWT_ALGORITHM = "HS256"

resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
ADMIN_NOTIFY_EMAIL = os.environ.get('ADMIN_NOTIFY_EMAIL', '')

now_iso = lambda: datetime.now(timezone.utc).isoformat()

SHARED_MONTH_OPTIONS = [3, 6, 9, 12, 16]


# ---------------- Email ----------------
async def _send_email(to: str, subject: str, html: str):
    if not resend.api_key or not to:
        return
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": f"getsub <{SENDER_EMAIL}>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logging.getLogger(__name__).info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Email to {to} failed: {e}")


def fire_email(to: str, subject: str, html: str):
    asyncio.create_task(_send_email(to, subject, html))


CHAT_NOTIFY_THROTTLE = timedelta(minutes=3)


def base_from_request(request: Request) -> str:
    return request.headers.get("origin", "").rstrip("/")


async def maybe_notify_chat(order: dict, recipient: str, text: str, base_url: str):
    """Email the other party about a new chat message, throttled per-direction to avoid flooding during active chat."""
    field = "last_notify_admin_at" if recipient == "admin" else "last_notify_buyer_at"
    now = datetime.now(timezone.utc)
    last = order.get(field)
    if last:
        try:
            if now - datetime.fromisoformat(last) < CHAT_NOTIFY_THROTTLE:
                return
        except Exception:
            pass
    await db.orders.update_one({"id": order["id"]}, {"$set": {field: now.isoformat()}})
    snippet = (text[:140] + "…") if len(text) > 140 else text
    if recipient == "admin":
        if not ADMIN_NOTIFY_EMAIL:
            return
        fire_email(
            ADMIN_NOTIFY_EMAIL,
            f"💬 New buyer message — {order['plan_name']}",
            email_shell(
                "New message from a buyer",
                f"<strong>{order['buyer_email']}</strong> just messaged you about <strong>{order['plan_name']}</strong>:<br/><br/>“{snippet}”<br/><br/>Open the admin panel to reply in the live chat.",
                "Open admin panel", f"{base_url}/admin" if base_url else "",
            ),
        )
    else:
        fire_email(
            order["buyer_email"],
            f"💬 getsub replied — {order['plan_name']}",
            email_shell(
                "You've got a new message",
                f"Our team just replied on your order <strong>{order['plan_name']}</strong>:<br/><br/>“{snippet}”<br/><br/>Open your private order page to read it and reply.",
                "Open my order", f"{base_url}/order/{order['access_token']}" if base_url else "",
            ),
        )



def email_shell(title: str, body_html: str, cta_label: str = "", cta_url: str = "") -> str:
    cta = f'<tr><td style="padding:8px 0 20px;"><a href="{cta_url}" style="display:inline-block;background:#0E6E56;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 26px;border-radius:100px;">{cta_label}</a></td></tr>' if cta_url else ""
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
      <tr><td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;padding:32px;">
          <tr><td style="font-size:20px;font-weight:800;color:#12211D;padding-bottom:6px;">get<span style="color:#0E6E56;">sub</span></td></tr>
          <tr><td style="font-size:18px;font-weight:700;color:#12211D;padding:14px 0 8px;">{title}</td></tr>
          <tr><td style="font-size:14px;color:#4A5A54;line-height:1.6;padding-bottom:16px;">{body_html}</td></tr>
          {cta}
          <tr><td style="font-size:11px;color:#9AA6A1;border-top:1px solid #E8E3D8;padding-top:14px;">One-time payments · no auto-renewal · getsub.shop</td></tr>
        </table>
      </td></tr>
    </table>"""


# ---------------- Models ----------------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class PlanIn(BaseModel):
    plan_id: str = ""
    name: str
    price: float = Field(ge=0)
    official: float = Field(ge=0)
    unit: str = "/mo"
    period_label: str = ""
    billing: str = "One-time · 1 month of access"
    desc: str = ""
    feats: List[str] = []
    featured: bool = False
    shared: bool = False
    delivery_types: List[str] = ["preplanned", "recharge"]
    delivery_label: str = "New account"
    delivery_note: str = "Login details emailed to you after a quick setup."


class PerkIn(BaseModel):
    t: str
    d: str = ""
    path: str = "M20 6 9 17l-5-5"


class FaqIn(BaseModel):
    q: str
    a: str


class ProductIn(BaseModel):
    slug: str = Field(min_length=2, max_length=40, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=2, max_length=60)
    status: Literal["active", "coming_soon"] = "active"
    color: str = "#0E6E56"
    tagline: str = ""
    hero_title: str = ""
    brief: str = ""
    from_price: float = Field(default=0, ge=0)
    official_price: float = Field(default=0, ge=0)
    highlights: List[str] = []
    perks: List[PerkIn] = []
    faqs: List[FaqIn] = []
    plans: List[PlanIn] = []
    sort_order: int = 0


class OrderCreate(BaseModel):
    plan_id: str
    delivery_type: Literal["preplanned", "recharge", "shared"]
    months: int = 1
    buyer_email: EmailStr


class CredentialsSubmit(BaseModel):
    gmail: EmailStr
    account_password: str = Field(min_length=1, max_length=200)


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("text cannot be blank")
        return stripped


class AdminLogin(BaseModel):
    password: str


class StatusUpdate(BaseModel):
    status: Literal["awaiting_credentials", "processing", "completed"]


class NotifySignup(BaseModel):
    product_slug: str = Field(min_length=2, max_length=40)
    email: str = Field(min_length=5, max_length=120)


class SupportMessageCreate(BaseModel):
    email: EmailStr
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("message cannot be blank")
        return stripped


class SupportStatusUpdate(BaseModel):
    resolved: bool


# ---------------- Admin auth ----------------
def client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        parts = [p.strip() for p in fwd.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else "unknown"


async def check_brute_force(ip: str):
    rec = await db.login_attempts.find_one({"identifier": ip})
    if rec and rec.get("count", 0) >= 5:
        locked_at = datetime.fromisoformat(rec["last_attempt"])
        if datetime.now(timezone.utc) - locked_at < timedelta(minutes=15):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
        await db.login_attempts.delete_one({"identifier": ip})


async def get_admin(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("sub") != "admin":
            raise HTTPException(status_code=401, detail="Invalid token")
        return "admin"
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@api_router.post("/admin/login")
async def admin_login(body: AdminLogin, request: Request):
    ip = client_ip(request)
    await check_brute_force(ip)
    if not secrets.compare_digest(body.password, ADMIN_PASSWORD):
        rec = await db.login_attempts.find_one_and_update(
            {"identifier": ip},
            {"$inc": {"count": 1}, "$set": {"last_attempt": now_iso()}},
            upsert=True, return_document=True,
        )
        if rec and rec.get("count", 0) >= 5:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
        raise HTTPException(status_code=401, detail="Wrong password")
    await db.login_attempts.delete_one({"identifier": ip})
    token = jwt.encode(
        {"sub": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=24)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )
    return {"token": token}


@api_router.get("/admin/me")
async def admin_me(admin: str = Depends(get_admin)):
    return {"role": "admin"}


# ---------------- Products ----------------
def product_doc_from_input(body: ProductIn, existing: Optional[dict] = None) -> dict:
    doc = body.model_dump()
    for p in doc["plans"]:
        if not p["plan_id"]:
            p["plan_id"] = f"{doc['slug']}-{uuid.uuid4().hex[:6]}"
    doc["id"] = existing["id"] if existing else str(uuid.uuid4())
    doc["created_at"] = existing["created_at"] if existing else now_iso()
    doc["updated_at"] = now_iso()
    return doc


@api_router.get("/products")
async def list_products():
    products = await db.products.find({}, {"_id": 0}).sort([("sort_order", 1), ("created_at", 1)]).to_list(100)
    return products


@api_router.get("/products/{slug}")
async def get_product(slug: str):
    product = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@api_router.post("/notify")
async def notify_signup(body: NotifySignup):
    if "@" not in body.email or "." not in body.email:
        raise HTTPException(status_code=400, detail="Invalid email")
    await db.notify_signups.update_one(
        {"product_slug": body.product_slug, "email": body.email.lower().strip()},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.post("/support")
async def create_support_message(body: SupportMessageCreate, request: Request):
    doc = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower().strip(),
        "message": body.message,
        "resolved": False,
        "created_at": now_iso(),
    }
    await db.support_messages.insert_one({**doc})
    if ADMIN_NOTIFY_EMAIL:
        base = base_from_request(request)
        fire_email(
            ADMIN_NOTIFY_EMAIL,
            "New support message",
            email_shell(
                "New support message",
                f"<strong>{doc['email']}</strong> sent a support message:<br/><br/>\u201c{doc['message'][:280]}\u201d",
                "Open admin panel", f"{base}/admin" if base else "",
            ),
        )
    return {"ok": True}


@api_router.get("/admin/support")
async def list_support_messages(admin: str = Depends(get_admin)):
    messages = await db.support_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return messages


@api_router.patch("/admin/support/{message_id}")
async def update_support_message(message_id: str, body: SupportStatusUpdate, admin: str = Depends(get_admin)):
    res = await db.support_messages.update_one({"id": message_id}, {"$set": {"resolved": body.resolved}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Support message not found")
    return {"ok": True}


@api_router.post("/admin/products")
async def create_product(body: ProductIn, admin: str = Depends(get_admin)):
    if await db.products.find_one({"slug": body.slug}):
        raise HTTPException(status_code=400, detail="Slug already exists")
    doc = product_doc_from_input(body)
    await db.products.insert_one({**doc})
    return doc


@api_router.put("/admin/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, request: Request, admin: str = Depends(get_admin)):
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    clash = await db.products.find_one({"slug": body.slug, "id": {"$ne": product_id}})
    if clash:
        raise HTTPException(status_code=400, detail="Slug already exists")
    doc = product_doc_from_input(body, existing)
    await db.products.replace_one({"id": product_id}, {**doc})
    if existing.get("status") == "coming_soon" and doc["status"] == "active":
        base = request.headers.get("origin", "").rstrip("/")
        signups = await db.notify_signups.find({"product_slug": doc["slug"]}, {"_id": 0}).to_list(1000)
        price_part = f" from ${doc['from_price']:.2f}/mo" if doc.get("from_price") else ""
        for s in signups:
            fire_email(
                s["email"],
                f"{doc['name']} is now live on getsub 🎉",
                email_shell(
                    f"{doc['name']} just launched",
                    f"You asked us to let you know — <strong>{doc['name']}</strong> is now available{price_part}.<br/><br/>{doc.get('brief', '')}",
                    "See plans", f"{base}/{doc['slug']}" if base else "",
                ),
            )
        logger.info(f"Launch emails queued for {len(signups)} signups ({doc['slug']})")
    return doc


@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: str = Depends(get_admin)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"ok": True}


@api_router.get("/admin/notify-signups")
async def list_notify_signups(admin: str = Depends(get_admin)):
    signups = await db.notify_signups.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return signups


# ---------------- Buyer: orders ----------------
def buyer_order_view(order: dict) -> dict:
    return {k: v for k, v in order.items() if k not in ("_id", "account_password")}


@api_router.post("/orders")
async def create_order(body: OrderCreate, request: Request):
    if "@" not in body.buyer_email:
        raise HTTPException(status_code=400, detail="Invalid email")
    product = await db.products.find_one({"plans.plan_id": body.plan_id})
    if not product:
        raise HTTPException(status_code=404, detail="Unknown plan")
    if product.get("status") != "active":
        raise HTTPException(status_code=400, detail="Product not available yet")
    plan = next(p for p in product["plans"] if p["plan_id"] == body.plan_id)
    if plan.get("shared"):
        if body.months not in SHARED_MONTH_OPTIONS:
            raise HTTPException(status_code=400, detail="Invalid duration")
        delivery = "shared"
        months = body.months
    else:
        if body.delivery_type not in plan.get("delivery_types", ["preplanned", "recharge"]):
            raise HTTPException(status_code=400, detail="Invalid delivery type")
        delivery = body.delivery_type
        months = 1
    qty = months if plan.get("shared") else 1
    order = {
        "id": str(uuid.uuid4()),
        "access_token": secrets.token_urlsafe(24),
        "plan_id": body.plan_id,
        "plan_name": f"{product['name']} · {plan['name']}",
        "service": product["slug"],
        "product_color": product.get("color", "#0E6E56"),
        "delivery_type": delivery,
        "months": months,
        "buyer_email": body.buyer_email.lower().strip(),
        "price": round(plan["price"] * qty, 2),
        "official": round(plan["official"] * qty, 2),
        "status": "awaiting_credentials" if delivery == "recharge" else "processing",
        "payment_status": "simulated",
        "gmail": None,
        "account_password": None,
        "last_message_at": None,
        "last_message_sender": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one({**order})

    base = request.headers.get("origin", "").rstrip("/")
    order_link = f"{base}/order/{order['access_token']}" if base else ""
    delivery_label = {"preplanned": "Pre-planned account", "recharge": "Recharge my account", "shared": "Family invite"}[delivery]
    next_step = (
        "Open your order page and submit the account details you want upgraded — a live chat with us opens right after."
        if delivery == "recharge"
        else "We're preparing your access now. Everything you need arrives by email within 10 minutes – 2 hours."
    )
    fire_email(
        order["buyer_email"],
        f"Your getsub order — {order['plan_name']}",
        email_shell(
            "Thanks — your order is in!",
            f"<strong>{order['plan_name']}</strong> · {delivery_label} · ${order['price']:.2f}<br/><br/>{next_step}<br/><br/>Keep this private link to check your order and chat with us anytime.",
            "Open my order", order_link,
        ),
    )
    if ADMIN_NOTIFY_EMAIL:
        fire_email(
            ADMIN_NOTIFY_EMAIL,
            f"New order: {order['plan_name']} (${order['price']:.2f})",
            email_shell(
                "New order received",
                f"<strong>{order['plan_name']}</strong><br/>Delivery: {delivery_label}<br/>Amount: ${order['price']:.2f}<br/>Buyer: {order['buyer_email']}<br/>Status: {order['status']}",
                "Open admin panel", f"{base}/admin" if base else "",
            ),
        )
    return buyer_order_view(order)


async def find_order_by_token(access_token: str) -> dict:
    order = await db.orders.find_one({"access_token": access_token})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@api_router.get("/orders/{access_token}")
async def get_order(access_token: str):
    order = await find_order_by_token(access_token)
    view = buyer_order_view(order)
    view["credentials_submitted"] = bool(order.get("gmail"))
    return view


@api_router.post("/orders/{access_token}/credentials")
async def submit_credentials(access_token: str, body: CredentialsSubmit, request: Request):
    order = await find_order_by_token(access_token)
    if order["delivery_type"] != "recharge":
        raise HTTPException(status_code=400, detail="This order does not need credentials")
    await db.orders.update_one(
        {"id": order["id"]},
        {"$set": {"gmail": body.gmail.strip(), "account_password": body.account_password,
                  "status": "processing", "updated_at": now_iso()}},
    )
    base = base_from_request(request)
    if ADMIN_NOTIFY_EMAIL:
        fire_email(
            ADMIN_NOTIFY_EMAIL,
            f"🔑 Credentials submitted — {order['plan_name']}",
            email_shell(
                "Buyer submitted account details",
                f"<strong>{order['buyer_email']}</strong> submitted the account they want upgraded for <strong>{order['plan_name']}</strong>.<br/><br/>Open the admin panel to process it and chat with the buyer.",
                "Open admin panel", f"{base}/admin" if base else "",
            ),
        )
    return {"ok": True}


@api_router.get("/orders/{access_token}/messages")
async def get_messages(access_token: str):
    order = await find_order_by_token(access_token)
    msgs = await db.messages.find({"order_id": order["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs


@api_router.post("/orders/{access_token}/messages")
async def post_message(access_token: str, body: MessageCreate, request: Request):
    order = await find_order_by_token(access_token)
    msg = {"id": str(uuid.uuid4()), "order_id": order["id"], "sender": "buyer",
           "text": body.text.strip(), "created_at": now_iso()}
    await db.messages.insert_one({**msg})
    await db.orders.update_one({"id": order["id"]}, {"$set": {"last_message_at": msg["created_at"], "last_message_sender": "buyer", "updated_at": now_iso()}})
    await maybe_notify_chat(order, "admin", msg["text"], base_from_request(request))
    return msg


# ---------------- Admin: orders + chat ----------------
@api_router.get("/admin/orders")
async def admin_orders(admin: str = Depends(get_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@api_router.get("/admin/orders/{order_id}/messages")
async def admin_get_messages(order_id: str, admin: str = Depends(get_admin)):
    msgs = await db.messages.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs


@api_router.post("/admin/orders/{order_id}/messages")
async def admin_post_message(order_id: str, body: MessageCreate, request: Request, admin: str = Depends(get_admin)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    msg = {"id": str(uuid.uuid4()), "order_id": order_id, "sender": "admin",
           "text": body.text.strip(), "created_at": now_iso()}
    await db.messages.insert_one({**msg})
    await db.orders.update_one({"id": order_id}, {"$set": {"last_message_at": msg["created_at"], "last_message_sender": "admin", "updated_at": now_iso()}})
    await maybe_notify_chat(order, "buyer", msg["text"], base_from_request(request))
    return msg


@api_router.patch("/admin/orders/{order_id}")
async def admin_update_status(order_id: str, body: StatusUpdate, admin: str = Depends(get_admin)):
    res = await db.orders.update_one({"id": order_id}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True}


# ---------------- Misc ----------------
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


SEED_PRODUCTS = [
    {
        "slug": "youtube", "name": "YouTube Premium", "status": "active", "color": "#FF0000",
        "tagline": "Ad-free videos, background play, and YouTube Music — from $3.49/mo.",
        "hero_title": "YouTube Premium, without the full-price bill.",
        "brief": "Ad-free YouTube with background play and YouTube Music included.",
        "from_price": 3.49, "official_price": 15.99, "sort_order": 0,
        "highlights": ["Ad-free everything", "Background play", "YouTube Music included", "Offline downloads"],
        "perks": [
            {"t": "Zero ads, anywhere", "d": "No pre-rolls, mid-rolls, or banners across the entire platform.", "path": "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M8 8l8 8"},
            {"t": "Background play", "d": "Keep videos and music playing with your screen off or in other apps.", "path": "M5 4h14v12H5z M9 20h6"},
            {"t": "YouTube Music Premium", "d": "The full music streaming app is bundled in at no extra cost.", "path": "M9 18V6l10-2v12 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"},
            {"t": "Offline downloads", "d": "Save videos and playlists to watch without a connection.", "path": "M12 3v12 M7 10l5 5 5-5 M4 20h16"},
        ],
        "faqs": [
            {"q": "Is this real YouTube Premium?", "a": "Yes — the official YouTube Premium, on the official app, with your own Google login. Nothing modified or cracked. Individual seats use regional pricing; shared seats use YouTube's official family plan."},
            {"q": "Do I get YouTube Music too?", "a": "Yes. Every YouTube Premium plan includes YouTube Music Premium — ad-free music, downloads, and background listening."},
            {"q": "What's the difference between the plans?", "a": "Monthly and 12-month plans come as a new account with login details emailed to you. The shared seat adds your existing Google account to an official family plan via an invite link — it's the cheapest per month."},
            {"q": "What if my seat gets removed?", "a": "We monitor active plans and move you to a new seat at no extra cost if one ever drops. You won't lose paid time."},
            {"q": "Does it auto-renew?", "a": "No. Every plan is a one-time payment for the period you buy. When it ends, just purchase again to continue."},
        ],
        "plans": [
            {"plan_id": "youtube-monthly", "name": "Monthly", "price": 5.49, "official": 15.99, "unit": "/mo", "period_label": "per month", "billing": "One-time · 1 month of access", "desc": "Ad-free videos, background play, and YouTube Music included.", "feats": ["Your own login", "Full app access", "No auto-renewal"], "featured": False, "shared": False, "delivery_types": ["preplanned", "recharge"], "delivery_label": "New account", "delivery_note": "Login details emailed to you after a quick setup."},
            {"plan_id": "youtube-annual", "name": "12 months", "price": 35, "official": 191.88, "unit": "/yr", "period_label": "billed once, ~$2.92/mo", "billing": "One-time · 12 months of access (~$2.92/mo)", "desc": "A full year of YouTube Premium at the lowest rate we offer.", "feats": ["Lock in the lowest rate", "Your own login", "Priority support"], "featured": True, "shared": False, "delivery_types": ["preplanned", "recharge"], "delivery_label": "New account", "delivery_note": "Login details emailed to you after a quick setup."},
            {"plan_id": "youtube-shared", "name": "Shared seat", "price": 3.49, "official": 15.99, "unit": "/mo", "period_label": "per month", "billing": "Shared seat · 1 month of access", "desc": "Full YouTube Premium through a shared family plan. Pick how many months you want.", "feats": ["Lowest monthly price", "Your own login", "No auto-renewal"], "featured": False, "shared": True, "delivery_types": [], "delivery_label": "Family invite", "delivery_note": "Invite link emailed for you to join the plan."},
        ],
    },
    {
        "slug": "spotify", "name": "Spotify Premium", "status": "active", "color": "#1DB954",
        "tagline": "Ad-free music, offline downloads, unlimited skips — from $4.49/mo.",
        "hero_title": "Spotify Premium, at a price that makes sense.",
        "brief": "Ad-free music with offline downloads and unlimited skips.",
        "from_price": 4.49, "official_price": 12.99, "sort_order": 1,
        "highlights": ["Ad-free listening", "Offline downloads", "Unlimited skips", "Highest audio quality"],
        "perks": [
            {"t": "No ads, ever", "d": "Uninterrupted listening across every playlist, album, and podcast.", "path": "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M8 8l8 8"},
            {"t": "Offline downloads", "d": "Take your library anywhere — flights, commutes, dead zones.", "path": "M12 3v12 M7 10l5 5 5-5 M4 20h16"},
            {"t": "Unlimited skips", "d": "Skip as much as you like, on any device.", "path": "M5 5v14l10-7z M17 5h2v14h-2z"},
            {"t": "Very high audio quality", "d": "Stream at Spotify's highest bitrate for noticeably better sound.", "path": "M4 12h2 M8 8v8 M12 5v14 M16 8v8 M20 12h-2"},
        ],
        "faqs": [
            {"q": "Is this real Spotify Premium?", "a": "Yes — the official Spotify Premium, on the official app, with your own login. Individual seats use regional pricing; shared seats use Spotify's official family plan."},
            {"q": "Do I keep my playlists?", "a": "On a shared seat, yes — your existing account joins the plan, so everything stays. Monthly and 12-month plans come as a new account; you can transfer playlists over with free tools in minutes."},
            {"q": "What's the difference between the plans?", "a": "Monthly and 12-month plans come as a new account with login details emailed to you. The shared seat adds your existing account to an official family plan via an invite link — it's the cheapest per month."},
            {"q": "What if my seat gets removed?", "a": "We monitor active plans and move you to a new seat at no extra cost if one ever drops. You won't lose paid time."},
            {"q": "Does it auto-renew?", "a": "No. Every plan is a one-time payment for the period you buy. When it ends, just purchase again to continue."},
        ],
        "plans": [
            {"plan_id": "spotify-monthly", "name": "Monthly", "price": 6.0, "official": 12.99, "unit": "/mo", "period_label": "per month", "billing": "One-time · 1 month of access", "desc": "Ad-free music, offline downloads, and unlimited skips.", "feats": ["Your own login", "Full app access", "No auto-renewal"], "featured": False, "shared": False, "delivery_types": ["preplanned", "recharge"], "delivery_label": "New account", "delivery_note": "Login details emailed to you after a quick setup."},
            {"plan_id": "spotify-annual", "name": "12 months", "price": 39.99, "official": 155.88, "unit": "/yr", "period_label": "billed once, ~$3.33/mo", "billing": "One-time · 12 months of access (~$3.33/mo)", "desc": "A full year of Spotify Premium at the lowest rate we offer.", "feats": ["Lock in the lowest rate", "Your own login", "Priority support"], "featured": True, "shared": False, "delivery_types": ["preplanned", "recharge"], "delivery_label": "New account", "delivery_note": "Login details emailed to you after a quick setup."},
            {"plan_id": "spotify-shared", "name": "Shared seat", "price": 4.49, "official": 12.99, "unit": "/mo", "period_label": "per month", "billing": "Shared seat · 1 month of access", "desc": "Full Spotify Premium through a shared family plan. Pick how many months you want.", "feats": ["Lowest monthly price", "Your own login", "No auto-renewal"], "featured": False, "shared": True, "delivery_types": [], "delivery_label": "Family invite", "delivery_note": "Invite link emailed for you to join the plan."},
        ],
    },
]


@app.on_event("startup")
async def startup():
    await db.orders.create_index("access_token", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.messages.create_index([("order_id", 1), ("created_at", 1)])
    await db.login_attempts.create_index("identifier")
    await db.products.create_index("slug", unique=True)
    await db.notify_signups.create_index([("product_slug", 1), ("email", 1)], unique=True)
    await db.support_messages.create_index("created_at")
    if await db.products.count_documents({}) == 0:
        for p in SEED_PRODUCTS:
            doc = {**p, "id": str(uuid.uuid4()), "created_at": now_iso(), "updated_at": now_iso()}
            await db.products.insert_one(doc)
        logger.info("Seeded default products")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

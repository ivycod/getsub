# getsub — PRD

## Problem statement
Clone https://github.com/ivycod/getsub into this environment. getsub is a subscription-reselling storefront (YouTube Premium / Spotify Premium at discounted prices) with guest checkout, an admin panel, and simulated payments.

## Architecture
- React (CRA + craco) frontend + FastAPI backend + MongoDB.
- Products are DB-driven (seeded with YouTube + Spotify on first startup, see SEED_PRODUCTS in server.py).
- `src/App.js` — landing: hero, rotating word, product cards, trust rows, FAQ.
- `src/pages/ProductPage.jsx` — `/:slug` product page (hero, perks, plans, FAQ).
- `src/pages/OrderPage.jsx` — `/order/:token` buyer order page (summary, recharge credentials form, live chat 3s polling).
- `src/pages/AdminPage.jsx` / `AdminProducts.jsx` — `/admin`: orders + chat + status, product CRUD, notify signups.
- `src/components/Shared.jsx` — useProducts hook, SiteHeader, SavingsModal, DeliveryChoiceModal.
- `backend/server.py` — products CRUD (admin JWT), notify signups, orders (simulated payment), chat, admin auth with brute-force lockout.

## Key API endpoints
- Public: GET /api/products, GET /api/products/{slug}, POST /api/notify, POST /api/orders, GET /api/orders/{token}, POST /api/orders/{token}/credentials, GET/POST /api/orders/{token}/messages
- Admin (Bearer JWT): POST /api/admin/login, GET /api/admin/orders, GET/POST /api/admin/orders/{id}/messages, PATCH /api/admin/orders/{id}, POST/PUT/DELETE /api/admin/products[/{id}], GET /api/admin/notify-signups

## User choices (this session)
- Import and continue building (not just a one-off run).
- Keep payments SIMULATED (no real Stripe/Paddle wiring).
- Skip real Resend email integration for now (RESEND_API_KEY blank — email sending is a no-op, intentional).
- No specific new feature requested yet.

## Implemented (Aug 2026 — import session)
- Cloned repo, wired backend/frontend deps (removed unused `emergentintegrations`/`litellm` from requirements.txt — caused pip conflicts, not used by this app).
- Fresh `JWT_SECRET` + `ADMIN_PASSWORD=admin-getsub-2026` generated in backend/.env (gitignored, not in repo).
- Verified end-to-end: homepage, product pages, plan/delivery/savings modals, simulated checkout → order page, credentials + live chat, admin login/orders/products/notify-signups — all functional (testing agent: 86.7% backend / 91.7% frontend on first pass, mocked payment/email correctly excluded as non-bugs).
## Implemented (Aug 2026 — Header redesign: search, My Subscription, language pill, login icon)
- Moved sign-in control to the far right (after "Get started"), replaced the "Sign in" text link with a circular person/login icon button (→ /login or /account depending on auth state).
- Added a product search bar in the nav (filters active products by name, dropdown of matches, Enter/click navigates to the product page) — ready to scale as more products are added.
- Added a "My Subscription" nav link (→ /account).
- Added a static "EN | USD" language/currency pill (visual placeholder only, not functional yet, per user's choice).
- /account page now has "Active" (awaiting_credentials + processing) and "Closed" (completed) subscription tabs.
- Mobile menu updated to match: search input, product links, My Subscription, language pill (login icon stays in the fixed header).

- Fixed reported bug: admin previously could not reply to support tickets. Replaced the one-shot "leave a message" widget with a real ticket system (`tickets` + `ticket_messages` collections); admin Support tab is now a master-detail list with a reply box + open/resolved toggle per ticket.
- Added buyer accounts: email+password (bcrypt via asyncio.to_thread, JWT access 15min/refresh 7day httpOnly cookies) AND Google sign-in (Emergent-managed OAuth, `/api/auth/google/session`), combined under one unified JWT session so `get_current_buyer` works the same regardless of login method.
- Checkout now REQUIRES login (guest checkout removed) — `POST /api/orders` derives `buyer_email`/`user_id` from the authenticated buyer; SavingsModal shows a "Sign in to continue" gate (email/password + Google) when logged out.
- New `/account` page (order history via `GET /api/my/orders`, logout); header shows Sign in / first-name link based on auth state.
- Live chat support widget (floating button, hidden on `/admin`): logged-out users see a sign-in prompt; logged-in users get a real polling (3s) chat thread with admin.
- Existing recharge-order chat (`/order/{token}` Gmail/OTP chat) is untouched and independent of the new ticket system.
- Fixed post-testing: CORS_ORIGINS set to explicit frontend origin (was `*`) for correct credentialed cookies; AuthContext now retries `/api/auth/refresh` on 401 (both initial page load and a global axios interceptor for other buyer-facing calls) so sessions survive access-token expiry via the refresh cookie; duplicate-registration race now returns a clean 400 instead of 500.
- Testing agent verified (2 rounds): full auth/checkout/ticket-reply/refresh-continuity/CORS flows passing (100% on final targeted re-check).

- Added a floating "Contact support" button (bottom-right, every page except /admin) that opens a lightweight message form (email + message, no login required).
- WhatsApp explicitly skipped per user request (removed from scope).
- Live chat kept simple/no-login for now: user noted buyers will need accounts to open full tickets/chat, and that signup system will be built later — so this widget is a "leave a message, get an email reply" form, not a real-time chat, until accounts exist.
- Backend: POST /api/support (public, EmailStr + non-blank message validation), GET/PATCH /api/admin/support (admin, list + mark resolved/reopen), best-effort admin email notification (no-op while RESEND_API_KEY is blank).
- New "Support" tab in /admin lists all messages with Open/Resolved status toggle.

- Added "Reviews" and "FAQ" nav links to the homepage header (alongside "How it works" and "Products").
- New homepage Reviews section (`#reviews`): Trustpilot badge/link (placeholder until Trustpilot is connected) + 3 clearly-marked placeholder testimonial cards, ready to be swapped for real Trustpilot + manual reviews later.
- New homepage FAQ section (`#faq`): combines the existing YouTube + Spotify product FAQs (grouped by product name) into one accordion, reusing the same accordion styling/behavior as the per-product FAQ.

- Replaced hero pricing card's Spotify/YouTube tab toggle with a horizontal scrollable row of product logos (dynamically rendered from active products via ServiceIcon, so future products like Netflix/Grammarly show automatically).
- Card now shows a single "From $X.XX / month" price (lowest `from_price` across active products) instead of a per-tab strikethrough price.
- Primary action changed to a "See all plans" button linking to the in-page `#products` section, replacing the implicit tab-driven single-product flow.
- Seats-left banner, Secure checkout row, and payment icons left unchanged; card styling/position unchanged.

- Fixed testing-agent findings:
  - Backend: `buyer_email`/`gmail` now validated as `EmailStr`; plan/product prices require `ge=0`; chat message text rejects whitespace-only; admin-login brute-force lockout now keys off the last (trusted-proxy-appended) `X-Forwarded-For` entry instead of the client-spoofable first entry.
  - Frontend: Products nav dropdown no longer closes immediately on click (was toggling instead of opening); order-summary rows now wrap/overflow-break long buyer emails on mobile; "How it works" copy no longer falsely claims real Paddle checkout while payments are simulated.

## Backlog
- P1: Wire real Paddle/Stripe checkout (needs client token + price IDs); order creation should move to a post-payment webhook.
- P1: Add real Resend email delivery once user provides `RESEND_API_KEY` (domain verification needed for non-test recipients).
- P2: Replace placeholder testimonials/review counts with real data.
- P2: Split server.py into routers (auth/catalogue/orders/chat) as it grows.

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
## Implemented (Aug 2026 — Reviews & FAQ sections)
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

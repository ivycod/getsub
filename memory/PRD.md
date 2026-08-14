# getsub — PRD

## Problem statement
User has an existing static landing page ("getsub" — split Spotify/YouTube Premium plans). Request: add a pop-up (centered modal with dark overlay) that appears when a buyer clicks "Choose plan", showing the total plan price, the official price, and how much they save.

## Pricing (source of truth)
YouTube: Monthly $5.49 (official $15.99) · 12mo $35 (official $191.88) · Shared $3.49 (official $15.99)
Spotify: Monthly $6.00 (official $12.99) · Yearly $39.99 (official $155.88) · Shared $4.49 (official $12.99)

## Architecture
- React frontend + FastAPI + MongoDB. Products are DB-driven (seeded with YouTube + Spotify on first startup).
- `src/App.js` — landing fetches products from API: active → product cards, coming_soon → greyed cards with notify-me email form. Rotating hero word, legit Q&A, payment trust rows.
- `src/pages/ProductPage.jsx` — generic `/:slug` product page rendered from GET /api/products/{slug} (hero, perks, plans w/ months picker [3,6,9,12,16], how it works, reviews placeholders, FAQ).
- `src/pages/OrderPage.jsx` — buyer order page `/order/:token` (summary, recharge credentials form, live chat 3s polling).
- `src/pages/AdminPage.jsx` — /admin with tabs: Orders (chat, credentials, status) | Products (full CRUD editor: plans, perks, FAQs, delivery types, active/coming-soon) | Notify signups.
- `src/pages/AdminProducts.jsx` — product manager + signups list.
- `src/components/Shared.jsx` — useProducts hook, ServiceIcon (yt/sp SVGs + generic letter icon w/ product color), SiteHeader (nav Products dropdown fed from API, active only), SavingsModal / DeliveryChoiceModal / PlanModalFlow (take product+plan objects; choice modal skipped if plan has ≤1 delivery type).
- `src/data.js` — money, SHARED_MONTH_OPTIONS, DELIVERY_OPTIONS (video placeholders: set videoUrl).
- `backend/server.py` — products CRUD (admin JWT), notify signups, orders priced from DB (blocks coming_soon products, validates delivery type per plan), chat, admin auth with brute-force lockout.

## Key API endpoints
- Public: GET /api/products, GET /api/products/{slug}, POST /api/notify, POST /api/orders, GET /api/orders/{token}, POST /api/orders/{token}/credentials, GET/POST /api/orders/{token}/messages
- Admin (Bearer JWT): POST /api/admin/login, GET /api/admin/orders, GET/POST /api/admin/orders/{id}/messages, PATCH /api/admin/orders/{id}, POST/PUT/DELETE /api/admin/products[/{id}], GET /api/admin/notify-signups

## Implemented (June 2026)
- Ported static HTML into React preserving exact getsub design.
- Savings modal on every "Choose plan" click: plan name, you-pay price, official price (strikethrough), savings amount + %, savings badge, CTA. Closes via ×, overlay click, or Esc.
- Shared-plan duration options fixed to [3, 6, 9, 12, 16] months.
- Restructured (June 2026): landing shows 2 compact product cards (YouTube/Spotify) with "Choose plan" (→ /youtube, /spotify product pages) and "View more" (quick-view popup). Product pages hold plan selection, perks, reviews, how-it-works, and service-specific FAQ. Deep link `/{service}?plan=<planId>` auto-opens the SavingsModal. Tested 13/13 pass (test_reports/iteration_2.json).
- Delivery options + recharge chat (June 2026): monthly/12-month plans offer "Pre-planned account" vs "Recharge my account". Purchase is SIMULATED (Paddle unconfigured) — Continue creates an order and opens the private order page. Recharge: buyer submits Gmail + password, then live chat (3s polling) with admin for OTP/codes. Admin panel /admin (password login, JWT, brute-force lockout): orders list, credentials view, status management, chat. Tested: 17/17 backend + all frontend flows pass (test_reports/iteration_3.json).
- Delivery choice redesign (June 2026): "Choose plan" on monthly/12-mo plans opens a two-box comparison modal (Pre-planned vs Recharge), each box with chip, description, 16:9 video placeholder (DELIVERY_OPTIONS[*].videoUrl in data.js), 4 numbered steps, best-for note, select button. Savings modal shows "Delivery: X · Change". "Copy savings link" removed. Shared plans skip the choice modal. Self-tested e2e.
- Above-the-fold trust upgrade (June 2026): hero has one primary CTA ("See products"; "How it works →" is a plain text link), social-proof strip (3 initial avatars, ★ 4.8 from 241+ subscribers — PLACEHOLDER numbers, unlinked Trustpilot badge), payment trust rows (Secure checkout lock + Visa/Mastercard/PayPal/G Pay/Apple Pay chips) under the hero price card and footer CTA, and "Review us on Trustpilot" badge in the site footer (to be linked once domain/Trustpilot is set up).
- Nav cleanup (June 2026): merged Products/YouTube/Spotify nav links into one "Products" dropdown (hover/click, service icons); mobile menu flattens dropdown into direct links.
- Rotating hero word (June 2026): "Same Spotify. / Same <rotating>. / Half the price." — second word fades through [YouTube, Netflix, Prime Video, Grammarly, chat GPT, Canva] (PLACEHOLDER list in ROTATE_WORDS, App.js), 2s/word desktop, 2.5s mobile, teal accent, min-width 6.3em container (no layout shift), static "YouTube." under prefers-reduced-motion.
- "Why it's legit" quick FAQ (June 2026): 4 Q&A cards (terms/legality, own login, seat removal → refund or replacement, cancel anytime) directly below hero/marquee, above the "Bundle these platforms" row — exact user-provided copy.
- DB-driven product manager (June 2026): products moved to MongoDB (idempotent seed for YouTube/Spotify keeps original plan_ids). /admin gained Products tab (create/edit/delete products with plans, perks, FAQs, delivery-type checkboxes, active/coming-soon status, accent color) and Notify signups tab. Landing shows coming-soon cards with notify-me email capture; nav dropdown lists active products only; generic /:slug routes. Orders price from DB and reject coming-soon products. Tested 25/25 backend + all frontend flows (test_reports/iteration_4.json).

## Backlog
- P1: Wire real Paddle checkout (needs Paddle client token + price IDs from user); order creation should then move to post-payment webhook/success.
- P2: Replace placeholder testimonials with real reviews (landing + product pages).
- P2: Notify admin of new orders/messages (email or sound/badge).

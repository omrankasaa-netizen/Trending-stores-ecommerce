# Trending Store — de-Base44 Self-Hosted Port

This document summarizes the conversion of the Base44-exported storefront into a
fully self-hosted **Node/Express + SQLite + Resend** application. The golden rule
throughout: **never remove working functionality — only extend or correct.**

---

## 1. Architecture

| Layer | Before (Base44) | After (self-hosted) |
| --- | --- | --- |
| Data | Base44 hosted entities | `better-sqlite3` generic doc store (`e_<Entity>` tables) |
| Client SDK | `@base44/sdk` | `src/api/base44Client.js` local drop-in (same surface) |
| Auth | Base44 auth | Express + bcryptjs + JWT (httpOnly cookie `miniyo_session` + Bearer) |
| Email | Base44 functions | Resend HTTP API (`server/email.js`) with EmailLog rows |
| Backend fns | Base44 functions | `server/functions.js` invoked via `/api/functions/:name` |
| Hosting | Base44 | Express serves the built SPA with history fallback |

The local client exposes the exact surface the app already used:
`base44.entities.<Name>.{list,filter,get,create,update,delete}`,
`base44.auth.*`, `base44.integrations.Core.UploadFile`, and
`base44.functions.<name>(body)`.

### Backend files (`server/`)
- `db.js` — SQLite open (corruption self-heal), generic CRUD, query/sort/limit, auth-credential table, kv table.
- `auth.js` — register/login, bcrypt hashing, JWT, OTP issue/verify, password reset.
- `email.js` — Resend sender **with array-recipient fix**; writes an `EmailLog` row on every send; never throws.
- `functions.js` — the 5 emails + `commitStock`.
- `index.js` — Express app: auth routes, `/api/functions/:name`, `/api/upload` (auth-gated), generic entity CRUD with a write-authorization gate, SPA fallback, binds `0.0.0.0`.
- `seed.js` — admin user, 8 categories, 4 sample products, default SiteSettings.

---

## 2. Blockers (B1–B5)

### B1 — Admin role gate
`src/components/ProtectedRoute.jsx` now supports `requireAdmin`; `src/App.jsx`
wraps **all** `/admin/*` routes in
`<ProtectedRoute requireAdmin unauthenticatedElement={<Navigate to="/login" />}>`.
Non-admins are redirected to `/`. The backend independently enforces admin-only
writes (`authorizeWrite`), so the gate is defense-in-depth, not the only control.

### B3 — Entities + coupon validation
- Registered entities: **Discount, Coupon, EmailLog** (plus Product, Category, Order, Banner, SiteSettings, Testimonial, User).
- Admin coupon CRUD migrated from `localStorage` to the **Coupon entity** (`src/pages/admin/Discounts.jsx`).
- Checkout validates coupons against the backend (`src/pages/Checkout.jsx`): checks `active`, `expiry`, `usage_limit`/`usage_count`, `min_order`; applies `percent`/`fixed` discount; increments `usage_count` on order placement.
- Guests may place orders and bump coupon `usage_count` only — enforced by `PUBLIC_WRITES = { Order: ['create'], Coupon: ['update'] }`.

### B4 — Real Home rails
`src/pages/Home.jsx` rebuilt with real **Banner / Category / Product** rails
(featured / trending / newest, falling back to newest), an announcement bar and a
trust strip driven by SiteSettings. All fake static products, prices, reviews and
`media.base44.com` URLs removed.

### B5 — `formatPrice` /1000 fix
Prices are whole USD. A shared `formatPrice` lives in `src/lib/utils.js`; every
inline divide-by-1000 formatter was removed across ProductCard, ProductDetail,
CartDrawer, Checkout, and the admin pages (Products, Orders, Dashboard,
OrderDetail, Discounts). Verified: no `/1000` price math remains in `src/`.

---

## 3. Majors (M1–M6)

- **M1 — Theme/fonts/lang:** `index.html` set to `lang="ar" dir="rtl"`, title "Trending Store | ترندينج ستور", single Google Fonts link (Manrope + Inter + Cairo + Tajawal). Tailwind + `index.css` tokens updated to the brand palette (teal `#127a8a`, amber `#f57c00`, strike `#d23f3f`). All `livelarq`/`larq`/`geologica` naming removed.
- **M2 — Settings-driven storefront:** `src/components/useSiteSettings.jsx` exposes WhatsApp number, delivery fee, store name, announcement, etc. Consumed by Header, Footer, CartDrawer, Checkout, About, Delivery, Contact. Shop reads categories from the Category entity and syncs `?cat=`.
- **M3 — Reactive cart count:** `useCart` drives the header badge reactively (obsolete no-op listener removed).
- **M4 — CartDrawer WhatsApp + savings:** "Send Order via WhatsApp" builds a bilingual order message to the settings WhatsApp number; a savings line sums `compare_at_price − price`.
- **M5 — Out-of-stock:** ProductCard and ProductDetail show an out-of-stock overlay/banner and disable Add-to-Cart / Buy-Now / WhatsApp CTAs when `stock_quantity <= 0`.
- **M6 — Routes & pages:** fixed `/Shop` → `/shop` (and category links) in the Footer; created **About, Delivery, Contact, Search** pages and routes; added a Search entry to the Header. No remaining `to="/Shop"` links.

---

## 4. Email system (5 templates, Resend)

All sent through `server/email.js`, branded "Trending Store" (teal header), and
logged to the **EmailLog** entity on every attempt:

1. `otp_verification` — emailed verification code on register/resend.
2. `welcome` — after first OTP verification.
3. `order_confirmation` — to the customer (skipped if no `customer_email`).
4. `order_notification` — admin new-order alert. **Always** includes the owner mailbox `trending.store701@gmail.com`, merged with the `admin_emails` SiteSetting and `MINIYO_ADMIN_EMAIL` / `MINIYO_ORDER_ALERT_EMAILS`, de-duped.
5. `order_status_update` — to the customer on status change (confirmed/processing/shipped/delivered/cancelled).

**Array-recipient fix:** Resend rejects a comma-joined `to` string with a 422.
`sendEmail` normalizes multi-recipient values into an **array** before the API
call, while logging a readable comma-joined string. Verified in smoke test: the
admin alert went out with `to = [owner, admin]` and logged
`trending.store701@gmail.com, admin@trending.store`.

**From name:** `MINIYO_EMAIL_FROM` is normalized to a valid `Name <email>` form
and defaults to `Trending Store <onboarding@resend.dev>`.

---

## 5. Order automation

- **On order create (Checkout):** `commitStock` (decrement, clamp ≥ 0), `sendOrderNotification` (admin), `sendOrderConfirmation` (customer, if email), and coupon `usage_count` increment — all best-effort via `Promise.allSettled`.
- **On status change (admin OrderDetail):** `sendOrderStatusUpdate({ order_id, new_status })` after `Order.update`. *(Fixed a param-name mismatch — the client previously sent `status` instead of `new_status`, so the email never fired.)*
- Idempotency: each email function checks EmailLog for a prior `sent` row before re-sending.

---

## 6. Admin financials

Admin UI hides financial figures per requirement, but **the finance code is kept**
(hidden, not deleted) so it can be re-enabled later.

---

## 7. QA results

| Check | Result |
| --- | --- |
| `npm install` | OK (deps already present) |
| `npm run build` | **Pass** (added missing `@` → `src` Vite alias so the bundler resolves imports) |
| `node --check server/*.js` | All 6 files OK |
| `npm run lint:fix` | **0 errors** (4 pre-existing unused-var warnings in admin files) |
| Live smoke test (temp DB) | All pass — see below |

Smoke test (temp `MINIYO_DB_PATH`, fresh seed) verified:
- Seed: 8 categories, 4 sample products (one at stock 0), SiteSettings, admin user.
- Guest write to Product blocked (401); admin write allowed (200).
- Admin login returns `role=admin` + token.
- Guest order create → `commitStock` decremented stock 12 → 9.
- `order_notification` sent to **array** `[owner, admin]`; `order_confirmation` + `order_status_update` sent; **EmailLog rows written** for each.
- Guest coupon `update` allowed (200); guest coupon `delete` blocked (401).
- Register → OTP (from debug log) → verify → session + welcome email logged.
- SPA fallback: `/` and `/shop` return 200.

---

## 8. Railway environment variables

Variable names preserve the AURA `MINIYO_` convention.

**Required for production**
| Var | Purpose |
| --- | --- |
| `MINIYO_JWT_SECRET` | JWT signing secret — **set a strong random value** (default is a dev placeholder). |
| `RESEND_API_KEY` | Resend API key. If unset, emails are logged-only (no send), flow still succeeds. |
| `MINIYO_EMAIL_FROM` | Sender, e.g. `Trending Store <orders@yourdomain.com>` (must be a Resend-verified domain). |
| `MINIYO_ADMIN_EMAIL` | Seed admin login email **and** an order-alert recipient. |
| `MINIYO_ADMIN_PASSWORD` | Seed admin password (set before first boot). |

**Recommended**
| Var | Purpose |
| --- | --- |
| `MINIYO_DB_PATH` | Absolute path on a mounted volume, e.g. `/data/data.db`, so data survives redeploys. |
| `PORT` | Provided by Railway automatically; the server reads it (defaults to 4000). |

**Optional**
| Var | Purpose |
| --- | --- |
| `MINIYO_ORDER_ALERT_EMAILS` | Extra comma-separated order-alert recipients. |
| `MINIYO_JOURNAL_MODE` | SQLite journal mode (defaults to `DELETE` on a mounted volume, `WAL` otherwise). |
| `MINIYO_INSECURE_COOKIE` | Set `1` only for local HTTP testing (disables the Secure cookie flag). |
| `MINIYO_OTP_DEBUG` | Set `1` to log OTP codes to the server console (debug only). |

### Resend setup notes
1. Create a Resend account and **verify your sending domain**.
2. Set `RESEND_API_KEY` and `MINIYO_EMAIL_FROM` (using the verified domain).
3. Until a domain is verified you can use `onboarding@resend.dev` (Resend's sandbox), which only delivers to your own account email.
4. With no key set, the app still runs — emails are recorded in EmailLog with `error_message = logged_only_no_provider`.

### Deploy steps
1. `npm install`
2. `npm run build` (produces `dist/`, which the Express server serves)
3. `npm start` (`node server/index.js`) — schema init + seed run automatically on boot.

---

## 9. Cleanup
- Deleted `_aura_reference/` and `PORT_BRIEF.md`.
- `.gitignore` extended to exclude `data.db*`, `*.sqlite*`, and `uploads/*` (runtime artifacts).

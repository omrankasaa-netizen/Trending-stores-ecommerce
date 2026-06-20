# Trending Store — De-Base44 + Launch-Ready Conversion Brief

## Goal
Convert the Base44-exported repo (`Trending-stores-ecommerce`) into a fully self-hosted Node/Express + SQLite + Resend app — exactly like the existing AURA / MiniYo apps — so it can run on Railway with no Base44 dependency. The user prepares Railway + Resend services; you change the code.

**GOLDEN RULE (carried across this project): Never remove existing working functionality — only extend or correct it. BE CONSERVATIVE.**

## Reference material IN THE REPO
A full working AURA backend has been committed at `_aura_reference/server/` in this repo:
- `auth.js` (JWT + bcrypt auth helpers, OTP)
- `db.js` (better-sqlite3 setup, schema/migrations, entity tables)
- `email.js` — **CONTAINS THE CRITICAL RESEND ARRAY-RECIPIENT FIX** (toList/toForApi/toForLog normalization, normalizeFrom fallback). Recipients MUST be passed to Resend as an ARRAY, never a comma-joined string, or Resend returns 422 validation_error.
- `functions.js` (32KB — the 5-email system: order confirmation, order status update, welcome, OTP, admin alert; STORE_NAME/STORE_BASE_URL/SUPPORT_EMAIL constants; PLACEHOLDER_RECIPIENTS exclusion; sendOrderNotification/sendOrderConfirmation)
- `index.js` (Express routes: /api/auth/*, /api/users/invite, /api/functions/:name, /api/upload, /api/entities/:entity[/:id], static /uploads, SPA fallback)
- `seed.js` (seed data)

**PORT this backend** — adapt it for Trending Store's entities + branding. Use the AURA files as the template for structure, the array-recipient email fix, auth, upload, and entity API. After porting, DELETE the `_aura_reference/` folder so it doesn't ship.

## Architecture decision (DO NOT DEVIATE)
Build a **drop-in `base44`-compatible client** that talks to our own Express backend with the SAME method names and signatures. This minimizes changes to the ~18 page files. The frontend keeps calling `base44.entities.Product.list()` etc. — only `src/api/base44Client.js` (and friends) change to point at our local `/api/*` backend.

---

## PART A — Backend (`server/`)

Create `server/` (port from `_aura_reference/server/`) exposing:

### Entity API — `/api/entities/:entity` and `/api/entities/:entity/:id`
- GET list (support `?sort=`, filters as query params), GET by id
- POST create, PUT update, DELETE
- Use an `ensureEntity` allow-list + `authorizeWrite` (writes require auth; admin entities require role==='admin').
- Entity names MUST match what the frontend imports (case-sensitive):
  **Product, Category, Order, Banner, SiteSettings (plural), Testimonial, User**
  PLUS new entities required by QA: **Discount, Coupon, EmailLog**
- SiteSettings is a singleton-style settings store (the frontend reads SiteSettings.list()[0] pattern — preserve whatever the frontend expects; check the page files).

### Auth API — `/api/auth/*`
me, login, register, verify-otp, resend-otp, logout, update-me, change-password, reset-password-request, reset-password. JWT in httpOnly cookie + bearer token support (mirror AURA). bcryptjs for password hashing.

### Upload — `/api/upload`
Accept base64 JSON `{file}` → write to `/uploads/<name>` → return `{file_url}`. Serve `/uploads` statically. (Mirror AURA. The frontend uses this via `base44.integrations.Core.UploadFile`.)

### Functions — `/api/functions/:name`
Port the 5-email system. STORE constants for Trending Store (see BRANDING below).

### SPA fallback
Serve built `dist/` and fall back to `index.html` for client routes.

### package.json
Add backend deps: `express ^4.21.2`, `better-sqlite3 ^11.8.1`, `bcryptjs ^2.4.3`, `jsonwebtoken ^9.0.2`, `cookie-parser ^1.4.7`, `dotenv ^17.4.2`. Add scripts: `"start": "node server/index.js"`, `"dev:server": "node server/index.js"`, `"serve": "npm run build && node server/index.js"`. **Set `"type": "module"` consistency — match how AURA does it.**
REMOVE `@base44/sdk` and `@base44/vite-plugin` from dependencies. Remove the base44 plugin from `vite.config.js`.

---

## PART B — Drop-in client (`src/api/base44Client.js`)

Replace the Base44 SDK client with a local client exposing the EXACT SAME surface the pages use:
- `base44.entities.{Product,Category,Order,Banner,SiteSettings,Testimonial,Discount,Coupon,EmailLog}.{list, filter, create, update, delete}`
  - `.list(sort?)` → GET /api/entities/:entity (pass sort)
  - `.filter(query, sort?)` → GET with query params
  - `.create(data)` → POST; `.update(id, data)` → PUT; `.delete(id)` → DELETE
- `base44.auth.{me, register, verifyOtp, resendOtp, loginViaEmailPassword, logout, setToken, resetPassword, resetPasswordRequest, redirectToLogin, loginWithProvider}`
  - Map to /api/auth/* routes. `redirectToLogin` → navigate to /login. `loginWithProvider` can be a no-op/stub if OAuth isn't wired (keep signature so nothing breaks).
- `base44.integrations.Core.UploadFile({file})` → POST /api/upload → `{file_url}`

**Inspect every page/component import of `@base44/sdk` and `@/api/base44Client` and ensure the new client satisfies all of them.** Grep the whole `src/` for `base44`, `@base44`, `app-params` and make sure nothing still references the cloud SDK. Keep `src/lib/app-params` if pages import it — just make it harmless/local.

---

## PART C — FIX QA BLOCKERS (from the QA report)

**B1 — Admin unprotected.** `/admin/*` routes have `requiresAuth:false` and no role gate. `ProtectedRoute.jsx` exists but is unused. Gate ALL `/admin/*` behind `user.role === 'admin'` (use the existing ProtectedRoute or wire a guard). Non-admins → redirect to /login. This is a hard launch blocker.

**B2 — No email automation.** Zero SendEmail calls today. Wire:
  - On **order create** (Checkout): send order **confirmation** to customer + **admin alert** to admin email.
  - On **order status change** (admin OrderDetail): send **status update** to customer.
  - On **register**: welcome + OTP emails as appropriate (mirror AURA).
  - Use the ported `functions.js` email system with the **array-recipient fix**. Admin recipients must be an ARRAY, not a comma-joined string (the export stored `admin_emails` as a comma string → 422-prone; fix it).
  - **EmailLog**: currently reads empty localStorage("ts_email_log"). Make EmailLog a real backend entity; every send writes an EmailLog row; the admin EmailLog page reads from the entity.

**B3 — Missing entities.** Add **Discount, Coupon, EmailLog** as real backend entities. Coupons currently live only in localStorage and are never validated at checkout — wire coupon validation at checkout against the Coupon entity (check code, active status, expiry, min order, compute discount).

**B4 — Home.jsx is a leftover template** from livelarq.com (water bottles, fake reviews/press, "PFOA"). REBUILD the homepage to fetch real data:
  - Banner (hero slider/banners), Category (category rail), Product rails filtered by `is_trending`, `compare_at_price` (deals), `is_new`, and `(is_featured && video_url)` (video showcase).
  - Add a trust strip. Read storefront config (WhatsApp, delivery fee, categories, banners) from **SiteSettings/Banner**, not hardcoded.
  - Match the Trending Store brand (see BRANDING). Keep it clean, mobile-first, Arabic-default RTL.

**B5 — formatPrice /1000 bug.** `formatPrice` divides by 1000 in ~9 files, so $25000 shows "$25". Adopt ONE consistent whole-USD convention everywhere (prices stored as whole USD; display as `$X`). Fix every occurrence. Verify product admin form, cart, checkout, order, homepage all agree.

---

## PART D — FIX MAJORS

**M1 — Theme/fonts.** Replace `fontLarqGeologica` etc. with **Manrope/Inter (Latin) + Cairo/Tajawal (Arabic)**; actually LOAD Cairo (it's referenced but never loaded). Set `<html lang="ar" dir="rtl">` (Arabic DEFAULT + full RTL). Set page `<title>` to "Trending Store" (not "App"). Rename the config/app name away from "Captured: www.livelarq.com". Colors: primary teal `#127a8a`, accent amber `#f57c00`, strikethrough red `#d23f3f`, white bg, light-gray `#f6f7f8`, text `#1a1a1a`. Update `tailwind.config.js` + `index.html` + any theme file.

**M2 — Storefront hardcoding.** Storefront hardcodes WhatsApp number, delivery fee, categories, banners. Read these from SiteSettings/Banner/Category entities instead. Seed sensible defaults.

**M3 — Header cart count not reactive.** The `cart-update` handler is a no-op. Make the header cart badge update reactively when items are added/removed (event or shared state/context).

**M4 — CartDrawer.** Add the "Send Order via WhatsApp" path and a savings display (sum of compare_at_price − price). Build the correct `wa.me/96181751841` deep link with order summary.

**M5 — Out-of-stock + stock decrement.** Add out-of-stock overlay/disable on product cards & detail when stock <= 0. Decrement stock on order creation. (Be careful not to go negative; clamp.)

**M6 — Broken links/pages.** Fix `/Shop` vs `/shop` case-broken links (standardize). Create the missing **About, Delivery, Contact, Search** pages (simple, brand-consistent, content-driven from SiteSettings where sensible).

---

## BRANDING / CONFIG (Trending Store)
- Name: **Trending Store**
- Tagline EN: "Smart finds for everyday life" / AR: "كل جديد ومفيد لحياتك اليومية"
- Domain: https://trending-stores.com
- Support email: support@trending-stores.com
- Contact / admin-alert email: **trending.store701@gmail.com**
- WhatsApp / phone: **+961 81 751 841** (wa.me digits **96181751841**)
- Address: Rafic Hariri St, Tripoli, Lebanon
- Facebook: https://www.facebook.com/people/Trending-Store/61557075004536/
- Theme: primary teal `#127a8a`, accent amber `#f57c00`, strike red `#d23f3f`, bg white, light-gray `#f6f7f8`, text `#1a1a1a`
- Fonts: Manrope/Inter (Latin) + Cairo/Tajawal (Arabic). **Arabic default + full RTL.**
- Gadget categories (slug — EN — AR):
  - home-kitchen — Home & Kitchen — المنزل والمطبخ
  - garden-irrigation — Garden & Irrigation — الحديقة والري
  - kids-baby — Kids & Baby — الأطفال والرضع
  - pets — Pets — الحيوانات الأليفة
  - tools-hardware — Tools & Hardware — العدد والأدوات
  - gadgets-electronics — Gadgets & Electronics — الأجهزة والإلكترونيات
  - health-beauty — Health & Beauty — الصحة والجمال
  - trending — Trending — الأكثر رواجاً

## ENV VARS (KEEP MINIYO_ NAMES — user's explicit choice, avoids breakage)
Use the same env var names as MiniYo/AURA so the user's Railway setup transfers. Keep these names:
- `MINIYO_JWT_SECRET`, `MINIYO_DB_PATH` (or whatever AURA uses — MATCH AURA's names exactly), Resend key var (match AURA), `RESEND_FROM` / from-name, admin alert email, store base URL.
- Read the actual env var names from `_aura_reference/server/*.js` and KEEP THEM IDENTICAL. Do not rename env vars.
- Email from-name: "Trending Store". Sender domain `mail.trending-stores.com` (user will verify in Resend). Admin alert → trending.store701@gmail.com.
- **Admin must NOT show any financials** (operational only) — but KEEP the finance code (just hide it from admin UI). This was the user's explicit choice for this fork.

## SEED
Seed: the 8 gadget categories above, a few sample products (with images optional/placeholder — BE CONSERVATIVE, don't invent fake prices/barcodes; use clearly-sample data), default SiteSettings (WhatsApp, delivery fee, brand), an admin user. Mirror AURA's seed structure.

## QA BEFORE PR (mandatory)
1. `npm install` (ensure better-sqlite3 builds)
2. `npm run build` (vite build must pass)
3. `node --check server/*.js` (syntax)
4. Start the server locally with a temp DB + run seed; smoke test:
   - Homepage loads with real rails (no livelarq content)
   - Register → OTP/login flow
   - Admin gate blocks non-admin, allows admin
   - Create an order as guest (COD) → confirmation + admin alert emails attempted (log them; Resend key may be absent locally — verify the array-recipient code path and EmailLog write, don't require real send)
   - Order status change → status email path
   - formatPrice shows correct whole-USD amounts everywhere
   - Cart count reactive; WhatsApp link correct; out-of-stock handling; coupon validation
5. Run `npm run lint:fix` to clear unused-import noise.
6. DELETE `_aura_reference/` before final commit.

## DELIVERABLE
- Branch from CURRENT origin/main, commit all changes, push, open a PR with a clear description of every change (mapped to B1–B5, M1–M6), and the QA results.
- In the PR description, include the Railway env-var list (names + what to set) and Resend setup notes (verify mail.trending-stores.com, from-name "Trending Store", admin alert trending.store701@gmail.com).
- Do NOT merge — leave the PR open for the user to review (the user merges).

Write a short `PORT_SUMMARY.md` in the repo root listing what changed and the QA results.

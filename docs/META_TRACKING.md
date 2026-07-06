# Meta (Facebook) Tracking

This store integrates Meta tracking three ways: a **browser Pixel**, a
**server-side Conversions API (CAPI)** signal, and a **product catalog feed**.
Everything is **env-driven** and **silently no-ops when unconfigured** — the
storefront runs normally with no Meta env vars set.

## Environment variables

| Variable | Side | Secret? | Purpose |
| --- | --- | --- | --- |
| `VITE_META_PIXEL_ID` | Frontend | No (public) | Pixel id inlined into the client bundle by Vite. |
| `TRENDING_META_PIXEL_ID` | Backend | No (public) | Same pixel id, read by CAPI + feed. |
| `TRENDING_META_CAPI_ACCESS_TOKEN` | Backend | **Yes** | Conversions API access token. Never expose to the client. |
| `TRENDING_META_TEST_EVENT_CODE` | Backend | No | Optional. Routes CAPI events to Events Manager → Test Events. |

`VITE_META_PIXEL_ID` and `TRENDING_META_PIXEL_ID` should hold the **same** pixel
id. See `.env.example`.

> **Never commit secrets.** The access token must only be provided via
> environment variables (e.g. Railway project variables). A secret-scanning CI
> (gitleaks) may reject commits containing tokens.

## What fires where

### Browser Pixel (`src/lib/metaPixel.js`)
Loaded only after the shopper accepts the consent banner
(`src/components/ConsentBanner.jsx`; choice stored in `localStorage` under
`ts_meta_consent`). Events:

| Event | Trigger |
| --- | --- |
| `PageView` | Every client-side route change (`Layout.jsx`). |
| `ViewContent` | Product detail page load (`ProductDetail.jsx`). |
| `AddToCart` | Centralized in `useCart.addToCart` — fires from every add-to-cart path. |
| `InitiateCheckout` | Checkout page mount with a non-empty cart (`Checkout.jsx`). |
| `Purchase` | After an order is created (`Checkout.jsx`), with a shared `event_id`. |

`Search`, `Wishlist`, `Lead`, and `Contact` are intentionally **not** emitted —
the storefront has no corresponding surfaces. Add them if/when those features
exist.

### Server-side CAPI (`server/meta.js` + `metaTrackPurchase` in `server/functions.js`)
`Purchase` is the authoritative conversion. The browser fires it with an
`event_id`; checkout also calls `base44.functions.metaTrackPurchase({ order_id,
event_id })`, which sends the **same** `event_id` from the server so Meta
**deduplicates** the two into one conversion.

- **Authoritative value**: taken from the server-recomputed `order.total`.
- **Idempotent**: guarded by `order.meta_purchase_sent`; the flag is only set
  after Meta accepts the event, so transient failures can be retried.
- **PII hashed**: email, phone, first name and city are SHA-256 hashed before
  leaving the server (Meta requirement).

### Catalog feed (`GET /meta-feed.csv`)
Public CSV feed for Meta Commerce Manager / Advantage+ catalogs. Columns:
`id, title, description, availability, condition, price, sale_price, link,
image_link, brand`.

- `id` is the **normalized** (uppercase + trimmed) product identifier —
  identical to the `content_ids` sent by the Pixel and CAPI, so catalog matching
  works.
- Prices are **markup-inclusive** (what customers actually pay). When a product
  has a higher `compare_at_price`, it becomes the regular `price` and the current
  price becomes `sale_price`.

## Identifier consistency

All three surfaces use `productContentId()` / `normalizeContentId()` from
`src/lib/metaShared.js`, which uppercases and trims `product.sku || product.id`.
This guarantees the Pixel, CAPI, and feed all reference the exact same catalog
item id.

## Commerce Manager setup steps

1. **Create a Pixel**: Events Manager → Connect Data Sources → Web → Pixel.
   Copy the Pixel ID into `VITE_META_PIXEL_ID` and `TRENDING_META_PIXEL_ID`.
2. **Generate a CAPI token**: Events Manager → your Pixel → Settings →
   Conversions API → Generate access token. Put it in
   `TRENDING_META_CAPI_ACCESS_TOKEN` (backend env only).
3. **(Optional) Test Events**: Events Manager → Test Events. Copy the test code
   into `TRENDING_META_TEST_EVENT_CODE` while validating, then remove it.
4. **Verify deduplication**: place a test order; confirm one Purchase in Events
   Manager showing both "Browser" and "Server" with a shared event ID.
5. **Create the catalog**: Commerce Manager → Catalog → Add Products → Data
   Feed → Scheduled feed, URL `https://YOUR_DOMAIN/meta-feed.csv`.
6. **Consent**: the on-site banner gates the browser Pixel. CAPI Purchase is
   server-side and authoritative regardless of the browser banner.

## Disabling

Unset the env vars. The Pixel, CAPI, and (empty-safe) feed all degrade to
no-ops; the feed route still responds but reflects the live catalog only.

# TikTok Tracking

This store integrates TikTok tracking two ways: a **browser Pixel** and a
**server-side Events API** signal. It is a parallel, symmetric twin of the Meta
integration (see `docs/META_TRACKING.md`) — same architecture, same event_id
dedup model, same "silent no-op when unconfigured" philosophy. Everything is
**env-driven** and **silently no-ops when unconfigured** — the storefront runs
normally with no TikTok env vars set.

## Environment variables

| Variable | Side | Secret? | Purpose |
| --- | --- | --- | --- |
| `VITE_TIKTOK_PIXEL_ID` | Frontend | No (public) | Pixel id inlined into the client bundle by Vite (`ttq.load`). |
| `TRENDING_TIKTOK_PIXEL_ID` | Backend | No (public) | Same pixel id, used as the Events API `event_source_id`. |
| `TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN` | Backend | **Yes** | Events API access token (`Access-Token` header). Never expose to the client. |
| `TRENDING_TIKTOK_TEST_EVENT_CODE` | Backend | No | Optional. Routes Events API events to Events Manager → Test Events. |

`VITE_TIKTOK_PIXEL_ID` and `TRENDING_TIKTOK_PIXEL_ID` should hold the **same**
pixel id. See `.env.example`.

> **Never commit secrets.** The access token must only be provided via
> environment variables (e.g. Railway project variables). A secret-scanning CI
> (gitleaks) may reject commits containing tokens.

## What fires where

### Browser Pixel (`src/lib/tiktokPixel.js`)
Loaded only after the shopper accepts the consent banner
(`src/components/ConsentBanner.jsx`). The consent decision is the **shared** one
from `metaPixel.js` (stored in `localStorage` under `ts_meta_consent`) — a single
banner gates BOTH Meta and TikTok; there is no second consent flag. Events:

| Event | Trigger |
| --- | --- |
| `page` (PageView) | Every client-side route change (`Layout.jsx`). |
| `ViewContent` | Product detail page load (`ProductDetail.jsx`). |
| `AddToCart` | Centralized in `useCart.addToCart` — fires from every add-to-cart path. |
| `InitiateCheckout` | Checkout page mount with a non-empty cart (`Checkout.jsx`). |
| `CompletePayment` | After an order is created (`Checkout.jsx`), with a shared `event_id`. |

`CompletePayment` is TikTok's purchase-completed event (the Meta `Purchase`
equivalent).

### Server-side Events API (`server/tiktok.js` + `tiktokTrackPurchase` in `server/functions.js`)
`CompletePayment` is the authoritative conversion. The browser fires it with an
`event_id`; checkout also calls `base44.functions.tiktokTrackPurchase({ order_id,
event_id })`, which sends the **same** `event_id` from the server so TikTok
**deduplicates** the two into one conversion.

- **Endpoint**: `POST https://business-api.tiktok.com/open_api/v1.3/event/track/`,
  authenticated via the `Access-Token` header.
- **Authoritative value**: taken from the server-recomputed `order.total`.
- **Idempotent**: guarded by `order.tiktok_purchase_sent`; the flag is only set
  after TikTok accepts the event, so transient failures can be retried. (Like
  `meta_purchase_sent`, this field is written directly to the schema-flexible
  Order store and is not declared in `base44/entities/Order.jsonc`.)
- **PII hashed**: email, phone and external_id are SHA-256 hashed before leaving
  the server (email lowercased+trimmed, phone digits-only), per TikTok's
  requirements — the same hashing approach as `server/meta.js`.
- **Dedup key** is the triple `(event_source_id, event, event_id)`. TikTok's
  dedup window is **48 hours** (vs Meta's 7 days) — no code impact, just a note.

The three browsing events (`ViewContent` / `AddToCart` / `InitiateCheckout`) can
also flow through the generic `tiktokTrackEvent` server twin, which carries only
non-PII match keys derived from the request (ip / user-agent / `ttclid` / `_ttp`
cookies). `CompletePayment` is rejected on this generic path — it keeps its
dedicated authoritative path (`tiktokTrackPurchase`), mirroring how `server/meta.js`
excludes `Purchase` from `sendCapiEvent`.

## Identifier consistency

Both the Pixel and the Events API use `productContentId()` / `normalizeContentId()`
from `src/lib/metaShared.js` (uppercase + trim of `product.sku || product.id`) —
the SAME helpers Meta uses. This guarantees a product's `content_id` is identical
across Meta and TikTok, so both platforms match the same catalog item.

## TikTok Events Manager setup steps

1. **Create a Pixel**: TikTok Ads Manager → Assets → Events → Web Events → set up
   a pixel. Copy the Pixel ID into `VITE_TIKTOK_PIXEL_ID` and
   `TRENDING_TIKTOK_PIXEL_ID`.
2. **Generate an Events API access token**: in the pixel's settings, generate an
   Events API access token. Put it in `TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN`
   (backend env only).
3. **(Optional) Test Events**: Events Manager → Test Events. Copy the test event
   code into `TRENDING_TIKTOK_TEST_EVENT_CODE` while validating, then remove it.
4. **Verify deduplication**: place a test order; confirm one CompletePayment in
   Events Manager showing both browser and server sources with a shared event id,
   and check the Event Match Quality (EMQ) score in diagnostics.
5. **Consent**: the on-site banner gates the browser Pixel for BOTH Meta and
   TikTok together (one shared decision). The server-side CompletePayment is
   authoritative regardless of the browser banner.

## Disabling

Unset any of the four env vars. Unsetting `VITE_TIKTOK_PIXEL_ID` disables the
browser Pixel; unsetting `TRENDING_TIKTOK_PIXEL_ID` or
`TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN` disables the server Events API. Every
TikTok code path degrades to a silent no-op — no errors, no thrown exceptions.
This is the default state until real values are set in Railway.

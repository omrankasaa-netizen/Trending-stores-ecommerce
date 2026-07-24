# Analytics tracking standard (GA4 + UTM + Meta/TikTok hybrid)

This app runs three tracking layers in parallel:

1. **GA4** for measurement (`page_view`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase`).
2. **UTM attribution** capture/persistence for checkout order stamping.
3. **Meta + TikTok hybrid** browser+server conversion events with shared per-platform `event_id` dedup.

All layers are production-safe and degrade to no-ops when not configured.

## Environment variables

| Variable | Side | Required? | Purpose |
| --- | --- | --- | --- |
| `VITE_GA4_MEASUREMENT_ID` | Frontend | No | Enables GA4. If unset, GA4 is fully disabled. |
| `VITE_META_PIXEL_ID` | Frontend | No | Meta browser Pixel ID. |
| `TRENDING_META_PIXEL_ID` | Backend | No | Meta CAPI pixel ID. |
| `TRENDING_META_CAPI_ACCESS_TOKEN` | Backend | No | Meta CAPI token (secret). |
| `VITE_TIKTOK_PIXEL_ID` | Frontend | No | TikTok browser Pixel ID. |
| `TRENDING_TIKTOK_PIXEL_ID` | Backend | No | TikTok Events API event_source_id. |
| `TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN` | Backend | No | TikTok Events API token (secret). |

## Event mapping

| Journey step | GA4 | Meta browser + server | TikTok browser + server |
| --- | --- | --- | --- |
| Route change | `page_view` | `PageView` | `page()` |
| Product detail | `view_item` | `ViewContent` + CAPI twin | `ViewContent` + Events API twin |
| Add to cart | `add_to_cart` | `AddToCart` + CAPI twin | `AddToCart` + Events API twin |
| Checkout start | `begin_checkout` | `InitiateCheckout` + CAPI twin | `InitiateCheckout` + Events API twin |
| Order placed | `purchase` | `Purchase` + authoritative CAPI | `CompletePayment` + authoritative Events API |

## UTM normalization + persistence

UTM keys captured: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.

- Captured from landing URLs that include `utm_*` query params.
- Values are normalized as **trim + lowercase** before storing.
- Stored through safe storage (`src/lib/safeStorage.js`) so in-app browser
  storage restrictions never crash checkout.
- First-touch landing URL/path is preserved, and attribution fields are stamped
  onto order creation payloads (`Order.create`) as:
  `utm_*`, `attribution_captured_at`, `attribution_landing_path`,
  `attribution_landing_url`.

## Dedup + parity rules (Meta/TikTok)

- Browser and server twins share the **same `event_id`** for each platform.
- Purchase value/currency/content identifiers are sent on browser + server.
- Server-side purchase events hash identifiers where applicable:
  - Meta: email/phone/first-name/city (SHA-256)
  - TikTok: email/phone/external_id (SHA-256)

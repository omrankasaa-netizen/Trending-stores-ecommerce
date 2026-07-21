// Browser-side TikTok Pixel — env-driven and consent-gated. This is the parallel
// twin of src/lib/metaPixel.js (see docs/TIKTOK_TRACKING.md) and follows the exact
// same rules:
//  • Silent no-op when VITE_TIKTOK_PIXEL_ID is unset — the site must never break.
//  • The pixel loads ONLY after the shopper grants consent. It REUSES the single
//    shared consent decision from metaPixel.js (getConsent/hasConsentDecision), so
//    one banner gates both ad platforms — there is no second consent flag.
//  • event_id is generated per event so the browser Pixel and the server-side
//    Events API can be deduplicated by TikTok (send the SAME id from both). Reuses
//    newEventId() from metaPixel.js — the id itself is platform-agnostic, but each
//    logical action gets a SEPARATE id per platform (independent dedup namespaces).
//  • content_ids are normalized (uppercase+trim) at the boundary via metaShared so
//    the same product identifier is used across both Meta and TikTok.

import { META_CURRENCY, productContentId, normalizeContentId } from "./metaShared.js";
import { getConsent, hasConsentDecision, newEventId } from "./metaPixel.js";

const PIXEL_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID || "";
const LOADER_URL = "https://analytics.tiktok.com/i18n/pixel/events.js";

let loaded = false;

export function tiktokPixelId() {
  return PIXEL_ID;
}

export function isTiktokPixelConfigured() {
  return !!PIXEL_ID;
}

// Re-export the shared consent helpers so callers/tests can reason about TikTok
// consent through this module without knowing it lives in metaPixel.js.
export { getConsent, hasConsentDecision, newEventId as newTiktokEventId };

function consentGranted() {
  return getConsent() === "granted";
}

// Inject TikTok's official events.js loader exactly once, then ttq.load(PIXEL_ID).
// This is the programmatic equivalent of TikTok's inline base snippet — same
// dynamic-<script> technique metaPixel.js uses for fbevents.js. No-op without a
// pixel id.
function loadPixelScript() {
  if (loaded || !PIXEL_ID) return;
  if (typeof window === "undefined") return;
  /* eslint-disable */
  !(function (w, d, t) {
    w.TiktokAnalyticsObject = t;
    var ttq = (w[t] = w[t] || []);
    ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    ttq.setAndDefer = function (t, e) {
      t[e] = function () {
        t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (t) {
      for (var e = ttq._i[t] || [], n = 0; n < e.methods.length; n++) ttq.setAndDefer(e, e.methods[n]);
      return e;
    };
    ttq.load = function (e, n) {
      var i = LOADER_URL, o = n && n.partner;
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = i;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = n || {};
      n = d.createElement("script");
      n.type = "text/javascript";
      n.async = !0;
      n.src = i + "?sdkid=" + e + "&lib=" + t;
      e = d.getElementsByTagName("script")[0];
      e.parentNode.insertBefore(n, e);
    };
  })(window, document, "ttq");
  /* eslint-enable */
  window.ttq.load(PIXEL_ID);
  loaded = true;
}

// Called on app start and whenever consent changes. Loads the pixel only once
// consent is granted and a pixel id is configured.
export function initTiktokPixel() {
  if (!PIXEL_ID || !consentGranted()) return;
  loadPixelScript();
}

// Map cart/order line items to TikTok's `contents` shape. Uses the SAME
// normalized identifier as Meta (via normalizeContentId) so a product's id is
// identical across both platforms; only the field names differ (TikTok uses
// content_id/price, Meta uses id/item_price).
function tiktokContentsFromItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((it) => {
      const content_id = normalizeContentId(it.sku || it.product_id || it.id || it._id || "");
      if (!content_id) return null;
      const c = { content_id, quantity: Math.max(1, Number(it.quantity) || 1) };
      const price = Number(it.price);
      if (Number.isFinite(price)) c.price = price;
      const name = it.name || it.product_name || it.name_ar;
      if (name) c.content_name = name;
      return c;
    })
    .filter(Boolean);
}

// Core track — every helper funnels through here. Fully guarded so a missing
// pixel id or withheld consent means nothing is ever sent. TikTok carries the
// dedup id in a third options object: ttq.track(name, props, { event_id }).
function track(eventName, properties = {}, eventId) {
  if (!PIXEL_ID || !consentGranted()) return;
  if (typeof window === "undefined" || !window.ttq) return;
  if (eventId) window.ttq.track(eventName, properties, { event_id: eventId });
  else window.ttq.track(eventName, properties);
}

// PageView twin. TikTok uses ttq.page() with no properties.
export function trackTiktokPageView() {
  if (!PIXEL_ID || !consentGranted()) return;
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.page();
}

// The three browsing events generate (or accept) an eventId and RETURN it, so
// the caller can hand the SAME id to the server-side Events API twin and TikTok
// deduplicates the pair. Returns undefined when there is nothing to track.
export function trackTiktokViewContent(product, { value, eventId } = {}) {
  const id = productContentId(product);
  if (!id) return undefined;
  const name = product?.name || product?.name_ar;
  const price = Number(value ?? product?.price) || undefined;
  const evtId = eventId || newEventId();
  track("ViewContent", {
    contents: [{ content_id: id, content_name: name || undefined, quantity: 1, price }],
    content_type: "product",
    currency: META_CURRENCY,
    value: price,
  }, evtId);
  return evtId;
}

export function trackTiktokAddToCart({ product, quantity = 1, value, eventId }) {
  const id = productContentId(product);
  if (!id) return undefined;
  const qty = Math.max(1, Number(quantity) || 1);
  const unit = Number(value ?? product?.price) || 0;
  const name = product?.name || product?.name_ar;
  const evtId = eventId || newEventId();
  track("AddToCart", {
    contents: [{ content_id: id, content_name: name || undefined, quantity: qty, price: unit }],
    content_type: "product",
    currency: META_CURRENCY,
    value: unit * qty,
  }, evtId);
  return evtId;
}

export function trackTiktokInitiateCheckout({ items, value, eventId }) {
  const contents = tiktokContentsFromItems(items);
  if (contents.length === 0) return undefined;
  const evtId = eventId || newEventId();
  track("InitiateCheckout", {
    contents,
    content_type: "product",
    currency: META_CURRENCY,
    value: Number(value) || undefined,
  }, evtId);
  return evtId;
}

// Fire the browser CompletePayment event. Pass the SAME eventId to the server
// Events API call so TikTok deduplicates the two into one conversion.
export function trackTiktokPurchase({ items, value, eventId }) {
  const contents = tiktokContentsFromItems(items);
  if (contents.length === 0) return;
  track("CompletePayment", {
    contents,
    content_type: "product",
    currency: META_CURRENCY,
    value: Number(value) || 0,
  }, eventId);
}

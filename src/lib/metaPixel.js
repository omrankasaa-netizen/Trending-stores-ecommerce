// Browser-side Meta (Facebook) Pixel — env-driven and consent-gated.
//
// Design rules (see docs/META_TRACKING.md):
//  • Silent no-op when VITE_META_PIXEL_ID is unset — the site must never break.
//  • The pixel is loaded ONLY after the shopper grants consent (stored in
//    localStorage). No network call to Facebook happens before consent.
//  • event_id is generated per event so the browser Pixel and the server-side
//    Conversions API can be deduplicated by Meta (send the SAME id from both).
//  • content_ids are normalized (uppercase+trim) at the Meta boundary via
//    metaShared so they match the catalog feed and server events exactly.

import { META_CURRENCY, productContentId, buildContents } from "./metaShared.js";

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "";
const CONSENT_KEY = "ts_meta_consent"; // "granted" | "denied" (absent = undecided)

let loaded = false;

export function metaPixelId() {
  return PIXEL_ID;
}

export function isPixelConfigured() {
  return !!PIXEL_ID;
}

export function getConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) || "";
  } catch {
    return "";
  }
}

export function hasConsentDecision() {
  const c = getConsent();
  return c === "granted" || c === "denied";
}

function consentGranted() {
  return getConsent() === "granted";
}

// Inject the standard fbevents.js loader exactly once. No-op without a pixel id.
function loadPixelScript() {
  if (loaded || !PIXEL_ID) return;
  if (typeof window === "undefined") return;
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("init", PIXEL_ID);
  loaded = true;
}

// Called on app start and whenever consent changes. Loads + fires the first
// PageView only once consent is granted.
export function initMetaPixel() {
  if (!PIXEL_ID || !consentGranted()) return;
  loadPixelScript();
}

export function grantConsent() {
  try { localStorage.setItem(CONSENT_KEY, "granted"); } catch { /* ignore */ }
  initMetaPixel();
  trackPageView();
}

export function denyConsent() {
  try { localStorage.setItem(CONSENT_KEY, "denied"); } catch { /* ignore */ }
}

// Generate a dedup id shared between the Pixel event and the CAPI event.
export function newEventId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Core track — every helper funnels through here. Fully guarded so a missing
// pixel id or withheld consent means nothing is ever sent.
function track(eventName, params = {}, eventId) {
  if (!PIXEL_ID || !consentGranted()) return;
  if (typeof window === "undefined" || !window.fbq) return;
  const opts = eventId ? { eventID: eventId } : undefined;
  if (opts) window.fbq("track", eventName, params, opts);
  else window.fbq("track", eventName, params);
}

export function trackPageView() {
  track("PageView");
}

export function trackViewContent(product, { value } = {}) {
  const id = productContentId(product);
  if (!id) return;
  track("ViewContent", {
    content_ids: [id],
    content_type: "product",
    content_name: product?.name || product?.name_ar || undefined,
    currency: META_CURRENCY,
    value: Number(value ?? product?.price) || undefined,
  });
}

export function trackAddToCart({ product, quantity = 1, value }) {
  const id = productContentId(product);
  if (!id) return;
  const unit = Number(value ?? product?.price) || 0;
  track("AddToCart", {
    content_ids: [id],
    content_type: "product",
    content_name: product?.name || product?.name_ar || undefined,
    currency: META_CURRENCY,
    value: unit * Math.max(1, Number(quantity) || 1),
    contents: [{ id, quantity: Math.max(1, Number(quantity) || 1), item_price: unit }],
  });
}

export function trackInitiateCheckout({ items, value }) {
  const { contents, content_ids } = buildContents(items);
  if (content_ids.length === 0) return;
  track("InitiateCheckout", {
    content_ids,
    content_type: "product",
    contents,
    num_items: contents.reduce((s, c) => s + (c.quantity || 1), 0),
    currency: META_CURRENCY,
    value: Number(value) || undefined,
  });
}

// Fire the browser Purchase event. Pass the SAME eventId to the server CAPI call
// so Meta deduplicates the two into one conversion.
export function trackPurchase({ items, value, eventId }) {
  const { contents, content_ids } = buildContents(items);
  if (content_ids.length === 0) return;
  track(
    "Purchase",
    {
      content_ids,
      content_type: "product",
      contents,
      num_items: contents.reduce((s, c) => s + (c.quantity || 1), 0),
      currency: META_CURRENCY,
      value: Number(value) || 0,
    },
    eventId
  );
}

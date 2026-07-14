// Server-side Meta Conversions API (CAPI). This is the AUTHORITATIVE Purchase
// signal — it fires from the backend where the true order total lives and cannot
// be blocked by ad-blockers. It shares an event_id with the browser Pixel
// Purchase so Meta deduplicates them into a single conversion.
//
// Rules (see docs/META_TRACKING.md):
//  • Fully env-driven. Silent no-op if TRENDING_META_PIXEL_ID or
//    TRENDING_META_CAPI_ACCESS_TOKEN is unset — never throws, never breaks
//    checkout.
//  • No secrets in code. The access token comes only from the environment.
//  • PII (email/phone) is SHA-256 hashed before it ever leaves the server, per
//    Meta's requirements.

import crypto from "node:crypto";
import { META_CURRENCY, buildContents, normalizeContentId } from "../src/lib/metaShared.js";

const GRAPH_VERSION = "v19.0";

// The only non-Purchase events allowed on the generic CAPI path. Purchase has a
// dedicated authoritative path (sendCapiPurchase) and must NEVER be accepted
// here — that keeps the order total / idempotency guarantees in one place.
const ALLOWED_EVENTS = new Set(["ViewContent", "AddToCart", "InitiateCheckout"]);

export function isEventAllowed(eventName) {
  return ALLOWED_EVENTS.has(eventName);
}

function pixelId() {
  return process.env.TRENDING_META_PIXEL_ID || "";
}
function accessToken() {
  return process.env.TRENDING_META_CAPI_ACCESS_TOKEN || "";
}
function testEventCode() {
  return process.env.TRENDING_META_TEST_EVENT_CODE || "";
}

export function isCapiConfigured() {
  return !!pixelId() && !!accessToken();
}

// Meta requires user identifiers to be normalized (lowercase/trim) then SHA-256
// hashed. Phones keep digits only.
function hashField(value) {
  const v = String(value == null ? "" : value).trim().toLowerCase();
  if (!v) return undefined;
  return crypto.createHash("sha256").update(v).digest("hex");
}
function hashPhone(value) {
  const digits = String(value == null ? "" : value).replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  return crypto.createHash("sha256").update(digits).digest("hex");
}

// Build the CAPI user_data block from an order, hashing all PII. Empty fields
// are omitted so we never send blank hashes.
function userDataFromOrder(order) {
  const ud = {};
  const em = hashField(order.customer_email);
  const ph = hashPhone(order.customer_phone);
  const fn = hashField(order.customer_name ? String(order.customer_name).split(/\s+/)[0] : "");
  const ct = hashField(order.customer_city);
  if (em) ud.em = [em];
  if (ph) ud.ph = [ph];
  if (fn) ud.fn = [fn];
  if (ct) ud.ct = [ct];
  return ud;
}

// Build the CAPI user_data block for a non-Purchase browsing event from the
// REQUEST context only. These are Meta's non-PII match keys — the client IP and
// user-agent (used as-is, never hashed) and the _fbp/_fbc browser cookies. We
// deliberately do NOT accept email/phone for these events, so nothing here is
// PII and nothing needs hashing. Empty fields are omitted.
export function buildRequestUserData(ctx = {}) {
  const ud = {};
  if (ctx.ip) ud.client_ip_address = String(ctx.ip);
  if (ctx.userAgent) ud.client_user_agent = String(ctx.userAgent);
  if (ctx.fbp) ud.fbp = String(ctx.fbp);
  if (ctx.fbc) ud.fbc = String(ctx.fbc);
  return ud;
}

// Generic server-side CAPI event for the three browsing events. Mirrors the
// Purchase envelope (event_id shared with the browser Pixel → Meta dedupes the
// pair) but carries only non-PII user_data. content_ids are re-normalized here
// (same rule as the catalog feed) so they always match. Returns a plain status
// object; never throws; silent no-op when Meta env is unset. Purchase is
// rejected — it stays on the dedicated authoritative path.
export async function sendCapiEvent({
  eventName, eventId, sourceUrl, contents, contentIds, value, userData,
} = {}) {
  if (!isCapiConfigured()) return { ok: false, skipped: true, reason: "not_configured" };
  if (!isEventAllowed(eventName)) return { ok: false, skipped: true, reason: "event_not_allowed" };

  const ids = (Array.isArray(contentIds) ? contentIds : [])
    .map(normalizeContentId)
    .filter(Boolean);
  const normContents = (Array.isArray(contents) ? contents : [])
    .map((c) => {
      const id = normalizeContentId(c?.id);
      if (!id) return null;
      const out = { id, quantity: Math.max(1, Number(c?.quantity) || 1) };
      const price = Number(c?.item_price);
      if (Number.isFinite(price)) out.item_price = price;
      return out;
    })
    .filter(Boolean);

  const custom_data = { content_type: "product" };
  if (ids.length) custom_data.content_ids = ids;
  if (normContents.length) custom_data.contents = normContents;
  const numValue = Number(value);
  if (Number.isFinite(numValue)) {
    custom_data.value = numValue;
    custom_data.currency = META_CURRENCY;
  }

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId || undefined,
    action_source: "website",
    user_data: userData || {},
    custom_data,
  };
  if (sourceUrl) event.event_source_url = sourceUrl;

  const payload = { data: [event] };
  const code = testEventCode();
  if (code) payload.test_event_code = code;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId()}/events?access_token=${encodeURIComponent(accessToken())}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, status: resp.status, error: json?.error?.message || "CAPI error" };
    return { ok: true, events_received: json?.events_received };
  } catch (e) {
    return { ok: false, error: e?.message || "CAPI request failed" };
  }
}

// Send a server-side Purchase event for an order. Returns a plain status object;
// never throws. `eventId` MUST match the browser Pixel Purchase eventID for
// deduplication.
export async function sendCapiPurchase({ order, eventId }) {
  if (!isCapiConfigured()) return { ok: false, skipped: true, reason: "not_configured" };
  if (!order) return { ok: false, skipped: true, reason: "no_order" };

  const { contents, content_ids } = buildContents(order.items);
  const eventTime = Math.floor(Date.now() / 1000);

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: eventTime,
        event_id: eventId || `order_${order.id}`,
        action_source: "website",
        user_data: userDataFromOrder(order),
        custom_data: {
          currency: META_CURRENCY,
          value: Number(order.total) || 0,
          content_type: "product",
          content_ids,
          contents,
          num_items: contents.reduce((s, c) => s + (c.quantity || 1), 0),
          order_id: order.order_number || order.id,
        },
      },
    ],
  };
  const code = testEventCode();
  if (code) payload.test_event_code = code;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId()}/events?access_token=${encodeURIComponent(accessToken())}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, status: resp.status, error: json?.error?.message || "CAPI error" };
    return { ok: true, events_received: json?.events_received };
  } catch (e) {
    // Network / transient failure must never break the order flow.
    return { ok: false, error: e?.message || "CAPI request failed" };
  }
}

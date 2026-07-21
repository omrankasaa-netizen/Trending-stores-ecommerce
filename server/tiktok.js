// Server-side TikTok Events API. This is the parallel twin of server/meta.js
// (see docs/TIKTOK_TRACKING.md). CompletePayment is the AUTHORITATIVE purchase
// signal — it fires from the backend where the true order total lives and cannot
// be blocked by ad-blockers. It shares an event_id with the browser Pixel
// CompletePayment so TikTok deduplicates them into a single conversion.
//
// Rules (identical philosophy to server/meta.js):
//  • Fully env-driven. Silent no-op if TRENDING_TIKTOK_PIXEL_ID or
//    TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN is unset — never throws, never
//    breaks checkout.
//  • No secrets in code. The access token comes only from the environment.
//  • PII (email/phone/external_id) is SHA-256 hashed before it ever leaves the
//    server, per TikTok's requirements.

import crypto from "node:crypto";
import { META_CURRENCY, buildContents, normalizeContentId } from "../src/lib/metaShared.js";

const EVENTS_API_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

// The only non-CompletePayment events allowed on the generic path. CompletePayment
// has a dedicated authoritative path (sendTiktokPurchase) and must NEVER be
// accepted here — that keeps the order total / idempotency guarantees in one place
// (mirrors server/meta.js's exclusion of Purchase).
const ALLOWED_EVENTS = new Set(["ViewContent", "AddToCart", "InitiateCheckout"]);

export function isEventAllowed(eventName) {
  return ALLOWED_EVENTS.has(eventName);
}

function pixelId() {
  return process.env.TRENDING_TIKTOK_PIXEL_ID || "";
}
function accessToken() {
  return process.env.TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN || "";
}
function testEventCode() {
  return process.env.TRENDING_TIKTOK_TEST_EVENT_CODE || "";
}

export function isEventsApiConfigured() {
  return !!pixelId() && !!accessToken();
}

// TikTok requires user identifiers to be normalized (lowercase/trim) then SHA-256
// hashed. Phones keep digits only. Same approach as server/meta.js hashField/hashPhone.
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

// Build the TikTok `user` block from an order, hashing all PII. Empty fields are
// omitted so we never send blank hashes.
function userFromOrder(order) {
  const user = {};
  const em = hashField(order.customer_email);
  const ph = hashPhone(order.customer_phone);
  const ext = hashField(order.user_id || order.customer_email);
  if (em) user.email = em;
  if (ph) user.phone = ph;
  if (ext) user.external_id = ext;
  return user;
}

// Build the TikTok `user` block for a non-CompletePayment browsing event from the
// REQUEST context only. These are TikTok's non-PII match keys — the client IP and
// user-agent (used as-is, never hashed) and the ttclid/_ttp cookies (directly
// analogous to Meta's fbc/fbp). No email/phone is accepted for these events, so
// nothing here is PII and nothing needs hashing. Empty fields are omitted.
export function buildRequestUser(ctx = {}) {
  const user = {};
  if (ctx.ip) user.ip = String(ctx.ip);
  if (ctx.userAgent) user.user_agent = String(ctx.userAgent);
  if (ctx.ttclid) user.ttclid = String(ctx.ttclid);
  if (ctx.ttp) user.ttp = String(ctx.ttp);
  return user;
}

// Normalize an incoming `contents` array to TikTok's shape, re-normalizing the
// content_id the same way as the catalog/Meta boundary so identifiers always
// match across platforms. Quantities default to 1.
function normalizeContents(contents) {
  return (Array.isArray(contents) ? contents : [])
    .map((c) => {
      const content_id = normalizeContentId(c?.content_id ?? c?.id);
      if (!content_id) return null;
      const out = { content_id, quantity: Math.max(1, Number(c?.quantity) || 1) };
      const price = Number(c?.price ?? c?.item_price);
      if (Number.isFinite(price)) out.price = price;
      if (c?.content_name) out.content_name = String(c.content_name);
      return out;
    })
    .filter(Boolean);
}

// POST a single event envelope to the TikTok Events API. Returns a plain status
// object; never throws.
async function postEvent(eventData) {
  const payload = {
    event_source: "web",
    event_source_id: pixelId(),
    data: [eventData],
  };
  const code = testEventCode();
  if (code) payload.test_event_code = code;

  try {
    const resp = await fetch(EVENTS_API_URL, {
      method: "POST",
      headers: {
        "Access-Token": accessToken(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    // TikTok returns HTTP 200 with a body-level `code` (0 = success). Treat a
    // non-zero code as a failure so transient errors can be retried.
    if (!resp.ok) return { ok: false, status: resp.status, error: json?.message || "Events API error" };
    if (json && typeof json.code === "number" && json.code !== 0) {
      return { ok: false, code: json.code, error: json.message || "Events API rejected" };
    }
    return { ok: true, code: json?.code };
  } catch (e) {
    return { ok: false, error: e?.message || "Events API request failed" };
  }
}

// Generic server-side event for the three browsing events. Mirrors the
// CompletePayment envelope (event_id shared with the browser Pixel → TikTok dedupes
// the pair) but carries only non-PII user match keys. Returns a plain status
// object; never throws; silent no-op when TikTok env is unset. CompletePayment is
// rejected — it stays on the dedicated authoritative path.
export async function sendTiktokEvent({
  eventName, eventId, sourceUrl, contents, value, userData,
} = {}) {
  if (!isEventsApiConfigured()) return { ok: false, skipped: true, reason: "not_configured" };
  if (!isEventAllowed(eventName)) return { ok: false, skipped: true, reason: "event_not_allowed" };

  const normContents = normalizeContents(contents);

  const properties = { content_type: "product" };
  if (normContents.length) properties.contents = normContents;
  const numValue = Number(value);
  if (Number.isFinite(numValue)) {
    properties.value = numValue;
    properties.currency = META_CURRENCY;
  }

  const event = {
    event: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId || undefined,
    user: userData || {},
    properties,
  };
  if (sourceUrl) event.page = { url: sourceUrl };

  return await postEvent(event);
}

// Send a server-side CompletePayment event for an order. Returns a plain status
// object; never throws. `eventId` MUST match the browser Pixel CompletePayment
// event_id for deduplication.
export async function sendTiktokPurchase({ order, eventId }) {
  if (!isEventsApiConfigured()) return { ok: false, skipped: true, reason: "not_configured" };
  if (!order) return { ok: false, skipped: true, reason: "no_order" };

  const { contents } = buildContents(order.items);
  const ttContents = contents.map((c) => {
    const out = { content_id: c.id, quantity: c.quantity };
    if (Number.isFinite(Number(c.item_price))) out.price = Number(c.item_price);
    return out;
  });

  const event = {
    event: "CompletePayment",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId || `order_${order.id}`,
    user: userFromOrder(order),
    properties: {
      content_type: "product",
      currency: META_CURRENCY,
      value: Number(order.total) || 0,
      contents: ttContents,
    },
  };

  return await postEvent(event);
}

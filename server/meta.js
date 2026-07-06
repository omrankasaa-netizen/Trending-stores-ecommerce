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
import { META_CURRENCY, buildContents } from "../src/lib/metaShared.js";

const GRAPH_VERSION = "v19.0";

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

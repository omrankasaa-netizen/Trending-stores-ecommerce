// Browser → server-side Meta CAPI twin for the three browsing events
// (ViewContent / AddToCart / InitiateCheckout). Hands the SAME event_id the
// browser Pixel used to the backend so Meta deduplicates the pair into one
// event. Fully fire-and-forget: consent-gated (mirrors the browser Pixel),
// never blocks the UI, never throws. No PII is sent — the server derives its
// non-PII match keys (ip / user-agent / _fbp / _fbc) from the request itself.

import { base44 } from "@/api/base44Client";
import { getConsent } from "@/lib/metaPixel";

export function sendServerCapiEvent({ event_name, event_id, content_ids, contents, value } = {}) {
  try {
    // No id means the browser Pixel didn't track it → nothing to dedupe against.
    if (!event_id) return;
    // Respect the same consent gate as the browser Pixel.
    if (getConsent() !== "granted") return;
    base44.functions
      .metaTrackEvent({
        event_name,
        event_id,
        source_url: typeof window !== "undefined" ? window.location.href : undefined,
        content_ids,
        contents,
        value,
      })
      .catch(() => {});
  } catch {
    /* server tracking must never break the storefront */
  }
}

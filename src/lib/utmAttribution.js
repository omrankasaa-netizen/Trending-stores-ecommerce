import { getStorageItem, removeStorageItem, setStorageItem } from "./safeStorage.js";

const ATTR_KEY = "ts_utm_attribution_v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

function normalizeUtmValue(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

function parseStored(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const out = {};
    for (const key of UTM_KEYS) {
      const norm = normalizeUtmValue(parsed[key]);
      if (norm) out[key] = norm;
    }
    if (!Object.keys(out).length) return null;
    if (parsed.captured_at) out.captured_at = String(parsed.captured_at);
    if (parsed.landing_path) out.landing_path = String(parsed.landing_path);
    if (parsed.landing_url) out.landing_url = String(parsed.landing_url);
    return out;
  } catch {
    return null;
  }
}

function readAttribution() {
  return parseStored(getStorageItem(ATTR_KEY));
}

export function getUtmAttribution() {
  return readAttribution();
}

export function clearUtmAttribution() {
  removeStorageItem(ATTR_KEY);
}

// Capture first-touch UTM parameters from a landing URL. Later route changes
// without explicit UTMs keep the existing attribution as-is.
export function captureUtmAttribution({ search, path, href } = {}) {
  const qs = String(search || "");
  if (!qs.includes("utm_")) return readAttribution();

  const params = new URLSearchParams(qs.startsWith("?") ? qs : `?${qs}`);
  const payload = {};
  for (const key of UTM_KEYS) {
    const norm = normalizeUtmValue(params.get(key));
    if (norm) payload[key] = norm;
  }

  if (!Object.keys(payload).length) return readAttribution();

  const current = readAttribution();
  // Keep first-touch URL context stable, but refresh UTM values if an explicit
  // UTM-bearing landing URL is visited again.
  const out = {
    ...payload,
    captured_at: new Date().toISOString(),
    landing_path: current?.landing_path || String(path || ""),
    landing_url: current?.landing_url || String(href || ""),
  };
  setStorageItem(ATTR_KEY, JSON.stringify(out));
  return out;
}

export function checkoutAttributionFields() {
  const attr = readAttribution();
  if (!attr) return {};
  return {
    utm_source: attr.utm_source || undefined,
    utm_medium: attr.utm_medium || undefined,
    utm_campaign: attr.utm_campaign || undefined,
    utm_content: attr.utm_content || undefined,
    utm_term: attr.utm_term || undefined,
    attribution_captured_at: attr.captured_at || undefined,
    attribution_landing_path: attr.landing_path || undefined,
    attribution_landing_url: attr.landing_url || undefined,
  };
}


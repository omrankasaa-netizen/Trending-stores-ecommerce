import { META_CURRENCY, productContentId } from "./metaShared.js";

const MEASUREMENT_ID = String(import.meta.env.VITE_GA4_MEASUREMENT_ID || "").trim();
let initialized = false;

function isConfigured() {
  return !!MEASUREMENT_ID;
}

function gtagAvailable() {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

function loadGa4Script() {
  if (typeof window === "undefined" || !isConfigured()) return;
  const existing = document.querySelector(`script[data-ga4-id="${MEASUREMENT_ID}"]`);
  if (existing) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  script.setAttribute("data-ga4-id", MEASUREMENT_ID);
  document.head.appendChild(script);
}

export function initGa4() {
  if (initialized || !isConfigured() || typeof window === "undefined") return;
  loadGa4Script();
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
  window.gtag("js", new Date());
  // We dispatch SPA page_view manually on route changes.
  window.gtag("config", MEASUREMENT_ID, { send_page_view: false });
  initialized = true;
}

function track(eventName, params = {}) {
  if (!isConfigured() || !gtagAvailable()) return;
  window.gtag("event", eventName, params);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toItem(item = {}) {
  const itemId = productContentId(item);
  if (!itemId) return null;
  const price = toNumber(item.price);
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const out = {
    item_id: itemId,
    item_name: item.product_name || item.name || item.name_ar || itemId,
    quantity,
  };
  if (price != null) out.price = price;
  const variant = [item.size_label || item.size_label_ar || "", item.offer_label || item.offer_label_ar || ""]
    .filter(Boolean)
    .join(" · ");
  if (variant) out.item_variant = variant;
  return out;
}

export function trackGa4PageView({ path, title, location } = {}) {
  track("page_view", {
    page_path: path || undefined,
    page_title: title || undefined,
    page_location: location || undefined,
  });
}

export function trackGa4ViewItem(product, { value, currency = META_CURRENCY } = {}) {
  const item = toItem(product);
  if (!item) return;
  const price = toNumber(value ?? product?.price);
  track("view_item", {
    currency,
    value: price,
    items: [item],
  });
}

export function trackGa4AddToCart({ product, quantity = 1, value, currency = META_CURRENCY } = {}) {
  const item = toItem({ ...product, quantity });
  if (!item) return;
  const unit = toNumber(value ?? product?.price) || 0;
  const qty = Math.max(1, Number(quantity) || 1);
  track("add_to_cart", {
    currency,
    value: unit * qty,
    items: [{ ...item, quantity: qty, ...(toNumber(unit) != null ? { price: unit } : {}) }],
  });
}

export function trackGa4BeginCheckout({ items, value, currency = META_CURRENCY } = {}) {
  const mapped = (Array.isArray(items) ? items : []).map(toItem).filter(Boolean);
  if (mapped.length === 0) return;
  track("begin_checkout", {
    currency,
    value: toNumber(value),
    items: mapped,
  });
}

export function trackGa4Purchase({ orderId, transactionId, value, currency = META_CURRENCY, items } = {}) {
  const mapped = (Array.isArray(items) ? items : []).map(toItem).filter(Boolean);
  if (mapped.length === 0) return;
  const tx = String(transactionId || orderId || "").trim();
  if (!tx) return;
  track("purchase", {
    transaction_id: tx,
    order_id: orderId || undefined,
    value: toNumber(value) || 0,
    currency,
    items: mapped,
  });
}


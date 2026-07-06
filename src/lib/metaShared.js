// Shared Meta (Facebook) helpers used by BOTH the browser pixel and the
// server-side Conversions API + catalog feed, so a product's identifier is
// IDENTICAL everywhere. Meta deduplicates and matches catalog items by
// content_id, so the storefront pixel, the server CAPI event and the feed's
// `id` column MUST all emit the same normalized value.

export const META_CURRENCY = "USD";

// Normalize any identifier to the canonical form used at the Meta boundary:
// uppercase + trimmed. Applied consistently so "abc123 " and "ABC123" collapse
// to one catalog item.
export function normalizeContentId(value) {
  return String(value == null ? "" : value).trim().toUpperCase();
}

// The catalog/tracking identifier for a product. Prefers an explicit SKU when
// present, else falls back to the product id — whichever it is, it is
// normalized the same way on every surface (pixel, CAPI, feed).
export function productContentId(product) {
  if (!product) return "";
  return normalizeContentId(product.sku || product.id || product._id || "");
}

// Build the `contents` array (per-line id + quantity) and the parallel
// `content_ids` array from cart/order line items. Quantities default to 1.
export function buildContents(items) {
  const list = Array.isArray(items) ? items : [];
  const contents = list
    .map((it) => {
      const id = normalizeContentId(it.sku || it.product_id || it.id || it._id || "");
      if (!id) return null;
      const quantity = Math.max(1, Number(it.quantity) || 1);
      const c = { id, quantity };
      const price = Number(it.price);
      if (Number.isFinite(price)) c.item_price = price;
      return c;
    })
    .filter(Boolean);
  const content_ids = contents.map((c) => c.id);
  return { contents, content_ids };
}

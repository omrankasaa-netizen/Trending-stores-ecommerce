// Shared helpers for product image framing in the fixed 3:4 portrait card.
//
// Images are stored non-destructively. Each image is an object:
//   { url: string, focal?: {x,y}, crop?: {x,y,width,height} }
// where focal/crop coordinates are normalized 0..1. The original upload is never
// modified — framing is applied purely via CSS (object-position + transform).
//
// Backwards compatible: products that only have the legacy single `image_url`
// (or a plain array of URL strings) still work and render centered.

const PLACEHOLDER = "https://placehold.co/600x800?text=Product";

// ── Cloudflare on-the-fly image resizing ─────────────────────────────────────
// Trending product images live on Cloudflare R2 behind a custom image domain.
// Rather than ship a multi-MB original to a 200px grid slot, we route the URL
// through Cloudflare's image-resizing endpoint (/cdn-cgi/image/<opts>/<orig>).
// Cloudflare resizes once, re-encodes to the best modern format (AVIF/WebP), and
// edge-caches each size. The original file is never modified.
//
// Requires "Image Resizing/Transformations" enabled on the Cloudflare zone. It
// is GATED: set CF_IMAGE_RESIZE = false to instantly revert to originals, and we
// ONLY rewrite URLs whose host is listed in CF_RESIZE_HOSTS. Trending's own R2
// custom image domain goes in that set (e.g. "images.trendingstore.store"); it
// is left EMPTY by default so nothing breaks until the owner adds their domain.
const CF_IMAGE_RESIZE = true;
const CF_RESIZE_HOSTS = new Set([
  // Add Trending Store's own Cloudflare R2 image domain here once known, e.g.:
  // "images.trendingstore.store",
]);
const CF_SIZE_WIDTH = { thumb: 320, card: 600, large: 1200 };

function cfResize(url, size) {
  if (!CF_IMAGE_RESIZE || !url) return url;
  if (!/^https?:\/\//i.test(url)) return url;       // skip data:/blob:/relative
  if (url.includes("/cdn-cgi/image/")) return url;  // already transformed
  let u;
  try { u = new URL(url); } catch { return url; }
  if (!CF_RESIZE_HOSTS.has(u.host)) return url;      // only our R2 host(s)
  const width = CF_SIZE_WIDTH[size] || CF_SIZE_WIDTH.card;
  const opts = `width=${width},quality=80,format=auto,fit=scale-down`;
  return `${u.origin}/cdn-cgi/image/${opts}${u.pathname}${u.search}`;
}

// Pick the best derivative URL for a desired size from a normalized image, then
// route through Cloudflare resizing. Variant-aware (uses image.variants when the
// upload produced large/card/thumb webp derivatives); falls back to the single
// canonical URL for legacy/string images.
export function imageSrc(image, size = "card") {
  const img = normalizeImage(image);
  if (!img) return PLACEHOLDER;
  const v = img.variants;
  if (v) {
    const order = {
      large: ["large", "card", "thumb"],
      card: ["card", "large", "thumb"],
      thumb: ["thumb", "card", "large"],
    }[size] || ["card", "large", "thumb"];
    for (const k of order) if (v[k]) return v[k];
  }
  return cfResize(img.url, size);
}

// Right-size a single CMS/banner/icon URL (which stores only one canonical
// .../card.webp). Swaps to the sibling derivative for the requested size when it
// is one of our generated variants, then Cloudflare-resizes as a final step.
export function cmsImageSrc(rawUrl, size = "large") {
  const url = typeof rawUrl === "string" ? rawUrl : (rawUrl?.url || "");
  if (!url) return "";
  const swapped = url.replace(/\/(large|card|thumb)\.webp(\?.*)?$/i,
    (_m, _old, q) => `/${size}.webp${q || ""}`);
  return cfResize(swapped, size);
}

// Normalize one stored image entry (string URL or object) into a full object.
function normalizeImage(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return entry ? { url: entry, focal: null, crop: null, variants: null } : null;
  }
  if (typeof entry === "object" && entry.url) {
    return {
      url: entry.url,
      focal: entry.focal || null,
      crop: entry.crop || null,
      variants: entry.variants && typeof entry.variants === "object" ? entry.variants : null,
    };
  }
  return null;
}

// Return the ordered list of image objects for a product, merging the new
// `images` array with the legacy `image_url` so nothing existing breaks.
export function getProductImages(product) {
  if (!product) return [];
  const list = [];
  if (Array.isArray(product.images)) {
    for (const entry of product.images) {
      const img = normalizeImage(entry);
      if (img) list.push(img);
    }
  }
  // Fall back to / include the legacy single field when no images array entries.
  if (list.length === 0 && product.image_url) {
    const legacy = normalizeImage(product.image_url);
    if (legacy) list.push(legacy);
  }
  return list;
}

// Convenience: the primary image url for a product (or a placeholder).
export function getPrimaryImageUrl(product) {
  const imgs = getProductImages(product);
  return imgs[0]?.url || product?.image_url || PLACEHOLDER;
}

// Build the inline <img> style that frames a single image inside a 3:4 box.
// - object-cover (via className) ensures the box is always filled.
// - focal point drives object-position.
// - crop (normalized 3:4 region) is realized by scaling the image up and
//   translating it so the crop region fills the box. Non-destructive: the
//   original pixels are untouched; we just show a window into them.
export function getImageFrameStyle(image) {
  const focal = image?.focal;
  const crop = image?.crop;

  // Default object-position from focal point (or centered).
  const px = focal && Number.isFinite(focal.x) ? clamp01(focal.x) : 0.5;
  const py = focal && Number.isFinite(focal.y) ? clamp01(focal.y) : 0.5;

  if (!crop || !isValidCrop(crop)) {
    return {
      objectPosition: `${px * 100}% ${py * 100}%`,
    };
  }

  // With a crop region we switch to a transform-based window. The container is
  // 3:4 and the crop is constrained to 3:4, so a uniform scale fills the box.
  const scale = 1 / crop.width;
  // Translate so the crop's top-left maps to the box's top-left, expressed as a
  // percentage of the (scaled) image. Using object-cover would fight this, so
  // the carousel/card renders cropped images with object-fill + transform.
  const tx = -crop.x * 100;
  const ty = -crop.y * 100;
  return {
    width: "100%",
    height: "100%",
    transformOrigin: "top left",
    transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
  };
}

// Whether an image has a usable crop region (so callers can pick object-fit).
export function hasCrop(image) {
  return !!(image && isValidCrop(image.crop));
}

function isValidCrop(crop) {
  return (
    crop &&
    Number.isFinite(crop.width) &&
    Number.isFinite(crop.height) &&
    crop.width > 0 &&
    crop.height > 0
  );
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

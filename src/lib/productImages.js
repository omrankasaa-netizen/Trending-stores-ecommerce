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

// Normalize one stored image entry (string URL or object) into a full object.
function normalizeImage(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return entry ? { url: entry, focal: null, crop: null } : null;
  }
  if (typeof entry === "object" && entry.url) {
    return {
      url: entry.url,
      focal: entry.focal || null,
      crop: entry.crop || null,
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

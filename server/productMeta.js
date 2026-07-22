// Server-side per-product SEO / social metadata for the SPA.
//
// Product detail pages are a client-rendered React SPA. Meta's (Facebook)
// crawler, WhatsApp's link-preview fetcher and Google's rich-result parser do
// NOT reliably execute JS, so without this they only ever saw the static
// index.html shell with the site-wide defaults. The Express server intercepts
// `/product/:id`, loads the product from the same SQLite DB the API uses, and
// rewrites the served index.html <head> with per-product OpenGraph product
// tags + JSON-LD Product schema BEFORE the SPA fallback. The marker region in
// index.html (TRENDING_SOCIAL_META_START/END) is replaced so no
// duplicate/conflicting og:type or canonical is left behind.

import { getRecord } from './db.js';
import { getGlobalMarkupPct } from './functions.js';
import { applyMarkup, markupPctForProduct } from '../src/lib/pricing.js';
import { productContentId, META_CURRENCY } from '../src/lib/metaShared.js';

export const SITE_BASE = process.env.TRENDING_SITE_BASE || 'https://trending-store.com';
const DEFAULT_SHARE_IMAGE = `${SITE_BASE}/seed/hero.jpg`;

const SOCIAL_START = '<!-- TRENDING_SOCIAL_META_START';
const SOCIAL_END = 'TRENDING_SOCIAL_META_END -->';

// Escape a string for safe interpolation into an HTML attribute value.
function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Look up a single product by its URL id. Returns null when not found.
export function getProductById(id) {
  if (!id || typeof id !== 'string') return null;
  try {
    return getRecord('Product', id) || null;
  } catch {
    return null;
  }
}

// Meta only auto-populates a catalog entry when it can read a numeric price.
// Return a "18.99"-style string, or null when the stored value is not a finite
// number (never invent a price).
function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

// Build the replacement <head> block (SEO + OG product tags + JSON-LD) for a
// product. Uses English fields — the crawler is locale-agnostic and the client
// still renders the localized UI. Returns an indented HTML string.
export function buildProductMetaBlock(product) {
  const url = `${SITE_BASE}/product/${product.id}`;
  // Catalog identifier for Meta's crawler / Pixel microdata scanner. MUST equal
  // the feed `id` exactly (Meta catalog matching is case-sensitive), so use the
  // SAME productContentId the feed applies — never the raw sku or a different
  // normalization.
  const contentId = productContentId(product);
  // Trim catalog values — trailing spaces in DB fields otherwise leak straight
  // into og:title / JSON-LD.
  const name = (product.name || 'Trending Store').trim();
  const socialDesc = (product.short_description || product.description || '').trim();
  const jsonLdDesc = (product.description || product.short_description || '').trim();
  // JSON-LD/OG image must be absolute.
  const rawImage = (product.image_url || '').trim();
  const image = rawImage
    ? (/^https?:\/\//i.test(rawImage) ? rawImage : `${SITE_BASE}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`)
    : DEFAULT_SHARE_IMAGE;
  // Availability mirrors the Meta feed rule: an active product whose
  // stock_quantity was never set at all is treated as available — only an
  // explicit 0 marks it out.
  const isActive = product.status === 'active';
  const stockQty = product.stock_quantity;
  const inStock = isActive && (stockQty == null || Number(stockQty) > 0);
  const availabilityOg = inStock ? 'in stock' : 'out of stock';
  const availabilitySchema = inStock
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';
  // Markup-inclusive price — what the customer actually pays, identical to the
  // feed and storefront (never the admin base price).
  const pct = markupPctForProduct(product, getGlobalMarkupPct());
  const price = formatPrice(applyMarkup(Number(product.price) || 0, pct));

  const lines = [];
  lines.push('<!-- Per-product SEO + Meta catalog microdata (server-injected) -->');
  lines.push(`<title>${escapeAttr(name)} | Trending Store</title>`);
  if (socialDesc) lines.push(`<meta name="description" content="${escapeAttr(socialDesc)}" />`);
  lines.push('<meta name="author" content="Trending Store" />');
  lines.push(`<link rel="canonical" href="${escapeAttr(url)}" />`);

  // Open Graph product tags — Meta's preferred catalog microdata source.
  lines.push('<meta property="og:type" content="product" />');
  lines.push('<meta property="og:site_name" content="Trending Store" />');
  lines.push(`<meta property="og:url" content="${escapeAttr(url)}" />`);
  lines.push(`<meta property="og:title" content="${escapeAttr(name)}" />`);
  if (socialDesc) lines.push(`<meta property="og:description" content="${escapeAttr(socialDesc)}" />`);
  lines.push(`<meta property="og:image" content="${escapeAttr(image)}" />`);
  lines.push('<meta property="og:locale" content="ar_AR" />');
  lines.push('<meta property="og:locale:alternate" content="en_US" />');
  if (contentId) lines.push(`<meta property="product:retailer_item_id" content="${escapeAttr(contentId)}" />`);
  if (price) {
    lines.push(`<meta property="product:price:amount" content="${escapeAttr(price)}" />`);
    lines.push(`<meta property="product:price:currency" content="${META_CURRENCY}" />`);
  }
  lines.push(`<meta property="product:availability" content="${availabilityOg}" />`);
  lines.push('<meta property="product:brand" content="Trending Store" />');
  lines.push('<meta property="product:condition" content="new" />');

  // Twitter card.
  lines.push('<meta name="twitter:card" content="summary_large_image" />');
  lines.push(`<meta name="twitter:title" content="${escapeAttr(name)}" />`);
  if (socialDesc) lines.push(`<meta name="twitter:description" content="${escapeAttr(socialDesc)}" />`);
  lines.push(`<meta name="twitter:image" content="${escapeAttr(image)}" />`);

  // JSON-LD Product schema.
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    ...(contentId ? { productID: contentId, sku: contentId } : {}),
    name,
    ...(jsonLdDesc ? { description: jsonLdDesc } : {}),
    ...(product.image_url ? { image } : {}),
    brand: { '@type': 'Brand', name: 'Trending Store' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: META_CURRENCY,
      ...(price ? { price } : {}),
      availability: availabilitySchema,
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
  // Escape `<` so a value can never break out of the <script> element.
  const jsonLdStr = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  lines.push(`<script type="application/ld+json">${jsonLdStr}</script>`);

  return lines.map((l) => `    ${l}`).join('\n');
}

// Replace the site-wide social-meta marker region in the index.html template
// with the per-product block. If the markers are missing (shouldn't happen with
// the shipped template), returns the template unchanged so the SPA still loads.
export function injectProductMeta(template, product) {
  const start = template.indexOf(SOCIAL_START);
  const endMarker = template.indexOf(SOCIAL_END);
  if (start === -1 || endMarker === -1) return template;
  const end = endMarker + SOCIAL_END.length;
  const block = buildProductMetaBlock(product);
  return template.slice(0, start) + block + template.slice(end);
}

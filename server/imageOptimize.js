// Optimize + store uploaded images (Trending Store).
//
// Every uploaded image (single /api/upload) flows through optimizeAndStore().
// It pipes the bytes through sharp to:
//   - auto-rotate from EXIF, then strip metadata
//   - resize DOWN to a set of widths (never upscale)
//   - re-encode as WebP (quality ~80)
// and writes each derivative through the storage adapter (R2 or local disk).
//
// Returns a descriptor with the canonical public URL plus a `variants` map and a
// `base` key so the frontend can request the right size:
//
//   { url, base, variants:{large,card,thumb}, optimized, format, width, height }
//
// RESILIENCE: if sharp throws on a particular file (corrupt, unsupported), we
// fall back to storing the ORIGINAL bytes once and flag optimized:false rather
// than aborting the whole upload.
import crypto from 'node:crypto';
import path from 'node:path';
import { getStorage, sanitizeKey } from './storage.js';

let _sharp = null;
async function loadSharp() {
  if (_sharp === null) {
    try {
      const mod = await import('sharp');
      _sharp = mod.default || mod;
    } catch {
      _sharp = false; // mark unavailable; we'll store originals
    }
  }
  return _sharp;
}

// Derivative widths. "large" is the detail-page image; "card" is the storefront
// grid / carousel; "thumb" is the gallery strip / tiny previews.
export const VARIANTS = [
  { name: 'large', width: 1600 },
  { name: 'card', width: 600 },
  { name: 'thumb', width: 300 },
];
const CANONICAL = 'card';

function makeBaseKey(filename) {
  const stem = path.basename(filename || 'image').replace(/\.[a-zA-Z0-9]+$/, '');
  const safe = (sanitizeKey(stem).slice(0, 60)) || 'image';
  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return `products/${id}-${safe}`;
}

function guessContentType(filename) {
  const ext = (path.extname(filename || '').toLowerCase().replace('.', '')) || 'bin';
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp',
  };
  return map[ext] || 'application/octet-stream';
}

export async function optimizeAndStore(buffer, filename) {
  const storage = await getStorage();
  const base = makeBaseKey(filename);
  const sharp = await loadSharp();

  if (sharp) {
    try {
      const results = await Promise.all(VARIANTS.map(async (v) => {
        const out = await sharp(buffer, { failOn: 'none' })
          .rotate()
          .resize({ width: v.width, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer({ resolveWithObject: true });
        const { url } = await storage.putObject(`${base}/${v.name}.webp`, out.data, 'image/webp');
        return { name: v.name, url, info: out.info };
      }));
      const variants = Object.fromEntries(results.map((r) => [r.name, r.url]));
      const large = results.find((r) => r.name === 'large')?.info || null;
      return {
        url: variants[CANONICAL] || variants.large,
        base,
        variants,
        optimized: true,
        format: 'webp',
        width: large ? large.width : null,
        height: large ? large.height : null,
      };
    } catch (e) {
      console.error(`[imageOptimize] sharp failed for "${filename}" (${e.message}); storing original`);
    }
  }

  // Fallback: store the original bytes once, unoptimized.
  const ext = (path.extname(filename || '').toLowerCase()) || '.bin';
  const key = `${base}/orig${ext}`;
  const { url } = await storage.putObject(key, buffer, guessContentType(filename));
  return {
    url,
    base,
    variants: null,
    optimized: false,
    format: ext.replace('.', '') || 'bin',
    width: null,
    height: null,
  };
}

// Decode a data/base64 payload (with or without a data: prefix) into a Buffer.
export function bufferFromBase64(content) {
  const data = content.includes(',') ? content.split(',')[1] : content;
  return Buffer.from(data, 'base64');
}

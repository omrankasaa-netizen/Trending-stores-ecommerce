// One-time, boot-time R2 public-host migration (idempotent).
//
// Product/CMS image URLs are stored in the DB as ABSOLUTE URLs baked at upload
// time (server/imageOptimize.js → storage.publicUrl()). When the bucket's
// public hostname changes — here from the auto-generated
//   https://pub-f5f0b1cd4f3b424fb3e1688852349e63.r2.dev
// to the custom domain served by R2_PUBLIC_BASE_URL (e.g.
// https://images.trending-store.com) — every previously stored URL keeps the
// old host. The object KEYS are identical on both hosts (same bucket), so the
// migration is a pure string-prefix swap inside the generic doc JSON.
//
// Design:
//  • Runs at every boot, after schema init + seed. Idempotent: once no doc
//    contains the old prefix, every subsequent boot updates 0 rows.
//  • Driven by the RUNTIME R2_PUBLIC_BASE_URL — the same var new uploads use,
//    so config can never drift between "where new URLs point" and "where old
//    URLs were rewritten to". Skips silently when the var is unset (local dev
//    / disk backend) or already equal to the legacy host.
//  • Raw SQL REPLACE on the doc column only; ids and updated_date are left
//    untouched so this stays invisible to the storefront and admin audit.
//  • Never throws: a failure logs a warning and boot continues (the old r2.dev
//    URLs still serve, so a skipped migration is degraded, not fatal).

import { db } from './db.js';

// The legacy auto-generated R2 dev host previously baked into stored URLs.
const LEGACY_PUBLIC_BASE = 'https://pub-f5f0b1cd4f3b424fb3e1688852349e63.r2.dev';

// Content tables whose docs can carry image URLs (image_url, images[] with
// variants, CMS gallery arrays, banners, category tiles, settings logos).
// Order/EmailLog/AuditLog etc. are intentionally excluded: they are records of
// past events, not storefront content, and must never be rewritten.
const IMAGE_TABLES = [
  'e_Product',
  'e_Category',
  'e_Banner',
  'e_SiteSettings',
  'e_CmsSection',
  'e_Testimonial',
];

function trimSlashes(s) {
  return String(s || '').replace(/\/+$/, '');
}

export function runR2HostMigration(env = process.env, log = console.log) {
  try {
    const newBase = trimSlashes(env.R2_PUBLIC_BASE_URL);
    if (!newBase || newBase === LEGACY_PUBLIC_BASE) return { migrated: false, rows: 0 };

    let total = 0;
    for (const table of IMAGE_TABLES) {
      const { changes } = db
        .prepare(`UPDATE ${table} SET doc = REPLACE(doc, ?, ?) WHERE instr(doc, ?) > 0`)
        .run(LEGACY_PUBLIC_BASE, newBase, LEGACY_PUBLIC_BASE);
      if (changes > 0) {
        log(`[r2-host-migration] ${table}: rewrote ${changes} row(s) ${LEGACY_PUBLIC_BASE} -> ${newBase}`);
        total += changes;
      }
    }
    if (total > 0) {
      log(`[r2-host-migration] done: ${total} row(s) now on ${newBase}`);
    }
    return { migrated: total > 0, rows: total };
  } catch (e) {
    console.warn(`[r2-host-migration] skipped after error: ${e?.message}`);
    return { migrated: false, rows: 0, error: e?.message };
  }
}

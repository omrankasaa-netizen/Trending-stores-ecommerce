import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CATEGORIES, slugifyCategory, mergeCategoryOptions,
} from '../src/lib/categories.js';

test('slugifyCategory: lowercases, trims, dashes spaces, tolerates null', () => {
  assert.equal(slugifyCategory('  Home Decor '), 'home-decor');
  assert.equal(slugifyCategory('Electronics'), 'electronics');
  assert.equal(slugifyCategory(null), '');
  assert.equal(slugifyCategory(undefined), '');
});

test('mergeCategoryOptions: null/empty rows fall back to the static defaults', () => {
  assert.deepEqual(mergeCategoryOptions(null), DEFAULT_CATEGORIES);
  assert.deepEqual(mergeCategoryOptions([]), DEFAULT_CATEGORIES);
});

test('mergeCategoryOptions: a newly created category appears in the options', () => {
  const rows = [{ name: 'Home Decor', name_ar: 'ديكور المنزل', slug: 'home-decor' }];
  const opts = mergeCategoryOptions(rows);
  const created = opts.find(o => o.value === 'home-decor');
  assert.ok(created, 'newly created category must appear in the product dropdown');
  assert.equal(created.labelEn, 'Home Decor');
  assert.equal(created.labelAr, 'ديكور المنزل');
});

test('mergeCategoryOptions: keeps static defaults so existing products keep labels', () => {
  const opts = mergeCategoryOptions([{ name: 'New Cat', slug: 'new-cat' }]);
  // Every shipped default is still present after merging.
  for (const d of DEFAULT_CATEGORIES) {
    assert.ok(opts.some(o => o.value === d.value), `default "${d.value}" must survive merge`);
  }
});

test('mergeCategoryOptions: derives slug from name when slug is missing', () => {
  const opts = mergeCategoryOptions([{ name: 'Office Supplies', name_ar: 'مستلزمات مكتبية' }]);
  const created = opts.find(o => o.value === 'office-supplies');
  assert.ok(created, 'slug should be derived from the English name');
  assert.equal(created.labelAr, 'مستلزمات مكتبية');
});

test('mergeCategoryOptions: a live row sharing a default slug overrides its labels', () => {
  const opts = mergeCategoryOptions([{ name: 'Gadgets', name_ar: 'أجهزة', slug: 'electronics' }]);
  const matches = opts.filter(o => o.value === 'electronics');
  assert.equal(matches.length, 1, 'no duplicate slug entries');
  assert.equal(matches[0].labelEn, 'Gadgets');
});

test('mergeCategoryOptions: bilingual fallback when one name is missing', () => {
  const opts = mergeCategoryOptions([{ name_ar: 'فقط عربي', slug: 'ar-only' }]);
  const created = opts.find(o => o.value === 'ar-only');
  assert.equal(created.labelEn, 'فقط عربي');
  assert.equal(created.labelAr, 'فقط عربي');
});

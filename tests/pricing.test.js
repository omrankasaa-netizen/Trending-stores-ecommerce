import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  markupPctForProduct, applyMarkup, getSizes, findSize, baseUnitPrice,
  getTiers, resolveTier, findTierByMin, resolveLineItem, buildOfferOptions,
  cartHasFreeDelivery, decrementStockPatch, restockStockPatch,
} from '../src/lib/pricing.js';

// ── Markup ────────────────────────────────────────────────────────────────
test('applyMarkup: 0% (or invalid) is a no-op, rounds to 2dp', () => {
  assert.equal(applyMarkup(10, 0), 10);
  assert.equal(applyMarkup(10, null), 10);
  assert.equal(applyMarkup(10, 'abc'), 10);
  assert.equal(applyMarkup(10, 25), 12.5);
});

test('markupPctForProduct: per-product override wins over global', () => {
  assert.equal(markupPctForProduct({ markup_pct: 15 }, 5), 15);
  assert.equal(markupPctForProduct({ markup_pct: 0 }, 5), 0); // explicit 0 override
  assert.equal(markupPctForProduct({}, 5), 5);                // fall back to global
  assert.equal(markupPctForProduct({ markup_pct: null }, 5), 5);
});

// ── Sizes ─────────────────────────────────────────────────────────────────
test('getSizes / findSize / baseUnitPrice honor the selected size price', () => {
  const product = {
    price: 10,
    sizes: [
      { id: 's', label: 'Small', price: 8, stock_quantity: 3 },
      { id: 'l', label: 'Large', price: 12, stock_quantity: 5 },
    ],
  };
  assert.equal(getSizes(product).length, 2);
  const large = findSize(product, 'l');
  assert.equal(large.price, 12);
  assert.equal(baseUnitPrice(product, large), 12);
  assert.equal(baseUnitPrice(product, null), 10); // no size → base price
});

// ── Tiers ─────────────────────────────────────────────────────────────────
test('getTiers filters invalid rows and sorts ascending', () => {
  const product = { tiers: [
    { min_quantity: 5, total_price: 40 },
    { min_quantity: 0, total_price: 1 },   // dropped
    { min_quantity: 3, total_price: 25 },
  ] };
  const tiers = getTiers(product);
  assert.equal(tiers.length, 2);
  assert.equal(tiers[0].min_quantity, 3);
  assert.equal(tiers[1].min_quantity, 5);
});

test('resolveTier picks the highest min_quantity <= qty; findTierByMin exact', () => {
  const product = { tiers: [
    { min_quantity: 3, total_price: 25 },
    { min_quantity: 5, total_price: 40 },
  ] };
  assert.equal(resolveTier(product, 2), null);
  assert.equal(resolveTier(product, 3).min_quantity, 3);
  assert.equal(resolveTier(product, 4).min_quantity, 3);
  assert.equal(resolveTier(product, 6).min_quantity, 5);
  assert.equal(findTierByMin(product, 5).total_price, 40);
  assert.equal(findTierByMin(product, 4), null);
});

// ── resolveLineItem: tier total is the ABSOLUTE bundle price ───────────────
test('resolveLineItem: exact bundle uses the tier total (not per-unit)', () => {
  const product = { price: 10, tiers: [{ min_quantity: 3, total_price: 25 }] };
  const r = resolveLineItem(product, { offer_min_quantity: 3 });
  assert.equal(r.quantity, 3);
  assert.equal(r.line_total, 25);            // $25 total for the 3-pack
  assert.equal(r.base_line_total, 25);
  assert.equal(r.unit_price, round2(25 / 3));
});

test('resolveLineItem: single unit uses size price', () => {
  const product = { price: 10, sizes: [{ id: 'l', label: 'L', price: 12, stock_quantity: 4 }] };
  const r = resolveLineItem(product, { size_id: 'l', quantity: 2 });
  assert.equal(r.quantity, 2);
  assert.equal(r.line_total, 24);
  assert.equal(r.unit_price, 12);
  assert.equal(r.size_label, 'L');
});

test('resolveLineItem: markup stacks on top of size + tier prices', () => {
  const product = {
    price: 10, markup_pct: 10,
    tiers: [{ min_quantity: 3, total_price: 30, free_shipping: true }],
  };
  const r = resolveLineItem(product, { offer_min_quantity: 3 });
  assert.equal(r.base_line_total, 30);
  assert.equal(r.line_total, 33);            // 30 + 10%
  assert.equal(r.markup_pct, 10);
  assert.equal(r.free_shipping, true);
});

test('resolveLineItem: qty above a tier uses per-unit-equivalent of best tier', () => {
  const product = { price: 10, tiers: [{ min_quantity: 3, total_price: 24 }] };
  // 24/3 = 8 per unit; 4 units → 32
  const r = resolveLineItem(product, { quantity: 4 });
  assert.equal(r.quantity, 4);
  assert.equal(r.line_total, 32);
});

// ── buildOfferOptions ──────────────────────────────────────────────────────
test('buildOfferOptions: single-unit first, then tiers, markup-inclusive', () => {
  const product = { price: 10, markup_pct: 10, tiers: [{ min_quantity: 3, total_price: 24 }] };
  const opts = buildOfferOptions(product, null);
  assert.equal(opts.length, 2);
  assert.equal(opts[0].key, 'single');
  assert.equal(opts[0].unit_price, 11);       // 10 + 10%
  assert.equal(opts[1].min_quantity, 3);
  assert.equal(opts[1].total_price, round2(24 * 1.1)); // 26.4
});

// ── Free delivery detection ─────────────────────────────────────────────────
test('cartHasFreeDelivery: any free_delivery or free_shipping line qualifies', () => {
  assert.equal(cartHasFreeDelivery([{ price: 1 }]), false);
  assert.equal(cartHasFreeDelivery([{ free_delivery: true }]), true);
  assert.equal(cartHasFreeDelivery([{ free_shipping: true }]), true);
  assert.equal(cartHasFreeDelivery([]), false);
});

// ── Per-size stock decrement / restock ──────────────────────────────────────
test('decrementStockPatch: draws down the selected size pool, clamped at 0', () => {
  const product = { sizes: [
    { id: 's', label: 'S', stock_quantity: 2 },
    { id: 'l', label: 'L', stock_quantity: 5 },
  ] };
  const patch = decrementStockPatch(product, 'l', 3);
  assert.equal(patch.sizes.find((x) => x.id === 'l').stock_quantity, 2);
  assert.equal(patch.sizes.find((x) => x.id === 's').stock_quantity, 2); // untouched
  // clamp
  const clamped = decrementStockPatch(product, 's', 10);
  assert.equal(clamped.sizes.find((x) => x.id === 's').stock_quantity, 0);
});

test('decrementStockPatch: falls back to top-level stock when no size', () => {
  const product = { stock_quantity: 5 };
  assert.deepEqual(decrementStockPatch(product, '', 2), { stock_quantity: 3 });
  assert.equal(decrementStockPatch({ stock_quantity: null }, '', 2), null); // untracked
});

test('restockStockPatch mirrors decrement (adds back to the size pool)', () => {
  const product = { sizes: [{ id: 'l', label: 'L', stock_quantity: 2 }] };
  const patch = restockStockPatch(product, 'l', 3);
  assert.equal(patch.sizes.find((x) => x.id === 'l').stock_quantity, 5);
  assert.deepEqual(restockStockPatch({ stock_quantity: 5 }, '', 2), { stock_quantity: 7 });
});

test('decrement then restock returns the size pool to its original level', () => {
  const product = { sizes: [{ id: 'm', label: 'M', stock_quantity: 8 }] };
  const dec = decrementStockPatch(product, 'm', 3);
  const afterDec = { sizes: dec.sizes };
  const res = restockStockPatch(afterDec, 'm', 3);
  assert.equal(res.sizes.find((x) => x.id === 'm').stock_quantity, 8);
});

function round2(n) { return Math.round(n * 100) / 100; }

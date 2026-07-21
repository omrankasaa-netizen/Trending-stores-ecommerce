import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  markupPctForProduct, applyMarkup, getSizes, findSize, baseUnitPrice,
  getTiers, resolveTier, findTierByMin, resolveLineItem, buildOfferOptions,
  cartHasFreeDelivery, decrementStockPatch, restockStockPatch, isInStock,
  orderDiscountAmount, computeManualOrderTotals, totalStock, unitLabels,
  getDisplayPrice,
} from '../src/lib/pricing.js';

// ── Display price (card / quick-order) ───────────────────────────────────────
test('getDisplayPrice: sized product uses the cheapest size price', () => {
  const product = {
    price: 0,
    sizes: [
      { label: 'S', price: 30 },
      { label: 'M', price: 20 },
      { label: 'L', price: 25 },
    ],
  };
  assert.equal(getDisplayPrice(product), 20);
});

test('getDisplayPrice: simple product falls back to top-level price', () => {
  assert.equal(getDisplayPrice({ price: 15 }), 15);
  assert.equal(getDisplayPrice({ price: '15' }), 15);
});

test('getDisplayPrice: ignores zero/blank size prices, uses valid ones', () => {
  const product = {
    price: 0,
    sizes: [
      { label: 'S', price: 0 },
      { label: 'M', price: '' },
      { label: 'L', price: 40 },
    ],
  };
  assert.equal(getDisplayPrice(product), 40);
});

test('getDisplayPrice: returns 0 when no valid price exists anywhere', () => {
  assert.equal(getDisplayPrice({ price: 0, sizes: [{ label: 'S', price: 0 }] }), 0);
  assert.equal(getDisplayPrice({}), 0);
});

// ── Availability (isInStock) ────────────────────────────────────────────────
test('isInStock: simple product uses product-level stock (string coercion)', () => {
  assert.equal(isInStock({ stock_quantity: 5 }), true);
  assert.equal(isInStock({ stock_quantity: '5' }), true);
  assert.equal(isInStock({ stock_quantity: 0 }), false);
  assert.equal(isInStock({ stock_quantity: '0' }), false);
});

test('isInStock: untracked (null/blank) stock is treated as available', () => {
  assert.equal(isInStock({ stock_quantity: null }), true);
  assert.equal(isInStock({ stock_quantity: '' }), true);
  assert.equal(isInStock({}), true);
});

test('isInStock: sized product is in stock when ANY size has stock', () => {
  // The core bug: product-level stock is blank but a size has stock.
  const product = {
    stock_quantity: null,
    sizes: [
      { label: 'S', stock_quantity: 0 },
      { label: 'M', stock_quantity: 3 },
    ],
  };
  assert.equal(isInStock(product), true);
});

test('isInStock: sized product is out only when EVERY size is 0', () => {
  const product = {
    stock_quantity: 99, // ignored because the product has sizes
    sizes: [
      { label: 'S', stock_quantity: 0 },
      { label: 'M', stock_quantity: '0' },
    ],
  };
  assert.equal(isInStock(product), false);
});

test('isInStock: a specific selected size overrides the product rule', () => {
  const product = { sizes: [{ label: 'S', stock_quantity: 0 }, { label: 'M', stock_quantity: 4 }] };
  assert.equal(isInStock(product, product.sizes[0]), false); // S sold out
  assert.equal(isInStock(product, product.sizes[1]), true);  // M available
  // A size with untracked stock counts as available.
  assert.equal(isInStock(product, { label: 'L', stock_quantity: null }), true);
});

// ── Total stock (per-size aware, for admin low-stock widgets) ───────────────
test('totalStock: simple product returns its tracked quantity (null when blank)', () => {
  assert.equal(totalStock({ stock_quantity: 7 }), 7);
  assert.equal(totalStock({ stock_quantity: 0 }), 0);
  assert.equal(totalStock({ stock_quantity: null }), null);
  assert.equal(totalStock({}), null);
});

test('totalStock: sized product sums size stocks (the Rat Trap case)', () => {
  // Main quantity intentionally 0 (per-size tracking); sizes hold the real stock.
  const product = {
    stock_quantity: 0,
    sizes: [
      { label: 'Small', stock_quantity: 4 },
      { label: 'Medium', stock_quantity: 7 },
    ],
  };
  assert.equal(totalStock(product), 11); // NOT 0 → dashboard must not flag it
  assert.equal(isInStock(product), true);
});

test('totalStock: sized product is 0 only when every tracked size is 0', () => {
  const product = { sizes: [{ label: 'S', stock_quantity: 0 }, { label: 'M', stock_quantity: 0 }] };
  assert.equal(totalStock(product), 0);
  assert.equal(isInStock(product), false);
});

test('totalStock: sizes with all-untracked stock return null (untracked)', () => {
  const product = { sizes: [{ label: 'S' }, { label: 'M', stock_quantity: null }] };
  assert.equal(totalStock(product), null);
});

// ── Unit name (fix 1: editable per-product unit label) ──────────────────────
test('unitLabels: falls back to pc/قطعة when unset', () => {
  assert.deepEqual(unitLabels({}), { en: 'pc', ar: 'قطعة' });
  assert.deepEqual(unitLabels({ unit_name_en: '', unit_name_ar: '   ' }), { en: 'pc', ar: 'قطعة' });
  assert.deepEqual(unitLabels(null), { en: 'pc', ar: 'قطعة' });
});

test('unitLabels: uses provided names and cross-language fallback', () => {
  assert.deepEqual(unitLabels({ unit_name_en: 'pack', unit_name_ar: 'علبة' }), { en: 'pack', ar: 'علبة' });
  // Only one language set → the other falls back to it (not the hardcoded default).
  assert.deepEqual(unitLabels({ unit_name_en: 'pair' }), { en: 'pair', ar: 'pair' });
  assert.deepEqual(unitLabels({ unit_name_ar: 'زوج' }), { en: 'زوج', ar: 'زوج' });
  assert.deepEqual(unitLabels({ unit_name_en: '  box  ' }), { en: 'box', ar: 'box' });
});

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

// ── resolveLineItem: bundle multiplier (offer_quantity) ────────────────────
test('resolveLineItem: offer_quantity multiplies whole bundles (price + pieces)', () => {
  const product = { price: 4, tiers: [{ min_quantity: 5, total_price: 12 }] };
  // 2 × (5 pieces for $12) → 10 pieces, $24.
  const r = resolveLineItem(product, { offer_min_quantity: 5, offer_quantity: 2 });
  assert.equal(r.quantity, 10);
  assert.equal(r.line_total, 24);
  assert.equal(r.base_line_total, 24);
  assert.equal(r.tier_min_quantity, 5);
  assert.equal(r.unit_price, round2(24 / 10)); // 2.4 per piece
});

test('resolveLineItem: offer_quantity defaults to 1 (single bundle unchanged)', () => {
  const product = { price: 4, tiers: [{ min_quantity: 5, total_price: 12 }] };
  const r = resolveLineItem(product, { offer_min_quantity: 5 });
  assert.equal(r.quantity, 5);
  assert.equal(r.line_total, 12);
});

test('resolveLineItem: bundle multiplier derived from piece quantity (server recompute)', () => {
  // A stored order line persists quantity in PIECES (10) with no offer_quantity;
  // the server recompute must still resolve to 2 bundles = $24, not $12.
  const product = { price: 4, tiers: [{ min_quantity: 5, total_price: 12 }] };
  const r = resolveLineItem(product, { offer_min_quantity: 5, quantity: 10 });
  assert.equal(r.quantity, 10);
  assert.equal(r.line_total, 24);
});

test('resolveLineItem: offer multiplier stacks markup per bundle', () => {
  const product = { price: 4, markup_pct: 10, tiers: [{ min_quantity: 5, total_price: 12, free_shipping: true }] };
  const r = resolveLineItem(product, { offer_min_quantity: 5, offer_quantity: 3 });
  assert.equal(r.base_line_total, 36); // 12 × 3
  assert.equal(r.line_total, round2(36 * 1.1)); // 39.6
  assert.equal(r.quantity, 15);
  assert.equal(r.free_shipping, true);
});

test('resolveLineItem: per-size offer honors the multiplier', () => {
  const product = {
    price: 10,
    sizes: [{ id: 'm', label: 'Medium', price: 4.5, offers: [{ min_quantity: 3, total_price: 12 }] }],
  };
  const r = resolveLineItem(product, { size_id: 'm', offer_min_quantity: 3, offer_quantity: 2 });
  assert.equal(r.quantity, 6);
  assert.equal(r.line_total, 24);
  assert.equal(r.size_label, 'Medium');
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

// ── Per-size offers (with product-level fallback) ───────────────────────────
test('getTiers: a size with its own offers overrides product-level tiers', () => {
  const product = {
    tiers: [{ min_quantity: 3, total_price: 16 }],
    sizes: [{ id: 'l', label: 'Large', price: 12, offers: [{ min_quantity: 2, total_price: 20 }] }],
  };
  const large = findSize(product, 'l');
  const tiers = getTiers(product, large);
  assert.equal(tiers.length, 1);
  assert.equal(tiers[0].min_quantity, 2);
  assert.equal(tiers[0].total_price, 20);
});

test('getTiers: a size with NO offers falls back to product-level tiers', () => {
  const product = {
    tiers: [{ min_quantity: 3, total_price: 16 }],
    sizes: [{ id: 's', label: 'Small', price: 4 }],
  };
  const small = findSize(product, 's');
  const tiers = getTiers(product, small);
  assert.equal(tiers.length, 1);
  assert.equal(tiers[0].min_quantity, 3);
});

test('getTiers: an empty size offers array falls back to product-level tiers', () => {
  const product = {
    tiers: [{ min_quantity: 3, total_price: 16 }],
    sizes: [{ id: 'm', label: 'Medium', price: 7, offers: [] }],
  };
  assert.equal(getTiers(product, findSize(product, 'm'))[0].min_quantity, 3);
});

test('resolveLineItem: uses the SELECTED size offers, not another size or product', () => {
  const product = {
    price: 10,
    tiers: [{ min_quantity: 5, total_price: 12 }], // product-level (Small-style)
    sizes: [
      { id: 's', label: 'Small', price: 4, offers: [{ min_quantity: 5, total_price: 12, label: 'Small Offer', label_ar: 'عرض الصغير' }] },
      { id: 'l', label: 'Large', price: 12, offers: [{ min_quantity: 2, total_price: 20, label: 'Large Offer', label_ar: 'عرض الكبير' }] },
    ],
  };
  // Large: only its own 2-pc offer applies.
  const large2 = resolveLineItem(product, { size_id: 'l', offer_min_quantity: 2 });
  assert.equal(large2.quantity, 2);
  assert.equal(large2.line_total, 20);
  assert.equal(large2.tier_label, 'Large Offer');
  // Large has NO 5-pc offer → that min_quantity resolves to no tier (plain price).
  const largeNo5 = resolveLineItem(product, { size_id: 'l', offer_min_quantity: 5 });
  assert.equal(largeNo5.tier_min_quantity, null);
  // Small: its own 5-pc offer applies.
  const small5 = resolveLineItem(product, { size_id: 's', offer_min_quantity: 5 });
  assert.equal(small5.quantity, 5);
  assert.equal(small5.line_total, 12);
});

test('resolveLineItem: size without offers falls back to product-level tiers', () => {
  const product = {
    price: 10,
    tiers: [{ min_quantity: 3, total_price: 16 }],
    sizes: [{ id: 'm', label: 'Medium', price: 7 }],
  };
  const r = resolveLineItem(product, { size_id: 'm', offer_min_quantity: 3 });
  assert.equal(r.quantity, 3);
  assert.equal(r.line_total, 16);
});

test('resolveLineItem: per-size offer total stacks markup (server recompute)', () => {
  const product = {
    price: 10, markup_pct: 10,
    sizes: [{ id: 'l', label: 'L', price: 12, offers: [{ min_quantity: 2, total_price: 20, free_shipping: true }] }],
  };
  const r = resolveLineItem(product, { size_id: 'l', offer_min_quantity: 2 }, 5);
  assert.equal(r.base_line_total, 20);
  assert.equal(r.line_total, 22); // 20 + 10% (per-product override wins over global)
  assert.equal(r.free_shipping, true);
});

test('buildOfferOptions: reflects the selected size offers only', () => {
  const product = {
    price: 10,
    tiers: [{ min_quantity: 9, total_price: 90 }],
    sizes: [{ id: 'l', label: 'L', price: 12, offers: [{ min_quantity: 2, total_price: 20 }] }],
  };
  const opts = buildOfferOptions(product, findSize(product, 'l'));
  assert.equal(opts.length, 2);       // single + the size's one offer
  assert.equal(opts[0].unit_price, 12); // 1 pc at the size price
  assert.equal(opts[1].min_quantity, 2);
  assert.equal(opts[1].total_price, 20);
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

test('buildOfferOptions: two offers with the SAME min_quantity get distinct keys', () => {
  // An admin can configure two different bundle deals that both require the same
  // minimum quantity. Their keys must be unique so the product page can select
  // and price each one independently (previously both became `tier-3`, so the
  // UI highlighted both and always resolved to the first one's price).
  const product = { price: 10, tiers: [
    { min_quantity: 3, total_price: 24, label: 'Deal A', label_ar: 'عرض أ' },
    { min_quantity: 3, total_price: 27, label: 'Deal B', label_ar: 'عرض ب' },
  ] };
  const opts = buildOfferOptions(product, null);
  assert.equal(opts.length, 3); // single + two 3-piece offers

  const tierOpts = opts.filter((o) => o.min_quantity === 3);
  assert.equal(tierOpts.length, 2);
  // Keys are unique across the whole returned array.
  const keys = opts.map((o) => o.key);
  assert.equal(new Set(keys).size, keys.length);

  // Each offer keeps its own price/label and is independently resolvable by key.
  const a = opts.find((o) => o.key === tierOpts[0].key);
  const b = opts.find((o) => o.key === tierOpts[1].key);
  assert.notEqual(a.key, b.key);
  assert.equal(a.total_price, 24);
  assert.equal(a.unit_price, round2(24 / 3));
  assert.equal(a.label, 'Deal A');
  assert.equal(b.total_price, 27);
  assert.equal(b.unit_price, round2(27 / 3));
  assert.equal(b.label, 'Deal B');
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

// ── Manual admin order pricing ──────────────────────────────────────────────
// (1) auto-applied discount/offer default, (2) per-item override, (3) $/%
// order discount clamped to subtotal, (4) delivery fee, (5) final-total override.

test('orderDiscountAmount: fixed $ is clamped to [0, subtotal]', () => {
  assert.equal(orderDiscountAmount(100, 'fixed', 30), 30);
  assert.equal(orderDiscountAmount(100, 'fixed', 250), 100); // never exceeds subtotal
  assert.equal(orderDiscountAmount(100, 'fixed', -5), 0);    // never negative
  assert.equal(orderDiscountAmount(0, 'fixed', 10), 0);
});

test('orderDiscountAmount: percent is (value% of subtotal), clamped', () => {
  assert.equal(orderDiscountAmount(200, 'percent', 10), 20);
  assert.equal(orderDiscountAmount(200, 'percent', 150), 200); // 300 → clamped to subtotal
  assert.equal(orderDiscountAmount(99.99, 'percent', 50), 50); // round2
});

test('auto-applied offer default: buildOfferOptions gives the bundle unit price', () => {
  // Manual order default reuses the SAME pricing logic customers see: a 3-for-$25
  // bundle → $8.33/unit default, size-aware and markup-inclusive.
  const product = { price: 10, tiers: [{ min_quantity: 3, total_price: 25 }] };
  const opts = buildOfferOptions(product, null, 0);
  const bundle = opts.find((o) => o.min_quantity === 3);
  const totals = computeManualOrderTotals({
    items: [{ price: bundle.unit_price, quantity: bundle.quantity }],
  });
  assert.equal(totals.subtotal, 24.99); // 8.33 × 3 (matches the offered bundle)
});

test('computeManualOrderTotals: per-item override + auto total', () => {
  // Admin overrides the unit price to 5 for 3 units; no discount, $4 delivery.
  const totals = computeManualOrderTotals({
    items: [{ price: 5, quantity: 3 }],
    delivery_fee: 4,
  });
  assert.equal(totals.subtotal, 15);
  assert.equal(totals.discount, 0);
  assert.equal(totals.delivery_fee, 4);
  assert.equal(totals.total, 19); // 15 - 0 + 4
});

test('computeManualOrderTotals: $ order discount reduces the total', () => {
  const totals = computeManualOrderTotals({
    items: [{ price: 10, quantity: 5 }], // subtotal 50
    discount_type: 'fixed', discount_value: 12,
    delivery_fee: 3,
  });
  assert.equal(totals.subtotal, 50);
  assert.equal(totals.discount, 12);
  assert.equal(totals.total, 41); // 50 - 12 + 3
});

test('computeManualOrderTotals: % order discount clamped to subtotal', () => {
  const totals = computeManualOrderTotals({
    items: [{ price: 20, quantity: 2 }], // subtotal 40
    discount_type: 'percent', discount_value: 25,
    delivery_fee: 0,
  });
  assert.equal(totals.discount, 10); // 25% of 40
  assert.equal(totals.total, 30);
});

test('computeManualOrderTotals: delivery fee waived (0) is respected', () => {
  const totals = computeManualOrderTotals({
    items: [{ price: 10, quantity: 1 }],
    delivery_fee: 0,
  });
  assert.equal(totals.delivery_fee, 0);
  assert.equal(totals.total, 10);
});

test('computeManualOrderTotals: final-total override wins over auto total', () => {
  const totals = computeManualOrderTotals({
    items: [{ price: 10, quantity: 3 }], // subtotal 30
    discount_type: 'fixed', discount_value: 5,
    delivery_fee: 4,
    total_override: true, total: 25,
  });
  assert.equal(totals.auto_total, 29); // 30 - 5 + 4
  assert.equal(totals.total, 25);      // admin-entered total used verbatim
});

test('computeManualOrderTotals: override ignored when flag is off', () => {
  const totals = computeManualOrderTotals({
    items: [{ price: 10, quantity: 3 }],
    total_override: false, total: 999,
  });
  assert.equal(totals.total, 30); // auto, not the stray 999
});

test('computeManualOrderTotals: override clamped to >= 0', () => {
  const totals = computeManualOrderTotals({
    items: [{ price: 10, quantity: 1 }],
    total_override: true, total: -50,
  });
  assert.equal(totals.total, 0);
});

function round2(n) { return Math.round(n * 100) / 100; }

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Pure reservation math — no DB, no IO. Verifies availability = stock − reserved
// at both the size level (per-size pool) and the sizeless product level, plus the
// three patch builders (reserve / release / commit) and their clamping.
const {
  availableStock, getReserved,
  reserveStockPatch, releaseReservationPatch, commitReservedStockPatch,
} = await import('../src/lib/pricing.js');

const sizedProduct = () => ({
  id: 'p-sized',
  sizes: [
    { id: 's', label: 'Small', stock_quantity: 3, qty_reserved: 0 },
    { id: 'm', label: 'Medium', stock_quantity: 1, qty_reserved: 0 },
    { id: 'l', label: 'Large', stock_quantity: null }, // untracked → unlimited
  ],
});

const sizelessProduct = () => ({ id: 'p-plain', stock_quantity: 2, qty_reserved: 0 });

test('availableStock: size-level availability = stock − reserved', () => {
  const p = sizedProduct();
  assert.equal(availableStock(p, 's'), 3);
  p.sizes[0].qty_reserved = 2;
  assert.equal(availableStock(p, 's'), 1);
  // Untracked size stays unlimited.
  assert.equal(availableStock(p, 'l'), null);
});

test('availableStock: no size selected on a sized product sums tracked size availability', () => {
  const p = sizedProduct(); // 3 + 1 (+ untracked ignored)
  assert.equal(availableStock(p, undefined), 4);
});

test('availableStock: sizeless product uses the product-level pool', () => {
  const p = sizelessProduct();
  assert.equal(availableStock(p), 2);
  p.qty_reserved = 2;
  assert.equal(availableStock(p), 0);
});

test('reserveStockPatch: holds at the SIZE level and reports post-reserve balance', () => {
  const p = sizedProduct();
  const r = reserveStockPatch(p, 'm', 1); // last Medium
  assert.equal(r.ok, true);
  assert.equal(r.balance, 0);
  assert.deepEqual(r.patch.sizes.find((s) => s.id === 'm').qty_reserved, 1);
  // The other sizes are untouched.
  assert.equal(r.patch.sizes.find((s) => s.id === 's').qty_reserved, 0);
});

test('reserveStockPatch: REJECTS when the size pool is exhausted (availability < qty)', () => {
  const p = sizedProduct();
  p.sizes[1].qty_reserved = 1; // Medium already fully held (stock 1, reserved 1)
  const r = reserveStockPatch(p, 'm', 1);
  assert.equal(r.ok, false);
  assert.equal(r.patch, null);
  assert.equal(r.available, 0);
  assert.equal(r.requested, 1);
});

test('reserveStockPatch: untracked pool always succeeds with no hold', () => {
  const p = sizedProduct();
  const r = reserveStockPatch(p, 'l', 99);
  assert.equal(r.ok, true);
  assert.equal(r.patch, null); // nothing to hold
});

test('releaseReservationPatch: frees the hold and clamps at 0', () => {
  const p = sizedProduct();
  p.sizes[0].qty_reserved = 2;
  const r = releaseReservationPatch(p, 's', 5); // release more than held
  assert.equal(r.patch.sizes.find((s) => s.id === 's').qty_reserved, 0);
  assert.equal(r.balance, 3); // stock 3, reserved back to 0
});

test('commitReservedStockPatch: reserve→sale drops on-hand AND reserved together (net-zero availability)', () => {
  const p = sizedProduct();
  p.sizes[0].qty_reserved = 2; // 2 held out of 3
  const availBefore = availableStock(p, 's'); // 1
  const r = commitReservedStockPatch(p, 's', 2);
  const committed = r.patch.sizes.find((s) => s.id === 's');
  assert.equal(committed.stock_quantity, 1); // 3 − 2
  assert.equal(committed.qty_reserved, 0);   // 2 − 2
  assert.equal(r.balance, 1);                // new on-hand
  // Availability is unchanged by the commit itself.
  const after = { ...p, sizes: r.patch.sizes };
  assert.equal(availableStock(after, 's'), availBefore);
});

test('sizeless: reserve → commit → cancel-after-commit round trips without going negative', () => {
  let p = sizelessProduct(); // stock 2
  const reserve = reserveStockPatch(p, undefined, 2);
  assert.equal(reserve.ok, true);
  p = { ...p, ...reserve.patch }; // qty_reserved 2
  assert.equal(availableStock(p), 0);

  const commit = commitReservedStockPatch(p, undefined, 2);
  p = { ...p, ...commit.patch }; // stock 0, reserved 0
  assert.equal(p.stock_quantity, 0);
  assert.equal(getReserved(p), 0);
});

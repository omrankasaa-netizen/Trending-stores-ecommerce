import { test } from 'node:test';
import assert from 'node:assert/strict';

// Customer-facing availability helpers (reservation-aware, display read-path).
// These subtract qty_reserved from on-hand stock so a fully-reserved size/product
// renders as out of stock even though its on-hand count is still non-zero.
const {
  sizeAvailableStock, sizeAvailable, isAvailable, availableUnits, totalReserved,
} = await import('../src/lib/pricing.js');

test('sizeAvailableStock: stock − reserved, clamped and untracked-aware', () => {
  assert.equal(sizeAvailableStock({ stock_quantity: 1, qty_reserved: 1 }), 0); // 1/1 → 0
  assert.equal(sizeAvailableStock({ stock_quantity: 5, qty_reserved: 2 }), 3); // 5/2 → 3
  assert.equal(sizeAvailableStock({ qty_reserved: 4 }), null);                 // untracked → null
  assert.equal(sizeAvailableStock({}), null);                                  // missing → null
  assert.equal(sizeAvailableStock(undefined), null);                           // no size → null
  assert.equal(sizeAvailableStock({ stock_quantity: 2, qty_reserved: 9 }), 0); // never negative
});

test('sizeAvailable: boolean in-stock accounting for holds', () => {
  assert.equal(sizeAvailable({ stock_quantity: 1, qty_reserved: 1 }), false);
  assert.equal(sizeAvailable({ stock_quantity: 5, qty_reserved: 2 }), true);
  assert.equal(sizeAvailable({ stock_quantity: null }), true); // untracked → available
});

test('isAvailable(size): a fully-reserved size reads as unavailable', () => {
  const product = { id: 'p' };
  assert.equal(isAvailable(product, { stock_quantity: 3, qty_reserved: 3 }), false);
  assert.equal(isAvailable(product, { stock_quantity: 3, qty_reserved: 1 }), true);
});

test('isAvailable(product): out of stock only when ALL sizes are unavailable', () => {
  const allReserved = {
    sizes: [
      { id: 's', stock_quantity: 2, qty_reserved: 2 },
      { id: 'm', stock_quantity: 1, qty_reserved: 5 },
    ],
  };
  assert.equal(isAvailable(allReserved), false);

  const oneLeft = {
    sizes: [
      { id: 's', stock_quantity: 2, qty_reserved: 2 }, // 0
      { id: 'm', stock_quantity: 3, qty_reserved: 2 }, // 1 available
    ],
  };
  assert.equal(isAvailable(oneLeft), true);
});

test('isAvailable(product): sizeless product uses product-level pool', () => {
  assert.equal(isAvailable({ stock_quantity: 2, qty_reserved: 2 }), false);
  assert.equal(isAvailable({ stock_quantity: 2, qty_reserved: 1 }), true);
  assert.equal(isAvailable({ stock_quantity: null }), true); // untracked → available
});

test('availableUnits: numeric cap for the quantity stepper', () => {
  const product = {
    sizes: [
      { id: 's', stock_quantity: 5, qty_reserved: 2 }, // 3
      { id: 'm', stock_quantity: 4, qty_reserved: 1 }, // 3
    ],
  };
  // A specific size object → that size's sellable count.
  assert.equal(availableUnits(product, product.sizes[0]), 3);
  // No size on a sized product → sum of tracked availabilities.
  assert.equal(availableUnits(product, null), 6);
  // Sizeless product.
  assert.equal(availableUnits({ stock_quantity: 5, qty_reserved: 2 }, null), 3);
  // Untracked → null (unlimited).
  assert.equal(availableUnits({ stock_quantity: null }, null), null);
});

test('totalReserved: sums per-size holds, else product-level', () => {
  assert.equal(totalReserved({
    sizes: [
      { id: 's', stock_quantity: 5, qty_reserved: 2 },
      { id: 'm', stock_quantity: 4, qty_reserved: 3 },
      { id: 'l', stock_quantity: null, qty_reserved: 9 }, // untracked → ignored
    ],
  }), 5);
  assert.equal(totalReserved({ stock_quantity: 10, qty_reserved: 4 }), 4);
  assert.equal(totalReserved({ stock_quantity: 10 }), 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

// Throwaway DB before importing anything that opens it (mirrors adminReseed.test).
process.env.DATABASE_PATH = path.join(os.tmpdir(), `manual-order-test-${process.pid}-${Date.now()}.db`);
process.env.MINIYO_JWT_SECRET = 'manual-order-test-secret';

const { recomputeOrder } = await import('../server/functions.js');
const { initSchema } = await import('../server/db.js');
initSchema(); // guest-path recompute reads the kv (markup) + SiteSettings tables

test('recomputeOrder: manual admin order trusts operator pricing + stores adjusted total', () => {
  const out = recomputeOrder({
    manual: true,
    items: [
      { product_id: 'x', price: 5, quantity: 3 },   // admin-overridden unit price
      { product_id: 'y', price: 8.5, quantity: 2 },
    ],
    discount_type: 'percent',
    discount_value: 10,
    delivery_fee: 4,
  }, { allowManual: true });

  assert.equal(out.manual, true);
  assert.equal(out.subtotal, 32);          // 15 + 17
  assert.equal(out.discount, 3.2);         // 10% of 32
  assert.equal(out.discount_type, 'percent');
  assert.equal(out.delivery_fee, 4);
  assert.equal(out.total, 32.8);           // 32 - 3.2 + 4 — the stored revenue figure
  // Line prices are preserved exactly (not re-derived from the catalog).
  assert.equal(out.items[0].price, 5);
  assert.equal(out.items[1].price, 8.5);
});

test('recomputeOrder: manual final-total override is stored + flagged', () => {
  const out = recomputeOrder({
    manual: true,
    items: [{ product_id: 'x', price: 10, quantity: 3 }],
    discount_type: 'fixed', discount_value: 5,
    delivery_fee: 2,
    total_override: true, total: 20,
  }, { allowManual: true });
  assert.equal(out.total_override, true);
  assert.equal(out.total, 20);             // admin figure used for revenue
});

test('recomputeOrder: manual flag is IGNORED without admin (guest cannot dodge repricing)', () => {
  // A guest POSTing manual:true is not granted the manual path; unknown products
  // keep their client line but the manual discount/override fields are dropped.
  const out = recomputeOrder({
    manual: true,
    items: [{ price: 5, quantity: 2 }],
    total_override: true, total: 1,
  }, { allowManual: false });
  assert.equal(out.total, 10);             // repriced, not the injected 1
  assert.notEqual(out.total, 1);
});

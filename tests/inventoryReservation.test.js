import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Throwaway DB before importing anything that opens it (mirrors adminReseed.test).
const TMP_DB = path.join(os.tmpdir(), `inv-reserve-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = TMP_DB;
process.env.MINIYO_JWT_SECRET = 'inv-reserve-test-secret';

const { reserveOrderStock, invokeFunction } = await import('../server/functions.js');
const { initSchema, createRecord, getRecord, updateRecord } = await import('../server/db.js');
const { availableStock } = await import('../src/lib/pricing.js');
const { registerUser } = await import('../server/auth.js');

initSchema();
const admin = registerUser({ email: 'inv-admin@test.local', password: 'pw-admin-123', role: 'admin' });

const sizeAvail = (pid, sizeId) => availableStock(getRecord('Product', pid), sizeId);

// Place an order: reserve stock, then (on success) persist it with the flag the
// real POST handler sets. Returns { order, reservation }.
function placeOrder(items) {
  const data = { order_number: `T-${Math.random().toString(36).slice(2, 8)}`, items, status: 'pending' };
  const reservation = reserveOrderStock(data);
  if (!reservation.ok) return { order: null, reservation };
  data.stock_reserved = true;
  const order = createRecord('Order', data);
  return { order, reservation };
}

test('immediate reservation reduces availability at the SIZE level', () => {
  const p = createRecord('Product', {
    name: 'Sized Tee',
    sizes: [
      { id: 'm', label: 'M', stock_quantity: 1, qty_reserved: 0 },
      { id: 'l', label: 'L', stock_quantity: 5, qty_reserved: 0 },
    ],
  });
  assert.equal(sizeAvail(p.id, 'm'), 1);
  const { reservation } = placeOrder([{ product_id: p.id, size_id: 'm', quantity: 1 }]);
  assert.equal(reservation.ok, true);
  assert.equal(sizeAvail(p.id, 'm'), 0);   // the M pool is now held
  assert.equal(sizeAvail(p.id, 'l'), 5);   // sibling size untouched
});

test('second order for the LAST unit of a size is REJECTED at placement', () => {
  const p = createRecord('Product', { name: 'One Left', sizes: [{ id: 's', label: 'S', stock_quantity: 1, qty_reserved: 0 }] });
  const first = placeOrder([{ product_id: p.id, size_id: 's', quantity: 1 }]);
  assert.equal(first.reservation.ok, true);

  const second = placeOrder([{ product_id: p.id, size_id: 's', quantity: 1 }]);
  assert.equal(second.reservation.ok, false);
  assert.equal(second.order, null, 'order must NOT be persisted on shortage');
  assert.equal(second.reservation.shortages[0].product_id, p.id);
  assert.equal(second.reservation.shortages[0].available, 0);
});

test('cancellation of a reserved (uncommitted) order restores that size availability', async () => {
  const p = createRecord('Product', { name: 'Cancelable', sizes: [{ id: 'm', label: 'M', stock_quantity: 2, qty_reserved: 0 }] });
  const { order } = placeOrder([{ product_id: p.id, size_id: 'm', quantity: 2 }]);
  assert.equal(sizeAvail(p.id, 'm'), 0);

  const res = await invokeFunction('cancelOrder', { order_id: order.id }, admin);
  assert.equal(res.released, true);
  assert.equal(res.restocked, false);
  assert.equal(sizeAvail(p.id, 'm'), 2);          // hold freed
  const size = getRecord('Product', p.id).sizes.find((s) => s.id === 'm');
  assert.equal(size.stock_quantity, 2, 'on-hand was never touched by a reserve/release');
  assert.equal(getRecord('Order', order.id).stock_released, true);
});

test('confirmation converts reserve→sale (net-zero availability, on-hand drops)', async () => {
  const p = createRecord('Product', { name: 'Confirmable', stock_quantity: 5, qty_reserved: 0 });
  const { order } = placeOrder([{ product_id: p.id, quantity: 2 }]);
  assert.equal(availableStock(getRecord('Product', p.id)), 3); // 5 − 2 held
  const availBefore = availableStock(getRecord('Product', p.id));

  await invokeFunction('commitStock', { order_id: order.id }, admin);
  const after = getRecord('Product', p.id);
  assert.equal(after.stock_quantity, 3);   // on-hand dropped by the sale
  assert.equal(after.qty_reserved, 0);     // hold consumed
  assert.equal(availableStock(after), availBefore, 'availability unchanged by the commit');
  assert.equal(getRecord('Order', order.id).stock_committed, true);
});

test('sizeless product: reserve → confirm → cancel(after commit) restocks on-hand', async () => {
  const p = createRecord('Product', { name: 'Plain', stock_quantity: 4, qty_reserved: 0 });
  const { order } = placeOrder([{ product_id: p.id, quantity: 1 }]);
  await invokeFunction('commitStock', { order_id: order.id }, admin);
  assert.equal(getRecord('Product', p.id).stock_quantity, 3);

  const res = await invokeFunction('cancelOrder', { order_id: order.id }, admin);
  assert.equal(res.restocked, true);   // committed → restock path
  assert.equal(res.released, false);
  assert.equal(getRecord('Product', p.id).stock_quantity, 4); // returned to on-hand
});

test('legacy order (never reserved) still commits by decrementing on-hand', async () => {
  const p = createRecord('Product', { name: 'Legacy', stock_quantity: 4, qty_reserved: 0 });
  // Simulate a pre-change order: created directly, NO stock_reserved flag.
  const order = createRecord('Order', {
    order_number: 'LEGACY-1', status: 'pending',
    items: [{ product_id: p.id, quantity: 1 }],
  });
  await invokeFunction('commitStock', { order_id: order.id }, admin);
  assert.equal(getRecord('Product', p.id).stock_quantity, 3); // fallback decrement
  assert.equal(getRecord('Product', p.id).qty_reserved, 0);   // no reservation was involved
});

test('stock never goes negative: reserving beyond availability is rejected, not clamped past 0', () => {
  const p = createRecord('Product', { name: 'Scarce', sizes: [{ id: 'm', label: 'M', stock_quantity: 1, qty_reserved: 0 }] });
  const ok = placeOrder([{ product_id: p.id, size_id: 'm', quantity: 1 }]);
  assert.equal(ok.reservation.ok, true);
  const over = placeOrder([{ product_id: p.id, size_id: 'm', quantity: 1 }]);
  assert.equal(over.reservation.ok, false);
  const size = getRecord('Product', p.id).sizes.find((s) => s.id === 'm');
  assert.equal(size.qty_reserved, 1, 'reserved never exceeds on-hand');
  assert.ok(size.stock_quantity >= 0 && size.qty_reserved >= 0);
});

test('idempotency: double commit and double cancel do not double-apply', async () => {
  const p = createRecord('Product', { name: 'Idem', stock_quantity: 5, qty_reserved: 0 });
  const { order } = placeOrder([{ product_id: p.id, quantity: 2 }]);

  await invokeFunction('commitStock', { order_id: order.id }, admin);
  await invokeFunction('commitStock', { order_id: order.id }, admin); // no-op
  assert.equal(getRecord('Product', p.id).stock_quantity, 3, 'commit applied exactly once');

  await invokeFunction('cancelOrder', { order_id: order.id }, admin);  // restock (was committed)
  await invokeFunction('cancelOrder', { order_id: order.id }, admin);  // no-op
  assert.equal(getRecord('Product', p.id).stock_quantity, 5, 'restock applied exactly once');
});

test('reserveOrderStock is idempotent for an already-reserved order', () => {
  const p = createRecord('Product', { name: 'DoubleReserve', stock_quantity: 3, qty_reserved: 0 });
  const data = { order_number: 'DR-1', status: 'pending', items: [{ product_id: p.id, quantity: 1 }] };
  const first = reserveOrderStock(data);
  assert.equal(first.ok, true);
  data.stock_reserved = true;
  const second = reserveOrderStock(data); // guarded — must not hold again
  assert.equal(second.ok, true);
  assert.equal(second.already_reserved, true);
  assert.equal(getRecord('Product', p.id).qty_reserved, 1, 'held exactly once');
});

test('multi-line placement rolls back ALL holds when any line is short', () => {
  const good = createRecord('Product', { name: 'Plenty', stock_quantity: 10, qty_reserved: 0 });
  const bad = createRecord('Product', { name: 'Empty', sizes: [{ id: 'm', label: 'M', stock_quantity: 0, qty_reserved: 0 }] });
  const { order, reservation } = placeOrder([
    { product_id: good.id, quantity: 1 },
    { product_id: bad.id, size_id: 'm', quantity: 1 },
  ]);
  assert.equal(reservation.ok, false);
  assert.equal(order, null);
  // The good line's hold must have been rolled back by the transaction.
  assert.equal(getRecord('Product', good.id).qty_reserved, 0, 'partial reserve rolled back');
});

test.after(() => { try { for (const s of ['', '-wal', '-shm', '-journal']) fs.rmSync(TMP_DB + s, { force: true }); } catch { /* ignore */ } });

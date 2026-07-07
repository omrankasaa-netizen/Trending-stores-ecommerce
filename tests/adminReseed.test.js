import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Point the DB at a throwaway file BEFORE importing anything that opens it, then
// use dynamic imports so db.js reads this env at module load. Keeps the real
// data.db untouched.
const TMP_DB = path.join(os.tmpdir(), `reseed-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = TMP_DB;
process.env.MINIYO_JWT_SECRET = 'reseed-test-secret';

const { app } = await import('../server/index.js');
const { registerUser, signToken } = await import('../server/auth.js');
const { countRecords, queryRecords, deleteRecord } = await import('../server/db.js');

const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const adminUser = registerUser({ email: 'reseed-admin@test.local', password: 'pw-admin-123', role: 'admin' });
const customerUser = registerUser({ email: 'reseed-customer@test.local', password: 'pw-cust-123', role: 'customer' });
const adminToken = signToken(adminUser.id);
const customerToken = signToken(customerUser.id);

const reseed = (headers = {}) => fetch(`${base}/api/admin/reseed`, { method: 'POST', headers });

after(() => server.close());

test('POST /api/admin/reseed: rejects unauthenticated requests with 401', async () => {
  const res = await reseed();
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'Authentication required');
  assert.ok(!('products_seeded' in body), 'must not leak a seed summary to anonymous callers');
});

test('POST /api/admin/reseed: rejects non-admin (customer) requests with 403', async () => {
  const res = await reseed({ authorization: `Bearer ${customerToken}` });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, 'Forbidden: admin access required');
  assert.ok(!('products_seeded' in body), 'must not leak a seed summary to non-admins');
});

test('POST /api/admin/reseed: admin wipes + restores the catalog and gets a summary', async () => {
  // Simulate a divergent live DB: drop every product so boot-time seeding would
  // NOT restore it (only-if-empty already ran). The force path must fix this.
  for (const p of queryRecords('Product', {})) deleteRecord('Product', p.id);
  assert.equal(countRecords('Product'), 0, 'precondition: products cleared');

  const res = await reseed({ authorization: `Bearer ${adminToken}` });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.ok(body.products_seeded > 0, 'reports products seeded');
  assert.ok(body.categories_seeded > 0, 'reports categories seeded');
  // The catalog is actually present in the DB after the call.
  assert.equal(countRecords('Product'), body.products_seeded);
  assert.equal(countRecords('Category'), body.categories_seeded);
});

test('POST /api/admin/reseed: is idempotent — a second run yields identical counts (no duplicates)', async () => {
  const first = await (await reseed({ authorization: `Bearer ${adminToken}` })).json();
  const second = await (await reseed({ authorization: `Bearer ${adminToken}` })).json();
  assert.deepEqual(second, first);
  assert.equal(countRecords('Product'), second.products_seeded);
  assert.equal(countRecords('Category'), second.categories_seeded);
});

after(() => { try { for (const s of ['', '-wal', '-shm', '-journal']) fs.rmSync(TMP_DB + s, { force: true }); } catch { /* ignore */ } });

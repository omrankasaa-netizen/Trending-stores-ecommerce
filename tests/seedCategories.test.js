import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Isolated throwaway DB — set BEFORE importing anything that opens it, then use
// dynamic imports so db.js reads this env at module load (keeps data.db safe).
const TMP_DB = path.join(os.tmpdir(), `seed-cat-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = TMP_DB;
process.env.MINIYO_JWT_SECRET = 'seed-cat-test-secret';

const { runSeed } = await import('../server/seed.js');
const { initSchema, queryRecords, deleteRecord, countRecords, kvSet } = await import('../server/db.js');

initSchema();

after(() => { try { for (const s of ['', '-wal', '-shm', '-journal']) fs.rmSync(TMP_DB + s, { force: true }); } catch { /* ignore */ } });

// The homepage category grid renders from Category.list() (queryRecords here),
// so proving deletions persist at this data source proves the tile disappears.
test('boot seed does NOT re-add an individually deleted category', () => {
  runSeed();
  const before = queryRecords('Category', {});
  assert.ok(before.length > 0, 'precondition: categories seeded on first boot');

  const victim = before.find((c) => c.slug === 'tools') || before[0];
  deleteRecord('Category', victim.id);
  assert.equal(countRecords('Category'), before.length - 1);

  // Force the seed path to run again (as a version bump / redeploy would).
  kvSet('seed_version', '0');
  runSeed();

  const after = queryRecords('Category', {});
  assert.equal(after.length, before.length - 1, 'deleted category must not reappear');
  assert.ok(!after.some((c) => c.slug === victim.slug), `deleted slug "${victim.slug}" stays gone`);
});

test('boot seed restores the full set only when the table is completely EMPTY', () => {
  const seeded = queryRecords('Category', {});
  // Wipe every category → the next seed is all-or-nothing and restores defaults.
  for (const c of seeded) deleteRecord('Category', c.id);
  assert.equal(countRecords('Category'), 0);

  kvSet('seed_version', '0');
  runSeed();

  assert.ok(countRecords('Category') > 0, 'empty table is re-seeded from defaults');
  assert.ok(queryRecords('Category', {}).some((c) => c.slug === 'tools'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeContentId, productContentId, buildContents, META_CURRENCY,
} from '../src/lib/metaShared.js';

test('META_CURRENCY is USD', () => {
  assert.equal(META_CURRENCY, 'USD');
});

test('normalizeContentId: uppercases + trims, tolerates null/undefined', () => {
  assert.equal(normalizeContentId(' abc123 '), 'ABC123');
  assert.equal(normalizeContentId('SkU-7'), 'SKU-7');
  assert.equal(normalizeContentId(null), '');
  assert.equal(normalizeContentId(undefined), '');
  assert.equal(normalizeContentId(42), '42');
});

test('normalizeContentId: same output regardless of case/whitespace (dedup)', () => {
  assert.equal(normalizeContentId('abc123 '), normalizeContentId('ABC123'));
});

test('productContentId: prefers sku over id, else id, else _id', () => {
  assert.equal(productContentId({ sku: 'sku1', id: 'id1' }), 'SKU1');
  assert.equal(productContentId({ id: 'id1' }), 'ID1');
  assert.equal(productContentId({ _id: 'mongo9' }), 'MONGO9');
  assert.equal(productContentId(null), '');
  assert.equal(productContentId({}), '');
});

test('buildContents: builds normalized contents + parallel content_ids', () => {
  const { contents, content_ids } = buildContents([
    { product_id: 'p1', quantity: 2, price: 10 },
    { product_id: 'p2', quantity: 1, price: 5 },
  ]);
  assert.deepEqual(content_ids, ['P1', 'P2']);
  assert.deepEqual(contents, [
    { id: 'P1', quantity: 2, item_price: 10 },
    { id: 'P2', quantity: 1, item_price: 5 },
  ]);
});

test('buildContents: defaults quantity to 1, drops idless lines, tolerates non-array', () => {
  const { contents, content_ids } = buildContents([
    { product_id: 'p1' },
    { quantity: 3 }, // no id → dropped
  ]);
  assert.deepEqual(content_ids, ['P1']);
  assert.equal(contents[0].quantity, 1);
  assert.deepEqual(buildContents(null), { contents: [], content_ids: [] });
});

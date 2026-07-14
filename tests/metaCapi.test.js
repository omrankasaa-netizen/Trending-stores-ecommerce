import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  sendCapiEvent, isEventAllowed, buildRequestUserData,
} from '../server/meta.js';
import { invokeFunction } from '../server/functions.js';

const PIXEL = 'TEST_PIXEL_123';
const TOKEN = 'TEST_TOKEN_abc';

// Swap in a fake fetch that records the last request instead of hitting the
// network. Meta's Graph endpoint is NEVER contacted in tests.
let lastRequest;
const realFetch = globalThis.fetch;
function installFetchSpy() {
  lastRequest = null;
  globalThis.fetch = async (url, opts) => {
    lastRequest = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ events_received: 1 }) };
  };
}

beforeEach(() => {
  process.env.TRENDING_META_PIXEL_ID = PIXEL;
  process.env.TRENDING_META_CAPI_ACCESS_TOKEN = TOKEN;
  delete process.env.TRENDING_META_TEST_EVENT_CODE;
  installFetchSpy();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.TRENDING_META_PIXEL_ID;
  delete process.env.TRENDING_META_CAPI_ACCESS_TOKEN;
  delete process.env.TRENDING_META_TEST_EVENT_CODE;
});

test('isEventAllowed: only the three browsing events, never Purchase', () => {
  assert.equal(isEventAllowed('ViewContent'), true);
  assert.equal(isEventAllowed('AddToCart'), true);
  assert.equal(isEventAllowed('InitiateCheckout'), true);
  assert.equal(isEventAllowed('Purchase'), false);
  assert.equal(isEventAllowed('Nonsense'), false);
  assert.equal(isEventAllowed(undefined), false);
});

test('buildRequestUserData: maps non-PII context, omits empties, never PII', () => {
  const ud = buildRequestUserData({ ip: '1.2.3.4', userAgent: 'UA/1', fbp: 'fb.1.p', fbc: 'fb.1.c' });
  assert.deepEqual(ud, {
    client_ip_address: '1.2.3.4',
    client_user_agent: 'UA/1',
    fbp: 'fb.1.p',
    fbc: 'fb.1.c',
  });
  assert.deepEqual(buildRequestUserData({}), {});
  const partial = buildRequestUserData({ ip: '9.9.9.9' });
  assert.deepEqual(partial, { client_ip_address: '9.9.9.9' });
  // No email/phone match keys ever appear.
  assert.equal('em' in ud, false);
  assert.equal('ph' in ud, false);
});

test('sendCapiEvent: builds correct envelope, normalizes content_ids, adds value+currency', async () => {
  const res = await sendCapiEvent({
    eventName: 'ViewContent',
    eventId: 'evt-1',
    sourceUrl: 'https://shop.example/product/1',
    contentIds: [' abc123 ', 'Sku-7'],
    value: 19.5,
    userData: { client_ip_address: '1.2.3.4' },
  });
  assert.equal(res.ok, true);
  assert.match(lastRequest.url, new RegExp(`/${PIXEL}/events`));
  assert.match(lastRequest.url, /access_token=/);
  const event = lastRequest.body.data[0];
  assert.equal(event.event_name, 'ViewContent');
  assert.equal(event.event_id, 'evt-1');
  assert.equal(event.action_source, 'website');
  assert.equal(event.event_source_url, 'https://shop.example/product/1');
  assert.equal(typeof event.event_time, 'number');
  assert.deepEqual(event.user_data, { client_ip_address: '1.2.3.4' });
  assert.equal(event.custom_data.content_type, 'product');
  assert.deepEqual(event.custom_data.content_ids, ['ABC123', 'SKU-7']);
  assert.equal(event.custom_data.value, 19.5);
  assert.equal(event.custom_data.currency, 'USD');
});

test('sendCapiEvent: normalizes contents ids and defaults quantity', async () => {
  await sendCapiEvent({
    eventName: 'AddToCart',
    eventId: 'evt-2',
    contents: [{ id: 'p1', quantity: 2, item_price: 10 }, { id: ' p2 ' }],
  });
  const event = lastRequest.body.data[0];
  assert.deepEqual(event.custom_data.contents, [
    { id: 'P1', quantity: 2, item_price: 10 },
    { id: 'P2', quantity: 1 },
  ]);
});

test('sendCapiEvent: omits value/currency when value is absent or non-numeric', async () => {
  await sendCapiEvent({ eventName: 'InitiateCheckout', eventId: 'evt-3', contentIds: ['x'] });
  const cd = lastRequest.body.data[0].custom_data;
  assert.equal('value' in cd, false);
  assert.equal('currency' in cd, false);
});

test('sendCapiEvent: rejects Purchase (dedicated path only), no network call', async () => {
  const res = await sendCapiEvent({ eventName: 'Purchase', eventId: 'evt-4', value: 100 });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'event_not_allowed');
  assert.equal(lastRequest, null);
});

test('sendCapiEvent: no-op (no network) when access token unset', async () => {
  delete process.env.TRENDING_META_CAPI_ACCESS_TOKEN;
  const res = await sendCapiEvent({ eventName: 'ViewContent', eventId: 'evt-5', contentIds: ['x'] });
  assert.equal(res.ok, false);
  assert.equal(res.skipped, true);
  assert.equal(res.reason, 'not_configured');
  assert.equal(lastRequest, null, 'must not touch the network without a token');
});

test('sendCapiEvent: includes test_event_code when the env var is set', async () => {
  process.env.TRENDING_META_TEST_EVENT_CODE = 'TEST42';
  await sendCapiEvent({ eventName: 'ViewContent', eventId: 'evt-6', contentIds: ['x'] });
  assert.equal(lastRequest.body.test_event_code, 'TEST42');
});

test('metaTrackEvent: rejects a bad event_name with 400 before anything else', async () => {
  const res = await invokeFunction('metaTrackEvent', { event_name: 'Purchase', event_id: 'e' }, null, {});
  assert.equal(res._status, 400);
  assert.match(res.error, /event_name/);
  assert.equal(lastRequest, null);
});

test('metaTrackEvent: derives non-PII user_data from request context', async () => {
  const res = await invokeFunction(
    'metaTrackEvent',
    { event_name: 'AddToCart', event_id: 'e-9', content_ids: ['sku1'], value: 5 },
    null,
    { ip: '8.8.8.8', userAgent: 'Jest', fbp: 'fbp1', fbc: 'fbc1' },
  );
  assert.equal(res.ok, true);
  const event = lastRequest.body.data[0];
  assert.deepEqual(event.user_data, {
    client_ip_address: '8.8.8.8',
    client_user_agent: 'Jest',
    fbp: 'fbp1',
    fbc: 'fbc1',
  });
  assert.deepEqual(event.custom_data.content_ids, ['SKU1']);
});

test('metaTrackEvent: silent no-op when Meta is not configured', async () => {
  delete process.env.TRENDING_META_PIXEL_ID;
  delete process.env.TRENDING_META_CAPI_ACCESS_TOKEN;
  const res = await invokeFunction('metaTrackEvent', { event_name: 'ViewContent', event_id: 'e' }, null, {});
  assert.equal(res.ok, true);
  assert.equal(res.skipped, true);
  assert.equal(lastRequest, null);
});

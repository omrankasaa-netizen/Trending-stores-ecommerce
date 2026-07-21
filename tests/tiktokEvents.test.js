import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  sendTiktokEvent, sendTiktokPurchase, isEventAllowed, buildRequestUser, isEventsApiConfigured,
} from '../server/tiktok.js';
import { invokeFunction } from '../server/functions.js';

const PIXEL = 'TEST_TT_PIXEL_123';
const TOKEN = 'TEST_TT_TOKEN_abc';
const ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

// Swap in a fake fetch that records the last request instead of hitting the
// network. TikTok's Events API endpoint is NEVER contacted in tests.
let lastRequest;
const realFetch = globalThis.fetch;
function installFetchSpy() {
  lastRequest = null;
  globalThis.fetch = async (url, opts) => {
    lastRequest = { url, headers: opts.headers, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ code: 0, message: 'OK' }) };
  };
}

beforeEach(() => {
  process.env.TRENDING_TIKTOK_PIXEL_ID = PIXEL;
  process.env.TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN = TOKEN;
  delete process.env.TRENDING_TIKTOK_TEST_EVENT_CODE;
  installFetchSpy();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.TRENDING_TIKTOK_PIXEL_ID;
  delete process.env.TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN;
  delete process.env.TRENDING_TIKTOK_TEST_EVENT_CODE;
});

test('isEventAllowed: only the three browsing events, never CompletePayment', () => {
  assert.equal(isEventAllowed('ViewContent'), true);
  assert.equal(isEventAllowed('AddToCart'), true);
  assert.equal(isEventAllowed('InitiateCheckout'), true);
  assert.equal(isEventAllowed('CompletePayment'), false);
  assert.equal(isEventAllowed('Nonsense'), false);
  assert.equal(isEventAllowed(undefined), false);
});

test('isEventsApiConfigured: needs both pixel id and access token', () => {
  assert.equal(isEventsApiConfigured(), true);
  delete process.env.TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN;
  assert.equal(isEventsApiConfigured(), false);
});

test('buildRequestUser: maps non-PII context, omits empties, never PII', () => {
  const user = buildRequestUser({ ip: '1.2.3.4', userAgent: 'UA/1', ttclid: 'ttc.1', ttp: 'ttp.1' });
  assert.deepEqual(user, {
    ip: '1.2.3.4',
    user_agent: 'UA/1',
    ttclid: 'ttc.1',
    ttp: 'ttp.1',
  });
  assert.deepEqual(buildRequestUser({}), {});
  assert.deepEqual(buildRequestUser({ ip: '9.9.9.9' }), { ip: '9.9.9.9' });
  // No email/phone match keys ever appear.
  assert.equal('email' in user, false);
  assert.equal('phone' in user, false);
});

test('sendTiktokEvent: builds correct envelope, normalizes contents, adds value+currency', async () => {
  const res = await sendTiktokEvent({
    eventName: 'ViewContent',
    eventId: 'evt-1',
    sourceUrl: 'https://shop.example/product/1',
    contents: [{ content_id: ' abc123 ', content_name: 'Widget', quantity: 2, price: 10 }, { content_id: 'Sku-7' }],
    value: 19.5,
    userData: { ip: '1.2.3.4' },
  });
  assert.equal(res.ok, true);
  assert.equal(lastRequest.url, ENDPOINT);
  assert.equal(lastRequest.headers['Access-Token'], TOKEN);
  assert.equal(lastRequest.headers['Content-Type'], 'application/json');
  assert.equal(lastRequest.body.event_source, 'web');
  assert.equal(lastRequest.body.event_source_id, PIXEL);
  const event = lastRequest.body.data[0];
  assert.equal(event.event, 'ViewContent');
  assert.equal(event.event_id, 'evt-1');
  assert.equal(typeof event.event_time, 'number');
  assert.deepEqual(event.user, { ip: '1.2.3.4' });
  assert.deepEqual(event.page, { url: 'https://shop.example/product/1' });
  assert.equal(event.properties.content_type, 'product');
  assert.deepEqual(event.properties.contents, [
    { content_id: 'ABC123', quantity: 2, price: 10, content_name: 'Widget' },
    { content_id: 'SKU-7', quantity: 1 },
  ]);
  assert.equal(event.properties.value, 19.5);
  assert.equal(event.properties.currency, 'USD');
});

test('sendTiktokEvent: omits value/currency when value is absent or non-numeric', async () => {
  await sendTiktokEvent({ eventName: 'InitiateCheckout', eventId: 'evt-3', contents: [{ content_id: 'x' }] });
  const props = lastRequest.body.data[0].properties;
  assert.equal('value' in props, false);
  assert.equal('currency' in props, false);
});

test('sendTiktokEvent: rejects CompletePayment (dedicated path only), no network call', async () => {
  const res = await sendTiktokEvent({ eventName: 'CompletePayment', eventId: 'evt-4', value: 100 });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'event_not_allowed');
  assert.equal(lastRequest, null);
});

test('sendTiktokEvent: no-op (no network) when access token unset', async () => {
  delete process.env.TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN;
  const res = await sendTiktokEvent({ eventName: 'ViewContent', eventId: 'evt-5', contents: [{ content_id: 'x' }] });
  assert.equal(res.ok, false);
  assert.equal(res.skipped, true);
  assert.equal(res.reason, 'not_configured');
  assert.equal(lastRequest, null, 'must not touch the network without a token');
});

test('sendTiktokEvent: includes test_event_code when the env var is set', async () => {
  process.env.TRENDING_TIKTOK_TEST_EVENT_CODE = 'TT_TEST42';
  await sendTiktokEvent({ eventName: 'ViewContent', eventId: 'evt-6', contents: [{ content_id: 'x' }] });
  assert.equal(lastRequest.body.test_event_code, 'TT_TEST42');
});

test('sendTiktokPurchase: SHA-256 hashes PII, sends CompletePayment with order total', async () => {
  const order = {
    id: 'o1',
    total: 42.5,
    customer_email: '  Buyer@Example.COM ',
    customer_phone: '+1 (555) 010-2020',
    user_id: 'user-9',
    items: [{ product_id: 'p1', quantity: 2, price: 12.5 }],
  };
  const res = await sendTiktokPurchase({ order, eventId: 'pur-1' });
  assert.equal(res.ok, true);
  const event = lastRequest.body.data[0];
  assert.equal(event.event, 'CompletePayment');
  assert.equal(event.event_id, 'pur-1');
  assert.equal(event.properties.value, 42.5);
  assert.equal(event.properties.currency, 'USD');
  assert.deepEqual(event.properties.contents, [{ content_id: 'P1', quantity: 2, price: 12.5 }]);
  // Email is lowercased+trimmed then hashed.
  const expectedEmail = crypto.createHash('sha256').update('buyer@example.com').digest('hex');
  assert.equal(event.user.email, expectedEmail);
  // Phone keeps digits only before hashing.
  const expectedPhone = crypto.createHash('sha256').update('15550102020').digest('hex');
  assert.equal(event.user.phone, expectedPhone);
  // external_id derived from user_id, hashed.
  const expectedExt = crypto.createHash('sha256').update('user-9').digest('hex');
  assert.equal(event.user.external_id, expectedExt);
  // No raw PII leaks.
  assert.equal(JSON.stringify(event.user).includes('buyer@example.com'), false);
});

test('sendTiktokPurchase: silent no-op when unconfigured', async () => {
  delete process.env.TRENDING_TIKTOK_PIXEL_ID;
  const res = await sendTiktokPurchase({ order: { id: 'o1', total: 1, items: [] }, eventId: 'p' });
  assert.equal(res.ok, false);
  assert.equal(res.skipped, true);
  assert.equal(res.reason, 'not_configured');
  assert.equal(lastRequest, null);
});

test('tiktokTrackEvent: rejects a bad event_name with 400 before anything else', async () => {
  const res = await invokeFunction('tiktokTrackEvent', { event_name: 'CompletePayment', event_id: 'e' }, null, {});
  assert.equal(res._status, 400);
  assert.match(res.error, /event_name/);
  assert.equal(lastRequest, null);
});

test('tiktokTrackEvent: derives non-PII user from request context', async () => {
  const res = await invokeFunction(
    'tiktokTrackEvent',
    { event_name: 'AddToCart', event_id: 'e-9', contents: [{ content_id: 'sku1' }], value: 5 },
    null,
    { ip: '8.8.8.8', userAgent: 'Runner', ttclid: 'ttc1', ttp: 'ttp1' },
  );
  assert.equal(res.ok, true);
  const event = lastRequest.body.data[0];
  assert.deepEqual(event.user, {
    ip: '8.8.8.8',
    user_agent: 'Runner',
    ttclid: 'ttc1',
    ttp: 'ttp1',
  });
  assert.deepEqual(event.properties.contents, [{ content_id: 'SKU1', quantity: 1 }]);
});

test('tiktokTrackEvent: silent no-op when TikTok is not configured', async () => {
  delete process.env.TRENDING_TIKTOK_PIXEL_ID;
  delete process.env.TRENDING_TIKTOK_EVENTS_API_ACCESS_TOKEN;
  const res = await invokeFunction('tiktokTrackEvent', { event_name: 'ViewContent', event_id: 'e' }, null, {});
  assert.equal(res.ok, true);
  assert.equal(res.skipped, true);
  assert.equal(lastRequest, null);
});

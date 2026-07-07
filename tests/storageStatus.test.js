import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageStatus, missingR2Vars, R2_REQUIRED_VARS } from '../server/storage.js';

const FULL_R2_ENV = {
  R2_ACCOUNT_ID: 'acct123',
  R2_ACCESS_KEY_ID: 'AKIA_super_secret_key_id',
  R2_SECRET_ACCESS_KEY: 'the_secret_value_do_not_leak',
  R2_BUCKET: 'my-bucket',
  R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
};

test('storageStatus: reports r2 backend and no missing vars when fully configured', () => {
  const status = storageStatus(FULL_R2_ENV);
  assert.equal(status.backend, 'r2');
  assert.equal(status.r2_configured, true);
  assert.deepEqual(status.missing_vars, []);
  assert.equal(status.bucket, 'my-bucket');
  assert.equal(status.public_base, 'https://cdn.example.com');
  assert.equal(status.endpoint, 'https://acct123.r2.cloudflarestorage.com');
});

test('storageStatus: reports local backend and lists missing vars when unset', () => {
  const status = storageStatus({ R2_BUCKET: 'only-bucket' });
  assert.equal(status.backend, 'local');
  assert.equal(status.r2_configured, false);
  assert.deepEqual(
    status.missing_vars.sort(),
    ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_BASE_URL'].sort(),
  );
  assert.equal(status.bucket, 'only-bucket');
  assert.equal(status.public_base, null);
  assert.equal(status.endpoint, null); // not resolved unless R2 is fully configured
});

test('storageStatus: empty env reports every required var as missing', () => {
  const status = storageStatus({});
  assert.equal(status.backend, 'local');
  assert.equal(status.r2_configured, false);
  assert.deepEqual(status.missing_vars.sort(), [...R2_REQUIRED_VARS].sort());
  assert.equal(status.bucket, null);
  assert.equal(status.public_base, null);
  assert.equal(status.endpoint, null);
});

test('storageStatus: NEVER returns secret values (access key id / secret access key)', () => {
  const status = storageStatus(FULL_R2_ENV);
  const serialized = JSON.stringify(status);
  assert.ok(!serialized.includes(FULL_R2_ENV.R2_ACCESS_KEY_ID), 'must not leak access key id');
  assert.ok(!serialized.includes(FULL_R2_ENV.R2_SECRET_ACCESS_KEY), 'must not leak secret access key');
  // Only these keys should ever be present in the diagnostic payload.
  assert.deepEqual(
    Object.keys(status).sort(),
    ['backend', 'bucket', 'endpoint', 'missing_vars', 'public_base', 'r2_configured'].sort(),
  );
  // The secret var names must not appear in missing_vars as *values*, but their
  // NAMES are allowed there — assert the payload has no `*_value` leakage.
  assert.ok(!('access_key_id' in status));
  assert.ok(!('secret_access_key' in status));
});

test('storageStatus: activeBackend override reflects real runtime backend', () => {
  // R2 is configured, but runtime fell back to local (e.g. R2 init failed).
  const status = storageStatus(FULL_R2_ENV, 'local');
  assert.equal(status.backend, 'local');
  assert.equal(status.r2_configured, true); // config still present — useful signal
});

test('missingR2Vars: returns only unset required var names', () => {
  assert.deepEqual(missingR2Vars(FULL_R2_ENV), []);
  assert.deepEqual(missingR2Vars({ ...FULL_R2_ENV, R2_BUCKET: '' }), ['R2_BUCKET']);
});

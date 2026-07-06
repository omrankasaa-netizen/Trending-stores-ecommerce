import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getVariantImages, getImagesForVariant, getProductImages,
} from '../src/lib/productImages.js';

test('getVariantImages: reads a size images array (normalized objects)', () => {
  const size = { label: 'L', images: ['https://x/large.jpg', { url: 'https://x/l2.jpg', focal: { x: 0.5, y: 0.5 } }] };
  const imgs = getVariantImages(size);
  assert.equal(imgs.length, 2);
  assert.equal(imgs[0].url, 'https://x/large.jpg');
  assert.equal(imgs[1].url, 'https://x/l2.jpg');
});

test('getVariantImages: supports a legacy single image object; empty when none', () => {
  assert.equal(getVariantImages({ label: 'S' }).length, 0);
  assert.equal(getVariantImages(null).length, 0);
  const one = getVariantImages({ label: 'M', image: 'https://x/m.jpg' });
  assert.equal(one.length, 1);
  assert.equal(one[0].url, 'https://x/m.jpg');
});

test('getImagesForVariant: variant images lead, product defaults follow (deduped)', () => {
  const product = { images: ['https://x/default1.jpg', 'https://x/shared.jpg'] };
  const size = { label: 'L', images: ['https://x/large.jpg', 'https://x/shared.jpg'] };
  const merged = getImagesForVariant(product, size);
  assert.deepEqual(merged.map((i) => i.url), [
    'https://x/large.jpg', 'https://x/shared.jpg', 'https://x/default1.jpg',
  ]);
});

test('getImagesForVariant: falls back to product defaults when the variant has no image', () => {
  const product = { images: ['https://x/default1.jpg'] };
  const merged = getImagesForVariant(product, { label: 'S' });
  assert.deepEqual(merged.map((i) => i.url), getProductImages(product).map((i) => i.url));
  // No selected variant at all → still the product defaults.
  assert.equal(getImagesForVariant(product, null).length, 1);
});

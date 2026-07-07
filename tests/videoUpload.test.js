import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVideoUpload, storeVideo } from '../server/imageOptimize.js';

test('isVideoUpload: detects common video mime types', () => {
  assert.equal(isVideoUpload('video/mp4', 'clip.mp4'), true);
  assert.equal(isVideoUpload('video/webm', 'clip.webm'), true);
  assert.equal(isVideoUpload('video/quicktime', 'clip.mov'), true);
});

test('isVideoUpload: falls back to filename extension when mime is missing', () => {
  assert.equal(isVideoUpload('', 'demo.mp4'), true);
  assert.equal(isVideoUpload(undefined, 'demo.mov'), true);
  assert.equal(isVideoUpload('application/octet-stream', 'demo.webm'), true);
});

test('isVideoUpload: images are NOT treated as video', () => {
  assert.equal(isVideoUpload('image/jpeg', 'photo.jpg'), false);
  assert.equal(isVideoUpload('image/png', 'photo.png'), false);
  assert.equal(isVideoUpload('image/webp', 'photo.webp'), false);
  assert.equal(isVideoUpload('', 'photo.jpg'), false);
});

test('storeVideo: stores raw bytes, skips the image (sharp/webp) transform', async () => {
  // A tiny non-video buffer: if sharp ran it would throw/re-encode; storeVideo
  // must NOT call sharp, so it stores the bytes as-is and reports is_video.
  const buffer = Buffer.from('not-really-a-video-but-bytes');
  const descriptor = await storeVideo(buffer, 'demo.mp4', 'video/mp4');

  assert.equal(descriptor.is_video, true);
  assert.equal(descriptor.optimized, false);
  assert.equal(descriptor.variants, null); // no webp derivatives were produced
  assert.equal(descriptor.format, 'mp4');
  assert.equal(descriptor.content_type, 'video/mp4');
  assert.ok(descriptor.url.endsWith('.mp4'), `url should keep the video extension: ${descriptor.url}`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatMediaDuration,
  formatMediaMetadataSummary,
} from '../src/utils/mediaMetadata.ts';

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('media metadata formatting stays compact for node footer rows', () => {
  assert.equal(formatMediaDuration(8.04), '8.0s');
  assert.equal(formatMediaDuration(65), '1:05');
  assert.equal(formatMediaDuration(3723), '1:02:03');
  assert.equal(formatMediaMetadataSummary('image', { width: 1024, height: 1536 }), '1024×1536');
  assert.equal(formatMediaMetadataSummary('video', { width: 1920, height: 1080, duration: 6 }), '1920×1080 · 6.0s');
  assert.equal(formatMediaMetadataSummary('audio', { duration: 183 }), '3:03');
});

test('upload and output material nodes display metadata badges for image video and audio', () => {
  const upload = read('../src/components/nodes/UploadNode.tsx');
  const output = read('../src/components/nodes/OutputNode.tsx');

  assert.match(upload, /MediaMetadataBadge/);
  assert.match(output, /MediaMetadataBadge/);
  assert.equal((upload.match(/<MediaMetadataBadge/g) || []).length, 3);
  assert.equal((output.match(/<MediaMetadataBadge/g) || []).length, 3);
  for (const kind of ['image', 'video', 'audio']) {
    assert.match(upload, new RegExp(`kind="${kind}"[\\s\\S]*url=\\{item\\.url\\}`));
    assert.match(output, new RegExp(`kind="${kind}"[\\s\\S]*url=\\{u\\}`));
  }
});

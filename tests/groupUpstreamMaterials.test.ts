import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeUpstreamMaterialBuckets } from '../src/utils/upstreamMaterialBuckets.ts';

const text = (id: string, url: string, sourceNodeId = 'group-a') => ({
  id,
  kind: 'text',
  url,
  sourceNodeId,
  origin: 'upstream',
  label: url,
});

test('group output text field echoes are shown once in downstream image nodes', () => {
  const buckets = dedupeUpstreamMaterialBuckets({
    texts: [
      text('group-a::text-field:group-a:reply', '你在干嘛呢?'),
      text('group-a::text-field:group-a:prompt', '你在干嘛呢?'),
      text('group-a::text-field:group-a:text', '你在干嘛呢?'),
      text('text-b::text-field:text-b:prompt', '你在干嘛呢?', 'text-b'),
    ],
    images: [],
    videos: [],
    audios: [],
  });

  assert.deepEqual(
    buckets.texts.map((item) => item.id),
    ['group-a::text-field:group-a:reply', 'text-b::text-field:text-b:prompt'],
  );
});

test('manual ordered text entries keep duplicate content when they are not field echoes', () => {
  const buckets = dedupeUpstreamMaterialBuckets({
    texts: [
      text('material-set-a::material-set:material-set-a:text:0', '重复强调', 'material-set-a'),
      text('material-set-a::material-set:material-set-a:text:1', '重复强调', 'material-set-a'),
    ],
    images: [],
    videos: [],
    audios: [],
  });

  assert.deepEqual(
    buckets.texts.map((item) => item.id),
    [
      'material-set-a::material-set:material-set-a:text:0',
      'material-set-a::material-set:material-set-a:text:1',
    ],
  );
});

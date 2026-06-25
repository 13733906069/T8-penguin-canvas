import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { IMAGE_MODELS, gptImage2ZhenzhenVariantSize, isFalModel } from '../src/providers/models.ts';

const imageNodeSource = fs.readFileSync(new URL('../src/components/nodes/ImageNode.tsx', import.meta.url), 'utf8');
const proxySource = fs.readFileSync(new URL('../backend/src/routes/proxy.js', import.meta.url), 'utf8');

test('Nano Banana 2 maps to the current Gemini Flash image upstream model', () => {
  const banana2 = IMAGE_MODELS.find((model) => model.id === 'nano-banana-2');

  assert.equal(banana2?.apiModel, 'gemini-3.1-flash-image');
  assert.equal(banana2?.apiModelOptions[0]?.value, 'gemini-3.1-flash-image');
  assert.equal(banana2?.apiModelOptions[0]?.label, 'nano-banana-2 (Flash)');
  assert.equal(banana2?.paramKind, 'banana-ratio');
  assert.equal(banana2?.apiModelOptions.some((option) => option.value === 'nano-banana-2-fal'), true);
});

test('old saved nano-banana-2 apiModel values are not submitted as upstream model ids', () => {
  assert.match(imageNodeSource, /modelDef\.apiModelOptions\.some\(\(opt\) => opt\.value === savedApiModel\)/);
  assert.match(proxySource, /function normalizeImageApiModel\(model\)/);
  assert.match(proxySource, /raw === 'nano-banana-2'\) return 'gemini-3\.1-flash-image'/);
  assert.match(proxySource, /raw === 'gemini-3\.1-flash-image-preview'\) return 'gemini-3\.1-flash-image'/);
  assert.match(proxySource, /raw === 'gemini-3\.1-flash-image-previiew'\) return 'gemini-3\.1-flash-image'/);
});

test('Gemini image models still use nano-banana key and image_size protocol', () => {
  assert.match(proxySource, /m\.includes\('flash-image'\)/);
  assert.match(proxySource, /m\.includes\('gemini-3-pro-image'\)/);
  assert.match(proxySource, /function isBananaImageModel\(model\)/);
  assert.match(proxySource, /form\.append\('image_size', lvlUpper\)/);
  assert.match(proxySource, /body\.image_size = lvlUpper/);
});

test('Nano Banana Pro short ids stay unchanged while Gemini Pro preview ids normalize separately', () => {
  const bananaPro = IMAGE_MODELS.find((model) => model.id === 'nano-banana-pro');
  const options = bananaPro?.apiModelOptions.map((option) => option.value) || [];

  assert.equal(bananaPro?.apiModel, 'nano-banana-pro');
  assert.deepEqual(options.slice(0, 3), [
    'nano-banana-pro',
    'nano-banana-pro-2k',
    'nano-banana-pro-4k',
  ]);
  assert.equal(options.includes('nano-banana-pro-fal'), true);
  assert.equal(isFalModel('nano-banana-pro-fal'), true);
  assert.equal(isFalModel('nano-banana-pro'), false);
  assert.doesNotMatch(proxySource, /lower === 'nano-banana-pro'\) return 'gemini-3-pro-image'/);
  assert.match(proxySource, /raw === 'gemini-3-pro-image-preview'\) return 'gemini-3-pro-image'/);
  assert.match(proxySource, /raw === 'gemini-3-pro-image-2k-preview'\) return 'gemini-3-pro-image-2k'/);
  assert.match(proxySource, /raw === 'gemini-3-pro-image-4k-preview'\) return 'gemini-3-pro-image-4k'/);
});

test('GPT Image 2 2K and 4K variants stay on the Zhenzhen gpt-image-2 route', () => {
  const gpt2 = IMAGE_MODELS.find((model) => model.id === 'gpt-image-2');
  const options = gpt2?.apiModelOptions.map((option) => option.value) || [];

  assert.ok(options.includes('gpt-image-2-2K'));
  assert.ok(options.includes('gpt-image-2-4K'));
  assert.equal(gptImage2ZhenzhenVariantSize('gpt-image-2-2K'), '2K');
  assert.equal(gptImage2ZhenzhenVariantSize('gpt-image-2-4K'), '4K');
  assert.equal(isFalModel('gpt-image-2-2K'), false);
  assert.equal(isFalModel('gpt-image-2-4K'), false);
  assert.match(imageNodeSource, /gptImage2ZhenzhenVariantSize\(nextApiModel\)/);
  assert.match(proxySource, /if \(gptImage2ZhenzhenVariantSize\(raw\)\) return 'gpt-image-2'/);
  assert.match(proxySource, /image_size: gptImage2ForcedSize \|\| image_size/);
  assert.match(proxySource, /size: gptImage2ForcedSize \? undefined : size/);
});

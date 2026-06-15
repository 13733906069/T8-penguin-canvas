import test from 'node:test';
import assert from 'node:assert/strict';
import { createMaxCropBoxForAspect, fitCropBoxToAspect, resizeCropBoxWithAspect } from '../src/utils/imageCropAspect.ts';

function pixelRatio(box: { w: number; h: number }, imageW: number, imageH: number) {
  return (box.w * imageW) / (box.h * imageH);
}

function assertInBounds(box: { x: number; y: number; w: number; h: number }) {
  assert.ok(box.x >= 0, `x should stay in bounds: ${box.x}`);
  assert.ok(box.y >= 0, `y should stay in bounds: ${box.y}`);
  assert.ok(box.w > 0, `w should be positive: ${box.w}`);
  assert.ok(box.h > 0, `h should be positive: ${box.h}`);
  assert.ok(box.x + box.w <= 1.0000001, `right edge should stay in bounds: ${box.x + box.w}`);
  assert.ok(box.y + box.h <= 1.0000001, `bottom edge should stay in bounds: ${box.y + box.h}`);
}

test('fitCropBoxToAspect preserves requested pixel ratio inside a wide image', () => {
  const box = fitCropBoxToAspect({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, 1672, 941, 16 / 9);

  assertInBounds(box);
  assert.ok(Math.abs(pixelRatio(box, 1672, 941) - 16 / 9) < 0.000001);
});

test('fitCropBoxToAspect handles portrait ratios without leaving the image', () => {
  const box = fitCropBoxToAspect({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, 1672, 941, 9 / 16);

  assertInBounds(box);
  assert.ok(Math.abs(pixelRatio(box, 1672, 941) - 9 / 16) < 0.000001);
});

test('createMaxCropBoxForAspect fills the image bounds for preset ratios', () => {
  const portrait = createMaxCropBoxForAspect(1024, 1024, 9 / 16);
  const landscape = createMaxCropBoxForAspect(1024, 1024, 16 / 9);

  assertInBounds(portrait);
  assertInBounds(landscape);
  assert.equal(Math.round(portrait.w * 1024), 576);
  assert.equal(Math.round(portrait.h * 1024), 1024);
  assert.equal(Math.round(portrait.x * 1024), 224);
  assert.equal(Math.round(portrait.y * 1024), 0);
  assert.equal(Math.round(landscape.w * 1024), 1024);
  assert.equal(Math.round(landscape.h * 1024), 576);
  assert.equal(Math.round(landscape.x * 1024), 0);
  assert.equal(Math.round(landscape.y * 1024), 224);
});

test('resizeCropBoxWithAspect keeps the opposite corner fixed while resizing', () => {
  const start = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
  const box = resizeCropBoxWithAspect(start, 0.2, 0.1, 'br', 1200, 800, 1);

  assertInBounds(box);
  assert.equal(box.x, start.x);
  assert.equal(box.y, start.y);
  assert.ok(Math.abs(pixelRatio(box, 1200, 800) - 1) < 0.000001);
});

test('resizeCropBoxWithAspect clamps to the image edge for extreme drags', () => {
  const box = resizeCropBoxWithAspect({ x: 0.4, y: 0.4, w: 0.3, h: 0.3 }, 2, 2, 'br', 1600, 900, 21 / 9);

  assertInBounds(box);
  assert.ok(Math.abs(pixelRatio(box, 1600, 900) - 21 / 9) < 0.000001);
});

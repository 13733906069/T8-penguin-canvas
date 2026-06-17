import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BOARD_DIMENSION,
  MIN_BOARD_DIMENSION,
  clampBoardDimension,
  fitImageToBoard,
  originalPixelImagePlacement,
} from '../src/utils/drawingBoardSizing.ts';

test('drawing board free dimensions can commit small custom values without snapping back to old preset floor', () => {
  assert.equal(clampBoardDimension(120, 960), 120);
  assert.equal(clampBoardDimension(1, 960), MIN_BOARD_DIMENSION);
  assert.equal(clampBoardDimension(90000, 960), MAX_BOARD_DIMENSION);
  assert.equal(clampBoardDimension(Number.NaN, 512), 512);
});

test('drawing board still fits newly imported images for comfortable editing by default', () => {
  const rect = fitImageToBoard(240, 1714, 960, 540, 0);
  assert.ok(rect.h <= 540 * 0.78 + 1);
  assert.ok(rect.w < 120);
});

test('drawing board original pixel placement keeps the image at source pixel dimensions', () => {
  assert.deepEqual(originalPixelImagePlacement(240, 1714), {
    boardW: 240,
    boardH: 1714,
    rect: { x: 0, y: 0, w: 240, h: 1714 },
  });
});

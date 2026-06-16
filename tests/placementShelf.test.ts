import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('placement shelf can be cleared without auto-restoring old canvas nodes', () => {
  const canvas = read('../src/components/Canvas.tsx');

  assert.match(canvas, /onClear/);
  assert.match(canvas, /aria-label="清空放置栏"/);
  assert.match(canvas, /title="清空放置栏"/);
  assert.match(canvas, /placementShelfClearedCanvasIdsRef/);
  assert.match(canvas, /placementShelfClearedCanvasIdsRef\.current\.add\(activeId\)/);
  assert.match(canvas, /placementShelfClearedCanvasIdsRef\.current\.has\(requestedCanvasId\)/);
  assert.match(canvas, /setPlacementShelfItems\(placementShelfClearedCanvasIdsRef\.current\.has\(requestedCanvasId\)\s*\?\s*\[\]\s*:\s*placementShelfItemsFromCanvasNodes\(fixedNs, '画布'\)\)/);
});

test('selection context menu can add current nodes to placement shelf', () => {
  const canvas = read('../src/components/Canvas.tsx');

  assert.match(canvas, /type PlacementShelfSource = '粘贴' \| '发送' \| '生成' \| '画布' \| '手动'/);
  assert.match(canvas, /addNodesToPlacementShelf/);
  assert.match(canvas, /placementShelfItemFromNode\(node, '手动'\)/);
  assert.match(canvas, /添加到放置栏/);
  assert.match(canvas, /LucideIcons\.Archive/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import type { NodeMeta } from '../src/types/canvas.ts';
import {
  DEFAULT_RADIAL_MENU_NODE_TYPES,
  RADIAL_MENU_CANCEL_RADIUS,
  RADIAL_MENU_SLOT_COUNT,
  clampRadialMenuCenter,
  createDefaultRadialMenuSlots,
  normalizeRadialMenuSlots,
  radialSlotIndexFromPointer,
} from '../src/utils/radialMenu.ts';

const fakeNodes: NodeMeta[] = [
  { type: 'text', label: '文本', category: 'core', description: '', icon: 'Type', color: 'sky' },
  { type: 'upload', label: '上传素材', category: 'input', description: '', icon: 'Upload', color: 'emerald' },
  { type: 'material-set', label: '素材集', category: 'input', description: '', icon: 'Images', color: 'teal' },
  { type: 'output', label: '输出素材', category: 'input', description: '', icon: 'MonitorPlay', color: 'teal' },
  { type: 'image', label: '图像', category: 'core', description: '', icon: 'Image', color: 'amber' },
  { type: 'video', label: '视频', category: 'core', description: '', icon: 'Video', color: 'rose' },
  { type: 'seedance', label: 'SD2.0', category: 'core', description: '', icon: 'Film', color: 'fuchsia' },
  { type: 'llm', label: 'LLM', category: 'core', description: '', icon: 'Brain', color: 'emerald' },
  { type: 'browser', label: '浏览器', category: 'utility', description: '', icon: 'Globe2', color: 'orange', hidden: true },
];

test('default radial menu uses eight high frequency core/material nodes', () => {
  assert.equal(DEFAULT_RADIAL_MENU_NODE_TYPES.length, RADIAL_MENU_SLOT_COUNT);
  assert.deepEqual(createDefaultRadialMenuSlots().map((slot) => slot.nodeType), DEFAULT_RADIAL_MENU_NODE_TYPES);
});

test('normalizeRadialMenuSlots replaces hidden or invalid node types with defaults', () => {
  const normalized = normalizeRadialMenuSlots(fakeNodes, [
    { id: 'a', nodeType: 'browser', enabled: true, order: 0 },
    { id: 'b', nodeType: 'image', enabled: false, order: 1 },
  ]);

  assert.equal(normalized.length, RADIAL_MENU_SLOT_COUNT);
  assert.equal(normalized[0].nodeType, 'text');
  assert.equal(normalized[1].nodeType, 'image');
  assert.equal(normalized[1].enabled, false);
});

test('radialSlotIndexFromPointer maps cardinal directions clockwise from top', () => {
  const center = { x: 100, y: 100 };

  assert.equal(radialSlotIndexFromPointer(center, { x: 100, y: 0 }), 0);
  assert.equal(radialSlotIndexFromPointer(center, { x: 200, y: 100 }), 2);
  assert.equal(radialSlotIndexFromPointer(center, { x: 100, y: 200 }), 4);
  assert.equal(radialSlotIndexFromPointer(center, { x: 0, y: 100 }), 6);
});

test('radialSlotIndexFromPointer returns null inside the cancel radius', () => {
  const center = { x: 100, y: 100 };

  assert.equal(radialSlotIndexFromPointer(center, { x: 100, y: 100 }), null);
  assert.equal(radialSlotIndexFromPointer(center, { x: 100, y: 100 + RADIAL_MENU_CANCEL_RADIUS - 1 }), null);
});

test('clampRadialMenuCenter keeps the menu inside the viewport', () => {
  const clamped = clampRadialMenuCenter({ x: 2, y: 900 }, { width: 500, height: 400 }, 200, 10);

  assert.deepEqual(clamped, { x: 110, y: 290 });
});

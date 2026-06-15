import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SHORTCUTS, getDefaultShortcutMap } from '../src/utils/keyboardShortcuts.ts';

test('canvas center shortcut is configurable and defaults to Home', () => {
  const action = DEFAULT_SHORTCUTS.find((item) => item.id === 'canvas.center-view');

  assert.ok(action);
  assert.equal(action.group, '导航');
  assert.equal(action.label, '回到画布中心');
  assert.equal(getDefaultShortcutMap()['canvas.center-view']?.[0]?.key, 'Home');
});

test('Canvas handles the center shortcut outside editable and selected-node contexts', () => {
  const canvas = readFileSync(new URL('../src/components/Canvas.tsx', import.meta.url), 'utf8');

  assert.match(canvas, /const focusCanvasCenter\s*=\s*useCallback\(/);
  assert.match(canvas, /function centerOfNavigableNodes\(nodes:\s*Node\[\]\):\s*\{\s*x:\s*number;\s*y:\s*number\s*\}/);
  assert.match(canvas, /const center = centerOfNavigableNodes\(nodesRef\.current\)/);
  assert.match(canvas, /const \{\s*zoom\s*\} = getViewport\(\)/);
  assert.match(canvas, /setCenter\(center\.x,\s*center\.y,\s*\{\s*zoom,\s*duration:\s*420\s*\}\)/);
  assert.doesNotMatch(canvas, /setCenter\(0,\s*0,\s*\{\s*zoom,\s*duration:\s*420\s*\}\)/);
  assert.match(canvas, /matchesAnyShortcut\(shortcuts\['canvas\.center-view'\],\s*e\)/);
  assert.match(canvas, /if\s*\(selectedCount\s*>\s*0\)\s*return;[\s\S]*focusCanvasCenter\(\)/);
});

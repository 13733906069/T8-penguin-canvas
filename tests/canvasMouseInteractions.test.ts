import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('canvas keeps middle mouse panning while radial menu uses right long press', () => {
  const canvas = read('../src/components/Canvas.tsx');

  assert.match(canvas, /const CANVAS_PAN_MOUSE_BUTTONS = \[0, 1\] as const;/);
  assert.match(canvas, /const RADIAL_MENU_MOUSE_BUTTON = 2;/);
  assert.match(canvas, /canvasPanLocked \? false : \[\.\.\.CANVAS_PAN_MOUSE_BUTTONS\]/);
  assert.match(canvas, /event\.button !== RADIAL_MENU_MOUSE_BUTTON/);
  assert.match(canvas, /radialContextMenuSuppressedUntilRef/);
  assert.match(canvas, /if \(isRadialMenuContextMenuSuppressed\(\)\) \{/);

  const radialGestureBlock = canvas.slice(
    canvas.indexOf('const onPointerDown = (event: PointerEvent) => {'),
    canvas.indexOf("window.addEventListener('blur', closeRadial);"),
  );
  assert.doesNotMatch(radialGestureBlock, /event\.button !== 1/);
  assert.doesNotMatch(radialGestureBlock, /event\.button === 1/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(file: string) {
  return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
}

test('Electron patches native selects inside embedded VibeX frames to avoid misplaced menus', () => {
  const main = read('electron/main.cjs');

  assert.match(main, /function\s+buildVibeXFrameUiPatchScript\s*\(/);
  assert.match(main, /__t8VibeXSelectPatchInstalled/);
  assert.match(main, /querySelectorAll\(['"]select['"]\)/);
  assert.match(main, /t8-vibex-custom-select-trigger/);
  assert.match(main, /dispatchEvent\(new Event\(['"]change['"],\s*\{\s*bubbles:\s*true\s*\}\)\)/);
  assert.match(main, /function\s+injectVibeXFrameUiPatches\s*\(/);
  assert.match(main, /function\s+scheduleVibeXFrameUiPatch\s*\(/);
  assert.match(main, /did-frame-finish-load[\s\S]*scheduleVibeXFrameUiPatch/);
  assert.match(main, /reloadVibeXFramesAfterLogin[\s\S]*scheduleVibeXFrameUiPatch/);
});

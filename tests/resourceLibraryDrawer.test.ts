import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawer = readFileSync(new URL('../src/components/ResourceLibraryDrawer.tsx', import.meta.url), 'utf8');

test('resource library category add and rename use an in-app dialog instead of native prompt', () => {
  assert.doesNotMatch(drawer, /window\.prompt/);
  assert.match(drawer, /categoryDialog/);
  assert.match(drawer, /data-resource-category-dialog="true"/);
  assert.match(drawer, /data-resource-category-dialog-input/);
  assert.match(drawer, /data-resource-category-dialog-confirm/);
  assert.match(drawer, /itemRenameDialog/);
  assert.match(drawer, /data-resource-item-rename-dialog="true"/);
  assert.match(drawer, /data-resource-item-rename-dialog-input/);
  assert.match(drawer, /data-resource-item-rename-dialog-confirm/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const canvas = readFileSync(resolve(process.cwd(), 'src/components/Canvas.tsx'), 'utf8');

test('NodeID connect and find use an in-app dialog instead of native prompt', () => {
  assert.doesNotMatch(canvas, /window\.prompt\(\s*[\s\S]{0,80}输入要连接到的 NodeID/);
  assert.doesNotMatch(canvas, /window\.prompt\(\s*['"]输入要查找的 NodeID['"]\s*\)/);

  assert.match(canvas, /type NodeIdDialogState/);
  assert.match(canvas, /const \[nodeIdDialog,\s*setNodeIdDialog\]/);
  assert.match(canvas, /data-canvas-node-id-dialog="true"/);
  assert.match(canvas, /data-canvas-node-id-dialog-input/);
  assert.match(canvas, /data-canvas-node-id-dialog-confirm/);
  assert.match(canvas, /submitNodeIdDialog/);
  assert.match(canvas, /resolveConnectionByNodeSerialId/);
  assert.match(canvas, /findNodeBySerialId/);
});

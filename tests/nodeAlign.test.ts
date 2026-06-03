import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNodeAlignment } from '../src/utils/nodeAlign.ts';

function node(id: string, x: number, y: number, w = 100, h = 80, type = 'text'): any {
  return {
    id,
    type,
    position: { x, y },
    measured: { width: w, height: h },
    data: { label: id },
  };
}

test('applyNodeAlignment aligns selected nodes without touching data or ids', () => {
  const nodes = [
    node('a', 20, 30, 100, 80),
    node('b', 240, 90, 160, 100),
    node('c', 500, 500, 120, 90),
  ];
  const result = applyNodeAlignment(nodes, ['a', 'b'], 'align-right');

  assert.equal(result.changed, true);
  assert.deepEqual(result.movedIds.sort(), ['a']);
  assert.equal(result.nodes[0].id, 'a');
  assert.deepEqual(result.nodes[0].data, { label: 'a' });
  assert.deepEqual(result.nodes[0].position, { x: 300, y: 30 });
  assert.deepEqual(result.nodes[1].position, { x: 240, y: 90 });
  assert.strictEqual(result.nodes[2], nodes[2]);
});

test('applyNodeAlignment distributes horizontal spacing while preserving edge nodes', () => {
  const nodes = [
    node('a', 0, 0, 100, 80),
    node('b', 240, 40, 100, 80),
    node('c', 500, 70, 100, 80),
  ];
  const result = applyNodeAlignment(nodes, ['a', 'b', 'c'], 'distribute-x');

  assert.deepEqual(result.nodes.map((n: any) => n.position.x), [0, 250, 500]);
  assert.deepEqual(result.nodes.map((n: any) => n.position.y), [0, 40, 70]);
});

test('applyNodeAlignment snaps selected nodes to the configured grid', () => {
  const nodes = [
    node('a', 13, 17, 100, 80),
    node('b', 247, 93, 100, 80),
  ];
  const result = applyNodeAlignment(nodes, ['a', 'b'], 'snap-grid', { grid: [20, 20] });

  assert.deepEqual(result.nodes[0].position, { x: 20, y: 20 });
  assert.deepEqual(result.nodes[1].position, { x: 240, y: 100 });
});

test('applyNodeAlignment arranges selected nodes into a compact visual grid', () => {
  const nodes = [
    node('a', 300, 20, 100, 80),
    node('b', 20, 30, 100, 80),
    node('c', 160, 220, 100, 80),
    node('d', 520, 260, 100, 80),
  ];
  const result = applyNodeAlignment(nodes, ['a', 'b', 'c', 'd'], 'arrange-grid', { gridGap: 40 });

  assert.deepEqual(result.nodes.find((n: any) => n.id === 'b')?.position, { x: 20, y: 20 });
  assert.deepEqual(result.nodes.find((n: any) => n.id === 'a')?.position, { x: 160, y: 20 });
  assert.deepEqual(result.nodes.find((n: any) => n.id === 'c')?.position, { x: 20, y: 140 });
  assert.deepEqual(result.nodes.find((n: any) => n.id === 'd')?.position, { x: 160, y: 140 });
});

test('applyNodeAlignment moves group members when only the group box is aligned', () => {
  const nodes = [
    {
      ...node('group', 13, 17, 400, 300, 'groupBox'),
      data: { memberIds: ['a'], width: 400, height: 300 },
    },
    node('a', 80, 90, 100, 80),
    node('b', 300, 90, 100, 80),
  ];
  const result = applyNodeAlignment(nodes, ['group'], 'snap-grid', { grid: [20, 20] });

  assert.deepEqual(result.nodes.find((n: any) => n.id === 'group')?.position, { x: 20, y: 20 });
  assert.deepEqual(result.nodes.find((n: any) => n.id === 'a')?.position, { x: 87, y: 93 });
  assert.deepEqual(result.nodes.find((n: any) => n.id === 'b')?.position, { x: 300, y: 90 });
});

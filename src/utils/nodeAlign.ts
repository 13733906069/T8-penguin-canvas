import type { Node } from '@xyflow/react';

export type NodeAlignAction =
  | 'align-left'
  | 'align-center-x'
  | 'align-right'
  | 'align-top'
  | 'align-center-y'
  | 'align-bottom'
  | 'distribute-x'
  | 'distribute-y'
  | 'snap-grid'
  | 'arrange-grid';

export interface NodeAlignOptions {
  grid?: [number, number];
  gridGap?: number;
}

export interface NodeAlignResult {
  nodes: Node[];
  changed: boolean;
  movedIds: string[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_GRID: [number, number] = [20, 20];
const DEFAULT_GRID_GAP = 48;
const FALLBACK_SIZE = { w: 320, h: 240 };

function rectOf(node: Node): Rect {
  const data = (node.data || {}) as Record<string, any>;
  const rawW =
    (node as any).measured?.width ||
    (node as any).width ||
    (typeof data.width === 'number' ? data.width : 0) ||
    FALLBACK_SIZE.w;
  const rawH =
    (node as any).measured?.height ||
    (node as any).height ||
    (typeof data.height === 'number' ? data.height : 0) ||
    FALLBACK_SIZE.h;
  return {
    x: node.position?.x ?? 0,
    y: node.position?.y ?? 0,
    w: Math.ceil(rawW),
    h: Math.ceil(rawH),
  };
}

function selectedNodeSet(ids: string[]): Set<string> {
  return new Set(ids.filter(Boolean));
}

function selectionBounds(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function roundToStep(value: number, step: number): number {
  const safeStep = Math.max(1, Math.abs(step || 1));
  return Math.round(value / safeStep) * safeStep;
}

function samePosition(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}

function distributeOnAxis(
  selected: Node[],
  rectById: Map<string, Rect>,
  axis: 'x' | 'y',
): Map<string, { x: number; y: number }> {
  const next = new Map<string, { x: number; y: number }>();
  if (selected.length < 3) return next;
  const isX = axis === 'x';
  const sorted = [...selected].sort((a, b) => {
    const ar = rectById.get(a.id)!;
    const br = rectById.get(b.id)!;
    const av = isX ? ar.x : ar.y;
    const bv = isX ? br.x : br.y;
    if (Math.abs(av - bv) > 0.01) return av - bv;
    return (isX ? ar.y - br.y : ar.x - br.x);
  });
  const first = rectById.get(sorted[0].id)!;
  const last = rectById.get(sorted[sorted.length - 1].id)!;
  const start = isX ? first.x : first.y;
  const end = isX ? last.x + last.w : last.y + last.h;
  const totalSize = sorted.reduce((sum, node) => {
    const rect = rectById.get(node.id)!;
    return sum + (isX ? rect.w : rect.h);
  }, 0);
  const gap = (end - start - totalSize) / (sorted.length - 1);

  if (Number.isFinite(gap) && gap >= 0) {
    let cursor = start;
    for (let i = 0; i < sorted.length; i += 1) {
      const node = sorted[i];
      const rect = rectById.get(node.id)!;
      const pos = { ...(node.position || { x: 0, y: 0 }) };
      if (isX) pos.x = cursor;
      else pos.y = cursor;
      next.set(node.id, pos);
      cursor += (isX ? rect.w : rect.h) + gap;
    }
    return next;
  }

  const firstCenter = isX ? first.x + first.w / 2 : first.y + first.h / 2;
  const lastCenter = isX ? last.x + last.w / 2 : last.y + last.h / 2;
  const step = (lastCenter - firstCenter) / (sorted.length - 1);
  for (let i = 0; i < sorted.length; i += 1) {
    const node = sorted[i];
    const rect = rectById.get(node.id)!;
    const center = firstCenter + step * i;
    const pos = { ...(node.position || { x: 0, y: 0 }) };
    if (isX) pos.x = center - rect.w / 2;
    else pos.y = center - rect.h / 2;
    next.set(node.id, pos);
  }
  return next;
}

function arrangeGrid(
  selected: Node[],
  rectById: Map<string, Rect>,
  gap: number,
): Map<string, { x: number; y: number }> {
  const next = new Map<string, { x: number; y: number }>();
  if (selected.length < 2) return next;
  const rects = selected.map((node) => rectById.get(node.id)!);
  const bounds = selectionBounds(rects);
  if (!bounds) return next;
  const sorted = [...selected].sort((a, b) => {
    const ar = rectById.get(a.id)!;
    const br = rectById.get(b.id)!;
    const dy = ar.y - br.y;
    if (Math.abs(dy) > 24) return dy;
    return ar.x - br.x;
  });
  const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
  const maxW = Math.max(...rects.map((rect) => rect.w));
  const maxH = Math.max(...rects.map((rect) => rect.h));
  for (let i = 0; i < sorted.length; i += 1) {
    const node = sorted[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    next.set(node.id, {
      x: bounds.x + col * (maxW + gap),
      y: bounds.y + row * (maxH + gap),
    });
  }
  return next;
}

function groupMemberIds(group: Node, allNodes: Node[]): string[] {
  const explicit = Array.isArray((group.data as any)?.memberIds)
    ? ((group.data as any).memberIds as string[]).filter(Boolean)
    : [];
  if (explicit.length > 0) return explicit;
  const groupRect = rectOf(group);
  const ids: string[] = [];
  for (const node of allNodes) {
    if (node.id === group.id || node.type === 'groupBox') continue;
    const rect = rectOf(node);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (cx >= groupRect.x && cx <= groupRect.x + groupRect.w && cy >= groupRect.y && cy <= groupRect.y + groupRect.h) {
      ids.push(node.id);
    }
  }
  return ids;
}

export function applyNodeAlignment(
  nodes: Node[],
  selectedIds: string[],
  action: NodeAlignAction,
  options: NodeAlignOptions = {},
): NodeAlignResult {
  const selectedSet = selectedNodeSet(selectedIds);
  if (selectedSet.size === 0) return { nodes, changed: false, movedIds: [] };
  const selected = nodes.filter((node) => selectedSet.has(node.id));
  if (selected.length === 0) return { nodes, changed: false, movedIds: [] };

  const rectById = new Map<string, Rect>();
  for (const node of selected) rectById.set(node.id, rectOf(node));
  const bounds = selectionBounds([...rectById.values()]);
  if (!bounds) return { nodes, changed: false, movedIds: [] };

  let desired = new Map<string, { x: number; y: number }>();
  const grid = options.grid || DEFAULT_GRID;

  if (action === 'distribute-x') {
    desired = distributeOnAxis(selected, rectById, 'x');
  } else if (action === 'distribute-y') {
    desired = distributeOnAxis(selected, rectById, 'y');
  } else if (action === 'arrange-grid') {
    desired = arrangeGrid(selected, rectById, Math.max(0, options.gridGap ?? DEFAULT_GRID_GAP));
  } else {
    for (const node of selected) {
      const rect = rectById.get(node.id)!;
      const pos = { ...(node.position || { x: 0, y: 0 }) };
      if (action === 'align-left') pos.x = bounds.x;
      if (action === 'align-center-x') pos.x = bounds.x + bounds.w / 2 - rect.w / 2;
      if (action === 'align-right') pos.x = bounds.x + bounds.w - rect.w;
      if (action === 'align-top') pos.y = bounds.y;
      if (action === 'align-center-y') pos.y = bounds.y + bounds.h / 2 - rect.h / 2;
      if (action === 'align-bottom') pos.y = bounds.y + bounds.h - rect.h;
      if (action === 'snap-grid') {
        pos.x = roundToStep(pos.x, grid[0]);
        pos.y = roundToStep(pos.y, grid[1]);
      }
      desired.set(node.id, pos);
    }
  }

  if (desired.size === 0) return { nodes, changed: false, movedIds: [] };

  const followerDelta = new Map<string, { dx: number; dy: number }>();
  for (const group of selected) {
    if (group.type !== 'groupBox') continue;
    const nextPos = desired.get(group.id);
    if (!nextPos) continue;
    const dx = nextPos.x - (group.position?.x ?? 0);
    const dy = nextPos.y - (group.position?.y ?? 0);
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue;
    for (const memberId of groupMemberIds(group, nodes)) {
      if (selectedSet.has(memberId)) continue;
      const prev = followerDelta.get(memberId) || { dx: 0, dy: 0 };
      followerDelta.set(memberId, { dx: prev.dx + dx, dy: prev.dy + dy });
    }
  }

  const movedIds: string[] = [];
  const nextNodes = nodes.map((node) => {
    const explicit = desired.get(node.id);
    if (explicit) {
      const current = node.position || { x: 0, y: 0 };
      if (samePosition(current, explicit)) return node;
      movedIds.push(node.id);
      return { ...node, position: explicit };
    }
    const follower = followerDelta.get(node.id);
    if (follower) {
      const current = node.position || { x: 0, y: 0 };
      const nextPos = { x: current.x + follower.dx, y: current.y + follower.dy };
      if (samePosition(current, nextPos)) return node;
      movedIds.push(node.id);
      return { ...node, position: nextPos };
    }
    return node;
  });

  return {
    nodes: nextNodes,
    changed: movedIds.length > 0,
    movedIds,
  };
}

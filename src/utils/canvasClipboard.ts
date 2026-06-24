export interface ClipboardPosition {
  x: number;
  y: number;
}

export interface ClipboardPositionNode {
  id?: string;
  type?: string;
  data?: Record<string, unknown> | null;
  position?: Partial<ClipboardPosition>;
  width?: number | null;
  height?: number | null;
  measured?: {
    width?: number | null;
    height?: number | null;
  } | null;
}

export interface ClipboardNodeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

const finiteNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readNodeSize = (node: ClipboardPositionNode) => ({
  width: finiteNumber(node.width, finiteNumber(node.measured?.width, finiteNumber(node.data?.width, 0))),
  height: finiteNumber(node.height, finiteNumber(node.measured?.height, finiteNumber(node.data?.height, 0))),
});

const rectForClipboardNode = (node: ClipboardPositionNode) => {
  const x = finiteNumber(node.position?.x, 0);
  const y = finiteNumber(node.position?.y, 0);
  const size = readNodeSize(node);
  return { x, y, width: size.width, height: size.height };
};

export function getClipboardNodeBounds(nodes: ClipboardPositionNode[]): ClipboardNodeBounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  nodes.forEach((node) => {
    const rect = rectForClipboardNode(node);
    const { x, y } = rect;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + rect.width);
    maxY = Math.max(maxY, y + rect.height);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: minX + (maxX - minX) / 2,
    centerY: minY + (maxY - minY) / 2,
  };
}

export function positionClipboardNodesAtAnchor<T extends ClipboardPositionNode>(
  nodes: T[],
  anchor: ClipboardPosition,
): T[] {
  const bounds = getClipboardNodeBounds(nodes);
  const dx = anchor.x - bounds.minX;
  const dy = anchor.y - bounds.minY;
  return offsetClipboardNodes(nodes, { x: dx, y: dy });
}

export function offsetClipboardNodes<T extends ClipboardPositionNode>(
  nodes: T[],
  offset: ClipboardPosition,
): T[] {
  return nodes.map((node) => ({
    ...node,
    position: {
      x: finiteNumber(node.position?.x, 0) + offset.x,
      y: finiteNumber(node.position?.y, 0) + offset.y,
    },
  }));
}

export function getClipboardGroupMemberIds(
  groupNode: ClipboardPositionNode,
  sourceNodes: ClipboardPositionNode[],
): string[] {
  if (!groupNode.id || groupNode.type !== 'groupBox') return [];
  const memberIds = new Set<string>(
    Array.isArray(groupNode.data?.memberIds)
      ? groupNode.data.memberIds.filter((value): value is string => typeof value === 'string' && !!value)
      : [],
  );
  const groupRect = rectForClipboardNode(groupNode);
  sourceNodes.forEach((node) => {
    if (!node.id || node.id === groupNode.id || node.type === 'groupBox' || node.id === 'bulk-phantom') return;
    const rect = rectForClipboardNode(node);
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    if (
      center.x >= groupRect.x &&
      center.x <= groupRect.x + groupRect.width &&
      center.y >= groupRect.y &&
      center.y <= groupRect.y + groupRect.height
    ) {
      memberIds.add(node.id);
    }
  });
  return Array.from(memberIds);
}

export function expandClipboardNodesForGroups<T extends ClipboardPositionNode>(
  selectedNodes: T[],
  allNodes: T[],
): T[] {
  const selectedIds = new Set(selectedNodes.map((node) => node.id).filter((id): id is string => typeof id === 'string' && !!id));
  selectedNodes
    .filter((node) => node.type === 'groupBox')
    .forEach((groupNode) => {
      getClipboardGroupMemberIds(groupNode, allNodes).forEach((memberId) => selectedIds.add(memberId));
    });
  return allNodes.filter((node) => node.id && selectedIds.has(node.id));
}

export function remapPastedGroupMemberIds<T extends ClipboardPositionNode>(
  pastedNodes: T[],
  idMap: Map<string, string>,
): T[] {
  return pastedNodes.map((node) => {
    if (node.type !== 'groupBox') return node;
    const memberIds = Array.isArray(node.data?.memberIds)
      ? node.data.memberIds
          .map((value) => (typeof value === 'string' ? idMap.get(value) : undefined))
          .filter((value): value is string => typeof value === 'string' && !!value)
      : [];
    return {
      ...node,
      data: {
        ...(node.data || {}),
        memberIds,
      },
    };
  });
}

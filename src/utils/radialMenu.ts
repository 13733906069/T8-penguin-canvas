import type { NodeMeta, NodeType } from '../types/canvas';

export const RADIAL_MENU_SLOT_COUNT = 8;
export const RADIAL_MENU_DEFAULT_LONG_PRESS_MS = 320;
export const RADIAL_MENU_MOVE_TOLERANCE = 8;
export const RADIAL_MENU_CANCEL_RADIUS = 44;
export const RADIAL_MENU_RADIUS = 118;
export const RADIAL_MENU_DIAMETER = 292;

export const RADIAL_NODE_COLOR_HEX: Record<string, string> = {
  sky: '#7dd3fc',
  amber: '#fcd34d',
  rose: '#fda4af',
  fuchsia: '#f0abfc',
  violet: '#c4b5fd',
  emerald: '#6ee7b7',
  cyan: '#67e8f9',
  indigo: '#a5b4fc',
  orange: '#fdba74',
  pink: '#f9a8d4',
  slate: '#cbd5e1',
  teal: '#5eead4',
  blue: '#93c5fd',
};

export const DEFAULT_RADIAL_MENU_NODE_TYPES: NodeType[] = [
  'text',
  'upload',
  'material-set',
  'output',
  'image',
  'video',
  'seedance',
  'llm',
];

export interface RadialMenuPoint {
  x: number;
  y: number;
}

export interface RadialMenuSlot {
  id: string;
  nodeType: NodeType;
  enabled: boolean;
  order: number;
}

export type RadialMenuNodeOption = Pick<NodeMeta, 'type' | 'label' | 'icon' | 'color' | 'hidden' | 'category'>;

export function createDefaultRadialMenuSlots(): RadialMenuSlot[] {
  return DEFAULT_RADIAL_MENU_NODE_TYPES.map((nodeType, index) => ({
    id: `slot-${index + 1}`,
    nodeType,
    enabled: true,
    order: index,
  }));
}

export function visibleRadialMenuNodeOptions(nodes: RadialMenuNodeOption[]): RadialMenuNodeOption[] {
  return nodes.filter((node) => !node.hidden);
}

export function normalizeRadialMenuSlots(
  nodes: RadialMenuNodeOption[],
  persisted?: Partial<RadialMenuSlot>[] | null,
): RadialMenuSlot[] {
  const visibleTypes = new Set(visibleRadialMenuNodeOptions(nodes).map((node) => node.type));
  const fallback = createDefaultRadialMenuSlots();
  const incoming = Array.isArray(persisted) ? [...persisted] : [];
  incoming.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  return Array.from({ length: RADIAL_MENU_SLOT_COUNT }, (_, index) => {
    const raw = incoming[index];
    const fallbackSlot = fallback[index];
    const nodeType = raw?.nodeType && visibleTypes.has(raw.nodeType)
      ? raw.nodeType
      : fallbackSlot.nodeType;
    return {
      id: raw?.id || fallbackSlot.id,
      nodeType,
      enabled: raw?.enabled !== false,
      order: index,
    };
  });
}

export function orderedRadialMenuSlots(slots: RadialMenuSlot[]): RadialMenuSlot[] {
  return [...slots]
    .sort((a, b) => a.order - b.order)
    .slice(0, RADIAL_MENU_SLOT_COUNT)
    .map((slot, index) => ({ ...slot, order: index, id: slot.id || `slot-${index + 1}` }));
}

export function distanceBetween(a: RadialMenuPoint, b: RadialMenuPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function radialSlotAngle(index: number, total = RADIAL_MENU_SLOT_COUNT): number {
  return (index / total) * Math.PI * 2 - Math.PI / 2;
}

export function radialSlotPosition(
  center: RadialMenuPoint,
  index: number,
  radius = RADIAL_MENU_RADIUS,
  total = RADIAL_MENU_SLOT_COUNT,
): RadialMenuPoint {
  const angle = radialSlotAngle(index, total);
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

export function radialSlotIndexFromPointer(
  center: RadialMenuPoint,
  pointer: RadialMenuPoint,
  total = RADIAL_MENU_SLOT_COUNT,
  cancelRadius = RADIAL_MENU_CANCEL_RADIUS,
): number | null {
  const dx = pointer.x - center.x;
  const dy = pointer.y - center.y;
  if (Math.hypot(dx, dy) < cancelRadius) return null;
  const sector = (Math.PI * 2) / total;
  const angle = Math.atan2(dy, dx);
  const raw = Math.round((angle + Math.PI / 2) / sector);
  return ((raw % total) + total) % total;
}

export function clampRadialMenuCenter(
  point: RadialMenuPoint,
  viewport: { width: number; height: number },
  diameter = RADIAL_MENU_DIAMETER,
  margin = 14,
): RadialMenuPoint {
  const half = diameter / 2;
  const minX = half + margin;
  const minY = half + margin;
  const maxX = Math.max(minX, viewport.width - half - margin);
  const maxY = Math.max(minY, viewport.height - half - margin);
  return {
    x: Math.min(Math.max(point.x, minX), maxX),
    y: Math.min(Math.max(point.y, minY), maxY),
  };
}

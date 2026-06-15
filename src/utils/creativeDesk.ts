import type { CreativeDeskFrameId, CreativeDeskItem, CreativeDeskState } from '../types/canvas';
import type { ResourceItem } from '../services/api';

export const DEFAULT_CREATIVE_DESK_OPACITY = 0.42;
export const MAX_CREATIVE_DESK_ITEMS = 48;

export interface CreativeDeskFrameOption {
  id: CreativeDeskFrameId;
  label: string;
}

export const CREATIVE_DESK_FRAMES: CreativeDeskFrameOption[] = [
  { id: 'poster-card', label: '海报卡' },
  { id: 'glass-card', label: '玻璃卡' },
  { id: 'sticker', label: '贴纸边' },
  { id: 'polaroid', label: '拍立得' },
  { id: 'comic-panel', label: '漫画框' },
  { id: 'none', label: '无边框' },
];

export interface CreativeDeskPoint {
  x: number;
  y: number;
}

export interface CreativeDeskImageInput {
  id?: string;
  url: string;
  title?: string;
  resourceId?: string;
  width?: number;
  height?: number;
  opacity?: number;
  frameId?: CreativeDeskFrameId | string;
}

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanText(value: unknown, maxLength = 160) {
  if (value == null) return undefined;
  const text = String(value).replace(/\0/g, '').trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function cleanUrl(value: unknown) {
  const url = cleanText(value, 2048) || '';
  if (/^data:/i.test(url)) return '';
  return url;
}

export function createDefaultCreativeDeskState(): CreativeDeskState {
  return {
    version: 1,
    defaultOpacity: DEFAULT_CREATIVE_DESK_OPACITY,
    items: [],
  };
}

export function sanitizeCreativeDeskState(value: unknown): CreativeDeskState {
  const input = value && typeof value === 'object' ? value as Partial<CreativeDeskState> : {};
  const items = Array.isArray(input.items) ? input.items : [];
  return {
    version: 1,
    defaultOpacity: clamp(input.defaultOpacity, DEFAULT_CREATIVE_DESK_OPACITY, 0, 1),
    items: items.slice(0, MAX_CREATIVE_DESK_ITEMS)
      .map((item, index) => sanitizeCreativeDeskItem(item, index))
      .filter((item): item is CreativeDeskItem => Boolean(item)),
  };
}

export function sanitizeCreativeDeskItem(value: unknown, index = 0): CreativeDeskItem | null {
  const input = value && typeof value === 'object' ? value as Partial<CreativeDeskItem> : {};
  const url = cleanUrl(input.url);
  if (!url) return null;
  return {
    id: cleanText(input.id, 80) || `desk-image-${Date.now()}-${index}`,
    kind: 'image',
    url,
    title: cleanText(input.title, 120),
    resourceId: cleanText(input.resourceId, 120),
    x: clamp(input.x, 0, -200000, 200000),
    y: clamp(input.y, 0, -200000, 200000),
    width: clamp(input.width, 320, 24, 8000),
    height: clamp(input.height, 220, 24, 8000),
    scale: clamp(input.scale, 1, 0.05, 12),
    rotation: clamp(input.rotation, 0, -720, 720),
    opacity: clamp(input.opacity, DEFAULT_CREATIVE_DESK_OPACITY, 0, 1),
    frameId: cleanText(input.frameId, 40) || 'poster-card',
    zIndex: Math.round(clamp(input.zIndex, index + 1, 0, 9999)),
    locked: input.locked === true,
    visible: input.visible !== false,
    createdAt: Math.round(clamp(input.createdAt, Date.now(), 1, 9999999999999)),
  };
}

export function getNextCreativeDeskZIndex(items: CreativeDeskItem[]) {
  return items.reduce((max, item) => Math.max(max, Number(item.zIndex) || 0), 0) + 1;
}

export function appendCreativeDeskItem(state: CreativeDeskState, item: CreativeDeskItem): CreativeDeskState {
  const items = [...state.items, item].slice(-MAX_CREATIVE_DESK_ITEMS);
  return { ...state, items };
}

export function replaceCreativeDeskItem(
  state: CreativeDeskState,
  itemId: string,
  patch: Partial<CreativeDeskItem> | ((item: CreativeDeskItem) => CreativeDeskItem),
): CreativeDeskState {
  return {
    ...state,
    items: state.items.map((item) => {
      if (item.id !== itemId) return item;
      const next = typeof patch === 'function' ? patch(item) : { ...item, ...patch };
      return sanitizeCreativeDeskItem(next) || item;
    }),
  };
}

export function removeCreativeDeskItem(state: CreativeDeskState, itemId: string): CreativeDeskState {
  return { ...state, items: state.items.filter((item) => item.id !== itemId) };
}

export function duplicateCreativeDeskItem(state: CreativeDeskState, itemId: string): CreativeDeskState {
  const source = state.items.find((item) => item.id === itemId);
  if (!source) return state;
  const copy: CreativeDeskItem = {
    ...source,
    id: `desk-image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: source.title ? `${source.title} copy` : source.title,
    x: source.x + 32,
    y: source.y + 32,
    zIndex: getNextCreativeDeskZIndex(state.items),
    locked: false,
    createdAt: Date.now(),
  };
  return appendCreativeDeskItem(state, copy);
}

export function createCreativeDeskImageItem(
  input: CreativeDeskImageInput,
  center: CreativeDeskPoint = { x: 0, y: 0 },
  existingItems: CreativeDeskItem[] = [],
): CreativeDeskItem {
  const width = clamp(input.width, 360, 48, 1600);
  const height = clamp(input.height, 240, 48, 1600);
  return sanitizeCreativeDeskItem({
    id: input.id || `desk-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'image',
    url: input.url,
    title: input.title,
    resourceId: input.resourceId,
    x: center.x,
    y: center.y,
    width,
    height,
    scale: 1,
    rotation: 0,
    opacity: input.opacity ?? DEFAULT_CREATIVE_DESK_OPACITY,
    frameId: input.frameId || 'poster-card',
    zIndex: getNextCreativeDeskZIndex(existingItems),
    locked: false,
    visible: true,
    createdAt: Date.now(),
  }) as CreativeDeskItem;
}

export function resourceItemToCreativeDeskItem(
  item: ResourceItem,
  center: CreativeDeskPoint,
  existingItems: CreativeDeskItem[] = [],
): CreativeDeskItem | null {
  if (item.kind !== 'image' && item.kind !== 'panorama') return null;
  const url = item.fileUrl || item.thumbUrl;
  if (!url) return null;
  return createCreativeDeskImageItem({
    url,
    title: item.title || item.originalName,
    resourceId: item.id,
    opacity: DEFAULT_CREATIVE_DESK_OPACITY,
    frameId: item.kind === 'panorama' ? 'glass-card' : 'poster-card',
  }, center, existingItems);
}

import type { CreativeDeskFrameColorId, CreativeDeskFrameId, CreativeDeskItem, CreativeDeskState } from '../types/canvas';
import type { ResourceItem } from '../services/api';

export const DEFAULT_CREATIVE_DESK_OPACITY = 0.42;
export const MAX_CREATIVE_DESK_ITEMS = 48;
const DEFAULT_CREATIVE_DESK_LONG_SIDE = 420;
const MIN_CREATIVE_DESK_LONG_SIDE = 260;

export interface CreativeDeskFrameOption {
  id: CreativeDeskFrameId;
  label: string;
}

export interface CreativeDeskFrameColorOption {
  id: CreativeDeskFrameColorId;
  label: string;
  color: string;
  background: string;
  shadow: string;
}

export const CREATIVE_DESK_FRAMES: CreativeDeskFrameOption[] = [
  { id: 'poster-card', label: '海报卡' },
  { id: 'glass-card', label: '玻璃卡' },
  { id: 'sticker', label: '贴纸边' },
  { id: 'polaroid', label: '拍立得' },
  { id: 'comic-panel', label: '漫画框' },
  { id: 'matte-gallery', label: '美术馆卡纸' },
  { id: 'torn-paper', label: '手撕纸' },
  { id: 'kraft-tape', label: '牛皮纸胶带' },
  { id: 'washi-corners', label: '和纸角贴' },
  { id: 'scrapbook-tabs', label: '手帐分页' },
  { id: 'linen-mat', label: '亚麻卡纸' },
  { id: 'walnut-frame', label: '胡桃木框' },
  { id: 'brass-gallery', label: '黄铜画廊' },
  { id: 'silver-bevel', label: '银色斜边' },
  { id: 'black-archive', label: '黑胶档案' },
  { id: 'neon-tube', label: '霓虹灯管' },
  { id: 'holographic', label: '镭射虹膜' },
  { id: 'film-strip', label: '胶片齿孔' },
  { id: 'slide-mount', label: '幻灯片框' },
  { id: 'contact-sheet', label: '接触印相' },
  { id: 'blueprint', label: '蓝图边框' },
  { id: 'manga-speed', label: '漫画速度线' },
  { id: 'ink-brush', label: '墨刷边' },
  { id: 'dotted-stitch', label: '点线缝边' },
  { id: 'sewing-thread', label: '车线手作' },
  { id: 'lace-paper', label: '蕾丝纸雕' },
  { id: 'ticket-stub', label: '票根边框' },
  { id: 'stamp-postage', label: '邮票齿孔' },
  { id: 'label-maker', label: '标签机条' },
  { id: 'memo-pin', label: '图钉便签' },
  { id: 'cork-board', label: '软木板' },
  { id: 'magnetic-board', label: '磁吸白板' },
  { id: 'acrylic-block', label: '亚克力块' },
  { id: 'frosted-panel', label: '磨砂面板' },
  { id: 'shadow-float', label: '悬浮阴影' },
  { id: 'soft-vignette', label: '柔焦暗角' },
  { id: 'double-line', label: '双线细框' },
  { id: 'triple-rule', label: '三重规线' },
  { id: 'corner-brackets', label: '角标框' },
  { id: 'ruler-grid', label: '尺规网格' },
  { id: 'studio-slate', label: '场记板' },
  { id: 'photo-booth', label: '大头贴格' },
  { id: 'album-sleeve', label: '唱片内页' },
  { id: 'arcade-marquee', label: '街机灯牌' },
  { id: 'safety-stripe', label: '警戒斜纹' },
  { id: 'cosmic-rim', label: '星云光环' },
  { id: 'aurora-glow', label: '极光流边' },
  { id: 'sakura-washi', label: '樱花和纸' },
  { id: 'ocean-glass', label: '海玻璃' },
  { id: 'sunset-ticket', label: '日落票卡' },
  { id: 'none', label: '无边框' },
];

export const CREATIVE_DESK_FRAME_COLORS: CreativeDeskFrameColorOption[] = [
  { id: 'cream', label: '奶油', color: '#fff1cf', background: 'rgba(255, 241, 207, 0.34)', shadow: 'rgba(120, 73, 23, 0.25)' },
  { id: 'white', label: '白色', color: '#ffffff', background: 'rgba(255, 255, 255, 0.28)', shadow: 'rgba(15, 23, 42, 0.24)' },
  { id: 'black', label: '黑色', color: '#111827', background: 'rgba(17, 24, 39, 0.22)', shadow: 'rgba(0, 0, 0, 0.38)' },
  { id: 'rose', label: '玫瑰', color: '#fb7185', background: 'rgba(251, 113, 133, 0.24)', shadow: 'rgba(159, 18, 57, 0.26)' },
  { id: 'amber', label: '琥珀', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.24)', shadow: 'rgba(146, 64, 14, 0.26)' },
  { id: 'mint', label: '薄荷', color: '#86efac', background: 'rgba(134, 239, 172, 0.23)', shadow: 'rgba(22, 101, 52, 0.25)' },
  { id: 'cyan', label: '青蓝', color: '#67e8f9', background: 'rgba(103, 232, 249, 0.22)', shadow: 'rgba(14, 116, 144, 0.26)' },
  { id: 'violet', label: '紫罗兰', color: '#c4b5fd', background: 'rgba(196, 181, 253, 0.24)', shadow: 'rgba(91, 33, 182, 0.26)' },
];

export function getCreativeDeskFrameColor(id?: string | null): CreativeDeskFrameColorOption {
  return CREATIVE_DESK_FRAME_COLORS.find((item) => item.id === id) || CREATIVE_DESK_FRAME_COLORS[0];
}

export interface CreativeDeskPoint {
  x: number;
  y: number;
}

export interface CreativeDeskViewport {
  x?: number;
  y?: number;
  zoom?: number;
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
  frameColorId?: CreativeDeskFrameColorId | string;
}

export interface CreativeDeskBackup {
  schema: 't8-creative-desk-background';
  version: 1;
  exportedAt: string;
  creativeDesk: CreativeDeskState;
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

export function normalizeCreativeDeskImageSize(
  width: unknown,
  height: unknown,
  fallback = { width: 360, height: 240 },
) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    return {
      width: clamp(fallback.width, 360, 48, 1600),
      height: clamp(fallback.height, 240, 48, 1600),
    };
  }
  const sourceLong = Math.max(sourceWidth, sourceHeight);
  const targetLong = clamp(sourceLong, DEFAULT_CREATIVE_DESK_LONG_SIDE, MIN_CREATIVE_DESK_LONG_SIDE, DEFAULT_CREATIVE_DESK_LONG_SIDE);
  const scale = targetLong / sourceLong;
  return {
    width: Math.round(clamp(sourceWidth * scale, 360, 48, 1600)),
    height: Math.round(clamp(sourceHeight * scale, 240, 48, 1600)),
  };
}

export function createDefaultCreativeDeskState(): CreativeDeskState {
  return {
    version: 1,
    coordinateMode: 'viewport',
    defaultOpacity: DEFAULT_CREATIVE_DESK_OPACITY,
    items: [],
  };
}

export function sanitizeCreativeDeskState(value: unknown): CreativeDeskState {
  const input = value && typeof value === 'object' ? value as Partial<CreativeDeskState> : {};
  const items = Array.isArray(input.items) ? input.items : [];
  const coordinateMode = input.coordinateMode === 'viewport' || input.coordinateMode === 'flow'
    ? input.coordinateMode
    : undefined;
  return {
    version: 1,
    ...(coordinateMode ? { coordinateMode } : {}),
    defaultOpacity: clamp(input.defaultOpacity, DEFAULT_CREATIVE_DESK_OPACITY, 0, 1),
    items: items.slice(0, MAX_CREATIVE_DESK_ITEMS)
      .map((item, index) => sanitizeCreativeDeskItem(item, index))
      .filter((item): item is CreativeDeskItem => Boolean(item)),
  };
}

export function exportCreativeDeskBackup(value: unknown): CreativeDeskBackup {
  const creativeDesk = sanitizeCreativeDeskState(value);
  return {
    schema: 't8-creative-desk-background',
    version: 1,
    exportedAt: new Date().toISOString(),
    creativeDesk: {
      ...creativeDesk,
      coordinateMode: 'viewport',
    },
  };
}

export function parseCreativeDeskBackup(value: unknown): CreativeDeskState {
  const payload = typeof value === 'string' ? JSON.parse(value) : value;
  if (!payload || typeof payload !== 'object') {
    throw new Error('不是创作台背景备份');
  }
  const input = payload as { schema?: unknown; creativeDesk?: unknown };
  if (input.schema !== 't8-creative-desk-background') {
    throw new Error('不是创作台背景备份');
  }
  return {
    ...sanitizeCreativeDeskState(input.creativeDesk),
    coordinateMode: 'viewport',
  };
}

export function migrateCreativeDeskToViewportCoordinates(
  value: unknown,
  viewport?: CreativeDeskViewport,
): CreativeDeskState {
  const state = sanitizeCreativeDeskState(value);
  if (state.coordinateMode === 'viewport') return state;
  const source = value && typeof value === 'object' ? value as Partial<CreativeDeskState> : {};
  const sourceHadMode = source.coordinateMode === 'viewport' || source.coordinateMode === 'flow';
  if (sourceHadMode && state.coordinateMode !== 'flow') return { ...state, coordinateMode: 'viewport' };

  const zoom = clamp(viewport?.zoom, 1, 0.05, 12);
  const offsetX = clamp(viewport?.x, 0, -200000, 200000);
  const offsetY = clamp(viewport?.y, 0, -200000, 200000);
  return {
    ...state,
    coordinateMode: 'viewport',
    items: state.items.map((item) => sanitizeCreativeDeskItem({
      ...item,
      x: item.x * zoom + offsetX,
      y: item.y * zoom + offsetY,
      scale: item.scale * zoom,
    }) || item),
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
    frameColorId: cleanText(input.frameColorId, 40) || 'cream',
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
  const size = normalizeCreativeDeskImageSize(input.width, input.height);
  return sanitizeCreativeDeskItem({
    id: input.id || `desk-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'image',
    url: input.url,
    title: input.title,
    resourceId: input.resourceId,
    x: center.x,
    y: center.y,
    width: size.width,
    height: size.height,
    scale: 1,
    rotation: 0,
    opacity: input.opacity ?? DEFAULT_CREATIVE_DESK_OPACITY,
    frameId: input.frameId || 'poster-card',
    frameColorId: input.frameColorId || 'cream',
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
    width: (item as ResourceItem & { width?: number }).width,
    height: (item as ResourceItem & { height?: number }).height,
    opacity: DEFAULT_CREATIVE_DESK_OPACITY,
    frameId: item.kind === 'panorama' ? 'glass-card' : 'poster-card',
    frameColorId: 'cream',
  }, center, existingItems);
}

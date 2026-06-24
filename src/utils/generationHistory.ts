import type { Node } from '@xyflow/react';
import {
  fileNameFromUrl,
  getMediaItemsFromData,
  type MediaItem,
  type MediaKind,
} from './mediaCollection.ts';

export type GenerationHistoryKind = MediaKind | 'text';
export type GenerationHistoryTab = GenerationHistoryKind | 'all';

export interface GenerationHistoryItem {
  id: string;
  kind: GenerationHistoryKind;
  nodeId: string;
  nodeType: string;
  sourceLabel: string;
  title: string;
  subtitle: string;
  createdAt: number;
  order: number;
  url?: string;
  fileName?: string;
  textPreview?: string;
}

export interface GenerationHistoryCounts extends Record<GenerationHistoryTab, number> {}

export interface CollectGenerationHistoryOptions {
  totalLimit?: number;
  perKindLimit?: number;
  textPreviewChars?: number;
}

export const GENERATION_HISTORY_LIMITS = {
  total: 360,
  perKind: 120,
  textPreviewChars: 280,
  visiblePageSize: 48,
};

export const GENERATION_HISTORY_KIND_ORDER = ['image', 'video', 'audio', 'text', 'model3d'] as const;
export const GENERATION_HISTORY_TABS = ['all', ...GENERATION_HISTORY_KIND_ORDER] as const;

export const GENERATION_HISTORY_KIND_LABELS: Record<GenerationHistoryTab, string> = {
  all: '全部',
  image: '图像',
  video: '视频',
  audio: '音频',
  text: '文本',
  model3d: '3D',
};

const MEDIA_KINDS: MediaKind[] = ['image', 'video', 'audio', 'model3d'];
const TEXT_ARRAY_FIELDS = ['directTextSegments', 'textSegments', 'segments', 'texts'];
const TEXT_SINGLE_FIELDS = ['directOutputText', 'outputText', 'resultText', 'reply', 'responseText'];
const TIME_FIELDS = ['completedAt', 'finishedAt', 'updatedAt', 'createdAt', 'generatedAt', 'lastRunAt', 'timestamp'];
const HISTORY_DATA_FIELDS = [
  'imageUrl',
  'imageUrls',
  'directImageUrl',
  'directImageUrls',
  'urls',
  'generatedImages',
  'videoUrl',
  'videoUrls',
  'directVideoUrl',
  'directVideoUrls',
  'audioUrl',
  'audioUrls',
  'directAudioUrl',
  'directAudioUrls',
  'modelUrl',
  'modelUrls',
  'directModelUrl',
  'directModelUrls',
  'fileName',
  'fileNames',
  'title',
  'label',
  'name',
  ...TEXT_SINGLE_FIELDS,
  ...TEXT_ARRAY_FIELDS,
  ...TIME_FIELDS,
] as const;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    : '';
}

function keyPart(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(keyPart).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value ?? '');
}

export function buildGenerationHistoryDataKey(nodes: Node[]): string {
  return nodes
    .filter((node) => node && node.type !== 'groupBox')
    .map((node) => {
      const data = (node.data || {}) as any;
      const parts = [node.id, String(node.type || '')];
      for (const field of HISTORY_DATA_FIELDS) {
        const value = data[field];
        if (value !== undefined && value !== null && value !== '') {
          parts.push(`${field}=${keyPart(value)}`);
        }
      }
      return parts.join('\u001f');
    })
    .join('\u001e');
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit)).trimEnd()}...`;
}

function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function historyTimestamp(data: any, nodeIndex: number): number {
  for (const field of TIME_FIELDS) {
    const value = toTimestamp(data?.[field]);
    if (value !== null) return value;
  }
  return nodeIndex;
}

function nodeSourceLabel(node: Node): string {
  const data = (node.data || {}) as any;
  const value = data.title || data.label || data.name || data.nodeLabel;
  if (typeof value === 'string' && value.trim()) return value.trim();
  const type = typeof node.type === 'string' && node.type ? node.type : 'node';
  return type === 'output' ? '输出素材' : type;
}

function mediaTitle(kind: MediaKind, item: MediaItem, localIndex: number): string {
  if (item.name && item.name.trim()) return item.name.trim();
  const fileName = fileNameFromUrl(item.url);
  if (fileName && fileName !== item.url) return fileName;
  return `${GENERATION_HISTORY_KIND_LABELS[kind]} ${localIndex + 1}`;
}

function addImageLegacyItems(data: any): MediaItem[] {
  const urls = [
    ...(Array.isArray(data?.urls) ? data.urls : []),
    ...(Array.isArray(data?.generatedImages) ? data.generatedImages : []),
  ];
  return urls
    .filter((url) => typeof url === 'string' && url.trim())
    .map((url) => ({
      kind: 'image' as const,
      url: url.trim(),
      name: fileNameFromUrl(url.trim()),
    }));
}

function collectTextValues(node: Node, hasMedia: boolean): string[] {
  const data = (node.data || {}) as any;
  const values: string[] = [];
  const seen = new Set<string>();
  const outputLike =
    node.type === 'output' ||
    node.type === 'text' ||
    hasMedia ||
    data.status === 'success' ||
    data.generated === true ||
    data.autoOutput === true;

  const push = (value: unknown) => {
    const text = cleanText(value);
    if (!text || seen.has(text)) return;
    seen.add(text);
    values.push(text);
  };

  if (outputLike) {
    for (const field of TEXT_SINGLE_FIELDS) push(data[field]);
    for (const field of TEXT_ARRAY_FIELDS) {
      if (Array.isArray(data[field])) data[field].forEach(push);
    }
  }

  if (node.type === 'text') {
    push(data.text);
    push(data.prompt);
  }

  return values;
}

function createMediaHistoryItem(
  node: Node,
  kind: MediaKind,
  item: MediaItem,
  nodeIndex: number,
  localIndex: number,
): GenerationHistoryItem {
  const sourceLabel = nodeSourceLabel(node);
  const title = mediaTitle(kind, item, localIndex);
  const createdAt = historyTimestamp(node.data, nodeIndex);
  return {
    id: `${node.id}:${kind}:${stableHash(item.url)}:${localIndex}`,
    kind,
    nodeId: node.id,
    nodeType: String(node.type || ''),
    sourceLabel,
    title,
    subtitle: sourceLabel,
    url: item.url,
    fileName: title,
    createdAt,
    order: nodeIndex * 1000 + localIndex,
  };
}

function createTextHistoryItem(
  node: Node,
  value: string,
  nodeIndex: number,
  localIndex: number,
  textPreviewChars: number,
): GenerationHistoryItem {
  const sourceLabel = nodeSourceLabel(node);
  const createdAt = historyTimestamp(node.data, nodeIndex);
  return {
    id: `${node.id}:text:${stableHash(value)}:${localIndex}`,
    kind: 'text',
    nodeId: node.id,
    nodeType: String(node.type || ''),
    sourceLabel,
    title: sourceLabel === '输出素材' ? '文本输出' : sourceLabel,
    subtitle: `来自 ${sourceLabel}`,
    textPreview: truncateText(value, textPreviewChars),
    createdAt,
    order: nodeIndex * 1000 + 500 + localIndex,
  };
}

export function collectGenerationHistory(
  nodes: Node[],
  options: CollectGenerationHistoryOptions = {},
): GenerationHistoryItem[] {
  const totalLimit = Math.max(1, options.totalLimit ?? GENERATION_HISTORY_LIMITS.total);
  const perKindLimit = Math.max(1, options.perKindLimit ?? GENERATION_HISTORY_LIMITS.perKind);
  const textPreviewChars = Math.max(32, options.textPreviewChars ?? GENERATION_HISTORY_LIMITS.textPreviewChars);
  const candidates: GenerationHistoryItem[] = [];
  const seenMedia = new Set<string>();

  nodes.forEach((node, nodeIndex) => {
    if (!node || node.type === 'groupBox') return;
    const data = node.data || {};
    let hasMedia = false;

    for (const kind of MEDIA_KINDS) {
      const mediaItems = [
        ...getMediaItemsFromData(data, kind),
        ...(kind === 'image' ? addImageLegacyItems(data) : []),
      ];
      mediaItems.forEach((item, localIndex) => {
        const url = typeof item.url === 'string' ? item.url.trim() : '';
        if (!url) return;
        hasMedia = true;
        const mediaKey = `${kind}:${url}`;
        if (seenMedia.has(mediaKey)) return;
        seenMedia.add(mediaKey);
        candidates.push(createMediaHistoryItem(node, kind, { ...item, url }, nodeIndex, localIndex));
      });
    }

    collectTextValues(node, hasMedia).forEach((text, localIndex) => {
      candidates.push(createTextHistoryItem(node, text, nodeIndex, localIndex, textPreviewChars));
    });
  });

  const counts: Record<GenerationHistoryKind, number> = {
    image: 0,
    video: 0,
    audio: 0,
    text: 0,
    model3d: 0,
  };
  const sorted = candidates.sort((a, b) => (b.createdAt - a.createdAt) || (b.order - a.order));
  const result: GenerationHistoryItem[] = [];

  for (const item of sorted) {
    if (counts[item.kind] >= perKindLimit) continue;
    counts[item.kind] += 1;
    result.push(item);
    if (result.length >= totalLimit) break;
  }

  return result;
}

export function countGenerationHistoryByKind(items: GenerationHistoryItem[]): GenerationHistoryCounts {
  const counts: GenerationHistoryCounts = {
    all: items.length,
    image: 0,
    video: 0,
    audio: 0,
    text: 0,
    model3d: 0,
  };
  for (const item of items) {
    counts[item.kind] += 1;
  }
  return counts;
}

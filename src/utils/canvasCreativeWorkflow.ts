import type { Node } from '@xyflow/react';
import { createOutputDataFromItems, getMediaItemsFromData, type MediaItem, type MediaKind } from './mediaCollection.ts';

export const CREATIVE_TARGET_NODE_TYPE = 'generation-target' as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CREATIVE_NODE_DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  text: { w: 280, h: 180 },
  output: { w: 320, h: 360 },
  image: { w: 320, h: 360 },
  upload: { w: 260, h: 360 },
  'material-set': { w: 320, h: 300 },
  [CREATIVE_TARGET_NODE_TYPE]: { w: 360, h: 260 },
};

function defaultSizeOf(type: string): { w: number; h: number } {
  return CREATIVE_NODE_DEFAULT_SIZE[type] || { w: 320, h: 240 };
}

function rectOf(node: Node): Rect {
  const size = defaultSizeOf(String(node.type || 'node'));
  return {
    x: node.position?.x || 0,
    y: node.position?.y || 0,
    w: (node as any).measured?.width || (node as any).width || size.w,
    h: (node as any).measured?.height || (node as any).height || size.h,
  };
}

export interface CanvasSelectionMediaItem extends MediaItem {
  nodeId: string;
}

export interface CanvasSelectionTextItem {
  nodeId: string;
  text: string;
}

export interface CanvasSelectionSummary {
  canvasId?: string;
  selectedNodeIds: string[];
  nodeTypes: string[];
  texts: CanvasSelectionTextItem[];
  images: CanvasSelectionMediaItem[];
  videos: CanvasSelectionMediaItem[];
  audios: CanvasSelectionMediaItem[];
  models: CanvasSelectionMediaItem[];
  bounds: Rect | null;
  defaultResultPosition: { x: number; y: number };
  viewportAnchor?: { x: number; y: number };
}

export interface CreativeTargetResultOptions {
  mode: 'replace' | 'keep-version';
  sourceNodeIds?: string[];
  now?: number | string;
  prompt?: string;
}

export interface CreativeTargetResult {
  targetPatch: Record<string, any>;
  outputNode: Node | null;
}

export interface AnnotationEditRequestInput {
  sourceNodeId?: string;
  sourceImageUrl: string;
  annotatedImageUrl: string;
  instruction?: string;
  annotationTextCount?: number;
  annotationShapeCount?: number;
  providerId?: string;
  providerModel?: string;
}

export interface AnnotationEditRequest {
  prompt: string;
  images: string[];
  metadata: {
    sourceNodeId?: string;
    sourceImageUrl: string;
    annotatedImageUrl: string;
    annotationTextCount: number;
    annotationShapeCount: number;
    providerId?: string;
    providerModel?: string;
    instruction: string;
  };
}

export interface AnnotationEditResultPlacementInput {
  sourceNode: Node;
  resultUrls: string[];
  request: AnnotationEditRequest;
  targetNode?: Node | null;
  targetMode?: CreativeTargetResultOptions['mode'];
  now?: number | string;
}

export interface AnnotationEditResultPlacement {
  targetPatch: Record<string, any> | null;
  outputNode: Node | null;
}

type CanvasPackageHistoryKind = MediaKind | 'text';

export interface CanvasPackageResourceLibrarySnapshot {
  categories: Record<string, any>[];
  items: Record<string, any>[];
}

export interface CanvasPackageThumbnailRef {
  id: string;
  url: string;
  sourceUrl?: string;
  sourceNodeId?: string;
  kind?: string;
  available?: boolean;
}

export interface CanvasPackageHistorySummary {
  total: number;
  byKind: Record<CanvasPackageHistoryKind, number>;
  items: Record<string, any>[];
  truncated: boolean;
}

export interface CanvasResourcePackageManifest {
  schema: 't8-canvas-resource-package';
  version: 1;
  canvasId: string;
  title: string;
  exportedAt: string;
  portable: boolean;
  canvas: any;
  resources: CanvasPackageResource[];
  missingFiles: CanvasPackageResource[];
  filesToCopy: CanvasPackageResource[];
  resourceLibrary: CanvasPackageResourceLibrarySnapshot;
  thumbnailRefs: CanvasPackageThumbnailRef[];
  generationHistorySummary: CanvasPackageHistorySummary;
  summary: {
    nodeCount: number;
    edgeCount: number;
    resourceCount: number;
    missingCount: number;
    resourceLibraryItemCount: number;
    thumbnailCount: number;
    generationHistoryCount: number;
  };
}

export interface CanvasPackageResource {
  id: string;
  kind: MediaKind;
  url: string;
  name: string;
  sourceNodeId: string;
  available: boolean;
  resourceId?: string;
}

export interface CanvasResourcePackageImportPlan {
  canvas: any;
  resources: CanvasPackageResource[];
  missingFiles: CanvasPackageResource[];
  filesToCopy: CanvasPackageResource[];
  resourceLibrary: CanvasPackageResourceLibrarySnapshot;
  thumbnailRefs: CanvasPackageThumbnailRef[];
  generationHistorySummary: CanvasPackageHistorySummary;
  summary: CanvasResourcePackageManifest['summary'];
}

function cleanText(value: unknown, maxLen = 2000): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function pushText(out: CanvasSelectionTextItem[], seen: Set<string>, nodeId: string, value: unknown) {
  const text = cleanText(value);
  if (!text || seen.has(text)) return;
  seen.add(text);
  out.push({ nodeId, text });
}

function collectTextsFromData(node: Node, out: CanvasSelectionTextItem[], seen: Set<string>) {
  const data = (node.data || {}) as Record<string, any>;
  for (const key of [
    'text',
    'prompt',
    'directOutputText',
    'outputText',
    'resultText',
    'reply',
    'webImageReversePrompt',
  ]) {
    pushText(out, seen, node.id, data[key]);
  }
  for (const key of ['textSegments', 'directTextSegments']) {
    const value = data[key];
    if (!Array.isArray(value)) continue;
    value.forEach((item) => pushText(out, seen, node.id, item));
  }
}

function pushMedia(
  out: CanvasSelectionMediaItem[],
  seen: Set<string>,
  node: Node,
  kind: MediaKind,
  item: MediaItem,
) {
  const url = cleanText(item.url, 4096);
  if (!url || seen.has(`${kind}:${url}`)) return;
  seen.add(`${kind}:${url}`);
  out.push({ ...item, kind, url, nodeId: node.id });
}

function collectMediaFromData(node: Node, kind: MediaKind, seen: Set<string>): CanvasSelectionMediaItem[] {
  const out: CanvasSelectionMediaItem[] = [];
  for (const item of getMediaItemsFromData(node.data, kind)) {
    pushMedia(out, seen, node, kind, item);
  }
  return out;
}

function boundingBox(rects: Rect[]): Rect | null {
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

export function collectCanvasSelectionSummary(
  nodes: Node[],
  options: { canvasId?: string; viewportAnchor?: { x: number; y: number } } = {},
): CanvasSelectionSummary {
  const selected = nodes.filter((node) => node.selected && node.type !== 'groupBox' && node.type !== 'bulkPhantom');
  const textSeen = new Set<string>();
  const mediaSeen = new Set<string>();
  const texts: CanvasSelectionTextItem[] = [];
  const images: CanvasSelectionMediaItem[] = [];
  const videos: CanvasSelectionMediaItem[] = [];
  const audios: CanvasSelectionMediaItem[] = [];
  const models: CanvasSelectionMediaItem[] = [];
  const rects: Rect[] = [];

  for (const node of selected) {
    collectTextsFromData(node, texts, textSeen);
    images.push(...collectMediaFromData(node, 'image', mediaSeen));
    videos.push(...collectMediaFromData(node, 'video', mediaSeen));
    audios.push(...collectMediaFromData(node, 'audio', mediaSeen));
    models.push(...collectMediaFromData(node, 'model3d', mediaSeen));
    rects.push(rectOf(node));
  }

  const bounds = boundingBox(rects);
  const fallback = options.viewportAnchor || { x: 0, y: 0 };
  const defaultResultPosition = bounds
    ? { x: bounds.x + bounds.w + 80, y: bounds.y }
    : { x: fallback.x, y: fallback.y };

  return {
    canvasId: options.canvasId,
    selectedNodeIds: selected.map((node) => node.id),
    nodeTypes: selected.map((node) => String(node.type || 'node')),
    texts,
    images,
    videos,
    audios,
    models,
    bounds,
    defaultResultPosition,
    viewportAnchor: options.viewportAnchor,
  };
}

function targetSize(targetNode: Node): { w: number; h: number } {
  return {
    w:
      (targetNode as any).measured?.width ||
      (targetNode as any).width ||
      defaultSizeOf(CREATIVE_TARGET_NODE_TYPE).w,
    h:
      (targetNode as any).measured?.height ||
      (targetNode as any).height ||
      defaultSizeOf(CREATIVE_TARGET_NODE_TYPE).h,
  };
}

function normalizeNow(value: number | string | undefined): number | string {
  return value ?? Date.now();
}

function createVersion(url: string, createdAt: number | string, sourceNodeIds: string[], prompt?: string) {
  return {
    url,
    createdAt,
    sourceNodeIds,
    prompt: prompt || undefined,
  };
}

export function buildCreativeTargetResult(
  targetNode: Node,
  urls: string[],
  options: CreativeTargetResultOptions,
): CreativeTargetResult {
  const cleanUrls = urls.map((url) => cleanText(url, 4096)).filter(Boolean);
  if (cleanUrls.length === 0) {
    throw new Error('生成目标框没有可写入的结果 URL');
  }
  const firstUrl = cleanUrls[0];
  const sourceNodeIds = Array.isArray(options.sourceNodeIds) ? options.sourceNodeIds : [];
  const createdAt = normalizeNow(options.now);
  const data = (targetNode.data || {}) as Record<string, any>;
  const previousVersions = Array.isArray(data.resultVersions) ? data.resultVersions : [];
  const nextVersions = [
    createVersion(firstUrl, createdAt, sourceNodeIds, options.prompt || data.prompt),
    ...previousVersions,
  ].slice(0, 24);
  const basePatch = {
    status: 'success',
    error: '',
    lastGeneratedAt: createdAt,
    lastPrompt: options.prompt || data.prompt || '',
    resultUrls: cleanUrls,
    resultVersions: nextVersions,
    creativeSourceNodeIds: sourceNodeIds,
  };

  if (options.mode === 'replace') {
    return {
      targetPatch: {
        ...basePatch,
        resultUrl: firstUrl,
      },
      outputNode: null,
    };
  }

  const size = targetSize(targetNode);
  const position = {
    x: (targetNode.position?.x || 0) + size.w + 80,
    y: targetNode.position?.y || 0,
  };
  const outputNode: Node = {
    id: `output-${targetNode.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'output',
    position,
    selected: true,
    data: {
      ...createOutputDataFromItems(
        'image',
        cleanUrls.map((url) => ({ kind: 'image', url })),
      ),
      prompt: options.prompt || data.prompt || '',
      outputText: options.prompt || data.prompt || '',
      directOutputText: options.prompt || data.prompt || '',
      creativeTargetId: targetNode.id,
      creativeSourceNodeIds: sourceNodeIds,
      creativeTargetMode: 'keep-version',
      completedAt: createdAt,
    },
  };

  return {
    targetPatch: {
      ...basePatch,
      resultUrl: data.resultUrl || '',
    },
    outputNode,
  };
}

export function buildAnnotationEditRequest(input: AnnotationEditRequestInput): AnnotationEditRequest {
  const sourceImageUrl = cleanText(input.sourceImageUrl, 4096);
  const annotatedImageUrl = cleanText(input.annotatedImageUrl, 4096);
  if (!sourceImageUrl || !annotatedImageUrl) {
    throw new Error('标注改图需要原图和标注合成图');
  }
  const instruction = cleanText(input.instruction);
  const annotationTextCount = Math.max(0, Number(input.annotationTextCount || 0));
  const annotationShapeCount = Math.max(0, Number(input.annotationShapeCount || 0));
  if (!instruction && annotationShapeCount > 0 && annotationTextCount === 0) {
    throw new Error('请补充改图说明：只有箭头、圈选或形状时，模型无法可靠判断要改什么。');
  }

  const prompt = [
    '这是一次标注改图任务。',
    '第一张图是干净原图，第二张图是带箭头、框线、标号、文字或形状的标注参考。',
    '请保留原图主体、构图和风格，只根据标注和用户说明做局部修改。',
    instruction ? `用户说明：${instruction}` : '用户说明：请根据标注文字和区域执行修改。',
    '输出必须是干净成图，移除所有箭头、框线、标号和编辑痕迹，不要保留编辑器 UI。',
  ].join('\n');

  return {
    prompt,
    images: [sourceImageUrl, annotatedImageUrl],
    metadata: {
      sourceNodeId: input.sourceNodeId,
      sourceImageUrl,
      annotatedImageUrl,
      annotationTextCount,
      annotationShapeCount,
      providerId: input.providerId,
      providerModel: input.providerModel,
      instruction,
    },
  };
}

function annotationEditMetadata(
  sourceNode: Node,
  request: AnnotationEditRequest,
  resultUrls: string[],
  createdAt: number | string,
  targetSlotId?: string,
) {
  const sourceNodeId = request.metadata.sourceNodeId || sourceNode.id;
  return {
    ...clonePlain(request.metadata),
    sourceNodeId,
    targetSlotId,
    resultUrls,
    completedAt: createdAt,
    prompt: request.prompt,
  };
}

export function buildAnnotationEditResultPlacement(
  input: AnnotationEditResultPlacementInput,
): AnnotationEditResultPlacement {
  const cleanUrls = input.resultUrls.map((url) => cleanText(url, 4096)).filter(Boolean);
  if (cleanUrls.length === 0) {
    throw new Error('标注改图没有可写入的结果 URL');
  }
  const sourceNode = input.sourceNode;
  const sourceNodeId = input.request.metadata.sourceNodeId || sourceNode.id;
  const createdAt = normalizeNow(input.now);

  if (input.targetNode) {
    const targetResult = buildCreativeTargetResult(input.targetNode, cleanUrls, {
      mode: input.targetMode || 'replace',
      sourceNodeIds: [sourceNodeId],
      now: createdAt,
      prompt: input.request.prompt,
    });
    const metadata = annotationEditMetadata(
      sourceNode,
      input.request,
      cleanUrls,
      createdAt,
      input.targetNode.id,
    );
    return {
      targetPatch: {
        ...targetResult.targetPatch,
        creativeWorkflowKind: 'annotation-edit',
        annotationEdit: metadata,
      },
      outputNode: targetResult.outputNode
        ? {
            ...targetResult.outputNode,
            data: {
              ...(targetResult.outputNode.data || {}),
              creativeWorkflowKind: 'annotation-edit',
              annotationEdit: metadata,
            },
          }
        : null,
    };
  }

  const rect = rectOf(sourceNode);
  const metadata = annotationEditMetadata(sourceNode, input.request, cleanUrls, createdAt);
  const outputNode: Node = {
    id: `output-annotation-edit-${sourceNodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'output',
    position: { x: rect.x + rect.w + 80, y: rect.y },
    selected: true,
    data: {
      ...createOutputDataFromItems(
        'image',
        cleanUrls.map((url) => ({ kind: 'image', url })),
      ),
      prompt: input.request.prompt,
      outputText: input.request.metadata.instruction || input.request.prompt,
      directOutputText: input.request.metadata.instruction || input.request.prompt,
      creativeWorkflowKind: 'annotation-edit',
      creativeSourceNodeIds: [sourceNodeId],
      annotationEdit: metadata,
      completedAt: createdAt,
    },
  };
  return {
    targetPatch: null,
    outputNode,
  };
}

function clonePlain<T>(value: T): T {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    if (Array.isArray(value)) return [...value] as T;
    if (typeof value === 'object') return { ...(value as Record<string, unknown>) } as T;
    return value;
  }
}

function isSecretKey(key: string): boolean {
  return /(api[-_]?key|token|secret|credential|password|hmac|private|access[-_]?key|refresh[-_]?key)/i.test(key);
}

function isDataUrl(value: unknown): boolean {
  return typeof value === 'string' && /^data:/i.test(value.trim());
}

function sanitizeCanvasValue(value: any): any {
  if (isDataUrl(value)) return undefined;
  if (Array.isArray(value)) {
    return value.map(sanitizeCanvasValue).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, any> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (isSecretKey(key)) continue;
    const next = sanitizeCanvasValue(raw);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

function sanitizeCanvas(canvas: any) {
  const cloned = sanitizeCanvasValue(clonePlain(canvas || {}));
  const nodes = Array.isArray(cloned?.nodes) ? cloned.nodes : [];
  cloned.nodes = nodes.map((node: any) => ({
    ...node,
    selected: false,
    dragging: false,
    measured: undefined,
    positionAbsolute: undefined,
    data: sanitizeCanvasValue(node?.data || {}),
  }));
  cloned.edges = Array.isArray(cloned?.edges) ? cloned.edges.map((edge: any) => ({ ...edge, selected: false })) : [];
  return cloned;
}

function collectPackageResources(canvas: any, existingFiles?: Set<string>): CanvasPackageResource[] {
  const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes : [];
  const seen = new Set<string>();
  const resources: CanvasPackageResource[] = [];
  for (const node of nodes) {
    const data = node?.data || {};
    for (const kind of ['image', 'video', 'audio', 'model3d'] as MediaKind[]) {
      for (const item of getMediaItemsFromData(data, kind)) {
        if (!item.url || isDataUrl(item.url)) continue;
        const key = `${kind}:${item.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const available = existingFiles instanceof Set ? existingFiles.has(item.url) : true;
        resources.push({
          id: `res-${resources.length + 1}`,
          kind,
          url: item.url,
          name: item.name || item.url.split('/').pop() || `${kind}-${resources.length + 1}`,
          sourceNodeId: node.id || '',
          available,
          resourceId: typeof data.resourceId === 'string' ? data.resourceId : undefined,
        });
      }
    }
  }
  return resources;
}

function sanitizeObjectList(value: unknown, limit = 500): Record<string, any>[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, limit)
    .map((item) => sanitizeCanvasValue(item))
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

function normalizeResourceLibrarySnapshot(value: unknown): CanvasPackageResourceLibrarySnapshot {
  const raw = value && typeof value === 'object' ? value as any : {};
  return {
    categories: sanitizeObjectList(raw.categories, 200),
    items: sanitizeObjectList(raw.items, 1000),
  };
}

function normalizeThumbnailRefs(value: unknown, existingFiles?: Set<string>): CanvasPackageThumbnailRef[] {
  if (!Array.isArray(value)) return [];
  const refs: CanvasPackageThumbnailRef[] = [];
  for (const raw of value.slice(0, 1000)) {
    const item = sanitizeCanvasValue(raw);
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const url = cleanText((item as any).url || (item as any).thumbUrl || (item as any).thumbnailUrl, 4096);
    if (!url || isDataUrl(url)) continue;
    refs.push({
      id: cleanText((item as any).id, 120) || `thumb-${refs.length + 1}`,
      url,
      sourceUrl: cleanText((item as any).sourceUrl || (item as any).fileUrl, 4096) || undefined,
      sourceNodeId: cleanText((item as any).sourceNodeId, 120) || undefined,
      kind: cleanText((item as any).kind, 40) || undefined,
      available: existingFiles instanceof Set ? existingFiles.has(url) : (item as any).available !== false,
    });
  }
  return refs;
}

const HISTORY_KINDS: CanvasPackageHistoryKind[] = ['image', 'video', 'audio', 'text', 'model3d'];

function emptyHistoryCounts(): Record<CanvasPackageHistoryKind, number> {
  return {
    image: 0,
    video: 0,
    audio: 0,
    text: 0,
    model3d: 0,
  };
}

function normalizeHistoryKind(value: unknown): CanvasPackageHistoryKind {
  const kind = String(value || '').trim() as CanvasPackageHistoryKind;
  return HISTORY_KINDS.includes(kind) ? kind : 'text';
}

function normalizeGenerationHistorySummary(value: unknown, limit = 160): CanvasPackageHistorySummary {
  const rawItems = Array.isArray(value) ? value : [];
  const byKind = emptyHistoryCounts();
  const items = rawItems.slice(0, limit).map((raw, index) => {
    const item = sanitizeCanvasValue(raw);
    const kind = normalizeHistoryKind((item as any)?.kind);
    byKind[kind] += 1;
    const url = cleanText((item as any)?.url, 4096);
    return {
      id: cleanText((item as any)?.id, 120) || `history-${index + 1}`,
      kind,
      nodeId: cleanText((item as any)?.nodeId, 120),
      nodeType: cleanText((item as any)?.nodeType, 80),
      title: cleanText((item as any)?.title, 200) || `${kind} ${index + 1}`,
      subtitle: cleanText((item as any)?.subtitle, 240),
      createdAt: Number((item as any)?.createdAt) || index,
      ...(url && !isDataUrl(url) ? { url } : {}),
      fileName: cleanText((item as any)?.fileName, 200),
      textPreview: cleanText((item as any)?.textPreview, 500),
    };
  });
  for (const raw of rawItems.slice(limit)) {
    const kind = normalizeHistoryKind((raw as any)?.kind);
    byKind[kind] += 1;
  }
  return {
    total: rawItems.length,
    byKind,
    items,
    truncated: rawItems.length > limit,
  };
}

export function createCanvasResourcePackageManifest(options: {
  canvasId: string;
  title?: string;
  canvas: any;
  existingFiles?: Set<string>;
  portable?: boolean;
  now?: string;
  resourceLibrary?: unknown;
  thumbnails?: unknown[];
  generationHistory?: unknown[];
}): CanvasResourcePackageManifest {
  const canvas = sanitizeCanvas(options.canvas);
  const resources = collectPackageResources(canvas, options.existingFiles);
  const missingFiles = resources.filter((item) => !item.available);
  const filesToCopy = options.portable ? resources.filter((item) => item.available) : [];
  const resourceLibrary = normalizeResourceLibrarySnapshot(options.resourceLibrary);
  const thumbnailRefs = normalizeThumbnailRefs(options.thumbnails, options.existingFiles);
  const generationHistorySummary = normalizeGenerationHistorySummary(options.generationHistory);
  return {
    schema: 't8-canvas-resource-package',
    version: 1,
    canvasId: options.canvasId,
    title: cleanText(options.title, 100) || '当前画布资源包',
    exportedAt: options.now || new Date().toISOString(),
    portable: !!options.portable,
    canvas,
    resources,
    missingFiles,
    filesToCopy,
    resourceLibrary,
    thumbnailRefs,
    generationHistorySummary,
    summary: {
      nodeCount: Array.isArray(canvas.nodes) ? canvas.nodes.length : 0,
      edgeCount: Array.isArray(canvas.edges) ? canvas.edges.length : 0,
      resourceCount: resources.length,
      missingCount: missingFiles.length,
      resourceLibraryItemCount: resourceLibrary.items.length,
      thumbnailCount: thumbnailRefs.length,
      generationHistoryCount: generationHistorySummary.total,
    },
  };
}

export function prepareCanvasResourcePackageImport(input: any): CanvasResourcePackageImportPlan {
  const manifest = input?.schema === 't8-canvas-resource-package' ? input : null;
  const canvas = sanitizeCanvas(manifest?.canvas || input?.canvasData || input?.canvas || input || {});
  const resources = sanitizeObjectList(manifest?.resources, 2000) as CanvasPackageResource[];
  const missingFiles = sanitizeObjectList(manifest?.missingFiles, 2000) as CanvasPackageResource[];
  const filesToCopy = sanitizeObjectList(manifest?.filesToCopy, 2000) as CanvasPackageResource[];
  const resourceLibrary = normalizeResourceLibrarySnapshot(manifest?.resourceLibrary);
  const thumbnailRefs = normalizeThumbnailRefs(manifest?.thumbnailRefs || manifest?.thumbnails);
  const generationHistorySummary = manifest?.generationHistorySummary && typeof manifest.generationHistorySummary === 'object'
    ? {
        total: Number(manifest.generationHistorySummary.total) || 0,
        byKind: {
          ...emptyHistoryCounts(),
          ...(sanitizeCanvasValue(manifest.generationHistorySummary.byKind || {}) as Record<string, number>),
        } as Record<CanvasPackageHistoryKind, number>,
        items: sanitizeObjectList(manifest.generationHistorySummary.items, 160),
        truncated: !!manifest.generationHistorySummary.truncated,
      }
    : normalizeGenerationHistorySummary([]);
  return {
    canvas,
    resources,
    missingFiles,
    filesToCopy,
    resourceLibrary,
    thumbnailRefs,
    generationHistorySummary,
    summary: {
      nodeCount: Array.isArray(canvas.nodes) ? canvas.nodes.length : 0,
      edgeCount: Array.isArray(canvas.edges) ? canvas.edges.length : 0,
      resourceCount: resources.length,
      missingCount: missingFiles.length,
      resourceLibraryItemCount: resourceLibrary.items.length,
      thumbnailCount: thumbnailRefs.length,
      generationHistoryCount: generationHistorySummary.total,
    },
  };
}

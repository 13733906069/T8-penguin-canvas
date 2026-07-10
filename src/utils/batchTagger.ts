export type BatchTagMediaKind = 'image' | 'video';
export type BatchTagMode = 'tags' | 'caption' | 'short' | 'json' | 'custom';
export type BatchTagSidecarFormat = 'txt' | 'json';

export interface BatchTagPromptOptions {
  mode: BatchTagMode;
  mediaKind: BatchTagMediaKind;
  fileName?: string;
  language?: string;
  maxTags?: number;
  customPrompt?: string;
}

export interface BatchTagParseResult {
  text: string;
  tags: string[];
  caption: string;
  shortCaption: string;
  metadata: Record<string, any> | null;
  rawText: string;
}

export interface BatchTagSidecarNameInput {
  name?: string;
  relativePath?: string;
  formats?: BatchTagSidecarFormat[];
}

export interface BatchTagSidecarDestinationItem {
  sourcePath?: string;
  outputFiles?: Array<{
    path?: string;
    directory?: string;
    url?: string;
  }>;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv']);
const MODELSCOPE_QWEN3_VL_235B = 'Qwen/Qwen3-VL-235B-A22B-Instruct';
const MODELSCOPE_QWEN3_TEXT_235B = 'Qwen/Qwen3-235B-A22B';

function extname(value: string): string {
  const clean = String(value || '').split(/[?#]/)[0] || '';
  const slashSafe = clean.split(/[\\/]/).pop() || clean;
  const index = slashSafe.lastIndexOf('.');
  if (index <= 0) return '';
  return slashSafe.slice(index).toLowerCase();
}

function splitName(value?: string): { base: string; ext: string } {
  const raw = String(value || 'batch-item').split(/[\\/]/).pop() || 'batch-item';
  const ext = extname(raw);
  const base = ext ? raw.slice(0, -ext.length) : raw;
  return { base: base || 'batch-item', ext };
}

export function classifyBatchTagFile(fileName: string, mime = ''): BatchTagMediaKind | null {
  const normalizedMime = String(mime || '').toLowerCase();
  if (normalizedMime.startsWith('image/')) return 'image';
  if (normalizedMime.startsWith('video/')) return 'video';
  const ext = extname(fileName);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return null;
}

export function sanitizeBatchTagPathPart(value: string, fallback = 'item'): string {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+$/, '')
    .slice(0, 160);
  return cleaned || fallback;
}

export function buildBatchTagSidecarNames(input: BatchTagSidecarNameInput): Partial<Record<BatchTagSidecarFormat, string>> {
  const formats = input.formats?.length ? input.formats : ['txt'];
  const relative = String(input.relativePath || input.name || 'batch-item').replace(/\\/g, '/');
  const parts = relative.split('/').filter(Boolean);
  const fileName = parts.pop() || input.name || 'batch-item';
  const { base } = splitName(fileName);
  const safeDirs = parts
    .filter((part) => part !== '.' && part !== '..')
    .map((part) => sanitizeBatchTagPathPart(part, 'folder'));
  const safeBase = sanitizeBatchTagPathPart(base, 'batch-item');
  const prefix = safeDirs.length ? `${safeDirs.join('/')}/` : '';
  const out: Partial<Record<BatchTagSidecarFormat, string>> = {};
  for (const format of formats) {
    if (format !== 'txt' && format !== 'json') continue;
    out[format] = `${prefix}${safeBase}.${format}`;
  }
  return out;
}

function normalizePathLike(value: string): string {
  return String(value || '').replace(/\\/g, '/');
}

function isBrowserSidecarOutput(file: { path?: string; directory?: string; url?: string }): boolean {
  return String(file.path || '').startsWith('browser-fs://') || String(file.directory || '').includes('浏览器授权');
}

function isUploadCopyOutput(file: { path?: string; directory?: string; url?: string }): boolean {
  const pathLike = normalizePathLike(`${file.directory || ''}/${file.path || ''}`);
  const url = normalizePathLike(file.url || '');
  return url.startsWith('/files/input/')
    || /(^|\/)T8-penguin-canvas\/input(\/|$)/i.test(pathLike)
    || /(^|\/)input(\/|$)/i.test(normalizePathLike(file.directory || ''));
}

export function summarizeBatchTagSidecarDestination(items: BatchTagSidecarDestinationItem[]): string {
  const completed = Array.isArray(items) ? items : [];
  const outputs = completed.flatMap((item) => (Array.isArray(item.outputFiles) ? item.outputFiles.map((file) => ({ item, file })) : []));
  if (!outputs.length) return '批量打标完成';

  const hasBrowserSidecar = outputs.some(({ file }) => isBrowserSidecarOutput(file));
  const hasUploadCopyFallback = outputs.some(({ item, file }) => !String(item.sourcePath || '').trim() && !isBrowserSidecarOutput(file) && isUploadCopyOutput(file));
  if (hasUploadCopyFallback) {
    return '批量打标完成，但有结果仅保存到上传副本目录（input）；请授权原素材目录后重试';
  }
  if (hasBrowserSidecar) {
    return '批量打标完成，结果已写回浏览器授权的原素材目录';
  }
  return '批量打标完成，结果已保存到原素材目录';
}

function modeLabel(mode: BatchTagMode): string {
  if (mode === 'caption') return '自然语言描述';
  if (mode === 'short') return '短句 caption';
  if (mode === 'json') return '标准 JSON';
  if (mode === 'custom') return '自定义格式';
  return 'TAG 标签';
}

const DIRECT_OUTPUT_RULES = [
  'Only output the final caption/tag result. Do not include greetings, explanations, suggestions, follow-up questions, or markdown.',
  '不要包含任何开场白、反问、解释、建议或结束语；不要提出任何后续问题。',
];

function buildIdeogram4JsonPrompt(options: BatchTagPromptOptions, fileLine: string): string {
  const mediaText = options.mediaKind === 'video' ? 'video frames' : 'image';
  const aspectRatioHint = options.mediaKind === 'video'
    ? 'Use the visible frame composition to estimate bboxes.'
    : 'If the exact aspect ratio is unknown, infer it from the provided image.';
  return [
    'You are an Ideogram-4 structured captioner. Analyze the provided visual material and emit one JSON object for image-training captions.',
    fileLine,
    'Observe-only rule: describe only what is actually visible. Do not invent subjects, props, brands, text, background details, atmosphere, identity, or off-frame content.',
    'OUTPUT CONTRACT: exactly three top-level keys in this order: "high_level_description", "style_description", "compositional_deconstruction".',
    '"high_level_description": one concise observational sentence, under 50 words, starting directly with the subject. Do not start with "this image shows".',
    '"style_description": required object. For photographs use keys "aesthetics", "lighting", "photo", "medium", "color_palette". For illustration/3D/painting/graphic design use "aesthetics", "lighting", "medium", "art_style", "color_palette".',
    '"medium" must be one of: "photograph", "illustration", "3d_render", "painting", "graphic_design". "color_palette" uses dominant uppercase #RRGGBB colors, up to 16.',
    '"compositional_deconstruction": required object with "background" and "elements". Background describes the scene shell only. Elements are one item per distinct visible subject.',
    'Element shapes: {"type":"obj","bbox":[y1,x1,y2,x2],"desc":"..."} or {"type":"text","bbox":[y1,x1,y2,x2],"text":"VISIBLE TEXT","desc":"..."}.',
    'Bboxes are optional, normalized 0-1000, top-left origin, stored as [y1,x1,y2,x2]. Include bboxes only when the visible extent is clear.',
    'For visible text, preserve the exact characters in the "text" field. Prose fields stay in English.',
    `${aspectRatioHint} The current input is ${mediaText}.`,
    'Emit valid JSON only. No markdown fences. No commentary. No questions.',
    ...DIRECT_OUTPUT_RULES,
  ].filter(Boolean).join('\n');
}

export function buildBatchTagPrompt(options: BatchTagPromptOptions): string {
  const mode = options.mode || 'tags';
  const mediaText = options.mediaKind === 'video' ? '视频' : '图像';
  const fileLine = options.fileName ? `素材文件名：${options.fileName}` : '';
  const languageLine = String(options.language || 'zh-CN').toLowerCase().startsWith('en')
    ? 'Output language: English.'
    : '输出语言：中文，必要的训练标签可保留英文通用 tag。';
  const maxTags = Math.max(1, Math.min(200, Math.round(Number(options.maxTags) || 30)));

  if (mode === 'json') {
    return buildIdeogram4JsonPrompt(options, fileLine);
  }

  const base = [
    `你是训练素材批量打标助手。请严格根据当前${mediaText}可见内容输出${modeLabel(mode)}。`,
    fileLine,
    languageLine,
    '不要编造不可见主体、人物身份、品牌或文字；不要输出 Markdown 解释。',
    ...DIRECT_OUTPUT_RULES,
  ].filter(Boolean);

  if (mode === 'caption') {
    return [
      ...base,
      'Generate a detailed paragraph that combines the subject, actions, environment, lighting, and mood into 2-3 cohesive sentences. Focus on accurate visual details rather than speculation.',
      'Output the description directly.',
      '只输出描述正文。',
    ].join('\n');
  }
  if (mode === 'short') {
    return [
      ...base,
      'Analyze the image and write a single concise sentence that describes the main subject and setting. Keep it grounded in visible details only.',
      '只输出短句正文。',
    ].join('\n');
  }
  return [
    ...base,
    `Your task is to generate a clean list of comma-separated tags based only on the visual information in the image. 输出逗号分隔 TAG，最多 ${maxTags} 个。`,
    'Strictly describe visual elements like subject, clothing, environment, colors, lighting, and composition. Avoid repeating tags. 不要加编号。',
  ].join('\n');
}

function stripCodeFence(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^```(?:json|JSON|txt|text)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractJsonObjectText(value: string): string {
  const text = String(value || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

export function normalizeBatchTags(values: unknown, maxTags = 200): string[] {
  const raw = Array.isArray(values)
    ? values
    : String(values || '').split(/[,，;；\n]/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    const tag = String(value || '').trim().replace(/\s+/g, ' ');
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= maxTags) break;
  }
  return out;
}

export function parseBatchTagOutput(rawText: string, mode: BatchTagMode): BatchTagParseResult {
  const raw = String(rawText || '').trim();
  const clean = stripCodeFence(raw);
  let metadata: Record<string, any> | null = null;
  if (mode === 'json') {
    try {
      const parsed = JSON.parse(clean);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed;
    } catch {
      try {
        const parsed = JSON.parse(extractJsonObjectText(clean));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed;
      } catch {
        metadata = null;
      }
    }
  }
  const tags = normalizeBatchTags(metadata?.tags ?? (mode === 'tags' ? clean : []));
  const caption = String(metadata?.high_level_description || metadata?.caption || (mode === 'caption' ? clean : '')).trim();
  const shortCaption = String(metadata?.shortCaption || metadata?.short_caption || (mode === 'short' ? clean : '')).trim();
  const text = mode === 'tags'
    ? tags.join(', ')
    : mode === 'short'
      ? shortCaption
      : mode === 'caption'
        ? caption
        : metadata
          ? JSON.stringify(metadata, null, 2)
          : clean;
  return {
    text,
    tags,
    caption,
    shortCaption,
    metadata,
    rawText: raw,
  };
}

export function recommendedBatchTagModel(input: {
  providerSource?: string;
  requestedModel?: string;
  mediaKind?: BatchTagMediaKind;
  chatModels?: string[];
}): string {
  const requested = String(input.requestedModel || '').trim();
  const providerSource = String(input.providerSource || '').trim().toLowerCase();
  if (providerSource === 'modelscope' && (input.mediaKind === 'image' || input.mediaKind === 'video')) {
    const models = Array.isArray(input.chatModels) ? input.chatModels : [];
    const hasVl = models.some((model) => model === MODELSCOPE_QWEN3_VL_235B) || !models.length;
    if ((!requested || requested === MODELSCOPE_QWEN3_TEXT_235B) && hasVl) return MODELSCOPE_QWEN3_VL_235B;
  }
  if (requested) return requested;
  if (providerSource === 'zhenzhen') return 'gpt-4o-mini';
  return input.chatModels?.find((model) => String(model || '').trim()) || 'gpt-4o-mini';
}

export const BATCH_TAGGER_DEFAULT_MODEL = {
  zhenzhen: 'gpt-4o-mini',
  modelscope: MODELSCOPE_QWEN3_VL_235B,
};

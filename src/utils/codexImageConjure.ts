export const CODEX_IMAGE_CONJURE_PROMPT_SCHEMA = 't8-codex-image-conjure-prompts' as const;

export type CodexImagePromptMode = 'text_to_image' | 'image_to_image' | 'edit' | 'any';
export type CodexImagePromptModelHint = 'gpt-image-2' | 'any';

export interface CodexImagePromptCategory {
  id: string;
  name: string;
  order: number;
}

export interface CodexImagePromptTemplate {
  id: string;
  title: string;
  shortTitle: string;
  content: string;
  category: string;
  tags: string[];
  mode: CodexImagePromptMode;
  modelHint: CodexImagePromptModelHint;
  notes?: string;
  favorite?: boolean;
  variables: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface CodexImagePromptSnippet {
  id: string;
  tag: string;
  title: string;
  content: string;
  category: string;
  order: number;
}

export interface CodexImagePromptState {
  version: 1;
  categories: CodexImagePromptCategory[];
  templates: CodexImagePromptTemplate[];
  snippets: CodexImagePromptSnippet[];
}

export interface CodexImagePromptPack extends CodexImagePromptState {
  schema: typeof CODEX_IMAGE_CONJURE_PROMPT_SCHEMA;
  exportedAt: string;
}

export type CodexImageConjureTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CodexImageConjureOutputSettings {
  model?: string;
  size?: string;
  aspectRatio?: string;
  quality?: string;
  count?: number;
  promptMode?: string;
  format?: string;
  background?: string;
}

export interface CodexImageConjurePromptBuildInput {
  upstreamTexts?: string[];
  templateNotes?: string;
  prompt?: string;
  snippets?: CodexImagePromptSnippet[];
  negativePrompt?: string;
  outputSettings?: CodexImageConjureOutputSettings;
}

export interface CodexImageConjureTask {
  id: string;
  prompt: string;
  images: string[];
  model: string;
  size: string;
  aspectRatio: string;
  quality: string;
  count: number;
  queueIndex: number;
  status: CodexImageConjureTaskStatus;
  progressText?: string;
  error?: string;
  resultImageUrls: string[];
  resultText?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

const DEFAULT_CATEGORY_IDS = ['常用', '人像', '产品', '修复', '海报', '电商'];

export const DEFAULT_CODEX_IMAGE_TEMPLATE_CATEGORIES: CodexImagePromptCategory[] = [
  { id: '常用', name: '常用', order: 10 },
  { id: '人像', name: '人像', order: 20 },
  { id: '产品', name: '产品', order: 30 },
  { id: '修复', name: '修复', order: 40 },
  { id: '海报', name: '海报', order: 50 },
  { id: '电商', name: '电商', order: 60 },
];

export const DEFAULT_CODEX_IMAGE_SNIPPETS: CodexImagePromptSnippet[] = [
  {
    id: 'snippet-cinematic',
    tag: 'cinematic',
    title: '电影感光影',
    content: 'cinematic lighting, shallow depth of field, refined composition, high-end color grading',
    category: '光影',
    order: 10,
  },
  {
    id: 'snippet-editorial',
    tag: 'editorial',
    title: '杂志大片',
    content: 'editorial fashion photography, clean styling, professional studio direction, premium magazine layout',
    category: '风格',
    order: 20,
  },
  {
    id: 'snippet-product',
    tag: 'product',
    title: '产品主图',
    content: 'premium product hero shot, crisp edges, controlled reflections, commercial advertising quality',
    category: '商业',
    order: 30,
  },
  {
    id: 'snippet-clean',
    tag: 'clean',
    title: '干净背景',
    content: 'clean background, uncluttered negative space, accurate subject silhouette, no watermark',
    category: '基础',
    order: 40,
  },
  {
    id: 'snippet-beauty',
    tag: 'beauty',
    title: '高级美妆',
    content: 'premium beauty campaign, luminous skin, elegant makeup, refined facial details, tasteful styling',
    category: '人像',
    order: 50,
  },
  {
    id: 'snippet-softlight',
    tag: 'softlight',
    title: '柔和自然光',
    content: 'soft diffused natural light, gentle highlight rolloff, airy atmosphere, realistic shadow detail',
    category: '光影',
    order: 60,
  },
  {
    id: 'snippet-studio',
    tag: 'studio',
    title: '棚拍质感',
    content: 'professional studio lighting, controlled backdrop, crisp subject separation, commercial finish',
    category: '光影',
    order: 70,
  },
  {
    id: 'snippet-ecommerce',
    tag: 'ecom',
    title: '电商详情页',
    content: 'ecommerce-ready product composition, clear selling point, accurate scale, clean detail-page layout',
    category: '商业',
    order: 80,
  },
  {
    id: 'snippet-poster',
    tag: 'poster',
    title: '海报版式',
    content: 'poster key visual, typography-safe space, strong hierarchy, eye-catching campaign composition',
    category: '海报',
    order: 90,
  },
  {
    id: 'snippet-reference',
    tag: 'ref',
    title: '保持参考',
    content: 'preserve the reference subject identity, material cues, color palette, and overall composition logic',
    category: '参考',
    order: 100,
  },
  {
    id: 'snippet-cleanup',
    tag: 'cleanup',
    title: '修复清理',
    content: 'remove artifacts, repair broken details, keep natural texture, avoid over-smoothing, production-ready result',
    category: '修复',
    order: 110,
  },
  {
    id: 'snippet-negative-safe',
    tag: 'safe',
    title: '安全负面词',
    content: 'avoid watermark, logo, text artifacts, distorted anatomy, extra fingers, blurry details, low resolution',
    category: '基础',
    order: 120,
  },
];

export const DEFAULT_CODEX_IMAGE_TEMPLATES: CodexImagePromptTemplate[] = [
  {
    id: 'template-portrait-soft-sunlight',
    title: '阳光人像',
    shortTitle: '阳光人像',
    content: 'Bright natural portrait of {subject}, soft sunlight, fresh outdoor atmosphere, gentle bokeh, clean skin texture, realistic details, natural expression, editorial photography quality.',
    category: '人像',
    tags: ['portrait', 'sunlight', 'editorial'],
    mode: 'text_to_image',
    modelHint: 'gpt-image-2',
    notes: '适合人物写真、头像和海报主视觉。',
    favorite: false,
    variables: ['subject'],
    usageCount: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
  {
    id: 'template-product-hero-clean',
    title: '产品主视觉',
    shortTitle: '产品主图',
    content: 'Premium product hero image for {product}, clean background, crisp material texture, controlled reflection, commercial lighting, balanced negative space, high-end advertising photography.',
    category: '产品',
    tags: ['product', 'commerce', 'hero'],
    mode: 'text_to_image',
    modelHint: 'gpt-image-2',
    notes: '适合电商主图、详情页和品牌视觉。',
    favorite: false,
    variables: ['product'],
    usageCount: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
  {
    id: 'template-poster-key-visual',
    title: '海报主视觉',
    shortTitle: '海报',
    content: 'A striking poster key visual for {theme}, strong composition, clear focal point, layered depth, polished typography-safe empty area, dramatic but tasteful lighting, premium campaign design.',
    category: '海报',
    tags: ['poster', 'key-visual', 'campaign'],
    mode: 'text_to_image',
    modelHint: 'gpt-image-2',
    notes: '适合活动海报和营销主视觉。',
    favorite: false,
    variables: ['theme'],
    usageCount: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
  {
    id: 'template-reference-remix',
    title: '参考图再创作',
    shortTitle: '参考再创作',
    content: 'Use the provided reference image as the primary visual anchor. Recreate {subject} with stronger polish, preserve key identity and composition cues, improve lighting, texture, clarity, and final production quality.',
    category: '修复',
    tags: ['reference', 'remix', 'image-to-image'],
    mode: 'image_to_image',
    modelHint: 'gpt-image-2',
    notes: '适合把上传图改成更精致的成片，并保留主体关系。',
    favorite: false,
    variables: ['subject'],
    usageCount: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
  {
    id: 'template-character-design',
    title: '角色设定图',
    shortTitle: '角色设定',
    content: 'Character design sheet for {character}, full-body view, recognizable silhouette, outfit details, material notes, coherent personality, clean readable background, game/anime concept art polish.',
    category: '人像',
    tags: ['character', 'concept', 'design'],
    mode: 'text_to_image',
    modelHint: 'gpt-image-2',
    notes: '适合创作者做角色外观、服装和设定延展。',
    favorite: false,
    variables: ['character'],
    usageCount: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
  {
    id: 'template-ecommerce-scene',
    title: '电商场景图',
    shortTitle: '电商场景',
    content: 'Lifestyle ecommerce scene for {product}, realistic usage context, clean props, clear selling point, accurate scale, polished commercial lighting, ready for marketplace listing.',
    category: '电商',
    tags: ['ecommerce', 'lifestyle', 'listing'],
    mode: 'text_to_image',
    modelHint: 'gpt-image-2',
    notes: '适合主图之外的使用场景和详情页素材。',
    favorite: false,
    variables: ['product'],
    usageCount: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
  {
    id: 'template-background-extend',
    title: '扩图补景',
    shortTitle: '扩图补景',
    content: 'Extend the provided image into a larger composition, preserve the original subject and perspective, naturally continue background texture, lighting direction, shadows, and depth.',
    category: '修复',
    tags: ['outpaint', 'extend', 'background'],
    mode: 'edit',
    modelHint: 'gpt-image-2',
    notes: '适合把窄图扩成海报或电商尺寸。',
    favorite: false,
    variables: [],
    usageCount: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
  {
    id: 'template-social-cover',
    title: '社媒封面',
    shortTitle: '社媒封面',
    content: 'Social media cover image for {topic}, bold but clean composition, strong visual hook, readable focal area, modern creator-friendly style, platform-safe crop.',
    category: '海报',
    tags: ['social', 'cover', 'creator'],
    mode: 'text_to_image',
    modelHint: 'gpt-image-2',
    notes: '适合小红书、B站、短视频封面和活动头图。',
    favorite: false,
    variables: ['topic'],
    usageCount: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
];

const VALID_MODES = new Set<CodexImagePromptMode>(['text_to_image', 'image_to_image', 'edit', 'any']);
const VALID_MODEL_HINTS = new Set<CodexImagePromptModelHint>(['gpt-image-2', 'any']);

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function cleanString(value: unknown, max = 4000): string {
  return String(value ?? '').replace(/\s+\n/g, '\n').trim().slice(0, max);
}

function stableId(prefix: string, seed: string): string {
  const safe = cleanString(seed, 80)
    .toLowerCase()
    .replace(/^~+/, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${safe || Math.random().toString(36).slice(2, 9)}`;
}

function cleanTag(value: unknown): string {
  return cleanString(value, 80)
    .replace(/^[~～〜∼˜]+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w.-]+/g, '')
    .toLowerCase();
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanString(item, 80)).filter(Boolean)));
}

function extractVariables(content: string): string[] {
  const variables = new Set<string>();
  content.replace(/\{([a-zA-Z0-9_\-\u4e00-\u9fa5]+)\}/g, (_match, name) => {
    variables.add(String(name));
    return '';
  });
  return Array.from(variables);
}

function normalizeCategory(value: unknown, index: number): CodexImagePromptCategory | null {
  const item = asObject(value);
  const id = cleanString(item.id ?? item.name ?? item.label, 80);
  if (!id) return null;
  return {
    id,
    name: cleanString(item.name ?? item.label ?? id, 80) || id,
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : (index + 1) * 10,
  };
}

function normalizeTemplate(value: unknown): CodexImagePromptTemplate | null {
  const item = asObject(value);
  const title = cleanString(item.title ?? item.name ?? item.short_title, 160);
  const content = cleanString(item.content ?? item.prompt ?? item.text, 12000);
  if (!title || !content) return null;
  const now = new Date().toISOString();
  const category = cleanString(item.category ?? item.categoryId ?? '常用', 80) || '常用';
  const mode = cleanString(item.mode ?? item.prompt_mode ?? 'any') as CodexImagePromptMode;
  const modelHint = cleanString(item.model_hint ?? item.modelHint ?? 'gpt-image-2') as CodexImagePromptModelHint;
  return {
    id: cleanString(item.id, 100) || stableId('template', `${category}-${title}`),
    title,
    shortTitle: cleanString(item.short_title ?? item.shortTitle ?? title, 80) || title,
    content,
    category,
    tags: cleanList(item.tags),
    mode: VALID_MODES.has(mode) ? mode : 'any',
    modelHint: VALID_MODEL_HINTS.has(modelHint) ? modelHint : 'gpt-image-2',
    notes: cleanString(item.notes ?? item.description, 1000),
    favorite: Boolean(item.favorite),
    variables: cleanList(item.variables).length ? cleanList(item.variables) : extractVariables(content),
    usageCount: Math.max(0, Number(item.usage_count ?? item.usageCount ?? 0) || 0),
    createdAt: cleanString(item.created_at ?? item.createdAt, 80) || now,
    updatedAt: cleanString(item.updated_at ?? item.updatedAt, 80) || now,
    lastUsedAt: cleanString(item.last_used_at ?? item.lastUsedAt, 80) || undefined,
  };
}

function normalizeSnippet(value: unknown): CodexImagePromptSnippet | null {
  const item = asObject(value);
  const tag = cleanTag(item.tag ?? item.name ?? item.trigger);
  const content = cleanString(item.content ?? item.prompt ?? item.text, 3000);
  if (!tag || !content) return null;
  return {
    id: cleanString(item.id, 100) || stableId('snippet', tag),
    tag,
    title: cleanString(item.title ?? item.name ?? tag, 120) || tag,
    content,
    category: cleanString(item.category ?? '常用', 80) || '常用',
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 100,
  };
}

function mergeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  items.forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function mergeSnippets(items: CodexImagePromptSnippet[]): CodexImagePromptSnippet[] {
  const map = new Map<string, CodexImagePromptSnippet>();
  items.forEach((item) => {
    if (item?.tag) map.set(item.tag, item);
  });
  return Array.from(map.values()).sort((a, b) => a.order - b.order || a.tag.localeCompare(b.tag));
}

function normalizeArrays(value: unknown) {
  const source = asObject(value);
  return {
    categories: Array.isArray(source.categories) ? source.categories : [],
    templates: Array.isArray(source.templates)
      ? source.templates
      : Array.isArray(source.prompts)
        ? source.prompts
        : Array.isArray(source.items)
          ? source.items
          : [],
    snippets: Array.isArray(source.snippets)
      ? source.snippets
      : Array.isArray(source.prompt_snippets)
        ? source.prompt_snippets
        : [],
  };
}

export function normalizeCodexImagePromptState(value: unknown): CodexImagePromptState {
  const arrays = normalizeArrays(value);
  const categories = mergeById([
    ...DEFAULT_CODEX_IMAGE_TEMPLATE_CATEGORIES,
    ...arrays.categories.map(normalizeCategory).filter((item): item is CodexImagePromptCategory => !!item),
  ]);
  const templates = mergeById(arrays.templates.map(normalizeTemplate).filter((item): item is CodexImagePromptTemplate => !!item));
  const incomingSnippets = arrays.snippets.map(normalizeSnippet).filter((item): item is CodexImagePromptSnippet => !!item);
  const snippets = mergeSnippets(incomingSnippets.length ? incomingSnippets : DEFAULT_CODEX_IMAGE_SNIPPETS);

  for (const template of templates) {
    if (!categories.some((category) => category.id === template.category)) {
      categories.push({
        id: template.category,
        name: template.category,
        order: DEFAULT_CATEGORY_IDS.includes(template.category) ? DEFAULT_CATEGORY_IDS.indexOf(template.category) * 10 : 900,
      });
    }
  }

  return {
    version: 1,
    categories: categories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    templates,
    snippets,
  };
}

export function importCodexImagePromptPack(payload: unknown, current?: unknown): CodexImagePromptState {
  const base = current ? normalizeCodexImagePromptState(current) : normalizeCodexImagePromptState({});
  const incoming = normalizeCodexImagePromptState(payload);
  return normalizeCodexImagePromptState({
    categories: [...base.categories, ...incoming.categories],
    templates: [...base.templates, ...incoming.templates],
    snippets: [...base.snippets, ...incoming.snippets],
  });
}

export function exportCodexImagePromptPack(state: unknown): CodexImagePromptPack {
  const normalized = normalizeCodexImagePromptState(state);
  return {
    schema: CODEX_IMAGE_CONJURE_PROMPT_SCHEMA,
    exportedAt: new Date().toISOString(),
    ...normalized,
  };
}

export function expandCodexImagePromptSnippets(prompt: string, snippets: CodexImagePromptSnippet[] = DEFAULT_CODEX_IMAGE_SNIPPETS): string {
  const byTag = new Map(mergeSnippets(snippets.map(normalizeSnippet).filter((item): item is CodexImagePromptSnippet => !!item)).map((item) => [item.tag, item.content]));
  if (!byTag.size) return prompt;
  const boundary = String.raw`(^|[\s\n，。,.；;：:！？!?、（）()\[\]【】"'“”‘’])`;
  const trigger = String.raw`[~～〜∼˜]+`;
  const tag = String.raw`([\w.-]+)`;
  const pattern = new RegExp(`${boundary}${trigger}${tag}`, 'g');
  return String(prompt || '').replace(pattern, (match, prefix, rawTag) => {
    const content = byTag.get(cleanTag(rawTag));
    return content ? `${prefix}${content}` : match;
  });
}

export function upsertCodexImageTemplate(state: unknown, value: Partial<CodexImagePromptTemplate> & Record<string, unknown>): CodexImagePromptState {
  const normalized = normalizeCodexImagePromptState(state);
  const template = normalizeTemplate(value);
  if (!template) return normalized;
  const categories = normalized.categories.some((category) => category.id === template.category)
    ? normalized.categories
    : [...normalized.categories, { id: template.category, name: template.category, order: 900 }];
  const templates = normalized.templates.filter((item) => item.id !== template.id);
  return normalizeCodexImagePromptState({
    categories,
    templates: [...templates, { ...template, updatedAt: new Date().toISOString() }],
    snippets: normalized.snippets,
  });
}

export function deleteCodexImageTemplate(state: unknown, id: string): CodexImagePromptState {
  const normalized = normalizeCodexImagePromptState(state);
  return normalizeCodexImagePromptState({
    categories: normalized.categories,
    templates: normalized.templates.filter((item) => item.id !== id),
    snippets: normalized.snippets,
  });
}

export function upsertCodexImageSnippet(state: unknown, value: Partial<CodexImagePromptSnippet> & Record<string, unknown>): CodexImagePromptState {
  const normalized = normalizeCodexImagePromptState(state);
  const snippet = normalizeSnippet(value);
  if (!snippet) return normalized;
  return normalizeCodexImagePromptState({
    categories: normalized.categories,
    templates: normalized.templates,
    snippets: [...normalized.snippets.filter((item) => item.tag !== snippet.tag && item.id !== snippet.id), snippet],
  });
}

export function deleteCodexImageSnippet(state: unknown, tagOrId: string): CodexImagePromptState {
  const normalized = normalizeCodexImagePromptState(state);
  const tag = cleanTag(tagOrId);
  return normalizeCodexImagePromptState({
    categories: normalized.categories,
    templates: normalized.templates,
    snippets: normalized.snippets.filter((item) => item.id !== tagOrId && item.tag !== tag),
  });
}

export function buildCodexImageConjurePrompt(input: CodexImageConjurePromptBuildInput): string {
  const upstreamTexts = (input.upstreamTexts || []).map((item) => cleanString(item, 12000)).filter(Boolean);
  const localPrompt = expandCodexImagePromptSnippets(cleanString(input.prompt, 12000), input.snippets || DEFAULT_CODEX_IMAGE_SNIPPETS);
  const settings = input.outputSettings || {};
  const outputSettings = [
    settings.model ? `模型: ${settings.model}` : '',
    settings.size ? `尺寸: ${settings.size}` : '',
    settings.aspectRatio ? `比例: ${settings.aspectRatio}` : '',
    settings.quality ? `质量: ${settings.quality}` : '',
    settings.count ? `数量: ${settings.count}` : '',
    settings.promptMode ? `提示词模式: ${settings.promptMode}` : '',
    settings.format ? `输出格式: ${settings.format}` : '',
    settings.background ? `背景: ${settings.background}` : '',
  ].filter(Boolean);
  return [
    upstreamTexts.length ? `上游文本:\n${upstreamTexts.join('\n\n')}` : '',
    input.templateNotes ? `模板说明: ${cleanString(input.templateNotes, 1000)}` : '',
    localPrompt,
    input.negativePrompt ? `Negative prompt: ${cleanString(input.negativePrompt, 4000)}` : '',
    outputSettings.length ? `输出设置:\n${outputSettings.join('\n')}` : '',
  ].filter(Boolean).join('\n\n').trim();
}

export function createCodexImageConjureTask(input: Partial<CodexImageConjureTask> & {
  prompt: string;
  images?: string[];
  model?: string;
  size?: string;
  aspectRatio?: string;
  quality?: string;
  count?: number;
}): CodexImageConjureTask {
  const now = new Date().toISOString();
  return {
    id: cleanString(input.id, 120) || `conjure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: cleanString(input.prompt, 20000),
    images: Array.isArray(input.images) ? Array.from(new Set(input.images.map((url) => cleanString(url, 2000)).filter(Boolean))) : [],
    model: cleanString(input.model, 80) || 'gpt-5.5',
    size: cleanString(input.size, 40) || '2K',
    aspectRatio: cleanString(input.aspectRatio, 40) || '9:16',
    quality: cleanString(input.quality, 40) || '高',
    count: Math.max(1, Math.min(4, Number(input.count || 1) || 1)),
    queueIndex: Math.max(1, Number(input.queueIndex || 1) || 1),
    status: input.status || 'queued',
    progressText: cleanString(input.progressText, 1000) || undefined,
    error: cleanString(input.error, 1000) || undefined,
    resultImageUrls: Array.isArray(input.resultImageUrls) ? Array.from(new Set(input.resultImageUrls.map((url) => cleanString(url, 2000)).filter(Boolean))) : [],
    resultText: cleanString(input.resultText, 4000) || undefined,
    createdAt: cleanString(input.createdAt, 80) || now,
    updatedAt: cleanString(input.updatedAt, 80) || now,
    startedAt: cleanString(input.startedAt, 80) || undefined,
    completedAt: cleanString(input.completedAt, 80) || undefined,
  };
}

export function enqueueCodexImageConjureTasks(
  current: CodexImageConjureTask[],
  input: CodexImageConjureTask | Parameters<typeof createCodexImageConjureTask>[0],
  count = 1,
): CodexImageConjureTask[] {
  const base = createCodexImageConjureTask(input as any);
  const existing = Array.isArray(current) ? current.map((item) => createCodexImageConjureTask(item)) : [];
  const startIndex = existing.length + 1;
  const copies = Array.from({ length: Math.max(1, Math.min(20, Number(count) || 1)) }, (_item, index) => createCodexImageConjureTask({
    ...base,
    id: `conjure-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    queueIndex: startIndex + index,
    status: 'queued',
    progressText: '',
    error: '',
    resultImageUrls: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  return [...existing, ...copies];
}

export function updateCodexImageConjureTask(
  tasks: CodexImageConjureTask[],
  id: string,
  patch: Partial<CodexImageConjureTask>,
): CodexImageConjureTask[] {
  const now = new Date().toISOString();
  return (Array.isArray(tasks) ? tasks : []).map((task) => {
    if (task.id !== id) return createCodexImageConjureTask(task);
    return createCodexImageConjureTask({ ...task, ...patch, id: task.id, updatedAt: now });
  });
}

export function trimCodexImageConjureHistory(tasks: CodexImageConjureTask[], completedLimit = 20): CodexImageConjureTask[] {
  const normalized = (Array.isArray(tasks) ? tasks : []).map((task) => createCodexImageConjureTask(task));
  const active = normalized.filter((task) => task.status === 'queued' || task.status === 'running');
  const completed = normalized
    .filter((task) => task.status !== 'queued' && task.status !== 'running')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(0, completedLimit));
  return [...active, ...completed].sort((a, b) => a.queueIndex - b.queueIndex || a.createdAt.localeCompare(b.createdAt));
}

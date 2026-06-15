export type ArtistStyleOutputMode = 'prompt' | 'image';

export interface ArtistStyleItem {
  id: string;
  name: string;
  chineseName: string;
  displayName: string;
  movement: string;
  movementZh: string;
  category: string;
  categoryZh: string;
  cue: string;
  sourceOrder: number;
  imageUrl: string;
  thumbnailUrl: string;
  tags: readonly string[];
  userCreated?: boolean;
}

export interface ArtistStyleTaxonomy {
  id: string;
  label: string;
  labelZh: string;
}

export interface ArtistStyleCategory {
  id: string;
  name: string;
}

export interface ArtistStyleUserLibrary {
  categories: ArtistStyleCategory[];
  styles: ArtistStyleItem[];
}

export interface ArtistStyleSearchOptions {
  query?: string;
  movement?: string;
  category?: string;
  limit?: number;
}

export interface ArtistStyleMaterialInput {
  imageUrl: string;
  title?: string;
  prompt: string;
  negativePrompt?: string;
  categoryZh?: string;
  tags?: string[];
  sourceNodeId?: string;
}

export interface ArtistStyleOutputPayload {
  kind: 'text' | 'image';
  data: {
    directOutputText: string;
    outputText: string;
    prompt: string;
    text: string;
    directImageUrl?: string;
    imageUrl?: string;
    directImageUrls?: string[];
    imageUrls?: string[];
    lastPrompt?: string;
    artistStyleId?: string;
    artistStyleName?: string;
    artistStyleChineseName?: string;
  };
}

export interface ArtistStyleExportPack extends ArtistStyleUserLibrary {
  schema: typeof ARTIST_STYLE_MASTER_EXPORT_SCHEMA;
  exportedAt: string;
}

export const ARTIST_STYLE_MASTER_STORAGE_KEY = 't8-artist-style-master:user-library:v1';
export const ARTIST_STYLE_MASTER_EXPORT_SCHEMA = 't8-artist-style-master@1';

const COLLATOR = new Intl.Collator('zh-Hans-CN');

export function slugifyArtistStyle(value: string): string {
  const fallback = 'artist-style';
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const item = textOf(value);
    if (!item) return;
    const key = item.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function fileNameFromUrl(url: string): string {
  try {
    const parsed = url.startsWith('http') ? new URL(url) : new URL(url, 'http://local');
    return decodeURIComponent(parsed.pathname.split('/').pop() || '') || 'image-style';
  } catch {
    return url.split(/[\\/]/).pop()?.split(/[?#]/)[0] || 'image-style';
  }
}

function stripExtension(value: string): string {
  return value.replace(/\.[a-z0-9]{2,8}$/i, '').trim();
}

export function createArtistStyleFromMaterial(input: ArtistStyleMaterialInput): ArtistStyleItem {
  const imageUrl = textOf(input.imageUrl);
  const prompt = textOf(input.prompt);
  const negativePrompt = textOf(input.negativePrompt);
  const rawTitle = textOf(input.title) || fileNameFromUrl(imageUrl);
  const name = stripExtension(rawTitle) || 'material-style';
  const categoryZh = textOf(input.categoryZh) || '素材收藏';
  const category = slugifyArtistStyle(categoryZh);
  const cue = [
    prompt,
    negativePrompt ? `Negative prompt: ${negativePrompt}` : '',
  ].filter(Boolean).join('\n\n');

  return normalizeArtistStyleItem({
    id: `material-${slugifyArtistStyle(name)}-${simpleHash(`${imageUrl}\n${prompt}`)}`,
    name,
    chineseName: name,
    displayName: name,
    movement: 'User',
    movementZh: '自定义风格',
    category,
    categoryZh,
    cue,
    imageUrl,
    thumbnailUrl: imageUrl,
    tags: uniqueStrings([
      ...(Array.isArray(input.tags) ? input.tags : []),
      '素材右键',
      categoryZh,
      textOf(input.sourceNodeId),
    ]),
    sourceOrder: Date.now(),
    userCreated: true,
  });
}

export function normalizeArtistStyleItem(input: Partial<ArtistStyleItem> & { name?: string }): ArtistStyleItem {
  const name = textOf(input.name) || 'Untitled Artist Style';
  const chineseName = textOf(input.chineseName) || name;
  const movement = textOf(input.movement) || 'User';
  const movementZh = textOf(input.movementZh) || '自定义风格';
  const category = textOf(input.category) || movement;
  const categoryZh = textOf(input.categoryZh) || movementZh;
  const imageUrl = textOf(input.imageUrl);
  const id = textOf(input.id) || `${slugifyArtistStyle(name)}-${Date.now().toString(36)}`;
  const tags = uniqueStrings([
    ...(Array.isArray(input.tags) ? input.tags : []),
    name,
    chineseName,
    movement,
    movementZh,
    category,
    categoryZh,
  ]);

  return {
    id,
    name,
    chineseName,
    displayName: textOf(input.displayName) || name,
    movement,
    movementZh,
    category,
    categoryZh,
    cue: textOf(input.cue) || '综合视觉风格，用同一场景观察个人化图像语言',
    sourceOrder: Number.isFinite(input.sourceOrder) ? Number(input.sourceOrder) : 9999,
    imageUrl,
    thumbnailUrl: textOf(input.thumbnailUrl) || imageUrl,
    tags,
    userCreated: input.userCreated ?? true,
  };
}

export function normalizeArtistStyleLibrary(input: Partial<ArtistStyleUserLibrary> | null | undefined): ArtistStyleUserLibrary {
  const categories = Array.isArray(input?.categories)
    ? input.categories
        .map((item) => ({
          id: textOf(item?.id) || slugifyArtistStyle(textOf(item?.name)),
          name: textOf(item?.name) || textOf(item?.id) || '未分类',
        }))
        .filter((item) => item.id && item.name)
    : [];

  const styles = Array.isArray(input?.styles)
    ? input.styles
        .map((item) => normalizeArtistStyleItem(item))
        .filter((item) => item.name && item.imageUrl)
    : [];

  return {
    categories: dedupeCategories(categories),
    styles: dedupeStyles(styles),
  };
}

function dedupeCategories(categories: ArtistStyleCategory[]): ArtistStyleCategory[] {
  const byId = new Map<string, ArtistStyleCategory>();
  categories.forEach((category) => {
    byId.set(category.id, category);
  });
  return Array.from(byId.values()).sort((a, b) => COLLATOR.compare(a.name, b.name));
}

function dedupeStyles(styles: ArtistStyleItem[]): ArtistStyleItem[] {
  const byId = new Map<string, ArtistStyleItem>();
  styles.forEach((style) => byId.set(style.id, style));
  return Array.from(byId.values()).sort((a, b) => COLLATOR.compare(a.chineseName || a.name, b.chineseName || b.name));
}

export function searchArtistStyles(items: readonly ArtistStyleItem[], options: ArtistStyleSearchOptions = {}): ArtistStyleItem[] {
  const query = textOf(options.query).toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const movement = textOf(options.movement);
  const category = textOf(options.category);
  const limit = Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : undefined;

  const matches = items
    .filter((item) => {
      if (movement && movement !== 'all' && item.movement !== movement) return false;
      if (category && category !== 'all' && item.category !== category && item.categoryZh !== category) return false;
      if (!terms.length) return true;
      const haystack = [
        item.name,
        item.chineseName,
        item.displayName,
        item.movement,
        item.movementZh,
        item.category,
        item.categoryZh,
        item.cue,
        ...item.tags,
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => a.sourceOrder - b.sourceOrder || COLLATOR.compare(a.chineseName || a.name, b.chineseName || b.name));

  return typeof limit === 'number' ? matches.slice(0, limit) : matches;
}

const ARTIST_STYLE_REFERENCE_SUFFIX =
  'Use this as a visual style reference: composition language, line quality, color palette, lighting, texture, mood and design rhythm.';

export function buildArtistStylePrompt(item: ArtistStyleItem): string {
  const styleCue = textOf(item.cue) || textOf(item.displayName) || textOf(item.chineseName) || textOf(item.name);
  const styleName = textOf(item.chineseName) || textOf(item.displayName) || textOf(item.name);
  const leading = styleName && styleCue && styleCue !== styleName ? `${styleName}，${styleCue}` : (styleCue || styleName);
  return [leading, ARTIST_STYLE_REFERENCE_SUFFIX].filter(Boolean).join(', ');
}

export function buildArtistStyleOutputPayload(item: ArtistStyleItem, mode: ArtistStyleOutputMode): ArtistStyleOutputPayload {
  const prompt = buildArtistStylePrompt(item);
  const data: ArtistStyleOutputPayload['data'] = {
    directOutputText: prompt,
    outputText: prompt,
    prompt,
    text: prompt,
    lastPrompt: prompt,
    artistStyleId: item.id,
    artistStyleName: item.name,
    artistStyleChineseName: item.chineseName,
  };

  if (mode === 'image') {
    data.directImageUrl = item.imageUrl;
    data.imageUrl = item.imageUrl;
    data.directImageUrls = [item.imageUrl];
    data.imageUrls = [item.imageUrl];
  }

  return { kind: mode === 'image' ? 'image' : 'text', data };
}

export function createArtistStyleExport(library: ArtistStyleUserLibrary): ArtistStyleExportPack {
  const normalized = normalizeArtistStyleLibrary(library);
  return {
    schema: ARTIST_STYLE_MASTER_EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    ...normalized,
  };
}

export function importArtistStyleExport(input: unknown): ArtistStyleUserLibrary {
  const candidate = input as Partial<ArtistStyleExportPack> | null | undefined;
  if (!candidate || candidate.schema !== ARTIST_STYLE_MASTER_EXPORT_SCHEMA) {
    throw new Error('不是有效的艺术风格大师导出文件');
  }
  return normalizeArtistStyleLibrary(candidate);
}

export function mergeArtistStyleLibraries(base: ArtistStyleUserLibrary, incoming: ArtistStyleUserLibrary): ArtistStyleUserLibrary {
  return normalizeArtistStyleLibrary({
    categories: [...base.categories, ...incoming.categories],
    styles: [...base.styles, ...incoming.styles],
  });
}

export function upsertArtistStyleInLibrary(
  library: ArtistStyleUserLibrary,
  style: ArtistStyleItem,
  category?: ArtistStyleCategory,
): ArtistStyleUserLibrary {
  const categories = category ? [...library.categories, category] : library.categories;
  const styles = library.styles.map((item) => (item.id === style.id ? style : item));
  if (!styles.some((item) => item.id === style.id)) {
    styles.push(style);
  }
  return normalizeArtistStyleLibrary({ categories, styles });
}

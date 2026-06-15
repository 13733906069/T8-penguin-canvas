export type BatchProcessorKind = 'image' | 'video' | 'audio' | 'model3d';

export type BatchProcessorStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface BatchProcessorItem {
  id: string;
  kind: BatchProcessorKind;
  url: string;
  name: string;
  relativePath?: string;
  size?: number;
  mime?: string;
  status: BatchProcessorStatus;
  resultUrl?: string;
  outputName?: string;
  error?: string;
  stepsDone?: string[];
  trimInfo?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface BatchNamingSettings {
  mode: 'original' | 'rename';
  pattern: string;
  sequenceStart: number;
  indexPadding: number;
  outputFormat: 'keep' | 'png' | 'jpg' | 'webp';
}

export interface BatchProgressSummary {
  total: number;
  done: number;
  ok: number;
  fail: number;
  running: number;
  pending: number;
  percent: number;
  status: 'idle' | 'running' | 'success' | 'error';
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif|tiff?)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|mkv|avi)$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
const MODEL_3D_EXT_RE = /\.(glb|gltf|obj|fbx|stl|usdz|zip)$/i;

function trimQuery(name: string): string {
  return String(name || '').split('?')[0].split('#')[0];
}

function fileNameFromBatchUrl(url: string): string {
  try {
    const clean = trimQuery(url);
    return decodeURIComponent(clean.split('/').pop() || url);
  } catch {
    return trimQuery(url).split('/').pop() || url;
  }
}

export function classifyBatchFile(fileName: string, mime?: string): BatchProcessorKind | null {
  const name = trimQuery(fileName).trim();
  const type = String(mime || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('model/')) return 'model3d';
  if (MODEL_3D_EXT_RE.test(name)) return 'model3d';
  if (IMAGE_EXT_RE.test(name)) return 'image';
  if (VIDEO_EXT_RE.test(name)) return 'video';
  if (AUDIO_EXT_RE.test(name)) return 'audio';
  return null;
}

export function sanitizeBatchFileName(value: string, fallback = 'batch-item'): string {
  const clean = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .replace(/[._-]+$/, '');
  return clean || fallback;
}

export function splitBatchFileName(name: string): { base: string; ext: string } {
  const raw = trimQuery(name || '');
  const slashSafe = raw.split(/[\\/]/).pop() || raw || 'batch-item';
  const dot = slashSafe.lastIndexOf('.');
  if (dot <= 0 || dot === slashSafe.length - 1) {
    return { base: slashSafe || 'batch-item', ext: '' };
  }
  return {
    base: slashSafe.slice(0, dot),
    ext: slashSafe.slice(dot + 1),
  };
}

function extensionFor(item: BatchProcessorItem, settings: BatchNamingSettings): string {
  if (settings.outputFormat && settings.outputFormat !== 'keep') return settings.outputFormat;
  const fromName = splitBatchFileName(item.name || fileNameFromBatchUrl(item.url)).ext;
  if (fromName) return fromName;
  if (item.kind === 'image') return 'png';
  if (item.kind === 'video') return 'mp4';
  if (item.kind === 'audio') return 'wav';
  return 'glb';
}

function folderName(item: BatchProcessorItem): string {
  const rel = String(item.relativePath || '').replace(/\\/g, '/');
  const parts = rel.split('/').filter(Boolean);
  if (parts.length <= 1) return '';
  return sanitizeBatchFileName(parts[parts.length - 2] || '');
}

export function buildBatchOutputName(
  item: BatchProcessorItem,
  zeroBasedIndex: number,
  settings: BatchNamingSettings,
): string {
  const sourceName = item.name || fileNameFromBatchUrl(item.url);
  const parsed = splitBatchFileName(sourceName);
  const sourceBase = sanitizeBatchFileName(parsed.base, `item-${zeroBasedIndex + 1}`);
  const ext = sanitizeBatchFileName(extensionFor(item, settings).replace(/^\./, ''), 'png').toLowerCase();
  if (settings.mode === 'original') return `${sourceBase}.${ext}`;

  const index = Math.max(0, Math.trunc(settings.sequenceStart || 1) + zeroBasedIndex);
  const padded = String(index).padStart(Math.max(1, Math.min(8, Math.trunc(settings.indexPadding || 3))), '0');
  const pattern = String(settings.pattern || '{name}_{index}')
    .replace(/\{name\}/g, sourceBase)
    .replace(/\{index\}/g, padded)
    .replace(/\{n\}/g, String(index))
    .replace(/\{kind\}/g, item.kind)
    .replace(/\{folder\}/g, folderName(item));
  return `${sanitizeBatchFileName(pattern, `batch-${padded}`)}.${ext}`;
}

export function summarizeBatchProgress(items: Array<Pick<BatchProcessorItem, 'status'>>): BatchProgressSummary {
  const total = items.length;
  const ok = items.filter((item) => item.status === 'success').length;
  const fail = items.filter((item) => item.status === 'error').length;
  const running = items.filter((item) => item.status === 'running').length;
  const skipped = items.filter((item) => item.status === 'skipped').length;
  const done = ok + fail + skipped;
  const pending = items.filter((item) => item.status === 'pending').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const status: BatchProgressSummary['status'] =
    running > 0
      ? 'running'
      : total === 0
        ? 'idle'
        : fail > 0
          ? 'error'
          : done === total
            ? 'success'
            : 'idle';
  return { total, done, ok, fail, running, pending, percent, status };
}

export function createBatchItemFromUpload(input: {
  kind: BatchProcessorKind;
  url: string;
  name?: string;
  relativePath?: string;
  size?: number;
  mime?: string;
  index?: number;
}): BatchProcessorItem {
  const fallback = input.url ? fileNameFromBatchUrl(input.url) : `batch-${(input.index || 0) + 1}`;
  return {
    id: `batch-${Date.now()}-${input.index || 0}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    url: input.url,
    name: input.name || fallback,
    relativePath: input.relativePath || input.name || fallback,
    size: input.size,
    mime: input.mime,
    status: 'pending',
  };
}

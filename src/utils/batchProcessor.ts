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

export type BatchProcessorOperation = 'trim' | 'cutout' | 'expand' | 'upscale';

export const BATCH_PROCESSOR_OPERATION_FIELDS: Record<BatchProcessorOperation, string> = {
  trim: 'batchProcessorTrimBlackBars',
  cutout: 'batchProcessorRemoveBg',
  expand: 'batchProcessorExpandCanvas',
  upscale: 'batchProcessorUpscale',
};

export const BATCH_PROCESSOR_OPERATION_ORDER: BatchProcessorOperation[] = ['trim', 'cutout', 'expand', 'upscale'];

export function resolveBatchProcessorOperation(input: Record<string, unknown> = {}): BatchProcessorOperation | null {
  const explicit = input.batchProcessorOperation;
  if (typeof explicit === 'string' && (BATCH_PROCESSOR_OPERATION_ORDER as string[]).includes(explicit)) {
    return explicit as BatchProcessorOperation;
  }
  for (const operation of BATCH_PROCESSOR_OPERATION_ORDER) {
    if (Boolean(input[BATCH_PROCESSOR_OPERATION_FIELDS[operation]])) return operation;
  }
  return null;
}

export function createExclusiveBatchProcessorOperationPatch(
  operation: BatchProcessorOperation | null,
): Record<string, string | boolean> {
  return {
    batchProcessorOperation: operation || '',
    batchProcessorTrimBlackBars: operation === 'trim',
    batchProcessorRemoveBg: operation === 'cutout',
    batchProcessorExpandCanvas: operation === 'expand',
    batchProcessorUpscale: operation === 'upscale',
  };
}

export type BatchWorkPoolItemStatus = 'start' | 'retry' | 'success' | 'error' | 'cancelled';

export interface BatchWorkPoolItemEvent<T> {
  index: number;
  item: T;
  attempt: number;
  maxAttempts: number;
  status: BatchWorkPoolItemStatus;
  error?: string;
}

export interface BatchWorkPoolOptions<T, R> {
  items: T[];
  concurrency: number;
  retryCount?: number;
  retryDelayMs?: number;
  continueOnError?: boolean;
  signal?: AbortSignal;
  worker: (item: T, index: number, attempt: number) => Promise<R>;
  onItemStatus?: (event: BatchWorkPoolItemEvent<T>) => void | Promise<void>;
}

export interface BatchWorkPoolItemResult<T, R> {
  index: number;
  item: T;
  status: 'success' | 'error' | 'cancelled';
  attempts: number;
  value?: R;
  error?: string;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif|tiff?)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|mkv|avi)$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
const MODEL_3D_EXT_RE = /\.(glb|gltf|obj|fbx|stl|usdz|zip)$/i;

function formatBatchError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || '处理失败');
}

function isBatchAbort(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (error instanceof Error) return error.name === 'AbortError' || error.message === '已取消';
  return String(error || '') === '已取消';
}

function waitForBatchRetry(ms: number, signal?: AbortSignal): Promise<void> {
  const delay = Math.max(0, Math.floor(ms));
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('已取消'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('已取消'));
    };
    signal?.addEventListener('abort', onAbort);
  });
}

export function normalizeBatchConcurrency(value: unknown, fallback = 2, min = 1, max = 8): number {
  const safeMin = Math.max(1, Math.floor(min));
  const safeMax = Math.max(safeMin, Math.floor(max));
  const parsed = Number(value);
  const candidate = Number.isFinite(parsed) && parsed >= safeMin ? parsed : Number(fallback);
  const resolved = Number.isFinite(candidate) ? candidate : safeMin;
  return Math.max(safeMin, Math.min(safeMax, Math.floor(resolved)));
}

export function normalizeBatchRetrySettings(input: {
  retryCount?: unknown;
  continueOnError?: unknown;
} = {}): { retryCount: number; continueOnError: boolean } {
  const parsedRetry = Number(input.retryCount);
  return {
    retryCount: Math.max(0, Math.min(5, Number.isFinite(parsedRetry) ? Math.floor(parsedRetry) : 1)),
    continueOnError: input.continueOnError !== false,
  };
}

export async function runBatchWorkPool<T, R>(
  options: BatchWorkPoolOptions<T, R>,
): Promise<Array<BatchWorkPoolItemResult<T, R>>> {
  const items = Array.isArray(options.items) ? options.items : [];
  const concurrency = normalizeBatchConcurrency(options.concurrency, 2, 1, Math.max(1, items.length || 1));
  const { retryCount, continueOnError } = normalizeBatchRetrySettings({
    retryCount: options.retryCount,
    continueOnError: options.continueOnError,
  });
  const maxAttempts = retryCount + 1;
  const results: Array<BatchWorkPoolItemResult<T, R> | undefined> = new Array(items.length);
  let cursor = 0;
  let stopped = false;

  const emit = async (event: BatchWorkPoolItemEvent<T>) => {
    await options.onItemStatus?.(event);
  };

  const runOne = async (index: number) => {
    const item = items[index];
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (options.signal?.aborted) {
        results[index] = { index, item, status: 'cancelled', attempts: attempt - 1, error: '已取消' };
        await emit({ index, item, attempt, maxAttempts, status: 'cancelled', error: '已取消' });
        stopped = true;
        return;
      }
      await emit({ index, item, attempt, maxAttempts, status: 'start' });
      try {
        const value = await options.worker(item, index, attempt);
        results[index] = { index, item, status: 'success', attempts: attempt, value };
        await emit({ index, item, attempt, maxAttempts, status: 'success' });
        return;
      } catch (error) {
        const message = formatBatchError(error);
        if (isBatchAbort(error, options.signal)) {
          results[index] = { index, item, status: 'cancelled', attempts: attempt, error: message };
          await emit({ index, item, attempt, maxAttempts, status: 'cancelled', error: message });
          stopped = true;
          return;
        }
        if (attempt < maxAttempts) {
          await emit({ index, item, attempt, maxAttempts, status: 'retry', error: message });
          try {
            await waitForBatchRetry(options.retryDelayMs ?? 800, options.signal);
          } catch (retryError) {
            const retryMessage = formatBatchError(retryError);
            if (isBatchAbort(retryError, options.signal)) {
              results[index] = { index, item, status: 'cancelled', attempts: attempt, error: retryMessage };
              await emit({ index, item, attempt, maxAttempts, status: 'cancelled', error: retryMessage });
              stopped = true;
              return;
            }
            results[index] = { index, item, status: 'error', attempts: attempt, error: retryMessage };
            await emit({ index, item, attempt, maxAttempts, status: 'error', error: retryMessage });
            if (!continueOnError) stopped = true;
            return;
          }
          continue;
        }
        results[index] = { index, item, status: 'error', attempts: attempt, error: message };
        await emit({ index, item, attempt, maxAttempts, status: 'error', error: message });
        if (!continueOnError) stopped = true;
        return;
      }
    }
  };

  const runWorker = async () => {
    while (!stopped) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await runOne(index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, runWorker));
  for (let index = 0; index < items.length; index += 1) {
    if (!results[index]) {
      results[index] = {
        index,
        item: items[index],
        status: 'cancelled',
        attempts: 0,
        error: stopped ? '已跳过' : '未处理',
      };
    }
  }
  return results as Array<BatchWorkPoolItemResult<T, R>>;
}

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

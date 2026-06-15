import {
  buildRhToolboxCapabilityInputValues,
  resolveRhToolboxCapability,
} from '../utils/rhToolboxCapabilities';
import type { RhToolboxTool } from '../utils/rhToolbox';
import {
  getRhToolboxManifest,
  runRhToolboxTool,
  type RunRhToolboxProgress,
  type RunRhToolboxToolResult,
} from './rhToolbox';

export interface RunRhImageCapabilityOptions {
  capability: string;
  imageUrl: string;
  preferredToolId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: RunRhToolboxProgress) => void;
}

export interface RunRhImageBatchItemProgress {
  index: number;
  total: number;
  imageUrl: string;
  attempt: number;
  maxAttempts: number;
  status: 'start' | 'retry' | 'success' | 'error' | 'cancelled';
  error?: string;
}

export interface RunRhImageCapabilityBatchOptions
  extends Omit<RunRhImageCapabilityOptions, 'imageUrl'> {
  imageUrls: string[];
  retryCount?: number;
  retryDelayMs?: number;
  continueOnError?: boolean;
  onItemProgress?: (progress: RunRhImageBatchItemProgress) => void;
}

export interface RunRhImageCapabilityResult {
  tool: RhToolboxTool;
  taskId: string;
  imageUrls: string[];
  outputUrl: string;
  result: RunRhToolboxToolResult;
  raw?: any;
}

export interface RunRhImageCapabilityBatchResult {
  tool: RhToolboxTool;
  taskIds: string[];
  imageUrls: string[];
  outputUrl: string;
  results: RunRhImageCapabilityResult[];
  failedItems: Array<{
    index: number;
    imageUrl: string;
    error: string;
    attempts: number;
  }>;
  cancelled: boolean;
}

function imageOutputsFromResult(result: RunRhToolboxToolResult): string[] {
  if (result.imageUrls.length > 0) return result.imageUrls;
  return result.tool.outputSchema.some((output) => output.kind === 'image') ? result.urls : [];
}

function cleanImageUrls(imageUrls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of imageUrls) {
    const url = String(raw || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'RH 图像能力调用失败');
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (error instanceof Error) return error.name === 'AbortError' || error.message === '已取消';
  return String(error || '') === '已取消';
}

function delayBeforeRetry(ms: number, signal?: AbortSignal): Promise<void> {
  const safeMs = Math.max(0, Math.floor(ms));
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('已取消'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, safeMs);
    const onAbort = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('已取消'));
    };
    signal?.addEventListener('abort', onAbort);
  });
}

export async function runRhImageCapability(
  options: RunRhImageCapabilityOptions,
): Promise<RunRhImageCapabilityResult> {
  const manifest = getRhToolboxManifest();
  const tool = resolveRhToolboxCapability(manifest, {
    surface: 'image',
    capability: options.capability,
    preferredToolId: options.preferredToolId,
  });
  if (!tool) throw new Error(`未找到可用 RH 图像能力：${options.capability}`);

  const inputValues = buildRhToolboxCapabilityInputValues(tool, 'image', options.imageUrl);
  const result = await runRhToolboxTool({
    toolId: tool.id,
    manifest,
    inputValues,
    signal: options.signal,
    onProgress: options.onProgress,
  });
  const imageUrls = imageOutputsFromResult(result);
  if (imageUrls.length === 0) {
    throw new Error(`${tool.title} 未返回图像结果`);
  }
  return {
    tool,
    taskId: result.taskId,
    imageUrls,
    outputUrl: imageUrls[0],
    result,
    raw: result.raw,
  };
}

export async function runRhImageCapabilityBatch(
  options: RunRhImageCapabilityBatchOptions,
): Promise<RunRhImageCapabilityBatchResult> {
  const cleanUrls = cleanImageUrls(options.imageUrls);
  if (cleanUrls.length === 0) throw new Error('缺少要处理的图像素材');

  const retryCount = Math.max(0, Math.floor(options.retryCount ?? 2));
  const retryDelayMs = options.retryDelayMs ?? 1200;
  const maxAttempts = retryCount + 1;
  const continueOnError = options.continueOnError ?? true;
  const results: RunRhImageCapabilityResult[] = [];
  const failedItems: RunRhImageCapabilityBatchResult['failedItems'] = [];
  const imageUrls: string[] = [];
  let cancelled = false;

  for (let index = 0; index < cleanUrls.length && !cancelled; index += 1) {
    const imageUrl = cleanUrls[index];
    let itemDone = false;

    for (let attempt = 1; attempt <= maxAttempts && !itemDone; attempt += 1) {
      if (options.signal?.aborted) {
        cancelled = true;
        options.onItemProgress?.({ index, total: cleanUrls.length, imageUrl, attempt, maxAttempts, status: 'cancelled' });
        break;
      }

      options.onItemProgress?.({ index, total: cleanUrls.length, imageUrl, attempt, maxAttempts, status: 'start' });
      try {
        const result = await runRhImageCapability({
          capability: options.capability,
          imageUrl,
          preferredToolId: options.preferredToolId,
          signal: options.signal,
          onProgress: (progress) => {
            const attemptText = maxAttempts > 1 ? ` · 尝试 ${attempt}/${maxAttempts}` : '';
            options.onProgress?.({
              ...progress,
              message: `第 ${index + 1}/${cleanUrls.length} 张${attemptText} · ${progress.message}`,
            });
          },
        });
        results.push(result);
        imageUrls.push(...result.imageUrls);
        options.onItemProgress?.({ index, total: cleanUrls.length, imageUrl, attempt, maxAttempts, status: 'success' });
        itemDone = true;
      } catch (error) {
        const message = formatError(error);
        if (isAbortError(error, options.signal)) {
          cancelled = true;
          options.onItemProgress?.({ index, total: cleanUrls.length, imageUrl, attempt, maxAttempts, status: 'cancelled', error: message });
          break;
        }

        const hasRetryLeft = attempt < maxAttempts;
        if (hasRetryLeft) {
          options.onItemProgress?.({ index, total: cleanUrls.length, imageUrl, attempt, maxAttempts, status: 'retry', error: message });
          options.onProgress?.({
            stage: 'error',
            message: `第 ${index + 1}/${cleanUrls.length} 张失败，${Math.max(0, maxAttempts - attempt)} 次重试剩余：${message}`,
          });
          try {
            await delayBeforeRetry(retryDelayMs, options.signal);
          } catch (retryError) {
            if (isAbortError(retryError, options.signal)) {
              cancelled = true;
              options.onItemProgress?.({
                index,
                total: cleanUrls.length,
                imageUrl,
                attempt,
                maxAttempts,
                status: 'cancelled',
                error: formatError(retryError),
              });
              break;
            }
            throw retryError;
          }
          continue;
        }

        failedItems.push({ index, imageUrl, error: message, attempts: attempt });
        options.onItemProgress?.({ index, total: cleanUrls.length, imageUrl, attempt, maxAttempts, status: 'error', error: message });
        if (!continueOnError) {
          throw error;
        }
      }
    }
  }

  if (results.length === 0 || imageUrls.length === 0) {
    if (cancelled) throw new Error('已取消');
    if (failedItems.length > 0) {
      throw new Error(`RH 图像批处理全部失败：${failedItems[0].error}`);
    }
    throw new Error('RH 图像批处理未返回图像结果');
  }
  return {
    tool: results[0].tool,
    taskIds: results.map((result) => result.taskId),
    imageUrls,
    outputUrl: imageUrls[0],
    results,
    failedItems,
    cancelled,
  };
}

export function runRhImageCutout(
  imageUrl: string,
  options: Omit<RunRhImageCapabilityOptions, 'capability' | 'imageUrl' | 'preferredToolId'> = {},
): Promise<RunRhImageCapabilityResult> {
  return runRhImageCapability({
    ...options,
    capability: 'image.cutout',
    imageUrl,
    preferredToolId: 'image-cutout-v1',
  });
}

export function runRhImageCutoutBatch(
  imageUrls: string[],
  options: Omit<RunRhImageCapabilityBatchOptions, 'capability' | 'imageUrls' | 'preferredToolId'> = {},
): Promise<RunRhImageCapabilityBatchResult> {
  return runRhImageCapabilityBatch({
    ...options,
    capability: 'image.cutout',
    imageUrls,
    preferredToolId: 'image-cutout-v1',
  });
}

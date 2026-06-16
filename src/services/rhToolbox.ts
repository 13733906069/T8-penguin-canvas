import { cancelRh, fetchRhAppInfo, queryRh, submitRh, uploadRhAsset } from './generation';
import { RH_TOOLBOX_MANIFEST } from '../data/rhToolboxManifest';
import {
  buildRhToolboxNodeInfoList,
  classifyRhToolboxOutputs,
  findRhToolboxToolById,
  normalizeRhToolboxManifest,
  pickRhToolboxInputs,
  RH_TOOLBOX_DEFAULT_MAX_POLLS,
  RH_TOOLBOX_DEFAULT_POLL_INTERVAL_MS,
  type RhToolboxInputPools,
  type RhToolboxManifest,
  type RhToolboxNodeInfoItem,
  type RhToolboxOutputClassification,
  type RhToolboxTool,
} from '../utils/rhToolbox';

export type RhToolboxProgressStage =
  | 'prepare'
  | 'app-info'
  | 'upload'
  | 'submit'
  | 'poll'
  | 'cancel'
  | 'success'
  | 'error';

export interface RunRhToolboxProgress {
  stage: RhToolboxProgressStage;
  message: string;
  taskId?: string;
  pollCount?: number;
}

export interface RunRhToolboxToolOptions {
  toolId: string;
  manifest?: RhToolboxManifest;
  inputs?: RhToolboxInputPools;
  inputValues?: Record<string, string | string[]>;
  userParams?: Record<string, string | number | boolean>;
  instanceType?: string;
  appInfo?: any;
  signal?: AbortSignal;
  onProgress?: (progress: RunRhToolboxProgress) => void;
}

export interface RunRhToolboxToolResult extends RhToolboxOutputClassification {
  tool: RhToolboxTool;
  taskId: string;
  nodeInfoList: RhToolboxNodeInfoItem[];
  appInfo?: any;
  raw?: any;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('已取消'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('已取消'));
    };
    signal?.addEventListener('abort', onAbort);
  });
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('已取消');
}

function isMediaInputKind(kind: string): boolean {
  return kind === 'image' || kind === 'video' || kind === 'audio';
}

function hasInputValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasInputValue(item));
  return String(value ?? '').trim() !== '';
}

async function resolveRhToolboxInputValues(
  tool: RhToolboxTool,
  rawValues: Record<string, string | string[]>,
  onProgress?: (progress: RunRhToolboxProgress) => void,
  signal?: AbortSignal,
): Promise<Record<string, string | string[]>> {
  const resolved: Record<string, string | string[]> = {};
  for (const input of tool.inputSchema) {
    assertNotAborted(signal);
    const raw = rawValues[input.key];
    if (raw == null || raw === '') continue;
    const values = Array.isArray(raw) ? raw : [raw];
    const next: string[] = [];
    for (const value of values) {
      const v = String(value || '').trim();
      if (!v) continue;
      if (isMediaInputKind(input.kind) && input.uploadAsset !== false) {
        onProgress?.({ stage: 'upload', message: `上传 ${input.label || input.key}` });
        const uploaded = await uploadRhAsset(v);
        next.push(uploaded.fileName || v);
      } else {
        next.push(v);
      }
    }
    if (next.length > 0) {
      resolved[input.key] = input.multiple ? next : next[0];
    }
  }
  return resolved;
}

function normalizeFailedReason(reason: any, fallback = 'RH 工具箱任务失败'): string {
  if (reason == null || reason === '') return fallback;
  if (typeof reason === 'string') return reason;
  try {
    return reason.exception_message || reason.message || JSON.stringify(reason);
  } catch {
    return fallback;
  }
}

async function cancelSubmittedRhTask(
  taskId: string,
  progress?: (progress: RunRhToolboxProgress) => void,
): Promise<void> {
  if (!taskId) return;
  progress?.({ stage: 'cancel', message: '取消 RH 后台任务', taskId });
  try {
    await cancelRh(taskId);
    progress?.({ stage: 'cancel', message: '已请求取消 RH 后台任务', taskId });
  } catch (error: any) {
    const message = `取消 RH 后台任务失败：${error?.message || error}`;
    progress?.({
      stage: 'error',
      message,
      taskId,
    });
    throw new Error(message);
  }
}

export function getRhToolboxManifest(): RhToolboxManifest {
  return normalizeRhToolboxManifest(RH_TOOLBOX_MANIFEST);
}

export async function runRhToolboxTool(options: RunRhToolboxToolOptions): Promise<RunRhToolboxToolResult> {
  const manifest = normalizeRhToolboxManifest(options.manifest || RH_TOOLBOX_MANIFEST);
  const tool = findRhToolboxToolById(manifest, options.toolId);
  if (!tool) throw new Error('RH工具箱未找到可用工具');
  if (!tool.enabled || !tool.webappId) throw new Error('该 RH工具箱工具尚未启用');

  const progress = options.onProgress;
  progress?.({ stage: 'prepare', message: `准备运行 ${tool.title}` });

  const picked = pickRhToolboxInputs(tool, options.inputs || {});
  const explicitInputValues = options.inputValues || {};
  const missing = tool.inputSchema
    .filter((input) => input.required !== false)
    .filter((input) => !hasInputValue(picked.values[input.key]) && !hasInputValue(explicitInputValues[input.key]) && !hasInputValue(input.defaultValue))
    .map((input) => input.label || input.key);
  if (missing.length > 0) {
    throw new Error(`缺少输入：${missing.join('、')}（可在节点内填写/上传，或从左侧连接上游素材）`);
  }

  assertNotAborted(options.signal);
  const appInfo = options.appInfo || (tool.runtime?.fetchAppInfo === false
    ? undefined
    : await (async () => {
        progress?.({ stage: 'app-info', message: '读取 RH 应用字段' });
        return fetchRhAppInfo(tool.webappId);
      })());

  const inputValues = await resolveRhToolboxInputValues(tool, {
    ...picked.values,
    ...explicitInputValues,
  }, progress, options.signal);
  const nodeInfoList = buildRhToolboxNodeInfoList(tool, {
    inputValues,
    userParamValues: options.userParams,
  });

  let taskId = '';
  let remoteTaskCompleted = false;
  let remoteCancelRequested = false;
  const cancelTaskIfNeeded = async () => {
    if (!taskId || remoteTaskCompleted || remoteCancelRequested) return;
    remoteCancelRequested = true;
    await cancelSubmittedRhTask(taskId, progress);
  };
  try {
    progress?.({ stage: 'submit', message: '提交 RH 任务' });
    const submitResult = await submitRh({
      webappId: tool.webappId,
      nodeInfoList,
      instanceType: options.instanceType || tool.runtime?.instanceType || undefined,
    });
    taskId = submitResult.taskId;
    if (!taskId) throw new Error('RH 未返回 taskId');
    progress?.({ stage: 'submit', message: '已提交 RH 任务', taskId });
    if (options.signal?.aborted) {
      await cancelTaskIfNeeded();
      throw new Error('已取消');
    }

    const pollIntervalMs = Math.max(1000, tool.runtime?.pollIntervalMs || RH_TOOLBOX_DEFAULT_POLL_INTERVAL_MS);
    const maxPolls = Math.max(1, tool.runtime?.maxPolls || RH_TOOLBOX_DEFAULT_MAX_POLLS);
    let lastRaw: any;
    let lastError = '';

    for (let pollCount = 1; pollCount <= maxPolls; pollCount += 1) {
      assertNotAborted(options.signal);
      progress?.({ stage: 'poll', message: `轮询中 ${pollCount}/${maxPolls}`, taskId, pollCount });
      await delay(pollIntervalMs, options.signal);
      try {
        const query = await queryRh(taskId);
        lastRaw = query;
        if (query.status === 'SUCCESS') {
          remoteTaskCompleted = true;
          const classified = classifyRhToolboxOutputs(query.urls || []);
          progress?.({ stage: 'success', message: `完成 · ${classified.urls.length} 个输出`, taskId, pollCount });
          return {
            ...classified,
            tool,
            taskId,
            nodeInfoList,
            appInfo,
            raw: query,
          };
        }
        if (query.status === 'FAILED') {
          remoteTaskCompleted = true;
          throw new Error(normalizeFailedReason(query.failReason));
        }
      } catch (error: any) {
        lastError = error?.message || String(error);
        if (lastRaw?.status === 'FAILED') break;
      }
    }

    progress?.({ stage: 'error', message: lastError || 'RH 工具箱轮询超时', taskId });
    if (!remoteTaskCompleted) await cancelTaskIfNeeded();
    throw new Error(lastError || 'RH 工具箱轮询超时');
  } catch (error) {
    if (options.signal?.aborted && taskId && !remoteTaskCompleted) {
      await cancelTaskIfNeeded();
    }
    throw error;
  }
}

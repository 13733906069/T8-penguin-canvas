import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Film, Loader2, Sparkles, Zap } from 'lucide-react';
import { cancelRh } from '../services/generation';
import { probeVideo, snapshotVideoFrameAsync } from '../services/videoOps';
import {
  runRhVideoCapabilityBatch,
  type RunRhVideoCapabilityBatchResult,
} from '../services/rhToolboxCapabilities';
import { logBus } from '../stores/logs';
import {
  RH_VIDEO_NODE_CAPABILITY_PRESETS,
  resolveRhVideoCapabilityPreset,
  type RhVideoCapabilityPresetId,
} from '../utils/rhToolboxCapabilities';
import { fileNameFromUrl, type MediaItem } from '../utils/mediaCollection';
import type { VideoEditClip } from '../utils/videoEdit';

interface RhVideoCapabilityRailProps {
  sourceItems?: MediaItem[];
  sourceUrls?: string[];
  accent: string;
  isDark: boolean;
  isPixel?: boolean;
  presets?: RhVideoCapabilityPresetId[];
  onFramesComplete: (imageUrls: string[]) => void;
  onVideosComplete: (result: RunRhVideoCapabilityBatchResult) => void;
  onError?: (message: string) => void;
  onRunningChange?: (running: boolean) => void;
  style?: CSSProperties;
}

type VideoRailActionId = 'frames' | RhVideoCapabilityPresetId;

const RAIL_BUTTON_SIZE = 42;

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error || '视频能力处理失败');
};

function normalizeVideoItems(sourceItems?: MediaItem[], sourceUrls?: string[]): MediaItem[] {
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  const push = (item: MediaItem) => {
    const url = String(item.url || '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({
      kind: 'video',
      url,
      name: item.name || fileNameFromUrl(url),
      size: item.size,
      mime: item.mime,
    });
  };
  (sourceItems || []).forEach((item) => {
    if (item?.kind === 'video') push(item);
  });
  (sourceUrls || []).forEach((url) => push({ kind: 'video', url, name: fileNameFromUrl(url) }));
  return out;
}

function makeClip(item: MediaItem, index: number, probe: Awaited<ReturnType<typeof probeVideo>>): VideoEditClip {
  const duration = Number.isFinite(Number(probe.duration)) && Number(probe.duration) > 0
    ? Number(probe.duration)
    : undefined;
  const name = item.name || fileNameFromUrl(item.url) || `video-${index + 1}`;
  return {
    id: `rh-video-capability-${Date.now()}-${index}`,
    sourceLabel: name,
    name,
    url: item.url,
    directUrl: item.url,
    mime: probe.mime || item.mime,
    duration,
    width: probe.width,
    height: probe.height,
    size: probe.size || item.size,
    thumbnailUrl: probe.thumbnailUrl,
    hasAudio: probe.hasAudio,
    trimStart: 0,
    trimEnd: duration,
    status: 'ready',
  };
}

export default function RhVideoCapabilityRail({
  sourceItems,
  sourceUrls,
  accent,
  isDark,
  isPixel = false,
  presets = RH_VIDEO_NODE_CAPABILITY_PRESETS,
  onFramesComplete,
  onVideosComplete,
  onError,
  onRunningChange,
  style,
}: RhVideoCapabilityRailProps) {
  const [runningActionId, setRunningActionId] = useState<VideoRailActionId | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const activeTaskIdsRef = useRef<Set<string>>(new Set());
  const lastPollLogRef = useRef(0);
  const cleanSourceItems = useMemo(() => normalizeVideoItems(sourceItems, sourceUrls), [sourceItems, sourceUrls]);
  const cleanVideoUrls = useMemo(() => cleanSourceItems.map((item) => item.url), [cleanSourceItems]);

  useEffect(() => {
    onRunningChange?.(runningActionId !== null);
  }, [onRunningChange, runningActionId]);

  const cancelActiveRunningHubTasks = async (label: string) => {
    const taskIds = Array.from(activeTaskIdsRef.current);
    if (taskIds.length === 0) return false;
    const results = await Promise.allSettled(taskIds.map((taskId) => cancelRh(taskId)));
    const failed: string[] = [];
    for (let i = 0; i < taskIds.length; i += 1) {
      const taskId = taskIds[i];
      const result = results[i];
      if (result.status === 'fulfilled') {
        logBus.success(`${label}: 已请求取消 RH 后台任务 taskId=${taskId}`, `rh-video:${label}`);
      } else {
        const reason = result.reason?.message || result.reason;
        failed.push(`${taskId}: ${reason}`);
        logBus.error(`${label}: 取消 RH 后台任务失败 taskId=${taskId} · ${reason}`, `rh-video:${label}`);
      }
    }
    if (failed.length > 0) throw new Error(failed.join('；'));
    return true;
  };

  useEffect(() => () => {
    abortRef.current?.abort();
    void cancelActiveRunningHubTasks('视频能力').catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logProgress = (
    label: string,
    progress: { stage?: string; message?: string; taskId?: string; pollCount?: number },
  ) => {
    const text = String(progress.message || '').trim();
    if (!text) return;
    const taskText = progress.taskId ? ` · taskId=${progress.taskId}` : '';
    if (progress.stage === 'poll') {
      const pollCount = Number(progress.pollCount || 0);
      if (pollCount > 1 && pollCount % 12 !== 0) return;
      if (pollCount && pollCount === lastPollLogRef.current) return;
      if (pollCount) lastPollLogRef.current = pollCount;
      logBus.debug(`${label}: ${text}${taskText}`, `rh-video:${label}`);
      return;
    }
    if (progress.stage === 'success') {
      logBus.success(`${label}: ${text}${taskText}`, `rh-video:${label}`);
      return;
    }
    if (progress.stage === 'error') {
      logBus.error(`${label}: ${text}${taskText}`, `rh-video:${label}`);
      return;
    }
    logBus.info(`${label}: ${text}${taskText}`, `rh-video:${label}`);
  };

  const runFrameExtraction = async (controller: AbortController) => {
    const imageUrls: string[] = [];
    logBus.info(`首尾帧获取: 开始处理 ${cleanSourceItems.length} 个视频`, 'rh-video:frames');
    for (let index = 0; index < cleanSourceItems.length; index += 1) {
      if (controller.signal.aborted) throw new Error('已取消');
      const item = cleanSourceItems[index];
      const probe = await probeVideo(item.url);
      if (controller.signal.aborted) throw new Error('已取消');
      const clip = makeClip(item, index, probe);
      const duration = Number(clip.duration || probe.duration || 0);
      const lastTime = duration > 0.12 ? Math.max(0, duration - 0.05) : Math.max(0, duration);
      setMessage(`首尾帧获取 ${index + 1}/${cleanSourceItems.length}`);
      const first = await snapshotVideoFrameAsync(clip, 0, {
        format: 'png',
        sourceLabel: `${clip.name} 首帧`,
      });
      if (controller.signal.aborted) throw new Error('已取消');
      const last = await snapshotVideoFrameAsync(clip, lastTime, {
        format: 'png',
        sourceLabel: `${clip.name} 尾帧`,
      });
      if (controller.signal.aborted) throw new Error('已取消');
      imageUrls.push(first.imageUrl, last.imageUrl);
    }
    if (imageUrls.length === 0) throw new Error('首尾帧获取未返回图片');
    onFramesComplete(imageUrls);
    setMessage(`已输出 ${imageUrls.length} 张首尾帧`);
    logBus.success(`首尾帧获取: 已输出 ${imageUrls.length} 张图片`, 'rh-video:frames');
  };

  const runRhUpscale = async (presetId: RhVideoCapabilityPresetId, controller: AbortController) => {
    const preset = resolveRhVideoCapabilityPreset(presetId);
    activeTaskIdsRef.current.clear();
    lastPollLogRef.current = 0;
    logBus.info(
      `${preset.label}: 开始处理 ${cleanVideoUrls.length} 个视频${preset.preferredToolId ? ` · tool=${preset.preferredToolId}` : ''}`,
      `rh-video:${preset.shortLabel || preset.label}`,
    );
    setMessage(cleanVideoUrls.length > 1 ? `准备批量${preset.label} 1/${cleanVideoUrls.length}` : `提交 RH ${preset.label}`);
    const result = await runRhVideoCapabilityBatch({
      capability: preset.capability,
      preferredToolId: preset.preferredToolId,
      videoUrls: cleanVideoUrls,
      signal: controller.signal,
      retryCount: 2,
      retryDelayMs: 1200,
      continueOnError: true,
      onProgress: (progress) => {
        if (progress.taskId) activeTaskIdsRef.current.add(progress.taskId);
        setMessage(progress.message);
        logProgress(preset.label, progress);
      },
      onItemProgress: ({ index, total, attempt, maxAttempts, status, error: itemError }) => {
        const retryText = maxAttempts > 1 ? ` · 第 ${attempt}/${maxAttempts} 次` : '';
        if (status === 'retry') {
          setMessage(`第 ${index + 1}/${total} 个视频重试中${retryText}`);
          logBus.warn(`${preset.label}: 第 ${index + 1}/${total} 个视频失败后重试${retryText} · ${itemError || '未知错误'}`, `rh-video:${preset.label}`);
        } else if (status === 'error') {
          setMessage(`第 ${index + 1}/${total} 个视频失败：${itemError || '未知错误'}`);
          logBus.error(`${preset.label}: 第 ${index + 1}/${total} 个视频失败 · ${itemError || '未知错误'}`, `rh-video:${preset.label}`);
        } else if (status === 'success') {
          setMessage(`第 ${index + 1}/${total} 个视频完成`);
          logBus.success(`${preset.label}: 第 ${index + 1}/${total} 个视频完成`, `rh-video:${preset.label}`);
        } else {
          setMessage(`准备第 ${index + 1}/${total} 个视频${retryText}`);
        }
      },
    });
    onVideosComplete(result);
    if (result.failedItems.length > 0) {
      const warning = `${result.failedItems.length} 个视频失败，已输出 ${result.videoUrls.length} 个结果`;
      setError(warning);
      setMessage(warning);
      onError?.(warning);
      logBus.warn(`${preset.label}: ${warning}`, `rh-video:${preset.label}`);
    } else {
      setMessage(result.videoUrls.length > 1 ? `已输出 ${result.videoUrls.length} 个视频` : '已输出');
      logBus.success(
        `${preset.label}: 已输出 ${result.videoUrls.length} 个视频${result.taskIds.length ? ` · taskId=${result.taskIds.join(',')}` : ''}`,
        `rh-video:${preset.label}`,
      );
    }
  };

  const cancelRunning = async (label: string) => {
    if (activeTaskIdsRef.current.size > 0) {
      setMessage('正在请求取消 RH 后台任务...');
      await cancelActiveRunningHubTasks(label);
    } else {
      setMessage('已请求取消');
    }
    abortRef.current?.abort();
  };

  const runAction = async (actionId: VideoRailActionId, e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (runningActionId) {
      const label = runningActionId === 'frames'
        ? '首尾帧获取'
        : resolveRhVideoCapabilityPreset(runningActionId).label;
      try {
        await cancelRunning(label);
      } catch (cancelError) {
        const nextError = `取消失败：${formatError(cancelError)}`;
        setError(nextError);
        setMessage(nextError);
        onError?.(nextError);
      }
      return;
    }
    if (cleanSourceItems.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    activeTaskIdsRef.current.clear();
    setRunningActionId(actionId);
    setError('');
    onRunningChange?.(true);
    try {
      if (actionId === 'frames') {
        await runFrameExtraction(controller);
      } else {
        await runRhUpscale(actionId, controller);
      }
    } catch (err) {
      const nextError = formatError(err);
      if (controller.signal.aborted) {
        setMessage('已取消');
        logBus.warn(`${actionId === 'frames' ? '首尾帧获取' : resolveRhVideoCapabilityPreset(actionId).label}: 已取消`, 'rh-video');
        return;
      }
      setError(nextError);
      setMessage(nextError);
      logBus.error(`${actionId === 'frames' ? '首尾帧获取' : resolveRhVideoCapabilityPreset(actionId).label}: ${nextError}`, 'rh-video');
      onError?.(nextError);
    } finally {
      abortRef.current = null;
      activeTaskIdsRef.current.clear();
      setRunningActionId(null);
      onRunningChange?.(false);
    }
  };

  const actionDefs = useMemo(() => [
    {
      id: 'frames' as const,
      label: '首尾帧获取',
      shortLabel: '首尾',
      title: '获取视频首帧和尾帧，并输出为图片素材节点',
      Icon: Film,
    },
    ...presets.map((presetId) => {
      const preset = resolveRhVideoCapabilityPreset(presetId);
      return {
        id: preset.id as RhVideoCapabilityPresetId,
        label: preset.label,
        shortLabel: preset.shortLabel || preset.label,
        title: preset.title,
        Icon: preset.icon === 'sparkles' ? Sparkles : Zap,
      };
    }),
  ], [presets]);

  if (actionDefs.length === 0) return null;

  return (
    <div
      className="nodrag nopan rh-video-capability-rail"
      data-rh-video-capability-rail
      data-rh-video-capability-labels="首尾帧获取,极速超分,质量超分"
      data-rh-video-capability-count={actionDefs.length}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 44,
        left: -50,
        zIndex: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 'calc(100% - 58px)',
        overflowX: 'visible',
        overflowY: 'auto',
        padding: '2px',
        scrollbarWidth: 'thin',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {actionDefs.map(({ id, label, shortLabel, title, Icon }) => {
        const running = runningActionId === id;
        const busy = Boolean(runningActionId);
        return (
          <button
            key={id}
            type="button"
            className="nodrag nopan rh-video-capability-button rh-video-capability-button--rail"
            aria-label={running ? `取消 ${label}` : label}
            data-rh-video-capability={id}
            data-rh-running={running ? 'true' : 'false'}
            onClick={(e) => runAction(id, e)}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={cleanSourceItems.length === 0 || (busy && !running)}
            title={error || message || (running ? '处理中，点击取消' : title)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 1,
              padding: '4px 2px',
              width: RAIL_BUTTON_SIZE,
              minWidth: RAIL_BUTTON_SIZE,
              height: RAIL_BUTTON_SIZE,
              background: isDark ? 'rgba(28,28,32,0.92)' : 'rgba(255,255,255,0.95)',
              color: accent,
              border: `1px solid ${accent}66`,
              borderRadius: isPixel ? 0 : 6,
              boxShadow: isPixel
                ? `2px 2px 0 ${accent}`
                : isDark
                  ? '0 6px 24px rgba(0,0,0,0.4)'
                  : '0 6px 24px rgba(0,0,0,0.12)',
              cursor: cleanSourceItems.length === 0 || (busy && !running) ? 'not-allowed' : 'pointer',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              opacity: cleanSourceItems.length === 0 || (busy && !running) ? 0.5 : running ? 0.84 : 1,
            }}
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            <span
              style={{
                display: 'block',
                maxWidth: RAIL_BUTTON_SIZE - 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {running ? '停' : shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

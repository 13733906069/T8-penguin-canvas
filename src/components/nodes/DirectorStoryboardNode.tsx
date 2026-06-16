import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  AlertCircle,
  Clapperboard,
  Copy,
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Video as VideoIcon,
  Wand2,
  X,
} from 'lucide-react';
import {
  querySeedance,
  submitSeedance,
  uploadFile,
} from '../../services/generation';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useMaterialDropTarget } from '../../hooks/useMaterialDropTarget';
import { useThemeStore } from '../../stores/theme';
import { logBus } from '../../stores/logs';
import { taskCompletionSound } from '../../stores/taskCompletionSound';
import { useDragMaterialStore, type MaterialPayload } from '../../stores/dragMaterial';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';
import MentionPromptInput from './MentionPromptInput';
import SmartImage from '../SmartImage';
import LoopingVideo from '../LoopingVideo';
import {
  buildDirectorStoryboardRunPlan,
  calculateDirectorTimelineDragDuration,
  DIRECTOR_STORYBOARD_MAX_DURATION_SEC,
  DIRECTOR_STORYBOARD_MIN_DURATION_SEC,
  runDirectorStoryboardJobs,
  sanitizeDirectorStoryboardShots,
  type DirectorStoryboardJob,
  type DirectorStoryboardJobResult,
  type DirectorStoryboardMentionMaterial,
  type DirectorStoryboardShot,
} from '../../utils/directorStoryboard';
import { materialMentionKey, type MediaMention } from './mediaMentions';

const MODEL_OPTIONS = [
  { value: 'doubao-seedance-2-0-fast-260128', label: 'seedance-2-0-fast' },
  { value: 'doubao-seedance-2-0-260128', label: 'seedance-2-0' },
];
const RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21', 'adaptive'];
const RESOLUTION_OPTIONS = ['480p', '720p', 'native1080p', '1080p', '2k', '4k'];
const FRAME_MODE_OPTIONS = [
  { value: 'auto', label: '多参考图' },
  { value: 'first', label: '首帧' },
  { value: 'firstlast', label: '首尾帧' },
  { value: 'multiframe', label: '智能多帧' },
];
const MIN_DURATION = DIRECTOR_STORYBOARD_MIN_DURATION_SEC;
const MAX_DURATION = DIRECTOR_STORYBOARD_MAX_DURATION_SEC;

type JobUiResult = {
  status?: DirectorStoryboardJobResult['status'] | 'submitting' | 'polling';
  kind?: DirectorStoryboardJob['kind'];
  title?: string;
  shotId?: string;
  taskId?: string | null;
  videoUrl?: string | null;
  error?: string | null;
  progress?: string;
};

type ResultsMap = Record<string, JobUiResult>;

type DurationResizeState = {
  shotId: string;
  baseShots: DirectorStoryboardShot[];
  startClientX: number;
  startDurationSec: number;
  timelineWidthPx: number;
  totalDurationSec: number;
};

function clampDuration(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(n)));
}

function fileName(url: string): string {
  try {
    return decodeURIComponent((url.split('?')[0].split('/').pop() || url).slice(0, 42));
  } catch {
    return (url.split('?')[0].split('/').pop() || url).slice(0, 42);
  }
}

function dedupe(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = String(value || '').trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

function localMaterialsForShot(shot: DirectorStoryboardShot, nodeId: string): Material[] {
  return [
    ...shot.localRefImages.map((url, index) => ({
      id: `${shot.id}:local-image:${index}:${url}`,
      kind: 'image' as const,
      url,
      sourceNodeId: nodeId,
      origin: 'local' as const,
      label: `${shot.title} 图${index + 1}`,
    })),
    ...shot.localRefVideos.map((url, index) => ({
      id: `${shot.id}:local-video:${index}:${url}`,
      kind: 'video' as const,
      url,
      sourceNodeId: nodeId,
      origin: 'local' as const,
      label: `${shot.title} 视频${index + 1}`,
    })),
    ...shot.localRefAudios.map((url, index) => ({
      id: `${shot.id}:local-audio:${index}:${url}`,
      kind: 'audio' as const,
      url,
      sourceNodeId: nodeId,
      origin: 'local' as const,
      label: `${shot.title} 音频${index + 1}`,
    })),
  ];
}

function toMentionMaterials(materials: Material[]): DirectorStoryboardMentionMaterial[] {
  return materials.map((material) => ({
    kind: material.kind,
    url: material.url,
    label: material.label,
    mentionKey: materialMentionKey(material),
  }));
}

function buildOutputSummary(shots: DirectorStoryboardShot[], results: ResultsMap): string {
  const lines = ['导演分镜台输出'];
  shots.forEach((shot, index) => {
    const shotResult = results[`shot-${shot.id}`];
    const suffix = shotResult?.videoUrl ? ` -> ${shotResult.videoUrl}` : shotResult?.error ? ` -> 失败: ${shotResult.error}` : '';
    lines.push(`${index + 1}. ${shot.title} · ${shot.durationSec}s · ${shot.prompt || '未填写提示词'}${suffix}`);
  });
  return lines.join('\n');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('用户已停止'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new Error('用户已停止'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const DirectorStoryboardNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const hasAutoOutput = useHasAutoOutput(id);
  const { theme, style: themeStyle } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = themeStyle === 'pixel';
  const d = (data as any) || {};
  const src = `director:${id.slice(0, 6)}`;

  const shots = useMemo(
    () => sanitizeDirectorStoryboardShots(Array.isArray(d.shots) ? d.shots : []),
    [d.shots],
  );
  const [activeShotId, setActiveShotId] = useState(() => shots[0]?.id || 'shot-1');
  const activeShot = shots.find((shot) => shot.id === activeShotId) || shots[0];
  const results: ResultsMap = d.shotResults && typeof d.shotResults === 'object' ? d.shotResults : {};
  const status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' | 'cancelled' = d.status || 'idle';
  const isBusy = status === 'submitting' || status === 'polling';
  const model = String(d.model || MODEL_OPTIONS[0].value);
  const ratio = String(d.ratio || '16:9');
  const resolution = String(d.resolution || '480p');
  const generateAudio = d.generateAudio !== false;
  const returnLastFrame = d.returnLastFrame === true;
  const watermark = d.watermark === true;
  const webSearch = d.webSearch === true;
  const seed = typeof d.seed === 'number' ? d.seed : -1;
  const bridgeEnabled = d.bridgeEnabled === true;
  const bridgeDurationSec = clampDuration(d.bridgeDurationSec || 4);
  const bridgePrompt = String(d.bridgePrompt || '');
  const pollInt = Math.max(2, Math.min(60, Number(d.pollInt || 10)));
  const maxPoll = Math.max(10, Math.min(3600, Number(d.maxPoll || 360)));
  const latestVideoUrl = typeof d.videoUrl === 'string' ? d.videoUrl : '';
  const completedVideoUrls: string[] = Array.isArray(d.videoUrls) ? d.videoUrls : [];

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<ResultsMap>(results);
  const videosRef = useRef<string[]>(completedVideoUrls);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const durationResizeActiveRef = useRef(false);
  const durationResizeStateRef = useRef<DurationResizeState | null>(null);
  const durationResizeCleanupRef = useRef<(() => void) | null>(null);
  const uploadImageRef = useRef<HTMLInputElement | null>(null);
  const uploadVideoRef = useRef<HTMLInputElement | null>(null);
  const uploadAudioRef = useRef<HTMLInputElement | null>(null);
  const startDrag = useDragMaterialStore((state) => state.start);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    videosRef.current = completedVideoUrls;
  }, [completedVideoUrls]);

  useEffect(() => {
    if (!shots.some((shot) => shot.id === activeShotId)) {
      setActiveShotId(shots[0]?.id || 'shot-1');
    }
  }, [activeShotId, shots]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const upstream = useUpstreamMaterials(id);
  const allUpstreamMaterials = useMemo(
    () => [...upstream.texts, ...upstream.images, ...upstream.videos, ...upstream.audios],
    [upstream.texts, upstream.images, upstream.videos, upstream.audios],
  );
  const activeLocalMaterials = useMemo(
    () => (activeShot ? localMaterialsForShot(activeShot, id) : []),
    [activeShot, id],
  );
  const mentionMaterials = useMemo(
    () => [...allUpstreamMaterials, ...activeLocalMaterials],
    [allUpstreamMaterials, activeLocalMaterials],
  );
  const storyboardMentionMaterials = useMemo(() => {
    const localForAllShots = shots.flatMap((shot) => localMaterialsForShot(shot, id));
    return toMentionMaterials([...allUpstreamMaterials, ...localForAllShots]);
  }, [allUpstreamMaterials, shots, id]);

  const inputStyle: React.CSSProperties = {
    background: 'var(--t8-bg-panel, rgba(15,23,42,.72))',
    color: 'var(--t8-text-main, #f8fafc)',
    borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))',
  };
  const mutedStyle: React.CSSProperties = {
    color: 'var(--t8-text-muted, rgba(248,250,252,.62))',
  };

  const writeShots = (nextShots: DirectorStoryboardShot[]) => {
    update({ shots: nextShots });
  };

  const patchShot = (shotId: string, patch: Partial<DirectorStoryboardShot>) => {
    writeShots(shots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot)));
  };

  const addShot = () => {
    const nextIndex = shots.length + 1;
    const newShot: DirectorStoryboardShot = {
      id: `shot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: `S${nextIndex}`,
      durationSec: 5,
      prompt: '',
      frameMode: 'auto',
      localRefImages: [],
      localRefVideos: [],
      localRefAudios: [],
      promptMentions: [],
    };
    writeShots([...shots, newShot]);
    setActiveShotId(newShot.id);
  };

  const duplicateShot = () => {
    if (!activeShot) return;
    const index = shots.findIndex((shot) => shot.id === activeShot.id);
    const copy: DirectorStoryboardShot = {
      ...activeShot,
      id: `shot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${activeShot.title} copy`,
      taskId: null,
      videoUrl: null,
      error: null,
      status: undefined,
    };
    const next = shots.slice();
    next.splice(index + 1, 0, copy);
    writeShots(next);
    setActiveShotId(copy.id);
  };

  const removeShot = (shotId: string) => {
    if (shots.length <= 1) return;
    const next = shots.filter((shot) => shot.id !== shotId);
    writeShots(next);
    if (shotId === activeShotId) setActiveShotId(next[0]?.id || '');
  };

  const moveShot = (shotId: string, dir: -1 | 1) => {
    const index = shots.findIndex((shot) => shot.id === shotId);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= shots.length) return;
    const next = shots.slice();
    [next[index], next[target]] = [next[target], next[index]];
    writeShots(next);
  };

  const appendRefs = (kind: 'image' | 'video' | 'audio', urls: string[]) => {
    if (!activeShot || urls.length === 0) return;
    const field = kind === 'image' ? 'localRefImages' : kind === 'video' ? 'localRefVideos' : 'localRefAudios';
    patchShot(activeShot.id, { [field]: dedupe([...(activeShot as any)[field], ...urls]) } as any);
  };

  const removeRef = (kind: 'image' | 'video' | 'audio', url: string) => {
    if (!activeShot) return;
    const field = kind === 'image' ? 'localRefImages' : kind === 'video' ? 'localRefVideos' : 'localRefAudios';
    patchShot(activeShot.id, { [field]: ((activeShot as any)[field] || []).filter((item: string) => item !== url) } as any);
  };

  const handleUpload = async (kind: 'image' | 'video' | 'audio', event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    try {
      logBus.info(`上传${kind === 'image' ? '图片' : kind === 'video' ? '视频' : '音频'}参考 ${files.length} 个`, src);
      const uploaded = await Promise.all(files.map((file) => uploadFile(file)));
      appendRefs(kind, uploaded.map((item) => item.url));
    } catch (error: any) {
      const message = error?.message || '上传失败';
      logBus.error(`分镜参考素材上传失败: ${message}`, src);
      update({ error: message });
    }
  };

  const handleDrop = (payload: MaterialPayload) => {
    if (!activeShot) return;
    if (payload.kind === 'image' && payload.url) appendRefs('image', [payload.url]);
    if (payload.kind === 'video' && payload.url) appendRefs('video', [payload.url]);
    if (payload.kind === 'audio' && payload.url) appendRefs('audio', [payload.url]);
    if (payload.kind === 'text' && payload.text) {
      const nextPrompt = activeShot.prompt ? `${activeShot.prompt}\n${payload.text}` : payload.text;
      patchShot(activeShot.id, { prompt: nextPrompt, promptMentions: [] });
    }
  };

  const { dropProps, isAccepting } = useMaterialDropTarget({
    id,
    accepts: ['image', 'video', 'audio', 'text'],
    onDrop: handleDrop,
  });

  const beginMaterialDrag = (event: React.MouseEvent, payload: MaterialPayload) => {
    if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    event.stopPropagation();
    startDrag(payload, event.clientX, event.clientY);
  };

  const applyDurationResize = (clientX: number) => {
    const state = durationResizeStateRef.current;
    if (!state) return false;
    const durationSec = calculateDirectorTimelineDragDuration({
      startDurationSec: state.startDurationSec,
      startClientX: state.startClientX,
      currentClientX: clientX,
      timelineWidthPx: state.timelineWidthPx,
      totalDurationSec: state.totalDurationSec,
    });
    writeShots(state.baseShots.map((item) => (item.id === state.shotId ? { ...item, durationSec } : item)));
    return true;
  };

  const finishDurationResize = () => {
    durationResizeActiveRef.current = false;
    durationResizeStateRef.current = null;
    const cleanup = durationResizeCleanupRef.current;
    durationResizeCleanupRef.current = null;
    cleanup?.();
  };

  const beginDurationResize = (
    event: ReactPointerEvent<HTMLButtonElement> | ReactMouseEvent<HTMLButtonElement>,
    shot: DirectorStoryboardShot,
  ) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    if ('button' in event && event.button !== 0) return;
    if (durationResizeActiveRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    durationResizeActiveRef.current = true;
    event.preventDefault();
    event.stopPropagation();
    if ('pointerId' in event) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Window listeners and element move handlers below are the real drag channels; pointer capture is best effort.
      }
    }
    durationResizeCleanupRef.current?.();
    durationResizeStateRef.current = {
      shotId: shot.id,
      baseShots: shots,
      startClientX: event.clientX,
      startDurationSec: shot.durationSec,
      timelineWidthPx: rect.width,
      totalDurationSec: Math.max(MIN_DURATION, shots.reduce((sum, item) => sum + item.durationSec, 0)),
    };

    const onMove = (nativeEvent: globalThis.PointerEvent | globalThis.MouseEvent) => {
      nativeEvent.preventDefault();
      nativeEvent.stopPropagation();
      applyDurationResize(nativeEvent.clientX);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', cleanup, true);
      window.removeEventListener('pointercancel', cleanup, true);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', cleanup, true);
      durationResizeCleanupRef.current = null;
      durationResizeActiveRef.current = false;
      durationResizeStateRef.current = null;
    };
    durationResizeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', cleanup, true);
    window.addEventListener('pointercancel', cleanup, true);
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', cleanup, true);
  };

  const moveDurationResize = (event: ReactPointerEvent<HTMLButtonElement> | ReactMouseEvent<HTMLButtonElement>) => {
    if (!durationResizeStateRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    applyDurationResize(event.clientX);
  };

  const endDurationResize = (event: ReactPointerEvent<HTMLButtonElement> | ReactMouseEvent<HTMLButtonElement>) => {
    if (!durationResizeStateRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    if ('pointerId' in event) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    }
    finishDurationResize();
  };

  const setJobPatch = (job: DirectorStoryboardJob, patch: JobUiResult) => {
    const next = {
      ...resultsRef.current,
      [job.id]: {
        ...(resultsRef.current[job.id] || {}),
        kind: job.kind,
        title: job.title,
        shotId: job.shotId,
        ...patch,
      },
    };
    resultsRef.current = next;
    update({ shotResults: next });
  };

  const pollJob = async (job: DirectorStoryboardJob, signal?: AbortSignal): Promise<string> => {
    if (!String(job.payload.prompt || '').trim()) {
      throw new Error('这个分镜没有提示词');
    }
    if (signal?.aborted) throw new Error('用户已停止');
    logBus.info(
      `提交${job.kind === 'bridge' ? '桥接' : '分镜'} ${job.title}: ${job.payload.duration || 5}s ${job.payload.ratio || ratio} ${job.payload.resolution || resolution}`,
      src,
    );
    setJobPatch(job, { status: 'submitting', error: null, progress: '提交中' });
    const submitted = await submitSeedance(job.payload);
    setJobPatch(job, { status: 'polling', taskId: submitted.taskId, progress: '15%' });
    logBus.info(`${job.title} taskId=${submitted.taskId} 已提交，进入轮询`, src);

    for (let elapsed = 1; elapsed <= maxPoll; elapsed += 1) {
      await sleep(pollInt * 1000, signal);
      const result = await querySeedance(submitted.taskId);
      const pct = Math.min(95, Math.round(15 + (elapsed * 80) / maxPoll));
      if (result.status === 'succeeded' && result.videoUrl) {
        logBus.success(`${job.title} 完成 → ${result.videoUrl}`, src);
        return result.videoUrl;
      }
      if (result.status === 'failed') {
        throw new Error(result.failReason || '生成失败');
      }
      setJobPatch(job, {
        status: 'polling',
        taskId: submitted.taskId,
        progress: result.progress || `${pct}%`,
      });
      if (elapsed === 1 || elapsed % 3 === 0) {
        logBus.debug(`${job.title} 轮询 ${elapsed}/${maxPoll} · ${result.status} · ${result.progress || `${pct}%`}`, src);
      }
    }
    throw new Error('轮询超时');
  };

  const runStoryboard = async (onlyShotId?: string) => {
    if (isBusy) return;
    const selectedShots = onlyShotId ? shots.filter((shot) => shot.id === onlyShotId) : shots;
    if (selectedShots.length === 0) return;
    const settings = {
      model,
      ratio,
      resolution,
      generateAudio,
      returnLastFrame,
      watermark,
      webSearch,
      seed,
      bridgeEnabled: onlyShotId ? false : bridgeEnabled,
      bridgeDurationSec,
      bridgePrompt,
    };
    const upstreamPrompt = upstream.texts.map((text) => text.url).filter(Boolean).join('\n').trim();
    const plan = buildDirectorStoryboardRunPlan(selectedShots, settings, {
      upstreamPrompt,
      mentionMaterials: storyboardMentionMaterials,
    });
    if (plan.length === 0) return;

    taskCompletionSound.primeAudio();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!onlyShotId) {
      resultsRef.current = {};
      videosRef.current = [];
      update({ status: 'submitting', error: null, videoUrl: '', videoUrls: [], outputText: '', shotResults: {} });
    } else {
      update({ status: 'submitting', error: null });
    }
    logBus.info(`导演分镜台开始生成：${plan.length} 个任务，不限制并发`, src);

    const onJobComplete = (result: DirectorStoryboardJobResult) => {
      if (result.status === 'success' && result.videoUrl) {
        videosRef.current = dedupe([...videosRef.current, result.videoUrl]);
        setJobPatch(result.job, {
          status: 'success',
          videoUrl: result.videoUrl,
          error: null,
          progress: '100%',
        });
        update({
          status: 'polling',
          videoUrl: result.videoUrl,
          videoUrls: videosRef.current,
          shotResults: resultsRef.current,
          outputText: buildOutputSummary(shots, resultsRef.current),
        });
        taskCompletionSound.notifyComplete(id, 'director-storyboard');
      } else {
        setJobPatch(result.job, {
          status: result.status,
          error: result.error || (result.status === 'cancelled' ? '用户已停止' : '生成失败'),
        });
        update({ shotResults: resultsRef.current, outputText: buildOutputSummary(shots, resultsRef.current) });
      }
    };

    try {
      const runResult = await runDirectorStoryboardJobs(plan, pollJob, {
        signal: controller.signal,
        onJobComplete,
      });
      const failed = runResult.results.filter((result) => result.status !== 'success');
      const nextStatus = controller.signal.aborted ? 'cancelled' : failed.length > 0 ? 'error' : 'success';
      update({
        status: nextStatus,
        videoUrls: videosRef.current,
        outputText: buildOutputSummary(shots, resultsRef.current),
        error: failed.length ? `${failed.length} 个任务未完成` : null,
      });
      if (failed.length > 0) {
        logBus.warn(`导演分镜台完成，但有 ${failed.length} 个任务失败或取消`, src);
      } else {
        logBus.success(`导演分镜台全部完成：${videosRef.current.length} 个视频`, src);
      }
    } catch (error: any) {
      const message = error?.message || '导演分镜生成失败';
      update({ status: controller.signal.aborted ? 'cancelled' : 'error', error: message });
      logBus.error(`导演分镜台失败: ${message}`, src);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const stopAll = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    update({ status: 'cancelled', error: '用户已停止' });
    logBus.warn('用户停止导演分镜台：已停止本地提交/轮询，已提交的远端视频任务会按平台状态继续或自行结束', src);
  };

  useRunTrigger(id, async () => {
    if (isBusy) return;
    await runStoryboard();
  }, 'director-storyboard');

  const totalDuration = shots.reduce((sum, shot) => sum + shot.durationSec, 0);
  const statusText = isBusy ? '生成中' : status === 'success' ? '已完成' : status === 'error' ? '有失败' : status === 'cancelled' ? '已停止' : '待生成';

  const renderRefList = (kind: 'image' | 'video' | 'audio', urls: string[]) => {
    if (urls.length === 0) {
      return <div className="text-[10px]" style={mutedStyle}>暂无{kind === 'image' ? '图片' : kind === 'video' ? '视频' : '音频'}参考</div>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {urls.map((url) => (
          <div key={`${kind}:${url}`} className="relative nodrag nopan">
            {kind === 'image' ? (
              <SmartImage
                src={url}
                alt=""
                thumbSize={180}
                className="h-12 w-14 rounded object-cover border"
                style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}
                data-drag-source
                data-drag-kind="image"
                data-drag-url={url}
                data-drag-preview={url}
                data-drag-node-id={id}
                onMouseDown={(event) => beginMaterialDrag(event, { kind: 'image', url, sourceNodeId: id, previewUrl: url })}
              />
            ) : kind === 'video' ? (
              <LoopingVideo
                src={url}
                className="h-12 w-14 rounded object-cover border bg-black"
                style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}
                data-drag-source
                data-drag-kind="video"
                data-drag-url={url}
                data-drag-preview={url}
                data-drag-node-id={id}
                onMouseDown={(event) => beginMaterialDrag(event, { kind: 'video', url, sourceNodeId: id, previewUrl: url })}
              />
            ) : (
              <div
                className="h-12 w-14 rounded border flex flex-col items-center justify-center text-[9px]"
                style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))', background: 'var(--t8-bg-panel, rgba(15,23,42,.72))' }}
                data-drag-source
                data-drag-kind="audio"
                data-drag-url={url}
                data-drag-node-id={id}
                onMouseDown={(event) => beginMaterialDrag(event, { kind: 'audio', url, sourceNodeId: id, previewUrl: url })}
              >
                <Music size={14} />
                <span className="max-w-full truncate">{fileName(url)}</span>
              </div>
            )}
            <button
              type="button"
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white"
              onClick={(event) => {
                event.stopPropagation();
                removeRef(kind, url);
              }}
              title="移除参考"
            >
              <X size={9} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      {...dropProps}
      className={`relative w-[460px] overflow-visible rounded-lg border-2 text-sm shadow-2xl transition-all ${
        selected ? 'shadow-fuchsia-500/20' : ''
      }`}
      style={{
        background: 'var(--t8-bg-node, rgba(10,15,24,.95))',
        color: 'var(--t8-text-main, #f8fafc)',
        borderColor: selected
          ? 'var(--t8-accent, #d946ef)'
          : isAccepting
            ? 'var(--t8-success, #22c55e)'
            : 'var(--t8-border-strong, rgba(255,255,255,.18))',
        boxShadow: isAccepting ? '0 0 0 3px color-mix(in srgb, var(--t8-success, #22c55e) 28%, transparent)' : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="director-storyboard-port !h-4 !w-4 !border-2"
        style={{
          left: -9,
          background: 'var(--t8-accent, #d946ef)',
          borderColor: 'var(--t8-bg-node, rgba(10,15,24,.95))',
          zIndex: 30,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="director-storyboard-port !h-4 !w-4 !border-2"
        style={{
          right: -9,
          background: 'var(--t8-accent, #d946ef)',
          borderColor: 'var(--t8-bg-node, rgba(10,15,24,.95))',
          zIndex: 30,
        }}
      />

      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--t8-border, rgba(255,255,255,.12))' }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md border"
          style={{
            background: 'color-mix(in srgb, var(--t8-accent, #d946ef) 18%, transparent)',
            borderColor: 'var(--t8-accent, #d946ef)',
            color: 'var(--t8-accent, #d946ef)',
          }}
        >
          <Clapperboard size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">导演分镜台</div>
          <div className="truncate text-[11px]" style={mutedStyle}>
            {shots.length} 镜头 · {totalDuration}s · Seedance2.0 无限并发
          </div>
        </div>
        <span
          className="rounded border px-2 py-1 text-[10px] font-semibold"
          style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))', color: 'var(--t8-accent, #d946ef)' }}
        >
          {statusText}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <div className="grid grid-cols-4 gap-1.5">
          <select value={model} onChange={(event) => update({ model: event.target.value })} className="nodrag rounded border px-2 py-1 text-[11px] outline-none col-span-2" style={inputStyle}>
            {MODEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={ratio} onChange={(event) => update({ ratio: event.target.value })} className="nodrag rounded border px-2 py-1 text-[11px] outline-none" style={inputStyle}>
            {RATIO_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={resolution} onChange={(event) => update({ resolution: event.target.value })} className="nodrag rounded border px-2 py-1 text-[11px] outline-none" style={inputStyle}>
            {RESOLUTION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <label className="flex items-center gap-1 text-[10px]" style={mutedStyle}>
            <input type="checkbox" checked={generateAudio} onChange={(event) => update({ generateAudio: event.target.checked })} />
            音频
          </label>
          <label className="flex items-center gap-1 text-[10px]" style={mutedStyle}>
            <input type="checkbox" checked={returnLastFrame} onChange={(event) => update({ returnLastFrame: event.target.checked })} />
            末帧
          </label>
          <label className="flex items-center gap-1 text-[10px]" style={mutedStyle}>
            <input type="checkbox" checked={watermark} onChange={(event) => update({ watermark: event.target.checked })} />
            水印
          </label>
          <input
            type="number"
            value={seed}
            onChange={(event) => update({ seed: Number(event.target.value) || -1 })}
            className="nodrag rounded border px-2 py-1 text-[11px] outline-none"
            style={inputStyle}
            title="Seed，-1 为随机"
          />
        </div>

        <div
          className="rounded-md border p-2"
          style={{ borderColor: 'var(--t8-border, rgba(255,255,255,.12))', background: 'var(--t8-bg-panel, rgba(15,23,42,.52))' }}
        >
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold">秒级时间线</span>
            <button
              type="button"
              onClick={addShot}
              className="nodrag flex items-center gap-1 rounded border px-2 py-1 text-[10px]"
              style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}
            >
              <Plus size={11} /> 加分镜
            </button>
          </div>
          <div ref={timelineRef} className="nodrag nopan flex h-14 min-w-0 overflow-hidden rounded border" style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}>
            {shots.map((shot, index) => {
              const result = results[`shot-${shot.id}`];
              const isActive = activeShot?.id === shot.id;
              return (
                <div
                  key={shot.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveShotId(shot.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setActiveShotId(shot.id);
                    }
                  }}
                  className="nodrag nopan relative min-w-[42px] border-r px-1 text-left text-[10px] outline-none transition-colors focus-visible:ring-2"
                  style={{
                    flex: Math.max(1, shot.durationSec),
                    borderColor: 'var(--t8-border, rgba(255,255,255,.12))',
                    background: isActive
                      ? 'color-mix(in srgb, var(--t8-accent, #d946ef) 26%, var(--t8-bg-panel, #111827))'
                      : 'var(--t8-bg-panel, rgba(15,23,42,.42))',
                  }}
                  title="点击编辑；拖动右侧小条调整秒数"
                >
                  <div className="truncate font-semibold">{shot.title || `S${index + 1}`}</div>
                  <div style={mutedStyle}>{shot.durationSec}s</div>
                  {result?.status === 'success' && <div className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                  {result?.status === 'error' && <div className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-rose-400" />}
                  <button
                    type="button"
                    className="nodrag nopan absolute -right-1 top-0 z-20 h-full w-4 cursor-ew-resize rounded-sm border-l border-white/20 bg-white/5 opacity-80 transition hover:bg-white/20"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDownCapture={(event) => beginDurationResize(event, shot)}
                    onPointerDown={(event) => beginDurationResize(event, shot)}
                    onPointerMoveCapture={moveDurationResize}
                    onPointerUpCapture={endDurationResize}
                    onPointerCancelCapture={endDurationResize}
                    onMouseDownCapture={(event) => beginDurationResize(event, shot)}
                    onMouseDown={(event) => beginDurationResize(event, shot)}
                    onMouseMoveCapture={moveDurationResize}
                    onMouseUpCapture={endDurationResize}
                    aria-label={`拖动调整 ${shot.title || `S${index + 1}`} 时长`}
                    title="拖动调整秒数"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {activeShot && (
          <div
            className="rounded-md border p-2"
            style={{ borderColor: 'var(--t8-border, rgba(255,255,255,.12))', background: 'var(--t8-bg-panel, rgba(15,23,42,.52))' }}
          >
            <div className="mb-2 flex items-center gap-1.5">
              <input
                value={activeShot.title}
                onChange={(event) => patchShot(activeShot.id, { title: event.target.value })}
                className="nodrag min-w-0 flex-1 rounded border px-2 py-1 text-xs font-semibold outline-none"
                style={inputStyle}
              />
              <input
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                value={activeShot.durationSec}
                onChange={(event) => patchShot(activeShot.id, { durationSec: clampDuration(event.target.value) })}
                className="nodrag w-16 rounded border px-2 py-1 text-xs outline-none"
                style={inputStyle}
              />
              <select
                value={activeShot.frameMode}
                onChange={(event) => patchShot(activeShot.id, { frameMode: event.target.value as any })}
                className="nodrag w-24 rounded border px-2 py-1 text-xs outline-none"
                style={inputStyle}
              >
                {FRAME_MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>

            <div className="mb-2 rounded border p-1.5" style={{ borderColor: 'var(--t8-border, rgba(255,255,255,.12))' }}>
              <div className="mb-1 text-[10px] font-semibold" style={mutedStyle}>镜头覆盖</div>
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  value={activeShot.modelOverride || ''}
                  onChange={(event) => patchShot(activeShot.id, { modelOverride: event.target.value || undefined })}
                  className="nodrag min-w-0 rounded border px-1.5 py-1 text-[10px] outline-none"
                  style={inputStyle}
                  title="单镜头模型，留空继承全局"
                >
                  <option value="">继承模型</option>
                  {MODEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <select
                  value={activeShot.ratioOverride || ''}
                  onChange={(event) => patchShot(activeShot.id, { ratioOverride: event.target.value || undefined })}
                  className="nodrag min-w-0 rounded border px-1.5 py-1 text-[10px] outline-none"
                  style={inputStyle}
                  title="单镜头比例，留空继承全局"
                >
                  <option value="">继承比例</option>
                  {RATIO_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select
                  value={activeShot.resolutionOverride || ''}
                  onChange={(event) => patchShot(activeShot.id, { resolutionOverride: event.target.value || undefined })}
                  className="nodrag min-w-0 rounded border px-1.5 py-1 text-[10px] outline-none"
                  style={inputStyle}
                  title="单镜头分辨率，留空继承全局"
                >
                  <option value="">继承分辨率</option>
                  {RESOLUTION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>

            <MentionPromptInput
              title="分镜提示词"
              value={activeShot.prompt || ''}
              mentions={Array.isArray(activeShot.promptMentions) ? activeShot.promptMentions : []}
              materials={mentionMaterials}
              onChange={(value: string, mentions: MediaMention[]) => patchShot(activeShot.id, { prompt: value, promptMentions: mentions })}
              placeholder="写这个镜头的画面、动作、镜头语言；输入 @ 可引用素材"
              isDark={isDark}
              isPixel={isPixel}
              promptTemplateKind="video"
              className="nodrag min-h-[72px] w-full resize-none rounded border px-2 py-1 text-xs outline-none"
              style={inputStyle}
            />

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <button type="button" onClick={() => uploadImageRef.current?.click()} className="nodrag flex items-center justify-center gap-1 rounded border px-2 py-1 text-[11px]" style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}>
                <ImageIcon size={12} /> 图片
              </button>
              <button type="button" onClick={() => uploadVideoRef.current?.click()} className="nodrag flex items-center justify-center gap-1 rounded border px-2 py-1 text-[11px]" style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}>
                <VideoIcon size={12} /> 视频
              </button>
              <button type="button" onClick={() => uploadAudioRef.current?.click()} className="nodrag flex items-center justify-center gap-1 rounded border px-2 py-1 text-[11px]" style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}>
                <Music size={12} /> 音频
              </button>
            </div>

            <input ref={uploadImageRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleUpload('image', event)} />
            <input ref={uploadVideoRef} type="file" accept="video/*" multiple className="hidden" onChange={(event) => handleUpload('video', event)} />
            <input ref={uploadAudioRef} type="file" accept="audio/*" multiple className="hidden" onChange={(event) => handleUpload('audio', event)} />

            <div className="mt-2 space-y-1.5">
              {renderRefList('image', activeShot.localRefImages)}
              {renderRefList('video', activeShot.localRefVideos)}
              {renderRefList('audio', activeShot.localRefAudios)}
            </div>

            <div className="mt-2 grid grid-cols-5 gap-1.5">
              <button type="button" onClick={() => moveShot(activeShot.id, -1)} className="nodrag rounded border px-1 py-1 text-[10px]" style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}>上移</button>
              <button type="button" onClick={() => moveShot(activeShot.id, 1)} className="nodrag rounded border px-1 py-1 text-[10px]" style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}>下移</button>
              <button type="button" onClick={duplicateShot} className="nodrag flex items-center justify-center gap-1 rounded border px-1 py-1 text-[10px]" style={{ borderColor: 'var(--t8-border-strong, rgba(255,255,255,.18))' }}>
                <Copy size={10} /> 复制
              </button>
              <button type="button" onClick={() => runStoryboard(activeShot.id)} disabled={isBusy} className="nodrag flex items-center justify-center gap-1 rounded border px-1 py-1 text-[10px] disabled:opacity-50" style={{ borderColor: 'var(--t8-accent, #d946ef)', color: 'var(--t8-accent, #d946ef)' }}>
                <RotateCcw size={10} /> 重跑
              </button>
              <button type="button" onClick={() => removeShot(activeShot.id)} disabled={shots.length <= 1} className="nodrag flex items-center justify-center gap-1 rounded border px-1 py-1 text-[10px] text-rose-300 disabled:opacity-40" style={{ borderColor: 'rgba(244,63,94,.45)' }}>
                <Trash2 size={10} /> 删除
              </button>
            </div>
          </div>
        )}

        <div
          className="rounded-md border p-2"
          style={{ borderColor: 'var(--t8-border, rgba(255,255,255,.12))', background: 'var(--t8-bg-panel, rgba(15,23,42,.42))' }}
        >
          <label className="mb-1 flex items-center gap-1 text-[11px]">
            <input type="checkbox" checked={bridgeEnabled} onChange={(event) => update({ bridgeEnabled: event.target.checked })} />
            首尾帧桥接片段
            <span className="text-[10px]" style={mutedStyle}>默认关闭</span>
          </label>
          {bridgeEnabled && (
            <div className="grid grid-cols-[72px_1fr] gap-1.5">
              <input
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                value={bridgeDurationSec}
                onChange={(event) => update({ bridgeDurationSec: clampDuration(event.target.value) })}
                className="nodrag rounded border px-2 py-1 text-xs outline-none"
                style={inputStyle}
              />
              <input
                value={bridgePrompt}
                onChange={(event) => update({ bridgePrompt: event.target.value })}
                placeholder="桥接提示词，可空"
                className="nodrag rounded border px-2 py-1 text-xs outline-none"
                style={inputStyle}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!isBusy ? (
            <button
              type="button"
              onClick={() => runStoryboard()}
              className="nodrag flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold"
              style={{
                borderColor: 'var(--t8-accent, #d946ef)',
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--t8-accent, #d946ef) 80%, #111827), color-mix(in srgb, var(--t8-accent-2, #22d3ee) 70%, #111827))',
                color: '#fff',
              }}
            >
              <Sparkles size={14} /> 生成全部
            </button>
          ) : (
            <button
              type="button"
              onClick={stopAll}
              className="nodrag flex items-center justify-center gap-1.5 rounded-md border border-rose-400/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100"
            >
              <Square size={13} /> 停止全部
            </button>
          )}
          <div className="flex items-center gap-2 rounded-md border px-2 py-2 text-[11px]" style={{ borderColor: 'var(--t8-border, rgba(255,255,255,.12))' }}>
            {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            <span className="truncate" style={mutedStyle}>
              已输出 {completedVideoUrls.length} / {bridgeEnabled ? Math.max(0, shots.length * 2 - 1) : shots.length}
            </span>
          </div>
        </div>

        {Object.keys(results).length > 0 && (
          <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
            {Object.entries(results).map(([jobId, result]) => (
              <div key={jobId} className="flex items-center gap-1.5 rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--t8-border, rgba(255,255,255,.12))' }}>
                <span className={`h-2 w-2 rounded-full ${
                  result.status === 'success' ? 'bg-emerald-400' : result.status === 'error' ? 'bg-rose-400' : result.status === 'cancelled' ? 'bg-zinc-400' : 'bg-amber-300'
                }`} />
                <span className="min-w-0 flex-1 truncate">{result.kind === 'bridge' ? '桥接' : '分镜'} · {result.title}</span>
                <span className="shrink-0" style={mutedStyle}>{result.progress || result.status}</span>
              </div>
            ))}
          </div>
        )}

        {d.error && (
          <div className="flex items-start gap-1 rounded border border-rose-400/35 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span className="break-all">{d.error}</span>
          </div>
        )}

        {latestVideoUrl && !hasAutoOutput && (
          <div className="rounded border p-1.5" style={{ borderColor: 'var(--t8-border, rgba(255,255,255,.12))' }}>
            <LoopingVideo
              src={latestVideoUrl}
              controls
              className="w-full rounded"
              style={{ aspectRatio: ratio === 'adaptive' ? undefined : ratio.replace(':', '/') }}
              data-drag-source
              data-drag-kind="video"
              data-drag-url={latestVideoUrl}
              data-drag-preview={latestVideoUrl}
              data-drag-node-id={id}
              data-resource-title={fileName(latestVideoUrl)}
              onMouseDown={(event) => beginMaterialDrag(event, { kind: 'video', url: latestVideoUrl, sourceNodeId: id, previewUrl: latestVideoUrl })}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(DirectorStoryboardNode);

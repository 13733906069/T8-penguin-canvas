import { memo, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import {
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { uploadFileBlob } from '../../services/imageOps';
import { cancelVideoEditJob, composeVideoEditAsync, getVideoEditJob, probeVideo, type VideoComposeResult } from '../../services/videoOps';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useUpstreamMaterials } from './useUpstreamMaterials';
import {
  appendVideoEditClips,
  applyVideoEditCreatorTemplate,
  applyVideoEditOutputPreset,
  createVideoEditClipFromMediaItem,
  normalizeVideoEditClips,
  normalizeVideoEditSettings,
  totalVideoEditDuration,
  VIDEO_EDIT_CREATOR_TEMPLATES,
  VIDEO_EDIT_OUTPUT_PRESETS,
  type VideoEditClip,
  type VideoEditSettings,
} from '../../utils/videoEdit';
import { fileNameFromUrl, formatMediaSize } from '../../utils/mediaCollection';

const ASPECT_OPTIONS: Array<{ value: VideoEditSettings['aspect']; label: string }> = [
  { value: 'first', label: '跟随第一段' },
  { value: 'source', label: '原比例' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '21:9', label: '21:9' },
  { value: '2:1', label: '2:1' },
];

const RESOLUTION_OPTIONS: Array<{ value: VideoEditSettings['resolution']; label: string }> = [
  { value: 'first', label: '跟随第一段' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K' },
];

const TRANSITION_OPTIONS: Array<{ value: VideoEditSettings['transition']; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'crossfade', label: '交叉淡化' },
  { value: 'black', label: '黑场过渡' },
  { value: 'white', label: '白场过渡' },
  { value: 'slide', label: '简单滑入' },
];

const FILTER_OPTIONS: Array<{ value: VideoEditSettings['filter']; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'bright', label: '提亮' },
  { value: 'contrast', label: '对比增强' },
  { value: 'warm', label: '暖色' },
  { value: 'cool', label: '冷色' },
  { value: 'mono', label: '黑白' },
  { value: 'cinematic', label: '电影感轻调色' },
];

const AUDIO_OPTIONS: Array<{ value: VideoEditSettings['audio']; label: string }> = [
  { value: 'keep', label: '保留原声' },
  { value: 'mute', label: '静音全部' },
  { value: 'first', label: '只保留第一段' },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-semibold" style={{ color: 'var(--t8-text-muted)' }}>{children}</label>;
}

function formatSeconds(value?: number) {
  if (!Number.isFinite(value || 0) || !value) return '--:--';
  const total = Math.max(0, Math.round(value));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function clipDuration(clip: VideoEditClip) {
  const end = clip.trimEnd || clip.duration || 0;
  if (!end) return 0;
  return Math.max(0, end - (clip.trimStart || 0));
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function VideoEditNode({ id, data, selected }: NodeProps) {
  const update = useUpdateNodeData(id);
  const rf = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTokenRef = useRef(0);
  const [busy, setBusy] = useState('');
  const [localError, setLocalError] = useState('');
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const d = (data as any) || {};
  const clips = useMemo(() => normalizeVideoEditClips(d.clips), [d.clips]);
  const settings = useMemo(() => normalizeVideoEditSettings(d.settings), [d.settings]);
  const upstream = useUpstreamMaterials(id);
  const selectedClip = clips.find((clip) => clip.id === d.selectedClipId) || clips[0] || null;
  const totalDuration = totalVideoEditDuration(clips);
  const outputUrl = String(d.videoUrl || d.output?.videoUrl || '');
  const status = String(d.status || d.job?.status || (clips.length > 0 ? 'ready' : 'idle'));
  const running = status === 'running' || d.job?.status === 'running' || busy === 'compose';
  const canCompose = clips.length > 0 && !running && busy !== 'upload';

  useEffect(() => () => {
    pollTokenRef.current += 1;
  }, []);

  const commitClips = (next: VideoEditClip[], extra: Record<string, any> = {}) => {
    update({
      clips: next,
      selectedClipId: next.some((clip) => clip.id === d.selectedClipId) ? d.selectedClipId : next[0]?.id || '',
      ...extra,
    });
  };

  const patchSettings = (patch: Partial<VideoEditSettings>) => {
    update({ settings: { ...settings, ...patch } });
  };

  const appendClips = async (incoming: VideoEditClip[]) => {
    const merged = appendVideoEditClips(clips, incoming);
    commitClips(merged, { status: merged.length ? 'ready' : 'idle', error: '' });
    const unprobed = merged.filter((clip) => !clip.duration && clip.status !== 'probing').slice(-incoming.length);
    for (const clip of unprobed) {
      void probeAndPatchClip(clip.id, clip.url);
    }
  };

  const probeAndPatchClip = async (clipId: string, url: string) => {
    commitClips(
      normalizeVideoEditClips((data as any)?.clips).map((clip) => clip.id === clipId ? { ...clip, status: 'probing' } : clip),
    );
    try {
      const result = await probeVideo(url);
      const current = normalizeVideoEditClips((rf.getNode(id)?.data as any)?.clips || clips);
      commitClips(current.map((clip) => clip.id === clipId ? {
        ...clip,
        duration: result.duration || clip.duration,
        width: result.width || clip.width,
        height: result.height || clip.height,
        size: result.size || clip.size,
        mime: result.mime || clip.mime,
        thumbnailUrl: result.thumbnailUrl || clip.thumbnailUrl,
        trimEnd: clip.trimEnd || result.duration || clip.trimEnd,
        status: 'ready',
        error: '',
      } : clip));
    } catch (error: any) {
      const current = normalizeVideoEditClips((rf.getNode(id)?.data as any)?.clips || clips);
      commitClips(current.map((clip) => clip.id === clipId ? {
        ...clip,
        status: 'error',
        error: error?.message || '读取视频信息失败',
      } : clip));
    }
  };

  const importUpstream = async () => {
    const incoming = upstream.videos.map((item) =>
      createVideoEditClipFromMediaItem(
        { kind: 'video', url: item.url, name: item.label || fileNameFromUrl(item.url) },
        { sourceNodeId: item.sourceNodeId, sourceLabel: '上游视频' },
      ),
    );
    if (incoming.length === 0) {
      setLocalError('没有检测到上游视频素材');
      return;
    }
    setLocalError('');
    await appendClips(incoming);
  };

  const uploadFiles = async (files: File[]) => {
    const videos = files.filter((file) => file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name));
    if (videos.length === 0) {
      setLocalError('请选择视频文件');
      return;
    }
    setBusy('upload');
    setLocalError('');
    try {
      const incoming: VideoEditClip[] = [];
      for (const file of videos) {
        const url = await uploadFileBlob(file, file.name);
        incoming.push(createVideoEditClipFromMediaItem(
          { kind: 'video', url, name: file.name, size: file.size, mime: file.type },
          { sourceLabel: '本地上传' },
        ));
      }
      await appendClips(incoming);
    } catch (error: any) {
      setLocalError(error?.message || '上传视频失败');
    } finally {
      setBusy('');
    }
  };

  const removeClip = (clipId: string) => {
    commitClips(clips.filter((clip) => clip.id !== clipId));
  };

  const patchClip = (clipId: string, patch: Partial<VideoEditClip>) => {
    commitClips(clips.map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip));
  };

  const splitSelectedClip = () => {
    if (!selectedClip) return;
    const start = Math.max(0, Number(selectedClip.trimStart) || 0);
    const end = Number(selectedClip.trimEnd || selectedClip.duration || 0);
    if (!Number.isFinite(end) || end <= start + 0.2) {
      setLocalError('需要先读取片段时长，且可用时长要大于 0.2 秒');
      return;
    }
    const middle = Number((start + (end - start) / 2).toFixed(2));
    const leftId = `clip-${Date.now()}-left-${Math.random().toString(36).slice(2, 6)}`;
    const rightId = `clip-${Date.now()}-right-${Math.random().toString(36).slice(2, 6)}`;
    const next = clips.flatMap((clip) => {
      if (clip.id !== selectedClip.id) return [clip];
      return [
        { ...clip, id: leftId, name: `${clip.name} A`, trimStart: start, trimEnd: middle },
        { ...clip, id: rightId, name: `${clip.name} B`, trimStart: middle, trimEnd: end },
      ];
    });
    setLocalError('');
    commitClips(next, { selectedClipId: rightId });
  };

  const handleTimelineDrop = (event: DragEvent<HTMLDivElement>, overId: string) => {
    event.preventDefault();
    if (!dragClipId || dragClipId === overId) return;
    const from = clips.findIndex((clip) => clip.id === dragClipId);
    const to = clips.findIndex((clip) => clip.id === overId);
    if (from < 0 || to < 0) return;
    commitClips(reorder(clips, from, to));
    setDragClipId(null);
  };

  const applyComposeResult = (result: VideoComposeResult) => {
    const patch = {
      status: 'success',
      error: '',
      videoUrl: result.videoUrl,
      videoUrls: [result.videoUrl],
      directVideoUrl: result.directVideoUrl || result.videoUrl,
      directVideoUrls: [result.directVideoUrl || result.videoUrl],
      fileName: result.fileName,
      fileSize: result.size || 0,
      mime: result.mime || 'video/mp4',
      output: {
        videoUrl: result.videoUrl,
        directVideoUrl: result.directVideoUrl || result.videoUrl,
        name: result.fileName,
        duration: result.duration,
        width: result.width,
        height: result.height,
        size: result.size,
      },
      job: { id: result.jobId, status: 'done', progress: 100, message: '合成完成' },
    };
    update(patch);
    if (settings.autoCreateOutputNode) {
      const self = rf.getNode(id);
      rf.addNodes([{
        id: `output-video-edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'output',
        position: {
          x: (self?.position.x || 0) + 820,
          y: self?.position.y || 0,
        },
        data: {
          videoUrl: result.videoUrl,
          videoUrls: [result.videoUrl],
          directVideoUrl: result.directVideoUrl || result.videoUrl,
          directVideoUrls: [result.directVideoUrl || result.videoUrl],
          fileName: result.fileName,
          fileSize: result.size || 0,
          mime: result.mime || 'video/mp4',
        },
      }]);
    }
  };

  const pollComposeJob = async (jobId: string, token: number) => {
    try {
      for (;;) {
        await wait(900);
        if (pollTokenRef.current !== token) return;
        const job = await getVideoEditJob(jobId);
        if (pollTokenRef.current !== token) return;
        update({
          status: job.status === 'done' ? 'success' : job.status,
          error: job.error || '',
          job: {
            id: job.id,
            status: job.status,
            progress: job.progress,
            message: job.message,
          },
        });
        if (job.status === 'done') {
          if (job.result) applyComposeResult(job.result);
          setBusy('');
          return;
        }
        if (job.status === 'failed' || job.status === 'cancelled') {
          const message = job.error || job.message || (job.status === 'cancelled' ? '视频合成已取消' : '视频合成失败');
          setLocalError(message);
          setBusy('');
          return;
        }
      }
    } catch (error: any) {
      const message = error?.message || '读取合成进度失败';
      setLocalError(message);
      update({ status: 'error', error: message, job: { id: jobId, status: 'failed', progress: 0, message } });
      setBusy('');
    }
  };

  const handleCompose = async () => {
    if (!canCompose) return;
    setBusy('compose');
    setLocalError('');
    update({ status: 'running', error: '', job: { status: 'running', progress: 3, message: '创建合成任务' } });
    try {
      const job = await composeVideoEditAsync(clips, settings);
      const token = pollTokenRef.current + 1;
      pollTokenRef.current = token;
      update({ status: 'running', error: '', job: { id: job.id, status: job.status, progress: job.progress || 5, message: job.message || '合成中' } });
      void pollComposeJob(job.id, token);
    } catch (error: any) {
      const message = error?.message || '视频合成失败';
      setLocalError(message);
      update({ status: 'error', error: message, job: { status: 'failed', progress: 0, message } });
      setBusy('');
    }
  };

  const handleCancelCompose = async () => {
    const jobId = String(d.job?.id || '');
    pollTokenRef.current += 1;
    setBusy('');
    if (!jobId) {
      update({ status: 'cancelled', job: { status: 'cancelled', progress: Number(d.job?.progress || 0), message: '已取消' } });
      return;
    }
    try {
      const job = await cancelVideoEditJob(jobId);
      update({ status: 'cancelled', error: '', job: { id: job.id, status: 'cancelled', progress: job.progress || Number(d.job?.progress || 0), message: job.message || '已取消' } });
      setLocalError('视频合成已取消');
    } catch (error: any) {
      const message = error?.message || '取消合成失败';
      setLocalError(message);
    }
  };

  return (
    <div className={`t8-node min-w-[760px] max-w-[760px] overflow-hidden rounded-xl ${selected ? 'ring-2 ring-cyan-300' : ''}`}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3" />

      <header className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3" style={{ background: 'var(--t8-surface-muted)' }}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-100 text-cyan-700">
            <Film size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-lg font-bold">
              <span>视频剪辑</span>
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold">{status === 'success' ? '已生成' : clips.length ? '可合成' : '待导入'}</span>
            </div>
            <div className="text-xs" style={{ color: 'var(--t8-text-muted)' }}>
              {clips.length} 段 · 总时长 {formatSeconds(totalDuration)} · 轻量拼接 / 裁短 / 转场 / 滤镜
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="t8-mini-icon-button nodrag" title="上传视频" onClick={() => fileInputRef.current?.click()} disabled={!!busy}>
            <UploadCloud size={16} />
          </button>
          <button className="t8-mini-icon-button nodrag" title="导入上游视频" onClick={importUpstream} disabled={!!busy}>
            <Plus size={16} />
          </button>
          <button className="t8-mini-icon-button nodrag" title="清空片段" onClick={() => commitClips([], { status: 'idle', output: undefined, videoUrl: '', videoUrls: [] })} disabled={!!busy || clips.length === 0}>
            <Trash2 size={16} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="video/*,.mp4,.webm,.mov,.m4v,.mkv"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = '';
            void uploadFiles(files);
          }}
        />
      </header>

      <div className="grid gap-3 p-3 md:grid-cols-[1fr_220px]">
        <main className="min-w-0 space-y-3">
          <section
            className="nodrag rounded-lg border border-dashed border-cyan-300 bg-black/85 p-2"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(event) => {
              event.preventDefault();
              void uploadFiles(Array.from(event.dataTransfer.files || []));
            }}
          >
            <div className="aspect-video overflow-hidden rounded-md bg-black">
              {outputUrl ? (
                <video className="h-full w-full object-contain" src={outputUrl} controls preload="metadata" />
              ) : selectedClip?.url ? (
                <video className="h-full w-full object-contain" src={selectedClip.url} controls muted preload="metadata" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-white/70">
                  轻点上传或从上游导入视频
                </div>
              )}
            </div>
          </section>

          {selectedClip && (
            <section className="rounded-lg border p-3" style={{ background: 'var(--t8-surface)' }}>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 font-semibold">
                  当前片段：<span className="truncate">{selectedClip.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button className="t8-mini-button nodrag px-2 py-1 text-[11px]" onClick={splitSelectedClip} disabled={running}>
                    <Scissors size={12} />
                    拆分片段
                  </button>
                  <span style={{ color: 'var(--t8-text-muted)' }}>{selectedClip.width && selectedClip.height ? `${selectedClip.width}x${selectedClip.height}` : '待探测'}</span>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label>
                  <FieldLabel>入点 {formatSeconds(selectedClip.trimStart)}</FieldLabel>
                  <input
                    className="nodrag nowheel w-full"
                    type="range"
                    min={0}
                    max={Math.max(1, selectedClip.duration || selectedClip.trimEnd || 1)}
                    step={0.1}
                    value={selectedClip.trimStart || 0}
                    onChange={(event) => patchClip(selectedClip.id, { trimStart: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <FieldLabel>出点 {formatSeconds(selectedClip.trimEnd || selectedClip.duration)}</FieldLabel>
                  <input
                    className="nodrag nowheel w-full"
                    type="range"
                    min={Math.min(selectedClip.trimStart + 0.1, selectedClip.duration || 1)}
                    max={Math.max(1, selectedClip.duration || selectedClip.trimEnd || 1)}
                    step={0.1}
                    value={selectedClip.trimEnd || selectedClip.duration || 1}
                    onChange={(event) => patchClip(selectedClip.id, { trimEnd: Number(event.target.value) })}
                  />
                </label>
              </div>
            </section>
          )}

          <section className="rounded-lg border p-2" style={{ background: 'var(--t8-surface-muted)' }}>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span>Playlist 时间线</span>
              <span>{clips.length ? '拖动片段卡片排序' : '暂无片段'}</span>
            </div>
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
              {clips.map((clip, index) => {
                const active = selectedClip?.id === clip.id;
                return (
                  <div
                    key={clip.id}
                    draggable
                    onDragStart={() => setDragClipId(clip.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleTimelineDrop(event, clip.id)}
                    onClick={() => update({ selectedClipId: clip.id })}
                    className={`nodrag min-w-[150px] cursor-pointer rounded-lg border p-2 text-left text-xs ${active ? 'border-cyan-500 bg-cyan-50' : 'bg-white/70'}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-bold">#{index + 1}</span>
                      <button className="t8-mini-icon-button" title="删除片段" onClick={(event) => { event.stopPropagation(); removeClip(clip.id); }}>
                        <X size={12} />
                      </button>
                    </div>
                    <div className="truncate font-semibold">{clip.name}</div>
                    <div className="mt-1 flex items-center justify-between opacity-70">
                      <span>{clip.sourceLabel}</span>
                      <span>{formatSeconds(clipDuration(clip))}</span>
                    </div>
                    {clip.status === 'error' && <div className="mt-1 truncate text-red-600">{clip.error}</div>}
                    <div className="mt-2 h-16 overflow-hidden rounded-md bg-black/10">
                      {clip.thumbnailUrl ? (
                        <img className="h-full w-full object-cover" src={clip.thumbnailUrl} alt={clip.name} />
                      ) : (
                        <div className="grid h-full place-items-center text-[11px] opacity-60">
                          <Film size={18} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="space-y-2">
          <label className="block">
            <FieldLabel>输出比例</FieldLabel>
            <select className="t8-select nodrag w-full px-2 py-1 text-xs" value={settings.aspect} onChange={(event) => patchSettings({ aspect: event.target.value as any })}>
              {ASPECT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <div>
            <FieldLabel>输出预设</FieldLabel>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {VIDEO_EDIT_OUTPUT_PRESETS.filter((item) => item.id !== 'custom').map((item) => (
                <button
                  key={item.id}
                  className={`t8-mini-button nodrag justify-center px-2 py-1 text-[10px] ${settings.outputPreset === item.id ? 'is-active' : ''}`}
                  title={item.hint}
                  onClick={() => update({ settings: applyVideoEditOutputPreset(settings, item.id) })}
                  disabled={running}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>一键模板</FieldLabel>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {VIDEO_EDIT_CREATOR_TEMPLATES.filter((item) => item.id !== 'manual').map((item) => (
                <button
                  key={item.id}
                  className={`t8-mini-button nodrag justify-center px-2 py-1 text-[10px] ${settings.creatorTemplate === item.id ? 'is-active' : ''}`}
                  title={item.hint}
                  onClick={() => update({ settings: applyVideoEditCreatorTemplate(settings, item.id) })}
                  disabled={running}
                >
                  <Sparkles size={11} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <FieldLabel>输出分辨率</FieldLabel>
            <select className="t8-select nodrag w-full px-2 py-1 text-xs" value={settings.resolution} onChange={(event) => patchSettings({ resolution: event.target.value as any })}>
              {RESOLUTION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <FieldLabel>转场</FieldLabel>
            <select className="t8-select nodrag w-full px-2 py-1 text-xs" value={settings.transition} onChange={(event) => patchSettings({ transition: event.target.value as any })}>
              {TRANSITION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <FieldLabel>转场时长 {settings.transitionDuration.toFixed(1)}s</FieldLabel>
            <input className="nodrag nowheel w-full" type="range" min={0.3} max={1} step={0.1} value={settings.transitionDuration} onChange={(event) => patchSettings({ transitionDuration: Number(event.target.value) })} />
          </label>
          <label className="block">
            <FieldLabel>滤镜</FieldLabel>
            <select className="t8-select nodrag w-full px-2 py-1 text-xs" value={settings.filter} onChange={(event) => patchSettings({ filter: event.target.value as any })}>
              {FILTER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <FieldLabel>音频</FieldLabel>
            <select className="t8-select nodrag w-full px-2 py-1 text-xs" value={settings.audio} onChange={(event) => patchSettings({ audio: event.target.value as any })}>
              {AUDIO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <input className="nodrag" type="checkbox" checked={settings.autoCreateOutputNode} onChange={(event) => patchSettings({ autoCreateOutputNode: event.target.checked })} />
            合成后自动创建输出素材节点
          </label>
          <button className="t8-primary-button nodrag w-full justify-center" onClick={handleCompose} disabled={!canCompose || !!busy}>
            {running ? <Loader2 size={15} className="animate-spin" /> : <Scissors size={15} />}
            {running ? '合成中...' : '合成视频'}
          </button>
          {running && (
            <div className="rounded-lg border p-2 text-[11px]" style={{ background: 'var(--t8-surface)' }}>
              <div className="mb-1 flex items-center justify-between font-semibold">
                <span>{String(d.job?.message || '合成中')}</span>
                <span>{Math.round(Number(d.job?.progress || 0))}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${Math.max(3, Math.min(100, Number(d.job?.progress || 0)))}%` }} />
              </div>
              <button className="t8-secondary-button nodrag mt-2 w-full justify-center" onClick={handleCancelCompose}>
                <X size={14} />
                取消合成
              </button>
            </div>
          )}
          {outputUrl && (
            <a className="t8-secondary-button nodrag flex w-full justify-center" href={outputUrl} download={String(d.fileName || 'video-edit.mp4')}>
              <Download size={15} />
              下载成片
            </a>
          )}
          <div className="rounded-lg border border-dashed p-2 text-[11px]" style={{ color: 'var(--t8-text-muted)' }}>
            {outputUrl ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 size={13} /> 已生成</div>
                <div className="truncate">{String(d.fileName || fileNameFromUrl(outputUrl))}</div>
                <div>{formatMediaSize(Number(d.fileSize) || undefined) || '等待大小信息'}</div>
              </div>
            ) : (
              <div>前端只预览一个片段，合成由后端 ffmpeg 执行，输出会写入标准视频字段。</div>
            )}
          </div>
          {(localError || d.error) && <div className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-700">{localError || String(d.error)}</div>}
        </aside>
      </div>
    </div>
  );
}

export default memo(VideoEditNode);

import { memo, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import { Handle, Position, useEdges, useNodes, type NodeProps } from '@xyflow/react';
import {
  AlertCircle,
  CheckCircle2,
  Files,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  Upload,
  Wand2,
  X,
  ZoomIn,
} from 'lucide-react';
import { PORT_COLOR } from '../../config/portTypes';
import {
  copyFileToOutput,
  openOutputFolder,
  opConvert,
  opPadCanvas,
  opRemoveBg,
  opTrimBorder,
  opUpscale,
} from '../../services/imageOps';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { formatMediaSize, getMediaItemsFromData, type MediaItem, type MediaKind } from '../../utils/mediaCollection';
import {
  buildBatchOutputName,
  classifyBatchFile,
  createBatchItemFromUpload,
  summarizeBatchProgress,
  type BatchNamingSettings,
  type BatchProcessorItem,
} from '../../utils/batchProcessor';
import { useUpdateNodeData } from './useUpdateNodeData';

const KIND_LABEL: Record<MediaKind, string> = {
  image: '图像',
  video: '视频',
  audio: '音频',
  model3d: '3D',
};

const RATIO_OPTIONS = [
  { value: 'keep', label: '原比例' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
];

type TrimBorderMode = 'auto' | 'black' | 'white' | 'transparent';
type TrimBorderAxis = 'vertical' | 'horizontal' | 'all';
type TrimBorderStrategy = 'auto' | 'manual';

const TRIM_MODE_OPTIONS: Array<{ value: TrimBorderMode; label: string }> = [
  { value: 'auto', label: '自动检测' },
  { value: 'black', label: '黑边' },
  { value: 'white', label: '白边' },
  { value: 'transparent', label: '透明边' },
];

const TRIM_AXIS_OPTIONS: Array<{ value: TrimBorderAxis; label: string }> = [
  { value: 'vertical', label: '仅上下' },
  { value: 'horizontal', label: '仅左右' },
  { value: 'all', label: '上下左右' },
];

const trimModeLabel = (mode: TrimBorderMode) => TRIM_MODE_OPTIONS.find((item) => item.value === mode)?.label || '自动检测';

function dedupeItems(items: BatchProcessorItem[]): BatchProcessorItem[] {
  const seen = new Set<string>();
  const out: BatchProcessorItem[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.url}`;
    if (!item.url || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function inferAcceptKind(file: File): MediaKind | null {
  return classifyBatchFile(file.name, file.type);
}

function collectUpstreamBatchItems(id: string, edges: any[], nodes: any[]): BatchProcessorItem[] {
  const upstreamIds = edges.filter((edge) => edge.target === id).map((edge) => edge.source);
  const out: BatchProcessorItem[] = [];
  for (const sourceId of upstreamIds) {
    const source = nodes.find((node) => node.id === sourceId);
    const data = (source?.data || {}) as any;
    (['image', 'video', 'audio', 'model3d'] as MediaKind[]).forEach((kind) => {
      getMediaItemsFromData(data, kind).forEach((item, index) => {
        out.push({
          id: `upstream-${sourceId}-${kind}-${index}`,
          kind,
          url: item.url,
          name: item.name || `${KIND_LABEL[kind]} ${index + 1}`,
          size: item.size,
          mime: item.mime,
          status: 'pending',
        });
      });
    });
  }
  return out;
}

async function uploadBatchFile(file: File, index: number): Promise<BatchProcessorItem | null> {
  const kind = inferAcceptKind(file);
  if (!kind) return null;
  const fd = new FormData();
  fd.append('file', file);
  const response = await fetch('/api/files/upload', { method: 'POST', body: fd });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success || !json.data?.url) {
    throw new Error(json?.error || `上传失败 HTTP ${response.status}`);
  }
  const relativePath = String((file as any).webkitRelativePath || file.name || '').replace(/\\/g, '/');
  return createBatchItemFromUpload({
    kind,
    url: json.data.url,
    name: file.name,
    relativePath,
    size: json.data.size || file.size,
    mime: json.data.mime || file.type,
    index,
  });
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--t8-text-muted)' }}>{children}</label>;
}

function ToggleStep({
  icon,
  label,
  active,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const stateLabel = active ? '已启用' : '未启用';
  return (
    <button
      type="button"
      className="nodrag nopan t8-btn min-h-[44px] min-w-0 justify-start px-2 py-1.5 text-[11px]"
      disabled={disabled}
      onClick={() => onChange(!active)}
      onMouseDown={(event) => event.stopPropagation()}
      aria-pressed={active}
      title={`${label} · ${stateLabel}`}
      style={{
        borderColor: active ? '#22c55e' : 'var(--t8-border)',
        background: active
          ? 'linear-gradient(135deg, rgba(34,197,94,.22), rgba(20,184,166,.12))'
          : 'var(--t8-bg-soft)',
        color: active ? 'var(--t8-text-main)' : 'var(--t8-text-muted)',
        boxShadow: active ? 'inset 0 0 0 1px rgba(34,197,94,.55)' : undefined,
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold"
        style={{
          background: active ? 'rgba(34,197,94,.22)' : 'rgba(148,163,184,.12)',
          color: active ? '#86efac' : 'var(--t8-text-dim)',
        }}
      >
        {stateLabel}
      </span>
    </button>
  );
}

function BatchProcessorNode({ id, data, selected }: NodeProps) {
  const update = useUpdateNodeData(id);
  const edges = useEdges();
  const nodes = useNodes();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const d = (data || {}) as any;
  const storedItems = Array.isArray(d.batchProcessorItems) ? d.batchProcessorItems as BatchProcessorItem[] : [];
  const upstreamItems = useMemo(() => collectUpstreamBatchItems(id, edges, nodes), [id, edges, nodes]);
  const allItems = useMemo(() => dedupeItems([...storedItems, ...upstreamItems]), [storedItems, upstreamItems]);
  const progress = summarizeBatchProgress(allItems);
  const status = d.status || progress.status;
  const running = status === 'running';

  const nameMode: BatchNamingSettings['mode'] = d.batchProcessorNameMode === 'rename' ? 'rename' : 'original';
  const renamePattern = typeof d.batchProcessorRenamePattern === 'string' && d.batchProcessorRenamePattern
    ? d.batchProcessorRenamePattern
    : 'batch-{index}-{name}';
  const outputFormat: BatchNamingSettings['outputFormat'] =
    ['keep', 'png', 'jpg', 'webp'].includes(d.batchProcessorOutputFormat)
      ? d.batchProcessorOutputFormat
      : 'keep';
  const ratio = typeof d.batchProcessorTargetRatio === 'string' ? d.batchProcessorTargetRatio : 'keep';
  const upscaleScale = Math.max(1, Math.min(8, Number(d.batchProcessorUpscaleScale || 2)));
  const trimMode: TrimBorderMode = ['auto', 'black', 'white', 'transparent'].includes(d.batchProcessorTrimMode)
    ? d.batchProcessorTrimMode
    : 'auto';
  const trimAxis: TrimBorderAxis = ['vertical', 'horizontal', 'all'].includes(d.batchProcessorTrimAxis)
    ? d.batchProcessorTrimAxis
    : 'vertical';
  const trimStrategy: TrimBorderStrategy = d.batchProcessorTrimStrategy === 'manual' ? 'manual' : 'auto';
  const trimThreshold = Math.max(0, Math.min(120, Number(d.batchProcessorTrimThreshold ?? 18)));
  const trimManual = {
    top: Math.max(0, Math.min(9999, Number(d.batchProcessorTrimManualTop || 0))),
    right: Math.max(0, Math.min(9999, Number(d.batchProcessorTrimManualRight || 0))),
    bottom: Math.max(0, Math.min(9999, Number(d.batchProcessorTrimManualBottom || 0))),
    left: Math.max(0, Math.min(9999, Number(d.batchProcessorTrimManualLeft || 0))),
  };

  const namingSettingsFor = (item: BatchProcessorItem): BatchNamingSettings => ({
    mode: nameMode,
    pattern: renamePattern,
    sequenceStart: Math.max(1, Number(d.batchProcessorSequenceStart || 1)),
    indexPadding: Math.max(1, Math.min(8, Number(d.batchProcessorIndexPadding || 3))),
    outputFormat: item.kind === 'image' ? outputFormat : 'keep',
  });

  const patchItems = (items: BatchProcessorItem[]) => {
    const summary = summarizeBatchProgress(items);
    update({
      batchProcessorItems: items,
      batchProcessorProgress: summary,
      batchProcessorResults: items.filter((item) => item.status === 'success' || item.status === 'error'),
      status: summary.status === 'idle' ? 'idle' : summary.status,
    });
  };

  const appendFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setLocalError('');
    setBusy(true);
    try {
      const uploaded: BatchProcessorItem[] = [];
      let skipped = 0;
      for (let i = 0; i < files.length; i += 1) {
        const item = await uploadBatchFile(files[i], storedItems.length + uploaded.length + i);
        if (item) uploaded.push(item);
        else skipped += 1;
      }
      const next = dedupeItems([...storedItems, ...uploaded]);
      update({
        batchProcessorItems: next,
        batchProcessorUploadNotice: skipped > 0
          ? `已加入 ${uploaded.length} 项，跳过 ${skipped} 个`
          : `已加入 ${uploaded.length} 项素材`,
      });
    } catch (error: any) {
      setLocalError(error?.message || '批量上传失败');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) {
      update({ batchProcessorUploadNotice: '未选择文件' });
      return;
    }
    update({ batchProcessorUploadNotice: `正在上传 ${files.length} 个文件...` });
    void appendFiles(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    void appendFiles(Array.from(event.dataTransfer?.files || []));
  };

  const processImage = async (item: BatchProcessorItem): Promise<{ url: string; steps: string[]; trimInfo?: BatchProcessorItem['trimInfo'] }> => {
    let url = item.url;
    const steps: string[] = [];
    let trimInfo: BatchProcessorItem['trimInfo'] | undefined;
    if (d.batchProcessorTrimBlackBars) {
      const result = await opTrimBorder(url, {
        mode: trimMode,
        axis: trimAxis,
        threshold: trimThreshold,
        strategy: trimStrategy,
        manual: trimManual,
      });
      url = result.imageUrl;
      const removed = result.crop.removed;
      trimInfo = {
        top: removed.top,
        right: removed.right,
        bottom: removed.bottom,
        left: removed.left,
        width: result.crop.w,
        height: result.crop.h,
      };
      const totalRemoved = removed.top + removed.right + removed.bottom + removed.left;
      steps.push(totalRemoved > 0
        ? `裁边 上${removed.top}/右${removed.right}/下${removed.bottom}/左${removed.left}px`
        : '裁边 0px');
    }
    if (d.batchProcessorRemoveBg) {
      const result = await opRemoveBg(url);
      url = result.imageUrl;
      steps.push('抠图');
    }
    if (d.batchProcessorExpandCanvas && ratio !== 'keep') {
      const result = await opPadCanvas(url, { ratio, background: d.batchProcessorPadBackground || '#00000000' });
      url = result.imageUrl;
      steps.push('扩图');
    }
    if (d.batchProcessorUpscale) {
      const result = await opUpscale(url, upscaleScale);
      url = result.imageUrl;
      steps.push(`${upscaleScale}x`);
    }
    if (outputFormat !== 'keep') {
      const result = await opConvert(url, { format: outputFormat, quality: Number(d.batchProcessorQuality || 90) });
      url = result.imageUrl;
      steps.push(outputFormat.toUpperCase());
    }
    return { url, steps, trimInfo };
  };

  const runBatch = async () => {
    const baseItems: BatchProcessorItem[] = dedupeItems(allItems).map((item) => ({
      ...item,
      status: 'pending',
      error: '',
      resultUrl: '',
      outputName: '',
      stepsDone: [],
      trimInfo: undefined,
    }));
    if (baseItems.length === 0) {
      const msg = '请先上传文件、文件夹或连接上游素材';
      setLocalError(msg);
      update({ status: 'error', error: msg });
      return;
    }
    cancelRef.current = false;
    setLocalError('');
    update({
      status: 'running',
      error: '',
      batchProcessorItems: baseItems,
      batchProcessorResults: [],
      batchProcessorProgress: summarizeBatchProgress(baseItems),
    });

    let nextItems = [...baseItems];
    for (let index = 0; index < nextItems.length; index += 1) {
      if (cancelRef.current) {
        nextItems = nextItems.map((item, i) => i >= index && item.status === 'pending' ? { ...item, status: 'skipped' as const, error: '已取消' } : item);
        patchItems(nextItems);
        break;
      }

      nextItems[index] = { ...nextItems[index], status: 'running' };
      patchItems(nextItems);
      try {
        const item = nextItems[index];
        let currentUrl = item.url;
        let stepsDone: string[] = [];
        let trimInfo: BatchProcessorItem['trimInfo'] | undefined;
        if (item.kind === 'image') {
          const processed = await processImage(item);
          currentUrl = processed.url;
          stepsDone = processed.steps;
          trimInfo = processed.trimInfo;
        } else {
          stepsDone = ['命名归档'];
        }

        const outputName = buildBatchOutputName(item, index, namingSettingsFor(item));
        // 使用 /api/files/copy-to-output 收口命名后的真实文件；不写 imageUrls/videoUrls，避免画布自动外挂 OutputNode。
        const copied = await copyFileToOutput(currentUrl, outputName, 'batch');
        nextItems[index] = {
          ...item,
          status: 'success',
          resultUrl: copied.url,
          outputName: copied.filename,
          size: copied.size || item.size,
          stepsDone,
          trimInfo,
        };
      } catch (error: any) {
        nextItems[index] = {
          ...nextItems[index],
          status: 'error',
          error: error?.message || '处理失败',
        };
      }
      patchItems(nextItems);
    }
  };

  const stopBatch = () => {
    cancelRef.current = true;
    update({ status: 'idle' });
  };

  useRunTrigger(id, async () => {
    if (!running) await runBatch();
  }, 'batch-processor');

  const clearItems = () => {
    cancelRef.current = true;
    update({
      batchProcessorItems: [],
      batchProcessorResults: [],
      batchProcessorProgress: summarizeBatchProgress([]),
      status: 'idle',
      error: '',
      batchProcessorUploadNotice: '队列已清空',
    });
    setLocalError('');
  };

  const openFilePicker = () => {
    if (busy || running) return;
    update({ batchProcessorUploadNotice: '正在打开文件选择器...' });
    fileInputRef.current?.click();
  };

  const openFolderPicker = () => {
    if (busy || running) return;
    update({ batchProcessorUploadNotice: '正在打开文件夹选择器...' });
    folderInputRef.current?.click();
  };

  const openBatchOutputFolder = async () => {
    if (folderBusy) return;
    setFolderBusy(true);
    setLocalError('');
    update({ batchProcessorUploadNotice: '正在打开 output/batch 文件夹...' });
    try {
      await openOutputFolder('batch');
      update({ batchProcessorUploadNotice: '已打开 output/batch 文件夹' });
    } catch (error: any) {
      const msg = error?.message || '打开输出文件夹失败';
      setLocalError(msg);
      update({ error: msg, batchProcessorUploadNotice: msg });
    } finally {
      setFolderBusy(false);
    }
  };

  const toggleStep = (field: string, value: boolean, label: string) => {
    if (field === 'batchProcessorExpandCanvas' && value) {
      update({
        [field]: value,
        batchProcessorTargetRatio: ratio === 'keep' ? '16:9' : ratio,
        batchProcessorUploadNotice: '批量扩图已启用，扩图比例已切换为 16:9',
      });
      return;
    }
    update({
      [field]: value,
      batchProcessorUploadNotice: `${label} ${value ? '已启用' : '已关闭'}`,
    });
  };

  const resultItems = (Array.isArray(d.batchProcessorResults) ? d.batchProcessorResults : allItems)
    .filter((item: BatchProcessorItem) => item.status === 'success' || item.status === 'error')
    .slice(-8);

  return (
    <div
      className={`t8-node overflow-hidden ${selected ? 'ring-2' : ''}`}
      style={{
        width: 640,
        borderColor: selected ? 'var(--t8-accent)' : 'var(--t8-border-strong)',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--t8-accent) 30%, transparent)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: PORT_COLOR.image, border: '1px solid var(--t8-bg-node)' }} />

      <div className="t8-node-header flex items-center gap-2 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: '#f472b6', color: '#260516' }}>
          <Files size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">批量素材处理</div>
          <div className="truncate text-[10px]" style={{ color: 'var(--t8-text-muted)' }}>
            {progress.total} 项 · {progress.done}/{progress.total} · 成功 {progress.ok} · 失败 {progress.fail}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: progress.fail ? '#ef4444' : running ? '#f59e0b' : '#16a34a' }}>
          {running ? <Loader2 size={13} className="animate-spin" /> : progress.fail ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
          {running ? '处理中' : progress.total ? '待运行' : '待导入'}
        </div>
      </div>

      <div className="nodrag nowheel grid grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] gap-3 p-3" onMouseDown={(event) => event.stopPropagation()} onWheelCapture={(event) => event.stopPropagation()}>
        <div className="min-w-0 space-y-2">
          <div
            className={`rounded-md border border-dashed p-3 transition-colors ${dragActive ? 'bg-cyan-500/10' : ''}`}
            style={{ borderColor: dragActive ? '#22d3ee' : 'var(--t8-border)' }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              {...({ webkitdirectory: '', directory: '' } as any)}
            />
            <div className="flex items-center gap-2">
              <button type="button" className="t8-btn px-2 py-1.5 text-xs" onClick={openFilePicker} disabled={busy || running}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                文件
              </button>
              <button type="button" className="t8-btn px-2 py-1.5 text-xs" onClick={openFolderPicker} disabled={busy || running}>
                <FolderOpen size={13} />
                文件夹
              </button>
              <button type="button" className="t8-btn px-2 py-1.5 text-xs" onClick={clearItems} disabled={running}>
                <RotateCcw size={13} />
                清空
              </button>
              <span className="ml-auto text-[10px]" style={{ color: 'var(--t8-text-dim)' }}>{d.batchProcessorUploadNotice || '拖拽也可导入'}</span>
            </div>
          </div>

          <div className="rounded-md border p-2" style={{ borderColor: 'var(--t8-border)' }}>
            <div className="mb-1 flex items-center justify-between text-[10px]" style={{ color: 'var(--t8-text-muted)' }}>
              <span>素材队列</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--t8-bg-soft)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress.percent}%`, background: progress.fail ? '#ef4444' : '#22c55e' }} />
            </div>
            <div className="mt-2 max-h-32 space-y-1 overflow-auto pr-1">
              {allItems.length === 0 ? (
                <div className="rounded border border-dashed px-2 py-3 text-center text-[11px]" style={{ borderColor: 'var(--t8-border)', color: 'var(--t8-text-dim)' }}>
                  无素材
                </div>
              ) : allItems.slice(0, 24).map((item) => (
                <div key={`${item.kind}:${item.url}`} className="grid grid-cols-[42px_1fr_auto] items-center gap-2 rounded px-2 py-1" style={{ background: 'var(--t8-bg-soft)' }}>
                  <span className="rounded px-1 py-0.5 text-center text-[10px] font-bold" style={{ color: 'var(--t8-text-main)', background: 'var(--t8-bg-node)' }}>{KIND_LABEL[item.kind]}</span>
                  <span className="truncate text-[11px]" style={{ color: 'var(--t8-text-main)' }} title={item.relativePath || item.name}>{item.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--t8-text-dim)' }}>{formatMediaSize(item.size)}</span>
                </div>
              ))}
              {allItems.length > 24 && <div className="text-right text-[10px]" style={{ color: 'var(--t8-text-dim)' }}>还有 {allItems.length - 24} 项</div>}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            {running ? (
              <button type="button" className="t8-btn px-3 py-2 text-sm" onClick={stopBatch}>
                <X size={14} />
                取消
              </button>
            ) : (
              <button type="button" className="t8-btn t8-btn-primary px-3 py-2 text-sm" onClick={runBatch} disabled={allItems.length === 0 || busy}>
                <Play size={14} />
                开始批处理
              </button>
            )}
            <div className="rounded-md border px-2 py-1.5 text-[10px]" style={{ borderColor: 'var(--t8-border)', color: 'var(--t8-text-muted)' }}>
              完成后只更新本节点结果，不自动铺素材节点
            </div>
          </div>

          <button
            type="button"
            className="t8-btn w-full justify-center px-3 py-2 text-sm"
            onClick={openBatchOutputFolder}
            disabled={folderBusy}
            title="打开 output/batch 文件夹查看批处理结果"
          >
            {folderBusy ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
            打开输出文件夹
          </button>

          {(localError || d.error) && (
            <div className="flex items-start gap-1 rounded-md border px-2 py-1.5 text-[11px]" style={{ borderColor: '#ef444466', color: '#ef4444' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{localError || d.error}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <div className="min-w-0">
              <FieldLabel>命名</FieldLabel>
              <select className="t8-select w-full px-2 py-1.5 text-xs" value={nameMode} onChange={(event) => update({ batchProcessorNameMode: event.target.value })} disabled={running}>
                <option value="original">用原名字</option>
                <option value="rename">改名字</option>
              </select>
            </div>
            <div className="min-w-0">
              <FieldLabel>格式</FieldLabel>
              <select className="t8-select w-full px-2 py-1.5 text-xs" value={outputFormat} onChange={(event) => update({ batchProcessorOutputFormat: event.target.value })} disabled={running}>
                <option value="keep">保持</option>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WEBP</option>
              </select>
            </div>
          </div>

          {nameMode === 'rename' && (
            <div className="min-w-0">
              <FieldLabel>改名模板</FieldLabel>
              <input className="t8-input w-full px-2 py-1.5 text-xs" value={renamePattern} onChange={(event) => update({ batchProcessorRenamePattern: event.target.value })} disabled={running} />
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <div className="min-w-0">
              <FieldLabel>扩图比例</FieldLabel>
              <select className="t8-select w-full px-2 py-1.5 text-xs" value={ratio} onChange={(event) => update({ batchProcessorTargetRatio: event.target.value })} disabled={running}>
                {RATIO_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <FieldLabel>放大倍数</FieldLabel>
              <select className="t8-select w-full px-2 py-1.5 text-xs" value={upscaleScale} onChange={(event) => update({ batchProcessorUpscaleScale: Number(event.target.value) })} disabled={running}>
                {[1.5, 2, 3, 4].map((item) => <option key={item} value={item}>{item}x</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <ToggleStep icon={<Scissors size={13} />} label="去除黑/白/透明边" active={Boolean(d.batchProcessorTrimBlackBars)} disabled={running} onChange={(value) => toggleStep('batchProcessorTrimBlackBars', value, '去除上下黑边')} />
            <ToggleStep icon={<Wand2 size={13} />} label="批量抠图" active={Boolean(d.batchProcessorRemoveBg)} disabled={running} onChange={(value) => toggleStep('batchProcessorRemoveBg', value, '批量抠图')} />
            <ToggleStep icon={<Maximize2 size={13} />} label="批量扩图" active={Boolean(d.batchProcessorExpandCanvas)} disabled={running} onChange={(value) => toggleStep('batchProcessorExpandCanvas', value, '批量扩图')} />
            <ToggleStep icon={<ZoomIn size={13} />} label="高清放大" active={Boolean(d.batchProcessorUpscale)} disabled={running} onChange={(value) => toggleStep('batchProcessorUpscale', value, '高清放大')} />
          </div>

          {Boolean(d.batchProcessorTrimBlackBars) && (
            <div className="rounded-md border p-2" style={{ borderColor: 'var(--t8-border)', background: 'var(--t8-bg-soft)' }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--t8-text-main)' }}>
                  <Scissors size={12} />
                  <span className="truncate">裁边设置</span>
                </div>
                <span className="shrink-0 text-[9px]" style={{ color: 'var(--t8-text-dim)' }}>
                  {trimStrategy === 'auto' ? `${trimModeLabel(trimMode)} · GAP ${trimThreshold}px` : '手动像素'}
                </span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <div className="min-w-0">
                  <FieldLabel>方式</FieldLabel>
                  <select className="t8-select w-full px-2 py-1.5 text-xs" value={trimStrategy} onChange={(event) => update({ batchProcessorTrimStrategy: event.target.value })} disabled={running}>
                    <option value="auto">自动检测</option>
                    <option value="manual">手动像素</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <FieldLabel>裁剪方向</FieldLabel>
                  <select className="t8-select w-full px-2 py-1.5 text-xs" value={trimAxis} onChange={(event) => update({ batchProcessorTrimAxis: event.target.value })} disabled={running}>
                    {TRIM_AXIS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
              </div>
              {trimStrategy === 'auto' ? (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    <div className="min-w-0">
                      <FieldLabel>边缘类型</FieldLabel>
                      <select className="t8-select w-full px-2 py-1.5 text-xs" value={trimMode} onChange={(event) => update({ batchProcessorTrimMode: event.target.value })} disabled={running}>
                        {TRIM_MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <FieldLabel>GAP 容差</FieldLabel>
                      <div className="flex items-center gap-2">
                        <input
                          className="nodrag nopan min-w-0 flex-1"
                          type="range"
                          min={0}
                          max={80}
                          step={1}
                          value={trimThreshold}
                          onChange={(event) => update({ batchProcessorTrimThreshold: Number(event.target.value) })}
                          disabled={running}
                          onMouseDown={(event) => event.stopPropagation()}
                        />
                        <span className="w-10 rounded px-1 py-0.5 text-center text-[10px] font-bold" style={{ background: 'var(--t8-bg-node)', color: 'var(--t8-text-main)' }}>{trimThreshold}px</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] leading-snug" style={{ color: 'var(--t8-text-dim)' }}>
                    自动检测黑边、白边或透明边；GAP 越大，对压缩噪点、阴影和轻微灰边越宽容。
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {[
                    ['Top', '上', 'batchProcessorTrimManualTop', trimManual.top],
                    ['Right', '右', 'batchProcessorTrimManualRight', trimManual.right],
                    ['Bottom', '下', 'batchProcessorTrimManualBottom', trimManual.bottom],
                    ['Left', '左', 'batchProcessorTrimManualLeft', trimManual.left],
                  ].map(([key, label, field, value]) => (
                    <label key={key} className="min-w-0">
                      <span className="mb-0.5 block text-[9px] font-semibold" style={{ color: 'var(--t8-text-muted)' }}>{label}</span>
                      <input
                        className="t8-input w-full px-1.5 py-1 text-xs"
                        type="number"
                        min={0}
                        max={9999}
                        value={Number(value)}
                        onChange={(event) => update({ [String(field)]: Math.max(0, Number(event.target.value || 0)) })}
                        disabled={running}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border p-2" style={{ borderColor: 'var(--t8-border)' }}>
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--t8-text-muted)' }}>
              <ImageIcon size={12} />
              完成反馈
            </div>
            <div className="max-h-40 space-y-1 overflow-auto pr-1">
              {resultItems.length === 0 ? (
                <div className="rounded border border-dashed px-2 py-3 text-center text-[11px]" style={{ borderColor: 'var(--t8-border)', color: 'var(--t8-text-dim)' }}>
                  尚无结果
                </div>
              ) : resultItems.map((item: BatchProcessorItem) => (
                <div key={`${item.id}:${item.outputName || item.name}`} className="rounded px-2 py-1" style={{ background: 'var(--t8-bg-soft)' }}>
                  <div className="flex items-center gap-1">
                    {item.status === 'success' ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-red-500" />}
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold" style={{ color: 'var(--t8-text-main)' }}>{item.outputName || item.name}</span>
                    <span className="text-[10px]" style={{ color: 'var(--t8-text-dim)' }}>{item.stepsDone?.join(' / ')}</span>
                  </div>
                  {item.trimInfo ? (
                    <div className="mt-0.5 text-[10px]" style={{ color: 'var(--t8-text-dim)' }}>
                      裁掉：上 {item.trimInfo.top}px / 右 {item.trimInfo.right}px / 下 {item.trimInfo.bottom}px / 左 {item.trimInfo.left}px，输出 {item.trimInfo.width}×{item.trimInfo.height}
                    </div>
                  ) : null}
                  {item.resultUrl ? (
                    <a className="block truncate text-[10px] underline" href={item.resultUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--t8-accent)' }}>{item.resultUrl}</a>
                  ) : item.error ? (
                    <div className="text-[10px]" style={{ color: '#ef4444' }}>{item.error}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border px-2 py-1.5 text-[10px] leading-relaxed" style={{ borderColor: 'var(--t8-border)', color: 'var(--t8-text-dim)' }}>
            开启后点击开始批处理；去除上下左右黑边/白边/透明边、纯色背景本地抠图、扩画布、格式转换和普通放大仅图像素材可用，视频/音频/3D 当前执行批量命名归档。
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(BatchProcessorNode);

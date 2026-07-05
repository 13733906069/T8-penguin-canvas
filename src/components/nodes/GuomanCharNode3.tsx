/**
 * GuomanCharNode3 - 清风-国漫角色放大
 *
 * 独立的 RunningHub 应用节点，webappId 固定为 2066150333931409410
 * 自动拉取应用参数，自定义表单 UI，支持上游文本/图像连接
 *
 * 参数：
 *   923::image      — 上传图像（单张图片上传）
 *   948::lora_name  — 角色模型（文本输入 + 模型选择器）
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useNodeConnections, useNodesData, useReactFlow, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { ZoomIn, Loader2, AlertCircle, Square, RefreshCw, Play, ChevronDown, Upload, X } from 'lucide-react';
import { submitRh, queryRh, fetchRhAppInfo, uploadRhAsset, uploadFile } from '../../services/generation';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useUpstreamMaterials } from './useUpstreamMaterials';
import { useThemeStore } from '../../stores/theme';
import { logBus } from '../../stores/logs';
import GuomanModelPickerModal from '../GuomanModelPickerModal';
import SmartImage from '../SmartImage';

// ========== 固定配置 ==========
const WEBAPP_ID = '2066150333931409410';
const APP_NAME = '清风-国漫角色放大';
const COLOR = '#06b6d4'; // cyan-500

// ========== 参数 key ==========
const paramKey = (nodeId: string | number, fieldName: string) => `${nodeId}::${fieldName}`;

// ========== 轮询全局去重 ==========
type PollEntry = { timer: number; promise: Promise<void> };
const activePolls = new Map<string, PollEntry>();
const pollKey = (nodeId: string, taskId: string) => `${nodeId}::${taskId}`;

function extractDefaultValue(it: any): string {
  let v = it?.fieldValue;
  if (Array.isArray(v)) v = v[0];
  if (v == null) return '';
  return typeof v === 'object' ? '' : String(v);
}

function inferValueType(fieldType: string | undefined): string {
  const t = String(fieldType || '').toUpperCase();
  if (t === 'IMAGE') return 'image';
  if (t === 'VIDEO') return 'video';
  if (t === 'AUDIO') return 'audio';
  if (t === 'NUMBER' || t === 'FLOAT' || t === 'INTEGER' || t === 'INT') return 'number';
  return 'text';
}

// ========== 主组件 ==========
const GuomanCharNode3 = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const updateNodeInternals = useUpdateNodeInternals();
  const rf = useReactFlow();
  const { theme } = useThemeStore();

  const appInfo = (data as any).appInfo || null;
  const paramValues: Record<string, { value: string; sourceFromUpstream?: boolean }> = (data as any).paramValues || {};
  const instanceType: string = (data as any).instanceType || 'plus';
  const status: string = (data as any).status || 'idle';
  const taskId: string = (data as any).taskId || '';
  const error: string = (data as any).error || '';
  const imageUrl: string = (data as any).imageUrl || '';

  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [visibleError, setVisibleError] = useState<string | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const currentPollKeyRef = useRef<string | null>(taskId ? pollKey(id, taskId) : null);

  const src = `[${APP_NAME}]`;
  const upstream = useUpstreamMaterials(id);
  const orderedImages = upstream.images;
  const orderedTexts = upstream.texts;
  const hasAutoOutput = useHasAutoOutput(id);

  // ========== 检测上游模型选择器连接 ==========
  const conns = useNodeConnections({ id, handleType: 'target' });
  const upstreamIds = useMemo(() => Array.from(new Set(conns.map((c) => c.source))), [conns]);
  const upstreamNodes = useNodesData(upstreamIds);

  // 找到上游的模型选择器节点
  // 找到上游的模型选择器节点 (单选选择器 或 循环选择器都识别)
  const modelSelectorNode = useMemo(() => {
    if (!Array.isArray(upstreamNodes)) return null;
    return upstreamNodes.find((n: any) =>
      n?.type === 'guoman-model-selector' || n?.type === 'guoman-model-loop-selector'
    ) || null;
  }, [upstreamNodes]);

  // 是否有上游模型选择器连接
  const hasModelSelectorUpstream = !!modelSelectorNode;

  // 从上游模型选择器获取模型名称
  const upstreamModelName = useMemo(() => {
    if (!modelSelectorNode) return '';
    const data = modelSelectorNode.data as any;
    return data?.modelName || data?.text || data?.prompt || '';
  }, [modelSelectorNode]);

  const updateParam = (key: string, value: string, sourceFromUpstream = false) => {
    update({ paramValues: { ...paramValues, [key]: { value, sourceFromUpstream } } });
  };

  const getVal = (nodeId: string, fieldName: string, fallback = ''): string => {
    return paramValues[paramKey(nodeId, fieldName)]?.value ?? fallback;
  };

  // ========== 监听上游模型选择器输出，自动填充模型字段 ==========
  useEffect(() => {
    const modelKey = paramKey('948', 'lora_name');

    if (hasModelSelectorUpstream && upstreamModelName) {
      // 有上游模型选择器连接，强制使用上游模型
      const currentModel = paramValues[modelKey]?.value;
      if (currentModel !== upstreamModelName) {
        updateParam(modelKey, upstreamModelName, true);
        logBus.info(`从上游模型选择器获取模型: ${upstreamModelName}`, src);
      }
    } else if (!hasModelSelectorUpstream) {
      // 没有上游模型选择器连接，清除来自上游的模型标记
      const modelData = paramValues[modelKey];
      if (modelData?.sourceFromUpstream) {
        updateParam(modelKey, modelData.value, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasModelSelectorUpstream, upstreamModelName]);

  // ========== 图片上传处理 ==========
  const inputImageKey = paramKey('923', 'image');
  const inputImageUrl = paramValues[inputImageKey]?.value || '';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setVisibleError(null);
    try {
      const result = await uploadFile(file);
      updateParam(inputImageKey, result.url);
      logBus.success(`图片上传成功`, src);
    } catch (err: any) {
      setVisibleError(err?.message || '图片上传失败');
      logBus.error(`图片上传失败: ${err?.message}`, src);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    updateParam(inputImageKey, '');
    // 只断开非模型选择器的上游连线（保留模型选择器连接）
    rf.setEdges((eds) => eds.filter((e) => {
      if (e.target !== id) return true;
      const sourceNode = rf.getNode(e.source);
      return sourceNode?.type === 'guoman-model-selector';
    }));
  };

  // ========== 拉取应用信息 ==========
  const handleFetchInfo = async () => {
    setVisibleError(null);
    setFetchingInfo(true);
    try {
      const info = await fetchRhAppInfo(WEBAPP_ID);
      const list: any[] = info?.nodeInfoList || [];
      logBus.info(`拉取应用信息 · ${list.length} 个字段`, src);
      const next: Record<string, { value: string; sourceFromUpstream?: boolean }> = { ...paramValues };
      for (const it of list) {
        const k = paramKey(it.nodeId, it.fieldName);
        if (k in next) continue;
        const vt = inferValueType(it?.fieldType);
        if (vt === 'image' || vt === 'video' || vt === 'audio') {
          next[k] = { value: '', sourceFromUpstream: false };
        } else {
          next[k] = { value: extractDefaultValue(it) };
        }
      }
      // 处理上游图像：有则填充，无则清空
      const images = orderedImages.map((m: { url?: string }) => m.url || '').filter(Boolean);
      const imageKey = paramKey('923', 'image');
      if (images.length > 0 && !next[imageKey]?.value) {
        next[imageKey] = { value: images[0], sourceFromUpstream: true };
        logBus.info(`自动填充上游图像`, src);
      } else if (images.length === 0 && next[imageKey]?.sourceFromUpstream) {
        next[imageKey] = { value: '', sourceFromUpstream: false };
        logBus.info(`上游连接断开，清空图像`, src);
      }
      update({ appInfo: info, paramValues: next });
    } catch (e: any) {
      setVisibleError(e?.message || '查询失败');
      logBus.error(`拉取应用信息失败: ${e?.message || e}`, src);
    } finally {
      setFetchingInfo(false);
    }
  };

  const autoFetchedRef = useRef(false);
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (appInfo?.nodeInfoList?.length) { autoFetchedRef.current = true; return; }
    autoFetchedRef.current = true;
    void handleFetchInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== 监听上游图像变化，自动填充/清空 ==========
  useEffect(() => {
    const images = orderedImages.map((m: { url?: string }) => m.url || '').filter(Boolean);
    if (images.length > 0) {
      if (!inputImageUrl) {
        updateParam(inputImageKey, images[0], true);
        logBus.info(`自动填充上游图像`, src);
      }
    } else {
      if (inputImageUrl && paramValues[inputImageKey]?.sourceFromUpstream) {
        updateParam(inputImageKey, '', false);
        logBus.info(`上游连接断开，清空图像`, src);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedImages]);

  // ========== 轮询 ==========
  const stopPoll = () => {
    const key = currentPollKeyRef.current;
    if (key) {
      const entry = activePolls.get(key);
      if (entry) { window.clearInterval(entry.timer); activePolls.delete(key); }
      currentPollKeyRef.current = null;
    }
  };

  const startPolling = (tid: string): Promise<void> => {
    const key = pollKey(id, tid);
    const existing = activePolls.get(key);
    if (existing) { currentPollKeyRef.current = key; return existing.promise; }
    stopPoll();
    currentPollKeyRef.current = key;
    let timer: number | null = null;
    const promise = new Promise<void>((resolve, reject) => {
      let elapsed = 0;
      const finish = (ok: boolean, err?: Error) => {
        if (timer != null) window.clearInterval(timer);
        if (activePolls.get(key)?.timer === timer) activePolls.delete(key);
        if (currentPollKeyRef.current === key) currentPollKeyRef.current = null;
        if (ok) resolve(); else reject(err || new Error('轮询失败'));
      };
      timer = window.setInterval(async () => {
        elapsed++;
        if (elapsed > 480) { update({ status: 'error', error: '轮询超时' }); setVisibleError('轮询超时'); finish(false, new Error('轮询超时')); return; }
        try {
          const r = await queryRh(tid);
          if (r.status === 'SUCCESS') {
            const list: string[] = Array.isArray(r.urls) ? r.urls : [];
            const isImg = (u: string) => /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(u);
            const firstImg = list.find(isImg) || list[0] || '';
            logBus.success(`任务完成 · ${list.length} 个输出`, src);
            update({ status: 'success', urls: list, imageUrl: firstImg });
            finish(true);
          } else if (r.status === 'FAILED') {
            const fr: any = r.failReason;
            const reason = typeof fr === 'string' ? fr : fr?.exception_message || fr?.message || `RH 失败 code=${r.code}`;
            update({ status: 'error', error: reason }); setVisibleError(reason); finish(false, new Error(reason));
          } else {
            update({ status: 'polling', rhCode: r.code });
          }
        } catch (e: any) { logBus.warn(`轮询出错: ${e?.message}`, src); }
      }, 5000);
    });
    if (timer != null) activePolls.set(key, { timer, promise });
    return promise;
  };

  // ========== 提交 ==========
  const handleRun = async () => {
    setVisibleError(null);
    if (!appInfo?.nodeInfoList?.length) {
      await handleFetchInfo();
      if (!appInfo?.nodeInfoList?.length) { setVisibleError('无法获取应用信息'); return; }
    }
    if (!inputImageUrl) {
      setVisibleError('请先上传图像');
      return;
    }
    update({ status: 'submitting', error: null, urls: [], imageUrl: '' });
    try {
      const nodeInfoList: any[] = [];
      for (const it of appInfo.nodeInfoList) {
        const k = paramKey(it.nodeId, it.fieldName);
        let fieldValue: any = paramValues[k]?.value ?? extractDefaultValue(it);
        const vt = inferValueType(it?.fieldType);
        if (vt === 'image' || vt === 'video' || vt === 'audio') {
          // 支持多种 URL 格式：http(s)、本地路径（/files/output/、/files/input/、/output/、/input/）
          // 本地路径会先通过 uploadRhAsset 转成 RH 云端文件名再提交
          const isUrlLike =
            /^https?:\/\//i.test(fieldValue || '') ||
            (typeof fieldValue === 'string' && (
              fieldValue.startsWith('/files/output/') ||
              fieldValue.startsWith('/output/') ||
              fieldValue.startsWith('/files/input/') ||
              fieldValue.startsWith('/input/')
            ));
          if (fieldValue && isUrlLike) {
            try { const r = await uploadRhAsset(fieldValue); fieldValue = r.fileName; } catch {}
          }
        } else if (vt === 'number') {
          const num = Number(fieldValue);
          fieldValue = Number.isFinite(num) ? num : fieldValue;
        }
        if (String(it?.fieldType || '').toUpperCase() === 'BOOLEAN') {
          fieldValue = fieldValue === 'true' || fieldValue === '1' || fieldValue === true;
        }
        nodeInfoList.push({ nodeId: it.nodeId, fieldName: it.fieldName, fieldValue });
      }
      logBus.info(`提交任务 · ${nodeInfoList.length} 个字段`, src);
      console.log('[清风-国漫角色放大] 提交参数:', JSON.stringify(nodeInfoList, null, 2));
      const r = await submitRh({ webappId: WEBAPP_ID, nodeInfoList, instanceType: instanceType || undefined });
      logBus.success(`任务已提交 taskId=${r.taskId}`, src);
      update({ status: 'polling', taskId: r.taskId });
      await startPolling(r.taskId);
    } catch (e: any) {
      logBus.error(`提交失败: ${e?.message}`, src);
      setVisibleError(e?.message || '提交失败');
      update({ status: 'error', error: e?.message });
    }
  };

  useRunTrigger(id, async () => {
    if (status === 'submitting' || status === 'polling') return;
    await handleRun();
  });

  const handleStop = () => { stopPoll(); update({ status: 'idle' }); };

  // ========== 副作用 ==========
  const isBusy = status === 'submitting' || status === 'polling';
  const nodeInfoList: any[] = appInfo?.nodeInfoList || [];

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => updateNodeInternals(id));
    return () => window.cancelAnimationFrame(raf);
  }, [id, updateNodeInternals, status, selected]);

  useEffect(() => {
    if (status !== 'polling' || !taskId) return;
    void startPolling(taskId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, taskId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopPoll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== 主题 ==========
  const isDark = theme === 'dark';
  const bg = isDark ? 'rgba(20,20,22,.95)' : 'rgba(255,255,255,.97)';
  const textColor = isDark ? '#f4f4f5' : '#18181b';
  const mutedColor = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
  const borderColor = selected ? COLOR : isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';

  return (
    <div
      style={{
        background: bg,
        backdropFilter: 'blur(12px)',
        width: 300,
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        boxShadow: selected ? `0 0 0 1px ${COLOR}, 0 16px 40px rgba(6,182,212,.18)` : undefined,
        overflow: 'hidden',
        transition: 'border-color .2s, box-shadow .2s',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: COLOR, border: 0, zIndex: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: COLOR, border: 0, zIndex: 10 }} />

      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
        background: 'linear-gradient(135deg, rgba(6,182,212,.12), transparent)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,182,212,.2)', color: '#22d3ee', boxShadow: `inset 0 0 0 1px ${COLOR}`,
        }}>
          <ZoomIn size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {APP_NAME}
          </div>
          <div style={{ fontSize: 10, color: mutedColor, lineHeight: 1.3 }}>
            {status === 'idle' && '就绪'}
            {status === 'submitting' && '提交中…'}
            {status === 'polling' && '生成中…'}
            {status === 'success' && '✅ 完成'}
            {status === 'error' && '❌ 出错'}
          </div>
        </div>
        <button
          onClick={() => { autoFetchedRef.current = false; void handleFetchInfo(); }}
          disabled={fetchingInfo || isBusy} title="重新拉取参数"
          style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${inputBorder}`, background: 'transparent', color: mutedColor, cursor: fetchingInfo ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fetchingInfo || isBusy ? 0.4 : 1 }}
        >
          <RefreshCw size={12} style={{ animation: fetchingInfo ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {/* 内容区 */}
      <div style={{ padding: '10px 12px', maxHeight: 500, overflowY: 'auto' }}>
        {fetchingInfo && !appInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '16px 0', justifyContent: 'center', color: mutedColor }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 11 }}>正在获取参数…</span>
          </div>
        )}

        {/* 上传图像（单张上传） */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>上传图像</span>
            <span style={{ fontSize: 9, color: mutedColor, marginLeft: 'auto' }}>#923</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {inputImageUrl ? (
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1px solid ${inputBorder}` }}>
              <SmartImage
                src={inputImageUrl}
                alt="待放大图像"
                style={{ width: '100%', display: 'block', maxHeight: 150, objectFit: 'contain', background: '#000' }}
                thumbSize={300}
              />
              <button
                onClick={handleRemoveImage}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(239,68,68,.8)', border: 'none', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="移除图片"
              >
                <X size={12} />
              </button>
              {paramValues[inputImageKey]?.sourceFromUpstream && (
                <span style={{
                  position: 'absolute', top: 4, left: 4, fontSize: 9, padding: '1px 4px', borderRadius: 3,
                  background: 'rgba(56,189,248,.15)', color: '#38bdf8', fontWeight: 600,
                }}>
                  上游
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isBusy}
              style={{
                width: '100%', height: 80, borderRadius: 8, border: `2px dashed ${inputBorder}`,
                background: inputBg, color: mutedColor, cursor: uploading ? 'wait' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                opacity: uploading || isBusy ? 0.6 : 1,
              }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 10 }}>上传中…</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span style={{ fontSize: 10 }}>点击上传图像</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 角色模型（带模型选择器） */}
        {nodeInfoList.filter((it: any) => it.nodeId === '948').map((it: any, i: number) => {
          const k = paramKey(it.nodeId, it.fieldName);
          const value = paramValues[k]?.value ?? extractDefaultValue(it);
          const isFromUpstream = paramValues[k]?.sourceFromUpstream === true;
          return (
            <div key={`model-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>角色模型</span>
                {isFromUpstream && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(56,189,248,.15)', color: '#38bdf8', fontWeight: 600 }}>上游</span>}
                <span style={{ fontSize: 9, color: mutedColor, marginLeft: 'auto' }}>#948</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="text" value={value} onChange={(e) => updateParam(k, e.target.value)} placeholder={it.description} disabled={hasModelSelectorUpstream}
                  style={{ flex: 1, height: 28, padding: '0 8px', fontSize: 11, color: textColor, background: hasModelSelectorUpstream ? (isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)') : inputBg, border: `1px solid ${inputBorder}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box', opacity: hasModelSelectorUpstream ? 0.7 : 1, cursor: hasModelSelectorUpstream ? 'not-allowed' : 'text' }}
                />
                <button onClick={() => setModelPickerOpen(true)} title="选择模型" disabled={hasModelSelectorUpstream}
                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${inputBorder}`, background: isDark ? 'rgba(6,182,212,.1)' : 'rgba(6,182,212,.06)', color: '#22d3ee', cursor: hasModelSelectorUpstream ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: hasModelSelectorUpstream ? 0.5 : 1 }}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {/* 实例类型 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: textColor, marginBottom: 3 }}>实例类型</div>
          <select value={instanceType} onChange={(e) => update({ instanceType: e.target.value })}
            style={{ width: '100%', height: 28, fontSize: 11, color: textColor, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 6, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <option value="default">默认</option>
            <option value="plus">Plus（推荐）</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        {/* 进度条 */}
        {isBusy && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${COLOR}, #22d3ee)`, animation: 'guoman-progress 2s ease-in-out infinite', width: '40%' }} />
            </div>
            <div style={{ fontSize: 10, color: mutedColor, marginTop: 4, textAlign: 'center' }}>
              {status === 'submitting' ? '正在提交任务…' : 'AI 正在生成，请耐心等待…'}
            </div>
          </div>
        )}

        {/* 错误 */}
        {(visibleError || error) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', marginBottom: 8 }}>
            <AlertCircle size={12} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 10, color: '#ef4444', lineHeight: 1.4, wordBreak: 'break-all' }}>{visibleError || error}</span>
          </div>
        )}

        {/* 输出预览 */}
        {!hasAutoOutput && imageUrl && (
          <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', border: `1px solid ${inputBorder}` }}>
            <SmartImage src={imageUrl} alt="放大结果" style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'contain', background: '#000' }} thumbSize={400} />
          </div>
        )}

        {/* 运行/停止 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {isBusy ? (
            <button onClick={handleStop}
              style={{ flex: 1, height: 32, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,.15)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Square size={12} /> 停止
            </button>
          ) : (
            <button onClick={handleRun}
              style={{ flex: 1, height: 32, borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${COLOR}, #22d3ee)`, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, boxShadow: '0 2px 8px rgba(6,182,212,.3)' }}
            >
              <Play size={12} /> 运行
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes guoman-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
      `}</style>

      <GuomanModelPickerModal
        open={modelPickerOpen}
        onClose={() => setModelPickerOpen(false)}
        onSelect={(modelName) => updateParam(paramKey('948', 'lora_name'), modelName)}
        currentModel={getVal('948', 'lora_name')}
      />
    </div>
  );
};

export default memo(GuomanCharNode3);

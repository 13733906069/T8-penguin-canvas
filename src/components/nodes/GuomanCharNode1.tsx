/**
 * GuomanCharNode1 - 清风-国漫角色文生图
 *
 * 独立的 RunningHub 应用节点，webappId 固定为 2066139220363800578
 * 自动拉取应用参数，自定义表单 UI，支持上游文本/图像连接
 *
 * 参数：
 *   1569::lora_name  — 角色模型（文本输入 + 模型选择器）
 *   1643::text       — 角色外观（多行文本）
 *   1644::value      — 是否随机动作（默认关闭，内部处理）
 *   1646::text       — 动作提示词（多行文本）
 *   1496::text       — 背景提示词（多行文本）
 *   577::width       — 宽度（数字）
 *   577::height      — 高度（数字）
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { Palette, Loader2, AlertCircle, Square, RefreshCw, Play, ChevronDown } from 'lucide-react';
import { submitRh, queryRh, fetchRhAppInfo, uploadRhAsset } from '../../services/generation';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useHasAutoOutput } from './useHasAutoOutput';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useUpstreamMaterials } from './useUpstreamMaterials';
import { useThemeStore } from '../../stores/theme';
import { logBus } from '../../stores/logs';
import GuomanModelPickerModal from '../GuomanModelPickerModal';

// ========== 固定配置 ==========
const WEBAPP_ID = '2066139220363800578';
const APP_NAME = '清风-国漫角色文生图';
const COLOR = '#f97316';

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
const GuomanCharNode1 = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const updateNodeInternals = useUpdateNodeInternals();
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
  const mountedRef = useRef(true);
  const currentPollKeyRef = useRef<string | null>(taskId ? pollKey(id, taskId) : null);

  const src = `[${APP_NAME}]`;
  const upstream = useUpstreamMaterials(id);
  const orderedTexts = upstream.texts;
  const hasAutoOutput = useHasAutoOutput(id);

  const getUpstreamTexts = (): string[] => {
    return orderedTexts.map((m: { url?: string; label?: string }) => m.url || m.label || '').filter(Boolean);
  };

  const updateParam = (key: string, value: string) => {
    update({ paramValues: { ...paramValues, [key]: { value } } });
  };

  const getVal = (nodeId: string, fieldName: string, fallback = ''): string => {
    return paramValues[paramKey(nodeId, fieldName)]?.value ?? fallback;
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
          next[k] = { value: '', sourceFromUpstream: true };
        } else {
          next[k] = { value: extractDefaultValue(it) };
        }
      }
      const texts = getUpstreamTexts();
      if (texts.length > 0) {
        const appKey = paramKey('1643', 'text');
        if (next[appKey] && !next[appKey].value && texts[0]) next[appKey] = { value: texts[0], sourceFromUpstream: true };
        const actKey = paramKey('1646', 'text');
        if (next[actKey] && !next[actKey].value && texts[1]) next[actKey] = { value: texts[1], sourceFromUpstream: true };
        const bgKey = paramKey('1496', 'text');
        if (next[bgKey] && !next[bgKey].value && texts[2]) next[bgKey] = { value: texts[2], sourceFromUpstream: true };
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
    update({ status: 'submitting', error: null, urls: [], imageUrl: '' });
    try {
      const nodeInfoList: any[] = [];
      for (const it of appInfo.nodeInfoList) {
        const k = paramKey(it.nodeId, it.fieldName);
        let fieldValue = paramValues[k]?.value ?? extractDefaultValue(it);
        const vt = inferValueType(it?.fieldType);
        if (vt === 'image' || vt === 'video' || vt === 'audio') {
          if (fieldValue && /^https?:\/\//i.test(fieldValue)) {
            try { const r = await uploadRhAsset(fieldValue); fieldValue = r.fileName; } catch {}
          }
        } else if (vt === 'number') {
          // 数字类型：传真正的数字，与 RH 超市 coerceFieldValue 一致
          const num = Number(fieldValue);
          fieldValue = Number.isFinite(num) ? num : fieldValue;
        }
        // 布尔类型：传真正的布尔值，与 RH 超市 coerceFieldValue 一致
        if (String(it?.fieldType || '').toUpperCase() === 'BOOLEAN') {
          fieldValue = fieldValue === 'true' || fieldValue === '1' || fieldValue === true;
        }
        nodeInfoList.push({ nodeId: it.nodeId, fieldName: it.fieldName, fieldValue });
      }
      logBus.info(`提交任务 · ${nodeInfoList.length} 个字段`, src);
      // 调试：打印提交参数，方便对比 RH 超市
      console.log('[国漫节点] 提交参数:', JSON.stringify(nodeInfoList, null, 2));
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
        boxShadow: selected ? `0 0 0 1px ${COLOR}, 0 16px 40px rgba(249,115,22,.18)` : undefined,
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
        background: 'linear-gradient(135deg, rgba(249,115,22,.12), transparent)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(249,115,22,.2)', color: '#fb923c', boxShadow: `inset 0 0 0 1px ${COLOR}`,
        }}>
          <Palette size={14} />
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

        {/* 角色模型（带模型选择器） */}
        {nodeInfoList.filter((it: any) => it.nodeId === '1569').map((it: any, i: number) => {
          const k = paramKey(it.nodeId, it.fieldName);
          const value = paramValues[k]?.value ?? extractDefaultValue(it);
          return (
            <div key={`model-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>角色模型</span>
                <span style={{ fontSize: 9, color: mutedColor, marginLeft: 'auto' }}>#1569</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="text" value={value} onChange={(e) => updateParam(k, e.target.value)} placeholder={it.description}
                  style={{ flex: 1, height: 28, padding: '0 8px', fontSize: 11, color: textColor, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
                />
                <button onClick={() => setModelPickerOpen(true)} title="选择模型"
                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${inputBorder}`, background: isDark ? 'rgba(249,115,22,.1)' : 'rgba(249,115,22,.06)', color: '#fb923c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {/* 角色外观 */}
        {nodeInfoList.filter((it: any) => it.nodeId === '1643').map((it: any, i: number) => {
          const k = paramKey(it.nodeId, it.fieldName);
          const value = paramValues[k]?.value ?? extractDefaultValue(it);
          const isFromUpstream = paramValues[k]?.sourceFromUpstream === true;
          return (
            <div key={`appearance-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>角色外观</span>
                {isFromUpstream && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(56,189,248,.15)', color: '#38bdf8', fontWeight: 600 }}>上游</span>}
                <span style={{ fontSize: 9, color: mutedColor, marginLeft: 'auto' }}>#1643</span>
              </div>
              <textarea value={value} onChange={(e) => updateParam(k, e.target.value)} placeholder={it.description} rows={3}
                style={{ width: '100%', minHeight: 56, padding: '6px 8px', fontSize: 11, lineHeight: 1.5, color: textColor, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          );
        })}

        {/* 随机动作开关 */}
        {nodeInfoList.filter((it: any) => it.nodeId === '1644').map((it: any) => {
          const k = paramKey(it.nodeId, it.fieldName);
          const value = paramValues[k]?.value ?? extractDefaultValue(it);
          return (
            <div key="random-action" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>随机动作</span>
              <button onClick={() => updateParam(k, value === 'true' ? 'false' : 'true')}
                style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: value === 'true' ? COLOR : isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)', position: 'relative', transition: 'background .2s' }}
              >
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value === 'true' ? 18 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </button>
              <span style={{ fontSize: 10, color: mutedColor }}>{value === 'true' ? '开启' : '关闭'}</span>
              <span style={{ fontSize: 9, color: mutedColor, marginLeft: 'auto' }}>#1644</span>
            </div>
          );
        })}

        {/* 动作提示词 */}
        {nodeInfoList.filter((it: any) => it.nodeId === '1646').map((it: any, i: number) => {
          const k = paramKey(it.nodeId, it.fieldName);
          const value = paramValues[k]?.value ?? extractDefaultValue(it);
          const isFromUpstream = paramValues[k]?.sourceFromUpstream === true;
          return (
            <div key={`action-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>动作提示词</span>
                {isFromUpstream && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(56,189,248,.15)', color: '#38bdf8', fontWeight: 600 }}>上游</span>}
                <span style={{ fontSize: 9, color: mutedColor, marginLeft: 'auto' }}>#1646</span>
              </div>
              <textarea value={value} onChange={(e) => updateParam(k, e.target.value)} placeholder={it.description} rows={2}
                style={{ width: '100%', minHeight: 44, padding: '6px 8px', fontSize: 11, lineHeight: 1.5, color: textColor, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          );
        })}

        {/* 背景提示词 */}
        {nodeInfoList.filter((it: any) => it.nodeId === '1496').map((it: any, i: number) => {
          const k = paramKey(it.nodeId, it.fieldName);
          const value = paramValues[k]?.value ?? extractDefaultValue(it);
          const isFromUpstream = paramValues[k]?.sourceFromUpstream === true;
          return (
            <div key={`bg-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>背景提示词</span>
                {isFromUpstream && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(56,189,248,.15)', color: '#38bdf8', fontWeight: 600 }}>上游</span>}
                <span style={{ fontSize: 9, color: mutedColor, marginLeft: 'auto' }}>#1496</span>
              </div>
              <textarea value={value} onChange={(e) => updateParam(k, e.target.value)} placeholder={it.description} rows={2}
                style={{ width: '100%', minHeight: 44, padding: '6px 8px', fontSize: 11, lineHeight: 1.5, color: textColor, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          );
        })}

        {/* 宽度/高度 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {nodeInfoList.filter((it: any) => it.nodeId === '577').map((it: any, i: number) => {
            const k = paramKey(it.nodeId, it.fieldName);
            const value = paramValues[k]?.value ?? extractDefaultValue(it);
            return (
              <div key={`dim-${i}`} style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: textColor, marginBottom: 3 }}>{it.fieldName === 'width' ? '宽度' : '高度'}</div>
                <input type="number" value={value} onChange={(e) => updateParam(k, e.target.value)} min={16} max={16384} step={8}
                  style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 11, color: textColor, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            );
          })}
        </div>

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
              <div style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${COLOR}, #fb923c)`, animation: 'guoman-progress 2s ease-in-out infinite', width: '40%' }} />
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
            <img src={imageUrl} alt="生成结果" style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'contain', background: '#000' }} />
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
              style={{ flex: 1, height: 32, borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${COLOR}, #fb923c)`, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, boxShadow: '0 2px 8px rgba(249,115,22,.3)' }}
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
        onSelect={(modelName) => updateParam(paramKey('1569', 'lora_name'), modelName)}
        currentModel={getVal('1569', 'lora_name')}
      />
    </div>
  );
};

export default memo(GuomanCharNode1);

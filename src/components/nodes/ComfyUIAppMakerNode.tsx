import { memo, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CheckCircle2, Clipboard, Download, FileJson, Save, Upload, XCircle } from 'lucide-react';
import { PORT_COLOR } from '../../config/portTypes';
import { COMFYUI_APP_MANIFEST } from '../../data/comfyuiAppManifest';
import { useThemeStore } from '../../stores/theme';
import {
  COMFY_APP_SOURCE_LABELS,
  buildComfyAppFromWorkflow,
  normalizeComfyAppManifest,
  saveComfyApp,
} from '../../utils/comfyuiApps';
import { analyzeComfyWorkflow } from '../../utils/comfyuiWorkflow';
import { useUpdateNodeData } from './useUpdateNodeData';
import ResizableCorners from './ResizableCorners';

const handleStyle: CSSProperties = {
  width: 12,
  height: 12,
  border: 'none',
  zIndex: 20,
};

function parseWorkflow(raw: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(raw || '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ComfyUIAppMakerNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { theme, style } = useThemeStore();
  const isLight = theme === 'light';
  const isPixel = style === 'pixel';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState('');

  const d = (data || {}) as any;
  const size = d.size && typeof d.size.w === 'number' ? d.size : { w: 720, h: 620 };
  const workflowRaw = String(d.comfyMakerWorkflowRaw || '');
  const workflowJson = useMemo(() => parseWorkflow(workflowRaw), [workflowRaw]);
  const analysis = useMemo(() => analyzeComfyWorkflow(workflowJson || null), [workflowJson]);
  const categories = useMemo(() => normalizeComfyAppManifest(COMFYUI_APP_MANIFEST).categories, []);
  const app = useMemo(() => (
    workflowJson
      ? buildComfyAppFromWorkflow({
        workflowJson,
        title: d.comfyMakerTitle || 'Anima 文生图',
        id: d.comfyMakerAppId || '',
        categoryId: d.comfyMakerCategoryId || categories[0]?.id || 'general',
        description: d.comfyMakerDescription || '',
      })
      : null
  ), [workflowJson, d.comfyMakerTitle, d.comfyMakerAppId, d.comfyMakerCategoryId, d.comfyMakerDescription, categories]);

  const bg = isPixel ? 'var(--px-surface)' : isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.96)';
  const text = isPixel ? 'var(--px-ink)' : isLight ? '#0f172a' : '#e5f7fb';
  const sub = isPixel ? 'var(--px-ink-soft)' : isLight ? '#64748b' : 'rgba(229,247,251,0.62)';
  const border = isPixel ? 'var(--px-ink)' : isLight ? 'rgba(14,165,233,0.25)' : 'rgba(103,232,249,0.24)';
  const accent = '#67e8f9';

  const rootStyle: CSSProperties = {
    width: size.w,
    height: size.h,
    minWidth: 520,
    minHeight: 460,
    background: bg,
    color: text,
    border: `2px solid ${selected ? accent : border}`,
    borderRadius: isPixel ? 8 : 14,
    overflow: 'hidden',
    boxShadow: isPixel ? '3px 3px 0 var(--px-ink)' : 'var(--t8-node-shadow, 0 12px 30px rgba(0,0,0,0.28))',
  };
  const inputCls = isPixel
    ? 'px-input w-full text-xs px-2 py-1'
    : 'w-full rounded border px-2 py-1 text-xs outline-none';
  const inputStyle: CSSProperties = isPixel
    ? {}
    : {
      background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.06)',
      borderColor: border,
      color: text,
    };
  const btnCls = isPixel
    ? 'px-btn text-[11px] px-2 py-1 inline-flex items-center justify-center gap-1'
    : 'rounded border px-2 py-1 text-[11px] inline-flex items-center justify-center gap-1';

  const setRaw = (raw: string) => {
    update({ comfyMakerWorkflowRaw: raw });
    setStatus('');
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      setRaw(raw);
      if (!d.comfyMakerTitle) {
        update({ comfyMakerTitle: file.name.replace(/\.json$/i, '').slice(0, 80) });
      }
      setStatus('已读取 workflow JSON，下面会显示自动识别结果。');
    };
    reader.onerror = () => setStatus('读取文件失败。');
    reader.readAsText(file, 'utf-8');
  };

  const handleSave = async () => {
    if (!app) {
      setStatus('请先上传或粘贴有效的 ComfyUI API Workflow JSON。');
      return;
    }
    saveComfyApp(app);
    const textJson = JSON.stringify({
      schema: 't8-comfyui-app-manifest',
      version: 1,
      categories: categories.filter((category) => category.id === app.categoryId),
      apps: [app],
    }, null, 2);
    update({ text: textJson, outputText: textJson });
    setStatus('已保存到 ComfyUI超市，添加或刷新超市节点即可使用。');
  };

  const appJson = app ? JSON.stringify({
    schema: 't8-comfyui-app-manifest',
    version: 1,
    categories: categories.filter((category) => category.id === app.categoryId),
    apps: [app],
  }, null, 2) : '';

  return (
    <div style={rootStyle} className="relative nodrag nowheel">
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: border }}>
        <div className="flex h-8 w-8 items-center justify-center rounded border" style={{ borderColor: accent, color: accent }}>
          <FileJson size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black">ComfyUI应用制作工具</div>
          <div className="truncate text-[11px]" style={{ color: sub }}>
            上传 API Workflow JSON，自动生成可复用应用
          </div>
        </div>
        <button type="button" className={btnCls} style={inputStyle} onClick={() => fileInputRef.current?.click()}>
          <Upload size={12} /> 上传 JSON
        </button>
      </div>

      <div className="h-[calc(100%-58px)] overflow-auto p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-bold" style={{ color: sub }}>应用名称</span>
            <input
              value={d.comfyMakerTitle || ''}
              onChange={(e) => update({ comfyMakerTitle: e.target.value })}
              className={inputCls}
              style={inputStyle}
              placeholder="例如 Anima 文生图"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold" style={{ color: sub }}>稳定 ID</span>
            <input
              value={d.comfyMakerAppId || ''}
              onChange={(e) => update({ comfyMakerAppId: e.target.value })}
              className={inputCls}
              style={inputStyle}
              placeholder="留空会按名称自动生成"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold" style={{ color: sub }}>分类</span>
            <select
              value={d.comfyMakerCategoryId || categories[0]?.id || 'general'}
              onChange={(e) => update({ comfyMakerCategoryId: e.target.value })}
              className={inputCls}
              style={inputStyle}
            >
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold" style={{ color: sub }}>说明</span>
            <input
              value={d.comfyMakerDescription || ''}
              onChange={(e) => update({ comfyMakerDescription: e.target.value })}
              className={inputCls}
              style={inputStyle}
              placeholder="给自己看的简短说明"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-bold" style={{ color: sub }}>Workflow JSON</span>
          <textarea
            value={workflowRaw}
            onChange={(e) => setRaw(e.target.value)}
            className={`${inputCls} min-h-[120px] resize-y font-mono leading-relaxed`}
            style={inputStyle}
            placeholder='粘贴 ComfyUI API Workflow JSON，例如 {"1":{"class_type":"CLIPTextEncode","inputs":{"text":""}}}'
          />
          <span className="block text-[10px]" style={{ color: sub }}>
            需要 ComfyUI 开启 dev mode 后导出的 API workflow，不是普通前端 workflow。
          </span>
        </label>

        <div className="rounded border p-2" style={{ borderColor: border, background: isLight ? 'rgba(14,165,233,0.06)' : 'rgba(103,232,249,0.08)' }}>
          <div className="flex items-center gap-2">
            {workflowJson ? <CheckCircle2 size={14} color="#22c55e" /> : <XCircle size={14} color="#f87171" />}
            <span className="text-xs font-black">自动识别结果</span>
          </div>
          <div className="mt-1 text-[11px]" style={{ color: sub }}>
            字段 {analysis.fields.length} 个 · 图片输入 {analysis.imageInputCount} · 视频输入 {analysis.videoInputCount} · 音频输入 {analysis.audioInputCount} · 输出节点 {analysis.outputCount}
          </div>
          {analysis.warnings.slice(0, 3).map((warning, index) => (
            <div key={index} className="mt-1 text-[10px] text-amber-500">{warning}</div>
          ))}
        </div>

        {app && (
          <div className="space-y-2">
            <div className="text-xs font-black">新手参数面板预览</div>
            <div className="grid grid-cols-2 gap-1.5">
              {app.userParams.map((param) => (
                <div key={param.key} className="rounded border px-2 py-1" style={{ borderColor: border }}>
                  <div className="truncate text-[11px] font-bold">{param.label}</div>
                  <div className="truncate text-[10px]" style={{ color: sub }}>
                    {COMFY_APP_SOURCE_LABELS[param.source] || param.source} · {param.kind} · 默认 {String(param.defaultValue ?? '空').slice(0, 28)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnCls} style={inputStyle} onClick={handleSave}>
            <Save size={12} /> 保存到超市
          </button>
          <button
            type="button"
            className={btnCls}
            style={inputStyle}
            disabled={!appJson}
            onClick={() => {
              navigator.clipboard?.writeText(appJson);
              setStatus('已复制应用 JSON。');
            }}
          >
            <Clipboard size={12} /> 复制 JSON
          </button>
          <button
            type="button"
            className={btnCls}
            style={inputStyle}
            disabled={!appJson}
            onClick={() => downloadText(`${app?.id || 'comfyui-app'}.json`, appJson)}
          >
            <Download size={12} /> 导出 JSON
          </button>
        </div>

        {status && <div className="rounded border px-2 py-1 text-[11px]" style={{ borderColor: border, color: sub }}>{status}</div>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.currentTarget.value = '';
        }}
      />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: PORT_COLOR.text }} />
      <ResizableCorners
        selected={selected}
        minWidth={520}
        minHeight={460}
        accent={accent}
        keepAspectRatio={false}
        onResize={(_, params) => update({ size: { w: Math.round(params.width), h: Math.round(params.height) } })}
        onResizeEnd={(_, params) => update({ size: { w: Math.round(params.width), h: Math.round(params.height) } })}
      />
    </div>
  );
};

export default memo(ComfyUIAppMakerNode);

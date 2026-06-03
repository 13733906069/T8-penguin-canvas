import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertCircle, ArrowLeft, Boxes, Loader2, Play, RefreshCw, Search, Workflow } from 'lucide-react';
import { PORT_COLOR } from '../../config/portTypes';
import { COMFYUI_APP_MANIFEST } from '../../data/comfyuiAppManifest';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { runComfyuiApp } from '../../services/comfyuiApps';
import { useApiKeysStore } from '../../stores/apiKeys';
import { logBus } from '../../stores/logs';
import { taskCompletionSound } from '../../stores/taskCompletionSound';
import { useThemeStore } from '../../stores/theme';
import {
  COMFY_APP_ALL_CATEGORY_ID,
  COMFY_APP_MANIFEST_EVENT,
  comfyAppInputRequirements,
  defaultComfyAppParamValues,
  filterComfyApps,
  getComfyProviderBaseUrl,
  getUserComfyAppManifest,
  importComfyAppPayload,
  mergeComfyAppManifests,
  saveComfyApp,
  type ComfyAppDefinition,
} from '../../utils/comfyuiApps';
import {
  countExcludedMaterials,
  excludeMaterialId,
  filterExcludedMaterials,
  normalizeExcludedMaterialIds,
} from '../../utils/materialExclusion';
import MaterialPreviewSection from './MaterialPreviewSection';
import ResizableCorners from './ResizableCorners';
import { useOrderedMaterials } from './useOrderedMaterials';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useUpstreamMaterials, type Material } from './useUpstreamMaterials';

const handleStyle: CSSProperties = {
  width: 12,
  height: 12,
  border: 'none',
  zIndex: 20,
};

function parseInputValue(kind: string, value: any) {
  if (kind === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : '';
  }
  if (kind === 'boolean') return value === true;
  return value ?? '';
}

const ComfyUIStoreNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { theme, style } = useThemeStore();
  const isLight = theme === 'light';
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';
  const d = (data || {}) as any;
  const [manifest, setManifest] = useState(() => mergeComfyAppManifests(COMFYUI_APP_MANIFEST, getUserComfyAppManifest()));
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    const refresh = () => setManifest(mergeComfyAppManifests(COMFYUI_APP_MANIFEST, getUserComfyAppManifest()));
    window.addEventListener(COMFY_APP_MANIFEST_EVENT, refresh);
    return () => window.removeEventListener(COMFY_APP_MANIFEST_EVENT, refresh);
  }, []);

  const advancedProviders = useApiKeysStore((s) => s.settings.advancedProviders);
  const comfyProviders = useMemo(
    () => (advancedProviders || []).filter((provider) => provider.enabled && provider.protocol === 'comfyui'),
    [advancedProviders],
  );
  const providerId = d.comfyuiStoreProviderId || comfyProviders[0]?.id || '';
  const provider = comfyProviders.find((item) => item.id === providerId) || comfyProviders[0] || null;
  const categoryId = d.comfyuiStoreCategoryId || COMFY_APP_ALL_CATEGORY_ID;
  const query = String(d.comfyuiStoreSearchQuery || '');
  const apps = useMemo(() => filterComfyApps(manifest, { categoryId, query }), [manifest, categoryId, query]);
  const activeAppId = String(d.comfyuiStoreActiveAppId || '');
  const activeApp = activeAppId ? (manifest.apps.find((app) => app.id === activeAppId) || null) : null;
  const paramValues = {
    ...defaultComfyAppParamValues(activeApp),
    ...(d.comfyuiStoreParamValues || {}),
  };
  const status = d.status || 'idle';
  const isBusy = status === 'running' || status === 'submitting';
  const size = d.size && typeof d.size.w === 'number' ? d.size : { w: 400, h: 560 };

  const upstream = useUpstreamMaterials(id);
  const excludedMaterialIds = useMemo(() => normalizeExcludedMaterialIds(d.excludedMaterialIds), [d.excludedMaterialIds]);
  const visibleTexts = useMemo(() => filterExcludedMaterials(upstream.texts, excludedMaterialIds), [upstream.texts, excludedMaterialIds]);
  const visibleImages = useMemo(() => filterExcludedMaterials(upstream.images, excludedMaterialIds), [upstream.images, excludedMaterialIds]);
  const visibleVideos = useMemo(() => filterExcludedMaterials(upstream.videos, excludedMaterialIds), [upstream.videos, excludedMaterialIds]);
  const visibleAudios = useMemo(() => filterExcludedMaterials(upstream.audios, excludedMaterialIds), [upstream.audios, excludedMaterialIds]);
  const excludedCount = useMemo(
    () => countExcludedMaterials(excludedMaterialIds, [...upstream.texts, ...upstream.images, ...upstream.videos, ...upstream.audios]),
    [excludedMaterialIds, upstream.texts, upstream.images, upstream.videos, upstream.audios],
  );
  const order: string[] = Array.isArray(d.materialOrder) ? d.materialOrder : [];
  const orderedTexts = useOrderedMaterials(visibleTexts, order);
  const orderedImages = useOrderedMaterials(visibleImages, order);
  const orderedVideos = useOrderedMaterials(visibleVideos, order);
  const orderedAudios = useOrderedMaterials(visibleAudios, order);

  const req = comfyAppInputRequirements(activeApp);
  const imageUrls: string[] = Array.isArray(d.imageUrls) ? d.imageUrls : (d.imageUrl ? [d.imageUrl] : []);
  const outputText = String(d.outputText || '');

  const bg = isPixel ? 'var(--px-surface)' : isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.96)';
  const text = isPixel ? 'var(--px-ink)' : isLight ? '#0f172a' : '#e5f7fb';
  const sub = isPixel ? 'var(--px-ink-soft)' : isLight ? '#64748b' : 'rgba(229,247,251,0.62)';
  const border = isPixel ? 'var(--px-ink)' : isLight ? 'rgba(14,165,233,0.24)' : 'rgba(103,232,249,0.24)';
  const accent = activeApp?.ui?.accent || '#67e8f9';
  const inputCls = isPixel ? 'px-input nodrag nowheel w-full px-2 py-1 text-xs' : 'nodrag nowheel w-full rounded border px-2 py-1 text-xs outline-none';
  const inputStyle: CSSProperties = isPixel ? {} : {
    background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.06)',
    borderColor: border,
    color: text,
  };
  const buttonCls = isPixel
    ? 'px-btn nodrag nowheel inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px]'
    : 'nodrag nowheel inline-flex items-center justify-center gap-1 rounded border px-2 py-1 text-[11px]';
  const rootStyle: CSSProperties = {
    width: size.w,
    height: size.h,
    minWidth: 340,
    minHeight: 420,
    background: bg,
    color: text,
    border: `2px solid ${selected ? accent : border}`,
    borderRadius: isPixel ? 8 : 14,
    overflow: 'hidden',
    boxShadow: isPixel ? '3px 3px 0 var(--px-ink)' : 'var(--t8-node-shadow, 0 12px 30px rgba(0,0,0,0.28))',
  };

  const setOrder = (next: string[]) => update({ materialOrder: next });
  const excludeMaterial = (m: Material) => {
    if (m.origin !== 'upstream') return;
    update({
      excludedMaterialIds: excludeMaterialId(excludedMaterialIds, m.id),
      materialOrder: order.filter((item) => item !== m.id),
    });
  };
  const setParam = (key: string, value: any) => update({ comfyuiStoreParamValues: { ...paramValues, [key]: value } });
  const selectApp = (app: ComfyAppDefinition) => update({
    comfyuiStoreActiveAppId: app.id,
    comfyuiStoreParamValues: defaultComfyAppParamValues(app),
    status: 'idle',
    error: '',
  });

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importComfyAppPayload(JSON.parse(String(reader.result || '{}')));
        for (const app of imported.apps) saveComfyApp(app, getUserComfyAppManifest());
        setImportStatus(imported.apps.length ? `已导入 ${imported.apps.length} 个应用。` : '没有找到可导入应用。');
      } catch (error: any) {
        setImportStatus(error?.message || '导入失败。');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleRun = async () => {
    const src = `comfyui-store:${id.slice(0, 6)}`;
    if (!provider) {
      update({ status: 'error', error: '请先在 API 设置里启用本地 ComfyUI。' });
      throw new Error('请先在 API 设置里启用本地 ComfyUI。');
    }
    if (!activeApp) {
      update({ status: 'error', error: '请先导入或制作一个 ComfyUI 应用。' });
      throw new Error('请先导入或制作一个 ComfyUI 应用。');
    }
    taskCompletionSound.primeAudio();
    update({ status: 'running', error: '', imageUrl: '', imageUrls: [], outputText: '', progress: '提交中' });
    logBus.info(`ComfyUI 应用提交: ${activeApp.title} · ${getComfyProviderBaseUrl(provider)}`, src);
    try {
      const result = await runComfyuiApp({
        provider,
        app: activeApp,
        userParams: paramValues,
        inputs: {
          texts: orderedTexts.map((item) => item.url),
          images: orderedImages.map((item) => item.url),
          videos: orderedVideos.map((item) => item.url),
          audios: orderedAudios.map((item) => item.url),
        },
      });
      const firstImage = result.imageUrls[0] || '';
      update({
        status: 'success',
        progress: '100%',
        taskId: result.taskId || '',
        imageUrl: firstImage,
        imageUrls: result.imageUrls,
        videoUrls: result.videoUrls || [],
        audioUrls: result.audioUrls || [],
        outputText: result.text || '',
        error: '',
      });
      logBus.success(`ComfyUI 应用完成: ${result.imageUrls.length} 图`, src);
      taskCompletionSound.notifyComplete(id, 'image');
    } catch (error: any) {
      const message = error?.message || 'ComfyUI 应用运行失败';
      update({ status: 'error', error: message, progress: '' });
      logBus.error(message, src);
      throw error;
    }
  };

  useRunTrigger(id, handleRun, 'image');

  return (
    <div className="relative flex flex-col nodrag nowheel" style={rootStyle}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: PORT_COLOR.image, left: -6 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: PORT_COLOR.image, right: -6 }} />
      <ResizableCorners
        selected={selected}
        minWidth={340}
        minHeight={420}
        accent={accent}
        keepAspectRatio={false}
        onResize={(_, params) => update({ size: { w: Math.round(params.width), h: Math.round(params.height) } })}
        onResizeEnd={(_, params) => update({ size: { w: Math.round(params.width), h: Math.round(params.height) } })}
      />

      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: border }}>
        <div className="flex h-8 w-8 items-center justify-center rounded border" style={{ borderColor: accent, color: accent }}>
          <Boxes size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black">ComfyUI超市</div>
          <div className="truncate text-[11px]" style={{ color: sub }}>
            {activeApp ? activeApp.title : `${manifest.apps.length} 个应用`} · 本地工作流
          </div>
        </div>
        {activeApp && (
          <button type="button" className={buttonCls} style={inputStyle} onClick={() => update({ comfyuiStoreActiveAppId: '' })}>
            <ArrowLeft size={12} /> 列表
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-bold" style={{ color: sub }}>ComfyUI 实例</span>
            <select
              value={provider?.id || ''}
              onChange={(e) => update({ comfyuiStoreProviderId: e.target.value })}
              className={inputCls}
              style={inputStyle}
            >
              {comfyProviders.length ? comfyProviders.map((item) => (
                <option key={item.id} value={item.id}>{item.label || item.id} · {getComfyProviderBaseUrl(item)}</option>
              )) : <option value="">未启用 ComfyUI</option>}
            </select>
          </label>
        </div>

        {!activeApp ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60" />
                <input
                  value={query}
                  onChange={(e) => update({ comfyuiStoreSearchQuery: e.target.value })}
                  className={`${inputCls} pl-7`}
                  style={inputStyle}
                  placeholder="搜索 ComfyUI 应用"
                />
              </div>
              <label className={buttonCls} style={inputStyle}>
                导入
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFile(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={buttonCls}
                style={inputStyle}
                onClick={() => update({ comfyuiStoreCategoryId: COMFY_APP_ALL_CATEGORY_ID })}
              >
                全部 {manifest.apps.length}
              </button>
              {manifest.categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={buttonCls}
                  style={categoryId === category.id ? { ...inputStyle, borderColor: accent, color: accent } : inputStyle}
                  onClick={() => update({ comfyuiStoreCategoryId: category.id })}
                >
                  {category.name}
                </button>
              ))}
            </div>
            {apps.length ? (
              <div className="space-y-1.5">
                {apps.map((app) => (
                  <button
                    type="button"
                    key={app.id}
                    className="nodrag nowheel w-full rounded border p-2 text-left"
                    style={{ borderColor: border, background: isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.05)', color: text }}
                    onClick={() => selectApp(app)}
                  >
                    <div className="flex items-center gap-2">
                      <Workflow size={14} style={{ color: app.ui?.accent || accent }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-black">{app.title}</div>
                        <div className="truncate text-[10px]" style={{ color: sub }}>{app.description || `${app.fields.length} 个字段`}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, color: sub }}>
                还没有 ComfyUI 应用。先添加「ComfyUI应用制作工具」节点，上传 workflow JSON 后保存到超市；也可以直接导入应用 JSON。
              </div>
            )}
            {importStatus && <div className="text-[11px]" style={{ color: sub }}>{importStatus}</div>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded border p-2" style={{ borderColor: border, background: isLight ? 'rgba(14,165,233,0.06)' : 'rgba(103,232,249,0.08)' }}>
              <div className="text-xs font-black">{activeApp.title}</div>
              <div className="mt-1 text-[10px]" style={{ color: sub }}>
                需要：图片 {req.images} / 视频 {req.videos} / 音频 {req.audios} · 字段 {activeApp.fields.length}
              </div>
            </div>

            <MaterialPreviewSection
              texts={orderedTexts}
              images={orderedImages}
              videos={orderedVideos}
              audios={orderedAudios}
              order={order}
              onReorder={setOrder}
              onExcludeUpstream={excludeMaterial}
              excludedCount={excludedCount}
              onRestoreExcluded={() => update({ excludedMaterialIds: [] })}
              selected={!!selected}
              isDark={isDark}
              isPixel={isPixel}
              groups={['text', 'image', 'video', 'audio']}
              title="上游素材 · 可拖拽调整顺序"
            />

            <div className="space-y-2">
              <div className="text-xs font-black">参数</div>
              {activeApp.userParams.map((param) => (
                <label key={param.key} className="block space-y-1">
                  <span className="text-[11px] font-bold" style={{ color: sub }}>{param.label}</span>
                  {param.kind === 'textarea' ? (
                    <textarea
                      value={String(paramValues[param.key] ?? '')}
                      onChange={(e) => setParam(param.key, e.target.value)}
                      rows={param.rows || 4}
                      className={`${inputCls} resize-y`}
                      style={inputStyle}
                      placeholder={param.placeholder}
                    />
                  ) : param.kind === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={!!paramValues[param.key]}
                      onChange={(e) => setParam(param.key, e.target.checked)}
                    />
                  ) : (
                    <input
                      type={param.kind === 'number' ? 'number' : 'text'}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={parseInputValue(param.kind, paramValues[param.key])}
                      onChange={(e) => setParam(param.key, param.kind === 'number' ? e.target.value : e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                      placeholder={param.placeholder}
                    />
                  )}
                </label>
              ))}
            </div>

            <button type="button" className={`${buttonCls} w-full py-2 text-sm font-black`} style={{ ...inputStyle, borderColor: accent, color: accent }} disabled={isBusy} onClick={handleRun}>
              {isBusy ? <><Loader2 size={14} className="animate-spin" /> 运行中...</> : <><Play size={14} /> 运行 ComfyUI</>}
            </button>

            {d.error && (
              <div className="flex gap-1 rounded border px-2 py-1 text-[11px] text-red-400" style={{ borderColor: 'rgba(248,113,113,0.45)' }}>
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span className="break-all">{d.error}</span>
              </div>
            )}
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {imageUrls.slice(0, 4).map((url, index) => (
                  <img key={`${url}-${index}`} src={url} alt="ComfyUI 输出" className="w-full rounded object-contain" />
                ))}
              </div>
            )}
            {outputText && <pre className="max-h-24 overflow-auto rounded border p-2 text-[10px] whitespace-pre-wrap" style={{ borderColor: border }}>{outputText}</pre>}
            <button type="button" className={buttonCls} style={inputStyle} onClick={() => setManifest(mergeComfyAppManifests(COMFYUI_APP_MANIFEST, getUserComfyAppManifest()))}>
              <RefreshCw size={12} /> 刷新应用
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ComfyUIStoreNode);

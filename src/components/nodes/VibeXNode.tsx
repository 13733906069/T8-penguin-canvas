import { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps, type ResizeParams } from '@xyflow/react';
import { Clapperboard, ExternalLink, Maximize2, Puzzle, RefreshCw, UserPlus, Wifi } from 'lucide-react';
import {
  buildVibeXFrameUrl,
  RUNNINGHUB_INVITE_URL,
  VIBEX_ONLINE_URL,
  type VibeXFrameMode,
} from '../../utils/vibexBridge';
import ResizableCorners from './ResizableCorners';
import { useUpdateNodeData } from './useUpdateNodeData';

const DEFAULT_VIBEX_NODE_WIDTH = 1080;
const DEFAULT_VIBEX_NODE_HEIGHT = 820;
const MIN_VIBEX_NODE_WIDTH = 760;
const MIN_VIBEX_NODE_HEIGHT = 620;
const MAX_VIBEX_NODE_WIDTH = 1500;
const MAX_VIBEX_NODE_HEIGHT = 1120;
const VIBEX_FRAME_CHROME_HEIGHT = 202;
const VIBEX_CUSTOM_URL_EXTRA_HEIGHT = 48;
const MIN_VIBEX_FRAME_HEIGHT = 420;
const WEB_IMAGE_EXTENSION_INSTALL_DIR = 'resources/extension/web-image-reverse/';
const WEB_IMAGE_EXTENSION_INSTALL_STEPS = 'Chrome 扩展程序 -> 开发者模式 -> 加载已解压';

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readDimension(value: unknown, fallback: number, min: number, max: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.round(clampNumber(next, min, max));
}

function getAdaptiveVibeXSize() {
  if (typeof window === 'undefined') {
    return { vibexNodeWidth: DEFAULT_VIBEX_NODE_WIDTH, vibexNodeHeight: DEFAULT_VIBEX_NODE_HEIGHT };
  }
  return {
    vibexNodeWidth: Math.round(clampNumber(window.innerWidth * 0.78, 900, MAX_VIBEX_NODE_WIDTH)),
    vibexNodeHeight: Math.round(clampNumber(window.innerHeight * 0.82, 700, MAX_VIBEX_NODE_HEIGHT)),
  };
}

function getVibeXFrameHeight(nodeHeight: number, mode: VibeXFrameMode): number {
  const chromeHeight = VIBEX_FRAME_CHROME_HEIGHT + (mode === 'custom' ? VIBEX_CUSTOM_URL_EXTRA_HEIGHT : 0);
  return Math.max(MIN_VIBEX_FRAME_HEIGHT, Math.round(nodeHeight - chromeHeight));
}

function isFrameMode(value: unknown): value is VibeXFrameMode {
  return value === 'online' || value === 'custom';
}

function openUrl(url: string) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const VibeXNode = (props: NodeProps) => {
  const update = useUpdateNodeData(props.id);
  const updateNodeInternals = useUpdateNodeInternals();
  const data = props.data as Record<string, any>;
  const mode: VibeXFrameMode = isFrameMode(data?.vibexFrameMode) ? data.vibexFrameMode : 'online';
  const customUrl = String(data?.vibexCustomUrl || '');
  const adaptiveSize = useMemo(() => getAdaptiveVibeXSize(), []);
  const nodeWidth = readDimension(
    data?.vibexNodeWidth,
    adaptiveSize.vibexNodeWidth,
    MIN_VIBEX_NODE_WIDTH,
    MAX_VIBEX_NODE_WIDTH
  );
  const nodeHeight = readDimension(
    data?.vibexNodeHeight,
    adaptiveSize.vibexNodeHeight,
    MIN_VIBEX_NODE_HEIGHT,
    MAX_VIBEX_NODE_HEIGHT
  );
  const [draftUrl, setDraftUrl] = useState(customUrl);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setDraftUrl(customUrl);
  }, [customUrl]);

  const frameUrl = useMemo(() => buildVibeXFrameUrl(mode, customUrl), [mode, customUrl]);
  const frameHeight = getVibeXFrameHeight(nodeHeight, mode);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => updateNodeInternals(props.id));
    return () => window.cancelAnimationFrame(raf);
  }, [frameHeight, mode, nodeHeight, nodeWidth, props.id, updateNodeInternals]);

  const handleResize = useCallback(
    (_event: unknown, params: ResizeParams) => {
      update({
        vibexNodeWidth: Math.round(clampNumber(params.width, MIN_VIBEX_NODE_WIDTH, MAX_VIBEX_NODE_WIDTH)),
        vibexNodeHeight: Math.round(clampNumber(params.height, MIN_VIBEX_NODE_HEIGHT, MAX_VIBEX_NODE_HEIGHT)),
      });
    },
    [update]
  );

  const fitToViewport = useCallback(() => {
    update(getAdaptiveVibeXSize());
  }, [update]);

  const setMode = (next: VibeXFrameMode) => {
    update({ vibexFrameMode: next, vibexCustomUrl: next === 'custom' ? draftUrl : customUrl });
  };

  const applyCustomUrl = () => {
    update({ vibexFrameMode: 'custom', vibexCustomUrl: draftUrl.trim() });
  };

  return (
    <div
      className={`t8-vibex-node relative flex flex-col rounded-2xl border-2 shadow-xl ${
        props.selected ? 'border-cyan-300' : 'border-cyan-500/30'
      }`}
      style={{
        width: nodeWidth,
        height: nodeHeight,
        minWidth: MIN_VIBEX_NODE_WIDTH,
        minHeight: MIN_VIBEX_NODE_HEIGHT,
        boxSizing: 'border-box',
        overflow: 'visible',
        background: 'linear-gradient(180deg, rgba(236,254,255,.98), rgba(240,253,250,.96))',
        boxShadow: props.selected
          ? '0 0 0 1px rgba(34,211,238,.75), 0 20px 44px rgba(14,116,144,.24)'
          : '0 14px 34px rgba(15,118,110,.18)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#0891b2' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#0891b2' }} />
      <ResizableCorners
        selected={props.selected}
        minWidth={MIN_VIBEX_NODE_WIDTH}
        minHeight={MIN_VIBEX_NODE_HEIGHT}
        maxWidth={MAX_VIBEX_NODE_WIDTH}
        maxHeight={MAX_VIBEX_NODE_HEIGHT}
        accent="#06b6d4"
        keepAspectRatio={false}
        onResize={handleResize}
        onResizeEnd={handleResize}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-cyan-200/70 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 ring-1 ring-cyan-300">
            <Clapperboard size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span>VibeX工作台</span>
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] text-cyan-800">
                {mode === 'custom' ? '自定义' : '线上'}
              </span>
            </div>
            <div className="truncate text-[11px] text-slate-500">{frameUrl}</div>
          </div>
          <button
            type="button"
            className="nodrag nopan rounded-full border border-cyan-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-50"
            onClick={() => setReloadKey((value) => value + 1)}
            title="刷新 VibeX"
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            className="nodrag nopan rounded-full border border-cyan-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-50"
            onClick={fitToViewport}
            title="适配窗口"
          >
            <Maximize2 size={13} />
            <span className="ml-1">适配</span>
          </button>
          <button
            type="button"
            className="nodrag nopan rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={() => openUrl(RUNNINGHUB_INVITE_URL)}
            title="注册或切换 RunningHub 账号"
          >
            <UserPlus size={13} />
            <span className="ml-1">注册 RH</span>
          </button>
          <button
            type="button"
            className="nodrag nopan rounded-full border border-cyan-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-50"
            onClick={() => openUrl(frameUrl)}
            title="新窗口打开 VibeX"
          >
            <ExternalLink size={13} />
            <span className="ml-1">新窗口</span>
          </button>
        </div>

        <div
          className="nodrag nopan nowheel flex min-h-0 flex-1 flex-col gap-3 p-3"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {(['online', 'custom'] as VibeXFrameMode[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`nodrag nopan rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  mode === item
                    ? 'border-cyan-500 bg-cyan-100 text-cyan-900'
                    : 'border-cyan-200 bg-white text-slate-600 hover:bg-cyan-50'
                }`}
                onClick={() => setMode(item)}
              >
                {item === 'online' ? '线上 VibeX' : '自定义'}
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600 ring-1 ring-cyan-200">
              <Wifi size={12} />
              线上嵌入，结果可通过“发送到 T8 画布”回传
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-cyan-200 bg-white/85 px-3 py-2 text-[11px] text-slate-600 shadow-sm">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200">
              <Puzzle size={13} />
            </span>
            <span className="shrink-0 font-bold text-cyan-900">插件安装</span>
            <span className="min-w-0 flex-1 truncate">
              打包版目录：<code className="rounded bg-cyan-50 px-1 font-semibold text-cyan-900">{WEB_IMAGE_EXTENSION_INSTALL_DIR}</code>
              <span className="mx-1 text-cyan-500">·</span>
              {WEB_IMAGE_EXTENSION_INSTALL_STEPS}
            </span>
          </div>

          {mode === 'custom' && (
            <form
              className="flex shrink-0 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                applyCustomUrl();
              }}
            >
              <input
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                placeholder={VIBEX_ONLINE_URL}
                className="nodrag nopan nowheel min-w-0 flex-1 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="nodrag nopan rounded-lg border border-cyan-300 bg-cyan-100 px-3 py-2 text-xs font-bold text-cyan-900"
              >
                应用
              </button>
            </form>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-cyan-200 bg-white">
            <iframe
              key={`${frameUrl}-${reloadKey}`}
              data-vibex-frame="true"
              title="VibeX 工作台"
              src={frameUrl}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-downloads"
              className="block w-full shrink-0"
              style={{ height: frameHeight, background: '#fff' }}
            />
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-cyan-100 px-3 py-2 text-[10px] text-slate-500">
              <span>线上地址：{VIBEX_ONLINE_URL}</span>
              <span>若登录弹窗被浏览器拦截，请使用“新窗口”。</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(VibeXNode);

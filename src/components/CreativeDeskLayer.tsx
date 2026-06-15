import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import type { CreativeDeskItem, CreativeDeskState } from '../types/canvas';
import type { ResourceItem } from '../services/api';
import SmartImage from './SmartImage';
import {
  CREATIVE_DESK_FRAMES,
  appendCreativeDeskItem,
  duplicateCreativeDeskItem,
  removeCreativeDeskItem,
  replaceCreativeDeskItem,
  resourceItemToCreativeDeskItem,
} from '../utils/creativeDesk';

interface CreativeDeskLayerProps {
  creativeDesk: CreativeDeskState;
  editing: boolean;
  activeItemId: string | null;
  resources: ResourceItem[];
  resourceLoading: boolean;
  message?: string;
  isPixel?: boolean;
  isDark?: boolean;
  visualStyle?: string;
  onChange: (next: CreativeDeskState) => void;
  onEditingChange: (editing: boolean) => void;
  onActiveItemChange: (id: string | null) => void;
  onUploadFiles: (files: File[]) => void | Promise<void>;
  onAddResource?: (item: ResourceItem) => void | Promise<void>;
  onRefreshResources: () => void | Promise<void>;
}

type DragMode = 'move' | 'scale' | 'rotate';

interface DragSession {
  mode: DragMode;
  pointerId: number;
  item: CreativeDeskItem;
  startX: number;
  startY: number;
  startAngle?: number;
  centerX?: number;
  centerY?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function CreativeDeskLayer({
  creativeDesk,
  editing,
  activeItemId,
  resources,
  resourceLoading,
  message,
  isPixel = false,
  isDark = false,
  visualStyle,
  onChange,
  onEditingChange,
  onActiveItemChange,
  onUploadFiles,
  onAddResource,
  onRefreshResources,
}: CreativeDeskLayerProps) {
  const { getViewport } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);

  const sortedItems = useMemo(
    () => creativeDesk.items
      .filter((item) => item.visible !== false)
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [creativeDesk.items],
  );
  const activeItem = creativeDesk.items.find((item) => item.id === activeItemId) || null;
  const resourcePreviewItems = resources.filter((item) => item.kind === 'image' || item.kind === 'panorama').slice(0, 18);

  const updateItem = (itemId: string, patch: Partial<CreativeDeskItem> | ((item: CreativeDeskItem) => CreativeDeskItem)) => {
    onChange(replaceCreativeDeskItem(creativeDesk, itemId, patch));
  };

  const getFlowRect = () => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    return el?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  };

  const startItemDrag = (event: ReactPointerEvent, item: CreativeDeskItem, mode: DragMode) => {
    if (item.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onActiveItemChange(item.id);
    const viewport = getViewport();
    const rect = getFlowRect();
    const centerX = rect.left + item.x * viewport.zoom + viewport.x;
    const centerY = rect.top + item.y * viewport.zoom + viewport.y;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI;
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      item,
      startX: event.clientX,
      startY: event.clientY,
      startAngle,
      centerX,
      centerY,
    };
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp, { once: true });
  };

  const handleWindowPointerMove = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const viewport = getViewport();
    const zoom = viewport.zoom || 1;
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (drag.mode === 'move') {
      updateItem(drag.item.id, {
        x: drag.item.x + dx,
        y: drag.item.y + dy,
      });
      return;
    }
    if (drag.mode === 'scale') {
      const delta = (event.clientX - drag.startX + event.clientY - drag.startY) / 220;
      updateItem(drag.item.id, {
        scale: clamp(drag.item.scale + delta, 0.08, 8),
      });
      return;
    }
    if (drag.mode === 'rotate' && drag.centerX != null && drag.centerY != null && drag.startAngle != null) {
      const angle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX) * 180 / Math.PI;
      updateItem(drag.item.id, {
        rotation: clamp(drag.item.rotation + (angle - drag.startAngle), -720, 720),
      });
    }
  };

  const handleWindowPointerUp = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', handleWindowPointerMove);
  };

  const addResourceToDesk = async (item: ResourceItem) => {
    const center = { x: 0, y: 0 };
    const rect = getFlowRect();
    const viewport = getViewport();
    center.x = (rect.width / 2 - viewport.x) / (viewport.zoom || 1);
    center.y = (rect.height / 2 - viewport.y) / (viewport.zoom || 1);
    const nextItem = resourceItemToCreativeDeskItem(item, center, creativeDesk.items);
    if (!nextItem) return;
    onChange(appendCreativeDeskItem(creativeDesk, nextItem));
    onActiveItemChange(nextItem.id);
    await onAddResource?.(item);
  };

  const moveLayer = (direction: 1 | -1) => {
    if (!activeItem) return;
    updateItem(activeItem.id, {
      zIndex: clamp((activeItem.zIndex || 0) + direction, 0, 9999),
    });
  };

  return (
    <>
      <ViewportPortal>
        <div
          className={`t8-creative-desk-layer${editing ? ' is-editing' : ''}`}
          data-visual-style={visualStyle || undefined}
          aria-hidden={!editing}
        >
          {sortedItems.map((item) => {
            const selected = editing && activeItemId === item.id;
            return (
              <div
                key={item.id}
                className={`t8-creative-desk-item${selected ? ' is-selected' : ''}${item.locked ? ' is-locked' : ''}`}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  opacity: item.opacity,
                  zIndex: item.zIndex,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
                }}
                onPointerDown={(event) => startItemDrag(event, item, 'move')}
              >
                <div className={`t8-creative-desk-frame t8-creative-desk-frame--${item.frameId || 'poster-card'}`}>
                  <SmartImage
                    src={item.url}
                    alt={item.title || 'creative desk image'}
                    thumbSize={640}
                    draggable={false}
                  />
                </div>
                {editing && (
                  <>
                    <button
                      type="button"
                      className="t8-creative-desk-handle t8-creative-desk-handle--rotate"
                      title="旋转"
                      aria-label="旋转"
                      onPointerDown={(event) => startItemDrag(event, item, 'rotate')}
                    >
                      <LucideIcons.RotateCw size={14} />
                    </button>
                    <button
                      type="button"
                      className="t8-creative-desk-handle t8-creative-desk-handle--scale"
                      title="等比缩放"
                      aria-label="等比缩放"
                      onPointerDown={(event) => startItemDrag(event, item, 'scale')}
                    >
                      <LucideIcons.MoveDiagonal2 size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </ViewportPortal>

      {editing && (
        <div
          className={`t8-creative-desk-panel nodrag nopan nowheel${isPixel ? ' is-pixel' : ''}${isDark ? ' is-dark' : ''}`}
          data-canvas-floating-ui="creative-desk-panel"
        >
          <div className="t8-creative-desk-panel__header">
            <div>
              <strong>创作台背景</strong>
              <span>{creativeDesk.items.length} 张图片</span>
            </div>
            <button type="button" className="t8-creative-desk-icon-button" onClick={() => onEditingChange(false)} title="完成" aria-label="完成">
              <LucideIcons.Check size={16} />
            </button>
          </div>

          <div className="t8-creative-desk-panel__actions">
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <LucideIcons.Upload size={15} />
              上传图片
            </button>
            <button type="button" onClick={() => void onRefreshResources()} disabled={resourceLoading}>
              <LucideIcons.RefreshCw size={15} />
              {resourceLoading ? '加载中' : '刷新资源'}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              if (files.length > 0) void onUploadFiles(files);
              event.currentTarget.value = '';
            }}
          />

          <div className="t8-creative-desk-panel__section">
            <div className="t8-creative-desk-panel__row">
              <label>透明度</label>
              <input
                type="range"
                min={0.08}
                max={1}
                step={0.01}
                value={activeItem?.opacity ?? creativeDesk.defaultOpacity ?? 0.42}
                disabled={!activeItem}
                onChange={(event) => {
                  if (!activeItem) return;
                  updateItem(activeItem.id, { opacity: Number(event.target.value) });
                }}
              />
            </div>
            <div className="t8-creative-desk-panel__row">
              <label>边框</label>
              <select
                value={activeItem?.frameId || 'poster-card'}
                disabled={!activeItem}
                onChange={(event) => {
                  if (!activeItem) return;
                  updateItem(activeItem.id, { frameId: event.target.value });
                }}
              >
                {CREATIVE_DESK_FRAMES.map((frame) => (
                  <option key={frame.id} value={frame.id}>{frame.label}</option>
                ))}
              </select>
            </div>
          </div>

          {activeItem && (
            <div className="t8-creative-desk-panel__section">
              <div className="t8-creative-desk-layer-tools">
                <button type="button" onClick={() => moveLayer(1)} title="上移图层">
                  <LucideIcons.ArrowUp size={14} />
                  上移
                </button>
                <button type="button" onClick={() => moveLayer(-1)} title="下移图层">
                  <LucideIcons.ArrowDown size={14} />
                  下移
                </button>
                <button type="button" onClick={() => onChange(duplicateCreativeDeskItem(creativeDesk, activeItem.id))} title="复制">
                  <LucideIcons.Copy size={14} />
                  复制
                </button>
                <button type="button" onClick={() => updateItem(activeItem.id, { locked: !activeItem.locked })} title="锁定">
                  {activeItem.locked ? <LucideIcons.LockKeyholeOpen size={14} /> : <LucideIcons.LockKeyhole size={14} />}
                  {activeItem.locked ? '解锁' : '锁定'}
                </button>
                <button type="button" onClick={() => updateItem(activeItem.id, { visible: false })} title="隐藏">
                  <LucideIcons.EyeOff size={14} />
                  隐藏
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => {
                    onChange(removeCreativeDeskItem(creativeDesk, activeItem.id));
                    onActiveItemChange(null);
                  }}
                >
                  <LucideIcons.Trash2 size={14} />
                  删除
                </button>
              </div>
            </div>
          )}

          <div className="t8-creative-desk-panel__section">
            <div className="t8-creative-desk-panel__subhead">
              <span>资源库图片</span>
              {message && <em>{message}</em>}
            </div>
            <div className="t8-creative-desk-resource-grid">
              {resourcePreviewItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="t8-creative-desk-resource"
                  onClick={() => void addResourceToDesk(item)}
                  title={item.title}
                >
                  <SmartImage src={item.thumbUrl || item.fileUrl} alt={item.title} thumbSize={220} />
                  <span>{item.title}</span>
                </button>
              ))}
              {!resourceLoading && resourcePreviewItems.length === 0 && (
                <div className="t8-creative-desk-empty">资源库暂无图片，可先上传到创作台</div>
              )}
            </div>
          </div>

          <div className="t8-creative-desk-panel__footer">
            <button type="button" onClick={() => onChange({ ...creativeDesk, items: [] })} disabled={creativeDesk.items.length === 0}>
              <LucideIcons.Eraser size={14} />
              清空背景
            </button>
          </div>
        </div>
      )}
    </>
  );
}

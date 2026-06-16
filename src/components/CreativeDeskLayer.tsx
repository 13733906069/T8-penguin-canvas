import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import * as LucideIcons from 'lucide-react';
import type { CreativeDeskItem, CreativeDeskState } from '../types/canvas';
import type { ResourceItem } from '../services/api';
import SmartImage from './SmartImage';
import {
  CREATIVE_DESK_FRAMES,
  CREATIVE_DESK_FRAME_COLORS,
  appendCreativeDeskItem,
  duplicateCreativeDeskItem,
  exportCreativeDeskBackup,
  getCreativeDeskFrameColor,
  parseCreativeDeskBackup,
  removeCreativeDeskItem,
  replaceCreativeDeskItem,
  resourceItemToCreativeDeskItem,
} from '../utils/creativeDesk';
import { readImageNaturalSize } from '../utils/imageNaturalSize';

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

const CREATIVE_DESK_ACTIONS = new Set<DragMode>(['move', 'scale', 'rotate']);

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const creativeDeskRef = useRef<CreativeDeskState>(creativeDesk);
  const [localMessage, setLocalMessage] = useState('');

  const sortedItems = useMemo(
    () => creativeDesk.items
      .filter((item) => item.visible !== false)
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [creativeDesk.items],
  );
  const hiddenItems = useMemo(
    () => creativeDesk.items.filter((item) => item.visible === false),
    [creativeDesk.items],
  );
  const activeItem = creativeDesk.items.find((item) => item.id === activeItemId && item.visible !== false) || null;
  const resourcePreviewItems = resources.filter((item) => item.kind === 'image' || item.kind === 'panorama').slice(0, 18);

  useEffect(() => {
    creativeDeskRef.current = creativeDesk;
  }, [creativeDesk]);

  const updateItem = (itemId: string, patch: Partial<CreativeDeskItem> | ((item: CreativeDeskItem) => CreativeDeskItem)) => {
    onChange(replaceCreativeDeskItem(creativeDeskRef.current, itemId, patch));
  };

  const getFlowRect = () => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    return el?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  };

  const stopCreativeDeskPointerEvent = (event: ReactPointerEvent | ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const nativeEvent = event.nativeEvent as Event & { stopImmediatePropagation?: () => void };
    nativeEvent.stopImmediatePropagation?.();
  };

  const stopCreativeDeskNativePointerEvent = (event: PointerEvent | MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  const beginItemDrag = (item: CreativeDeskItem, mode: DragMode, pointerId: number, clientX: number, clientY: number) => {
    onActiveItemChange(item.id);
    if (item.locked) return;
    const rect = getFlowRect();
    const centerX = rect.left + item.x;
    const centerY = rect.top + item.y;
    const startAngle = Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
    dragRef.current = {
      mode,
      pointerId,
      item,
      startX: clientX,
      startY: clientY,
      startAngle,
      centerX,
      centerY,
    };
    window.addEventListener('pointermove', handleWindowPointerMove, true);
    window.addEventListener('pointerup', handleWindowPointerUp, { capture: true, once: true });
  };

  useEffect(() => {
    if (!editing || !activeItem) return undefined;
    const handleCreativeDeskKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      onChange(removeCreativeDeskItem(creativeDesk, activeItem.id));
      onActiveItemChange(null);
    };
    window.addEventListener('keydown', handleCreativeDeskKeyDown, true);
    return () => window.removeEventListener('keydown', handleCreativeDeskKeyDown, true);
  }, [activeItem, creativeDesk, editing, onActiveItemChange, onChange]);

  const startItemDrag = (event: ReactPointerEvent, item: CreativeDeskItem, mode: DragMode) => {
    stopCreativeDeskPointerEvent(event);
    beginItemDrag(item, mode, event.pointerId, event.clientX, event.clientY);
  };

  const startItemDragFromNativeEvent = (event: PointerEvent | MouseEvent) => {
    if (!editing || event.button !== 0) return false;
    if ('isPrimary' in event && event.isPrimary === false) return false;
    const target = event.target instanceof Element ? event.target : null;
    const actionEl = target?.closest('[data-creative-desk-action]') as HTMLElement | null;
    const action = actionEl?.dataset.creativeDeskAction;
    if (!actionEl || !action || !CREATIVE_DESK_ACTIONS.has(action as DragMode)) return false;
    stopCreativeDeskNativePointerEvent(event);
    if (event.type === 'mousedown' && dragRef.current) return true;
    const itemId = actionEl.dataset.creativeDeskItemId || actionEl.closest('[data-creative-desk-item-id]')?.getAttribute('data-creative-desk-item-id');
    const item = creativeDeskRef.current.items.find((entry) => entry.id === itemId && entry.visible !== false);
    if (!item) return true;
    beginItemDrag(item, action as DragMode, 'pointerId' in event ? event.pointerId : 1, event.clientX, event.clientY);
    return true;
  };

  useEffect(() => {
    if (!editing) return undefined;
    const handleCreativeDeskNativePointerDown = (event: PointerEvent | MouseEvent) => {
      startItemDragFromNativeEvent(event);
    };
    document.addEventListener('pointerdown', handleCreativeDeskNativePointerDown, true);
    document.addEventListener('mousedown', handleCreativeDeskNativePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleCreativeDeskNativePointerDown, true);
      document.removeEventListener('mousedown', handleCreativeDeskNativePointerDown, true);
      dragRef.current = null;
      window.removeEventListener('pointermove', handleWindowPointerMove, true);
    };
  }, [editing]);

  const handleWindowPointerMove = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
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
    window.removeEventListener('pointermove', handleWindowPointerMove, true);
  };

  const addResourceToDesk = async (item: ResourceItem) => {
    const center = { x: 0, y: 0 };
    const rect = getFlowRect();
    center.x = rect.width / 2;
    center.y = rect.height / 2;
    let sourceItem = item;
    if (!item.width || !item.height) {
      const size = await readImageNaturalSize(item.fileUrl || item.thumbUrl || '');
      if (size) sourceItem = { ...item, width: size.width, height: size.height };
    }
    const nextItem = resourceItemToCreativeDeskItem(sourceItem, center, creativeDesk.items);
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

  const hideActiveItem = () => {
    if (!activeItem) return;
    updateItem(activeItem.id, { visible: false });
    onActiveItemChange(null);
  };

  const restoreHiddenItem = (itemId: string) => {
    updateItem(itemId, { visible: true });
    onActiveItemChange(itemId);
  };

  const handleExportCreativeDesk = () => {
    const backup = exportCreativeDeskBackup(creativeDesk);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creative-desk-background-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLocalMessage(`已导出 ${backup.creativeDesk.items.length} 张背景`);
  };

  const handleImportCreativeDeskFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = parseCreativeDeskBackup(String(reader.result || ''));
        if (creativeDesk.items.length > 0 && !confirm(`导入将替换当前 ${creativeDesk.items.length} 张创作台背景，是否继续?`)) {
          return;
        }
        onChange(next);
        onActiveItemChange(next.items.find((item) => item.visible !== false)?.id || null);
        setLocalMessage(`已导入 ${next.items.length} 张背景`);
      } catch (err) {
        setLocalMessage(err instanceof Error ? err.message : '导入失败');
      } finally {
        event.currentTarget.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div
        className={`t8-creative-desk-layer${editing ? ' is-editing' : ''}`}
        data-visual-style={visualStyle || undefined}
        aria-hidden={!editing}
      >
        {sortedItems.map((item) => {
          const selected = editing && activeItemId === item.id;
          const frameColor = getCreativeDeskFrameColor(item.frameColorId);
          const frameStyle = {
            '--t8-creative-desk-frame-color': frameColor.color,
            '--t8-creative-desk-frame-bg': frameColor.background,
            '--t8-creative-desk-frame-shadow': frameColor.shadow,
          } as CSSProperties;
          return (
            <div
              key={item.id}
              className={`t8-creative-desk-item nodrag nopan nowheel${selected ? ' is-selected' : ''}${item.locked ? ' is-locked' : ''}`}
              data-creative-desk-action="move"
              data-creative-desk-item-id={item.id}
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                opacity: item.opacity,
                zIndex: item.zIndex,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
              }}
              onPointerDownCapture={stopCreativeDeskPointerEvent}
              onMouseDownCapture={stopCreativeDeskPointerEvent}
              onPointerDown={(event) => startItemDrag(event, item, 'move')}
            >
              <div
                className={`t8-creative-desk-frame t8-creative-desk-frame--${item.frameId || 'poster-card'}`}
                style={frameStyle}
              >
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
                    className="t8-creative-desk-handle t8-creative-desk-handle--rotate nodrag nopan nowheel"
                    data-creative-desk-action="rotate"
                    data-creative-desk-item-id={item.id}
                    title="旋转"
                    aria-label="旋转"
                    onPointerDownCapture={stopCreativeDeskPointerEvent}
                    onMouseDownCapture={stopCreativeDeskPointerEvent}
                    onPointerDown={(event) => startItemDrag(event, item, 'rotate')}
                  >
                    <LucideIcons.RotateCw size={14} />
                  </button>
                  <button
                    type="button"
                    className="t8-creative-desk-handle t8-creative-desk-handle--scale nodrag nopan nowheel"
                    data-creative-desk-action="scale"
                    data-creative-desk-item-id={item.id}
                    title="等比缩放"
                    aria-label="等比缩放"
                    onPointerDownCapture={stopCreativeDeskPointerEvent}
                    onMouseDownCapture={stopCreativeDeskPointerEvent}
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

      {editing && (
        <div
          className={`t8-creative-desk-panel nodrag nopan nowheel${isPixel ? ' is-pixel' : ''}${isDark ? ' is-dark' : ''}`}
          data-canvas-floating-ui="creative-desk-panel"
        >
          <div className="t8-creative-desk-panel__header">
            <div>
              <strong>创作台背景</strong>
              <span>{sortedItems.length} 张可见{hiddenItems.length > 0 ? ` · ${hiddenItems.length} 张隐藏` : ''}</span>
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
            <button type="button" onClick={() => backupInputRef.current?.click()}>
              <LucideIcons.Import size={15} />
              导入
            </button>
            <button type="button" onClick={handleExportCreativeDesk} disabled={creativeDesk.items.length === 0}>
              <LucideIcons.Download size={15} />
              导出
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
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportCreativeDeskFile}
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
            <div className="t8-creative-desk-panel__row t8-creative-desk-panel__row--colors">
              <label>颜色</label>
              <div className="t8-creative-desk-color-grid" role="group" aria-label="边框颜色">
                {CREATIVE_DESK_FRAME_COLORS.map((color) => {
                  const selected = (activeItem?.frameColorId || 'cream') === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      className={`t8-creative-desk-color-swatch${selected ? ' is-selected' : ''}`}
                      style={{ '--t8-creative-desk-frame-color': color.color, '--t8-creative-desk-frame-bg': color.background } as CSSProperties}
                      disabled={!activeItem}
                      onClick={() => {
                        if (!activeItem) return;
                        updateItem(activeItem.id, { frameColorId: color.id });
                      }}
                      title={color.label}
                      aria-label={color.label}
                    >
                      <span />
                    </button>
                  );
                })}
              </div>
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
                <button type="button" onClick={hideActiveItem} title="隐藏">
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

          {hiddenItems.length > 0 && (
            <div className="t8-creative-desk-panel__section">
              <div className="t8-creative-desk-panel__subhead">
                <span>已隐藏</span>
                <em>可恢复</em>
              </div>
              <div className="t8-creative-desk-hidden-list">
                {hiddenItems.map((item) => (
                  <div key={item.id} className="t8-creative-desk-hidden-item">
                    <span title={item.title || '未命名图片'}>{item.title || '未命名图片'}</span>
                    <button type="button" onClick={() => restoreHiddenItem(item.id)} title="恢复显示">
                      <LucideIcons.Eye size={13} />
                      恢复
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => {
                        onChange(removeCreativeDeskItem(creativeDesk, item.id));
                        if (activeItemId === item.id) onActiveItemChange(null);
                      }}
                      title="删除隐藏图片"
                    >
                      <LucideIcons.Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="t8-creative-desk-panel__section">
            <div className="t8-creative-desk-panel__subhead">
              <span>资源库图片</span>
              {(localMessage || message) && <em>{localMessage || message}</em>}
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

import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type DragEvent as ReactDragEvent } from 'react';
import * as LucideIcons from 'lucide-react';
import { NODE_REGISTRY } from '../config/nodeRegistry';
import { useRadialMenuStore } from '../stores/radialMenu';
import type { NodeCategory, NodeType } from '../types/canvas';
import {
  RADIAL_MENU_DEFAULT_LONG_PRESS_MS,
  RADIAL_NODE_COLOR_HEX,
  normalizeRadialMenuSlots,
  visibleRadialMenuNodeOptions,
  type RadialMenuNodeOption,
} from '../utils/radialMenu';

interface RadialMenuSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type LucideIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: '素材',
  core: '核心',
  rh: 'RH',
  fal: 'FAL',
  grok: 'GROK',
  codex: 'CODEX CLI',
  inspiration: '灵感',
  comfyui: 'ComfyUI',
  special: '特殊',
  utility: '工具',
  auxiliary: '辅助',
  toolbox: '工具箱',
  '3d': '3D',
};

function iconForNode(meta: RadialMenuNodeOption | undefined): LucideIcon {
  if (!meta) return LucideIcons.Box;
  return ((LucideIcons as unknown as Record<string, LucideIcon>)[meta.icon] || LucideIcons.Box);
}

function colorForNode(meta: RadialMenuNodeOption | undefined): string {
  return RADIAL_NODE_COLOR_HEX[meta?.color || 'slate'] || RADIAL_NODE_COLOR_HEX.slate;
}

export default function RadialMenuSettingsModal({ open, onClose }: RadialMenuSettingsModalProps) {
  const slotsRaw = useRadialMenuStore((state) => state.slots);
  const longPressMs = useRadialMenuStore((state) => state.longPressMs);
  const setSlotNodeType = useRadialMenuStore((state) => state.setSlotNodeType);
  const setSlotEnabled = useRadialMenuStore((state) => state.setSlotEnabled);
  const moveSlot = useRadialMenuStore((state) => state.moveSlot);
  const setLongPressMs = useRadialMenuStore((state) => state.setLongPressMs);
  const resetRadialMenu = useRadialMenuStore((state) => state.resetRadialMenu);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const nodeOptions = useMemo(() => visibleRadialMenuNodeOptions(NODE_REGISTRY), []);
  const nodesByType = useMemo(
    () => new Map(nodeOptions.map((node) => [node.type, node])),
    [nodeOptions],
  );
  const slots = useMemo(
    () => normalizeRadialMenuSlots(NODE_REGISTRY, slotsRaw),
    [slotsRaw],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-canvas-floating-ui="radial-settings-panel"], [data-canvas-floating-ui="radial-settings-toggle"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose, open]);

  if (!open) return null;

  const handleDragStart = (event: ReactDragEvent<HTMLElement>, index: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDragIndex(index);
    setDragOverIndex(index);
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>, toIndex: number) => {
    event.preventDefault();
    const fromIndex = dragIndex ?? Number(event.dataTransfer.getData('text/plain'));
    if (Number.isInteger(fromIndex)) moveSlot(fromIndex, toIndex);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <section
      className="t8-radial-settings-panel nodrag nopan nowheel"
      data-canvas-floating-ui="radial-settings-panel"
      role="dialog"
      aria-modal="false"
      aria-label="中键圆盘设置"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="t8-radial-settings-panel__header">
        <div className="min-w-0">
          <div className="t8-radial-settings-panel__eyebrow">RADIAL MENU</div>
          <h2>中键圆盘设置</h2>
        </div>
        <div className="t8-radial-settings-panel__header-actions">
          <button type="button" className="t8-radial-settings-button" onClick={resetRadialMenu} title="恢复默认槽位">
            <LucideIcons.RotateCcw size={15} />
            默认
          </button>
          <button type="button" className="t8-radial-settings-close t8-mini-icon-button" onClick={onClose} title="关闭圆盘设置" aria-label="关闭圆盘设置">
            <LucideIcons.X size={16} />
          </button>
        </div>
      </div>

      <div className="t8-radial-settings-panel__body">
        <div className="t8-radial-settings-delay">
          <div className="t8-radial-settings-delay__meta">
            <span>长按鼠标中键呼出</span>
            <strong>{longPressMs}ms</strong>
          </div>
          <input
            type="range"
            min={180}
            max={650}
            step={10}
            value={longPressMs}
            aria-label="圆盘长按延迟"
            onChange={(event) => setLongPressMs(Number(event.currentTarget.value))}
          />
          <button type="button" className="t8-radial-settings-delay__reset" onClick={() => setLongPressMs(RADIAL_MENU_DEFAULT_LONG_PRESS_MS)}>
            恢复 320ms
          </button>
        </div>

        <div className="t8-radial-settings-grid">
          {slots.map((slot, index) => {
            const meta = nodesByType.get(slot.nodeType);
            const Icon = iconForNode(meta);
            const color = colorForNode(meta);
            return (
              <article
                key={slot.id}
                className={`t8-radial-settings-slot ${slot.enabled ? '' : 'is-disabled'} ${dragOverIndex === index ? 'is-drag-over' : ''}`}
                draggable
                aria-grabbed={dragIndex === index}
                onDragStart={(event) => handleDragStart(event, index)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDragOverIndex(index);
                }}
                onDragLeave={() => setDragOverIndex((current) => (current === index ? null : current))}
                onDrop={(event) => handleDrop(event, index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
              >
                <div className="t8-radial-settings-slot__top">
                  <span className="t8-radial-settings-slot__index">{index + 1}</span>
                  <span
                    className="t8-radial-settings-slot__icon"
                    style={{ '--radial-slot-color': color } as CSSProperties}
                  >
                    <Icon size={16} strokeWidth={2.4} />
                  </span>
                  <span className="t8-radial-settings-slot__title">
                    <strong>{meta?.label || slot.nodeType}</strong>
                    <small>{meta ? CATEGORY_LABELS[meta.category] : '节点'}</small>
                  </span>
                  <label className="t8-radial-settings-switch" title={`启用槽位 ${index + 1}`}>
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      aria-label={`启用槽位 ${index + 1}`}
                      onChange={(event) => setSlotEnabled(slot.id, event.currentTarget.checked)}
                    />
                    <span />
                  </label>
                </div>
                <div className="t8-radial-settings-slot__controls">
                  <select
                    value={slot.nodeType}
                    aria-label={`槽位 ${index + 1} 节点`}
                    onChange={(event) => setSlotNodeType(slot.id, event.currentTarget.value as NodeType)}
                  >
                    {nodeOptions.map((option) => (
                      <option key={option.type} value={option.type}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="t8-radial-settings-slot__moves" aria-label="调整槽位顺序">
                    <button type="button" title="上移" disabled={index === 0} onClick={() => moveSlot(index, index - 1)}>
                      <LucideIcons.ArrowUp size={14} />
                    </button>
                    <button type="button" title="下移" disabled={index === slots.length - 1} onClick={() => moveSlot(index, index + 1)}>
                      <LucideIcons.ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

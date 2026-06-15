import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import type { CSSProperties } from 'react';
import type { RadialMenuPoint, RadialMenuSlot } from '../utils/radialMenu';
import {
  RADIAL_MENU_CANCEL_RADIUS,
  RADIAL_MENU_DIAMETER,
  RADIAL_MENU_RADIUS,
  RADIAL_NODE_COLOR_HEX,
  distanceBetween,
  radialSlotPosition,
  type RadialMenuNodeOption,
} from '../utils/radialMenu';

interface RadialNodeMenuProps {
  center: RadialMenuPoint;
  anchor: RadialMenuPoint;
  cursor: RadialMenuPoint;
  slots: RadialMenuSlot[];
  nodesByType: Map<string, RadialMenuNodeOption>;
  activeIndex: number | null;
}

export default function RadialNodeMenu({
  center,
  anchor,
  cursor,
  slots,
  nodesByType,
  activeIndex,
}: RadialNodeMenuProps) {
  if (typeof document === 'undefined') return null;

  const localCenter = { x: RADIAL_MENU_DIAMETER / 2, y: RADIAL_MENU_DIAMETER / 2 };
  const dx = cursor.x - center.x;
  const dy = cursor.y - center.y;
  const distance = distanceBetween(center, cursor);
  const rayLength = Math.min(Math.max(distance, 0), RADIAL_MENU_RADIUS - 12);
  const activeSlot = activeIndex === null ? null : slots[activeIndex];
  const activeMeta = activeSlot ? nodesByType.get(activeSlot.nodeType) : null;
  const anchorOffset = {
    x: anchor.x - center.x,
    y: anchor.y - center.y,
  };

  const ui = (
    <div
      className="t8-radial-node-menu-layer"
      data-canvas-floating-ui="radial-node-menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="t8-radial-node-menu"
        style={{
          left: center.x - RADIAL_MENU_DIAMETER / 2,
          top: center.y - RADIAL_MENU_DIAMETER / 2,
          width: RADIAL_MENU_DIAMETER,
          height: RADIAL_MENU_DIAMETER,
        }}
      >
        <div className="t8-radial-node-menu__ring" />
        {rayLength > RADIAL_MENU_CANCEL_RADIUS && (
          <div
            className="t8-radial-node-menu__ray"
            style={{
              left: localCenter.x,
              top: localCenter.y,
              width: rayLength,
              transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`,
            }}
          />
        )}
        {(Math.abs(anchorOffset.x) > 1 || Math.abs(anchorOffset.y) > 1) && (
          <div
            className="t8-radial-node-menu__anchor"
            style={{
              left: localCenter.x + anchorOffset.x,
              top: localCenter.y + anchorOffset.y,
            }}
          />
        )}
        {slots.map((slot, index) => {
          const meta = nodesByType.get(slot.nodeType);
          const Icon = meta ? ((LucideIcons as any)[meta.icon] || LucideIcons.Box) : LucideIcons.Box;
          const pos = radialSlotPosition(localCenter, index, RADIAL_MENU_RADIUS);
          const color = RADIAL_NODE_COLOR_HEX[meta?.color || 'slate'] || RADIAL_NODE_COLOR_HEX.slate;
          const active = activeIndex === index && slot.enabled;
          return (
            <div
              key={slot.id}
              className={`t8-radial-node-menu__slot ${active ? 'is-active' : ''} ${slot.enabled ? '' : 'is-disabled'}`}
              style={{
                left: pos.x,
                top: pos.y,
                '--radial-slot-color': color,
              } as CSSProperties}
            >
              <Icon size={20} strokeWidth={2.3} />
              <span>{meta?.label || slot.nodeType}</span>
            </div>
          );
        })}
        <div className={`t8-radial-node-menu__center ${activeMeta ? 'has-active' : ''}`}>
          <strong>{activeMeta ? activeMeta.label : '取消'}</strong>
          <span>{activeMeta ? '松开创建' : '回中松开'}</span>
        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}

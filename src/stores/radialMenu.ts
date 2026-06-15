import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NodeType } from '../types/canvas';
import {
  RADIAL_MENU_DEFAULT_LONG_PRESS_MS,
  createDefaultRadialMenuSlots,
  orderedRadialMenuSlots,
  type RadialMenuSlot,
} from '../utils/radialMenu';

interface RadialMenuState {
  slots: RadialMenuSlot[];
  longPressMs: number;
  setSlotNodeType: (slotId: string, nodeType: NodeType) => void;
  setSlotEnabled: (slotId: string, enabled: boolean) => void;
  moveSlot: (fromIndex: number, toIndex: number) => void;
  setLongPressMs: (ms: number) => void;
  resetRadialMenu: () => void;
}

function normalizeLongPressMs(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return RADIAL_MENU_DEFAULT_LONG_PRESS_MS;
  return Math.min(Math.max(Math.round(n), 180), 650);
}

function normalizeSlots(slots: unknown): RadialMenuSlot[] {
  if (!Array.isArray(slots)) return createDefaultRadialMenuSlots();
  const defaults = createDefaultRadialMenuSlots();
  const merged = defaults.map((fallback, index) => {
    const raw = slots[index] as Partial<RadialMenuSlot> | undefined;
    return {
      id: raw?.id || fallback.id,
      nodeType: raw?.nodeType || fallback.nodeType,
      enabled: raw?.enabled !== false,
      order: index,
    };
  });
  return orderedRadialMenuSlots(merged);
}

export const useRadialMenuStore = create<RadialMenuState>()(
  persist(
    (set) => ({
      slots: createDefaultRadialMenuSlots(),
      longPressMs: RADIAL_MENU_DEFAULT_LONG_PRESS_MS,
      setSlotNodeType(slotId, nodeType) {
        set((state) => ({
          slots: orderedRadialMenuSlots(
            state.slots.map((slot) => (slot.id === slotId ? { ...slot, nodeType } : slot)),
          ),
        }));
      },
      setSlotEnabled(slotId, enabled) {
        set((state) => ({
          slots: orderedRadialMenuSlots(
            state.slots.map((slot) => (slot.id === slotId ? { ...slot, enabled } : slot)),
          ),
        }));
      },
      moveSlot(fromIndex, toIndex) {
        set((state) => {
          const slots = orderedRadialMenuSlots(state.slots);
          if (fromIndex < 0 || fromIndex >= slots.length || toIndex < 0 || toIndex >= slots.length || fromIndex === toIndex) {
            return { slots };
          }
          const [item] = slots.splice(fromIndex, 1);
          slots.splice(toIndex, 0, item);
          return { slots: orderedRadialMenuSlots(slots) };
        });
      },
      setLongPressMs(ms) {
        set({ longPressMs: normalizeLongPressMs(ms) });
      },
      resetRadialMenu() {
        set({
          slots: createDefaultRadialMenuSlots(),
          longPressMs: RADIAL_MENU_DEFAULT_LONG_PRESS_MS,
        });
      },
    }),
    {
      name: 't8-canvas-radial-menu-v1',
      partialize: (state) => ({
        slots: state.slots,
        longPressMs: state.longPressMs,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<RadialMenuState>;
        return {
          ...current,
          slots: normalizeSlots(p.slots),
          longPressMs: normalizeLongPressMs(p.longPressMs),
        };
      },
    },
  ),
);

import { create } from 'zustand';
import type { CanvasListItem } from '../types/canvas';
import * as api from '../services/api';

interface CanvasStoreState {
  canvases: CanvasListItem[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  completionNoticeCanvasIds: string[];

  loadCanvases: () => Promise<void>;
  createCanvas: (name?: string) => Promise<CanvasListItem | null>;
  deleteCanvas: (id: string) => Promise<void>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  setActive: (id: string) => void;
  markCanvasCompletionNotice: (id: string) => void;
  clearCanvasCompletionNotice: (id: string) => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  canvases: [],
  activeId: null,
  loading: false,
  error: null,
  completionNoticeCanvasIds: [],

  async loadCanvases() {
    set({ loading: true, error: null });
    try {
      const list = await api.listCanvases();
      const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
      set({
        canvases: sorted,
        loading: false,
        // 若无激活画布,默认选中最新一个
        activeId: get().activeId || sorted[0]?.id || null,
        completionNoticeCanvasIds: get().completionNoticeCanvasIds.filter((id) =>
          sorted.some((canvas) => canvas.id === id)
        ),
      });
    } catch (e: any) {
      set({ loading: false, error: e?.message || '加载画布列表失败' });
    }
  },

  async createCanvas(name) {
    try {
      const item = await api.createCanvas(name);
      set((s) => ({
        canvases: [item, ...s.canvases],
        activeId: item.id,
        completionNoticeCanvasIds: s.completionNoticeCanvasIds.filter((noticeId) => noticeId !== item.id),
      }));
      return item;
    } catch (e: any) {
      set({ error: e?.message || '创建画布失败' });
      return null;
    }
  },

  async deleteCanvas(id) {
    try {
      await api.deleteCanvas(id);
      set((s) => {
        const list = s.canvases.filter((x) => x.id !== id);
        const activeId = s.activeId === id ? list[0]?.id || null : s.activeId;
        return {
          canvases: list,
          activeId,
          completionNoticeCanvasIds: s.completionNoticeCanvasIds.filter((noticeId) => noticeId !== id),
        };
      });
    } catch (e: any) {
      set({ error: e?.message || '删除失败' });
    }
  },

  async renameCanvas(id, name) {
    try {
      const updated = await api.renameCanvas(id, name);
      set((s) => ({
        canvases: s.canvases.map((x) => (x.id === id ? updated : x)),
      }));
    } catch (e: any) {
      set({ error: e?.message || '重命名失败' });
    }
  },

  setActive(id) {
    set((s) => ({
      activeId: id,
      completionNoticeCanvasIds: s.completionNoticeCanvasIds.filter((noticeId) => noticeId !== id),
    }));
  },

  markCanvasCompletionNotice(id) {
    set((s) => {
      if (!id || id === s.activeId || s.completionNoticeCanvasIds.includes(id)) return s;
      return { completionNoticeCanvasIds: [...s.completionNoticeCanvasIds, id] };
    });
  },

  clearCanvasCompletionNotice(id) {
    set((s) => ({
      completionNoticeCanvasIds: s.completionNoticeCanvasIds.filter((noticeId) => noticeId !== id),
    }));
  },
}));

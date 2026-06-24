import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../services/api';
import {
  BUILT_IN_THEME_TEMPLATES,
  DEFAULT_THEME_TEMPLATE_ID,
  PIXEL_TEMPLATE_ID,
  TECH_TEMPLATE_ID,
  resolveThemeTemplate,
} from '../theme/defaultTemplates';
import type { LegacyThemeStyle, ThemeMode, ThemeTemplate } from '../theme/types';
import {
  DEFAULT_UI_FONT_PRESET,
  normalizeUiFontPresetId,
  sanitizeCustomUiFont,
  type UiFontPresetId,
} from '../utils/uiFont';

export type CanvasTheme = ThemeMode;
export type ThemeStyle = LegacyThemeStyle;

interface ThemeState {
  theme: CanvasTheme;
  style: ThemeStyle;
  templateId: string;
  customTemplates: ThemeTemplate[];
  templatesLoaded: boolean;
  templatesPath: string;
  templatesError: string | null;
  uiFontPreset: UiFontPresetId;
  customUiFont: string;
  toggleTheme: () => void;
  setTheme: (theme: CanvasTheme) => void;
  toggleStyle: () => void;
  setStyle: (style: ThemeStyle) => void;
  setTemplate: (templateId: string, mode?: CanvasTheme) => void;
  setUiFontPreset: (preset: UiFontPresetId) => void;
  setCustomUiFont: (font: string) => void;
  resetUiFontPreference: () => void;
  loadCustomTemplates: () => Promise<void>;
  importTemplate: (template: ThemeTemplate) => Promise<ThemeTemplate>;
  saveCustomTemplate: (template: ThemeTemplate) => Promise<ThemeTemplate>;
  deleteCustomTemplate: (templateId: string) => Promise<void>;
}

function legacyTemplateId(style?: ThemeStyle) {
  return style === 'tech' ? TECH_TEMPLATE_ID : PIXEL_TEMPLATE_ID;
}

/**
 * 主题状态管理。
 * - theme: dark | light 明暗模式
 * - style: tech | pixel 旧组件兼容风格
 * - templateId: 当前模板 ID，新主题体系的主入口
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      style: 'pixel',
      templateId: DEFAULT_THEME_TEMPLATE_ID,
      customTemplates: [],
      templatesLoaded: false,
      templatesPath: '',
      templatesError: null,
      uiFontPreset: DEFAULT_UI_FONT_PRESET,
      customUiFont: '',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
      toggleStyle: () =>
        set((state) => {
          const nextId = state.style === 'tech' ? PIXEL_TEMPLATE_ID : TECH_TEMPLATE_ID;
          const tpl = resolveThemeTemplate(nextId, get().customTemplates);
          return {
            templateId: tpl.id,
            style: tpl.legacyStyle,
            theme: tpl.legacyStyle === 'pixel' ? 'light' : 'dark',
          };
        }),
      setStyle: (style) => {
        const tpl = resolveThemeTemplate(legacyTemplateId(style), get().customTemplates);
        set({ templateId: tpl.id, style: tpl.legacyStyle, theme: tpl.legacyStyle === 'pixel' ? 'light' : 'dark' });
      },
      setTemplate: (templateId, mode) => {
        const tpl = resolveThemeTemplate(templateId, get().customTemplates);
        set({ templateId: tpl.id, style: tpl.legacyStyle, ...(mode ? { theme: mode } : {}) });
      },
      setUiFontPreset: (preset) => set({ uiFontPreset: normalizeUiFontPresetId(preset) }),
      setCustomUiFont: (font) => set({ customUiFont: sanitizeCustomUiFont(font), uiFontPreset: 'custom' }),
      resetUiFontPreference: () => set({ uiFontPreset: DEFAULT_UI_FONT_PRESET, customUiFont: '' }),
      async loadCustomTemplates() {
        const res = await api.getThemeTemplates();
        if (!res.success) {
          set({ templatesLoaded: true, templatesError: res.error || '加载主题模板失败' });
          return;
        }
        const customTemplates = (res.data.templates || []).map((tpl) => ({ ...tpl, builtIn: false }));
        const current = resolveThemeTemplate(get().templateId, customTemplates);
        set({
          customTemplates,
          templatesLoaded: true,
          templatesPath: res.data.path || '',
          templatesError: null,
          templateId: current.id,
          style: current.legacyStyle,
        });
      },
      async importTemplate(template) {
        const res = await api.importThemeTemplate({ ...template, builtIn: false });
        if (!res.success) throw new Error(res.error || '导入主题失败');
        const saved = { ...res.data, builtIn: false };
        set((state) => ({
          customTemplates: [...state.customTemplates.filter((tpl) => tpl.id !== saved.id), saved],
          templateId: saved.id,
          style: saved.legacyStyle,
        }));
        return saved;
      },
      async saveCustomTemplate(template) {
        const res = await api.saveThemeTemplate({ ...template, builtIn: false });
        if (!res.success) throw new Error(res.error || '保存主题失败');
        const saved = { ...res.data, builtIn: false };
        set((state) => ({
          customTemplates: [...state.customTemplates.filter((tpl) => tpl.id !== saved.id), saved],
          templateId: saved.id,
          style: saved.legacyStyle,
        }));
        return saved;
      },
      async deleteCustomTemplate(templateId) {
        if (BUILT_IN_THEME_TEMPLATES.some((tpl) => tpl.id === templateId)) return;
        const res = await api.deleteThemeTemplate(templateId);
        if (!res.success) throw new Error(res.error || '删除主题失败');
        set((state) => {
          const customTemplates = state.customTemplates.filter((tpl) => tpl.id !== templateId);
          const currentDeleted = state.templateId === templateId;
          const fallback = resolveThemeTemplate(DEFAULT_THEME_TEMPLATE_ID, customTemplates);
          return {
            customTemplates,
            ...(currentDeleted ? { templateId: fallback.id, style: fallback.legacyStyle, theme: 'light' as CanvasTheme } : {}),
          };
        });
      },
    }),
    {
      name: 't8-canvas-theme',
      partialize: (state) => ({
        theme: state.theme,
        style: state.style,
        templateId: state.templateId,
        uiFontPreset: state.uiFontPreset,
        customUiFont: state.customUiFont,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<ThemeState>;
        const templateId = p.templateId || legacyTemplateId(p.style);
        const tpl = BUILT_IN_THEME_TEMPLATES.find((item) => item.id === templateId);
        return {
          ...current,
          ...p,
          templateId,
          style: tpl?.legacyStyle || p.style || current.style,
          theme: p.theme || ((tpl?.legacyStyle || p.style) === 'pixel' ? 'light' : 'dark'),
          uiFontPreset: normalizeUiFontPresetId(p.uiFontPreset),
          customUiFont: sanitizeCustomUiFont(p.customUiFont),
        };
      },
    }
  )
);

export type UiFontPresetId = 'readable' | 'system' | 'theme' | 'custom';

export const DEFAULT_UI_FONT_PRESET: UiFontPresetId = 'readable';

export const READABLE_UI_FONT_STACK =
  "'Microsoft YaHei UI', 'Microsoft YaHei', 'Segoe UI', 'Noto Sans SC', 'PingFang SC', system-ui, sans-serif";

export const SYSTEM_UI_FONT_STACK =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

export const UI_FONT_PRESETS = [
  {
    id: 'readable',
    label: '清晰推荐',
    description: '优先使用 Windows 中文 UI 字体，缩小时更稳。',
    stack: READABLE_UI_FONT_STACK,
  },
  {
    id: 'system',
    label: '系统默认',
    description: '跟随浏览器和系统 UI 字体。',
    stack: SYSTEM_UI_FONT_STACK,
  },
  {
    id: 'theme',
    label: '跟随主题',
    description: '使用当前主题模板自带字体。',
    stack: '',
  },
  {
    id: 'custom',
    label: '自定义',
    description: '输入自己的字体栈，本机安装后生效。',
    stack: '',
  },
] satisfies Array<{ id: UiFontPresetId; label: string; description: string; stack: string }>;

export function normalizeUiFontPresetId(value: unknown): UiFontPresetId {
  if (value === 'readable' || value === 'system' || value === 'theme' || value === 'custom') {
    return value;
  }
  return DEFAULT_UI_FONT_PRESET;
}

export function sanitizeCustomUiFont(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[;{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

export function resolveUiFontStack(presetId: unknown, customFont: unknown): string {
  const preset = normalizeUiFontPresetId(presetId);
  if (preset === 'theme') return '';
  if (preset === 'custom') {
    return sanitizeCustomUiFont(customFont) || READABLE_UI_FONT_STACK;
  }
  if (preset === 'system') return SYSTEM_UI_FONT_STACK;
  return READABLE_UI_FONT_STACK;
}

export function applyUiFontPreference(root: HTMLElement, presetId: unknown, customFont: unknown): void {
  const preset = normalizeUiFontPresetId(presetId);
  const stack = resolveUiFontStack(preset, customFont);
  root.setAttribute('data-ui-font', preset);

  if (!stack) {
    root.style.removeProperty('--t8-user-font-family');
    return;
  }

  root.style.setProperty('--t8-user-font-family', stack);
  root.style.setProperty('--t8-font-family', 'var(--t8-user-font-family)');
  root.style.setProperty('--t8-font-display', 'var(--t8-user-font-family)');
  root.style.setProperty('--px-font-display', 'var(--t8-user-font-family)');
  root.style.setProperty('--px-font-pixel', 'var(--t8-user-font-family)');
}

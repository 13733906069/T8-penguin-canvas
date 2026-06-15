type Rgba = { r: number; g: number; b: number; a: number };

export interface ReadableStudioPaletteInput {
  isDark: boolean;
  isPixel?: boolean;
  accent: string;
  bg: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  subText: string;
  border: string;
  danger: string;
}

export interface ReadableStudioPalette {
  accentText: string;
  headerText: string;
  headerSubText: string;
  surfaceText: string;
  surfaceStrongText: string;
  controlBg: string;
  controlText: string;
  noticeBg: string;
  noticeText: string;
  noticeSubText: string;
  noticeBorder: string;
  dangerText: string;
}

const DARK_TEXT = '#06111f';
const LIGHT_TEXT = '#f8fafc';

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, value));
}

function parseHexColor(value: string): Rgba | null {
  const hex = value.trim().replace(/^#/, '');
  if (!/^[\da-f]{3}$|^[\da-f]{6}$/i.test(hex)) return null;
  const expanded = hex.length === 3
    ? hex.split('').map((part) => `${part}${part}`).join('')
    : hex;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
    a: 1,
  };
}

function parseRgbColor(value: string): Rgba | null {
  const match = value.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => part.trim());
  if (parts.length < 3) return null;
  const [r, g, b] = parts.slice(0, 3).map((part) => clampChannel(Number.parseFloat(part)));
  if ([r, g, b].some((part) => Number.isNaN(part))) return null;
  const alpha = parts[3] === undefined ? 1 : Math.max(0, Math.min(1, Number.parseFloat(parts[3])));
  return { r, g, b, a: Number.isNaN(alpha) ? 1 : alpha };
}

function parseColor(value: string): Rgba | null {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.includes('var(')) return null;
  if (trimmed.startsWith('#')) return parseHexColor(trimmed);
  return parseRgbColor(trimmed);
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.a;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
}

function linearize(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: Rgba) {
  return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
}

function contrastRatio(a: Rgba, b: Rgba) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextOn(background: string, isDark = false, darkText = DARK_TEXT, lightText = LIGHT_TEXT) {
  const parsed = parseColor(background);
  if (!parsed) return isDark ? lightText : darkText;
  const base = isDark
    ? { r: 7, g: 12, b: 24, a: 1 }
    : { r: 255, g: 255, b: 255, a: 1 };
  const effective = parsed.a < 1 ? composite(parsed, base) : parsed;
  const dark = parseColor(darkText) || { r: 6, g: 17, b: 31, a: 1 };
  const light = parseColor(lightText) || { r: 248, g: 250, b: 252, a: 1 };
  return contrastRatio(effective, light) > contrastRatio(effective, dark) ? lightText : darkText;
}

function softTextFor(textColor: string) {
  return textColor === LIGHT_TEXT ? 'rgba(248,250,252,0.78)' : 'rgba(6,17,31,0.76)';
}

export function createReadableStudioPalette(input: ReadableStudioPaletteInput): ReadableStudioPalette {
  if (input.isPixel) {
    return {
      accentText: readableTextOn(input.accent, input.isDark),
      headerText: readableTextOn(input.surfaceStrong, input.isDark),
      headerSubText: input.isDark ? 'rgba(248,250,252,0.78)' : 'rgba(6,17,31,0.76)',
      surfaceText: input.isDark ? LIGHT_TEXT : DARK_TEXT,
      surfaceStrongText: readableTextOn(input.surfaceStrong, input.isDark),
      controlBg: input.isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)',
      controlText: input.isDark ? '#e5f2ff' : '#111827',
      noticeBg: 'var(--px-yellow)',
      noticeText: input.isDark ? LIGHT_TEXT : DARK_TEXT,
      noticeSubText: input.isDark ? 'rgba(248,250,252,0.78)' : 'rgba(6,17,31,0.76)',
      noticeBorder: input.border,
      dangerText: readableTextOn(input.danger, input.isDark),
    };
  }

  const accentText = readableTextOn(input.accent, input.isDark);
  const headerText = readableTextOn(input.surfaceStrong, input.isDark);
  const surfaceText = readableTextOn(input.surface, input.isDark);
  const surfaceStrongText = readableTextOn(input.surfaceStrong, input.isDark);
  const noticeBg = input.isDark ? 'rgba(250,204,21,0.92)' : 'rgba(254,243,199,0.96)';
  const noticeText = readableTextOn(noticeBg, input.isDark);

  return {
    accentText,
    headerText,
    headerSubText: softTextFor(headerText),
    surfaceText,
    surfaceStrongText,
    controlBg: input.isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)',
    controlText: input.isDark ? '#e5f2ff' : '#111827',
    noticeBg,
    noticeText,
    noticeSubText: softTextFor(noticeText),
    noticeBorder: 'rgba(120,53,15,0.45)',
    dangerText: readableTextOn(input.danger, input.isDark),
  };
}

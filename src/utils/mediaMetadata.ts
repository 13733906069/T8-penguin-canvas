import type { MediaKind } from './mediaCollection';

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
}

function cleanPositiveNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function formatMediaDuration(seconds: unknown): string {
  const value = cleanPositiveNumber(seconds);
  if (!value) return '';
  if (value < 60) return `${value.toFixed(1)}s`;
  const whole = Math.round(value);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMediaResolution(width: unknown, height: unknown): string {
  const w = cleanPositiveNumber(width);
  const h = cleanPositiveNumber(height);
  if (!w || !h) return '';
  return `${Math.round(w)}×${Math.round(h)}`;
}

export function formatMediaMetadataSummary(kind: MediaKind, metadata: MediaMetadata | null | undefined): string {
  if (!metadata) return '';
  const resolution = kind === 'image' || kind === 'video'
    ? formatMediaResolution(metadata.width, metadata.height)
    : '';
  const duration = kind === 'video' || kind === 'audio'
    ? formatMediaDuration(metadata.duration)
    : '';
  return [resolution, duration].filter(Boolean).join(' · ');
}

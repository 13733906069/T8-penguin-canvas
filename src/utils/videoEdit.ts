import { fileNameFromUrl, type MediaItem } from './mediaCollection';
import type { SendableMaterial } from './sendMaterials';

export type VideoEditAspect = 'first' | 'source' | '16:9' | '9:16' | '1:1' | '3:4' | '4:3' | '21:9' | '2:1';
export type VideoEditResolution = 'first' | '720p' | '1080p' | '2k' | '4k';
export type VideoEditTransition = 'none' | 'fade' | 'crossfade' | 'black' | 'white' | 'slide';
export type VideoEditFilter = 'none' | 'bright' | 'contrast' | 'warm' | 'cool' | 'mono' | 'cinematic';
export type VideoEditAudioMode = 'keep' | 'mute' | 'first';
export type VideoEditJobStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
export type VideoEditOutputPresetId = 'custom' | 'vertical-short' | 'wide-video' | 'square-social' | 'portrait-poster' | 'classic-horizontal' | 'cinema-wide' | 'panorama-wide';
export type VideoEditCreatorTemplateId = 'manual' | 'quick-montage' | 'talking-mix' | 'product-showcase' | 'before-after' | 'batch-showcase';

export interface VideoEditClip {
  id: string;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  sourceLabel: string;
  name: string;
  url: string;
  directUrl?: string;
  mime?: string;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
  thumbnailUrl?: string;
  trimStart: number;
  trimEnd?: number;
  muted?: boolean;
  status: 'ready' | 'probing' | 'missing' | 'error';
  error?: string;
}

export interface VideoEditSettings {
  aspect: VideoEditAspect;
  resolution: VideoEditResolution;
  transition: VideoEditTransition;
  transitionDuration: number;
  filter: VideoEditFilter;
  audio: VideoEditAudioMode;
  autoCreateOutputNode: boolean;
  outputPreset?: VideoEditOutputPresetId;
  creatorTemplate?: VideoEditCreatorTemplateId;
}

export interface VideoEditOutput {
  videoUrl: string;
  directVideoUrl?: string;
  name: string;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
}

export interface VideoEditJob {
  id?: string;
  status: VideoEditJobStatus;
  progress: number;
  message?: string;
}

export interface VideoEditNodeData {
  clips: VideoEditClip[];
  selectedClipId?: string;
  output?: VideoEditOutput;
  settings: VideoEditSettings;
  job?: VideoEditJob;
  videoUrl?: string;
  videoUrls?: string[];
  directVideoUrl?: string;
  directVideoUrls?: string[];
  fileName?: string;
  fileSize?: number;
  mime?: string;
  status?: string;
  error?: string;
}

export const DEFAULT_VIDEO_EDIT_SETTINGS: VideoEditSettings = {
  aspect: 'first',
  resolution: 'first',
  transition: 'none',
  transitionDuration: 0.5,
  filter: 'none',
  audio: 'keep',
  autoCreateOutputNode: false,
  outputPreset: 'custom',
  creatorTemplate: 'manual',
};

export const DEFAULT_VIDEO_EDIT_DATA: VideoEditNodeData = {
  clips: [],
  selectedClipId: '',
  output: undefined,
  settings: DEFAULT_VIDEO_EDIT_SETTINGS,
  job: { status: 'idle', progress: 0 },
  videoUrl: '',
  videoUrls: [],
  directVideoUrl: '',
  directVideoUrls: [],
  fileName: '',
  fileSize: 0,
  mime: 'video/mp4',
  status: 'idle',
  error: '',
};

export const VIDEO_EDIT_OUTPUT_PRESETS: Array<{
  id: VideoEditOutputPresetId;
  label: string;
  hint: string;
  aspect: VideoEditAspect;
  resolution: VideoEditResolution;
}> = [
  { id: 'custom', label: '自定义', hint: '保留当前设置', aspect: 'first', resolution: 'first' },
  { id: 'vertical-short', label: '抖音/快手', hint: '竖屏短视频', aspect: '9:16', resolution: '1080p' },
  { id: 'wide-video', label: 'B站/YouTube', hint: '横屏成片', aspect: '16:9', resolution: '1080p' },
  { id: 'square-social', label: '方形社媒', hint: '封面和动态', aspect: '1:1', resolution: '1080p' },
  { id: 'portrait-poster', label: '竖版海报', hint: '3:4 人像展示', aspect: '3:4', resolution: '1080p' },
  { id: 'classic-horizontal', label: '横版展示', hint: '4:3 经典比例', aspect: '4:3', resolution: '1080p' },
  { id: 'cinema-wide', label: '电影宽屏', hint: '21:9 氛围短片', aspect: '21:9', resolution: '1080p' },
  { id: 'panorama-wide', label: '宽幅/全景', hint: '2:1 展示流', aspect: '2:1', resolution: '1080p' },
];

export const VIDEO_EDIT_CREATOR_TEMPLATES: Array<{
  id: VideoEditCreatorTemplateId;
  label: string;
  hint: string;
  patch: Partial<VideoEditSettings>;
}> = [
  { id: 'manual', label: '手动剪辑', hint: '不改当前参数', patch: { creatorTemplate: 'manual' } },
  { id: 'quick-montage', label: '快速混剪', hint: '轻转场 + 电影感', patch: { transition: 'fade', transitionDuration: 0.5, filter: 'cinematic', audio: 'keep', creatorTemplate: 'quick-montage' } },
  { id: 'talking-mix', label: '口播混剪', hint: '竖屏 + 保留第一段声音', patch: { aspect: '9:16', resolution: '1080p', transition: 'fade', transitionDuration: 0.4, filter: 'bright', audio: 'first', creatorTemplate: 'talking-mix', outputPreset: 'vertical-short' } },
  { id: 'product-showcase', label: '产品展示', hint: '横屏 + 对比增强', patch: { aspect: '16:9', resolution: '1080p', transition: 'crossfade', transitionDuration: 0.6, filter: 'contrast', audio: 'keep', creatorTemplate: 'product-showcase', outputPreset: 'wide-video' } },
  { id: 'before-after', label: '前后对比', hint: '黑场分隔重点镜头', patch: { transition: 'black', transitionDuration: 0.4, filter: 'none', audio: 'mute', creatorTemplate: 'before-after' } },
  { id: 'batch-showcase', label: '批量合集', hint: '滑入过渡 + 方形发布', patch: { aspect: '1:1', resolution: '1080p', transition: 'slide', transitionDuration: 0.5, filter: 'warm', audio: 'mute', creatorTemplate: 'batch-showcase', outputPreset: 'square-social' } },
];

const ASPECTS: VideoEditAspect[] = ['first', 'source', '16:9', '9:16', '1:1', '3:4', '4:3', '21:9', '2:1'];
const RESOLUTIONS: VideoEditResolution[] = ['first', '720p', '1080p', '2k', '4k'];
const TRANSITIONS: VideoEditTransition[] = ['none', 'fade', 'crossfade', 'black', 'white', 'slide'];
const FILTERS: VideoEditFilter[] = ['none', 'bright', 'contrast', 'warm', 'cool', 'mono', 'cinematic'];
const AUDIO_MODES: VideoEditAudioMode[] = ['keep', 'mute', 'first'];
const OUTPUT_PRESET_IDS = VIDEO_EDIT_OUTPUT_PRESETS.map((item) => item.id);
const CREATOR_TEMPLATE_IDS = VIDEO_EDIT_CREATOR_TEMPLATES.map((item) => item.id);

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeVideoEditSettings(input: unknown): VideoEditSettings {
  const raw = input && typeof input === 'object' ? input as Partial<VideoEditSettings> : {};
  return {
    aspect: pick(raw.aspect, ASPECTS, DEFAULT_VIDEO_EDIT_SETTINGS.aspect),
    resolution: pick(raw.resolution, RESOLUTIONS, DEFAULT_VIDEO_EDIT_SETTINGS.resolution),
    transition: pick(raw.transition, TRANSITIONS, DEFAULT_VIDEO_EDIT_SETTINGS.transition),
    transitionDuration: clampNumber(raw.transitionDuration, 0.1, 2, DEFAULT_VIDEO_EDIT_SETTINGS.transitionDuration),
    filter: pick(raw.filter, FILTERS, DEFAULT_VIDEO_EDIT_SETTINGS.filter),
    audio: pick(raw.audio, AUDIO_MODES, DEFAULT_VIDEO_EDIT_SETTINGS.audio),
    autoCreateOutputNode: raw.autoCreateOutputNode === true,
    outputPreset: pick(raw.outputPreset, OUTPUT_PRESET_IDS, DEFAULT_VIDEO_EDIT_SETTINGS.outputPreset || 'custom'),
    creatorTemplate: pick(raw.creatorTemplate, CREATOR_TEMPLATE_IDS, DEFAULT_VIDEO_EDIT_SETTINGS.creatorTemplate || 'manual'),
  };
}

export function applyVideoEditOutputPreset(settings: VideoEditSettings, presetId: VideoEditOutputPresetId): VideoEditSettings {
  const preset = VIDEO_EDIT_OUTPUT_PRESETS.find((item) => item.id === presetId);
  if (!preset || preset.id === 'custom') {
    return { ...settings, outputPreset: 'custom' };
  }
  return {
    ...settings,
    aspect: preset.aspect,
    resolution: preset.resolution,
    outputPreset: preset.id,
  };
}

export function applyVideoEditCreatorTemplate(settings: VideoEditSettings, templateId: VideoEditCreatorTemplateId): VideoEditSettings {
  const template = VIDEO_EDIT_CREATOR_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return settings;
  return normalizeVideoEditSettings({
    ...settings,
    ...template.patch,
    creatorTemplate: template.id,
  });
}

export function normalizeVideoEditClips(input: unknown): VideoEditClip[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: VideoEditClip[] = [];
  input.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const raw = item as Partial<VideoEditClip>;
    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    if (!url || seen.has(url)) return;
    seen.add(url);
    const duration = Number(raw.duration);
    const trimStart = clampNumber(raw.trimStart, 0, Math.max(0, Number.isFinite(duration) ? duration : 60 * 60), 0);
    const trimEnd = raw.trimEnd === undefined ? undefined : clampNumber(raw.trimEnd, trimStart + 0.1, 24 * 60 * 60, Number.isFinite(duration) ? duration : trimStart + 1);
    out.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id : `clip-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      sourceNodeId: typeof raw.sourceNodeId === 'string' ? raw.sourceNodeId : undefined,
      sourceCanvasId: typeof raw.sourceCanvasId === 'string' ? raw.sourceCanvasId : undefined,
      sourceLabel: typeof raw.sourceLabel === 'string' && raw.sourceLabel ? raw.sourceLabel : '视频素材',
      name: typeof raw.name === 'string' && raw.name ? raw.name : fileNameFromUrl(url),
      url,
      directUrl: typeof raw.directUrl === 'string' ? raw.directUrl : undefined,
      mime: typeof raw.mime === 'string' ? raw.mime : undefined,
      duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
      width: Number.isFinite(Number(raw.width)) ? Number(raw.width) : undefined,
      height: Number.isFinite(Number(raw.height)) ? Number(raw.height) : undefined,
      size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : undefined,
      thumbnailUrl: typeof raw.thumbnailUrl === 'string' ? raw.thumbnailUrl : undefined,
      trimStart,
      trimEnd,
      muted: raw.muted === true,
      status: raw.status === 'probing' || raw.status === 'missing' || raw.status === 'error' ? raw.status : 'ready',
      error: typeof raw.error === 'string' ? raw.error : undefined,
    });
  });
  return out;
}

export function totalVideoEditDuration(clips: VideoEditClip[]): number {
  return clips.reduce((sum, clip) => {
    const end = Number.isFinite(clip.trimEnd || 0) && clip.trimEnd ? clip.trimEnd : clip.duration;
    if (!Number.isFinite(end || 0)) return sum;
    return sum + Math.max(0, Number(end) - Math.max(0, clip.trimStart || 0));
  }, 0);
}

export function createVideoEditClipFromMediaItem(item: MediaItem, extra: Partial<VideoEditClip> = {}): VideoEditClip {
  return {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceLabel: extra.sourceLabel || '视频素材',
    name: item.name || fileNameFromUrl(item.url),
    url: item.url,
    directUrl: extra.directUrl || item.url,
    mime: item.mime,
    size: item.size,
    trimStart: 0,
    status: 'ready',
    ...extra,
  };
}

export function createVideoEditClipFromSendable(item: SendableMaterial): VideoEditClip | null {
  if (item.kind !== 'video' || !item.url) return null;
  return createVideoEditClipFromMediaItem(
    {
      kind: 'video',
      url: item.url,
      name: item.name || fileNameFromUrl(item.url),
      size: item.size,
      mime: item.mime,
    },
    {
      sourceNodeId: item.sourceNodeId,
      sourceCanvasId: item.sourceCanvasId,
      sourceLabel: item.sourceType || '发送素材',
    },
  );
}

export function appendVideoEditClips(existing: unknown, incoming: VideoEditClip[]): VideoEditClip[] {
  const base = normalizeVideoEditClips(existing);
  const seen = new Set(base.map((clip) => clip.url));
  const next = [...base];
  incoming.forEach((clip) => {
    if (!clip.url || seen.has(clip.url)) return;
    seen.add(clip.url);
    next.push(clip);
  });
  return next;
}

import type { NodeType } from '../types/canvas';
import { createOutputDataFromItems, fileNameFromUrl, type MediaItem, type MediaKind } from './mediaCollection';

export const VIBEX_APP_ID = 'app-bcbdf4c87cbc4a1eae20733de3ce40e4';
export const VIBEX_INVITE_CODE = 'rh-v1121';
export const VIBEX_ONLINE_URL = `https://vibex.runninghub.cn/p/${VIBEX_APP_ID}/?inviteCode=${VIBEX_INVITE_CODE}`;
export const RUNNINGHUB_INVITE_URL = `https://www.runninghub.cn/?inviteCode=${VIBEX_INVITE_CODE}`;

export const VIBEX_MESSAGE_CONTRACT = {
  type: 't8:vibex-result',
  source: 'vibex-workbench',
} as const;

export type VibeXFrameMode = 'online' | 'custom';

export interface VibeXResultPayload {
  messageId: string;
  prompt: string;
  model: string;
  taskId: string;
  rhTaskId: string;
  pageUrl: string;
  pageTitle: string;
  videoUrls: string[];
  imageUrls: string[];
  audioUrls: string[];
  metadata: Record<string, any>;
}

export interface VibeXSendNodeSpec {
  type: NodeType;
  data: Record<string, any>;
}

function cleanText(value: unknown, maxLen = 8000): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function cleanUrl(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^(https?:|data:|blob:|\/files\/|\/output\/|\/input\/)/i.test(text)) return text;
  return '';
}

function toUrlArray(...values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    const url = typeof value === 'object' && value
      ? cleanUrl((value as any).url || (value as any).videoUrl || (value as any).imageUrl || (value as any).audioUrl)
      : cleanUrl(value);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };
  values.forEach(push);
  return out.slice(0, 24);
}

function mediaItems(kind: Exclude<MediaKind, 'model3d'>, urls: string[]): MediaItem[] {
  return urls.map((url) => ({
    kind,
    url,
    name: fileNameFromUrl(url),
  }));
}

export function buildVibeXFrameUrl(mode: VibeXFrameMode = 'online', customUrl = ''): string {
  if (mode === 'custom') return cleanUrl(customUrl) || VIBEX_ONLINE_URL;
  return VIBEX_ONLINE_URL;
}

export function normalizeVibeXResultPayload(input: unknown): VibeXResultPayload | null {
  const raw = input && typeof input === 'object' ? input as Record<string, any> : {};
  const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload as Record<string, any> : raw;
  const videoUrls = toUrlArray(payload.videoUrls, payload.videos, payload.videoUrl, payload.resultUrl, payload.currentVideoUrl);
  const imageUrls = toUrlArray(payload.imageUrls, payload.images, payload.imageUrl, payload.coverUrl, payload.thumbnailUrl);
  const audioUrls = toUrlArray(payload.audioUrls, payload.audios, payload.audioUrl);
  const prompt = cleanText(payload.prompt || payload.textPrompt || payload.imagePrompt || payload.refPrompt || payload.description);

  if (videoUrls.length === 0 && imageUrls.length === 0 && audioUrls.length === 0 && !prompt) {
    return null;
  }

  return {
    messageId: cleanText(payload.messageId || raw.messageId || `${Date.now()}`, 160),
    prompt,
    model: cleanText(payload.model || payload.modelName || payload.tier || '', 200),
    taskId: cleanText(payload.taskId || payload.task_id || '', 200),
    rhTaskId: cleanText(payload.rhTaskId || payload.rh_task_id || '', 200),
    pageUrl: cleanText(payload.pageUrl || (typeof window !== 'undefined' ? window.location.href : ''), 2048),
    pageTitle: cleanText(payload.pageTitle || (typeof document !== 'undefined' ? document.title : 'VibeX'), 200),
    videoUrls,
    imageUrls,
    audioUrls,
    metadata: {
      ratio: cleanText(payload.ratio, 80),
      duration: cleanText(payload.duration, 80),
      resolution: cleanText(payload.resolution, 80),
      mode: cleanText(payload.mode || payload.activeTab, 80),
      tier: cleanText(payload.tier, 80),
      createdAt: cleanText(payload.createdAt || new Date().toISOString(), 80),
    },
  };
}

function outputData(
  kind: Exclude<MediaKind, 'model3d'>,
  urls: string[],
  payload: VibeXResultPayload,
): Record<string, any> {
  return {
    ...createOutputDataFromItems(kind, mediaItems(kind, urls)),
    directOutputText: payload.prompt,
    outputText: payload.prompt,
    textSegments: payload.prompt ? [payload.prompt] : [],
    directTextSegments: payload.prompt ? [payload.prompt] : [],
    sendSource: 'vibex',
    source: 'vibex',
    vibexPrompt: payload.prompt,
    vibexModel: payload.model,
    vibexTaskId: payload.taskId,
    vibexRhTaskId: payload.rhTaskId,
    vibexPageUrl: payload.pageUrl,
    vibexPageTitle: payload.pageTitle,
    vibexMetadata: payload.metadata,
  };
}

export function buildVibeXSendNodeSpecs(payload: VibeXResultPayload): VibeXSendNodeSpec[] {
  const specs: VibeXSendNodeSpec[] = [];
  if (payload.videoUrls.length > 0) {
    specs.push({ type: 'output', data: outputData('video', payload.videoUrls, payload) });
  }
  if (payload.imageUrls.length > 0) {
    specs.push({ type: 'output', data: outputData('image', payload.imageUrls, payload) });
  }
  if (payload.audioUrls.length > 0) {
    specs.push({ type: 'output', data: outputData('audio', payload.audioUrls, payload) });
  }
  if (specs.length === 0 && payload.prompt) {
    specs.push({
      type: 'text',
      data: {
        prompt: payload.prompt,
        text: payload.prompt,
        label: 'VibeX 提示词',
        source: 'vibex',
        vibexPrompt: payload.prompt,
        vibexModel: payload.model,
        vibexTaskId: payload.taskId,
        vibexRhTaskId: payload.rhTaskId,
        vibexPageUrl: payload.pageUrl,
        vibexPageTitle: payload.pageTitle,
        vibexMetadata: payload.metadata,
      },
    });
  }
  return specs;
}

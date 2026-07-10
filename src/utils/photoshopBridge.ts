import type { NodeType } from '../types/canvas';
import { createOutputDataFromItems, fileNameFromUrl, type MediaItem } from './mediaCollection';

export const PHOTOSHOP_MESSAGE_CONTRACT = {
  type: 't8:photoshop-result',
  source: 'photoshop-uxp',
} as const;

export interface PhotoshopResultPayload {
  messageId: string;
  mode: string;
  prompt: string;
  imageUrls: string[];
  documentName: string;
  layerName: string;
  metadata: Record<string, any>;
}

export interface PhotoshopSendNodeSpec {
  type: NodeType;
  data: Record<string, any>;
}

function cleanText(value: unknown, maxLen = 8000): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function cleanUrl(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^(https?:|data:image\/|blob:|\/files\/|\/output\/|\/input\/)/i.test(text)) return text;
  return '';
}

function pushUrl(out: string[], seen: Set<string>, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item) => pushUrl(out, seen, item));
    return;
  }
  const raw = value && typeof value === 'object'
    ? (value as any).url || (value as any).imageUrl || (value as any).resultUrl || (value as any).outputUrl
    : value;
  const url = cleanUrl(raw);
  if (!url || seen.has(url)) return;
  seen.add(url);
  out.push(url);
}

function toImageUrls(payload: Record<string, any>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  pushUrl(out, seen, payload.imageUrls);
  pushUrl(out, seen, payload.images);
  pushUrl(out, seen, payload.imageUrl);
  pushUrl(out, seen, payload.url);
  pushUrl(out, seen, payload.resultUrl);
  return out.slice(0, 48);
}

function cleanMetadata(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, any> = {};
  for (const [key, raw] of Object.entries(value as Record<string, any>)) {
    if (/api|key|token|secret|password|credential|cookie/i.test(key)) continue;
    if (raw == null) continue;
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      out[key] = raw;
    } else {
      out[key] = cleanText(raw, 500);
    }
  }
  return out;
}

function imageItems(urls: string[]): MediaItem[] {
  return urls.map((url) => ({
    kind: 'image',
    url,
    name: fileNameFromUrl(url),
  }));
}

export function normalizePhotoshopResultPayload(input: unknown): PhotoshopResultPayload | null {
  const raw = input && typeof input === 'object' ? input as Record<string, any> : {};
  const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload as Record<string, any> : raw;
  const imageUrls = toImageUrls(payload);
  const prompt = cleanText(payload.prompt || payload.text || payload.outputText);

  if (imageUrls.length === 0 && !prompt) return null;

  return {
    messageId: cleanText(payload.messageId || raw.messageId || `${Date.now()}`, 180),
    mode: cleanText(payload.mode || payload.exportMode || 'image', 80) || 'image',
    prompt,
    imageUrls,
    documentName: cleanText(payload.documentName || payload.document || payload.docName, 240),
    layerName: cleanText(payload.layerName || payload.layer, 240),
    metadata: cleanMetadata(payload.metadata),
  };
}

export function buildPhotoshopSendNodeSpecs(payload: PhotoshopResultPayload): PhotoshopSendNodeSpec[] {
  const specs: PhotoshopSendNodeSpec[] = [];
  if (payload.imageUrls.length > 0) {
    specs.push({
      type: 'output',
      data: {
        ...createOutputDataFromItems('image', imageItems(payload.imageUrls)),
        directOutputText: payload.prompt,
        outputText: payload.prompt,
        textSegments: payload.prompt ? [payload.prompt] : [],
        directTextSegments: payload.prompt ? [payload.prompt] : [],
        sendSource: 'photoshop',
        source: 'photoshop',
        photoshopPrompt: payload.prompt,
        photoshopMode: payload.mode,
        photoshopDocumentName: payload.documentName,
        photoshopLayerName: payload.layerName,
        photoshopMetadata: payload.metadata,
      },
    });
  }
  if (specs.length === 0 && payload.prompt) {
    specs.push({
      type: 'text',
      data: {
        prompt: payload.prompt,
        text: payload.prompt,
        label: 'Photoshop 提示词',
        source: 'photoshop',
        photoshopPrompt: payload.prompt,
        photoshopMode: payload.mode,
        photoshopDocumentName: payload.documentName,
        photoshopLayerName: payload.layerName,
        photoshopMetadata: payload.metadata,
      },
    });
  }
  return specs;
}

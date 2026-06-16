import type { SeedanceSubmitRequest } from '../services/generation';
import type { MediaMention, MediaMentionKind } from '../components/nodes/mediaMentions';

export type DirectorStoryboardFrameMode = 'auto' | 'first' | 'firstlast' | 'multiframe';
export type DirectorStoryboardJobKind = 'shot' | 'bridge';
export type DirectorStoryboardJobStatus = 'success' | 'error' | 'cancelled';

export interface DirectorStoryboardMentionMaterial {
  kind: MediaMentionKind;
  url: string;
  label?: string;
  mentionKey?: string;
  mentionToken?: string;
}

export interface DirectorStoryboardShot {
  id: string;
  title: string;
  durationSec: number;
  prompt: string;
  negativePrompt?: string;
  promptMentions?: MediaMention[];
  frameMode: DirectorStoryboardFrameMode;
  localRefImages: string[];
  localRefVideos: string[];
  localRefAudios: string[];
  seed?: number;
  modelOverride?: string;
  ratioOverride?: string;
  resolutionOverride?: string;
  status?: string;
  taskId?: string | null;
  videoUrl?: string | null;
  error?: string | null;
}

export interface DirectorStoryboardInputShot {
  id?: string;
  title?: string;
  durationSec?: number;
  prompt?: string;
  negativePrompt?: string;
  promptMentions?: MediaMention[];
  frameMode?: DirectorStoryboardFrameMode;
  localRefImages?: string[];
  localRefVideos?: string[];
  localRefAudios?: string[];
  seed?: number;
  modelOverride?: string;
  ratioOverride?: string;
  resolutionOverride?: string;
  status?: string;
  taskId?: string | null;
  videoUrl?: string | null;
  error?: string | null;
}

export interface DirectorStoryboardSettings {
  model: string;
  ratio: string;
  resolution: string;
  generateAudio: boolean;
  returnLastFrame: boolean;
  watermark: boolean;
  webSearch: boolean;
  seed: number;
  bridgeEnabled?: boolean;
  bridgeDurationSec?: number;
  bridgePrompt?: string;
}

export interface BuildDirectorShotPayloadContext {
  upstreamPrompt?: string;
  mentionMaterials?: DirectorStoryboardMentionMaterial[];
  globalImages?: string[];
  globalVideos?: string[];
  globalAudios?: string[];
}

export interface DirectorStoryboardJob {
  id: string;
  shotId: string;
  order: number;
  kind: DirectorStoryboardJobKind;
  title: string;
  payload: SeedanceSubmitRequest;
}

export interface DirectorStoryboardJobResult {
  job: DirectorStoryboardJob;
  status: DirectorStoryboardJobStatus;
  videoUrl?: string;
  error?: string;
}

export interface DirectorStoryboardRunResult {
  results: DirectorStoryboardJobResult[];
  videoUrls: string[];
}

export interface RunDirectorStoryboardJobsOptions {
  signal?: AbortSignal;
  onJobComplete?: (result: DirectorStoryboardJobResult) => void;
}

export const DIRECTOR_STORYBOARD_DEFAULT_DURATION_SEC = 5;
export const DIRECTOR_STORYBOARD_MIN_DURATION_SEC = 4;
export const DIRECTOR_STORYBOARD_MAX_DURATION_SEC = 15;

export interface DirectorTimelineDragDurationInput {
  startDurationSec: number;
  startClientX: number;
  currentClientX: number;
  timelineWidthPx: number;
  totalDurationSec: number;
}
const TOKEN_PREFIX: Record<MediaMentionKind, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  text: 'text',
};

function makeShotId(index: number): string {
  return `shot-${Date.now().toString(36)}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeDurationSec(value: unknown): number {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return DIRECTOR_STORYBOARD_DEFAULT_DURATION_SEC;
  return Math.max(DIRECTOR_STORYBOARD_MIN_DURATION_SEC, Math.min(DIRECTOR_STORYBOARD_MAX_DURATION_SEC, Math.round(raw)));
}

export function calculateDirectorTimelineDragDuration(input: DirectorTimelineDragDurationInput): number {
  const totalDurationSec = Math.max(
    DIRECTOR_STORYBOARD_MIN_DURATION_SEC,
    Number.isFinite(input.totalDurationSec) ? input.totalDurationSec : DIRECTOR_STORYBOARD_DEFAULT_DURATION_SEC,
  );
  const timelineWidthPx = Math.max(1, Number.isFinite(input.timelineWidthPx) ? input.timelineWidthPx : 1);
  const pxPerSecond = Math.max(2, timelineWidthPx / totalDurationSec);
  const delta = Math.round((input.currentClientX - input.startClientX) / pxPerSecond);
  return sanitizeDurationSec(input.startDurationSec + delta);
}

function sanitizeFrameMode(value: unknown): DirectorStoryboardFrameMode {
  return value === 'first' || value === 'firstlast' || value === 'multiframe' ? value : 'auto';
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return dedupeStrings(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()));
}

export function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

export function sanitizeDirectorStoryboardShots(input: DirectorStoryboardInputShot[]): DirectorStoryboardShot[] {
  const raw = Array.isArray(input) ? input : [];
  const source = raw.length > 0 ? raw : [{ title: 'S1', durationSec: DIRECTOR_STORYBOARD_DEFAULT_DURATION_SEC }];
  return source.map((shot, index) => {
    const title = normalizeString(shot.title) || `S${index + 1}`;
    return {
      id: normalizeString(shot.id) || makeShotId(index),
      title,
      durationSec: sanitizeDurationSec(shot.durationSec),
      prompt: normalizeString(shot.prompt),
      negativePrompt: normalizeString(shot.negativePrompt),
      promptMentions: Array.isArray(shot.promptMentions) ? shot.promptMentions : [],
      frameMode: sanitizeFrameMode(shot.frameMode),
      localRefImages: sanitizeStringArray(shot.localRefImages),
      localRefVideos: sanitizeStringArray(shot.localRefVideos),
      localRefAudios: sanitizeStringArray(shot.localRefAudios),
      seed: typeof shot.seed === 'number' && Number.isFinite(shot.seed) ? Math.trunc(shot.seed) : undefined,
      modelOverride: normalizeString(shot.modelOverride) || undefined,
      ratioOverride: normalizeString(shot.ratioOverride) || undefined,
      resolutionOverride: normalizeString(shot.resolutionOverride) || undefined,
      status: normalizeString(shot.status) || undefined,
      taskId: shot.taskId || null,
      videoUrl: shot.videoUrl || null,
      error: shot.error || null,
    };
  });
}

function materialKey(material: DirectorStoryboardMentionMaterial): string {
  const custom = normalizeString(material.mentionKey);
  return custom || `${material.kind}:${material.url}`;
}

function tokenForMaterial(material: DirectorStoryboardMentionMaterial, materials: DirectorStoryboardMentionMaterial[]): string {
  const custom = normalizeString(material.mentionToken);
  if (custom) return custom;
  let index = 0;
  for (const candidate of materials) {
    if (candidate.kind !== material.kind) continue;
    index += 1;
    if (materialKey(candidate) === materialKey(material)) return `@${TOKEN_PREFIX[material.kind]}${index}`;
  }
  return `@${TOKEN_PREFIX[material.kind]}?`;
}

function mentionTokenMatchesKind(mention: Pick<MediaMention, 'kind' | 'token'>): boolean {
  if (mention.kind === 'image' && /^@img\d+\b/.test(mention.token)) return true;
  if (mention.kind === 'video' && /^@vid\d+\b/.test(mention.token)) return true;
  if (mention.kind === 'audio' && /^@aud\d+\b/.test(mention.token)) return true;
  if (mention.kind === 'text' && /^@txt\d+\b/.test(mention.token)) return true;
  return new RegExp(`^@${TOKEN_PREFIX[mention.kind]}\\d+\\b`).test(mention.token);
}

function resolveShotPrompt(
  prompt: string,
  mentions: MediaMention[] | undefined,
  materials: DirectorStoryboardMentionMaterial[],
): string {
  if (!mentions?.length) return prompt;
  const byKey = new Map(materials.map((material) => [materialKey(material), material]));
  let next = prompt;
  const valid = mentions
    .filter((mention) => mentionTokenMatchesKind(mention) && prompt.slice(mention.start, mention.end) === mention.token)
    .sort((a, b) => b.start - a.start);

  for (const mention of valid) {
    const material = byKey.get(mention.materialKey);
    if (!material) continue;
    const replacement = mention.kind === 'text' ? material.url : tokenForMaterial(material, materials);
    next = `${next.slice(0, mention.start)}${replacement}${next.slice(mention.end)}`;
  }
  return next;
}

function collectMentionedMedia(
  prompt: string,
  mentions: MediaMention[] | undefined,
  materials: DirectorStoryboardMentionMaterial[],
) {
  const images: string[] = [];
  const videos: string[] = [];
  const audios: string[] = [];
  if (!mentions?.length) return { images, videos, audios };
  const byKey = new Map(materials.map((material) => [materialKey(material), material]));

  for (const mention of mentions) {
    if (!mentionTokenMatchesKind(mention)) continue;
    if (prompt.slice(mention.start, mention.end) !== mention.token) continue;
    const material = byKey.get(mention.materialKey);
    if (!material) continue;
    if (material.kind === 'image') images.push(material.url);
    if (material.kind === 'video') videos.push(material.url);
    if (material.kind === 'audio') audios.push(material.url);
  }

  return {
    images: dedupeStrings(images),
    videos: dedupeStrings(videos),
    audios: dedupeStrings(audios),
  };
}

export function buildDirectorShotSeedancePayload(
  shot: DirectorStoryboardShot,
  settings: DirectorStoryboardSettings,
  context: BuildDirectorShotPayloadContext = {},
): SeedanceSubmitRequest {
  const mentionMaterials = context.mentionMaterials || [];
  const mentioned = collectMentionedMedia(shot.prompt, shot.promptMentions, mentionMaterials);
  const images = dedupeStrings([
    ...(context.globalImages || []),
    ...mentioned.images,
    ...(shot.localRefImages || []),
  ]);
  const videos = dedupeStrings([
    ...(context.globalVideos || []),
    ...mentioned.videos,
    ...(shot.localRefVideos || []),
  ]);
  const audios = dedupeStrings([
    ...(context.globalAudios || []),
    ...mentioned.audios,
    ...(shot.localRefAudios || []),
  ]);

  const localPrompt = resolveShotPrompt(shot.prompt, shot.promptMentions, mentionMaterials).trim();
  const prompt = [context.upstreamPrompt, localPrompt].map((item) => normalizeString(item)).filter(Boolean).join('\n\n');
  const payload: SeedanceSubmitRequest = {
    model: shot.modelOverride || settings.model,
    prompt,
    duration: sanitizeDurationSec(shot.durationSec),
    ratio: shot.ratioOverride || settings.ratio,
    resolution: shot.resolutionOverride || settings.resolution,
    generate_audio: settings.generateAudio,
    return_last_frame: settings.returnLastFrame,
    watermark: settings.watermark,
    web_search: settings.webSearch,
  };

  const seed = typeof shot.seed === 'number' ? shot.seed : settings.seed;
  if (typeof seed === 'number' && seed !== -1) payload.seed = seed;

  if (shot.frameMode === 'first' && images.length >= 1) {
    payload.firstFrame = images[0];
    const refImages = images.slice(1);
    if (refImages.length) payload.refImages = refImages;
  } else if (shot.frameMode === 'firstlast' && images.length >= 1) {
    payload.firstFrame = images[0];
    if (images[1]) payload.lastFrame = images[1];
    const refImages = images.slice(2);
    if (refImages.length) payload.refImages = refImages;
  } else if (images.length) {
    payload.refImages = images;
  }

  if (videos.length) payload.videos = videos;
  if (audios.length) payload.audios = audios;
  return payload;
}

function lastImage(shot: DirectorStoryboardShot): string {
  return shot.localRefImages[shot.localRefImages.length - 1] || '';
}

function firstImage(shot: DirectorStoryboardShot): string {
  return shot.localRefImages[0] || '';
}

function buildBridgeJob(
  previous: DirectorStoryboardShot,
  next: DirectorStoryboardShot,
  settings: DirectorStoryboardSettings,
  order: number,
): DirectorStoryboardJob | null {
  const firstFrame = lastImage(previous);
  const lastFrame = firstImage(next);
  if (!firstFrame || !lastFrame) return null;
  return {
    id: `bridge-${previous.id}-${next.id}`,
    shotId: `${previous.id}:${next.id}`,
    order,
    kind: 'bridge',
    title: `${previous.title} → ${next.title}`,
    payload: {
      model: settings.model,
      prompt: normalizeString(settings.bridgePrompt) || `Smooth transition from ${previous.title} to ${next.title}`,
      duration: sanitizeDurationSec(settings.bridgeDurationSec || 4),
      ratio: settings.ratio,
      resolution: settings.resolution,
      generate_audio: settings.generateAudio,
      return_last_frame: settings.returnLastFrame,
      watermark: settings.watermark,
      web_search: settings.webSearch,
      firstFrame,
      lastFrame,
    },
  };
}

export function buildDirectorStoryboardRunPlan(
  shots: DirectorStoryboardShot[],
  settings: DirectorStoryboardSettings,
  context: BuildDirectorShotPayloadContext = {},
): DirectorStoryboardJob[] {
  const jobs: DirectorStoryboardJob[] = [];
  shots.forEach((shot, index) => {
    jobs.push({
      id: `shot-${shot.id}`,
      shotId: shot.id,
      order: jobs.length,
      kind: 'shot',
      title: shot.title,
      payload: buildDirectorShotSeedancePayload(shot, settings, context),
    });

    if (settings.bridgeEnabled && index < shots.length - 1) {
      const bridge = buildBridgeJob(shot, shots[index + 1], settings, jobs.length);
      if (bridge) jobs.push(bridge);
    }
  });
  return jobs.map((job, order) => ({ ...job, order }));
}

export async function runDirectorStoryboardJobs(
  jobs: DirectorStoryboardJob[],
  runJob: (job: DirectorStoryboardJob, signal?: AbortSignal) => Promise<string>,
  options: RunDirectorStoryboardJobsOptions = {},
): Promise<DirectorStoryboardRunResult> {
  const orderedJobs = [...jobs].sort((a, b) => a.order - b.order);
  const settled = await Promise.all(
    orderedJobs.map(async (job): Promise<DirectorStoryboardJobResult> => {
      if (options.signal?.aborted) {
        const cancelled: DirectorStoryboardJobResult = { job, status: 'cancelled', error: '用户已停止' };
        options.onJobComplete?.(cancelled);
        return cancelled;
      }
      try {
        const videoUrl = await runJob(job, options.signal);
        const result: DirectorStoryboardJobResult = { job, status: 'success', videoUrl };
        options.onJobComplete?.(result);
        return result;
      } catch (error: any) {
        const status: DirectorStoryboardJobStatus = options.signal?.aborted ? 'cancelled' : 'error';
        const result: DirectorStoryboardJobResult = {
          job,
          status,
          error: error?.message || (status === 'cancelled' ? '用户已停止' : '生成失败'),
        };
        options.onJobComplete?.(result);
        return result;
      }
    }),
  );

  const byOrder = [...settled].sort((a, b) => a.job.order - b.job.order);
  return {
    results: byOrder,
    videoUrls: byOrder.flatMap((item) => item.status === 'success' && item.videoUrl ? [item.videoUrl] : []),
  };
}

import type { VideoEditClip, VideoEditSettings } from '../utils/videoEdit';

async function postVideoOp<T>(path: string, payload: Record<string, any>): Promise<T> {
  const res = await fetch(`/api/video-ops/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`视频剪辑接口返回异常: ${text.slice(0, 160)}`);
  }
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
  }
  return json.data as T;
}

export interface VideoProbeResult {
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  size?: number;
  mime?: string;
}

export interface VideoComposeResult {
  jobId: string;
  videoUrl: string;
  directVideoUrl?: string;
  fileName: string;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
  mime?: string;
}

export interface VideoJobStatus {
  id: string;
  status: 'idle' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  result?: VideoComposeResult;
  error?: string;
}

export function probeVideo(videoUrl: string): Promise<VideoProbeResult> {
  return postVideoOp<VideoProbeResult>('probe', { videoUrl });
}

export function composeVideoEdit(clips: VideoEditClip[], settings: VideoEditSettings): Promise<VideoComposeResult> {
  return postVideoOp<VideoComposeResult>('compose', { clips, settings });
}

export function composeVideoEditAsync(clips: VideoEditClip[], settings: VideoEditSettings): Promise<VideoJobStatus> {
  return postVideoOp<VideoJobStatus>('compose', { clips, settings, async: true });
}

export async function getVideoEditJob(jobId: string): Promise<VideoJobStatus> {
  const res = await fetch(`/api/video-ops/jobs/${encodeURIComponent(jobId)}`);
  const json = await res.json();
  if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
  return json.data as VideoJobStatus;
}

export function cancelVideoEditJob(jobId: string): Promise<VideoJobStatus> {
  return postVideoOp<VideoJobStatus>(`jobs/${encodeURIComponent(jobId)}/cancel`, {});
}

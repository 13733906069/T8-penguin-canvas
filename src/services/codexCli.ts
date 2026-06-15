const BASE = '/api/codex-cli';
const CODEX_ROUTE_MISSING_MESSAGE = 'Codex CLI 后端路由未加载：请重启后端服务或桌面应用，让 /api/codex-cli 生效。';

export function codexRouteMissingMessageForTests(status: number): string {
  if (status === 404) return CODEX_ROUTE_MISSING_MESSAGE;
  return `HTTP ${status}`;
}

export interface CodexCliStatus {
  available: boolean;
  executable?: string;
  version?: string;
  authStatus?: string;
  featureNames?: string[];
  features?: Array<{ name: string; stage?: string; enabled?: boolean }>;
  message?: string;
}

export interface CodexSkill {
  id: string;
  name: string;
  description: string;
  category?: string;
  body?: string;
  scope: 'global' | 'project';
  path?: string;
}

export interface CodexAgentArtifact {
  id?: string;
  turnId?: string;
  kind: 'text' | 'image' | 'video' | 'audio' | 'model3d' | 'file';
  title?: string;
  text?: string;
  content?: string;
  url?: string;
  urls?: string[];
  status?: string;
  progress?: number;
  message?: string;
  createdAt?: number;
}

export interface CodexCliPayload {
  nodeId?: string;
  sessionId?: string;
  turnId?: string;
  mode?: string;
  command?: string;
  preset?: string;
  prompt?: string;
  referenceTexts?: string[];
  images?: string[];
  videos?: string[];
  audios?: string[];
  selectedSkillNames?: string[];
  workspaceDir?: string;
  model?: string;
  profile?: string;
  sandbox?: string;
  approvalPolicy?: string;
  reasoningEffort?: string;
  webSearch?: boolean;
  includePlanTool?: boolean;
  extraArgs?: string[];
  executablePath?: string;
  [key: string]: any;
}

export interface CodexCliResult {
  text?: string;
  reply?: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  audioUrl?: string;
  audioUrls?: string[];
  modelUrl?: string;
  modelUrls?: string[];
  artifacts?: CodexAgentArtifact[];
  workspace?: string;
  status?: string;
  progress?: number;
  message?: string;
  [key: string]: any;
}

export interface CodexStreamEvent {
  type?: string;
  event?: string;
  delta?: string;
  text?: string;
  message?: string;
  progress?: number;
  artifact?: CodexAgentArtifact;
  result?: CodexCliResult;
  done?: boolean;
  error?: string;
  [key: string]: any;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || codexRouteMissingMessageForTests(res.status));
  }
  return (data?.data ?? data) as T;
}

function parseSseEvent(raw: string): any | null {
  const eventLine = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .find((line) => line.startsWith('event:'));
  const eventName = eventLine ? eventLine.slice(6).trim() : '';
  const dataLines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());
  if (dataLines.length === 0) return null;
  const text = dataLines.join('\n');
  if (!text || text === '[DONE]') return { done: true, event: eventName || 'done' };
  try {
    const parsed = JSON.parse(text);
    return eventName && !parsed.event ? { ...parsed, event: eventName } : parsed;
  } catch {
    return { text, event: eventName };
  }
}

export function extractCodexStreamDeltaForTests(event: any): { delta: string; done: boolean; error?: string } {
  if (!event) return { delta: '', done: false };
  if (event.error || event.type === 'artifact.failed' || event.event === 'artifact.failed' || event.type === 'turn.failed' || event.event === 'turn.failed') {
    return { delta: '', done: false, error: String(event.error || event.message || 'Codex CLI 流式任务失败') };
  }
  if (event.done || event.type === 'done' || event.event === 'done') return { delta: '', done: true };
  const delta =
    event.delta ||
    (event.type === 'message.delta' ? event.text : '') ||
    (event.event === 'message.delta' ? event.text : '') ||
    event.text_delta ||
    event.output_text_delta ||
    '';
  return { delta: typeof delta === 'string' ? delta : '', done: false };
}

function mergeArtifact(result: CodexCliResult, artifact: CodexAgentArtifact) {
  if (!artifact) return;
  const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
  if (!artifact.id || !artifacts.some((item) => item.id === artifact.id)) artifacts.push(artifact);
  result.artifacts = artifacts;
  const urls = Array.isArray(artifact.urls) ? artifact.urls : (artifact.url ? [artifact.url] : []);
  if (artifact.text) {
    result.text = artifact.text;
    result.reply = artifact.text;
  }
  if (artifact.kind === 'image') {
    result.imageUrls = urls;
    result.imageUrl = urls[0] || result.imageUrl;
  }
  if (artifact.kind === 'video') {
    result.videoUrls = urls;
    result.videoUrl = urls[0] || result.videoUrl;
  }
  if (artifact.kind === 'audio') {
    result.audioUrls = urls;
    result.audioUrl = urls[0] || result.audioUrl;
  }
  if (artifact.kind === 'model3d') {
    result.modelUrls = urls;
    result.modelUrl = urls[0] || result.modelUrl;
  }
}

function mergeResult(target: CodexCliResult, patch?: CodexCliResult) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(target, patch);
  if (Array.isArray(patch.artifacts)) {
    patch.artifacts.forEach((artifact) => mergeArtifact(target, artifact));
  }
}

export async function getCodexCliStatus(executablePath?: string): Promise<CodexCliStatus> {
  const q = executablePath ? `?executablePath=${encodeURIComponent(executablePath)}` : '';
  return requestJson<CodexCliStatus>(`${BASE}/status${q}`);
}

export async function startCodexCliLogin(payload: { executablePath?: string; deviceAuth?: boolean } = {}): Promise<{ started: boolean; executable?: string; message?: string }> {
  return requestJson<{ started: boolean; executable?: string; message?: string }>(`${BASE}/login/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCodexCliSkills(payload: { nodeId?: string; sessionId?: string; workspaceDir?: string } = {}): Promise<{ workspaceDir: string; skills: CodexSkill[] }> {
  const sp = new URLSearchParams();
  if (payload.nodeId) sp.set('nodeId', payload.nodeId);
  if (payload.sessionId) sp.set('sessionId', payload.sessionId);
  if (payload.workspaceDir) sp.set('workspaceDir', payload.workspaceDir);
  const qs = sp.toString();
  return requestJson<{ workspaceDir: string; skills: CodexSkill[] }>(`${BASE}/skills${qs ? `?${qs}` : ''}`);
}

export async function createCodexProjectSkill(payload: {
  nodeId?: string;
  sessionId?: string;
  workspaceDir?: string;
  name: string;
  title?: string;
  description?: string;
  category?: string;
  body?: string;
}): Promise<{ workspaceDir: string; skill: CodexSkill }> {
  return requestJson<{ workspaceDir: string; skill: CodexSkill }>(`${BASE}/skills/project`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCodexProjectSkill(payload: {
  nodeId?: string;
  sessionId?: string;
  workspaceDir?: string;
  oldName: string;
  name: string;
  title?: string;
  description?: string;
  category?: string;
  body?: string;
}): Promise<{ workspaceDir: string; skill: CodexSkill }> {
  return requestJson<{ workspaceDir: string; skill: CodexSkill }>(`${BASE}/skills/project/${encodeURIComponent(payload.oldName)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCodexProjectSkill(payload: {
  nodeId?: string;
  sessionId?: string;
  workspaceDir?: string;
  name: string;
}): Promise<{ workspaceDir: string; name: string; deleted: boolean }> {
  return requestJson<{ workspaceDir: string; name: string; deleted: boolean }>(`${BASE}/skills/project/${encodeURIComponent(payload.name)}`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export async function streamCodexCliAgent(
  payload: CodexCliPayload,
  options: {
    signal?: AbortSignal;
    onDelta?: (delta: string, event?: CodexStreamEvent) => void;
    onEvent?: (event: CodexStreamEvent) => void;
  } = {},
): Promise<CodexCliResult> {
  const res = await fetch(`${BASE}/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  if (!res.ok) {
    let message = codexRouteMissingMessageForTests(res.status);
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error('浏览器不支持流式读取。');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let reply = '';
  const result: CodexCliResult = {};

  const consume = (raw: string) => {
    const event = parseSseEvent(raw) as CodexStreamEvent | null;
    if (!event) return false;
    options.onEvent?.(event);
    const parsed = extractCodexStreamDeltaForTests(event);
    if (parsed.error) throw new Error(parsed.error);
    if (parsed.delta) {
      reply += parsed.delta;
      result.text = reply;
      result.reply = reply;
      options.onDelta?.(parsed.delta, event);
    }
    if (event.artifact) mergeArtifact(result, event.artifact);
    if (event.result) mergeResult(result, event.result);
    return parsed.done;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let splitAt = buffer.indexOf('\n\n');
    while (splitAt >= 0) {
      const chunk = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);
      if (consume(chunk)) return result;
      splitAt = buffer.indexOf('\n\n');
    }
  }
  if (buffer.trim()) consume(buffer);
  return result;
}

/**
 * Online VibeX -> T8 Penguin Canvas bridge.
 *
 * Put this file in the online VibeX frontend, then call postVibeXResultToT8()
 * when a generated gallery item or current task result should be sent to T8.
 *
 * Supported paths:
 * 1. VibeX embedded in a T8 iframe: sends to window.parent.
 * 2. VibeX opened by T8 in a popup/window: sends to window.opener.
 * 3. VibeX opened as a normal browser page: emits a page message and
 *    CustomEvent. The T8 Chrome extension catches it and relays to the local
 *    T8 canvas or Electron local bridge.
 */

export const T8_VIBEX_MESSAGE_CONTRACT = {
  type: 't8:vibex-result',
  source: 'vibex-workbench',
};

function uniqueMessageId() {
  return `vibex-web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(value, maxLen = 8000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function cleanUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^(https?:\/\/|data:|\/files\/|\/output\/|\/input\/)/i.test(text)) return text;
  return '';
}

function pushUrl(out, value) {
  if (Array.isArray(value)) {
    value.forEach((item) => pushUrl(out, item));
    return;
  }
  const url = typeof value === 'object' && value
    ? cleanUrl(value.url || value.videoUrl || value.imageUrl || value.audioUrl || value.resultUrl)
    : cleanUrl(value);
  if (url && !out.includes(url)) out.push(url);
}

function collectUrls(...values) {
  const out = [];
  values.forEach((value) => pushUrl(out, value));
  return out.slice(0, 24);
}

export function buildT8VibeXPayload(input = {}) {
  const videoUrls = collectUrls(input.videoUrls, input.videos, input.videoUrl, input.resultUrl, input.currentVideoUrl);
  const imageUrls = collectUrls(input.imageUrls, input.images, input.imageUrl, input.coverUrl, input.thumbnailUrl);
  const audioUrls = collectUrls(input.audioUrls, input.audios, input.audioUrl);
  return {
    messageId: cleanText(input.messageId || uniqueMessageId(), 180),
    prompt: cleanText(input.prompt || input.textPrompt || input.imagePrompt || input.description),
    model: cleanText(input.model || input.modelName || input.tier, 200),
    taskId: cleanText(input.taskId || input.task_id, 200),
    rhTaskId: cleanText(input.rhTaskId || input.rh_task_id, 200),
    pageUrl: cleanText(input.pageUrl || (typeof window !== 'undefined' ? window.location.href : ''), 2048),
    pageTitle: cleanText(input.pageTitle || (typeof document !== 'undefined' ? document.title : 'VibeX'), 200),
    videoUrls,
    imageUrls,
    audioUrls,
    metadata: {
      ratio: cleanText(input.ratio, 80),
      duration: cleanText(input.duration, 80),
      resolution: cleanText(input.resolution, 80),
      mode: cleanText(input.mode || input.activeTab, 80),
      tier: cleanText(input.tier, 80),
      createdAt: cleanText(input.createdAt || new Date().toISOString(), 80),
      ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
    },
  };
}

export function postVibeXResultToT8(input = {}) {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  const payload = buildT8VibeXPayload(input);
  if (
    payload.videoUrls.length === 0 &&
    payload.imageUrls.length === 0 &&
    payload.audioUrls.length === 0 &&
    !payload.prompt
  ) {
    return { ok: false, reason: 'empty-result' };
  }

  const message = { ...T8_VIBEX_MESSAGE_CONTRACT, payload };
  let posted = false;

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
    posted = true;
  }

  if (window.opener && window.opener !== window && !window.opener.closed) {
    window.opener.postMessage(message, '*');
    posted = true;
  }

  // Normal browser tab path: the T8 Chrome extension listens to these.
  window.postMessage(message, window.location.origin);
  document.dispatchEvent(new CustomEvent('t8:vibex-result', { detail: message }));
  posted = true;

  return { ok: true, posted, messageId: payload.messageId, payload };
}

export function attachT8SendButton(button, getResult) {
  if (!button || typeof button.addEventListener !== 'function') return () => {};
  const handler = () => {
    const result = typeof getResult === 'function' ? getResult() : {};
    const sent = postVibeXResultToT8(result);
    button.dataset.t8SendStatus = sent.ok ? 'sent' : sent.reason || 'failed';
  };
  button.addEventListener('click', handler);
  return () => button.removeEventListener('click', handler);
}

/**
 * Example:
 *
 * import { postVibeXResultToT8 } from './t8-vibex-bridge';
 *
 * postVibeXResultToT8({
 *   videoUrl: item.result_url,
 *   imageUrl: item.cover_url,
 *   prompt: item.prompt,
 *   taskId: item.task_id,
 *   model: item.model_name,
 *   resolution: item.resolution,
 *   ratio: item.ratio,
 *   duration: item.duration,
 * });
 */

const MENU_ID = 't8-web-image-reverse';
const DEFAULT_BACKEND_BASE = 'http://127.0.0.1:18766';
const DEFAULT_CANVAS_URL = 'http://127.0.0.1:11422/';
const CANVAS_MESSAGE_TYPE = 't8:web-image-result';
const CANVAS_MESSAGE_SOURCE = 't8-web-image-extension';

function storageGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (items) => resolve(items || defaults));
  });
}

function absoluteBackendUrl(base, path) {
  const cleanBase = String(base || DEFAULT_BACKEND_BASE).replace(/\/+$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `${cleanBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function normalizeBackendFetchError(error) {
  const text = String(error?.message || error || '').trim();
  if (!text || /failed to fetch|networkerror|load failed|fetch/i.test(text)) {
    return '无法连接 T8 后端，请确认画布后端已启动，或在扩展设置中检查 Backend Base。';
  }
  return text;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      code: 'invalid_backend_response',
      error: text.slice(0, 220) || `T8 后端返回 HTTP ${response.status}`,
    };
  }
}

function installContextMenu() {
  chrome.contextMenus.remove(MENU_ID, () => {
    chrome.runtime.lastError;
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '反推生图并发送到 T8 画布',
      contexts: ['image'],
    });
  });
}

async function injectReverseImageUi(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['styles/content.css'],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['scripts/content.js'],
  });
}

function isCanvasUrl(url, configuredUrl) {
  const text = String(url || '');
  if (!text) return false;
  if (configuredUrl && text.startsWith(configuredUrl.replace(/\/+$/, ''))) return true;
  return /^https?:\/\/(?:127\.0\.0\.1|localhost):11422(?:\/|$)/i.test(text) ||
    /^https?:\/\/(?:127\.0\.0\.1|localhost):18766(?:\/|$)/i.test(text);
}

async function findOrOpenCanvasTab() {
  const settings = await storageGet({ t8_canvas_url: DEFAULT_CANVAS_URL });
  const canvasUrl = String(settings.t8_canvas_url || DEFAULT_CANVAS_URL);
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => isCanvasUrl(tab.url, canvasUrl));
  if (existing?.id) return existing;
  return chrome.tabs.create({ url: canvasUrl, active: false });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || tab?.status === 'complete') {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 6000);
      function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

async function sendToCanvas(payload) {
  const target = await findOrOpenCanvasTab();
  if (!target?.id) throw new Error('没有找到可发送的 T8 画布标签页。');
  await waitForTabComplete(target.id);
  const messagePayload = {
    ...payload,
    messageId: payload?.messageId || `t8-web-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  await chrome.scripting.executeScript({
    target: { tabId: target.id },
    func: (messagePayload, messageSource, messageType) => {
      window.postMessage({ type: 't8:web-image-result', source: messageSource, payload: messagePayload }, window.location.origin);
      window.setTimeout(() => {
        window.postMessage({ type: messageType, source: messageSource, payload: messagePayload }, window.location.origin);
      }, 900);
    },
    args: [messagePayload, CANVAS_MESSAGE_SOURCE, CANVAS_MESSAGE_TYPE],
  });
  await chrome.tabs.update(target.id, { active: true });
  if (target.windowId != null) {
    try {
      await chrome.windows.update(target.windowId, { focused: true });
    } catch {
      // ignore focus failures
    }
  }
}

async function reverseAndGenerate(message) {
  const settings = await storageGet({ t8_backend_base: DEFAULT_BACKEND_BASE });
  const backendBase = message?.backendBase || settings.t8_backend_base || DEFAULT_BACKEND_BASE;
  const response = await fetch(absoluteBackendUrl(backendBase, '/api/proxy/external/web-image'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message?.payload || {}),
  });
  const data = await readJsonResponse(response);
  const ok = response.ok && data?.success !== false;
  return {
    ok,
    status: response.status,
    data,
    error: ok ? '' : (data?.error || `T8 后端返回 HTTP ${response.status}`),
  };
}

async function generateImage(message) {
  const settings = await storageGet({ t8_backend_base: DEFAULT_BACKEND_BASE });
  const backendBase = message?.backendBase || settings.t8_backend_base || DEFAULT_BACKEND_BASE;
  const response = await fetch(absoluteBackendUrl(backendBase, '/api/proxy/external/image'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message?.payload || {}),
  });
  const data = await readJsonResponse(response);
  const ok = response.ok && data?.success !== false;
  return {
    ok,
    status: response.status,
    data,
    error: ok ? '' : (data?.error || `T8 后端返回 HTTP ${response.status}`),
  };
}

chrome.runtime.onInstalled.addListener(installContextMenu);
chrome.runtime.onStartup.addListener(installContextMenu);
installContextMenu();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl || !tab?.id) return;
  try {
    await injectReverseImageUi(tab.id);
    chrome.tabs.sendMessage(tab.id, {
      action: 't8WebImage.showModal',
      imageUrl: info.srcUrl,
      pageUrl: tab.url || '',
      pageTitle: tab.title || '',
    });
  } catch (error) {
    console.error('[T8 Web Image] 打开反推面板失败', error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === 't8WebImage.getSettings') {
    storageGet({
      t8_backend_base: DEFAULT_BACKEND_BASE,
      t8_canvas_url: DEFAULT_CANVAS_URL,
    }).then((settings) => sendResponse({ ok: true, settings }));
    return true;
  }

  if (message?.action === 't8WebImage.sendToCanvas') {
    sendToCanvas(message.payload || {})
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message?.action === 't8WebImage.reverseAndGenerate') {
    reverseAndGenerate(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: normalizeBackendFetchError(error), data: { success: false } }));
    return true;
  }

  if (message?.action === 't8WebImage.generateImage') {
    generateImage(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: normalizeBackendFetchError(error), data: { success: false } }));
    return true;
  }

  return false;
});

(() => {
  if (window.__t8RunningHubBridgeLoaded) return;
  window.__t8RunningHubBridgeLoaded = true;

  const MESSAGE_TYPE = 't8:vibex-result';
  const MESSAGE_SOURCE = 'vibex-workbench';
  const ACTION = 't8RunningHub.forwardVibeXResult';

  function cleanObject(value) {
    if (!value || typeof value !== 'object') return {};
    return value;
  }

  function sendToExtension(rawMessage) {
    const message = cleanObject(rawMessage);
    if (message.type !== MESSAGE_TYPE || message.source !== MESSAGE_SOURCE) return;
    chrome.runtime.sendMessage({
      action: ACTION,
      payload: message.payload || message,
      pageUrl: location.href,
      pageTitle: document.title,
    }, () => {
      chrome.runtime.lastError;
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    sendToExtension(event.data);
  });

  document.addEventListener('t8:vibex-result', (event) => {
    sendToExtension(event.detail || {});
  });
})();

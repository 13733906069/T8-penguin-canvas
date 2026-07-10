(function () {
  const boot = {
    startedAt: new Date().toISOString(),
    errors: [],
  };

  function errorText(error) {
    if (!error) return 'Unknown error';
    if (error.stack) return String(error.stack);
    if (error.message) return String(error.message);
    return String(error);
  }

  function renderBootErrors() {
    if (!boot.errors.length || !document.body) return;
    let box = document.getElementById('bootErrors');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'bootErrors';
      box.style.cssText = [
        'margin:8px 14px',
        'padding:8px',
        'border:1px solid #7f1d1d',
        'border-radius:7px',
        'background:#2a0f13',
        'color:#fecaca',
        'white-space:pre-wrap',
        'font:11px/1.35 ui-monospace,Consolas,monospace',
      ].join(';');
      document.body.appendChild(box);
    }
    box.textContent = boot.errors.map((entry) => `[${entry.source}] ${entry.message}`).join('\n\n');
  }

  function reportBootError(error, source) {
    const entry = {
      source: source || 'unknown',
      message: errorText(error),
      time: new Date().toISOString(),
    };
    boot.errors.push(entry);
    try {
      console.error('[T8PS boot]', entry.source, entry.message);
    } catch (_) {
      // keep diagnostics best-effort inside UXP
    }
    renderBootErrors();
  }

  window.T8PS_BOOT = boot;
  window.T8PS_REPORT_BOOT_ERROR = reportBootError;
  window.addEventListener('error', (event) => {
    reportBootError(event.error || event.message, 'window.onerror');
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportBootError(event.reason || 'Unhandled rejection', 'unhandledrejection');
  });
  document.addEventListener('DOMContentLoaded', renderBootErrors);
  console.log('[T8PS boot] start', boot.startedAt);
})();

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('settings route uploads a custom task completion audio file and can reset to default', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't8-task-sound-'));
  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const config = require('../backend/src/config.js');
  const oldConfig = {
    SETTINGS_FILE: config.SETTINGS_FILE,
    DEFAULT_LOCAL_SAVE_DIR: config.DEFAULT_LOCAL_SAVE_DIR,
    DEFAULT_CANVAS_AUTO_SAVE_DIR: config.DEFAULT_CANVAS_AUTO_SAVE_DIR,
    DEFAULT_RESOURCE_LIBRARY_DIR: config.DEFAULT_RESOURCE_LIBRARY_DIR,
    DEFAULT_THEME_TEMPLATE_DIR: config.DEFAULT_THEME_TEMPLATE_DIR,
  };
  t.after(() => {
    Object.assign(config, oldConfig);
    delete require.cache[require.resolve('../backend/src/routes/settings.js')];
  });
  config.SETTINGS_FILE = path.join(tmpDir, 'settings.json');
  config.DEFAULT_LOCAL_SAVE_DIR = path.join(tmpDir, 'save');
  config.DEFAULT_CANVAS_AUTO_SAVE_DIR = path.join(tmpDir, 'canvas');
  config.DEFAULT_RESOURCE_LIBRARY_DIR = path.join(tmpDir, 'resources');
  config.DEFAULT_THEME_TEMPLATE_DIR = path.join(tmpDir, 'themes');

  delete require.cache[require.resolve('../backend/src/routes/settings.js')];
  const express = require('express');
  const settingsRouter = require('../backend/src/routes/settings.js');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/settings', settingsRouter);
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => {
    server.close();
  });

  const base = `http://127.0.0.1:${server.address().port}/api/settings`;
  const form = new FormData();
  form.append('audio', new Blob([Uint8Array.from([0x49, 0x44, 0x33, 0x04])], { type: 'audio/mpeg' }), 'done.mp3');

  const upload = await fetch(`${base}/task-completion-sound`, {
    method: 'POST',
    body: form,
  }).then((res) => res.json());
  assert.equal(upload.success, true);
  assert.equal(upload.data.mode, 'custom');
  assert.equal(upload.data.name, 'done.mp3');
  assert.equal(upload.data.mimeType, 'audio/mpeg');
  assert.match(upload.data.url, /^\/api\/settings\/task-completion-sound\/file\?v=\d+/);

  const settings = await fetch(base).then((res) => res.json());
  assert.equal(settings.success, true);
  assert.equal(settings.data.taskCompletionSound.mode, 'custom');
  assert.equal(settings.data.taskCompletionSound.url, upload.data.url);

  const fileResponse = await fetch(`${base}/task-completion-sound/file`);
  assert.equal(fileResponse.status, 200);
  assert.equal(fileResponse.headers.get('content-type')?.startsWith('audio/mpeg'), true);
  assert.equal((await fileResponse.arrayBuffer()).byteLength, 4);

  const reset = await fetch(`${base}/task-completion-sound`, { method: 'DELETE' }).then((res) => res.json());
  assert.equal(reset.success, true);
  assert.equal(reset.data.mode, 'default');
  assert.equal(reset.data.url, '');

  const afterReset = await fetch(base).then((res) => res.json());
  assert.equal(afterReset.data.taskCompletionSound.mode, 'default');
  assert.equal(afterReset.data.taskCompletionSound.url, '');
});

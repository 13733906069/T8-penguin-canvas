import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const MINIMAL_THEME_MODES = {
  light: {
    tokens: {
      appBg: '#ffffff',
      canvasBg: '#ffffff',
      panelBg: '#ffffff',
      textMain: '#111111',
    },
  },
  dark: {
    tokens: {
      appBg: '#111111',
      canvasBg: '#111111',
      panelBg: '#111111',
      textMain: '#ffffff',
    },
  },
};

async function listen(app: any) {
  return await new Promise<any>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('themes route preserves Farm Story and Tetris protocols when importing templates', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't8-theme-routes-'));
  t.after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const config = require('../backend/src/config.js');
  const oldConfig = {
    SETTINGS_FILE: config.SETTINGS_FILE,
    DEFAULT_THEME_TEMPLATE_DIR: config.DEFAULT_THEME_TEMPLATE_DIR,
  };
  t.after(() => {
    Object.assign(config, oldConfig);
  });
  config.SETTINGS_FILE = path.join(tmpDir, 'settings.json');
  config.DEFAULT_THEME_TEMPLATE_DIR = path.join(tmpDir, 'themes');

  const express = require('express');
  const themesRouter = require('../backend/src/routes/themes.js');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/themes', themesRouter);
  const server = await listen(app);
  t.after(() => {
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/themes`;

  const farmImport = await fetch(`${base}/templates/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: {
        schema: 't8-theme-template',
        version: 2,
        id: 'farm-story-route-test',
        name: '牧场路由测试',
        legacyStyle: 'pixel',
        visuals: {
          style: 'farm-story',
          intensity: 'strong',
          headerMark: 'FARM STORY',
        },
        music: {},
        modes: MINIMAL_THEME_MODES,
      },
    }),
  }).then((res) => res.json());

  assert.equal(farmImport.success, true);
  assert.equal(farmImport.data.visuals.style, 'farm-story');
  assert.equal(farmImport.data.visuals.iconPack, 'farm-tools');
  assert.equal(farmImport.data.visuals.canvasPattern, 'pasture-map');
  assert.equal(farmImport.data.visuals.nodeFrame, 'farm-sign-card');
  assert.equal(farmImport.data.music.preset, 'farm-breeze');

  const farmExport = await fetch(`${base}/templates/farm-story-route-test/export`).then((res) => res.json());
  assert.equal(farmExport.success, true);
  assert.equal(farmExport.data.visuals.style, 'farm-story');
  assert.equal(farmExport.data.visuals.iconPack, 'farm-tools');
  assert.equal(farmExport.data.visuals.canvasPattern, 'pasture-map');
  assert.equal(farmExport.data.visuals.nodeFrame, 'farm-sign-card');
  assert.equal(farmExport.data.music.preset, 'farm-breeze');

  const tetrisImport = await fetch(`${base}/templates/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: {
        schema: 't8-theme-template',
        version: 2,
        id: 'tetris-route-test',
        name: '俄罗斯方块路由测试',
        legacyStyle: 'pixel',
        visuals: {
          style: 'tetris',
          intensity: 'strong',
        },
        music: {},
        modes: MINIMAL_THEME_MODES,
      },
    }),
  }).then((res) => res.json());

  assert.equal(tetrisImport.success, true);
  assert.equal(tetrisImport.data.visuals.style, 'tetris');
  assert.equal(tetrisImport.data.visuals.iconPack, 'tetromino-well');
  assert.equal(tetrisImport.data.visuals.canvasPattern, 'tetris-stack');
  assert.equal(tetrisImport.data.visuals.nodeFrame, 'arcade-cabinet-card');
  assert.equal(tetrisImport.data.music.preset, 'block-drop');
});

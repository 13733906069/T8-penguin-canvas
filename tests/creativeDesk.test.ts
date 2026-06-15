import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

function creativeDeskFixture() {
  return {
    version: 1,
    defaultOpacity: 0.42,
    items: [
      {
        id: 'desk-image-1',
        kind: 'image',
        url: '/files/input/slamdunk-card.png',
        title: '球场贴纸',
        resourceId: 'res-image-1',
        x: 120,
        y: 80,
        width: 360,
        height: 220,
        scale: 1.15,
        rotation: -8,
        opacity: 0.42,
        frameId: 'poster-card',
        zIndex: 3,
        locked: false,
        visible: true,
        createdAt: 1781452800000,
      },
    ],
  };
}

test('canvas route persists creative desk background state with normal saves and auto-save mirrors', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't8-creative-desk-canvas-'));
  const dataDir = path.join(tmpDir, 'data');
  const autoRoot = path.join(tmpDir, 'auto');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ canvasAutoSavePath: autoRoot }), 'utf8');

  const config = require('../backend/src/config.js');
  const oldConfig = {
    DATA_DIR: config.DATA_DIR,
    CANVAS_FILE: config.CANVAS_FILE,
    SETTINGS_FILE: config.SETTINGS_FILE,
    DEFAULT_CANVAS_AUTO_SAVE_DIR: config.DEFAULT_CANVAS_AUTO_SAVE_DIR,
  };
  t.after(() => Object.assign(config, oldConfig));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  config.DATA_DIR = dataDir;
  config.CANVAS_FILE = path.join(dataDir, 'canvas_list.json');
  config.SETTINGS_FILE = path.join(tmpDir, 'settings.json');
  config.DEFAULT_CANVAS_AUTO_SAVE_DIR = autoRoot;
  fs.writeFileSync(
    config.CANVAS_FILE,
    JSON.stringify([{ id: 'canvas-creative-desk-test', name: '创作台', nodeCount: 0, createdAt: 1, updatedAt: 1 }]),
    'utf8',
  );

  const express = require('express');
  const canvasRouter = require('../backend/src/routes/canvas.js');
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use('/api/canvas', canvasRouter);

  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => server.close());

  const base = `http://127.0.0.1:${server.address().port}`;
  const body = {
    nodes: [],
    edges: [],
    viewport: { x: -80, y: 40, zoom: 0.75 },
    nextNodeSerialId: 9,
    creativeDesk: creativeDeskFixture(),
  };

  const saved = await fetch(`${base}/api/canvas/canvas-creative-desk-test?allowEmpty=1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => res.json());
  assert.equal(saved.success, true);

  const loaded = await fetch(`${base}/api/canvas/canvas-creative-desk-test`).then((res) => res.json());
  assert.equal(loaded.success, true);
  assert.deepEqual(loaded.data.creativeDesk, body.creativeDesk);

  const mirrored = await fetch(`${base}/api/canvas/canvas-creative-desk-test/auto-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => res.json());
  assert.equal(mirrored.success, true);
  const mirrorPayload = JSON.parse(fs.readFileSync(mirrored.data.path, 'utf8'));
  assert.deepEqual(mirrorPayload.creativeDesk, body.creativeDesk);
});

test('creative desk is wired through types, canvas UI, layer styles, and resource library references', () => {
  const types = read('../src/types/canvas.ts');
  const canvas = read('../src/components/Canvas.tsx');
  const css = read('../src/styles/index.css');

  assert.match(types, /export interface CreativeDeskItem/);
  assert.match(types, /export interface CreativeDeskState/);
  assert.match(types, /creativeDesk\?: CreativeDeskState/);

  assert.match(canvas, /import CreativeDeskLayer from '\.\/CreativeDeskLayer'/);
  assert.match(canvas, /creativeDesk,\s*setCreativeDesk/);
  assert.match(canvas, /data\.creativeDesk/);
  assert.match(canvas, /payload = \{ nodes: persistNodes, edges: persistEdges, viewport: getViewport\(\), nextNodeSerialId, creativeDesk/);
  assert.match(canvas, /<CreativeDeskLayer[\s\S]*creativeDesk=\{creativeDesk\}/);
  assert.match(canvas, /const floatingControlRail = \(/);
  assert.match(canvas, /<\/ReactFlow>\s*\{floatingControlRail\}/);
  assert.match(canvas, /data-canvas-floating-ui="creative-desk-toggle"/);
  assert.match(canvas, /t8-control-rail-creative-desk/);
  assert.match(canvas, /getResourceItems\(\{ kind: 'image'/);
  assert.match(canvas, /addResourceItem\(\{[\s\S]*kind:\s*'image'/);

  assert.match(css, /\.t8-control-rail\s*\{[\s\S]*z-index:\s*78/);
  assert.match(css, /\.t8-creative-desk-layer/);
  assert.match(css, /\.t8-creative-desk-layer\s*\{[\s\S]*pointer-events:\s*none/);
  assert.match(css, /\.t8-creative-desk-layer\.is-editing\s*\{[\s\S]*pointer-events:\s*auto/);
  assert.match(css, /\.t8-creative-desk-panel/);
  assert.match(css, /\.t8-creative-desk-frame--poster-card/);
  assert.match(css, /\.t8-creative-desk-frame--glass-card/);
  assert.match(css, /\.t8-creative-desk-frame--sticker/);
});

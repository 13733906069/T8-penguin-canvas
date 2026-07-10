import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('topbar exposes plugin install as a separate button before canvas tutorial', () => {
  const app = read('src/App.tsx');
  const packageJson = read('package.json');
  const photoshopManifest = read('tools/photoshop-bridge/plugin/manifest.json');
  const figmaManifest = read('tools/figma-bridge/plugin/manifest.json');
  const extensionManifest = read('extension/manifest.json');

  assert.match(app, /pluginInstallOpen/);
  assert.match(app, /pluginInstallWrapRef/);
  assert.ok(app.indexOf('title="插件安装') < app.indexOf('title="画布教程'));
  assert.ok(app.indexOf('setPluginInstallOpen') < app.indexOf('setCanvasTutorialOpen'));
  assert.match(app, /插件安装/);
  assert.match(app, /T8 Photoshop Link/);
  assert.match(app, /tools\\\\photoshop-bridge\\\\plugin\\\\manifest\.json/);
  assert.match(app, /Adobe UXP Developer Tool/);
  assert.match(app, /T8 Penguin Canvas Bridge/);
  assert.match(app, /tools\\\\figma-bridge\\\\plugin\\\\manifest\.json/);
  assert.match(app, /Plugins\s*->\s*Development\s*->\s*Import plugin from manifest/);
  assert.match(app, /网页图片反推 Chrome 扩展/);
  assert.match(app, /resources\/extension\/web-image-reverse\//);
  assert.match(app, /localhost|127\.0\.0\.1/);

  assert.match(photoshopManifest, /T8 Photoshop Link/);
  assert.match(figmaManifest, /T8 Penguin Canvas Bridge/);
  assert.match(extensionManifest, /T8 Penguin Canvas Web Image Reverse/);
  assert.match(packageJson, /"from":\s*"tools\/photoshop-bridge"/);
  assert.match(packageJson, /"from":\s*"tools\/figma-bridge"/);
  assert.match(packageJson, /"from":\s*"extension"/);
});

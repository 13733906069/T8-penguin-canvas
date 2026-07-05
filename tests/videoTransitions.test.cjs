const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveBundledFfmpeg } = require('../backend/src/providers/llmMedia');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}

test('video transition catalog exposes at least 50 high-quality creator transitions', () => {
  const catalog = readJson('shared/videoTransitions.json');
  const transitions = catalog.transitions;
  assert.ok(Array.isArray(transitions));
  assert.ok(transitions.length >= 50, `expected 50+ transitions, got ${transitions.length}`);

  const ids = new Set();
  const categories = new Set();
  let xfadeCount = 0;
  for (const item of transitions) {
    assert.equal(typeof item.id, 'string');
    assert.equal(typeof item.label, 'string');
    assert.equal(typeof item.category, 'string');
    assert.equal(typeof item.quality, 'string');
    assert.ok(item.id.length > 1);
    assert.ok(item.label.length >= 2);
    assert.ok(!ids.has(item.id), `duplicate transition id ${item.id}`);
    ids.add(item.id);
    categories.add(item.category);
    if (item.xfade) xfadeCount += 1;
  }

  assert.ok(xfadeCount >= 50, `expected 50+ native xfade mappings, got ${xfadeCount}`);
  for (const required of ['basic', 'fade', 'wipe', 'slide', 'iris', 'slice', 'wind', 'cover', 'reveal', 'stylized']) {
    assert.ok(categories.has(required), `missing transition category ${required}`);
  }
  for (const legacy of ['none', 'black', 'white', 'fade', 'crossfade', 'slide']) {
    assert.ok(ids.has(legacy), `missing legacy compatible transition ${legacy}`);
  }
});

test('bundled ffmpeg supports native xfade transitions for high-quality video edit output', () => {
  const ffmpeg = resolveBundledFfmpeg();
  const result = spawnSync(ffmpeg, ['-hide_banner', '-h', 'filter=xfade'], { encoding: 'utf8' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.equal(result.status, 0, output);
  assert.match(output, /transition/);
  assert.match(output, /wipeleft/);
  assert.match(output, /circleopen/);
  assert.match(output, /pixelize/);
  assert.match(output, /smoothleft/);
});

test('every catalog xfade transition is supported by the bundled ffmpeg runtime', () => {
  const catalog = readJson('shared/videoTransitions.json');
  const ffmpeg = resolveBundledFfmpeg();
  const result = spawnSync(ffmpeg, ['-hide_banner', '-h', 'filter=xfade'], { encoding: 'utf8' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.equal(result.status, 0, output);

  const missing = catalog.transitions
    .map((item) => item.xfade)
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index)
    .filter((name) => !new RegExp(`\\b${name}\\b`).test(output));

  assert.deepEqual(missing, []);
});

test('video transition catalog is loaded from packaged resources before source fallback', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'backend/src/routes/videoOps.js'), 'utf8');
  const postBuild = fs.readFileSync(path.join(__dirname, '..', 'electron/_post_build.cjs'), 'utf8');

  assert.match(route, /function loadVideoTransitionCatalog/);
  assert.match(route, /process\.env\.T8PC_RES/);
  assert.match(route, /path\.join\(resRoot,\s*'shared',\s*'videoTransitions\.json'\)/);
  assert.match(route, /source fallback/);
  assert.doesNotMatch(route, /require\('\.\.\/\.\.\/\.\.\/shared\/videoTransitions\.json'\)/);

  assert.match(postBuild, /shared['"], ['"]videoTransitions\.json/);
});

test('videoOps does not keep fake color-gap fallback transitions', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'backend/src/routes/videoOps.js'), 'utf8');

  assert.doesNotMatch(route, /makeColorTransition/);
  assert.doesNotMatch(route, /color=c=\$\{color\}/);
  assert.doesNotMatch(route, /transition === 'black' \|\| transition === 'white'/);
  assert.match(route, /当前 ffmpeg 不支持高质量 xfade 转场/);
});

test('videoOps rejects unknown requested transitions instead of silently cutting', () => {
  const videoOpsRouter = require('../backend/src/routes/videoOps');
  const { getTransitionDefinition } = videoOpsRouter._test;

  assert.equal(getTransitionDefinition('none').id, 'none');
  assert.equal(getTransitionDefinition('').id, 'none');
  assert.throws(
    () => getTransitionDefinition('definitely-not-a-transition'),
    /未知视频转场/,
  );
});

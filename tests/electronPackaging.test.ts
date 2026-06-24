import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

test('encrypted Electron loader only falls back to app require for bare packages', () => {
  const loader = read('../electron/loader.cjs');
  assert.match(loader, /function canFallbackToLoaderRequire/);
  assert.match(loader, /!text\.startsWith\('\.'\)/);
  assert.match(loader, /!path\.isAbsolute\(text\)/);
  assert.match(loader, /if \(!canFallbackToLoaderRequire\(id\)\) throw e;/);
  assert.match(loader, /if \(!canFallbackToLoaderRequire\(request\)\) throw e;/);
  assert.match(loader, /return require\(id\)/);
  assert.match(loader, /return require\.resolve\(request, options\)/);
});

test('clean installs include Three.js typings for Panorama3D type-check', () => {
  const packageJson = JSON.parse(read('../package.json'));
  const lock = read('../package-lock.json');
  const panorama = read('../src/components/nodes/Panorama3DNode.tsx');

  assert.equal(packageJson.devDependencies['@types/three'], '^0.184.1');
  assert.match(lock, /"node_modules\/@types\/three"/);
  assert.doesNotMatch(lock, /registry\.npmmirror\.com/);
  assert.match(panorama, /type ThreeModule = typeof import\('three'\)/);
});

test('dir packaging verification ignores stale release metadata unless update artifacts are required', () => {
  const postBuild = read('../electron/_post_build.cjs');
  assert.match(postBuild, /const strict = process\.env\.T8_REQUIRE_UPDATE_ARTIFACTS === '1'/);
  assert.match(postBuild, /const hasInstaller = fs\.existsSync\(installer\)/);
  assert.match(postBuild, /const hasBlockmap = fs\.existsSync\(blockmap\)/);
  assert.match(postBuild, /!strict && !hasInstaller && !hasBlockmap/);
  assert.match(postBuild, /skipping installer\/latest\.yml checks for dir build/);
});

test('Electron release publishing requires explicit per-version approval', () => {
  const distRelease = read('../scripts/dist-release.cjs');
  const githubRelease = read('../scripts/release-github.cjs');

  assert.match(distRelease, /const releaseApproval = `release-\$\{pkg\.version\}`/);
  assert.match(distRelease, /function assertReleaseApproval\(\)/);
  assert.match(distRelease, /process\.env\.T8_RELEASE_APPROVAL === releaseApproval/);
  assert.match(distRelease, /refusing to run Electron release without explicit approval/);
  assert.match(distRelease, /only after the user explicitly asks to publish/);
  assert.match(distRelease, /github release upload \+ verify/);

  assert.match(githubRelease, /const releaseApproval = `release-\$\{version\}`/);
  assert.match(githubRelease, /function assertReleaseApproval\(\)/);
  assert.match(githubRelease, /if \(dryRun\) return/);
  assert.match(githubRelease, /process\.env\.T8_RELEASE_APPROVAL === releaseApproval/);
  assert.match(githubRelease, /refusing to publish GitHub Release without explicit approval/);
});

test('Electron release keeps one packaged ffmpeg runtime and excludes installer duplicate', () => {
  const packageJson = JSON.parse(read('../package.json'));
  const files = packageJson.build.files;
  const resources = packageJson.build.extraResources.map((item: any) => `${item.from}->${item.to}`);
  const ffmpegResource = packageJson.build.extraResources.find((item: any) => item.to === 'tools/ffmpeg');
  const llmMedia = read('../backend/src/providers/llmMedia.js');

  assert.equal(packageJson.build.compression, 'normal');
  assert.ok(files.includes('!node_modules/@ffmpeg-installer/**/*'));
  assert.ok(resources.includes('tools/ffmpeg-runtime->tools/ffmpeg'));
  assert.deepEqual(ffmpegResource.filter, ['ffmpeg.exe', 'ffmpeg', 'README.md']);
  assert.match(llmMedia, /resRoot && path\.join\(resRoot, 'tools', 'ffmpeg', binary\)/);
  assert.match(llmMedia, /optional dev fallback only/);
});

test('Electron packaging verifies encrypted local extension hook points', () => {
  const postBuild = read('../electron/_post_build.cjs');
  const encrypt = read('../electron/encrypt.cjs');

  assert.match(postBuild, /extensions['"], ['"]runtimeHooks\.t8c/);
  assert.match(postBuild, /routes['"], ['"]figma\.t8c/);
  assert.match(postBuild, /routes['"], ['"]grokOAuth\.t8c/);
  assert.match(postBuild, /routes['"], ['"]codexCli\.t8c/);
  assert.match(postBuild, /utils['"], ['"]codexCliRunner\.t8c/);
  assert.match(postBuild, /utils['"], ['"]figmaBridge\.t8c/);
  assert.match(postBuild, /checkFigmaBridgeRuntime/);
  assert.match(postBuild, /tools['"], ['"]figma-bridge/);
  assert.match(encrypt, /const LOCAL_PRIVATE_BACKEND_DIRS = \[/);
  assert.match(encrypt, /path\.join\(LOCAL_PRIVATE_SRC, 'extensions', 'backend'\)/);
  assert.match(encrypt, /path\.join\(LOCAL_PRIVATE_SRC, 'recharge', 'backend'\)/);
  assert.doesNotMatch(encrypt, /walk\(LOCAL_PRIVATE_SRC\)/);
  const packageJson = JSON.parse(read('../package.json'));
  const resources = packageJson.build.extraResources.map((item: any) => `${item.from}->${item.to}`);
  assert.ok(resources.includes('tools/figma-bridge->tools/figma-bridge'));
  const localHook = new URL('../local-private/extensions/build/post-build.cjs', import.meta.url);
  if (existsSync(localHook)) {
    const localPostBuild = read('../local-private/extensions/build/post-build.cjs');
    assert.match(localPostBuild, /zhenzhenGroups\.t8c/);
    assert.match(localPostBuild, /private New API group source must be encrypted/);
    assert.match(localPostBuild, /backend-enc['"], ['"]local-private/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const runtimeArchive = require('../backend/src/utils/runtimeArchive.js');

test('runtime archive extraction falls back when tar and PowerShell are unavailable', () => {
  const root = mkdtempSync(path.join(tmpdir(), 't8-runtime-archive-'));
  const sourceDir = path.join(root, 'source');
  const archiveDir = path.join(root, 'archives');
  const cacheDir = path.join(root, 'cache');
  mkdirSync(path.join(sourceDir, 'parsehub'), { recursive: true });
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(path.join(sourceDir, 'parsehub', '__init__.py'), "__version__ = 'test'\n", 'utf8');

  const archivePath = path.join(archiveDir, 'parsehub-pythonlibs.zip');
  const path7za = require('7zip-bin').path7za;
  const zip = spawnSync(path7za, ['a', '-tzip', '-mx=1', archivePath, '.'], {
    cwd: sourceDir,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(zip.status, 0, zip.stderr || zip.stdout);

  const oldEnv = {
    T8_RUNTIME_ARCHIVES_DIR: process.env.T8_RUNTIME_ARCHIVES_DIR,
    T8_RUNTIME_CACHE_DIR: process.env.T8_RUNTIME_CACHE_DIR,
    PATH: process.env.PATH,
    Path: process.env.Path,
  };
  try {
    process.env.T8_RUNTIME_ARCHIVES_DIR = archiveDir;
    process.env.T8_RUNTIME_CACHE_DIR = cacheDir;
    process.env.PATH = '';
    process.env.Path = '';

    const info = runtimeArchive.ensureRuntimeArchiveExtracted('parsehub-pythonlibs');

    assert.equal(info.ready, true);
    assert.equal(info.extracted, true);
    assert.equal(existsSync(path.join(cacheDir, 'parsehub-pythonlibs', 'parsehub', '__init__.py')), true);
  } finally {
    for (const [key, value] of Object.entries(oldEnv)) {
      if (typeof value === 'undefined') delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
});

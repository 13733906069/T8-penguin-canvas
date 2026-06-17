#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'src', 'data', 'rhToolboxManifest.ts');
const PERSISTED_PATH = process.env.T8_RH_TOOLBOX_PERSISTED_MANIFEST
  ? path.resolve(ROOT, process.env.T8_RH_TOOLBOX_PERSISTED_MANIFEST)
  : path.join(ROOT, 'data', 'rh_toolbox_manifest.json');

function extractObjectLiteral(source) {
  const marker = 'export const RH_TOOLBOX_MANIFEST';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('RH_TOOLBOX_MANIFEST export not found');
  const start = source.indexOf('{', markerIndex);
  if (start < 0) throw new Error('RH_TOOLBOX_MANIFEST object literal not found');

  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('RH_TOOLBOX_MANIFEST object literal is not balanced');
}

function readSourceManifest() {
  const source = fs.readFileSync(SOURCE_PATH, 'utf-8');
  const literal = extractObjectLiteral(source);
  return Function(`"use strict"; return (${literal});`)();
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function hasManifestData(manifest) {
  return Boolean(
    manifest
    && typeof manifest === 'object'
    && ((Array.isArray(manifest.categories) && manifest.categories.length > 0)
      || (Array.isArray(manifest.tools) && manifest.tools.length > 0)),
  );
}

function compactIdentity(value) {
  return String(value || '').trim().replace(/[\s\u200b-\u200f\ufeff]+/g, '').toLowerCase();
}

function toolIdentityKeys(tool) {
  const keys = new Set();
  const id = compactIdentity(tool && tool.id);
  const title = compactIdentity(tool && tool.title);
  const webappId = compactIdentity(tool && tool.webappId);
  if (id) keys.add(`id:${id}`);
  if (title) keys.add(`title:${title}`);
  if (webappId) keys.add(`webapp:${webappId}`);
  return Array.from(keys);
}

function putTool(toolMap, identityToToolId, tool) {
  if (!tool || typeof tool !== 'object' || !tool.id) return;
  const keys = toolIdentityKeys(tool);
  for (const key of keys) {
    const existingId = identityToToolId.get(key);
    if (existingId && existingId !== tool.id) toolMap.delete(existingId);
  }
  toolMap.set(tool.id, tool);
  for (const key of keys) identityToToolId.set(key, tool.id);
}

function sortByOrderThenName(items, nameKey) {
  return items.slice().sort((a, b) => {
    const ao = Number.isFinite(Number(a && a.order)) ? Number(a.order) : 9999;
    const bo = Number.isFinite(Number(b && b.order)) ? Number(b.order) : 9999;
    if (ao !== bo) return ao - bo;
    return String((a && a[nameKey]) || (a && a.id) || '').localeCompare(
      String((b && b[nameKey]) || (b && b.id) || ''),
      'zh-Hans-CN',
    );
  });
}

function mergeManifests(base, overlay) {
  const categoryMap = new Map();
  for (const category of Array.isArray(base.categories) ? base.categories : []) {
    if (category && category.id) categoryMap.set(category.id, category);
  }
  for (const category of Array.isArray(overlay.categories) ? overlay.categories : []) {
    if (category && category.id) categoryMap.set(category.id, category);
  }

  const toolMap = new Map();
  const identityToToolId = new Map();
  for (const tool of Array.isArray(base.tools) ? base.tools : []) putTool(toolMap, identityToToolId, tool);
  for (const tool of Array.isArray(overlay.tools) ? overlay.tools : []) putTool(toolMap, identityToToolId, tool);

  return {
    schema: 't8-rh-toolbox-manifest',
    version: Math.max(Number(base.version) || 1, Number(overlay.version) || 1),
    updatedAt: overlay.updatedAt || base.updatedAt || new Date().toISOString(),
    categories: sortByOrderThenName(Array.from(categoryMap.values()), 'name'),
    tools: sortByOrderThenName(Array.from(toolMap.values()), 'title'),
  };
}

function sourceForManifest(manifest) {
  return `import type { RhToolboxManifest } from '../utils/rhToolbox';

/**
 * RH工具箱运行 manifest。
 *
 * 维护规则：
 * - 用户包只读取这里的运行配置，不提供客户端编辑入口。
 * - 新增工具优先只新增 manifest，不给节点组件写专属分支。
 * - 启用工具必须填写 webappId、输入映射、输出协议和运行参数。
 * - 制作器保存的持久应用会由 scripts/sync-rh-toolbox-manifest.cjs 在打包检查前合并进这里。
 */
export const RH_TOOLBOX_MANIFEST: RhToolboxManifest = ${JSON.stringify(manifest, null, 2)};
`;
}

function syncRhToolboxManifest(options = {}) {
  const persisted = readJson(PERSISTED_PATH);
  if (!hasManifestData(persisted)) {
    if (options.verbose) console.log('[rh-toolbox-sync] no persisted manifest to merge');
    return { changed: false, skipped: true, sourcePath: SOURCE_PATH, persistedPath: PERSISTED_PATH };
  }

  const base = readSourceManifest();
  const merged = mergeManifests(base, persisted);
  const nextSource = sourceForManifest(merged);
  const currentSource = fs.readFileSync(SOURCE_PATH, 'utf-8');
  const changed = currentSource !== nextSource;
  if (changed) fs.writeFileSync(SOURCE_PATH, nextSource, 'utf-8');
  if (options.verbose) {
    console.log(`[rh-toolbox-sync] ${changed ? 'updated' : 'ok'}: ${merged.tools.length} tools, ${merged.categories.length} categories`);
  }
  return {
    changed,
    skipped: false,
    sourcePath: SOURCE_PATH,
    persistedPath: PERSISTED_PATH,
    toolCount: merged.tools.length,
    categoryCount: merged.categories.length,
  };
}

if (require.main === module) {
  try {
    syncRhToolboxManifest({ verbose: true });
  } catch (error) {
    console.error('[rh-toolbox-sync] FAILED');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
}

module.exports = {
  syncRhToolboxManifest,
};

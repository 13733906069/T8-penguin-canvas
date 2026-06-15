import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const comfyApps = fs.readFileSync('src/utils/comfyuiApps.ts', 'utf8');
const store = fs.readFileSync('src/components/nodes/ComfyUIStoreNode.tsx', 'utf8');
const maker = fs.readFileSync('src/components/nodes/ComfyUIAppMakerNode.tsx', 'utf8');
const apiSettings = fs.readFileSync('src/components/ApiSettings.tsx', 'utf8');
const workflow = fs.readFileSync('src/utils/comfyuiWorkflow.ts', 'utf8');

test('ComfyUI manifest utilities expose user library CRUD and backup flows', () => {
  assert.match(comfyApps, /export function saveComfyAppCategory/);
  assert.match(comfyApps, /export function deleteComfyAppCategory/);
  assert.match(comfyApps, /export function deleteComfyApp/);
  assert.match(comfyApps, /export function moveComfyAppToCategory/);
  assert.match(comfyApps, /export function importComfyAppManifest/);
  assert.match(comfyApps, /categories: \[\.\.\.current\.categories, \.\.\.imported\.categories\]/);
  assert.match(comfyApps, /appMap\.set\(app\.id, app\)/);
});

test('ComfyUI store node wires category management, app delete, and import export controls', () => {
  assert.match(store, /createCategory/);
  assert.match(store, /removeCategory/);
  assert.match(store, /moveAppCategory/);
  assert.match(store, /removeApp/);
  assert.match(store, /downloadJson\(`t8-comfyui-apps-/);
  assert.match(store, /importComfyAppManifest\(imported\)/);
  assert.match(store, /title="设置应用分类"/);
  assert.match(store, /title=\{userAppIds\.has\(app\.id\) \? '删除应用'/);
});

test('ComfyUI maker filters removed auto-detected params before saving app JSON', () => {
  assert.match(maker, /comfyMakerHiddenParamKeys/);
  assert.match(maker, /rawApp\.userParams\.filter\(\(param\) => !hiddenParamKeySet\.has\(param\.key\)\)/);
  assert.match(maker, /hideParam\(param\.key\)/);
  assert.match(maker, /恢复全部已移除参数/);
});

test('ComfyUI app builder applies auto-mapping exclude rules before exposing params', () => {
  assert.match(comfyApps, /excludeRules\?: string\[\]/);
  assert.match(comfyApps, /filterComfyFieldsByExcludeRules\(options\.workflowJson, analysis\.fields, options\.excludeRules\)/);
  assert.match(maker, /excludeRules,/);
});

test('ComfyUI exclude rules expose import and export in settings and maker', () => {
  assert.match(workflow, /COMFY_FIELD_EXCLUDE_RULES_SCHEMA/);
  assert.match(workflow, /createComfyFieldExcludeRulesBackup/);
  assert.match(workflow, /parseComfyFieldExcludeRulesBackup/);
  assert.match(workflow, /autoMappingExcludeRules/);
  assert.match(apiSettings, /exportComfyExcludeRules/);
  assert.match(apiSettings, /handleComfyExcludeRulesFile/);
  assert.match(apiSettings, /导出规则/);
  assert.match(apiSettings, /导入规则/);
  assert.match(maker, /exportExcludeRules/);
  assert.match(maker, /importExcludeRulesFile/);
  assert.match(maker, /导出规则/);
  assert.match(maker, /导入规则/);
});

test('ComfyUI app builder exposes custom workflow fields from the expanded analyzer', () => {
  assert.match(comfyApps, /control_net_name/);
  assert.match(comfyApps, /frame_rate/);
  assert.match(comfyApps, /num_frames/);
  assert.match(comfyApps, /SAFE_CUSTOM_SOURCE_RE/);
  assert.match(comfyApps, /MEDIA_SOURCE_RE\.test\(source\)\) return false/);
});

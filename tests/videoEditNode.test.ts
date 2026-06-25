import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(rel: string) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

test('video edit node is registered as a lightweight core video workflow node', () => {
  const types = read('src/types/canvas.ts');
  const registry = read('src/config/nodeRegistry.ts');
  const ports = read('src/config/portTypes.ts');
  const placement = read('src/utils/nodePlacement.ts');
  const canvas = read('src/components/Canvas.tsx');
  const videoEdit = read('src/utils/videoEdit.ts');

  assert.match(types, /\|\s*'video-edit'/);
  assert.match(registry, /type:\s*'video-edit'[\s\S]*label:\s*'视频剪辑'[\s\S]*category:\s*'core'/);
  assert.match(ports, /'video-edit':\s*\{\s*inputs:\s*\['video'\],\s*outputs:\s*\['video'\]\s*\}/);
  assert.match(placement, /'video-edit':\s*\{\s*w:\s*760,\s*h:\s*520\s*\}/);
  assert.match(canvas, /const VideoEditNode = lazyCanvasNode\(\(\) => import\('\.\/nodes\/VideoEditNode'\), 'VideoEditNode'\)/);
  assert.match(canvas, /'video-edit':\s*VideoEditNode/);
  assert.match(canvas, /'video-edit':\s*\{\s*\.\.\.DEFAULT_VIDEO_EDIT_DATA[\s\S]*clips:\s*\[\]/);
  assert.match(videoEdit, /DEFAULT_VIDEO_EDIT_SETTINGS[\s\S]*aspect:\s*'first'[\s\S]*transition:\s*'none'[\s\S]*audio:\s*'keep'/);
});

test('send materials flow can append videos to a video edit node instead of creating output nodes', () => {
  const sendMaterials = read('src/utils/sendMaterials.ts');
  const modal = read('src/components/SendMaterialsModal.tsx');
  const canvas = read('src/components/Canvas.tsx');

  assert.match(sendMaterials, /\|\s*'video-edit'/);
  assert.match(modal, /value:\s*'video-edit'[\s\S]*label:\s*'视频剪辑'/);
  assert.match(modal, /视频剪辑节点/);
  assert.match(canvas, /appendMaterialsToVideoEditNode/);
  assert.match(canvas, /createVideoEditClipFromSendable/);
  assert.match(canvas, /selectVideoEditTargetNode/);
  assert.match(modal, /新建视频剪辑并发送/);
  assert.match(canvas, /跨画布视频剪辑/);
});

test('video edit backend exposes ffmpeg probe and compose endpoints', () => {
  const server = read('backend/src/server.js');
  const route = read('backend/src/routes/videoOps.js');

  assert.match(server, /const videoOpsRouter = require\('\.\/routes\/videoOps'\)/);
  assert.match(server, /app\.use\('\/api\/video-ops', videoOpsRouter\)/);
  assert.match(route, /resolveBundledFfmpeg/);
  assert.match(route, /router\.post\('\/probe'/);
  assert.match(route, /router\.post\('\/compose'/);
  assert.match(route, /router\.get\('\/jobs\/:id'/);
  assert.match(route, /router\.post\('\/jobs\/:id\/cancel'/);
  assert.match(route, /video_edit_/);
  assert.match(route, /transition/);
  assert.match(route, /filter/);
  assert.match(route, /audio/);
});

test('video edit node offers creator presets, thumbnails, clip splitting, and async compose controls', () => {
  const videoEdit = read('src/utils/videoEdit.ts');
  const node = read('src/components/nodes/VideoEditNode.tsx');
  const service = read('src/services/videoOps.ts');
  const route = read('backend/src/routes/videoOps.js');

  assert.match(videoEdit, /VideoEditAspect[\s\S]*'3:4'[\s\S]*'4:3'[\s\S]*'21:9'[\s\S]*'2:1'/);
  assert.doesNotMatch(videoEdit, /'4:5'/);
  assert.match(videoEdit, /VIDEO_EDIT_OUTPUT_PRESETS[\s\S]*抖音\/快手[\s\S]*B站\/YouTube[\s\S]*竖版海报[\s\S]*横版展示[\s\S]*电影宽屏[\s\S]*宽幅\/全景/);
  assert.match(videoEdit, /VIDEO_EDIT_CREATOR_TEMPLATES[\s\S]*快速混剪[\s\S]*口播混剪[\s\S]*产品展示[\s\S]*前后对比/);
  assert.match(videoEdit, /applyVideoEditOutputPreset/);
  assert.match(videoEdit, /applyVideoEditCreatorTemplate/);

  assert.match(node, /thumbnailUrl/);
  assert.match(node, /拆分片段/);
  assert.match(node, /splitSelectedClip/);
  assert.match(node, /输出预设/);
  assert.match(node, /一键模板/);
  assert.match(node, /取消合成/);
  assert.match(node, /composeVideoEditAsync/);
  assert.match(node, /getVideoEditJob/);
  assert.match(node, /cancelVideoEditJob/);

  assert.match(service, /composeVideoEditAsync/);
  assert.match(service, /async:\s*true/);
  assert.match(route, /req\.body\?\.async/);
  assert.match(route, /setImmediate/);
});

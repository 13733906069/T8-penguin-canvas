import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const canvasSource = readFileSync(new URL('../src/components/Canvas.tsx', import.meta.url), 'utf8');

test('model usage help text includes current image, video, audio and LLM notes', () => {
  assert.match(canvasSource, /如果不小心网页崩溃等，但是实际任务没失败，需要去网站异步任务看下/);
  assert.match(canvasSource, /图像模型注意事项（2K，4K只有FAL长期稳定，其他都不保证稳定）/);
  assert.match(canvasSource, /gpt-image-2模型（default分组）可以出1K，2K，4K图，2K，4K不一定稳定/);
  assert.match(canvasSource, /gpt-image-2-2k模型是备用模型，非gpt-image-2模型分支，直接支持2k，目前0\.1积分,2026\.06\.10新增（default分组）/);
  assert.match(canvasSource, /gpt-image-2-4k模型是备用模型，非gpt-image-2模型分支，直接支持2k，目前0\.1积分,2026\.06\.10新增（default分组）/);
  assert.match(canvasSource, /veo-omni模型，需要使用default分组（veo-omnii模型是2026\.06\.06刚上架的）/);
  assert.match(canvasSource, /grok-video模型，需要看下网站左侧分类教程，有多个分组可用，目前比较稳的是fal模型和默认分组/);
  assert.match(canvasSource, /2026\.06\.11修复grok-video-3模型的defualt默认分组，直接升级成imagine 1\.5模型，0\.5积分10秒，2026\.06\.12新增grok-video-1\.5-6s，grok-video-1\.5-10s，grok-video-1\.5-15s模型，默认720P，分组default，3个模型，分别是0\.5，0\.7，0\.7积分，最佳SD2\.0平替/);
  assert.match(canvasSource, /sora-2模型，支持sora-vip分组以及default默认分组的FAL模型/);
  assert.match(canvasSource, /suno v5\.5模型（Default分组）支持生成，翻唱，延长，一次生成两首歌/);
  assert.match(canvasSource, /LLM模型有时候因为官方问题会出现速度慢，失败等现象，这时候换个模型即可或者换一下分组即可/);
});

test('model usage help no longer warns that Sora2 is unavailable', () => {
  assert.doesNotMatch(canvasSource, /20260\.06\.11/);
  assert.doesNotMatch(canvasSource, /sora-2模型，由于官方下架了/);
  assert.doesNotMatch(canvasSource, /目前有问题，先不要用/);
  assert.doesNotMatch(canvasSource, /gpt-image-2-vip模型/);
});

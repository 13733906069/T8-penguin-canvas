import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDirectorStoryboardRunPlan,
  buildDirectorShotSeedancePayload,
  calculateDirectorTimelineDragDuration,
  runDirectorStoryboardJobs,
  sanitizeDirectorStoryboardShots,
  type DirectorStoryboardJob,
} from '../src/utils/directorStoryboard.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('director storyboard node is registered as a visible Seedance orchestration node', () => {
  const registry = read('../src/config/nodeRegistry.ts');
  const ports = read('../src/config/portTypes.ts');
  const types = read('../src/types/canvas.ts');
  const canvas = read('../src/components/Canvas.tsx');
  const features = read('../features.json');

  assert.match(registry, /type:\s*'director-storyboard'[\s\S]*label:\s*'导演分镜台'[\s\S]*category:\s*'core'/);
  assert.match(ports, /'director-storyboard':\s*\{\s*inputs:\s*\['text', 'image', 'video', 'audio'\],\s*outputs:\s*\['video', 'text'\]\s*\}/);
  assert.match(types, /\|\s*'director-storyboard'/);
  assert.match(canvas, /const DirectorStoryboardNode = lazyCanvasNode\(\(\) => import\('\.\/nodes\/DirectorStoryboardNode'\), 'DirectorStoryboardNode'\)/);
  assert.match(canvas, /'director-storyboard': DirectorStoryboardNode/);
  assert.match(canvas, /'director-storyboard':\s*\{/);
  assert.match(features, /director-storyboard/);
});

test('sanitizeDirectorStoryboardShots keeps integer seconds and creates a usable default shot', () => {
  assert.deepEqual(
    sanitizeDirectorStoryboardShots([]).map((shot) => ({
      title: shot.title,
      durationSec: shot.durationSec,
      frameMode: shot.frameMode,
      prompt: shot.prompt,
    })),
    [{ title: 'S1', durationSec: 5, frameMode: 'auto', prompt: '' }],
  );

  const shots = sanitizeDirectorStoryboardShots([
    { id: 'a', title: ' opening ', durationSec: 2.6, prompt: '  start ', frameMode: 'firstlast' },
    { id: 'b', title: '', durationSec: 99, prompt: 'end', frameMode: 'unknown' as any },
  ]);

  assert.equal(shots[0].title, 'opening');
  assert.equal(shots[0].durationSec, 4);
  assert.equal(shots[0].frameMode, 'firstlast');
  assert.equal(shots[0].prompt, 'start');
  assert.equal(shots[1].title, 'S2');
  assert.equal(shots[1].durationSec, 15);
  assert.equal(shots[1].frameMode, 'auto');
});

test('director storyboard duration drag uses a 4-15 second range', () => {
  assert.equal(
    calculateDirectorTimelineDragDuration({
      startDurationSec: 8,
      startClientX: 100,
      currentClientX: 160,
      timelineWidthPx: 300,
      totalDurationSec: 30,
    }),
    14,
  );
  assert.equal(
    calculateDirectorTimelineDragDuration({
      startDurationSec: 5,
      startClientX: 100,
      currentClientX: -500,
      timelineWidthPx: 300,
      totalDurationSec: 30,
    }),
    4,
  );
  assert.equal(
    calculateDirectorTimelineDragDuration({
      startDurationSec: 12,
      startClientX: 100,
      currentClientX: 500,
      timelineWidthPx: 300,
      totalDurationSec: 30,
    }),
    15,
  );
});

test('director storyboard node keeps ports visible and makes timeline resizing draggable', () => {
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');

  assert.match(node, /className=\{`relative w-\[460px\] overflow-visible/);
  assert.match(node, /className="director-storyboard-port[^"]*!h-4[^"]*!w-4/);
  assert.match(node, /onPointerDownCapture=\{\(event\) => beginDurationResize\(event, shot\)\}/);
  assert.match(node, /onPointerDown=\{\(event\) => beginDurationResize\(event, shot\)\}/);
  assert.match(node, /onPointerMoveCapture=\{moveDurationResize\}/);
  assert.match(node, /onPointerUpCapture=\{endDurationResize\}/);
  assert.match(node, /onPointerCancelCapture=\{endDurationResize\}/);
  assert.match(node, /onMouseDownCapture=\{\(event\) => beginDurationResize\(event, shot\)\}/);
  assert.match(node, /onMouseDown=\{\(event\) => beginDurationResize\(event, shot\)\}/);
  assert.match(node, /onMouseMoveCapture=\{moveDurationResize\}/);
  assert.match(node, /onMouseUpCapture=\{endDurationResize\}/);
  assert.match(node, /className="nodrag nopan absolute -right-1 top-0 z-20 h-full w-4 cursor-ew-resize/);
});

test('director storyboard active shot can override global model ratio and resolution', () => {
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');

  assert.match(node, /镜头覆盖/);
  assert.match(node, /activeShot\.modelOverride \|\| ''/);
  assert.match(node, /activeShot\.ratioOverride \|\| ''/);
  assert.match(node, /activeShot\.resolutionOverride \|\| ''/);
});

test('buildDirectorShotSeedancePayload compiles media mentions and first/last frame references', () => {
  const prompt = 'A hero walks from @image1 while narrator says @text1';
  const imageStart = prompt.indexOf('@image1');
  const textStart = prompt.indexOf('@text1');
  const payload = buildDirectorShotSeedancePayload(
    {
      id: 'shot-1',
      title: 'S1',
      durationSec: 8,
      prompt,
      promptMentions: [
        {
          id: 'm-image',
          kind: 'image',
          materialKey: 'image:/files/input/ref-a.png',
          url: '/files/input/ref-a.png',
          token: '@image1',
          start: imageStart,
          end: imageStart + '@image1'.length,
        },
        {
          id: 'm-text',
          kind: 'text',
          materialKey: 'text:cinematic sunset',
          url: 'cinematic sunset',
          token: '@text1',
          start: textStart,
          end: textStart + '@text1'.length,
        },
      ],
      frameMode: 'firstlast',
      localRefImages: ['/files/input/ref-b.png', '/files/input/ref-c.png'],
      localRefVideos: ['/files/input/ref-v.mp4'],
      localRefAudios: ['/files/input/ref-audio.mp3'],
    },
    {
      model: 'doubao-seedance-2-0-fast-260128',
      ratio: '16:9',
      resolution: '720p',
      generateAudio: true,
      returnLastFrame: false,
      watermark: false,
      webSearch: false,
      seed: -1,
    },
    {
      mentionMaterials: [
        { kind: 'image', url: '/files/input/ref-a.png', label: 'ref-a' },
        { kind: 'text', url: 'cinematic sunset', label: 'tone' },
      ],
    },
  );

  assert.equal(payload.prompt, 'A hero walks from @image1 while narrator says cinematic sunset');
  assert.equal(payload.duration, 8);
  assert.equal(payload.firstFrame, '/files/input/ref-a.png');
  assert.equal(payload.lastFrame, '/files/input/ref-b.png');
  assert.deepEqual(payload.refImages, ['/files/input/ref-c.png']);
  assert.deepEqual(payload.videos, ['/files/input/ref-v.mp4']);
  assert.deepEqual(payload.audios, ['/files/input/ref-audio.mp3']);
});

test('buildDirectorStoryboardRunPlan adds optional bridge jobs without enabling them by default', () => {
  const base = {
    model: 'doubao-seedance-2-0-fast-260128',
    ratio: '16:9',
    resolution: '480p',
    generateAudio: true,
    returnLastFrame: false,
    watermark: false,
    webSearch: false,
    seed: -1,
  };

  const shots = sanitizeDirectorStoryboardShots([
    { id: 's1', title: 'S1', durationSec: 5, prompt: 'first', localRefImages: ['a.png'] },
    { id: 's2', title: 'S2', durationSec: 6, prompt: 'second', localRefImages: ['b.png'] },
  ]);

  assert.deepEqual(buildDirectorStoryboardRunPlan(shots, { ...base, bridgeEnabled: false }).map((job) => job.kind), ['shot', 'shot']);

  const withBridge = buildDirectorStoryboardRunPlan(shots, {
    ...base,
    bridgeEnabled: true,
    bridgeDurationSec: 4,
    bridgePrompt: 'smooth transition',
  });

  assert.deepEqual(withBridge.map((job) => job.kind), ['shot', 'bridge', 'shot']);
  assert.equal(withBridge[1].payload.duration, 4);
  assert.equal(withBridge[1].payload.firstFrame, 'a.png');
  assert.equal(withBridge[1].payload.lastFrame, 'b.png');
});

test('runDirectorStoryboardJobs starts all jobs without a concurrency limiter and reports each completion immediately', async () => {
  const jobs: DirectorStoryboardJob[] = [
    { id: 'a', shotId: 'a', order: 0, kind: 'shot', title: 'S1', payload: { model: 'm', prompt: 'a' } },
    { id: 'b', shotId: 'b', order: 1, kind: 'shot', title: 'S2', payload: { model: 'm', prompt: 'b' } },
    { id: 'c', shotId: 'c', order: 2, kind: 'shot', title: 'S3', payload: { model: 'm', prompt: 'c' } },
  ];
  const started: string[] = [];
  const completed: string[] = [];
  const resolvers = new Map<string, (url: string) => void>();

  const runPromise = runDirectorStoryboardJobs(
    jobs,
    (job) => {
      started.push(job.id);
      return new Promise<string>((resolve) => resolvers.set(job.id, resolve));
    },
    {
      onJobComplete: (result) => completed.push(`${result.job.id}:${result.videoUrl}`),
    },
  );

  await Promise.resolve();
  assert.deepEqual(started, ['a', 'b', 'c']);

  resolvers.get('b')?.('video-b.mp4');
  await Promise.resolve();
  assert.deepEqual(completed, ['b:video-b.mp4']);

  resolvers.get('a')?.('video-a.mp4');
  resolvers.get('c')?.('video-c.mp4');
  const result = await runPromise;

  assert.deepEqual(result.videoUrls, ['video-a.mp4', 'video-b.mp4', 'video-c.mp4']);
  assert.deepEqual(result.results.map((item) => item.status), ['success', 'success', 'success']);
});

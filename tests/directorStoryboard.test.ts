import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIRECTOR_BRIDGE_PROMPT_PRESETS,
  buildDirectorStoryboardBridgeRunPlan,
  buildDirectorStoryboardOutputItems,
  buildDirectorStoryboardOutputNodeData,
  buildDirectorStoryboardOutputSummary,
  buildDirectorStoryboardRunPlan,
  buildDirectorShotSeedancePayload,
  calculateDirectorTimelineDragDuration,
  createDirectorBridgePromptPresetExport,
  findDirectorStoryboardOutputItemForNodeData,
  buildDirectorStoryboardShotInputPatch,
  buildDirectorStoryboardReferenceOrder,
  parseDirectorBridgePromptPresetImport,
  reorderDirectorStoryboardReference,
  runDirectorStoryboardJobs,
  sanitizeDirectorBridgePromptPresets,
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
  assert.match(canvas, /directorBridgePanelEnabled:\s*false/);
  assert.match(canvas, /bridgeEnabled:\s*false/);
  assert.match(canvas, /directorBridgePromptPresets:\s*\[\]/);
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

test('sanitizeDirectorStoryboardShots recovers stale references that were saved under the wrong media bucket', () => {
  const [shot] = sanitizeDirectorStoryboardShots([
    {
      id: 'mixed',
      title: 'mixed refs',
      durationSec: 6,
      localRefImages: ['/files/input/keep.png', '/files/input/was-video.mp4'],
      localRefVideos: ['/files/input/was-image.jpg', '/files/input/keep-video.webm'],
      localRefAudios: ['/files/input/was-image-2.webp', '/files/input/keep-audio.mp3'],
    },
  ]);

  assert.deepEqual(shot.localRefImages, [
    '/files/input/keep.png',
    '/files/input/was-image.jpg',
    '/files/input/was-image-2.webp',
  ]);
  assert.deepEqual(shot.localRefVideos, ['/files/input/was-video.mp4', '/files/input/keep-video.webm']);
  assert.deepEqual(shot.localRefAudios, ['/files/input/keep-audio.mp3']);
});

test('director storyboard references can be reordered as one mixed material pool', () => {
  const [shot] = sanitizeDirectorStoryboardShots([
    {
      id: 'mixed-order',
      title: 'mixed order',
      durationSec: 6,
      localRefImages: ['/files/input/image-a.png', '/files/input/image-b.png'],
      localRefVideos: ['/files/input/video-a.mp4'],
      localRefAudios: ['/files/input/audio-a.mp3'],
      localRefOrder: [
        { kind: 'video', url: '/files/input/video-a.mp4' },
        { kind: 'image', url: '/files/input/image-b.png' },
        { kind: 'audio', url: '/files/input/audio-a.mp3' },
        { kind: 'image', url: '/files/input/image-a.png' },
        { kind: 'image', url: '/files/input/missing.png' },
      ],
    } as any,
  ]);

  assert.deepEqual(buildDirectorStoryboardReferenceOrder(shot), [
    { kind: 'video', url: '/files/input/video-a.mp4' },
    { kind: 'image', url: '/files/input/image-b.png' },
    { kind: 'audio', url: '/files/input/audio-a.mp3' },
    { kind: 'image', url: '/files/input/image-a.png' },
  ]);

  const moved = reorderDirectorStoryboardReference(shot, 3, 0);

  assert.deepEqual(buildDirectorStoryboardReferenceOrder(moved), [
    { kind: 'image', url: '/files/input/image-a.png' },
    { kind: 'video', url: '/files/input/video-a.mp4' },
    { kind: 'image', url: '/files/input/image-b.png' },
    { kind: 'audio', url: '/files/input/audio-a.mp3' },
  ]);
  assert.deepEqual(moved.localRefImages, ['/files/input/image-a.png', '/files/input/image-b.png']);
  assert.deepEqual(moved.localRefVideos, ['/files/input/video-a.mp4']);
  assert.deepEqual(moved.localRefAudios, ['/files/input/audio-a.mp3']);
});

test('director storyboard can copy reusable input fields from another shot without result state', () => {
  const [source] = sanitizeDirectorStoryboardShots([
    {
      id: 's2',
      title: 'S2',
      durationSec: 9,
      prompt: 'copy this prompt',
      negativePrompt: 'avoid blur',
      frameMode: 'firstlast',
      promptMentions: [
        { kind: 'image', token: '@image1', materialKey: 'image:/files/input/ref.png', start: 5, end: 12 },
      ] as any,
      localRefImages: ['/files/input/ref-a.png', '/files/input/ref-b.png'],
      localRefVideos: ['/files/input/ref-v.mp4'],
      localRefAudios: ['/files/input/ref-a.mp3'],
      localRefOrder: [
        { kind: 'video', url: '/files/input/ref-v.mp4' },
        { kind: 'image', url: '/files/input/ref-b.png' },
        { kind: 'audio', url: '/files/input/ref-a.mp3' },
        { kind: 'image', url: '/files/input/ref-a.png' },
      ],
      status: 'success',
      taskId: 'task-s2',
      videoUrl: '/files/output/s2.mp4',
      error: 'old error',
    },
  ]);

  const patch = buildDirectorStoryboardShotInputPatch(source);

  assert.deepEqual(patch, {
    prompt: 'copy this prompt',
    negativePrompt: 'avoid blur',
    promptMentions: [
      { kind: 'image', token: '@image1', materialKey: 'image:/files/input/ref.png', start: 5, end: 12 },
    ],
    frameMode: 'firstlast',
    localRefImages: ['/files/input/ref-a.png', '/files/input/ref-b.png'],
    localRefVideos: ['/files/input/ref-v.mp4'],
    localRefAudios: ['/files/input/ref-a.mp3'],
    localRefOrder: [
      { kind: 'video', url: '/files/input/ref-v.mp4' },
      { kind: 'image', url: '/files/input/ref-b.png' },
      { kind: 'audio', url: '/files/input/ref-a.mp3' },
      { kind: 'image', url: '/files/input/ref-a.png' },
    ],
  });
  assert.equal('title' in patch, false);
  assert.equal('durationSec' in patch, false);
  assert.equal('status' in patch, false);
  assert.equal('taskId' in patch, false);
  assert.equal('videoUrl' in patch, false);
});

test('director storyboard bridge prompt presets include curated defaults and portable custom exports', () => {
  assert.equal(DIRECTOR_BRIDGE_PROMPT_PRESETS.length, 50);
  assert.equal(new Set(DIRECTOR_BRIDGE_PROMPT_PRESETS.map((preset) => preset.id)).size, 50);
  assert.ok(DIRECTOR_BRIDGE_PROMPT_PRESETS.every((preset) => preset.name && preset.text.length >= 16));

  const custom = sanitizeDirectorBridgePromptPresets([
    { id: 'smooth', name: '平滑转场', text: '镜头平滑衔接前后画面，主体动作自然延续。' },
    { id: 'smooth', name: '重复ID', text: '保持主体身份一致，光线和构图自然过渡。' },
    { id: '', name: '', text: '' },
  ]);

  assert.deepEqual(custom.map((preset) => preset.id), ['smooth', 'smooth-2']);
  const exported = createDirectorBridgePromptPresetExport(custom);
  assert.equal(exported.schema, 't8-director-bridge-prompt-presets');
  assert.equal(exported.version, 1);
  assert.deepEqual(parseDirectorBridgePromptPresetImport(JSON.stringify(exported)), custom);
  assert.throws(() => parseDirectorBridgePromptPresetImport('{bad json'), /不是有效/);
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

test('director storyboard can import image video and audio references from the resource library', () => {
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');

  assert.match(node, /import \* as api from '\.\.\/\.\.\/services\/api'/);
  assert.match(node, /openResourcePicker\('image'\)/);
  assert.match(node, /openResourcePicker\('video'\)/);
  assert.match(node, /openResourcePicker\('audio'\)/);
  assert.match(node, /api\.getResourceItems\(\{\s*kind:\s*resourcePickerKind/);
  assert.match(node, /appendRefs\(resourcePickerKind,\s*\[item\.fileUrl\]\)/);
  assert.match(node, /api\.updateResourceItem\(item\.id,\s*\{\s*touch:\s*true\s*\}\)/);
});

test('director storyboard exposes the same zhenzhen group binding addon used by SD2.0', () => {
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');

  assert.match(node, /import \{\s*LocalNodeAddonSlot\s*\} from 'virtual:t8-local-extensions'/);
  assert.match(node, /const providerParams = useMemo\(/);
  assert.match(node, /\(\) => \(\(d\?\.providerParams && typeof d\.providerParams === 'object'\) \? d\.providerParams : \{\}\)/);
  assert.match(node, /providerParams,/);
  assert.match(node, /<LocalNodeAddonSlot[\s\S]*nodeType="director-storyboard"[\s\S]*providerSource:\s*'zhenzhen'[\s\S]*providerKind:\s*'seedance'/);
});

test('director storyboard node keeps ports visible and makes timeline resizing draggable', () => {
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');
  const canvas = read('../src/components/Canvas.tsx');

  assert.match(node, /className=\{`relative w-\[460px\] overflow-visible/);
  assert.match(node, /className="director-storyboard-port[^"]*!h-4[^"]*!w-4/);
  assert.match(node, /data-director-timeline-resize-handle/);
  assert.match(canvas, /closest\('\[data-director-timeline-resize-handle\]'\)/);
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
  assert.match(node, /beginBridgeSeparatorInteraction/);
  assert.match(node, /onPointerDownCapture=\{\(event\) => beginBridgeSeparatorInteraction\(event, shot, bridge\.id\)\}/);
  assert.match(node, /onMouseDownCapture=\{\(event\) => beginBridgeSeparatorInteraction\(event, shot, bridge\.id\)\}/);
  assert.match(node, /setActiveBridgeId\(bridgeId\)/);
});

test('director storyboard bridge UI is edited per shot pair instead of a global generate-all switch', () => {
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');

  assert.match(node, /sanitizeDirectorStoryboardBridges/);
  assert.match(node, /buildDirectorStoryboardBridgeRunPlan/);
  assert.match(node, /runBridge/);
  assert.match(node, /const bridgePanelEnabled = d\.directorBridgePanelEnabled === true/);
  assert.match(node, /启用首尾帧桥接/);
  assert.match(node, /checked=\{bridgePanelEnabled\}/);
  assert.match(node, /directorBridgePanelEnabled: event\.target\.checked/);
  assert.match(node, /bridgeEnabled: event\.target\.checked/);
  assert.match(node, /bridgePanelEnabled &&/);
  assert.match(node, /桥接功能默认收起/);
  assert.match(node, /请先生成前后两个镜头视频/);
  assert.match(node, /上传前段视频/);
  assert.match(node, /上传后段视频/);
  assert.match(node, /上传首帧/);
  assert.match(node, /上传尾帧/);
  assert.match(node, /桥接预设 · LIST/);
  assert.match(node, /director-bridge-prompt-preset-select/);
  assert.match(node, /DIRECTOR_BRIDGE_PROMPT_PRESETS/);
  assert.match(node, /directorBridgePromptPresets/);
  assert.match(node, /applyBridgePromptPreset/);
  assert.match(node, /saveBridgePromptPreset/);
  assert.match(node, /exportBridgePromptPresets/);
  assert.match(node, /importBridgePromptPresets/);
  assert.doesNotMatch(node, /首尾帧桥接片段\s*默认关闭/);
  assert.doesNotMatch(node, /bridgeEnabled:\s*onlyShotId/);
});

test('director storyboard active shot can override global model ratio and resolution', () => {
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');

  assert.match(node, /镜头覆盖/);
  assert.match(node, /activeShot\.modelOverride \|\| ''/);
  assert.match(node, /activeShot\.ratioOverride \|\| ''/);
  assert.match(node, /activeShot\.resolutionOverride \|\| ''/);
  assert.match(node, /复用输入/);
  assert.match(node, /inputReuseSourceShotId/);
  assert.match(node, /applyInputReuseToActiveShot/);
  assert.match(node, /buildDirectorStoryboardShotInputPatch/);
  assert.match(node, /应用到当前分镜/);
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

test('buildDirectorStoryboardRunPlan never auto-submits bridge jobs during generate all', () => {
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

  const legacyBridgeEnabled = buildDirectorStoryboardRunPlan(shots, {
    ...base,
    bridgeEnabled: true,
    bridgeDurationSec: 4,
    bridgePrompt: 'smooth transition',
  });

  assert.deepEqual(legacyBridgeEnabled.map((job) => job.kind), ['shot', 'shot']);
  assert.ok(legacyBridgeEnabled.every((job) => job.id.startsWith('shot-')));
});

test('buildDirectorStoryboardRunPlan passes provider params through every Seedance job', () => {
  const providerParams = { zhenzhenGroup: 'gemini优质', tokenGroup: 'gemini优质' };
  const settings = {
    model: 'doubao-seedance-2-0-fast-260128',
    ratio: '16:9',
    resolution: '480p',
    generateAudio: true,
    returnLastFrame: false,
    watermark: false,
    webSearch: false,
    seed: -1,
    bridgeEnabled: true,
    bridgeDurationSec: 4,
    bridgePrompt: 'smooth transition',
    providerParams,
  };

  const shots = sanitizeDirectorStoryboardShots([
    { id: 's1', title: 'S1', durationSec: 5, prompt: 'first', localRefImages: ['a.png'] },
    { id: 's2', title: 'S2', durationSec: 6, prompt: 'second', localRefImages: ['b.png'] },
  ]);
  const plan = buildDirectorStoryboardRunPlan(shots, settings);

  assert.deepEqual(plan.map((job) => job.payload.providerParams), [providerParams, providerParams]);
});

test('director bridge run plan uses prepared first and last frames instead of shot reference images', async () => {
  const utils = await import('../src/utils/directorStoryboard.ts') as Record<string, any>;
  assert.equal(typeof utils.sanitizeDirectorStoryboardBridges, 'function');
  assert.equal(typeof utils.buildDirectorStoryboardBridgeRunPlan, 'function');

  const settings = {
    model: 'doubao-seedance-2-0-fast-260128',
    ratio: '16:9',
    resolution: '480p',
    generateAudio: true,
    returnLastFrame: false,
    watermark: false,
    webSearch: false,
    seed: -1,
    providerParams: { zhenzhenGroup: 'gemini优质' },
  };
  const shots = sanitizeDirectorStoryboardShots([
    {
      id: 's1',
      title: 'S1',
      durationSec: 5,
      prompt: 'shot A',
      localRefImages: ['/files/input/old-a.png'],
    },
    {
      id: 's2',
      title: 'S2',
      durationSec: 5,
      prompt: 'shot B',
      localRefImages: ['/files/input/old-b.png'],
    },
  ]);

  const bridges = utils.sanitizeDirectorStoryboardBridges([
    {
      id: 'b-s1-s2',
      fromShotId: 's1',
      toShotId: 's2',
      durationSec: 3,
      prompt: 'bridge through the same scene',
      firstFrameUrl: '/files/output/s1-tail.png',
      lastFrameUrl: '/files/output/s2-head.png',
    },
  ], shots);
  const plan = utils.buildDirectorStoryboardBridgeRunPlan(bridges, shots, settings);

  assert.deepEqual(plan.map((job: DirectorStoryboardJob) => job.kind), ['bridge']);
  assert.equal(plan[0].id, 'bridge-b-s1-s2');
  assert.equal(plan[0].order, 0.5);
  assert.equal(plan[0].payload.duration, 4);
  assert.equal(plan[0].payload.firstFrame, '/files/output/s1-tail.png');
  assert.equal(plan[0].payload.lastFrame, '/files/output/s2-head.png');
  assert.equal(plan[0].payload.prompt, 'bridge through the same scene');
  assert.deepEqual(plan[0].payload.providerParams, { zhenzhenGroup: 'gemini优质' });
});

test('seedance proxy reports detailed zhenzhen file-upload failures before task submission', () => {
  const proxy = read('../backend/src/routes/proxy.js');

  assert.match(proxy, /async function uploadRefToZhenzhen\(ref,\s*apiKey,\s*label = '参考素材'\)/);
  assert.match(proxy, /throw new Error\(`\$\{label\} 上传失败: \/v1\/files HTTP \$\{upR\.status\}/);
  assert.match(proxy, /uploadRefToZhenzhen\(a,\s*apiKey,\s*`reference_audio \$\{i \+ 1\}`\)/);
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

test('director storyboard output items keep each video paired with its own shot prompt in job order', () => {
  const jobs: DirectorStoryboardJob[] = [
    { id: 'shot-a', shotId: 'a', order: 0, kind: 'shot', title: 'S1', payload: { model: 'm', prompt: 'first prompt', duration: 5 } },
    { id: 'shot-b', shotId: 'b', order: 1, kind: 'shot', title: 'S2', payload: { model: 'm', prompt: 'second prompt', duration: 6 } },
    { id: 'shot-c', shotId: 'c', order: 2, kind: 'shot', title: 'S3', payload: { model: 'm', prompt: 'third prompt', duration: 7 } },
  ];

  const items = buildDirectorStoryboardOutputItems(jobs, {
    'shot-b': { status: 'success', videoUrl: 'video-b.mp4' },
    'shot-a': { status: 'success', videoUrl: 'video-a.mp4' },
    'shot-c': { status: 'error', error: 'failed' },
  });

  assert.deepEqual(items.map((item) => item.videoUrl), ['video-a.mp4', 'video-b.mp4']);
  assert.deepEqual(items.map((item) => item.title), ['分镜 1 · S1', '分镜 2 · S2']);
  assert.match(items[0].text, /分镜 1 · S1 · 5s/);
  assert.match(items[0].text, /first prompt/);
  assert.doesNotMatch(items[0].text, /second prompt/);
  assert.match(items[1].text, /分镜 2 · S2 · 6s/);
  assert.match(items[1].text, /second prompt/);

  const summary = buildDirectorStoryboardOutputSummary(items);
  assert.match(summary, /1\. 分镜 1 · S1 · 5s · first prompt -> video-a\.mp4/);
  assert.match(summary, /2\. 分镜 2 · S2 · 6s · second prompt -> video-b\.mp4/);

  const snapshot = buildDirectorStoryboardOutputNodeData(items[1]);
  assert.equal(snapshot.directOutputSingleSnapshot, true);
  assert.equal(snapshot.directVideoUrl, 'video-b.mp4');
  assert.deepEqual(snapshot.directVideoUrls, ['video-b.mp4']);
  assert.equal(snapshot.directOutputText, '分镜 2 · S2 · 6s\nsecond prompt');
  assert.deepEqual(snapshot.directTextSegments, ['分镜 2 · S2 · 6s\nsecond prompt']);
  assert.equal(snapshot.outputText, '');
});

test('director storyboard output node binding stays on the same shot when bridge items are inserted', () => {
  const shotJobs: DirectorStoryboardJob[] = [
    { id: 'shot-s1', shotId: 's1', order: 0, kind: 'shot', title: 'S1', payload: { model: 'm', prompt: 'first prompt', duration: 5 } },
    { id: 'shot-s2', shotId: 's2', order: 1, kind: 'shot', title: 'S2', payload: { model: 'm', prompt: 'second prompt', duration: 5 } },
    { id: 'shot-s3', shotId: 's3', order: 2, kind: 'shot', title: 'S3', payload: { model: 'm', prompt: 'third prompt', duration: 5 } },
  ];
  const shotResults = {
    'shot-s1': { status: 'success', videoUrl: 'shot-s1.mp4' },
    'shot-s2': { status: 'success', videoUrl: 'shot-s2.mp4' },
    'shot-s3': { status: 'success', videoUrl: 'shot-s3.mp4' },
  };
  const initialItems = buildDirectorStoryboardOutputItems(shotJobs, shotResults);
  const existingS2OutputData = {
    pickKind: 'video',
    pickIndex: 1,
    ...buildDirectorStoryboardOutputNodeData(initialItems[1]),
  };
  const bridgeJobs: DirectorStoryboardJob[] = [
    { id: 'bridge-s1-s2', shotId: 's1:s2', order: 0.5, kind: 'bridge', title: 'S1 → S2', payload: { model: 'm', prompt: 'bridge one', duration: 4 } },
    { id: 'bridge-s2-s3', shotId: 's2:s3', order: 1.5, kind: 'bridge', title: 'S2 → S3', payload: { model: 'm', prompt: 'bridge two', duration: 4 } },
  ];
  const expandedItems = buildDirectorStoryboardOutputItems([...shotJobs, ...bridgeJobs], {
    ...shotResults,
    'bridge-s1-s2': { status: 'success', videoUrl: 'bridge-s1-s2.mp4' },
    'bridge-s2-s3': { status: 'success', videoUrl: 'bridge-s2-s3.mp4' },
  });

  assert.equal(expandedItems[1].jobId, 'bridge-s1-s2');
  const matched = findDirectorStoryboardOutputItemForNodeData(expandedItems, existingS2OutputData, 1);

  assert.equal(matched?.jobId, 'shot-s2');
  assert.equal(matched?.videoUrl, 'shot-s2.mp4');
});

test('director storyboard auto output uses ordered videoUrls and skips standalone cumulative text nodes', () => {
  const canvas = read('../src/components/Canvas.tsx');
  const output = read('../src/components/nodes/OutputNode.tsx');
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');

  assert.match(canvas, /const suppressStandaloneTextOutputs = t === 'director-storyboard'/);
  assert.match(canvas, /if \(t === 'director-storyboard'\) \{[\s\S]*directorOutputItems\.length > 0[\s\S]*directorOutputItems\.forEach\(\(item: any\) => pushVid\(item\.videoUrl\)\)/);
  assert.match(canvas, /else if \(Array\.isArray\(d\.videoUrls\)\) d\.videoUrls\.forEach\(pushVid\)/);
  assert.match(canvas, /buildDirectorStoryboardOutputNodeData/);
  assert.match(canvas, /const directorOutputItems/);
  assert.match(canvas, /findDirectorStoryboardOutputItemForNodeData/);
  assert.match(canvas, /directorOutputItems\[item\.kindIndex\]/);
  assert.match(canvas, /outputDataForItem\(item\)/);
  assert.match(canvas, /const directorOutputRefreshNonce/);
  assert.match(canvas, /directorOutputRefreshNonce/);
  assert.match(canvas, /const outputSig/);
  assert.match(canvas, /if \(lastSig === outputSig\) continue/);
  assert.doesNotMatch(canvas, /lastSig === sig && t !== 'director-storyboard'/);
  assert.match(canvas, /let changed = false/);
  assert.match(canvas, /return changed \? next : prev/);
  assert.match(canvas, /t !== 'director-storyboard' && shouldPreserveAutoOutputMaterialNode/);
  assert.match(canvas, /data:\s*\{\s*\.\.\.\(nd\.data as any\),\s*\.\.\.p\s*\}/);
  assert.match(output, /directSnapshotOnly/);
  assert.match(output, /directOutputSingleSnapshot/);
  assert.match(output, /pickKind === 'video'[\s\S]*pairedText[\s\S]*out\.texts = pairedText \? \[pairedText\] : \[\]/);
  assert.match(node, /refreshStoryboardOutputs/);
  assert.match(node, /directorOutputRefreshNonce:\s*Date\.now\(\)/);
  assert.match(node, /重新获取/);
  assert.match(node, /buildDirectorStoryboardOutputItems/);
  assert.match(node, /data-director-reference-pool/);
  assert.match(node, /data-director-ref-index/);
  assert.match(node, /startReferenceReorder/);
  assert.match(node, /reorderDirectorStoryboardReference/);
  assert.doesNotMatch(node, /onDragStart=\{\(event: ReactDragEvent/);
});

test('director storyboard bridge generation is per-pair and refresh can recover completed task ids', () => {
  const node = read('../src/components/nodes/DirectorStoryboardNode.tsx');

  assert.doesNotMatch(node, /const runBridge = async \(bridgeId\?: string\) => \{\s*if \(isBusy\) return;/);
  assert.match(node, /const bridgeAbortRefs = useRef<Map<string, AbortController>>\(new Map\(\)\)/);
  assert.match(node, /const isBridgeBusy = \(bridge\?: DirectorStoryboardBridge \| null\)/);
  assert.match(node, /disabled=\{isActiveBridgeBusy\}/);
  assert.match(node, /bridgeAbortRefs\.current\.set\(bridgeIdFromJob, controller\)/);
  assert.match(node, /bridgeAbortRefs\.current\.forEach\(\(controller\) => controller\.abort\(\)\)/);
  assert.match(node, /const syncBridgeResultFromState = \(bridge: DirectorStoryboardBridge, job: DirectorStoryboardJob\): boolean =>/);
  assert.match(node, /const refreshStoryboardOutputs = async \(options: \{ bridgeId\?: string \} = \{\}\) =>/);
  assert.match(node, /const targetJobId = targetBridgeId \? `bridge-\$\{targetBridgeId\}` : ''/);
  assert.match(node, /syncBridgeResultFromState\(bridge, job\)/);
  assert.match(node, /querySeedance\(result\.taskId\)/);
  assert.match(node, /filter\(\(\[, result\]\) => result\?\.taskId && !result\.videoUrl\)/);
  assert.match(node, /patchBridge\(bridgeIdFromJob, \{ status: 'success', videoUrl: query\.videoUrl/);
  assert.match(node, /activeBridgeResult\.taskId[\s\S]*activeBridge\.taskId[\s\S]*activeBridgeResult\.videoUrl[\s\S]*activeBridge\.videoUrl/);
  assert.match(node, /const isActiveBridgeLocallyPolling = bridgeAbortRefs\.current\.has\(activeBridge\.id\)/);
  assert.match(node, /disabled=\{!canRefreshActiveBridgeOutput \|\| isActiveBridgeLocallyPolling\}/);
  assert.match(node, /refreshStoryboardOutputs\(\{ bridgeId: activeBridge\.id \}\)/);
  assert.match(node, /重新获取桥接/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const loadRhToolboxUtils = async () => import('../src/utils/rhToolbox.ts');
const loadRhToolboxCapabilities = async () => import('../src/utils/rhToolboxCapabilities.ts');
const loadRhToolboxManifest = async () => import('../src/data/rhToolboxManifest.ts');

test('RH toolbox node is registered as a visible executable RH node', () => {
  const registry = readFileSync(new URL('../src/config/nodeRegistry.ts', import.meta.url), 'utf8');
  const ports = readFileSync(new URL('../src/config/portTypes.ts', import.meta.url), 'utf8');
  const types = readFileSync(new URL('../src/types/canvas.ts', import.meta.url), 'utf8');
  const canvas = readFileSync(new URL('../src/components/Canvas.tsx', import.meta.url), 'utf8');
  const actionBar = readFileSync(new URL('../src/components/NodeActionBar.tsx', import.meta.url), 'utf8');
  const loop = readFileSync(new URL('../src/components/nodes/LoopNode.tsx', import.meta.url), 'utf8');

  assert.match(registry, /type:\s*'rh-toolbox'[\s\S]*label:\s*'RH工具箱'[\s\S]*category:\s*'rh'/);
  assert.match(ports, /'rh-toolbox':\s*\{\s*inputs:\s*\['text', 'image', 'video', 'audio'\],\s*outputs:\s*\['text', 'image', 'video', 'audio'\]\s*\}/);
  assert.match(types, /\|\s*'rh-toolbox'/);
  assert.match(canvas, /const RHToolboxNode = lazyCanvasNode\(\(\) => import\('\.\/nodes\/RHToolboxNode'\), 'RHToolboxNode'\)/);
  assert.match(canvas, /'rh-toolbox': RHToolboxNode/);
  assert.match(canvas, /'rh-toolbox':\s*\{/);
  assert.match(canvas, /'rh-tools', 'rh-toolbox'/);
  assert.match(actionBar, /'rh-tools', 'rh-toolbox'/);
  assert.match(loop, /'rh-tools', 'rh-toolbox'/);
});

test('RH toolbox manifest ships maintainer release tools for packaged users', async () => {
  const { RH_TOOLBOX_MANIFEST } = await loadRhToolboxManifest();
  const {
    buildRhToolboxNodeInfoList,
    buildRhToolboxQuickActions,
    filterRhToolboxTools,
    findRhToolboxToolById,
    getRhToolboxToolMajorCategory,
    isRhToolboxBuiltinCategoryId,
    listRhToolboxTools,
    normalizeRhToolboxManifest,
  } = await loadRhToolboxUtils();

  const manifest = normalizeRhToolboxManifest(RH_TOOLBOX_MANIFEST);

  assert.equal(manifest.schema, 't8-rh-toolbox-manifest');
  assert.equal(manifest.updatedAt, '2026-06-14');
  assert.equal(manifest.categories.length, 5);
  const categories = new Map(manifest.categories.map((category) => [category.id, category]));
  assert.deepEqual(
    ['custom-rh-tools', 'video-category-fwv2n', 'image-category-d5zwl', 'video-category-e2v4g', 'image-category-e78o2']
      .map((id) => [id, categories.get(id)?.name, categories.get(id)?.parentId]),
    [
      ['custom-rh-tools', '抠图', 'image'],
      ['video-category-fwv2n', '图生视频', 'video'],
      ['image-category-d5zwl', '图像编辑', 'image'],
      ['video-category-e2v4g', '文生视频', 'video'],
      ['image-category-e78o2', '电商', 'image'],
    ],
  );
  assert.equal(listRhToolboxTools(manifest).length, 5);
  assert.deepEqual(
    listRhToolboxTools(manifest).map((tool) => tool.id),
    ['image-cutout-v1', 'tuantiquv10', 'bernini1', 'berninituxiangbianji', 'bernini2'],
  );
  assert.equal(listRhToolboxTools(manifest, { includeDisabled: true }).length, 5);
  assert.equal(isRhToolboxBuiltinCategoryId('image-tools'), true);
  assert.equal(isRhToolboxBuiltinCategoryId('custom-rh-tools'), false);
  assert.equal(getRhToolboxToolMajorCategory(manifest.tools[0], manifest.categories), 'image');
  assert.deepEqual(
    filterRhToolboxTools(manifest, { majorCategoryId: 'video' }).map((tool) => tool.id),
    ['bernini1', 'bernini2'],
  );
  assert.deepEqual(
    filterRhToolboxTools(manifest, { capability: 'image.cutout' }).map((tool) => tool.id),
    ['image-cutout-v1', 'tuantiquv10'],
  );
  assert.deepEqual(
    new Set(buildRhToolboxQuickActions(manifest, 'image').map((action) => action.toolId)),
    new Set(['image-cutout-v1', 'tuantiquv10', 'berninituxiangbianji']),
  );
  assert.deepEqual(
    new Set(buildRhToolboxQuickActions(manifest, 'video').map((action) => action.toolId)),
    new Set(['bernini1', 'bernini2']),
  );

  const cutout = findRhToolboxToolById(manifest, 'image-cutout-v1');
  assert.equal(cutout?.title, '高清抠图');
  assert.equal(cutout?.webappId, '2066002530877927426');
  assert.equal(cutout?.inputSchema[0]?.rhNodeId, '46');
  assert.equal(cutout?.outputSchema[0]?.kind, 'image');

  const tuantiqu = findRhToolboxToolById(manifest, 'tuantiquv10');
  assert.equal(tuantiqu?.webappId, '2034251740148666369');
  const aspectRatio = tuantiqu?.userParams?.find((param) => param.key === 'node-22-aspect_ratio');
  assert.equal(aspectRatio?.kind, 'select');
  assert.ok((aspectRatio?.options?.length || 0) >= 10);
  assert.ok(aspectRatio?.options?.includes('16:9 landscape 1344x768'));
  assert.deepEqual(
    buildRhToolboxNodeInfoList(tuantiqu, {
      inputValues: { 'source-image': 'rh-uploaded-a.png' },
      userParamValues: { 'node-22-aspect_ratio': '16:9 landscape 1344x768' },
    }).filter((item) => (item.nodeId === '39' && item.fieldName === 'image') || item.fieldName === 'aspect_ratio'),
    [
      { nodeId: '39', fieldName: 'image', fieldValue: 'rh-uploaded-a.png', valueType: 'image' },
      { nodeId: '22', fieldName: 'aspect_ratio', fieldValue: '16:9 landscape 1344x768', valueType: 'select' },
    ],
  );

  const imageToVideo = findRhToolboxToolById(manifest, 'bernini1');
  assert.equal(imageToVideo?.webappId, '2064192352843034626');
  assert.equal(imageToVideo?.inputSchema.find((input) => input.kind === 'image')?.rhNodeId, '408');
  assert.equal(imageToVideo?.inputSchema.find((input) => input.kind === 'text')?.rhNodeId, '410');
  assert.equal(imageToVideo?.outputSchema[0]?.kind, 'video');

  const textToVideo = findRhToolboxToolById(manifest, 'bernini2');
  assert.equal(textToVideo?.webappId, '2064185875537420290');
  assert.equal(textToVideo?.inputSchema[0]?.rhNodeId, '210');
  assert.equal(textToVideo?.outputSchema[0]?.kind, 'video');
});

test('RH toolbox release manifest check is wired into packaging and post-build verification', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const distRelease = readFileSync(new URL('../scripts/dist-release.cjs', import.meta.url), 'utf8');
  const postBuild = readFileSync(new URL('../electron/_post_build.cjs', import.meta.url), 'utf8');
  const checker = readFileSync(new URL('../scripts/check-rh-toolbox-release.cjs', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['rh-toolbox:check'], 'node scripts/check-rh-toolbox-release.cjs');
  assert.match(distRelease, /RH toolbox release manifest check/);
  assert.match(distRelease, /rh-toolbox:check/);
  assert.ok(distRelease.indexOf('rh-toolbox:check') < distRelease.indexOf('prepack:enc'));

  assert.match(checker, /T8_RH_TOOLBOX_MIN_ENABLED/);
  assert.match(checker, /image-cutout-v1/);
  assert.match(checker, /tuantiquv10/);
  assert.match(checker, /bernini1/);
  assert.match(checker, /berninituxiangbianji/);
  assert.match(checker, /bernini2/);

  assert.match(postBuild, /checkRhToolboxReleaseManifest/);
  assert.match(postBuild, /image-cutout-v1/);
  assert.match(postBuild, /tuantiquv10/);
  assert.match(postBuild, /bernini1/);
});

test('RH toolbox image cutout is exposed as a reusable node capability', async () => {
  const { RH_TOOLBOX_MANIFEST } = await loadRhToolboxManifest();
  const {
    RH_IMAGE_CAPABILITY_PRESETS,
    buildRhToolboxCapabilityInputValues,
    resolveRhImageCapabilityPreset,
    resolveRhToolboxCapability,
  } = await loadRhToolboxCapabilities();
  const service = readFileSync(new URL('../src/services/rhToolboxCapabilities.ts', import.meta.url), 'utf8');
  const button = readFileSync(new URL('../src/components/RhImageCapabilityButton.tsx', import.meta.url), 'utf8');
  const uploadNode = readFileSync(new URL('../src/components/nodes/UploadNode.tsx', import.meta.url), 'utf8');
  const outputNode = readFileSync(new URL('../src/components/nodes/OutputNode.tsx', import.meta.url), 'utf8');
  const roadmap = readFileSync(new URL('../roadmap.md', import.meta.url), 'utf8');
  const skill = readFileSync(new URL('../skill.md', import.meta.url), 'utf8');

  const tool = resolveRhToolboxCapability(RH_TOOLBOX_MANIFEST, {
    surface: 'image',
    capability: 'image.cutout',
    preferredToolId: 'image-cutout-v1',
  });

  assert.equal(tool?.id, 'image-cutout-v1');
  assert.equal(tool?.title, '高清抠图');
  assert.deepEqual(
    buildRhToolboxCapabilityInputValues(tool, 'image', '/files/input/a.png'),
    { 'source-image': '/files/input/a.png' },
  );

  assert.equal(RH_IMAGE_CAPABILITY_PRESETS.cutout.capability, 'image.cutout');
  assert.equal(RH_IMAGE_CAPABILITY_PRESETS.cutout.preferredToolId, 'image-cutout-v1');
  assert.equal(RH_IMAGE_CAPABILITY_PRESETS.upscale.capability, 'image.upscale');
  assert.equal(RH_IMAGE_CAPABILITY_PRESETS.expand.capability, 'image.expand');
  assert.equal(resolveRhImageCapabilityPreset('cutout').label, '抠图');

  assert.match(service, /runRhImageCapability/);
  assert.match(service, /runRhImageCutout/);
  assert.match(service, /runRhImageCutoutBatch/);
  assert.match(service, /preferredToolId:\s*'image-cutout-v1'/);
  assert.match(service, /onItemProgress/);
  assert.match(service, /retryCount\?: number/);
  assert.match(service, /continueOnError\?: boolean/);
  assert.match(service, /failedItems/);
  assert.match(service, /cancelled/);
  assert.match(button, /data-rh-capability=\{capability\}/);
  assert.match(button, /sourceUrls\?: string\[\]/);
  assert.match(button, /preset\?:/);
  assert.match(button, /preferredToolId\?: string/);
  assert.match(button, /label\?: string/);
  assert.match(button, /RH_IMAGE_CAPABILITY_PRESETS/);
  assert.match(button, /runRhImageCapabilityBatch/);
  assert.doesNotMatch(button, /runRhImageCutoutBatch/);
  assert.match(button, /abortRef\.current\?\.abort\(\)/);
  assert.match(button, /data-rh-running=\{running \? 'true' : 'false'\}/);
  assert.match(button, /点击取消/);
  assert.match(button, /failedItems/);
  assert.match(uploadNode, /RhImageCapabilityButton/);
  assert.match(outputNode, /RhImageCapabilityButton/);
  assert.match(uploadNode, /const imageSourceUrls = useMemo/);
  assert.match(uploadNode, /sourceUrls=\{imageSourceUrls\}/);
  assert.match(outputNode, /sourceUrls=\{collected\.images\}/);
  assert.match(uploadNode, /onComplete=\{\(result\) => handleProduce\(result\.imageUrls\)\}/);
  assert.match(outputNode, /onComplete=\{\(result\) => handleProduce\(result\.imageUrls\)\}/);
  assert.match(roadmap, /RH 工具箱能力调度层/);
  assert.match(roadmap, /image\.cutout/);
  assert.match(roadmap, /多图串行队列/);
  assert.match(roadmap, /运行中再次点击可取消/);
  assert.match(roadmap, /部分成功/);
  assert.match(roadmap, /重试/);
  assert.match(skill, /RH 图像能力复用规范/);
  assert.match(skill, /image\.upscale/);
  assert.match(skill, /image\.expand/);
  assert.match(skill, /RhImageCapabilityButton[\s\S]*preset/);
  assert.match(skill, /runRhImageCapabilityBatch/);
});

test('RH toolbox builds nodeInfoList from configured mappings without per-tool code', async () => {
  const {
    buildRhToolboxNodeInfoList,
    classifyRhToolboxOutputs,
    getRhToolboxNodeInfoFieldOptions,
    inferRhToolboxUserParamsFromNodeInfoList,
    normalizeRhToolboxManifest,
    pickRhToolboxInputs,
  } = await loadRhToolboxUtils();

  const manifest = normalizeRhToolboxManifest({
    schema: 't8-rh-toolbox-manifest',
    version: 1,
    categories: [{ id: 'image-tools', name: '图像工具' }],
    tools: [
      {
        id: 'cutout',
        title: '抠图',
        categoryId: 'image-tools',
        webappId: '200000',
        enabled: true,
        capabilities: ['image.cutout'],
        inputSchema: [
          { key: 'image', kind: 'image', rhNodeId: '7', fieldName: 'image', required: true },
          { key: 'prompt', kind: 'text', rhNodeId: '30', fieldName: 'prompt', required: false },
        ],
        fixedParams: [{ rhNodeId: '31', fieldName: 'mode', value: 'transparent', valueType: 'text' }],
        userParams: [
          {
            key: 'strength',
            label: '强度',
            kind: 'number',
            rhNodeId: '32',
            fieldName: 'strength',
            defaultValue: 0.8,
          },
        ],
        outputSchema: [{ key: 'out', kind: 'image', role: 'replace-source' }],
      },
    ],
  });
  const tool = manifest.tools[0];

  const picked = pickRhToolboxInputs(tool, {
    images: ['/files/input/a.png'],
    texts: ['主体抠图'],
  });
  assert.equal(picked.missing.length, 0);

  const nodeInfoList = buildRhToolboxNodeInfoList(tool, {
    inputValues: { ...picked.values, image: 'rh-uploaded-a.png' },
    userParamValues: { strength: 0.6 },
  });

  assert.deepEqual(nodeInfoList, [
    { nodeId: '7', fieldName: 'image', fieldValue: 'rh-uploaded-a.png', valueType: 'image' },
    { nodeId: '30', fieldName: 'prompt', fieldValue: '主体抠图', valueType: 'text' },
    { nodeId: '32', fieldName: 'strength', fieldValue: 0.6, valueType: 'number' },
    { nodeId: '31', fieldName: 'mode', fieldValue: 'transparent', valueType: 'text' },
  ]);

  const inferredParams = inferRhToolboxUserParamsFromNodeInfoList([
    {
      nodeId: '390',
      nodeName: 'PrimitiveInt',
      fieldName: 'value',
      fieldValue: '129',
      fieldData: '["INT", {"max": 9223372036854775807, "min": -9223372036854775807, "control_after_generate": "fixed"}]',
      fieldType: 'INT',
      description: '总帧数',
      descriptionEn: 'Total frames',
    },
    {
      nodeId: '410',
      nodeName: 'Text',
      fieldName: 'text',
      fieldValue: '女人运球灌篮',
      fieldType: 'STRING',
      description: 'text',
    },
    {
      nodeId: '408',
      nodeName: 'LoadImage',
      fieldName: 'image',
      fieldValue: 'input.png',
      fieldType: 'IMAGE',
      description: 'image',
    },
    {
      nodeId: '417',
      nodeName: 'JWInteger',
      fieldName: 'value',
      fieldValue: '1280',
      fieldData: '["INT", {"max": 18446744073709551615, "min": -18446744073709551615, "default": 0}]',
      fieldType: 'INT',
      description: '最长边',
      descriptionEn: 'Longest side',
    },
  ], [
    { key: 'prompt', rhNodeId: '410', fieldName: 'text' },
    { key: 'source-image', rhNodeId: '408', fieldName: 'image' },
  ]);
  assert.deepEqual(
    inferredParams.map(({ key, label, kind, rhNodeId, fieldName, defaultValue }) => ({
      key,
      label,
      kind,
      rhNodeId,
      fieldName,
      defaultValue,
    })),
    [
      { key: 'node-390-value', label: '总帧数', kind: 'number', rhNodeId: '390', fieldName: 'value', defaultValue: 129 },
      { key: 'node-417-value', label: '最长边', kind: 'number', rhNodeId: '417', fieldName: 'value', defaultValue: 1280 },
    ],
  );

  const inferredSelectParams = inferRhToolboxUserParamsFromNodeInfoList([
    {
      nodeId: '22',
      nodeName: 'Text',
      fieldName: 'aspect_ratio',
      fieldValue: 'custom',
      fieldType: 'TEXT',
      description: '比例选择/自定义',
    },
    {
      nodeId: '24',
      nodeName: 'Combo',
      fieldName: 'quality',
      fieldValue: 'high',
      fieldData: ['low', 'medium', 'high'],
      fieldType: 'TEXT',
      description: '质量',
    },
  ]);
  assert.equal(inferredSelectParams[0].kind, 'select');
  assert.deepEqual(inferredSelectParams[0].options?.slice(0, 4), ['1:1', '16:9', '9:16', '4:3']);
  assert.equal(inferredSelectParams[1].kind, 'select');
  assert.deepEqual(inferredSelectParams[1].options, ['low', 'medium', 'high']);
  assert.deepEqual(
    getRhToolboxNodeInfoFieldOptions({ fieldName: 'instanceType', fieldValue: 'plus', fieldType: 'TEXT' }),
    ['default', 'plus', 'pro'],
  );

  assert.deepEqual(
    buildRhToolboxNodeInfoList({ ...tool, userParams: inferredParams }, { inputValues: {}, userParamValues: {} })
      .filter((item) => item.nodeId === '390' || item.nodeId === '417'),
    [
      { nodeId: '390', fieldName: 'value', fieldValue: 129, valueType: 'number' },
      { nodeId: '417', fieldName: 'value', fieldValue: 1280, valueType: 'number' },
    ],
  );

  assert.deepEqual(classifyRhToolboxOutputs(['/files/output/a.png', '/files/output/b.mp4', '/files/output/c.wav']).imageUrls, ['/files/output/a.png']);
  assert.deepEqual(classifyRhToolboxOutputs(['/files/output/a.png', '/files/output/b.mp4', '/files/output/c.wav']).videoUrls, ['/files/output/b.mp4']);
  assert.deepEqual(classifyRhToolboxOutputs(['/files/output/a.png', '/files/output/b.mp4', '/files/output/c.wav']).audioUrls, ['/files/output/c.wav']);
});

test('RH toolbox service exposes a single callable runner for future quick actions', () => {
  const service = readFileSync(new URL('../src/services/rhToolbox.ts', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/nodes/RHToolboxNode.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8');

  assert.match(service, /export async function runRhToolboxTool/);
  assert.match(service, /uploadRhAsset/);
  assert.match(service, /submitRh/);
  assert.match(service, /queryRh/);
  assert.match(component, /runRhToolboxTool/);
  assert.match(component, /MentionPromptInput/);
  assert.match(component, /rhToolboxTextInputs/);
  assert.match(component, /hasTextInputValue/);
  assert.match(component, /input\.defaultValue == null \? '' : String\(input\.defaultValue\)/);
  assert.match(component, /defaultTextInputs/);
  assert.match(component, /prompt:\s*defaultPrompt/);
  assert.match(component, /hoveredToolId/);
  assert.match(component, /previewTool/);
  assert.match(component, /onMouseEnter=\{\(\) => setHoveredToolId\(tool\.id\)\}/);
  assert.match(component, /悬停工具查看说明/);
  assert.match(component, /previewTool\.description/);
  assert.match(component, /rhToolboxLocalInputs/);
  assert.match(component, /inputValues:\s*explicitInputValues/);
  assert.match(component, /素材输入/);
  assert.match(component, /opacity-0 transition-opacity group-hover:opacity-100/);
  assert.match(component, /RH_TOOLBOX_MAJOR_CATEGORIES/);
  assert.match(component, /rhToolboxMajorCategoryId/);
  assert.match(component, /notifyRhToolboxDeveloperToolEdit/);
  assert.match(component, /rh-toolbox-app-grid grid grid-cols-1 gap-2/);
  assert.match(component, /rh-toolbox-app-button/);
  assert.match(component, /rh-toolbox-app-title/);
  assert.match(component, /rh-toolbox-app-edit-button/);
  assert.match(component, /isRhToolboxBuiltinCategoryId/);
  assert.match(component, /visibleCategoryId/);
  assert.match(styles, /\.rh-toolbox-app-grid button\.rh-toolbox-app-button/);
  assert.match(styles, /-webkit-line-clamp:\s*2 !important/);
  assert.match(styles, /box-shadow:\s*none !important/);
  assert.match(styles, /border-radius:\s*6px !important/);
  assert.match(component, /status !== 'idle'/);
  assert.doesNotMatch(component, /buildRhToolboxQuickActions/);
  assert.doesNotMatch(component, /快捷接入位/);
  assert.doesNotMatch(component, /toolCategory\?\.name \|\| tool\.categoryId/);
  assert.doesNotMatch(component, /title=\{\`\$\{tool\.title\}\$\{toolCategory/);
  assert.match(component, /MaterialPreviewSection/);
  assert.match(service, /inputValues\?: Record<string, string \| string\[\]>/);
  assert.match(service, /缺少输入/);
  assert.match(component, /fetchRhAppInfo/);
  assert.match(component, /inferRhToolboxUserParamsFromNodeInfoList/);
  assert.doesNotMatch(component, /NodeList 映射/);
  assert.doesNotMatch(component, /mappedNodeListRows/);
  assert.match(component, /manifest:\s*runManifest/);
});

test('RH toolbox display config follows theme and does not expose per-tool color or button labels', () => {
  const utils = readFileSync(new URL('../src/utils/rhToolbox.ts', import.meta.url), 'utf8');
  const manifest = readFileSync(new URL('../src/data/rhToolboxManifest.ts', import.meta.url), 'utf8');
  const node = readFileSync(new URL('../src/components/nodes/RHToolboxNode.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(utils, /quickActionLabel\?:/);
  assert.doesNotMatch(utils, /accent\?: string/);
  assert.doesNotMatch(utils, /raw\.ui\.accent/);
  assert.doesNotMatch(utils, /raw\.ui\.quickActionLabel/);
  assert.match(utils, /label:\s*tool\.title/);
  assert.doesNotMatch(manifest, /quickActionLabel/);
  assert.doesNotMatch(manifest, /accent:\s*['"]/);
  assert.match(node, /const accent = isPixel \? 'var\(--px-ink\)' : isLight \? '#0891b2' : '#67e8f9'/);
  assert.doesNotMatch(node, /activeTool\?\.ui\?\.accent/);
});

test('RH toolbox runtime can consume private maker events without shipping maker source', () => {
  const node = readFileSync(new URL('../src/components/nodes/RHToolboxNode.tsx', import.meta.url), 'utf8');

  assert.match(node, /const RH_TOOLBOX_DEVELOPER_MODULE = '\.\.\/\.\.\/utils\/rhToolboxDeveloper'/);
  assert.match(node, /import\(\/\* @vite-ignore \*\/ RH_TOOLBOX_DEVELOPER_MODULE\)/);
  assert.match(node, /penguin:rh-toolbox-manifest-updated/);
  assert.match(node, /detail\?\.kind === 'tool-saved'/);
  assert.match(node, /mergeRhToolboxManifestWithDeveloperDrafts\(base, detail\?\.manifest\)/);
  assert.match(node, /window\.setInterval\(\(\) => refreshManifest\(\), 1500\)/);
  assert.match(node, /当前 manifest 有 \{allTools\.length\} 个工具/);
  assert.match(node, /rhToolboxSearchQuery:\s*''/);
  assert.match(node, /rhToolboxCategoryId:\s*RH_TOOLBOX_ALL_CATEGORY_ID/);
  assert.match(node, /rhToolboxActiveToolId:\s*nextTool && nextTool\.enabled !== false/);
});

test('RH toolbox maker is dev-only and guarded from packaged builds', () => {
  const registry = readFileSync(new URL('../src/config/nodeRegistry.ts', import.meta.url), 'utf8');
  const canvas = readFileSync(new URL('../src/components/Canvas.tsx', import.meta.url), 'utf8');
  const ports = readFileSync(new URL('../src/config/portTypes.ts', import.meta.url), 'utf8');
  const postBuild = readFileSync(new URL('../electron/_post_build.cjs', import.meta.url), 'utf8');
  const publicCheck = readFileSync(new URL('../scripts/check-public-clean.cjs', import.meta.url), 'utf8');
  const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  const features = readFileSync(new URL('../features.json', import.meta.url), 'utf8');

  assert.match(registry, /import\.meta\.env\?\.DEV[\s\S]*type:\s*'rh-toolbox-maker'[\s\S]*label:\s*'RH工具箱制作器'/);
  assert.match(canvas, /const RH_TOOLBOX_MAKER_MODULE = '\.\/nodes\/RHToolboxMakerNode'/);
  assert.match(canvas, /lazyCanvasNode\(\(\) => import\(\/\* @vite-ignore \*\/ RH_TOOLBOX_MAKER_MODULE\), 'RHToolboxMakerNode'\)/);
  assert.match(canvas, /import\.meta\.env\?\.DEV \? \{ 'rh-toolbox-maker': RHToolboxMakerNode \} : \{\}/);
  assert.match(ports, /import\.meta\.env\?\.DEV[\s\S]*'rh-toolbox-maker':\s*\{\s*inputs:\s*\[\],\s*outputs:\s*\['text'\]\s*\}/);
  assert.match(postBuild, /checkNoRhToolboxMaker/);
  assert.match(postBuild, /RHToolboxMakerNode/);
  assert.match(postBuild, /RH工具箱制作器/);
  assert.match(publicCheck, /src\/components\/nodes\/RHToolboxMakerNode\.tsx/);
  assert.match(publicCheck, /src\/utils\/rhToolboxDeveloper\.ts/);
  assert.match(gitignore, /\/src\/components\/nodes\/RHToolboxMakerNode\.tsx/);
  assert.match(gitignore, /\/src\/utils\/rhToolboxDeveloper\.ts/);
  assert.match(features, /RH工具箱制作器/);
});

test('RH toolbox maker rebuilds mappings from the current WebApp snapshot', () => {
  const maker = readFileSync(new URL('../src/components/nodes/RHToolboxMakerNode.tsx', import.meta.url), 'utf8');

  assert.match(maker, /getRhToolboxNodeInfoFieldOptions/);
  assert.match(maker, /function fieldOptionsText/);
  assert.match(maker, /optionsText:\s*kind === 'select' \? fieldOptionsText\(field\) : ''/);
  assert.match(maker, /function mappingSignature/);
  assert.match(maker, /currentInputs\.filter\(\(row\) => fieldKeys\.has\(mappingSignature\(row\)\) \|\| isDefaultInputPlaceholder\(row\)\)/);
  assert.match(maker, /currentParams\.filter\(\(row\) => fieldKeys\.has\(mappingSignature\(row\)\)\)/);
  assert.match(maker, /buildAutoMappingsFromFields\(fields,\s*\[\],\s*\[\],\s*\{\s*replaceExisting:\s*true\s*\}\)/);
  assert.match(maker, /requestedWebappId:\s*webappId/);
  assert.match(maker, /rhToolboxMakerFixedParams:\s*\[\]/);
  assert.match(maker, /rhToolboxMakerWebappId:\s*value[\s\S]*rhToolboxMakerAppInfo:\s*undefined[\s\S]*rhToolboxMakerInputs:\s*\[\][\s\S]*rhToolboxMakerUserParams:\s*\[\][\s\S]*rhToolboxMakerFixedParams:\s*\[\]/);
  assert.match(maker, /const mappingsChanged = Boolean\(autoMappings\.addedInputs \|\| autoMappings\.addedParams\)[\s\S]*autoMappings\.inputs\.length !== inputs\.length[\s\S]*autoMappings\.params\.length !== params\.length/);
});

test('RH toolbox maker keeps each draft tool category independent', () => {
  const maker = readFileSync(new URL('../src/components/nodes/RHToolboxMakerNode.tsx', import.meta.url), 'utf8');

  assert.match(maker, /function buildUniqueCategoryId/);
  assert.match(maker, /compactTextHash\(`\$\{majorId\}:\$\{name\}`\)/);
  assert.doesNotMatch(maker, /cleanId\(category\?\.id \|\| newCategoryId \|\| name, 'custom-rh-tools'\)/);
  assert.match(maker, /const categoryId = category[\s\S]*buildUniqueCategoryId\(newCategoryId, name, parentId, categories\)/);
  assert.match(maker, /const patchDraftTool = \(draft: RhToolboxTool, patch: Partial<RhToolboxTool>/);
  assert.match(maker, /saveRhToolboxDeveloperTool\(nextTool, categories\)/);
  assert.match(maker, /const firstSubcategory = customCategories\.find\(\(category\) => getRhToolboxCategoryMajorId\(category\) === nextMajorId\)/);
  assert.match(maker, /保存时按该小类入库/);
  assert.match(maker, /onChange=\{\(event\) => patchDraftTool\(draft, \{ categoryId: event\.target\.value \}/);
  assert.match(maker, /保存名称/);
});

test('RH toolbox maker saves a per-tool default instance type', () => {
  const maker = readFileSync(new URL('../src/components/nodes/RHToolboxMakerNode.tsx', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('../src/components/nodes/RHToolboxNode.tsx', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/services/rhToolbox.ts', import.meta.url), 'utf8');

  assert.match(maker, /instanceType:\s*cleanText\(data\.rhToolboxMakerInstanceType\)/);
  assert.match(maker, /rhToolboxMakerInstanceType:\s*tool\.runtime\?\.instanceType \|\| ''/);
  assert.match(maker, /value=\{d\.rhToolboxMakerInstanceType \|\| ''\}/);
  assert.match(maker, /updateData\(\{ rhToolboxMakerInstanceType: event\.target\.value \}\)/);
  assert.match(maker, /保存后该应用默认使用所选实例/);
  assert.match(maker, /<option value="">默认<\/option>/);
  assert.match(maker, /<option value="plus">plus<\/option>/);
  assert.match(maker, /<option value="pro">pro<\/option>/);
  assert.match(runtime, /instanceType:\s*tool\.runtime\?\.instanceType \|\| ''/);
  assert.match(runtime, /getRhToolboxNodeInfoFieldOptions\(matchedField\)/);
  assert.match(runtime, /shouldPatchOptions/);
  assert.match(service, /instanceType:\s*options\.instanceType \|\| tool\.runtime\?\.instanceType \|\| undefined/);
});

test('RH toolbox developer save persists the selected custom category with each tool', () => {
  const developer = readFileSync(new URL('../src/utils/rhToolboxDeveloper.ts', import.meta.url), 'utf8');

  assert.match(developer, /isRhToolboxBuiltinCategoryId/);
  assert.match(developer, /for \(const category of incoming\.categories\)/);
  assert.match(developer, /category\.id === normalizedTool\.categoryId/);
  assert.match(developer, /categoryMap\.set\(category\.id, category\)/);
});

test('RH toolbox developer helpers stay private and runtime uses guarded imports', () => {
  const service = readFileSync(new URL('../src/services/rhToolbox.ts', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/nodes/RHToolboxNode.tsx', import.meta.url), 'utf8');
  const publicCheck = readFileSync(new URL('../scripts/check-public-clean.cjs', import.meta.url), 'utf8');

  assert.doesNotMatch(service, /RH_TOOLBOX_DEVELOPER_STORAGE_KEY|mergeRhToolboxManifestWithDeveloperDrafts/);
  assert.match(component, /if \(!import\.meta\.env\.DEV\)/);
  assert.match(component, /RH_TOOLBOX_DEVELOPER_MODULE/);
  assert.match(component, /@vite-ignore/);
  assert.match(publicCheck, /src\/utils\/rhToolboxDeveloper\.ts/);
});

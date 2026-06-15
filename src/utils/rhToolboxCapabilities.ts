import {
  findRhToolboxToolById,
  getRhToolboxToolMajorCategory,
  listRhToolboxTools,
  normalizeRhToolboxManifest,
  type RhToolboxManifest,
  type RhToolboxMediaKind,
  type RhToolboxQuickSurface,
  type RhToolboxTool,
} from './rhToolbox.ts';

export interface RhToolboxCapabilityRequest {
  surface: RhToolboxQuickSurface;
  capability: string;
  preferredToolId?: string;
  includeDisabled?: boolean;
}

export interface RhImageCapabilityPreset {
  id: string;
  label: string;
  capability: string;
  title: string;
  preferredToolId?: string;
  icon?: 'scissors' | 'sparkles' | 'expand';
}

export const RH_IMAGE_CAPABILITY_PRESETS = {
  cutout: {
    id: 'cutout',
    label: '抠图',
    title: '调用 RH工具箱 高清抠图，并把结果输出为新素材节点',
    capability: 'image.cutout',
    preferredToolId: 'image-cutout-v1',
    icon: 'scissors',
  },
  upscale: {
    id: 'upscale',
    label: '高清化',
    title: '调用 RH工具箱 图像高清化，并把结果输出为新素材节点',
    capability: 'image.upscale',
    icon: 'sparkles',
  },
  expand: {
    id: 'expand',
    label: '扩图',
    title: '调用 RH工具箱 扩图能力，并把结果输出为新素材节点',
    capability: 'image.expand',
    icon: 'expand',
  },
} as const satisfies Record<string, RhImageCapabilityPreset>;

export type RhImageCapabilityPresetId = keyof typeof RH_IMAGE_CAPABILITY_PRESETS;

const SURFACE_UI_FLAGS: Record<RhToolboxQuickSurface, keyof NonNullable<RhToolboxTool['ui']>> = {
  image: 'showInImageEditor',
  video: 'showInVideoEditor',
  text: 'showInTextEditor',
  audio: 'showInAudioEditor',
};

function isToolEnabled(tool: RhToolboxTool): boolean {
  return tool.enabled !== false && String(tool.webappId || '').trim() !== '';
}

function supportsSurface(tool: RhToolboxTool, manifest: RhToolboxManifest, surface: RhToolboxQuickSurface): boolean {
  const uiFlag = SURFACE_UI_FLAGS[surface];
  return (
    tool.ui?.[uiFlag] === true ||
    getRhToolboxToolMajorCategory(tool, manifest.categories) === surface ||
    tool.capabilities.some((capability) => capability.startsWith(`${surface}.`)) ||
    tool.inputSchema.some((input) => input.kind === surface) ||
    tool.outputSchema.some((output) => output.kind === surface)
  );
}

function capabilityRank(tool: RhToolboxTool, request: RhToolboxCapabilityRequest): number {
  let score = 0;
  if (tool.id === request.preferredToolId) score += 1000;
  if (tool.capabilities.includes(request.capability)) score += 100;
  if (tool.ui?.[SURFACE_UI_FLAGS[request.surface]] === true) score += 10;
  if (isToolEnabled(tool)) score += 1;
  return score;
}

export function resolveRhToolboxCapability(
  manifestInput: Partial<RhToolboxManifest> | null | undefined,
  request: RhToolboxCapabilityRequest,
): RhToolboxTool | undefined {
  const manifest = normalizeRhToolboxManifest(manifestInput);
  if (request.preferredToolId) {
    const preferred = findRhToolboxToolById(manifest, request.preferredToolId);
    if (
      preferred &&
      preferred.capabilities.includes(request.capability) &&
      supportsSurface(preferred, manifest, request.surface) &&
      (request.includeDisabled || isToolEnabled(preferred))
    ) {
      return preferred;
    }
  }

  return listRhToolboxTools(manifest, { includeDisabled: request.includeDisabled })
    .filter((tool) => tool.capabilities.includes(request.capability))
    .filter((tool) => supportsSurface(tool, manifest, request.surface))
    .filter((tool) => request.includeDisabled || isToolEnabled(tool))
    .sort((a, b) => (
      capabilityRank(b, request) - capabilityRank(a, request) ||
      (a.order || 0) - (b.order || 0) ||
      a.title.localeCompare(b.title, 'zh-Hans-CN')
    ))[0];
}

export function resolveRhImageCapabilityPreset(
  preset: RhImageCapabilityPresetId | RhImageCapabilityPreset | string | null | undefined,
): RhImageCapabilityPreset {
  if (!preset) return RH_IMAGE_CAPABILITY_PRESETS.cutout;
  if (typeof preset === 'string') {
    const known = (RH_IMAGE_CAPABILITY_PRESETS as Record<string, RhImageCapabilityPreset>)[preset];
    if (known) return known;
    return {
      id: preset,
      label: preset,
      title: `调用 RH工具箱 ${preset}`,
      capability: preset,
    };
  }
  return preset;
}

export function buildRhToolboxCapabilityInputValues(
  tool: RhToolboxTool | null | undefined,
  sourceKind: RhToolboxMediaKind,
  sourceUrl: string,
): Record<string, string | string[]> {
  if (!tool) throw new Error('未找到可用的 RH 工具箱能力');
  const cleanUrl = String(sourceUrl || '').trim();
  if (!cleanUrl) throw new Error('缺少要处理的素材');
  const input =
    tool.inputSchema.find((item) => item.kind === sourceKind && item.required !== false) ||
    tool.inputSchema.find((item) => item.kind === sourceKind);
  if (!input) throw new Error(`${tool.title} 不支持 ${sourceKind} 输入`);
  return {
    [input.key]: input.multiple ? [cleanUrl] : cleanUrl,
  };
}

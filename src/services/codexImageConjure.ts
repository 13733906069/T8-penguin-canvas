import {
  streamCodexCliAgent,
  type CodexAgentArtifact,
  type CodexCliPayload,
  type CodexCliResult,
  type CodexStreamEvent,
} from './codexCli.ts';

export interface CodexImageConjurePayload extends CodexCliPayload {
  prompt: string;
  size?: string;
  aspectRatio?: string;
  quality?: string;
  count?: number;
}

export interface CodexImageConjureResult extends CodexCliResult {
  imageUrl: string;
  imageUrls: string[];
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function artifactUrls(artifact: CodexAgentArtifact): string[] {
  if (!artifact || artifact.kind !== 'image') return [];
  if (Array.isArray(artifact.urls)) return artifact.urls.filter(Boolean);
  return artifact.url ? [artifact.url] : [];
}

export function collectCodexImageConjureUrls(result: CodexCliResult): string[] {
  const urls = [
    ...(Array.isArray(result.imageUrls) ? result.imageUrls : []),
    ...(result.imageUrl ? [result.imageUrl] : []),
    ...(Array.isArray(result.artifacts) ? result.artifacts.flatMap(artifactUrls) : []),
  ];
  return uniqueStrings(urls);
}

export function publishCodexImageConjureResult(
  result: CodexCliResult,
  options: { maxImages?: number; includeText?: boolean } = {},
) {
  const maxImages = Number.isFinite(options.maxImages)
    ? Math.max(1, Math.floor(Number(options.maxImages)))
    : Infinity;
  const imageUrls = collectCodexImageConjureUrls(result).slice(0, maxImages);
  return {
    ...result,
    imageUrl: imageUrls[0] || '',
    imageUrls,
    outputText: options.includeText === false ? '' : String(result.text || result.reply || '').trim(),
  };
}

export async function streamCodexImageConjure(
  payload: CodexImageConjurePayload,
  options: {
    signal?: AbortSignal;
    onDelta?: (delta: string, event?: CodexStreamEvent) => void;
    onEvent?: (event: CodexStreamEvent) => void;
  } = {},
): Promise<CodexImageConjureResult> {
  const selectedSkillNames = uniqueStrings(['imagegen', ...(payload.selectedSkillNames || [])]);
  const settings = [
    payload.size ? `尺寸: ${payload.size}` : '',
    payload.aspectRatio ? `比例: ${payload.aspectRatio}` : '',
    payload.quality ? `质量: ${payload.quality}` : '',
    payload.count ? `数量: ${payload.count}` : '',
  ].filter(Boolean).join('\n');
  const prompt = [
    String(payload.prompt || '').trim(),
    settings ? `\n输出设置:\n${settings}` : '',
    '请直接生成图像产物。若需要解释，仅在最终结果后简短说明，不要把思考过程保存为产物。',
  ].filter(Boolean).join('\n\n');

  const result = await streamCodexCliAgent(
    {
      ...payload,
      mode: 'image',
      command: 'image',
      preset: payload.preset || 'Codex 生图工作台',
      prompt,
      selectedSkillNames: [
        ...selectedSkillNames,
      ],
      imageGeneration: true,
      videos: [],
      audios: [],
    },
    options,
  );
  const published = publishCodexImageConjureResult(result, { maxImages: payload.count });
  if (!published.imageUrls.length) {
    throw new Error('Codex 没有返回图片产物，请确认当前 Codex CLI 支持 image_generation feature，或改用普通 Codex Agent 输出提示词。');
  }
  return published as CodexImageConjureResult;
}

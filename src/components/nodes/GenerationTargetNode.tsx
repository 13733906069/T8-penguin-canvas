import { memo, useMemo, useState } from 'react';
import { Handle, Position, useNodeConnections, useNodesData, useReactFlow, type Node, type NodeProps } from '@xyflow/react';
import { ImagePlus, Loader2, ScanLine, Sparkles } from 'lucide-react';
import { generateImage } from '../../services/generation';
import { logBus } from '../../stores/logs';
import {
  CREATIVE_TARGET_NODE_TYPE,
  buildCreativeTargetResult,
  collectCanvasSelectionSummary,
} from '../../utils/canvasCreativeWorkflow';
import { getMediaItemsFromData } from '../../utils/mediaCollection';
import { useUpdateNodeData } from './useUpdateNodeData';

function textFromData(data: any): string {
  return String(
    data?.prompt ||
      data?.text ||
      data?.directOutputText ||
      data?.outputText ||
      data?.resultText ||
      '',
  ).trim();
}

function urlsFromNodes(nodes: Array<{ data?: any }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const node of nodes) {
    for (const item of getMediaItemsFromData(node.data, 'image')) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      out.push(item.url);
    }
  }
  return out.slice(0, 8);
}

function selectedNodesForTarget(targetId: string, nodes: Node[]) {
  return nodes.filter((node) => node.selected && node.id !== targetId);
}

const GenerationTargetNode = ({ id, data, selected }: NodeProps) => {
  const d = (data as any) || {};
  const rf = useReactFlow();
  const update = useUpdateNodeData(id);
  const creativeTargetId = id;
  const [busyMode, setBusyMode] = useState<'replace' | 'keep-version' | null>(null);
  const connections = useNodeConnections({ handleType: 'target' });
  const upstreamNodeData = useNodesData(connections.map((connection) => connection.source));
  const upstreamNodes = useMemo(
    () => upstreamNodeData.map((item) => ({ id: item.id, data: item.data })),
    [upstreamNodeData],
  );
  const upstreamPrompt = useMemo(
    () => upstreamNodes.map((node) => textFromData(node.data)).filter(Boolean).join('\n\n'),
    [upstreamNodes],
  );
  const upstreamImages = useMemo(() => urlsFromNodes(upstreamNodes), [upstreamNodes]);
  const prompt = String(d.prompt || upstreamPrompt || '').trim();
  const resultUrl = String(d.resultUrl || '').trim();
  const aspectRatio = String(d.aspectRatio || '1:1');
  const sizeLevel = String(d.sizeLevel || '1K');
  const status = String(d.status || 'idle');
  const isBusy = status === 'generating' || !!busyMode;

  const run = async (mode: 'replace' | 'keep-version') => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      update({ status: 'failed', error: '请先输入提示词，或把文本节点连接到目标框。' });
      return;
    }
    setBusyMode(mode);
    update({ status: 'generating', error: '', prompt: finalPrompt });
    try {
      const selectedSummary = collectCanvasSelectionSummary(selectedNodesForTarget(id, rf.getNodes()), {
        viewportAnchor: rf.getNode(id)?.position,
      });
      const result = await generateImage({
        model: d.model || 'gpt-image-2',
        apiModel: d.apiModel || d.model || 'gpt-image-2',
        prompt: finalPrompt,
        aspectRatio,
        aspect_ratio: aspectRatio,
        sizeLevel,
        image_size: sizeLevel,
        images: upstreamImages.length > 0 ? upstreamImages : selectedSummary.images.map((item) => item.url),
        n: 1,
      });
      const urls = Array.isArray(result.urls) ? result.urls.filter(Boolean) : [];
      if (urls.length === 0) throw new Error('生成完成但没有返回图片');
      const target = rf.getNode(id) || ({
        id: creativeTargetId,
        type: CREATIVE_TARGET_NODE_TYPE,
        position: { x: 0, y: 0 },
        data: d,
      } as Node);
      const built = buildCreativeTargetResult(target, urls, {
        mode,
        sourceNodeIds: [...upstreamNodes.map((node) => node.id), ...selectedSummary.selectedNodeIds],
        prompt: finalPrompt,
      });
      rf.setNodes((prev) => {
        const patched = prev.map((node) =>
          node.id === id
            ? { ...node, data: { ...(node.data as any), ...built.targetPatch } }
            : { ...node, selected: built.outputNode ? false : node.selected }
        );
        return built.outputNode ? [...patched, built.outputNode] : patched;
      });
      logBus.success(mode === 'replace' ? '已替换到生成目标框内' : '已在目标框右侧保留一个新版本', '生成目标框');
    } catch (error: any) {
      const message = error?.message || '生成失败';
      update({ status: 'failed', error: message });
      logBus.error(message, '生成目标框');
    } finally {
      setBusyMode(null);
    }
  };

  return (
    <div
      className={`t8-generation-target-node nodrag rounded-xl border p-3 shadow-lg ${selected ? 'is-selected' : ''}`}
      data-target-status={status}
      data-has-result={resultUrl ? 'true' : 'false'}
    >
      <Handle type="target" position={Position.Left} className="!bg-teal-400 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-teal-400 !border-0" />

      <div className="t8-generation-target-header">
        <div className="t8-generation-target-icon">
          <ScanLine size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <input
            className="t8-generation-target-title nodrag"
            value={String(d.title || '生成目标框')}
            onChange={(event) => update({ title: event.target.value })}
            title="目标框标题"
          />
          <div className="t8-generation-target-subtitle">
            {d.targetType || '图像'} · {aspectRatio} · {sizeLevel}
          </div>
        </div>
        <span className="t8-generation-target-chip">{resultUrl ? '已生成' : '待填充'}</span>
      </div>

      <div className="t8-generation-target-preview">
        {resultUrl ? (
          <img src={resultUrl} alt={String(d.title || '生成目标框结果')} />
        ) : (
          <div className="t8-generation-target-empty">
            <ImagePlus size={22} />
            <span>把结果准确放到这里</span>
          </div>
        )}
      </div>

      <textarea
        className="t8-generation-target-prompt nodrag nowheel"
        value={String(d.prompt ?? '')}
        placeholder={upstreamPrompt ? '已读取上游提示词，也可在这里覆盖...' : '输入提示词，或连接文本节点...'}
        onChange={(event) => update({ prompt: event.target.value })}
      />

      <div className="t8-generation-target-meta">
        <label>
          比例
          <select className="nodrag" value={aspectRatio} onChange={(event) => update({ aspectRatio: event.target.value })}>
            <option value="1:1">1:1</option>
            <option value="3:4">3:4</option>
            <option value="4:3">4:3</option>
            <option value="9:16">9:16</option>
            <option value="16:9">16:9</option>
          </select>
        </label>
        <label>
          尺寸
          <select className="nodrag" value={sizeLevel} onChange={(event) => update({ sizeLevel: event.target.value })}>
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </label>
      </div>

      {d.error ? <div className="t8-generation-target-error">{String(d.error)}</div> : null}
      {upstreamImages.length > 0 ? <div className="t8-generation-target-hint">参考图 {upstreamImages.length} 张</div> : null}

      <div className="t8-generation-target-actions">
        <button type="button" disabled={isBusy} onClick={() => void run('replace')}>
          {busyMode === 'replace' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          <span>替换到框内</span>
        </button>
        <button type="button" disabled={isBusy} onClick={() => void run('keep-version')}>
          {busyMode === 'keep-version' ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          <span>保留版本</span>
        </button>
      </div>
    </div>
  );
};

export default memo(GenerationTargetNode);

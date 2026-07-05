/**
 * GuomanLoopOutputCollectorNode - 清风-国漫循环输出收集器
 *
 * 搭配 GuomanModelLoopSelectorNode 使用：
 *   - 上游只接循环选择器节点，从它的 iterationImages / selectedItems 读数据
 *   - UI 按轮次分组展示：每轮一个 section，列出对应模型名 + 该轮产出的所有图像
 *   - 支持点击单张图打开大图预览
 *   - 把自己 data.imageUrls 同步成所有轮次的平铺数组，让下游节点（OutputNode / 其它）
 *     通过 useUpstreamMaterials 能拿到全部产物图
 */
import { memo, useEffect, useMemo, useState } from 'react';
import { Handle, Position, useNodeConnections, useNodesData, useReactFlow, type NodeProps, type Node } from '@xyflow/react';
import { LayoutGrid, ZoomIn, ChevronDown, PackageOpen, Package } from 'lucide-react';
import { useThemeStore } from '../../stores/theme';
import { useUpdateNodeData } from './useUpdateNodeData';
import { logBus } from '../../stores/logs';
import ImageFullscreenModal from '../ImageFullscreenModal';

// ========== 固定配置 ==========
const APP_NAME = '清风-国漫循环输出收集器';
const COLOR = '#10b981'; // emerald-500

type SelectedItem = { name: string; desc: string };

// ========== 主组件 ==========
const GuomanLoopOutputCollectorNode = ({ id, data, selected }: NodeProps) => {
  const { theme } = useThemeStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [visibleError, setVisibleError] = useState<string | null>(null);
  // 折叠状态：已折叠的轮次默认收起
  const collapsedRoundsRef = useState<Set<number>>(() => new Set())[0];
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(() => new Set());
  const collapsedSet = collapsedRounds;
  void collapsedRoundsRef; // 占位避免被 lint 警示

  // ========== 检测上游循环节点 ==========
  const conns = useNodeConnections({ id, handleType: 'target' });
  const upstreamIds = useMemo(
    () => Array.from(new Set(conns.map((c) => c.source))),
    [conns]
  );
  const upstreamNodes = useNodesData(upstreamIds);

  const loopNode = useMemo(() => {
    const list = Array.isArray(upstreamNodes) ? upstreamNodes : [];
    return list.find((n: any) => n?.type === 'guoman-model-loop-selector') || null;
  }, [upstreamNodes]);

  // 读取循环节点的产物数据
  const iterationImages: string[][] = useMemo(() => {
    if (!loopNode) return [];
    const raw = (loopNode.data as any)?.iterationImages;
    return Array.isArray(raw)
      ? raw.map((it: any) => Array.isArray(it) ? it.filter((u: any) => typeof u === 'string' && u) : [])
      : [];
  }, [loopNode]);

  const selectedItems: SelectedItem[] = useMemo(() => {
    if (!loopNode) return [];
    const raw = (loopNode.data as any)?.selectedItems;
    return Array.isArray(raw)
      ? raw.filter((it: any) => it && typeof it === 'object' && typeof it.name === 'string')
        .map((it: any) => ({ name: it.name, desc: typeof it.desc === 'string' ? it.desc : '' }))
      : [];
  }, [loopNode]);

  const loopStatus: string = useMemo(() => (loopNode?.data as any)?.status || 'idle', [loopNode]);
  const currentIndex: number = useMemo(() => (loopNode?.data as any)?.currentIndex ?? -1, [loopNode]);

  // 总产物数
  const totalImages = iterationImages.reduce((s, a) => s + (a?.length || 0), 0);

  // ========== 批量提取：根据当前 iterationImages 每组按轮次生产 OutputNode ==========
  const rf = useReactFlow();
  const src = `[${APP_NAME}]`;

  /** 提取指定轮次的图为 OutputNode */
  const handleExtractRound = (roundIdx: number) => {
    const imgs = iterationImages[roundIdx];
    if (!Array.isArray(imgs) || imgs.length === 0) {
      setVisibleError(`第 ${roundIdx + 1} 轮没有可提取的图像`);
      return;
    }
    const modelName = selectedItems[roundIdx]?.name || `第 ${roundIdx + 1} 轮`;
    const flat = imgs.map((url) => ({ url, round: roundIdx, modelName }));
    createOutputNodesFromFlat(flat);
    logBus.success(`已提取第 ${roundIdx + 1} 轮 ${flat.length} 张图为输出节点 · ${modelName}`, src);
  };

  /** 把所有图逐个提取为 OutputNode，放到循环收集器节点右侧 */
  const handleBatchExtract = () => {
    const flat: Array<{ url: string; round: number; modelName: string }> = [];
    iterationImages.forEach((imgs: string[], idx: number) => {
      const modelName = selectedItems[idx]?.name || `第 ${idx + 1} 轮`;
      imgs.forEach((url: string) => {
        flat.push({ url, round: idx, modelName });
      });
    });
    if (flat.length === 0) {
      setVisibleError('没有可提取的图像');
      return;
    }
    createOutputNodesFromFlat(flat);
    logBus.success(`已提取 ${flat.length} 张图为输出节点 · 第 ${flat[0].modelName} 等`, src);
  };

  const createOutputNodesFromFlat = (flat: Array<{ url: string; round: number; modelName: string }>) => {
    const allNodes = rf.getNodes();
    const myNode = allNodes.find((n) => n.id === id);
    if (!myNode) return;
    const myRect = {
      x: myNode.position.x,
      y: myNode.position.y,
      w: myNode.measured?.width || 320,
      h: myNode.measured?.height || 400,
    };
    // 每行 4 个 OutputNode
    const COLS = 4;
    const CARD_W = 200;
    const CARD_H = 260;
    const GAP = 16;
    const startX = myRect.x + myRect.w + 40;
    const startY = myRect.y;
    const newNodes: Node[] = flat.map((item, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const x = startX + col * (CARD_W + GAP);
      const y = startY + row * (CARD_H + GAP);
      const newId = `loop-out-${Date.now()}-${index}`;
      const outputEdge = {
        id: `loop-out-edge-${newId}`,
        source: id,
        target: newId,
        type: 'deletable',
      } as any;
      rf.setEdges((eds) => [...eds, outputEdge]);
      return {
        id: newId,
        type: 'output',
        position: { x, y },
        data: {
          directImageUrl: item.url,
          directImageUrls: [item.url],
          imageUrl: item.url,
          imageUrls: [item.url],
          label: `${item.modelName} · 第 ${item.round + 1} 轮`,
          size: CARD_W,
        },
        selected: false,
      } as Node;
    });
    rf.addNodes(newNodes);
  };

  // ========== 主题 ==========
  const isDark = theme === 'dark';
  const bg = isDark ? 'rgba(20,20,22,.95)' : 'rgba(255,255,255,.97)';
  const textColor = isDark ? '#f4f4f5' : '#18181b';
  const mutedColor = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
  const borderColor = selected ? COLOR : isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';

  return (
    <div
      style={{
        background: bg,
        backdropFilter: 'blur(12px)',
        width: 320,
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        boxShadow: selected ? `0 0 0 1px ${COLOR}, 0 16px 40px rgba(16,185,129,.18)` : undefined,
        overflow: 'hidden',
        transition: 'border-color .2s, box-shadow .2s',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 580,
        minHeight: 200,
      }}
    >
      {/* target handle 接循环节点的 source */}
      <Handle type="target" position={Position.Left} style={{ background: COLOR, border: 0, zIndex: 10 }} />
      {/* source handle 可继续透传出去（可选） */}
      <Handle type="source" position={Position.Right} style={{ background: COLOR, border: 0, zIndex: 10 }} />

      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
        background: 'linear-gradient(135deg, rgba(16,185,129,.12), transparent)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(16,185,129,.2)', color: '#34d399', boxShadow: `inset 0 0 0 1px ${COLOR}`,
        }}>
          <LayoutGrid size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.3 }}>{APP_NAME}</div>
          <div style={{ fontSize: 10, color: mutedColor, lineHeight: 1.3 }}>
            {loopNode
              ? (totalImages > 0 ? `已收集 ${totalImages} 张图 · ${iterationImages.length} 轮` : '已连接循环节点 · 等待产物')
              : '等待连接循环节点'}
          </div>
        </div>
        {/* 批量提取按钮：把每张图生成一个 OutputNode */}
        <button
          onClick={() => {
            setVisibleError(null);
            handleBatchExtract();
          }}
          disabled={totalImages === 0}
          title="把每张产物图提取为独立的输出节点"
          style={{
            height: 28, padding: '0 10px', borderRadius: 6, border: `1px solid ${COLOR}`,
            background: totalImages === 0
              ? (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)')
              : 'rgba(16,185,129,.12)',
            color: totalImages === 0 ? mutedColor : '#34d399',
            fontSize: 11, fontWeight: 700,
            cursor: totalImages === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            opacity: totalImages === 0 ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <PackageOpen size={12} />
          批量提取 ({totalImages})
        </button>
      </div>

      {/* 内容区 (可滚动) */}
      <div style={{ padding: '10px 12px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {!loopNode && (
          <div style={{
            padding: '24px 12px', textAlign: 'center', fontSize: 11, color: mutedColor,
            border: `1px dashed ${inputBorder}`, borderRadius: 8,
          }}>
            请把左侧 handle 连到
            <br />
            "清风-国漫角色模型循环选择器"
          </div>
        )}

        {loopNode && totalImages === 0 && loopStatus !== 'running' && (
          <div style={{
            padding: '24px 12px', textAlign: 'center', fontSize: 11, color: mutedColor,
            border: `1px dashed ${inputBorder}`, borderRadius: 8,
          }}>
            {iterationImages.length === 0
              ? '循环节点还未配置模型，去选几个模型再运行'
              : '循环已结束但本轮没产物图（可能被取消或下游报错）'}
          </div>
        )}

        {loopNode && iterationImages.length > 0 && iterationImages.map((imgs: string[], idx: number) => {
          const item = selectedItems[idx];
          const isCurrent = idx === currentIndex;
          const isCollapsed = collapsedSet.has(idx);
          const totalThisRound = imgs.length;
          return (
            <div
              key={`round-${idx}`}
              style={{
                marginBottom: 8, borderRadius: 8,
                border: isCurrent
                  ? `2px solid ${COLOR}`
                  : `1px solid ${inputBorder}`,
                background: isCurrent
                  ? (isDark ? 'rgba(16,185,129,.10)' : 'rgba(16,185,129,.04)')
                  : inputBg,
                overflow: 'hidden',
              }}
            >
              {/* 轮次标题 (可点击折叠) */}
              <button
                onClick={() => {
                  setCollapsedRounds((prev) => {
                    const next = new Set(prev);
                    if (next.has(idx)) next.delete(idx);
                    else next.add(idx);
                    return next;
                  });
                }}
                style={{
                  width: '100%', padding: '6px 10px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: textColor, fontSize: 11, fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <ChevronDown
                  size={12}
                  style={{
                    transition: 'transform .15s',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  第 {idx + 1} 轮 · {item?.name || '?'}
                </span>
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 4,
                  background: totalThisRound > 0 ? 'rgba(16,185,129,.15)' : (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'),
                  color: totalThisRound > 0 ? '#34d399' : mutedColor,
                  fontWeight: 700,
                }}>
                  {totalThisRound} 张
                </span>
                {/* 提取本轮按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setVisibleError(null);
                    handleExtractRound(idx);
                  }}
                  disabled={totalThisRound === 0}
                  title="只提取本轮产物为输出节点"
                  style={{
                    marginLeft: 4,
                    height: 20, padding: '0 8px', borderRadius: 4,
                    border: `1px solid ${COLOR}`,
                    background: totalThisRound === 0
                      ? (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)')
                      : 'rgba(16,185,129,.12)',
                    color: totalThisRound === 0 ? mutedColor : '#34d399',
                    fontSize: 10, fontWeight: 700,
                    cursor: totalThisRound === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 3,
                    opacity: totalThisRound === 0 ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  <Package size={10} />
                  提取本轮
                </button>
              </button>

              {/* 该轮的图像网格 (折叠时隐藏) */}
              {!isCollapsed && (
                <div style={{ padding: '4px 8px 8px' }}>
                  {totalThisRound === 0 ? (
                    <div style={{
                      aspectRatio: '3 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: mutedColor,
                      border: `1px dashed ${inputBorder}`, borderRadius: 6,
                    }}>
                      {idx === currentIndex && loopStatus === 'running' ? '生成中…' : '本轮暂无产物'}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                      {imgs.map((url, j) => (
                        <div
                          key={j}
                          onClick={() => setPreviewUrl(url)}
                          style={{
                            position: 'relative', aspectRatio: '1 / 1',
                            borderRadius: 4, overflow: 'hidden', cursor: 'zoom-in',
                            background: isDark ? '#0a0a0a' : '#f0f0f0',
                            border: `1px solid ${inputBorder}`,
                          }}
                          title="点击查看大图"
                        >
                          <img
                            src={url} alt="" loading="lazy"
                            style={{
                              width: '100%', height: '100%',
                              objectFit: 'contain', display: 'block',
                            }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          {/* 右下角放大镜按钮：点击用 OutputNode 同款全屏大图 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewUrl(url);
                            }}
                            style={{
                              position: 'absolute', right: 4, bottom: 4,
                              width: 24, height: 24, borderRadius: 5,
                              border: 'none',
                              background: 'rgba(0,0,0,.55)',
                              color: '#fff', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              padding: 0,
                            }}
                            title="查看大图"
                          >
                            <ZoomIn size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 全屏查看大图：与 OutputNode 同款 ImageFullscreenModal */}
      {previewUrl && <ImageFullscreenModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  );
};

export default memo(GuomanLoopOutputCollectorNode);

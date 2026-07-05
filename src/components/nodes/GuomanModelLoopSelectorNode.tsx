/**
 * GuomanModelLoopSelectorNode - 清风-国漫角色模型循环选择器
 *
 * 三种模式生成 N 个模型文件名，运行时依次消费并驱动下游国漫执行节点：
 *   - manual         用户手动多选 (picker multiMode)，不允许重复
 *   - randomAll      从全部模型随机抽取 count 个 (尽量不重复，count>总数时回退允许重复)
 *   - randomFavorites 从收藏模型随机抽取 count 个 (允许重复)
 *
 * 串行执行 (参考 LoopNode.runSerial)：
 *   1. update({ modelName: selectedItems[i].name, modelDesc: ..., text: ..., prompt: ... }) → 下游 useUpstreamMaterials 看到变化
 *   2. sleep 80ms 等 xyflow store 落盘 + 下游 useEffect 重渲染
 *   3. topologicalSort + awaitNode 整条下游链运行完
 *   4. 下一轮
 *
 * 不修改任何下游节点：CharNode1/2 已经监听 upstreamModelName 自动同步到 1569::lora_name。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps, type Node, type Edge } from '@xyflow/react';
import { Crown, Play, Square, Loader2, AlertCircle, Repeat, Shuffle, Heart, ListChecks, X } from 'lucide-react';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useRunTrigger } from '../../hooks/useRunTrigger';
import { useThemeStore } from '../../stores/theme';
import { useRunBusStore } from '../../stores/runBus';
import { useGuomanFavoritesStore } from '../../stores/guomanFavorites';
import { logBus } from '../../stores/logs';
import { topologicalSort } from '../../utils/topologicalSort';
import { getGuomanModelsAll, type GuomanModel } from '../../services/api';
import GuomanModelPickerModal from '../GuomanModelPickerModal';

// ========== 固定配置 ==========
const APP_NAME = '清风-国漫角色模型循环选择器';
const COLOR = '#d97706'; // amber-600，区分于单选选择器的 amber-500

type Strategy = 'manual' | 'randomAll' | 'randomFavorites';

// 下游 EXEC 类型集：与 LoopNode 保持一致，能跑 RH 工具 / Fal 工具 / 图片视频音频等
const EXEC_TYPES = new Set<string>([
  'image', 'edit',
  'multi-angle-3d', 'panorama-720', 'penguin-portrait',
  'video', 'seedance', 'audio', 'llm', 'runninghub', 'runninghub-wallet',
  'rh-tools', 'rh-toolbox', 'fal-toolbox', 'comfyui-store',
  'grok-oauth-agent', 'codex-cli-agent',
  'resize', 'upscale', 'grid-crop', 'grid-editor', 'remove-bg', 'combine',
  'panorama-3d',
  'frame-extractor', 'frame-pair',
  'upload',
  'aggregate-parser', 'batch-processor',
  'topaz-image-upscale', 'topaz-video-upscale',
  // 国漫角色节点本身也是 EXEC 类型（直接接到循环节点时会作为可执行终点）
  'guoman-char-1', 'guoman-char-2', 'guoman-char-3',
]);
const LOOP_NODE_WAIT_TIMEOUT_MS = 60 * 60 * 1000;

// ========== BFS / 拓扑 ==========
function bfsForward(allEdges: Edge[], starts: string[]): Set<string> {
  const visited = new Set<string>();
  const queue = [...starts];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const e of allEdges) {
      if (e.source === cur && !visited.has(e.target)) queue.push(e.target);
    }
  }
  return visited;
}

/**
 * 从某个节点 data 中抽取"本轮所有产物图像 URL"（去空、去重、保持顺序）
 * 覆盖国漫节点产物的常见字段：imageUrl / imageUrls / urls
 * 一次 RH 任务可能产出 N 张图，所以必须取全部而不是首张
 */
function extractAllImagesFromNode(node: any): string[] {
  if (!node) return [];
  const ud: any = node.data || {};
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: any) => {
    if (typeof v !== 'string') return;
    const s = v.trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  // 优先取数组字段（多产物）：urls > imageUrls > generatedImages
  if (Array.isArray(ud.urls)) ud.urls.forEach(push);
  if (Array.isArray(ud.imageUrls)) ud.imageUrls.forEach(push);
  if (Array.isArray(ud.generatedImages)) ud.generatedImages.forEach(push);
  // 兼容单图字段：imageUrl
  push(ud.imageUrl);
  return out;
}

/**
 * 等下游某节点运行完成，等价于 triggerRunMany([id]) + 等 lastDone。
 * 用 startTs 过滤本轮的 lastDone，避免把上一轮的完成事件误判为当前完成。
 */
function awaitNode(nodeId: string, cancelRef: React.MutableRefObject<boolean>, timeoutMs = LOOP_NODE_WAIT_TIMEOUT_MS): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let resolved = false;
    const startTs = Date.now();
    const finish = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      off();
      window.clearTimeout(timer);
      resolve(ok);
    };
    const off = useRunBusStore.subscribe((state) => {
      if (state.lastDone && state.lastDone.id === nodeId && state.lastDone.ts >= startTs) finish(state.lastDone.ok);
      if (cancelRef.current) finish(false);
    });
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    useRunBusStore.getState().triggerRunMany([nodeId]);
  });
}

// ========== 抽取算法 ==========

// 抽 desc：与单选选择器的 stripHtml + "1.0" 哨兵保持一致 (空 desc 不下发，避免污染下游角色外观)
function pickModelDesc(m: GuomanModel): string {
  const raw = m.desc ?? '';
  if (!raw || raw.trim() === '' || raw.trim() === '1.0') return '';
  return raw.replace(/<[^>]*>/g, '').trim();
}
function pickModelFileName(m: GuomanModel): string {
  const raw = m.versions?.[0]?.versionResourceName || m.versions?.[0]?.resourceStorageName || '';
  return raw ? raw.replace(/^.*[\\/]/, '') : m.resourceName;
}

/** 全部模型随机 count 个，尽量无重复；count>总数时自动回退到有放回。
 *  返回 {name, desc} 对，让下游自动同步角色外观 */
function sampleRandomAll(records: GuomanModel[], count: number): Array<{ name: string; desc: string }> {
  if (records.length === 0 || count <= 0) return [];
  // 去重（同名模型不应抽两次）
  const seen = new Set<string>();
  const uniquePool: GuomanModel[] = [];
  for (const m of records) {
    const fn = pickModelFileName(m);
    if (!fn || seen.has(fn)) continue;
    seen.add(fn);
    uniquePool.push(m);
  }
  if (uniquePool.length === 0) return [];
  // 第一阶段：无放回抽 min(count, uniquePool.length) 个
  const targetWithoutDup = Math.min(count, uniquePool.length);
  const remaining = uniquePool.slice();
  const out: Array<{ name: string; desc: string }> = [];
  for (let i = 0; i < targetWithoutDup; i++) {
    const idx = Math.floor(Math.random() * remaining.length);
    const m = remaining[idx];
    out.push({ name: pickModelFileName(m), desc: pickModelDesc(m) });
    remaining.splice(idx, 1);
  }
  // 第二阶段：count 还差多少 → 有放回从全量补（每次重新随机，允许重复）
  while (out.length < count) {
    const m = uniquePool[Math.floor(Math.random() * uniquePool.length)];
    out.push({ name: pickModelFileName(m), desc: pickModelDesc(m) });
  }
  return out;
}

/** 从收藏 id 集合抽 count 个，允许重复；返回 {name, desc} 对 */
function sampleRandomFavorites(favRecords: GuomanModel[], count: number): Array<{ name: string; desc: string }> {
  if (favRecords.length === 0 || count <= 0) return [];
  const out: Array<{ name: string; desc: string }> = [];
  for (let i = 0; i < count; i++) {
    const m = favRecords[Math.floor(Math.random() * favRecords.length)];
    out.push({ name: pickModelFileName(m), desc: pickModelDesc(m) });
  }
  return out;
}

// ========== 主组件 ==========
const GuomanModelLoopSelectorNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { theme } = useThemeStore();
  const rf = useReactFlow();

  const strategy: Strategy = (data as any).strategy || 'manual';
  const count: number = (data as any).count ?? 5;
  // 节点 data 中存的真实选定项：每项 {name, desc} 一对儿
  type SelectedItem = { name: string; desc: string };
  const selectedItems: SelectedItem[] = Array.isArray((data as any).selectedItems)
    ? (data as any).selectedItems
      .filter((it: any) => it && typeof it === 'object' && typeof it.name === 'string')
      .map((it: any) => ({ name: it.name, desc: typeof it.desc === 'string' ? it.desc : '' }))
    : [];
  const currentIndex: number = (data as any).currentIndex ?? -1;
  const iterationResults: Array<{ model: string; status: 'pending' | 'running' | 'success' | 'failed' }> =
    Array.isArray((data as any).iterationResults) ? (data as any).iterationResults : [];
  // 每轮的产物图数组：iterationImages[i] 是第 i 轮产出的所有图（按 urls/imageUrls 等聚合）
  // 失败/空产物的位置留空数组占位
  const iterationImages: string[][] = Array.isArray((data as any).iterationImages)
    ? (data as any).iterationImages.map((it: any) => Array.isArray(it) ? it.filter((u: any) => typeof u === 'string' && u) : [])
    : [];
  const status: 'idle' | 'running' | 'success' | 'error' = (data as any).status || 'idle';
  const error: string = (data as any).error || '';

  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleError, setVisibleError] = useState<string | null>(null);
  const [randomAllPool, setRandomAllPool] = useState<GuomanModel[]>([]);
  const [randomAllLoading, setRandomAllLoading] = useState(false);
  // picker 打开期间累积用户点击：每点一次实时同步，关闭时把 pendingItems 存到 data.selectedItems
  const [pendingItems, setPendingItems] = useState<SelectedItem[]>([]);
  const cancelRef = useRef(false);
  const mountedRef = useRef(true);

  // 收藏 store：拿收藏 id 集合
  const favoriteIds = useGuomanFavoritesStore((s) => s.favoriteIds);

  const src = `[${APP_NAME}]`;

  // ========== 主题 ==========
  const isDark = theme === 'dark';
  const bg = isDark ? 'rgba(20,20,22,.95)' : 'rgba(255,255,255,.97)';
  const textColor = isDark ? '#f4f4f5' : '#18181b';
  const mutedColor = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
  const borderColor = selected ? COLOR : isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';

  // ========== 清理 ==========
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ========== 模式 / 数量变更时同步 ==========
  const setStrategy = (next: Strategy) => update({ strategy: next });
  const setCount = (next: number) => {
    const safe = Math.max(1, Math.min(50, Math.floor(Number(next) || 1)));
    update({ count: safe });
  };

  // ========== 手动模式：picker 实时累积 + 确认提交 ==========
  // picker 每次用户点击（多选模式 toggle 一次）都会调 onSelect(name, model)
  // 我们把 (name, desc) 累积到 pendingItems；超过 maxCount 的请求 picker 会自己拒绝
  const handlePickerSelect = (name: string, model?: GuomanModel) => {
    const desc = pickModelDesc(model as GuomanModel);
    setPendingItems((prev) => {
      const idx = prev.findIndex((it) => it.name === name);
      if (idx >= 0) {
        // 已选 → 移除
        const next = prev.slice();
        next.splice(idx, 1);
        return next;
      }
      // 未选 → 加入
      return [...prev, { name, desc }];
    });
  };

  const handlePickerClose = () => {
    setPickerOpen(false);
    setPendingItems([]); // 用户直接关闭不算数，丢弃本次暂存
  };

  const handlePickerConfirm = () => {
    update({ selectedItems: pendingItems.slice() });
    setPickerOpen(false);
    logBus.info(`已选 ${pendingItems.length} 个模型（含专属外观）`, src);
  };

  // 打开 picker 时把当前 selectedItems 拷一份到 pendingItems, 支持 "再补一个 / 删一个" 的连续编辑
  const openPicker = () => {
    setPendingItems(selectedItems.slice());
    setPickerOpen(true);
  };

  // ========== 随机全部 ==========
  const handleRandomAll = async () => {
    setRandomAllLoading(true);
    setVisibleError(null);
    try {
      let pool = randomAllPool;
      if (pool.length === 0) {
        const result = await getGuomanModelsAll();
        if (!result.success) throw new Error(result.error || '获取全部模型失败');
        pool = result.data.records;
        setRandomAllPool(pool);
        if (result.data.truncated) {
          logBus.warn(`模型总数超过 ${result.data.cap}，已截断，仅在前 ${result.data.cap} 个中随机`, src);
        }
      }
      const picked = sampleRandomAll(pool, count);
      update({ selectedItems: picked });
      logBus.info(`随机（全部）已抽取 ${picked.length} 个模型（含专属外观）`, src);
    } catch (e: any) {
      setVisibleError(e?.message || '随机抽取失败');
      logBus.error(`随机（全部）失败: ${e?.message}`, src);
    } finally {
      setRandomAllLoading(false);
    }
  };

  // ========== 随机收藏 ==========
  const handleRandomFavorites = () => {
    setVisibleError(null);
    if (favoriteIds.length === 0) {
      setVisibleError('还没有收藏模型，先在模型库里点星标收藏几个');
      return;
    }
    // 从 randomAllPool 里筛出收藏 id 对应的 record；如果池里没有则提示用户先随机全部拉一次
    const favRecords = randomAllPool.filter((m) => favoriteIds.includes(m.id));
    if (favRecords.length === 0) {
      setVisibleError('收藏还没在内存中。请先点一次"随机全部"把模型拉进来，或者切到"随机收藏"前先在模型库收藏至少一个。');
      return;
    }
    const picked = sampleRandomFavorites(favRecords, count);
    update({ selectedItems: picked });
    logBus.info(`随机（收藏）已抽取 ${picked.length} 个模型（含专属外观）`, src);
  };

  // ========== 移除单个已选模型 ==========
  const removeAt = (idx: number) => {
    const next = selectedItems.slice();
    next.splice(idx, 1);
    update({ selectedItems: next });
  };

  // ========== 清空已选 ==========
  const clearAll = () => update({ selectedItems: [] });

  // ========== 串行执行（核心） ==========
  const runSerial = useCallback(async (): Promise<void> => {
    if (selectedItems.length === 0) {
      setVisibleError('请先选择模型');
      return;
    }
    setVisibleError(null);
    cancelRef.current = false;
    // 初始化进度 + 清空上一次跑出来的产物（避免显示陈旧的图像）
    update({
      status: 'running',
      error: '',
      currentIndex: -1,
      iterationResults: selectedItems.map((it) => ({ model: it.name, status: 'pending' as const })),
      iterationImages: new Array(selectedItems.length).fill([]),
      imageUrls: [],
      urls: [],
      imageUrl: '',
    });

    // 找下游直接连接节点
    const allEdges = rf.getEdges();
    const allNodes = rf.getNodes();
    const directs = allEdges
      .filter((e) => e.source === id)
      .map((e) => e.target);
    if (directs.length === 0) {
      const msg = '请先把循环选择器连到下游国漫角色节点';
      setVisibleError(msg);
      update({ status: 'error', error: msg });
      return;
    }

    // 子图 BFS + 拓扑排序
    const reachable = bfsForward(allEdges, directs);
    const subNodes = allNodes.filter((n) => reachable.has(n.id));
    const subEdges = allEdges.filter((e) => reachable.has(e.source) && reachable.has(e.target));
    const order = topologicalSort(subNodes, subEdges, EXEC_TYPES);
    if (order.length === 0) {
      const msg = '下游链路上没有可执行节点';
      setVisibleError(msg);
      update({ status: 'error', error: msg });
      return;
    }

    // 清空下游 EXEC 节点残留产物（同步 n 个字段），避免上轮的产物影响下轮提交
    const execSubIds = new Set<string>(subNodes.filter((n) => EXEC_TYPES.has(n.type as string)).map((n) => n.id));
    rf.setNodes((prev) => prev.map((nd) => {
      if (!execSubIds.has(nd.id)) return nd;
      const od: any = nd.data || {};
      const reset: any = {};
      if (nd.type === 'guoman-char-1' || nd.type === 'guoman-char-2' || nd.type === 'guoman-char-3') {
        reset.status = 'idle';
        reset.error = '';
        reset.urls = [];
        reset.imageUrl = '';
      }
      return { ...nd, data: { ...od, ...reset } };
    }));

    let okCount = 0;
    let failCount = 0;
    const collectedImages: string[] = [];
    // 记录每轮产物的所有图像 URL 数组（按 selectedItems 顺序，失败/空产物的位置留空数组占位）
    const perIterImages: string[][] = new Array(selectedItems.length).fill(null).map(() => []);

    try {
      for (let i = 0; i < selectedItems.length; i++) {
        if (cancelRef.current) break;
        const item = selectedItems[i];

        // 1. 注入当前模型 + 专属外观 (下游 useUpstreamMaterials 看到 modelName/modelDesc 变化)
        update({
          modelName: item.name,
          modelDisplayName: item.name,
          thumbnailUrl: '',
          modelDesc: item.desc,
          text: item.name,
          prompt: item.name,
          currentIndex: i,
          iterationResults: selectedItems.map((it, idx) => ({
            model: it.name,
            status: idx < i ? (iterationResults[idx]?.status || 'pending')
              : idx === i ? 'running' as const
              : 'pending' as const,
          })),
        });
        // 等下游 useEffect 重渲染 (CharNode1/2 useEffect 内会同步 1569::lora_name + 1643::text)
        await new Promise<void>((r) => setTimeout(() => r(), 100));

        // 2. 串行触发下游链路
        let chainOk = true;
        for (const nid of order) {
          if (cancelRef.current) { chainOk = false; break; }
          const ok = await awaitNode(nid, cancelRef);
          if (!ok) { chainOk = false; break; }
        }

        // 3. 抽取本轮所有产物（让 store 内 urls/imageUrls 完全落盘后再读）
        let thisImages: string[] = [];
        if (chainOk) {
          await new Promise<void>((r) => setTimeout(() => r(), 60));
          const cn = rf.getNode(directs[0]);
          thisImages = extractAllImagesFromNode(cn);
        }
        perIterImages[i] = thisImages;
        // 跨轮去重推入 collectedImages（同样的 url 不重复累加）
        for (const u of thisImages) {
          if (!collectedImages.includes(u)) collectedImages.push(u);
        }

        // 4. 记录本轮结果
        if (chainOk && thisImages.length > 0) okCount++;
        else if (chainOk) { /* 跑成功但没图，计入 okCount 不算成功 */ }
        else failCount++;
        const nextResults = selectedItems.map((it, idx) => ({
          model: it.name,
          status: idx < i ? (iterationResults[idx]?.status || 'success')
            : idx === i ? ((chainOk && thisImages.length > 0 ? 'success' : 'failed') as const)
            : 'pending' as const,
        }));
        update({
          iterationResults: nextResults,
          iterationImages: perIterImages.slice(),
          // 实时聚合到 imageUrls，让 OutputNode 边跑边能看到产出
          imageUrls: collectedImages.slice(),
          urls: collectedImages.slice(),
          imageUrl: collectedImages[collectedImages.length - 1] || '',
        });
      }
    } finally {
      update({
        status: cancelRef.current ? 'idle' : (failCount === selectedItems.length ? 'error' : 'success'),
        error: '',
        currentIndex: selectedItems.length,
        // 最终聚合：所有成功产物的图像（失败位用空数组占位，方便 UI 一一对应）
        iterationImages: perIterImages.slice(),
        imageUrls: collectedImages.slice(),
        urls: collectedImages.slice(),
        imageUrl: collectedImages[collectedImages.length - 1] || '',
      });
    }
  }, [id, rf, selectedItems, update, iterationResults]);

  // ========== 接入运行总线 (供批量运行调用本节点) ==========
  useRunTrigger(id, async () => {
    if (status === 'running') return;
    await runSerial();
  });

  const handleStop = () => {
    cancelRef.current = true;
    useRunBusStore.getState().cancelAll();
    update({ status: 'idle' });
  };

  // ========== 渲染 ==========
  const isBusy = status === 'running';
  const doneCount = iterationResults.filter((r) => r.status === 'success' || r.status === 'failed').length;
  const okCount = iterationResults.filter((r) => r.status === 'success').length;
  const failCount = iterationResults.filter((r) => r.status === 'failed').length;

  return (
    <div
      style={{
        background: bg,
        backdropFilter: 'blur(12px)',
        width: 320,
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        boxShadow: selected ? `0 0 0 1px ${COLOR}, 0 16px 40px rgba(217,119,6,.18)` : undefined,
        overflow: 'hidden',
        transition: 'border-color .2s, box-shadow .2s',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 580,
        minHeight: 220,
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: COLOR, border: 0, zIndex: 10 }} />

      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
        background: 'linear-gradient(135deg, rgba(217,119,6,.12), transparent)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(217,119,6,.2)', color: '#f59e0b', boxShadow: `inset 0 0 0 1px ${COLOR}`,
        }}>
          <Repeat size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.3 }}>{APP_NAME}</div>
          <div style={{ fontSize: 10, color: mutedColor, lineHeight: 1.3 }}>
            {status === 'idle' && (selectedItems.length > 0 ? `已选 ${selectedItems.length} 个模型` : '等待配置')}
            {status === 'running' && `运行中 ${currentIndex + 1}/${selectedItems.length} · 已出 ${iterationImages.reduce((s, a) => s + (a?.length || 0), 0)} 张图`}
            {status === 'success' && `✅ 完成 ${okCount}/${selectedItems.length} · 共 ${iterationImages.reduce((s, a) => s + (a?.length || 0), 0)} 张图`}
            {status === 'error' && `❌ 失败 ${failCount}/${selectedItems.length}`}
          </div>
        </div>
      </div>

      {/* 内容区 (可滚动，运行按钮固定在底部) */}
      <div style={{ padding: '10px 12px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {/* 模式选择 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: textColor, marginBottom: 4 }}>选择模式</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { v: 'manual' as const, label: '手动多选', icon: <ListChecks size={11} /> },
              { v: 'randomAll' as const, label: '随机全部', icon: <Shuffle size={11} /> },
              { v: 'randomFavorites' as const, label: '随机收藏', icon: <Heart size={11} /> },
            ]).map((opt) => {
              const active = strategy === opt.v;
              return (
                <button
                  key={opt.v}
                  onClick={() => setStrategy(opt.v)}
                  disabled={isBusy}
                  style={{
                    flex: 1, height: 28, padding: '0 6px',
                    borderRadius: 6, border: `1px solid ${active ? COLOR : inputBorder}`,
                    background: active ? (isDark ? 'rgba(217,119,6,.16)' : 'rgba(217,119,6,.08)') : 'transparent',
                    color: active ? '#f59e0b' : mutedColor,
                    fontSize: 11, fontWeight: active ? 700 : 500, cursor: isBusy ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                    opacity: isBusy ? 0.5 : 1,
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 数量输入 */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>数量</span>
          <input
            type="number" min={1} max={50} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={isBusy}
            style={{
              width: 70, height: 28, padding: '0 8px', fontSize: 12, color: textColor,
              background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 6, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ fontSize: 10, color: mutedColor, marginLeft: 'auto' }}>
            已选 {selectedItems.length} / {count}
          </span>
        </div>

        {/* 模式对应操作按钮 */}
        <div style={{ marginBottom: 8, display: 'flex', gap: 6 }}>
          {strategy === 'manual' && (
            <button
              onClick={openPicker}
              disabled={isBusy}
              style={{
                flex: 1, height: 30, borderRadius: 8, border: 'none',
                background: `linear-gradient(135deg, ${COLOR}, #f59e0b)`,
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: isBusy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              <Crown size={12} /> {selectedItems.length > 0 ? '编辑已选模型' : '选择模型'}
            </button>
          )}
          {strategy === 'randomAll' && (
            <button
              onClick={handleRandomAll}
              disabled={isBusy || randomAllLoading}
              style={{
                flex: 1, height: 30, borderRadius: 8, border: 'none',
                background: `linear-gradient(135deg, ${COLOR}, #f59e0b)`,
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: (isBusy || randomAllLoading) ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                opacity: (isBusy || randomAllLoading) ? 0.5 : 1,
              }}
            >
              {randomAllLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Shuffle size={12} />}
              抽 {count} 个
            </button>
          )}
          {strategy === 'randomFavorites' && (
            <button
              onClick={handleRandomFavorites}
              disabled={isBusy}
              style={{
                flex: 1, height: 30, borderRadius: 8, border: 'none',
                background: `linear-gradient(135deg, ${COLOR}, #f59e0b)`,
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: isBusy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              <Heart size={12} /> 从 {favoriteIds.length} 个收藏中抽 {count} 个
            </button>
          )}
          {selectedItems.length > 0 && (
            <button
              onClick={clearAll}
              disabled={isBusy}
              title="清空"
              style={{
                width: 30, height: 30, borderRadius: 8, border: `1px solid ${inputBorder}`,
                background: 'transparent', color: mutedColor,
                cursor: isBusy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: isBusy ? 0.5 : 1,
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 已选模型列表 */}
        {selectedItems.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: mutedColor, marginBottom: 4 }}>
              已选模型（{selectedItems.length}）
            </div>
            <div style={{
              maxHeight: 160, overflowY: 'auto',
              background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
              border: `1px solid ${inputBorder}`, borderRadius: 6, padding: 4,
            }}>
              {selectedItems.map((it, idx) => {
                const r = iterationResults[idx];
                const resultStatus = r?.status || 'pending';
                const colorMap: Record<string, string> = {
                  pending: mutedColor,
                  running: '#3b82f6',
                  success: '#22c55e',
                  failed: '#ef4444',
                };
                return (
                  <div
                    key={`${idx}-${it.name}`}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      padding: '4px 6px', borderRadius: 4, fontSize: 11,
                      color: textColor,
                      background: idx === currentIndex
                        ? (isDark ? 'rgba(217,119,6,.18)' : 'rgba(217,119,6,.08)')
                        : 'transparent',
                    }}
                    title={it.name}
                  >
                    <span style={{ fontSize: 9, color: mutedColor, minWidth: 18, textAlign: 'right', paddingTop: 2 }}>{idx + 1}</span>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: colorMap[resultStatus],
                      boxShadow: resultStatus === 'running' ? '0 0 6px #3b82f6' : undefined,
                      flexShrink: 0, marginTop: 4,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.name}
                      </div>
                      {it.desc && (
                        <div style={{
                          fontSize: 9, color: mutedColor, marginTop: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={it.desc}>
                          外貌：{it.desc.length > 30 ? it.desc.slice(0, 30) + '…' : it.desc}
                        </div>
                      )}
                    </div>
                    {idx === currentIndex && resultStatus === 'running' && (
                      <Loader2 size={10} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
                    )}
                    {!isBusy && (
                      <button
                        onClick={() => removeAt(idx)}
                        style={{
                          width: 16, height: 16, borderRadius: '50%',
                          border: 'none', background: 'transparent', color: mutedColor,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 2,
                        }}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 已生成产物缩略图网格 (循环节点内置聚合显示，方便一眼看完)
            适配 string[][]：每轮对应一个格子，内部再 2x2 缩略图（>4 张 +N 角标） */}
        {iterationImages.length > 0 && iterationImages.some((arr: string[]) => Array.isArray(arr) && arr.length > 0) && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: mutedColor, marginBottom: 4 }}>
              已生成产物（{iterationImages.reduce((s: number, arr: string[]) => s + (Array.isArray(arr) ? arr.length : 0), 0)} 张 / 共 {iterationImages.length} 轮）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
              {iterationImages.map((imgs: string[], idx: number) => {
                const total = imgs.length;
                const visible = imgs.slice(0, 4);
                const more = total - visible.length;
                return (
                  <div
                    key={`gen-${idx}`}
                    style={{
                      borderRadius: 6, overflow: 'hidden',
                      border: idx === currentIndex
                        ? `2px solid ${COLOR}`
                        : `1px solid ${inputBorder}`,
                      background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
                    }}
                    title={selectedItems[idx]?.name || `第 ${idx + 1} 轮`}
                  >
                    {/* 轮次标签 + 数量 */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '2px 6px', fontSize: 9, color: mutedColor,
                      background: idx === currentIndex
                        ? (isDark ? 'rgba(217,119,6,.16)' : 'rgba(217,119,6,.06)')
                        : 'transparent',
                    }}>
                      <span>第 {idx + 1} 轮</span>
                      <span style={{ fontWeight: 700, color: total > 0 ? (isDark ? '#fde68a' : '#b45309') : mutedColor }}>
                        {total} 张
                      </span>
                    </div>
                    {/* 缩略图小网格 (2x2) */}
                    {total > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, aspectRatio: '1 / 1' }}>
                        {visible.map((url, j) => (
                          <div key={j} style={{ position: 'relative', overflow: 'hidden', background: '#000' }}>
                            <img
                              src={url} alt="" loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            {j === 3 && more > 0 && (
                              <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,.55)', color: '#fff',
                                fontSize: 12, fontWeight: 700,
                              }}>
                                +{more}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        aspectRatio: '1 / 1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: mutedColor, textAlign: 'center', padding: 6,
                      }}>
                        {idx === currentIndex ? '生成中…' : '暂无产物'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 进度条 */}
        {isBusy && iterationResults.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, ${COLOR}, #f59e0b)`,
                animation: 'guoman-loop-progress 2s ease-in-out infinite',
                width: `${iterationResults.length > 0 ? (doneCount / iterationResults.length) * 100 : 0}%`,
                transition: 'width .3s',
              }} />
            </div>
            <div style={{ fontSize: 10, color: mutedColor, marginTop: 4, textAlign: 'center' }}>
              {doneCount}/{iterationResults.length} · 成功 {okCount} · 失败 {failCount}
            </div>
          </div>
        )}

        {/* 错误 */}
        {(visibleError || error) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', borderRadius: 6,
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', marginBottom: 8,
          }}>
            <AlertCircle size={12} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 10, color: '#ef4444', lineHeight: 1.4 }}>{visibleError || error}</span>
          </div>
        )}
      </div>

      {/* 运行/停止按钮 (固定在容器底部，运行按钮始终可见) */}
      <div style={{
        padding: '8px 12px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
        flexShrink: 0,
      }}>
        {isBusy ? (
          <button
            onClick={handleStop}
            style={{
              width: '100%', height: 32, borderRadius: 8, border: 'none',
              background: 'rgba(239,68,68,.15)', color: '#ef4444',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <Square size={12} /> 停止
          </button>
        ) : (
          <button
            onClick={runSerial}
            disabled={selectedItems.length === 0}
            style={{
              width: '100%', height: 32, borderRadius: 8, border: 'none',
              background: selectedItems.length === 0
                ? (isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)')
                : `linear-gradient(135deg, ${COLOR}, #f59e0b)`,
              color: selectedItems.length === 0 ? mutedColor : '#fff',
              fontSize: 12, fontWeight: 700,
              cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxShadow: selectedItems.length === 0 ? 'none' : '0 2px 8px rgba(217,119,6,.3)',
            }}
          >
            <Play size={12} /> 运行 {selectedItems.length > 0 && `(${selectedItems.length})`}
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes guoman-loop-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
      `}</style>

      {/* Picker 多选弹窗：实时 onSelect 累积到 pendingItems，确认时落盘到 data.selectedItems */}
      <GuomanModelPickerModal
        open={pickerOpen}
        onClose={handlePickerClose}
        onSelect={handlePickerSelect}
        multiMode
        maxCount={count}
        onConfirm={handlePickerConfirm}
      />
    </div>
  );
};

export default memo(GuomanModelLoopSelectorNode);

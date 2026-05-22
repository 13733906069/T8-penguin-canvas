import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { MonitorPlay, Type as TypeIcon, Image as ImageIcon, Video as VideoIcon, Music, Download, Pencil, Check } from 'lucide-react';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useThemeStore } from '../../stores/theme';
import { PORT_COLOR } from '../../config/portTypes';

/**
 * OutputNode - 通用输出素材节点
 *
 * 设计:
 *   1. 终端展示节点(无 source handle), 接收上游任意 文本/图像/视频/音频 类型连入
 *   2. 自动遍历上游节点的 data, 抽取所有可识别的:
 *      - 文本: prompt / reply / text / outputText
 *      - 图像: imageUrl / imageUrls[] / urls[] / generatedImages[]
 *      - 视频: videoUrl
 *      - 音频: audioUrl
 *   3. 分区显示, 图像/视频按原始宽高比 (object-contain + maxHeight) 不强制裁剪
 *   4. 文本双击进入可编辑状态, 编辑保存到 data.outputText (覆盖上游 live 文本)
 *      置空 outputText 时再次显示上游原文
 *   5. 不向下游输出 (终端节点)
 */

const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(u);
const isAudioUrl = (u: string) => /\.(mp3|wav|ogg|m4a|flac)(\?|$)/i.test(u);

interface Collected {
  texts: string[];
  images: string[];
  videos: string[];
  audios: string[];
}

const OutputNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { getEdges, getNodes } = useReactFlow();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const d = (data as any) || {};

  // 强制刷新: 上游 data 变更时重算
  // (xyflow Node.data 变化会触发当前节点重新渲染, 直接在 useMemo 里读 getNodes() 即可)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    // 兜底: 0.5s 节奏拉一次, 避免上游异步任务结束没立刻通知到本节点
    const t = window.setInterval(() => setTick((v) => (v + 1) % 1e6), 800);
    return () => window.clearInterval(t);
  }, []);

  const collected = useMemo<Collected>(() => {
    void tick; // 触发重新计算
    const edges = getEdges();
    const nodes = getNodes();
    const upstreamIds = edges.filter((e) => e.target === id).map((e) => e.source);
    const out: Collected = { texts: [], images: [], videos: [], audios: [] };

    const pushUnique = (arr: string[], v: any) => {
      if (typeof v !== 'string') return;
      const s = v.trim();
      if (!s) return;
      if (arr.indexOf(s) === -1) arr.push(s);
    };

    for (const uid of upstreamIds) {
      const n = nodes.find((x) => x.id === uid);
      const ud: any = n?.data || {};

      // 文本
      pushUnique(out.texts, ud.outputText);
      pushUnique(out.texts, ud.reply);
      pushUnique(out.texts, ud.prompt);
      pushUnique(out.texts, ud.text);

      // 图像 - 单
      pushUnique(out.images, ud.imageUrl);
      // 图像 - 多
      const arrFields = ['imageUrls', 'urls', 'generatedImages'];
      for (const f of arrFields) {
        const v = ud[f];
        if (Array.isArray(v)) v.forEach((u) => pushUnique(out.images, u));
      }

      // 视频
      pushUnique(out.videos, ud.videoUrl);

      // 音频
      pushUnique(out.audios, ud.audioUrl);
    }

    // 兜底: 一些节点把视频/音频塞在 imageUrl, 通过扩展名识别再纠正
    out.images = out.images.filter((u) => {
      if (isVideoUrl(u)) {
        if (out.videos.indexOf(u) === -1) out.videos.push(u);
        return false;
      }
      if (isAudioUrl(u)) {
        if (out.audios.indexOf(u) === -1) out.audios.push(u);
        return false;
      }
      return true;
    });

    return out;
  }, [id, getEdges, getNodes, tick]);

  // 文本编辑
  const overrideText: string = typeof d.outputText === 'string' ? d.outputText : '';
  const liveText = collected.texts.join('\n\n──────\n\n');
  const displayText = overrideText !== '' ? overrideText : liveText;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const enterEdit = () => {
    setDraft(displayText);
    setEditing(true);
    setTimeout(() => taRef.current?.focus(), 30);
  };
  const saveEdit = () => {
    update({ outputText: draft });
    setEditing(false);
  };
  const cancelEdit = () => {
    setEditing(false);
  };
  const restoreLive = () => {
    update({ outputText: '' });
    setEditing(false);
  };

  const isEdited = overrideText !== '' && overrideText !== liveText;
  const HANDLE = PORT_COLOR.any;
  const accent = '#5eead4'; // teal-300, 与 nodeRegistry color: 'teal' 对齐

  const total = collected.texts.length + collected.images.length + collected.videos.length + collected.audios.length;

  return (
    <div
      className={`relative rounded-xl border-2 transition-all ${
        selected ? 'shadow-2xl' : 'hover:border-white/30'
      }`}
      style={{
        background: isDark ? 'rgba(20,20,22,.92)' : 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(8px)',
        width: 320,
        borderColor: selected ? accent : isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)',
        boxShadow: selected ? `0 12px 40px ${accent}33` : undefined,
      }}
    >
      {/* 仅有 target handle (终端节点不向下游输出) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!border-0"
        style={{ background: HANDLE, width: 10, height: 10 }}
        title="文本 / 图像 / 视频 / 音频 任意类型可连入"
      />

      {/* 头部 */}
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b ${
          isDark ? 'border-white/10' : 'border-black/10'
        }`}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{
            background: accent + '33',
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}66`,
          }}
        >
          <MonitorPlay size={13} />
        </div>
        <div className={`flex-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          输出素材
        </div>
        <span className={`text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
          {total} 项
        </span>
      </div>

      {/* body */}
      <div className="p-2.5 space-y-3" onMouseDown={(e) => e.stopPropagation()}>
        {total === 0 && (
          <div
            className={`rounded border-2 border-dashed flex items-center justify-center text-[11px] py-6 ${
              isDark ? 'border-white/10 text-white/40' : 'border-black/10 text-zinc-400'
            }`}
          >
            从上游连入文本 / 图像 / 视频 / 音频
          </div>
        )}

        {/* 文本区 */}
        {(collected.texts.length > 0 || isEdited) && (
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <TypeIcon size={11} />
              <span className="flex-1">文本{isEdited ? ' · 已编辑' : ''}</span>
              {!editing && (
                <button
                  onClick={enterEdit}
                  className={`p-0.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                  title="双击文本或点此编辑"
                >
                  <Pencil size={10} />
                </button>
              )}
              {isEdited && !editing && (
                <button
                  onClick={restoreLive}
                  className={`text-[10px] px-1 rounded ${isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'}`}
                  title="恢复为上游 live 文本"
                >
                  恢复
                </button>
              )}
            </div>
            {!editing ? (
              <div
                onDoubleClick={enterEdit}
                className={`whitespace-pre-wrap break-words text-[12px] leading-relaxed rounded px-2 py-1.5 cursor-text ${
                  isDark ? 'bg-white/5 text-white/85' : 'bg-black/5 text-zinc-800'
                }`}
                style={{ maxHeight: 200, overflow: 'auto' }}
                title="双击编辑"
              >
                {displayText || <span className="opacity-50">(空)</span>}
              </div>
            ) : (
              <div className="space-y-1">
                <textarea
                  ref={taRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  rows={6}
                  className={`w-full rounded px-2 py-1.5 text-[12px] outline-none nodrag nowheel ${
                    isDark
                      ? 'bg-black/40 text-white border border-teal-400/40'
                      : 'bg-white text-zinc-900 border border-teal-500/50'
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') cancelEdit();
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
                  }}
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={cancelEdit}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      isDark ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-black/5 hover:bg-black/10 text-zinc-700'
                    }`}
                  >
                    取消
                  </button>
                  <button
                    onClick={saveEdit}
                    className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1 text-zinc-900"
                    style={{ background: accent }}
                  >
                    <Check size={10} /> 保存
                  </button>
                </div>
                <div className={`text-[10px] ${isDark ? 'text-white/30' : 'text-zinc-400'}`}>
                  Ctrl+Enter 保存 / Esc 取消
                </div>
              </div>
            )}
          </div>
        )}

        {/* 图像区 */}
        {collected.images.length > 0 && (
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <ImageIcon size={11} />
              <span>图像 ({collected.images.length})</span>
            </div>
            {collected.images.map((u, i) => (
              <div key={i} className="space-y-0.5">
                <img
                  src={u}
                  alt={`图像 ${i + 1}`}
                  className="w-full h-auto rounded block"
                  style={{ background: '#0008', objectFit: 'contain', maxHeight: 480 }}
                />
                <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                  <span className="truncate flex-1" title={u}>{u.split('/').pop()}</span>
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                      isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'
                    }`}
                  >
                    <Download size={10} /> 下载
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 视频区 */}
        {collected.videos.length > 0 && (
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <VideoIcon size={11} />
              <span>视频 ({collected.videos.length})</span>
            </div>
            {collected.videos.map((u, i) => (
              <div key={i} className="space-y-0.5">
                <video
                  src={u}
                  controls
                  className="w-full h-auto rounded block"
                  style={{ background: '#000', objectFit: 'contain', maxHeight: 480 }}
                />
                <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                  <span className="truncate flex-1" title={u}>{u.split('/').pop()}</span>
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                      isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'
                    }`}
                  >
                    <Download size={10} /> 下载
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 音频区 */}
        {collected.audios.length > 0 && (
          <div className="space-y-1">
            <div className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>
              <Music size={11} />
              <span>音频 ({collected.audios.length})</span>
            </div>
            {collected.audios.map((u, i) => (
              <div key={i} className="space-y-0.5">
                <audio src={u} controls className="w-full" />
                <div className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-white/40' : 'text-zinc-400'}`}>
                  <span className="truncate flex-1" title={u}>{u.split('/').pop()}</span>
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                      isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-zinc-600'
                    }`}
                  >
                    <Download size={10} /> 下载
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(OutputNode);

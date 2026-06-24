import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Box,
  Crosshair,
  ExternalLink,
  FileText,
  History,
  Image as ImageIcon,
  Music,
  Video,
  X,
} from 'lucide-react';
import {
  GENERATION_HISTORY_KIND_LABELS,
  GENERATION_HISTORY_KIND_ORDER,
  GENERATION_HISTORY_LIMITS,
  countGenerationHistoryByKind,
  type GenerationHistoryItem,
  type GenerationHistoryKind,
  type GenerationHistoryTab,
} from '../utils/generationHistory';

interface GenerationHistoryPanelProps {
  open: boolean;
  items: GenerationHistoryItem[];
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
}

function HistoryKindIcon({ kind, size = 15 }: { kind: GenerationHistoryTab; size?: number }) {
  if (kind === 'image') return <ImageIcon size={size} />;
  if (kind === 'video') return <Video size={size} />;
  if (kind === 'audio') return <Music size={size} />;
  if (kind === 'text') return <FileText size={size} />;
  if (kind === 'model3d') return <Box size={size} />;
  return <History size={size} />;
}

function renderPreview(item: GenerationHistoryItem) {
  if (item.kind === 'image' && item.url) {
    return (
      <img
        src={item.url}
        alt={item.title}
        loading="lazy"
        className="t8-generation-history-thumb"
      />
    );
  }
  if (item.kind === 'video' && item.url) {
    return (
      <video
        src={item.url}
        className="t8-generation-history-thumb"
        controls
        muted
        preload="metadata"
      />
    );
  }
  if (item.kind === 'audio' && item.url) {
    return (
      <div className="t8-generation-history-audio">
        <Music size={18} />
        <audio src={item.url} controls preload="none" />
      </div>
    );
  }
  if (item.kind === 'text') {
    return <p className="t8-generation-history-text">{item.textPreview}</p>;
  }
  return (
    <div className="t8-generation-history-file">
      <HistoryKindIcon kind={item.kind} size={18} />
      <span>{item.fileName || item.title}</span>
    </div>
  );
}

export default function GenerationHistoryPanel({
  open,
  items,
  onClose,
  onFocusNode,
}: GenerationHistoryPanelProps) {
  const [activeKind, setActiveKind] = useState<GenerationHistoryTab>('all');
  const [visibleLimit, setVisibleLimit] = useState(GENERATION_HISTORY_LIMITS.visiblePageSize);
  const [panelPosition, setPanelPosition] = useState({ top: 64, right: 12, maxHeight: 620 });
  const counts = useMemo(() => countGenerationHistoryByKind(items), [items]);
  const tabs = useMemo<GenerationHistoryTab[]>(() => ['all', ...GENERATION_HISTORY_KIND_ORDER], []);
  const filteredItems = useMemo(
    () => (activeKind === 'all' ? items : items.filter((item) => item.kind === activeKind)),
    [activeKind, items],
  );
  const visibleItems = filteredItems.slice(0, visibleLimit);
  const hasMore = visibleItems.length < filteredItems.length;

  useEffect(() => {
    if (open) setVisibleLimit(GENERATION_HISTORY_LIMITS.visiblePageSize);
  }, [activeKind, open, items.length]);

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return;
    let raf = 0;
    const updatePosition = () => {
      const toolbar = document.querySelector('.t8-canvas-toolbar');
      const rect = toolbar?.getBoundingClientRect();
      const top = Math.max(56, Math.round((rect?.bottom ?? 52) + 8));
      const right = Math.max(10, Math.round(window.innerWidth - (rect?.right ?? window.innerWidth - 12)));
      setPanelPosition({
        top,
        right,
        maxHeight: Math.max(220, Math.round(window.innerHeight - top - 12)),
      });
    };
    const schedule = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(updatePosition);
    };
    updatePosition();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open]);

  if (!open) return null;

  return (
    <aside
      className="t8-generation-history-panel nodrag nopan"
      data-canvas-floating-ui="generation-history"
      role="dialog"
      aria-label="历史记录"
      style={{
        top: panelPosition.top,
        right: panelPosition.right,
        maxHeight: panelPosition.maxHeight,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="t8-generation-history-header">
        <div>
          <span>历史记录</span>
          <strong>{counts.all}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭历史记录" title="关闭">
          <X size={15} />
        </button>
      </header>

      <nav className="t8-generation-history-tabs" aria-label="历史记录分类">
        {tabs.map((kind) => (
          <button
            key={kind}
            type="button"
            className={activeKind === kind ? 'is-active' : ''}
            data-history-kind={kind}
            onClick={() => setActiveKind(kind)}
            aria-pressed={activeKind === kind}
            title={GENERATION_HISTORY_KIND_LABELS[kind]}
          >
            <HistoryKindIcon kind={kind} size={14} />
            <span>{GENERATION_HISTORY_KIND_LABELS[kind]}</span>
            <b>{counts[kind]}</b>
          </button>
        ))}
      </nav>

      <div className="t8-generation-history-grid" data-history-visible-count={visibleItems.length}>
        {visibleItems.map((item) => (
          <article key={item.id} className="t8-generation-history-item" data-history-kind={item.kind as GenerationHistoryKind}>
            <div className="t8-generation-history-preview">{renderPreview(item)}</div>
            <div className="t8-generation-history-meta">
              <div className="t8-generation-history-title" title={item.title}>
                <HistoryKindIcon kind={item.kind} size={13} />
                <span>{item.title}</span>
              </div>
              <div className="t8-generation-history-source" title={item.subtitle}>
                {item.subtitle}
              </div>
              <div className="t8-generation-history-actions">
                <button type="button" onClick={() => onFocusNode(item.nodeId)} title="定位来源节点">
                  <Crosshair size={12} />
                  <span>定位</span>
                </button>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer" title="打开素材">
                    <ExternalLink size={12} />
                    <span>打开</span>
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
        {visibleItems.length === 0 && (
          <div className="t8-generation-history-empty">
            <History size={18} />
            <span>暂无记录</span>
          </div>
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          className="t8-generation-history-more"
          onClick={() => setVisibleLimit((value) => value + GENERATION_HISTORY_LIMITS.visiblePageSize)}
        >
          显示更多
        </button>
      )}
    </aside>
  );
}

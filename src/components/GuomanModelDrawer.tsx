import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Star, StarOff, Search, X, Loader2, Palette, ImageIcon } from 'lucide-react';
import { useThemeStore } from '../stores/theme';
import { useGuomanFavoritesStore } from '../stores/guomanFavorites';
import { getGuomanModels, type GuomanModel } from '../services/api';

interface GuomanModelDrawerProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = 'all' | 'favorites';

export default function GuomanModelDrawer({ open, onClose }: GuomanModelDrawerProps) {
  const { theme, style } = useThemeStore();
  const isDark = theme === 'dark';
  const isPixel = style === 'pixel';

  // 收藏状态
  const favoriteIds = useGuomanFavoritesStore((s) => s.favoriteIds);
  const toggleFavorite = useGuomanFavoritesStore((s) => s.toggleFavorite);
  const isFavorite = useGuomanFavoritesStore((s) => s.isFavorite);

  // Tab 切换
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // 搜索
  const [searchText, setSearchText] = useState('');

  // 模型数据（全部模型，分页加载）
  const [models, setModels] = useState<GuomanModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 无限滚动
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 预览大图
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 防抖搜索
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  // 重置并重新加载（搜索或切换 tab 时）
  const resetAndLoad = useCallback(() => {
    setModels([]);
    setPage(1);
    setTotalPages(1);
    setTotal(0);
    setError(null);
  }, []);

  // 搜索关键词变化时重置
  useEffect(() => {
    if (open) resetAndLoad();
  }, [debouncedSearch, open, resetAndLoad]);

  // 加载一页数据
  const loadPage = useCallback(async (pageNum: number) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getGuomanModels(pageNum, 30, debouncedSearch || undefined);
      if (result.success) {
        const data = result.data;
        setModels((prev) => (pageNum === 1 ? data.records : [...prev, ...data.records]));
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setPage(pageNum);
      } else {
        setError(result.error);
      }
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, loading]);

  // 初始加载 / 搜索重置后加载第一页
  useEffect(() => {
    if (open && models.length === 0 && !loading) {
      loadPage(1);
    }
  }, [open, models.length, loading, loadPage]);

  // 无限滚动：观察 sentinel 元素
  useEffect(() => {
    if (!open || activeTab !== 'all') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && page < totalPages) {
          loadPage(page + 1);
        }
      },
      { root: scrollRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, activeTab, loading, page, totalPages, loadPage]);

  // 收藏模型列表（从全部模型中过滤）
  const favoriteModels = useMemo(() => {
    return models.filter((m) => favoriteIds.includes(m.id));
  }, [models, favoriteIds]);

  // 当前 tab 显示的模型
  const displayModels = activeTab === 'all' ? models : favoriteModels;

  // ESC 键关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 不渲染时早退
  if (!open) return null;

  // 样式定义
  const panelCls = isPixel
    ? 'bg-[var(--px-surface)] text-[var(--px-ink)] border-l-2 border-[var(--px-ink)]'
    : isDark
      ? 'bg-zinc-950 text-zinc-100 border-l border-white/10'
      : 'bg-white text-zinc-900 border-l border-black/10';

  const headerCls = isPixel
    ? 'border-b-2 border-[var(--px-ink)] bg-[var(--px-muted)]'
    : isDark
      ? 'border-b border-white/10 bg-zinc-900/50'
      : 'border-b border-black/10 bg-zinc-50/80';

  const tabBtnCls = (active: boolean) =>
    isPixel
      ? `px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
          active
            ? 'bg-[var(--px-ink)] text-[var(--px-surface)]'
            : 'text-[var(--px-ink-soft)] hover:bg-[var(--px-muted)]'
        }`
      : `px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
          active
            ? isDark
              ? 'bg-white/15 text-white'
              : 'bg-black/10 text-zinc-900'
            : isDark
              ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              : 'text-zinc-500 hover:text-zinc-700 hover:bg-black/5'
        }`;

  const searchInputCls = isPixel
    ? 'w-full px-3 py-2 text-xs bg-[var(--px-surface)] border-2 border-[var(--px-ink)] rounded-lg text-[var(--px-ink)] placeholder-[var(--px-ink-soft)] outline-none focus:border-[var(--px-mint)]'
    : `w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors ${
        isDark
          ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-500 focus:border-white/30'
          : 'bg-white border-black/10 text-zinc-900 placeholder-zinc-400 focus:border-black/25'
      }`;

  const cardCls = isPixel
    ? 'group relative rounded-xl overflow-hidden border-2 border-[var(--px-ink)] bg-[var(--px-surface)] hover:border-[var(--px-mint)] transition-colors cursor-pointer'
    : `group relative rounded-xl overflow-hidden border transition-all cursor-pointer ${
        isDark
          ? 'border-white/8 bg-zinc-900/60 hover:border-white/20 hover:shadow-lg hover:shadow-black/30'
          : 'border-black/8 bg-white hover:border-black/15 hover:shadow-lg hover:shadow-black/10'
      }`;

  const nameCls = isPixel
    ? 'text-[11px] font-semibold text-[var(--px-ink)] truncate px-2 py-1.5 bg-[var(--px-muted)]'
    : `text-[11px] font-semibold truncate px-2 py-1.5 ${
        isDark ? 'text-zinc-200 bg-zinc-800/80' : 'text-zinc-700 bg-zinc-50'
      }`;

  const emptyCls = isPixel
    ? 'text-[var(--px-ink-soft)] text-xs'
    : isDark
      ? 'text-zinc-500 text-xs'
      : 'text-zinc-400 text-xs';

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className={`fixed inset-0 z-40 ${isPixel ? 'px-modal-mask' : 'bg-black/30'}`}
        onClick={onClose}
      />

      {/* 抽屉面板 */}
      <div
        data-guoman-drawer
        className={`fixed top-0 right-0 z-50 h-screen w-[400px] max-w-[calc(100vw-18px)] flex flex-col ${panelCls}`}
        style={{ animation: 't8-slide-in-right 0.2s ease-out' }}
      >
        {/* 头部 */}
        <div className={`flex items-center justify-between px-4 py-3 ${headerCls}`}>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Palette size={16} />
            国漫模型
            {total > 0 && (
              <span
                className={`text-[10px] font-normal px-1.5 py-0.5 rounded-full ${
                  isPixel
                    ? 'bg-[var(--px-yellow)] text-[var(--px-ink)] border border-[var(--px-ink)]'
                    : isDark
                      ? 'bg-white/10 text-zinc-400'
                      : 'bg-black/5 text-zinc-500'
                }`}
              >
                {total}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={
              isPixel
                ? 'px-btn px-btn--icon px-btn--ghost'
                : `p-1 rounded transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`
            }
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className={`flex items-center gap-1 px-4 py-2 ${headerCls}`}>
          <button
            className={tabBtnCls(activeTab === 'all')}
            onClick={() => setActiveTab('all')}
          >
            全部模型
          </button>
          <button
            className={tabBtnCls(activeTab === 'favorites')}
            onClick={() => setActiveTab('favorites')}
          >
            收藏模型
            {favoriteIds.length > 0 && (
              <span className="ml-1 text-[10px] opacity-70">({favoriteIds.length})</span>
            )}
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search
              size={14}
              className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
                isPixel ? 'text-[var(--px-ink-soft)]' : isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            />
            <input
              type="text"
              placeholder="搜索模型名称..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={`${searchInputCls} pl-8 pr-8`}
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 ${
                  isPixel ? 'text-[var(--px-ink-soft)]' : isDark ? 'text-zinc-500' : 'text-zinc-400'
                }`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* 模型网格 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2">
          {/* 空状态 */}
          {!loading && displayModels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ImageIcon size={40} className={emptyCls} />
              <span className={emptyCls}>
                {activeTab === 'favorites'
                  ? '还没有收藏模型，点击星标收藏吧'
                  : error
                    ? error
                    : '没有找到模型'}
              </span>
            </div>
          )}

          {/* 模型卡片网格 */}
          <div className="grid grid-cols-2 gap-2.5">
            {displayModels.map((model) => (
              <div
                key={model.id}
                className={cardCls}
                onClick={() => setPreviewUrl(model.posterUrl)}
              >
                {/* 封面图 */}
                <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={model.thumbnailUrl}
                    alt={model.resourceName}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      // 图片加载失败时显示占位
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />

                  {/* 收藏按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(model.id);
                    }}
                    className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-all ${
                      isFavorite(model.id)
                        ? isPixel
                          ? 'bg-[var(--px-yellow)] text-[var(--px-ink)]'
                          : 'bg-amber-500/90 text-white'
                        : isPixel
                          ? 'bg-[var(--px-surface)]/80 text-[var(--px-ink-soft)] hover:bg-[var(--px-yellow)]'
                          : isDark
                            ? 'bg-black/40 text-zinc-400 hover:text-amber-400 hover:bg-black/60'
                            : 'bg-white/60 text-zinc-400 hover:text-amber-500 hover:bg-white/80'
                    }`}
                    title={isFavorite(model.id) ? '取消收藏' : '收藏'}
                  >
                    {isFavorite(model.id) ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
                  </button>
                </div>

                {/* 模型名称 */}
                <div className={nameCls} title={model.resourceName}>
                  {model.resourceName}
                </div>
              </div>
            ))}
          </div>

          {/* 加载指示器 */}
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2
                size={16}
                className={`animate-spin ${isPixel ? 'text-[var(--px-ink)]' : isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
              />
              <span className={`text-xs ${isPixel ? 'text-[var(--px-ink-soft)]' : isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                加载中...
              </span>
            </div>
          )}

          {/* 无限滚动哨兵 */}
          {activeTab === 'all' && <div ref={sentinelRef} className="h-1" />}

          {/* 已加载全部 */}
          {activeTab === 'all' && !loading && models.length > 0 && page >= totalPages && (
            <div className={`text-center py-4 text-[11px] ${emptyCls}`}>
              已加载全部 {total} 个模型
            </div>
          )}
        </div>
      </div>

      {/* 大图预览 */}
      {previewUrl && (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center ${isPixel ? 'px-modal-mask' : 'bg-black/70'}`}
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="模型预览"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Star, StarOff, Search, X, Loader2, Palette, ImageIcon, Play, Maximize2, Minimize2 } from 'lucide-react';
import { useThemeStore } from '../stores/theme';
import { useGuomanFavoritesStore } from '../stores/guomanFavorites';
import { getGuomanModels, type GuomanModel } from '../services/api';

interface GuomanModelDrawerProps {
  open: boolean;
  onClose: () => void;
  onAddNode?: (type: string, options?: { data?: Record<string, any> }) => void;
}

type TabKey = 'all' | 'favorites';

/** 从模型对象中提取文件名（与 GuomanModelPickerModal 一致） */
function extractModelFileName(model: GuomanModel): string {
  const rawName = model.versions?.[0]?.versionResourceName || model.versions?.[0]?.resourceStorageName || '';
  return rawName ? rawName.replace(/^.*[\\/]/, '') : model.resourceName;
}

export default function GuomanModelDrawer({ open, onClose, onAddNode }: GuomanModelDrawerProps) {
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

  // 展开模式（居中铺满，多列显示）
  const [expanded, setExpanded] = useState(false);

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

  // 点击"去使用"按钮 → 创建国漫文生图节点
  const handleUseModel = (model: GuomanModel) => {
    if (!onAddNode) return;
    const modelFileName = extractModelFileName(model);
    onAddNode('guoman-char-1', {
      data: {
        paramValues: {
          '1569::lora_name': { value: modelFileName },
        },
      },
    });
    onClose();
  };

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

  // ====== 主题色变量 ======
  const accent = '#f97316'; // orange-500
  const accentLight = '#fb923c'; // orange-400

  // 面板背景
  const panelBg = isPixel ? 'var(--px-surface)' : isDark ? '#09090b' : '#ffffff';
  const panelText = isPixel ? 'var(--px-ink)' : isDark ? '#f4f4f5' : '#18181b';
  const panelBorder = isPixel ? '2px solid var(--px-ink)' : isDark ? '1px solid rgba(255,255,255,.08)' : '1px solid rgba(0,0,0,.08)';

  // 头部背景
  const headerBg = isPixel ? 'var(--px-muted)' : isDark ? 'rgba(24,24,27,.8)' : 'rgba(249,250,251,.9)';
  const headerBorder = isPixel ? '2px solid var(--px-ink)' : isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(0,0,0,.06)';

  // 输入框
  const inputBg = isPixel ? 'var(--px-surface)' : isDark ? 'rgba(255,255,255,.06)' : '#fff';
  const inputBorder = isPixel ? '2px solid var(--px-ink)' : isDark ? '1px solid rgba(255,255,255,.1)' : '1px solid rgba(0,0,0,.1)';
  const inputText = isPixel ? 'var(--px-ink)' : isDark ? '#fff' : '#18181b';
  const mutedText = isPixel ? 'var(--px-ink-soft)' : isDark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.4)';

  // 卡片
  const cardBg = isPixel ? 'var(--px-surface)' : isDark ? '#18181b' : '#fff';
  const cardBorder = isPixel ? '2px solid var(--px-ink)' : isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(0,0,0,.06)';
  const cardBorderHover = isPixel ? '2px solid var(--px-mint)' : isDark ? `1px solid ${accent}` : `1px solid ${accent}`;

  // 名称区域
  const nameBg = isPixel ? 'var(--px-muted)' : isDark ? 'rgba(24,24,27,.9)' : 'rgba(249,250,251,.95)';
  const nameText = isPixel ? 'var(--px-ink)' : isDark ? '#e4e4e7' : '#3f3f46';

  return (
    <>
      {/* 背景遮罩 */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: expanded ? 9998 : 40,
          background: isPixel ? 'var(--px-modal-mask, rgba(0,0,0,.5))' : 'rgba(0,0,0,.35)',
        }}
        onClick={onClose}
      />

      {/* 面板（抽屉模式 / 展开模式） */}
      <div
        data-guoman-drawer
        style={expanded ? {
          position: 'fixed', inset: 20, zIndex: 9999,
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          background: panelBg, color: panelText,
          border: panelBorder,
          boxShadow: isDark ? '0 40px 120px rgba(0,0,0,.8)' : '0 40px 120px rgba(0,0,0,.2)',
          animation: 'guoman-expand-in .25s ease-out',
        } : {
          position: 'fixed', top: 0, right: 0, zIndex: 50,
          height: '100vh', width: 420, maxWidth: 'calc(100vw - 18px)',
          display: 'flex', flexDirection: 'column',
          background: panelBg, color: panelText,
          borderLeft: panelBorder,
          animation: 't8-slide-in-right 0.2s ease-out',
        }}
      >
        {/* ====== 头部 ====== */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: headerBg, borderBottom: headerBorder,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDark ? 'rgba(249,115,22,.15)' : 'rgba(249,115,22,.1)',
              color: accent, boxShadow: `inset 0 0 0 1px ${isDark ? 'rgba(249,115,22,.3)' : 'rgba(249,115,22,.2)'}`,
            }}>
              <Palette size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>国漫模型</div>
              {total > 0 && (
                <div style={{ fontSize: 10, color: mutedText, lineHeight: 1.3 }}>共 {total} 个模型</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* 展开/收起按钮 */}
            <button
              onClick={() => setExpanded(!expanded)}
              title={expanded ? '收起为侧栏' : '展开铺满'}
              style={{
                width: 28, height: 28, borderRadius: 6, border: 'none',
                background: 'transparent', color: mutedText, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 6, border: 'none',
                background: 'transparent', color: mutedText, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ====== Tab 切换 ====== */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', background: headerBg, borderBottom: headerBorder,
        }}>
          {(['all', 'favorites'] as TabKey[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  background: active
                    ? (isDark ? 'rgba(249,115,22,.2)' : 'rgba(249,115,22,.12)')
                    : 'transparent',
                  color: active
                    ? accent
                    : (isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)'),
                }}
              >
                {tab === 'all' ? '全部模型' : '收藏模型'}
                {tab === 'favorites' && favoriteIds.length > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 10, opacity: .7 }}>({favoriteIds.length})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ====== 搜索框 ====== */}
        <div style={{ padding: '10px 16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: mutedText, pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="搜索模型名称..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%', height: 36, paddingLeft: 34, paddingRight: searchText ? 34 : 10,
                fontSize: 12, color: inputText, background: inputBg,
                border: inputBorder, borderRadius: 10, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color .15s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'; }}
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 20, height: 20, borderRadius: '50%', border: 'none',
                  background: 'transparent', color: mutedText, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ====== 模型网格 ====== */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {/* 空状态 */}
          {!loading && displayModels.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12 }}>
              <ImageIcon size={40} style={{ color: mutedText }} />
              <span style={{ fontSize: 12, color: mutedText }}>
                {activeTab === 'favorites'
                  ? '还没有收藏模型，点击星标收藏吧'
                  : error || '没有找到模型'}
              </span>
            </div>
          )}

          {/* 模型卡片网格 */}
          <div style={{ display: 'grid', gridTemplateColumns: expanded ? 'repeat(auto-fill, minmax(200px, 1fr))' : 'repeat(2, 1fr)', gap: expanded ? 14 : 12 }}>
            {displayModels.map((model) => {
              const isFav = isFavorite(model.id);
              return (
                <div
                  key={model.id}
                  className="guoman-card"
                  style={{
                    borderRadius: 12, overflow: 'hidden',
                    border: cardBorder, background: cardBg,
                    transition: 'border-color .2s, box-shadow .2s, transform .2s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.border = cardBorderHover;
                    e.currentTarget.style.boxShadow = isDark
                      ? `0 8px 24px rgba(249,115,22,.12)`
                      : `0 8px 24px rgba(249,115,22,.1)`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.border = cardBorder;
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* 封面图（点击预览） */}
                  <div
                    style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: isDark ? '#1a1a1f' : '#f0f0f0', cursor: 'pointer' }}
                    onClick={() => setPreviewUrl(model.posterUrl)}
                  >
                    <img
                      src={model.thumbnailUrl}
                      alt={model.resourceName}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />

                    {/* 收藏按钮（独立层级，不被遮罩覆盖） */}
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleFavorite(model.id); }}
                      style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 10,
                        width: 28, height: 28, borderRadius: '50%', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all .15s',
                        background: isFav
                          ? 'rgba(245,158,11,.92)'
                          : isDark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.7)',
                        color: isFav ? '#fff' : (isDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.4)'),
                        boxShadow: isFav ? '0 2px 8px rgba(245,158,11,.4)' : '0 1px 4px rgba(0,0,0,.15)',
                      }}
                      title={isFav ? '取消收藏' : '收藏'}
                    >
                      {isFav ? <Star size={13} fill="currentColor" /> : <StarOff size={13} />}
                    </button>

                    {/* Hover 遮罩 + "去使用"按钮（pointer-events 默认关闭，hover 时才开启） */}
                    <div
                      className="guoman-card-overlay"
                      style={{
                        position: 'absolute', inset: 0, zIndex: 5,
                        background: 'linear-gradient(to top, rgba(0,0,0,.7) 0%, rgba(0,0,0,.2) 40%, transparent 70%)',
                        opacity: 0, pointerEvents: 'none', transition: 'opacity .2s',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        padding: '0 10px 10px',
                      }}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUseModel(model); }}
                        className="guoman-use-btn"
                        style={{
                          width: '100%', height: 32, borderRadius: 8, border: 'none',
                          background: `linear-gradient(135deg, ${accent}, ${accentLight})`,
                          color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          boxShadow: '0 2px 8px rgba(249,115,22,.4)',
                          transform: 'translateY(6px)', transition: 'transform .2s',
                        }}
                      >
                        <Play size={12} /> 去使用
                      </button>
                    </div>
                  </div>

                  {/* 模型名称 */}
                  <div style={{
                    padding: '8px 10px', fontSize: 11, fontWeight: 600,
                    color: nameText, background: nameBg,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }} title={model.resourceName}>
                    {model.resourceName}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 加载指示器 */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0', gap: 8 }}>
              <Loader2 size={16} style={{ color: mutedText, animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: mutedText }}>加载中...</span>
            </div>
          )}

          {/* 无限滚动哨兵 */}
          {activeTab === 'all' && <div ref={sentinelRef} style={{ height: 1 }} />}

          {/* 已加载全部 */}
          {activeTab === 'all' && !loading && models.length > 0 && page >= totalPages && (
            <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: mutedText }}>
              已加载全部 {total} 个模型
            </div>
          )}
        </div>
      </div>

      {/* 大图预览 */}
      {previewUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,.75)',
          }}
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="模型预览"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewUrl(null)}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: 'rgba(0,0,0,.5)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,.7)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,.5)'; }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Hover 效果 CSS */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes guoman-expand-in { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
        .guoman-card:hover .guoman-card-overlay {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        .guoman-card:hover .guoman-use-btn {
          transform: translateY(0) !important;
        }
      `}</style>
    </>
  );
}

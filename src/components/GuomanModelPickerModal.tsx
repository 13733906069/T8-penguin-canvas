/**
 * GuomanModelPickerModal - 国漫模型选择弹窗（全屏大面板版）
 *
 * 参考布局：左侧分类导航 + 右侧大封面卡片网格
 * 支持：搜索、懒加载无限滚动、收藏、大图预览
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, StarOff, Search, X, Loader2, ImageIcon, Heart, Sparkles } from 'lucide-react';
import { useThemeStore } from '../stores/theme';
import { useGuomanFavoritesStore } from '../stores/guomanFavorites';
import { getGuomanModels, type GuomanModel } from '../services/api';

interface GuomanModelPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (modelName: string) => void;
  currentModel?: string;
}

type TabKey = 'all' | 'favorites';

export default function GuomanModelPickerModal({ open, onClose, onSelect, currentModel }: GuomanModelPickerModalProps) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const favoriteIds = useGuomanFavoritesStore((s) => s.favoriteIds);
  const toggleFavorite = useGuomanFavoritesStore((s) => s.toggleFavorite);
  const isFavorite = useGuomanFavoritesStore((s) => s.isFavorite);

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchText, setSearchText] = useState('');

  const [models, setModels] = useState<GuomanModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 防抖搜索
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  const resetAndLoad = useCallback(() => {
    setModels([]);
    setPage(1);
    setTotalPages(1);
    setTotal(0);
    setError(null);
  }, []);

  useEffect(() => {
    if (open) resetAndLoad();
  }, [debouncedSearch, open, resetAndLoad]);

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

  useEffect(() => {
    if (open && models.length === 0 && !loading) loadPage(1);
  }, [open, models.length, loading, loadPage]);

  // 无限滚动
  useEffect(() => {
    if (!open || activeTab !== 'all') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && page < totalPages) loadPage(page + 1);
      },
      { root: scrollRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, activeTab, loading, page, totalPages, loadPage]);

  const favoriteModels = useMemo(() => models.filter((m) => favoriteIds.includes(m.id)), [models, favoriteIds]);
  const displayModels = activeTab === 'all' ? models : favoriteModels;

  // ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // 主题色
  const isDT = isDark;
  const overlay = isDT ? 'rgba(0,0,0,.75)' : 'rgba(0,0,0,.5)';
  const panelBg = isDT ? '#111114' : '#f5f5f5';
  const sidebarBg = isDT ? '#0d0d0f' : '#ebebeb';
  const cardBg = isDT ? '#1a1a1f' : '#ffffff';
  const text = isDT ? '#eee' : '#1a1a1a';
  const muted = isDT ? 'rgba(255,255,255,.38)' : 'rgba(0,0,0,.35)';
  const bd = isDT ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)';
  const inputBg = isDT ? 'rgba(255,255,255,.06)' : '#fff';
  const inputBd = isDT ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)';
  const accent = '#f97316';
  const favBg = isDT ? 'rgba(245,158,11,.12)' : 'rgba(245,158,11,.08)';
  const favText = '#f59e0b';

  const COLS = 5; // 5列大卡片

  // 左侧导航项
  const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: '全部模型', icon: <Sparkles size={14} /> },
    { key: 'favorites', label: '我的收藏', icon: <Heart size={14} /> },
  ];

  return createPortal(
    <>
      {/* 遮罩 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: overlay }} onClick={onClose} />

      {/* 全屏面板 */}
      <div style={{
        position: 'fixed', inset: 20, zIndex: 10001,
        background: panelBg, borderRadius: 16,
        border: `1px solid ${isDT ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
        boxShadow: isDT ? '0 40px 120px rgba(0,0,0,.8)' : '0 40px 120px rgba(0,0,0,.25)',
        display: 'flex', overflow: 'hidden',
        animation: 'gmpm-in .2s ease-out',
      }}>

        {/* ===== 左侧导航 ===== */}
        <div style={{
          width: 200, flexShrink: 0, background: sidebarBg,
          borderRight: `1px solid ${bd}`,
          display: 'flex', flexDirection: 'column',
          padding: '0',
        }}>
          {/* Logo 区 */}
          <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${bd}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🎨</span>
              模型库
            </div>
            {total > 0 && <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>共 {total} 个模型</div>}
          </div>

          {/* 导航列表 */}
          <div style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              const count = item.key === 'favorites' ? favoriteIds.length : total;
              return (
                <button key={item.key} onClick={() => setActiveTab(item.key)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: 'none',
                  background: isActive ? (isDT ? 'rgba(249,115,22,.12)' : 'rgba(249,115,22,.08)') : 'transparent',
                  color: isActive ? accent : muted, cursor: 'pointer',
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  transition: 'all .15s', textAlign: 'left',
                }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = isDT ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : .6 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {count > 0 && <span style={{ fontSize: 10, opacity: .5 }}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== 右侧主内容 ===== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* 顶部栏：搜索 + 关闭 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 20px', borderBottom: `1px solid ${bd}`,
          }}>
            {/* 搜索框 */}
            <div style={{ flex: 1, position: 'relative', maxWidth: 400 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: muted, pointerEvents: 'none' }} />
              <input type="text" placeholder="搜索模型名称..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
                style={{
                  width: '100%', height: 38, paddingLeft: 38, paddingRight: searchText ? 32 : 12,
                  fontSize: 13, color: text, background: inputBg, border: `1px solid ${inputBd}`,
                  borderRadius: 10, outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = inputBd; }}
              />
              {searchText && (
                <button onClick={() => setSearchText('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'transparent', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                ><X size={14} /></button>
              )}
            </div>

            {/* 当前选中 */}
            {currentModel && (
              <div style={{ fontSize: 12, color: accent, fontWeight: 600, whiteSpace: 'nowrap' }}>
                当前：{currentModel}
              </div>
            )}

            {/* 关闭 */}
            <button onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${bd}`, background: 'transparent', color: muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDT ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            ><X size={18} /></button>
          </div>

          {/* 模型网格 */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

            {/* 空状态 */}
            {!loading && displayModels.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14 }}>
                <ImageIcon size={48} style={{ color: muted }} />
                <span style={{ fontSize: 14, color: muted }}>
                  {activeTab === 'favorites' ? '还没有收藏模型，点击星标收藏吧' : error || '没有找到模型'}
                </span>
              </div>
            )}

            {/* 卡片网格 */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 14 }}>
              {displayModels.map((model) => {
                // 取第一个版本的 versionResourceName，去掉路径前缀只保留文件名
                const rawName = model.versions?.[0]?.versionResourceName || model.versions?.[0]?.resourceStorageName || '';
                const modelFileName = rawName ? rawName.replace(/^.*[\\/]/, '') : model.resourceName;
                const isSelected = currentModel === modelFileName;
                const isFav = isFavorite(model.id);
                return (
                  <div key={model.id}
                    onClick={() => { onSelect(modelFileName); onClose(); }}
                    style={{
                      borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                      border: `2px solid ${isSelected ? accent : bd}`,
                      background: cardBg, transition: 'border-color .15s, transform .15s, box-shadow .15s',
                      boxShadow: isSelected ? `0 0 0 1px ${accent}, 0 8px 24px rgba(249,115,22,.15)` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = isDT ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = isDT ? '0 8px 24px rgba(0,0,0,.4)' : '0 8px 24px rgba(0,0,0,.1)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = bd;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = isSelected ? `0 0 0 1px ${accent}, 0 8px 24px rgba(249,115,22,.15)` : 'none';
                    }}
                  >
                    {/* 封面图 */}
                    <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: isDT ? '#1a1a1f' : '#f0f0f0' }}>
                      <img src={model.thumbnailUrl} alt={model.resourceName} loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />

                      {/* 收藏按钮 */}
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(model.id); }}
                        style={{
                          position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%',
                          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .15s',
                          background: isFav ? 'rgba(245,158,11,.92)' : isDT ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.8)',
                          color: isFav ? '#fff' : muted,
                          boxShadow: isFav ? '0 3px 10px rgba(245,158,11,.4)' : '0 2px 6px rgba(0,0,0,.2)',
                        }} title={isFav ? '取消收藏' : '收藏'}
                      >
                        {isFav ? <Star size={15} fill="currentColor" /> : <StarOff size={15} />}
                      </button>

                      {/* 选中标记 */}
                      {isSelected && (
                        <div style={{
                          position: 'absolute', bottom: 8, left: 8,
                          padding: '3px 10px', borderRadius: 6,
                          background: accent, color: '#fff', fontSize: 11, fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(0,0,0,.25)',
                        }}>
                          ✓ 当前使用
                        </div>
                      )}
                    </div>

                    {/* 模型名称 */}
                    <div style={{
                      padding: '10px 10px', fontSize: 12, fontWeight: 600, color: text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      borderTop: `1px solid ${bd}`,
                    }} title={`${model.resourceName}\n${modelFileName}`}>
                      {model.resourceName}
                      {modelFileName !== model.resourceName && (
                        <div style={{ fontSize: 9, color: muted, marginTop: 2, fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {modelFileName}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 加载中 */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 8 }}>
                <Loader2 size={16} style={{ color: muted, animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12, color: muted }}>加载中...</span>
              </div>
            )}

            {/* 哨兵 */}
            {activeTab === 'all' && <div ref={sentinelRef} style={{ height: 1 }} />}

            {/* 已加载全部 */}
            {activeTab === 'all' && !loading && models.length > 0 && page >= totalPages && (
              <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: muted }}>
                已加载全部 {total} 个模型
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gmpm-in { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>,
    document.body
  );
}

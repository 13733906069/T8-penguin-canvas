import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 国漫模型收藏状态管理
 * 使用 localStorage 持久化收藏的模型 ID 列表
 */
interface GuomanFavoritesState {
  /** 已收藏的模型 ID 集合（序列化为数组存储） */
  favoriteIds: string[];
  /** 切换收藏状态 */
  toggleFavorite: (id: string) => void;
  /** 判断是否已收藏 */
  isFavorite: (id: string) => boolean;
  /** 获取收藏数量 */
  getCount: () => number;
}

export const useGuomanFavoritesStore = create<GuomanFavoritesState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],

      toggleFavorite: (id: string) => {
        set((state) => {
          const exists = state.favoriteIds.includes(id);
          return {
            favoriteIds: exists
              ? state.favoriteIds.filter((fid) => fid !== id)
              : [...state.favoriteIds, id],
          };
        });
      },

      isFavorite: (id: string) => {
        return get().favoriteIds.includes(id);
      },

      getCount: () => {
        return get().favoriteIds.length;
      },
    }),
    {
      name: 't8-guoman-favorites',
      partialize: (state) => ({ favoriteIds: state.favoriteIds }),
    },
  ),
);

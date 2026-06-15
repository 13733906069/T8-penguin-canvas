import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getTaskCompletionSoundSettings, type TaskCompletionSoundSettings } from '../services/api';
import {
  isCompletionSoundEligibleNodeType,
  playTaskCompletionSound,
  primeTaskCompletionSoundAudio,
  resolveCompletionSoundNodeType,
  shouldNotifyCompletionSoundForNodeType,
} from '../utils/taskCompletionSound';

const completionSoundNodeTypes = new Map<string, string>();
const TASK_COMPLETION_SOUND_SETTINGS_TTL_MS = 30_000;
const DEFAULT_TASK_COMPLETION_SOUND_SETTINGS: TaskCompletionSoundSettings = { mode: 'default', url: '' };

interface TaskCompletionSoundState {
  enabled: boolean;
  lastPlayedAt: number;
  soundSettings: TaskCompletionSoundSettings;
  soundSettingsLoadedAt: number;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  loadSoundSettings: (force?: boolean) => Promise<TaskCompletionSoundSettings>;
  primeAudio: () => void;
  notifyComplete: (nodeId: string, fallbackNodeType?: string, now?: number) => void;
}

export function registerTaskCompletionSoundNode(nodeId: string, nodeType?: string | null): () => void {
  if (nodeId && isCompletionSoundEligibleNodeType(nodeType)) {
    completionSoundNodeTypes.set(nodeId, String(nodeType));
  } else {
    completionSoundNodeTypes.delete(nodeId);
  }
  return () => {
    completionSoundNodeTypes.delete(nodeId);
  };
}

export const useTaskCompletionSoundStore = create<TaskCompletionSoundState>()(
  persist(
    (set, get) => ({
      enabled: true,
      lastPlayedAt: 0,
      soundSettings: DEFAULT_TASK_COMPLETION_SOUND_SETTINGS,
      soundSettingsLoadedAt: 0,
      setEnabled: (enabled) => set({ enabled }),
      toggleEnabled: () => set((state) => ({ enabled: !state.enabled })),
      loadSoundSettings: async (force = false) => {
        const state = get();
        const now = Date.now();
        if (!force && state.soundSettingsLoadedAt > 0 && now - state.soundSettingsLoadedAt < TASK_COMPLETION_SOUND_SETTINGS_TTL_MS) {
          return state.soundSettings || DEFAULT_TASK_COMPLETION_SOUND_SETTINGS;
        }
        try {
          const soundSettings = await getTaskCompletionSoundSettings();
          set({ soundSettings: soundSettings || DEFAULT_TASK_COMPLETION_SOUND_SETTINGS, soundSettingsLoadedAt: now });
          return soundSettings || DEFAULT_TASK_COMPLETION_SOUND_SETTINGS;
        } catch (error) {
          console.warn('[task-completion-sound] unable to load custom sound settings', error);
          return get().soundSettings || DEFAULT_TASK_COMPLETION_SOUND_SETTINGS;
        }
      },
      primeAudio: () => {
        if (!get().enabled) return;
        void get().loadSoundSettings().then((soundSettings) => primeTaskCompletionSoundAudio(soundSettings)).catch((error) => {
          console.warn('[task-completion-sound] unable to prime audio', error);
        });
      },
      notifyComplete: (nodeId, fallbackNodeType, now = Date.now()) => {
        const state = get();
        const nodeType = resolveCompletionSoundNodeType(completionSoundNodeTypes.get(nodeId), fallbackNodeType);
        if (!shouldNotifyCompletionSoundForNodeType(state, nodeType, now)) return;
        set({ lastPlayedAt: now });
        void get().loadSoundSettings().then((soundSettings) => playTaskCompletionSound(soundSettings)).catch((error) => {
          console.warn('[task-completion-sound] unable to play completion tone', error);
        });
      },
    }),
    {
      name: 't8-task-completion-sound',
      partialize: (state) => ({ enabled: state.enabled }),
      merge: (persisted, current) => ({
        ...current,
        ...((persisted || {}) as Partial<TaskCompletionSoundState>),
        lastPlayedAt: 0,
        soundSettings: DEFAULT_TASK_COMPLETION_SOUND_SETTINGS,
        soundSettingsLoadedAt: 0,
      }),
    },
  ),
);

export const taskCompletionSound = {
  primeAudio: () => useTaskCompletionSoundStore.getState().primeAudio(),
  notifyComplete: (nodeId: string, fallbackNodeType?: string, now?: number) =>
    useTaskCompletionSoundStore.getState().notifyComplete(nodeId, fallbackNodeType, now),
  refreshSettings: () => useTaskCompletionSoundStore.getState().loadSoundSettings(true),
};

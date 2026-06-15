import { type KeyboardEvent, type SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eraser, Maximize2, Minimize2, Pause, Play, RotateCcw, Shield, Shuffle, Square, Timer, Trophy, Zap } from 'lucide-react';
import { trackAchievementEvent, useAchievementStore } from '../stores/achievements';
import {
  TETRIS_HEIGHT,
  TETRIS_WIDTH,
  TETRIS_CHECKPOINT_STEP,
  TETRIS_CHAPTERS,
  TETRIS_FINAL_CLEAR_LINES,
  TETRIS_POWERS,
  canUseTetrisPower,
  createTetrisCheckpoint,
  createTetrisGame,
  getPiecePreviewCells,
  getTetrisChapter,
  getTetrisFallInterval,
  getTetrisPowerCost,
  getTetrisRenderBoard,
  getTetrisSpeedMultiplier,
  restoreTetrisCheckpoint,
  restoreTetrisGame,
  updateTetrisGame,
  type TetrisCell,
  type TetrisCheckpoint,
  type TetrisGameState,
  type TetrisPieceType,
  type TetrisPowerId,
} from '../utils/tetrisEngine';
import TetrisThemeButton from './TetrisThemeButton';

interface TetrisPanelProps {
  visualStyle: string;
  viewportMoving: boolean;
  nodeDragging: boolean;
}

export const TETRIS_PANEL_COLLAPSED_STORAGE_KEY = 't8.tetris.panel.collapsed.v1';
export const TETRIS_PANEL_STATE_STORAGE_KEY = 't8.tetris.state.v1';
export const TETRIS_PANEL_CHECKPOINT_STORAGE_KEY = 't8.tetris.checkpoints.v1';
export const TETRIS_VICTORY_CUTSCENE_MS = 10_000;
const TETRIS_PANEL_BEST_STORAGE_KEY = 't8.tetris.best.v1';
const TETRIS_DEV_CHECKPOINTS_ENABLED = import.meta.env.DEV;
const TETRIS_DEV_FINALE_TEST = TETRIS_DEV_CHECKPOINTS_ENABLED;
const TETRIS_DEV_CHECKPOINT_LEVELS = TETRIS_CHAPTERS
  .map((chapter) => chapter.levelEnd)
  .filter((level) => level >= TETRIS_CHECKPOINT_STEP && level % TETRIS_CHECKPOINT_STEP === 0);
const TETRIS_POWER_BUTTONS: Array<{ id: TetrisPowerId; icon: typeof Timer; hint: string; key: string }> = [
  { id: 'slow', icon: Timer, hint: '短时间慢速下落', key: '1' },
  { id: 'clear-bottom', icon: Eraser, hint: '清掉最底一行', key: '2' },
  { id: 'reroll', icon: Shuffle, hint: '重铸当前方块', key: '3' },
  { id: 'shield', icon: Shield, hint: '随机清除 5-10 个障碍', key: '4' },
];

type BestTetrisRecord = {
  score: number;
  level: number;
  lines: number;
};

type MissionFlash = {
  id: string;
  title: string;
  detail: string;
};

function readStoredGame() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TETRIS_PANEL_STATE_STORAGE_KEY);
    return raw ? restoreTetrisGame(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function readBestRecord(): BestTetrisRecord {
  if (typeof window === 'undefined') return { score: 0, level: 1, lines: 0 };
  try {
    const raw = JSON.parse(window.localStorage.getItem(TETRIS_PANEL_BEST_STORAGE_KEY) || '{}');
    return {
      score: Math.max(0, Math.floor(Number(raw.score) || 0)),
      level: Math.max(1, Math.floor(Number(raw.level) || 1)),
      lines: Math.max(0, Math.floor(Number(raw.lines) || 0)),
    };
  } catch {
    return { score: 0, level: 1, lines: 0 };
  }
}

function sortCheckpoints(records: TetrisCheckpoint[]) {
  return [...records].sort((a, b) => a.level - b.level);
}

function normalizeCheckpoints(value: unknown): TetrisCheckpoint[] {
  if (!Array.isArray(value)) return [];
  const byLevel = new Map<number, TetrisCheckpoint>();
  for (const item of value) {
    const checkpoint = restoreTetrisCheckpoint(item);
    if (!checkpoint) continue;
    const current = byLevel.get(checkpoint.level);
    if (!current || checkpoint.savedAt >= current.savedAt) byLevel.set(checkpoint.level, checkpoint);
  }
  return sortCheckpoints(Array.from(byLevel.values()));
}

function readStoredCheckpoints() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(TETRIS_PANEL_CHECKPOINT_STORAGE_KEY) || '[]');
    return normalizeCheckpoints(raw);
  } catch {
    return [];
  }
}

function writeStoredCheckpoints(records: TetrisCheckpoint[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TETRIS_PANEL_CHECKPOINT_STORAGE_KEY, JSON.stringify(sortCheckpoints(records)));
  } catch {
    /* local checkpoint storage is best-effort */
  }
}

function checkpointOptionLabel(checkpoint: TetrisCheckpoint) {
  const chapter = getTetrisChapter(checkpoint.state?.level || checkpoint.level);
  return `Lv${checkpoint.level} ${chapter.name} / ${checkpoint.lines}L`;
}

function createDevTetrisCheckpoint(level: number): TetrisCheckpoint {
  const lines = Math.max(0, level * 10 - 10);
  const state = createTetrisGame({ level, lines });
  return {
    level,
    lines: state.lines,
    score: state.score,
    savedAt: 0,
    state,
  };
}

function getTetrisCheckpointOptions(records: TetrisCheckpoint[]) {
  if (!TETRIS_DEV_CHECKPOINTS_ENABLED) return records;
  const byLevel = new Map<number, TetrisCheckpoint>();
  for (const level of TETRIS_DEV_CHECKPOINT_LEVELS) {
    byLevel.set(level, createDevTetrisCheckpoint(level));
  }
  for (const checkpoint of records) {
    byLevel.set(checkpoint.level, checkpoint);
  }
  return sortCheckpoints(Array.from(byLevel.values()));
}

function isTextInputTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    : false;
}

function isTetrisInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]'))
    : false;
}

function stopTetrisCanvasGesture(event: SyntheticEvent<HTMLElement>) {
  if (isTetrisInteractiveTarget(event.target)) return;
  event.stopPropagation();
}

function hasBlockingModalOpen() {
  if (typeof document === 'undefined') return false;
  const selectors = [
    '[aria-modal="true"]',
    '[role="dialog"]',
    '.px-modal-mask',
    '.t8-modal-mask',
    '.t8-modal-backdrop',
    '.t8-achievement-film-stage',
    '.t8-tetris-victory-cutscene',
  ];
  return selectors.some((selector) =>
    Array.from(document.querySelectorAll(selector)).some((element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.closest('.t8-tetris-panel')) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }),
  );
}

function formatSpeed(multiplier: number) {
  const rounded = Math.round(multiplier * 100) / 100;
  return `${rounded.toFixed(2).replace(/\.?0+$/, '')}x`;
}

function cellClass(cell: TetrisCell | null) {
  if (!cell) return 't8-tetris-cell';
  return [
    't8-tetris-cell',
    `is-${cell.type.toLowerCase()}`,
    cell.modifier ? `is-${cell.modifier}` : '',
    cell.hazard ? 'is-hazard-added' : '',
    cell.locked ? 'is-locked' : '',
    cell.active ? 'is-active' : '',
    cell.ghost ? 'is-ghost' : '',
  ].filter(Boolean).join(' ');
}

function PiecePreview({ label, type }: { label: string; type: TetrisPieceType | null }) {
  const filled = useMemo(() => {
    const set = new Set<string>();
    if (type) {
      for (const [x, y] of getPiecePreviewCells(type)) set.add(`${x},${y}`);
    }
    return set;
  }, [type]);

  return (
    <div className="t8-tetris-panel__preview">
      <span>{label}</span>
      <div className="t8-tetris-panel__mini-grid" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, index) => {
          const x = index % 4;
          const y = Math.floor(index / 4);
          const filledCell = type && filled.has(`${x},${y}`);
          return (
            <i
              key={index}
              className={filledCell ? `t8-tetris-cell is-${type.toLowerCase()} is-active` : 't8-tetris-cell'}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function TetrisPanel({ visualStyle, viewportMoving, nodeDragging }: TetrisPanelProps) {
  const isTetrisTheme = visualStyle === 'tetris';
  const openAchievementDrawer = useAchievementStore((state) => state.openDrawer);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(TETRIS_PANEL_COLLAPSED_STORAGE_KEY) === '1';
  });
  const [game, setGame] = useState<TetrisGameState>(() => readStoredGame() || createTetrisGame());
  const [best, setBest] = useState<BestTetrisRecord>(() => readBestRecord());
  const [checkpoints, setCheckpoints] = useState<TetrisCheckpoint[]>(() => readStoredCheckpoints());
  const [selectedCheckpointLevel, setSelectedCheckpointLevel] = useState(() => {
    const stored = readStoredCheckpoints();
    return stored.length ? stored[stored.length - 1].level : 1;
  });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [windowReady, setWindowReady] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [autoPauseReason, setAutoPauseReason] = useState<string | null>(null);
  const [missionFlash, setMissionFlash] = useState<MissionFlash | null>(null);
  const [isStageMode, setIsStageMode] = useState(false);
  const [victoryCutsceneVisible, setVictoryCutsceneVisible] = useState(false);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const lastClearIdRef = useRef(game.lastClear.id);
  const trackedLevelsRef = useRef(new Set<number>());
  const trackedChapterCheckpointRef = useRef(new Set<number>(checkpoints.map((item) => item.level)));
  const gameOverTrackedRef = useRef(game.status === 'game-over');
  const gameStartedTrackedRef = useRef(false);
  const lastCheckpointLevelRef = useRef(checkpoints.length ? checkpoints[checkpoints.length - 1].level : 1);
  const completedMissionRef = useRef(game.mission.completed ? game.mission.id : '');
  const previousGameStatusRef = useRef(game.status);
  const victoryCutscenePlayedRef = useRef(game.status === 'victory');

  const renderBoard = useMemo(() => getTetrisRenderBoard(game), [game]);
  const chapter = game.chapter || getTetrisChapter(game.level);
  const fallInterval = getTetrisFallInterval(game.level, game);
  const speedMultiplier = getTetrisSpeedMultiplier(game.level);
  const missionPercent = Math.min(100, Math.round((game.mission.progress / Math.max(1, game.mission.target)) * 100));
  const missionComplete = game.mission.completed;
  const isVictory = game.status === 'victory';
  const chapterSpeedLabel = `${formatSpeed(speedMultiplier)} 速度`;
  const chapterUnlockLabel = chapter.unlockPower
    ? `解锁 ${TETRIS_POWERS[chapter.unlockPower].shortLabel}`
    : '5关切换';
  const powerCostSummary = TETRIS_POWER_BUTTONS
    .map(({ id }) => getTetrisPowerCost(id, game.level))
    .join('/');
  const feedbackPanelClass = game.lastFeedback?.type ? `has-feedback-${game.lastFeedback?.type} has-feedback-${game.lastFeedback?.intensity}` : '';
  const visibleFeedback = game.lastFeedback && game.lastFeedback.type !== 'drop' ? game.lastFeedback : null;
  const keyboardActive = isStageMode || hovered || focused;
  const externalNodeDragging = nodeDragging && !keyboardActive;
  const checkpointOptions = useMemo(() => getTetrisCheckpointOptions(checkpoints), [checkpoints]);
  const selectedCheckpoint = checkpointOptions.find((item) => item.level === selectedCheckpointLevel) || null;
  const activeAutoPauseReason = collapsed
    ? isStageMode ? null : '游戏已折叠'
    : !windowReady
      ? '窗口失焦，游戏已暂停'
      : modalOpen
        ? '弹窗打开，游戏已暂停'
        : viewportMoving
          ? '画布移动中，游戏已暂停'
          : externalNodeDragging
            ? '节点拖动中，游戏已暂停'
            : !keyboardActive
              ? '鼠标离开，游戏已暂停'
              : null;

  useEffect(() => {
    if (!isTetrisTheme || gameStartedTrackedRef.current) return;
    gameStartedTrackedRef.current = true;
    trackAchievementEvent({ type: 'tetris.game_started', theme: 'tetris', kind: 'auto' });
  }, [isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme || typeof window === 'undefined') return;
    window.localStorage.setItem(TETRIS_PANEL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed, isTetrisTheme]);

  useEffect(() => {
    if (!isStageMode || typeof document === 'undefined' || typeof window === 'undefined') return;
    document.body.classList.add('t8-tetris-stage-open');
    window.requestAnimationFrame(() => panelRootRef.current?.focus({ preventScroll: true }));
    return () => document.body.classList.remove('t8-tetris-stage-open');
  }, [isStageMode]);

  useEffect(() => {
    if (!victoryCutsceneVisible || typeof document === 'undefined') return;
    document.body.classList.add('t8-tetris-victory-cutscene-open');
    return () => document.body.classList.remove('t8-tetris-victory-cutscene-open');
  }, [victoryCutsceneVisible]);

  useEffect(() => {
    if (!isTetrisTheme || typeof window === 'undefined') return;
    window.localStorage.setItem(TETRIS_PANEL_STATE_STORAGE_KEY, JSON.stringify(game));
  }, [game, isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme) return;
    if (!game.mission.completed) {
      completedMissionRef.current = '';
      return;
    }
    if (completedMissionRef.current === game.mission.id) return;
    completedMissionRef.current = game.mission.id;
    const nextFlash = {
      id: `${game.mission.id}-${game.eventSeq}`,
      title: `${chapter.name} CLEAR`,
      detail: `+${chapter.rewardEnergy} POWER`,
    };
    setMissionFlash(nextFlash);
    const timer = window.setTimeout(() => {
      setMissionFlash((current) => (current?.id === nextFlash.id ? null : current));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [chapter.name, chapter.rewardEnergy, game.eventSeq, game.mission.completed, game.mission.id, isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme || typeof window === 'undefined') return;
    const handleEnergyBonus = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const amount = Math.max(6, Math.min(24, Math.floor(Number(detail?.amount) || 12)));
      setGame((current) => updateTetrisGame(current, { type: 'applyCanvasEnergyBonus', amount }));
    };
    window.addEventListener('t8:tetris-energy-bonus', handleEnergyBonus);
    return () => window.removeEventListener('t8:tetris-energy-bonus', handleEnergyBonus);
  }, [isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme) return;
    const checkpoint = createTetrisCheckpoint(game);
    if (!checkpoint) return;
    if (!trackedChapterCheckpointRef.current.has(checkpoint.level)) {
      trackedChapterCheckpointRef.current.add(checkpoint.level);
      trackAchievementEvent({
        type: 'tetris.chapter_completed',
        theme: 'tetris',
        kind: `lv-${checkpoint.level}`,
      });
      if (checkpoint.level === 30 && checkpoint.state.powerEffects.clearBottomUsedInChapter === 0) {
        trackAchievementEvent({
          type: 'tetris.clean_chapter_completed',
          theme: 'tetris',
          kind: 'lv-30',
        });
      }
    }
    setCheckpoints((current) => {
      if (current.some((item) => item.level === checkpoint.level)) return current;
      const next = sortCheckpoints([...current, checkpoint]);
      writeStoredCheckpoints(next);
      return next;
    });
  }, [game, isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme) return;
    const latest = checkpoints.length ? checkpoints[checkpoints.length - 1].level : 1;
    const previous = lastCheckpointLevelRef.current;
    if (latest > previous) {
      setSelectedCheckpointLevel((level) => (level <= previous ? latest : level));
    }
    lastCheckpointLevelRef.current = latest;
  }, [checkpoints, isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme) return;
    if (game.score <= best.score && game.level <= best.level && game.lines <= best.lines) return;
    const nextBest = {
      score: Math.max(best.score, game.score),
      level: Math.max(best.level, game.level),
      lines: Math.max(best.lines, game.lines),
    };
    setBest(nextBest);
    try {
      window.localStorage.setItem(TETRIS_PANEL_BEST_STORAGE_KEY, JSON.stringify(nextBest));
    } catch {
      /* local score is best-effort */
    }
  }, [best, game.level, game.lines, game.score, isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme) return;
    const syncWindowReady = () => {
      setWindowReady(document.visibilityState === 'visible' && document.hasFocus());
    };
    syncWindowReady();
    document.addEventListener('visibilitychange', syncWindowReady);
    window.addEventListener('focus', syncWindowReady);
    window.addEventListener('blur', syncWindowReady);
    return () => {
      document.removeEventListener('visibilitychange', syncWindowReady);
      window.removeEventListener('focus', syncWindowReady);
      window.removeEventListener('blur', syncWindowReady);
    };
  }, [isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const syncModalOpen = () => setModalOpen(hasBlockingModalOpen());
    syncModalOpen();
    const observer = new MutationObserver(syncModalOpen);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'aria-modal', 'class', 'open', 'style'],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme) return;
    if (activeAutoPauseReason) {
      setAutoPauseReason(activeAutoPauseReason);
      setGame((current) => updateTetrisGame(current, { type: 'pause' }));
      return;
    }
    if (autoPauseReason && keyboardActive) {
      setAutoPauseReason(null);
      setGame((current) => updateTetrisGame(current, { type: 'resume' }));
    }
  }, [activeAutoPauseReason, autoPauseReason, keyboardActive, isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme || game.status !== 'playing') return;
    const timer = window.setInterval(() => {
      setGame((current) => updateTetrisGame(current, { type: 'tick' }));
    }, fallInterval);
    return () => window.clearInterval(timer);
  }, [fallInterval, game.status, isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme) return;
    if (game.lastClear.id !== lastClearIdRef.current) {
      lastClearIdRef.current = game.lastClear.id;
      if (game.lastClear.lines > 0) {
        trackAchievementEvent({
          type: 'tetris.line_clear',
          theme: 'tetris',
          kind: String(game.lastClear.lines),
        });
        if (game.lastClear.tetris) {
          trackAchievementEvent({ type: 'tetris.tetris_clear', theme: 'tetris', kind: '4' });
        }
      }
    }
    for (const milestone of [10, 50, 99]) {
      if (game.level >= milestone && !trackedLevelsRef.current.has(milestone)) {
        trackedLevelsRef.current.add(milestone);
        trackAchievementEvent({ type: 'tetris.level_reached', theme: 'tetris', kind: String(milestone) });
        if (milestone === 99 && !trackedChapterCheckpointRef.current.has(99)) {
          trackedChapterCheckpointRef.current.add(99);
          trackAchievementEvent({ type: 'tetris.chapter_completed', theme: 'tetris', kind: 'lv-99' });
        }
      }
    }
    if (game.status === 'game-over' && !gameOverTrackedRef.current) {
      gameOverTrackedRef.current = true;
      trackAchievementEvent({ type: 'tetris.game_over', theme: 'tetris', kind: `lv-${game.level}` });
    }
    if (game.status !== 'game-over') {
      gameOverTrackedRef.current = false;
    }
  }, [game.lastClear, game.level, game.status, isTetrisTheme]);

  useEffect(() => {
    if (!isTetrisTheme) return;
    const previousStatus = previousGameStatusRef.current;
    previousGameStatusRef.current = game.status;
    const justWon = game.status === 'victory' && previousStatus !== 'victory';
    if (!justWon || victoryCutscenePlayedRef.current) return;
    victoryCutscenePlayedRef.current = true;
    setVictoryCutsceneVisible(true);
    const timer = window.setTimeout(() => setVictoryCutsceneVisible(false), TETRIS_VICTORY_CUTSCENE_MS);
    return () => window.clearTimeout(timer);
  }, [game.status, isTetrisTheme]);

  if (!isTetrisTheme) return null;

  const commitStartedGame = (nextGame: TetrisGameState, kind: string) => {
    setAutoPauseReason(null);
    gameOverTrackedRef.current = false;
    lastClearIdRef.current = nextGame.lastClear.id;
    trackedLevelsRef.current = new Set([10, 50, 99].filter((milestone) => nextGame.level >= milestone));
    gameStartedTrackedRef.current = true;
    completedMissionRef.current = nextGame.mission.completed ? nextGame.mission.id : '';
    previousGameStatusRef.current = nextGame.status;
    victoryCutscenePlayedRef.current = nextGame.status === 'victory';
    setMissionFlash(null);
    setVictoryCutsceneVisible(false);
    setGame(nextGame);
    trackAchievementEvent({
      type: 'tetris.game_started',
      theme: 'tetris',
      kind,
    });
  };

  const resetGame = () => {
    const restoredCheckpoint = selectedCheckpoint ? restoreTetrisCheckpoint(selectedCheckpoint) : null;
    const nextGame = restoredCheckpoint
      ? {
        ...restoredCheckpoint.state,
        status: 'playing' as const,
        startedAt: Date.now(),
      }
      : updateTetrisGame(game, { type: 'restart' });
    commitStartedGame(nextGame, restoredCheckpoint ? `checkpoint-lv-${restoredCheckpoint.level}` : 'manual');
  };

  const startFreshGame = () => {
    commitStartedGame(updateTetrisGame(game, { type: 'restart' }), 'fresh');
  };

  const startFinaleTestGame = () => {
    const finaleGame = createTetrisGame({ level: 99, lines: TETRIS_FINAL_CLEAR_LINES });
    const nextGame = {
      ...finaleGame,
      energy: 999,
      mission: {
        ...finaleGame.mission,
        progress: Math.max(0, finaleGame.mission.target - 1),
        completed: false,
        rewardClaimed: false,
      },
    };
    trackedLevelsRef.current = new Set([10, 50]);
    trackedChapterCheckpointRef.current.delete(99);
    commitStartedGame(nextGame, 'dev-finale-test');
    trackedLevelsRef.current = new Set([10, 50]);
    trackedChapterCheckpointRef.current.delete(99);
  };

  const togglePause = () => {
    if (isVictory) return;
    setAutoPauseReason(null);
    setGame((current) => updateTetrisGame(current, { type: current.status === 'playing' ? 'pause' : 'resume' }));
  };

  const toggleStageMode = () => {
    setAutoPauseReason(null);
    setCollapsed(false);
    setIsStageMode((value) => !value);
  };

  const usePower = (power: TetrisPowerId) => {
    setAutoPauseReason(null);
    setGame((current) => updateTetrisGame(current, { type: 'usePower', power }));
  };

  const openTetrisFilmHall = () => {
    setVictoryCutsceneVisible(false);
    openAchievementDrawer('films');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (isStageMode && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setIsStageMode(false);
      return;
    }
    if (!keyboardActive) return;
    const key = event.key.toLowerCase();
    const powerButton = TETRIS_POWER_BUTTONS.find((item) => item.key === key);
    if (powerButton) {
      event.preventDefault();
      event.stopPropagation();
      usePower(powerButton.id);
      return;
    }
    if (key === 'p' || key === 'r') {
      event.preventDefault();
      event.stopPropagation();
      if (key === 'p') togglePause();
      else resetGame();
      return;
    }
    const action =
      event.key === 'ArrowLeft' ? { type: 'move', dx: -1 } as const
        : event.key === 'ArrowRight' ? { type: 'move', dx: 1 } as const
          : event.key === 'ArrowUp' ? { type: 'rotate', direction: 'clockwise' } as const
            : event.key === 'ArrowDown' ? { type: 'softDrop' } as const
              : event.key === ' ' ? { type: 'hardDrop' } as const
                : event.key === 'Shift' || key === 'c' ? { type: 'hold' } as const
                  : undefined;
    if (action === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    if (game.status === 'paused' && !autoPauseReason) {
      setGame((current) => updateTetrisGame(updateTetrisGame(current, { type: 'resume' }), action));
      return;
    }
    if (game.status !== 'playing') return;
    setGame((current) => updateTetrisGame(current, action));
  };

  const panelMarkup = (
    <div
      ref={panelRootRef}
      className={`t8-tetris-panel nodrag nopan ${collapsed ? 'is-collapsed' : 'is-expanded'} ${isStageMode ? 'is-stage-mode' : ''} ${keyboardActive ? 'is-keyboard-active' : ''}`}
      data-canvas-floating-ui="tetris-panel"
      data-tetris-interaction-surface="true"
      onPointerDownCapture={stopTetrisCanvasGesture}
      onPointerMoveCapture={stopTetrisCanvasGesture}
      onPointerUpCapture={stopTetrisCanvasGesture}
      onPointerCancelCapture={stopTetrisCanvasGesture}
      onMouseDownCapture={stopTetrisCanvasGesture}
      onMouseMoveCapture={stopTetrisCanvasGesture}
      onMouseUpCapture={stopTetrisCanvasGesture}
      onClickCapture={stopTetrisCanvasGesture}
      onDoubleClickCapture={stopTetrisCanvasGesture}
      onWheelCapture={stopTetrisCanvasGesture}
      onContextMenuCapture={stopTetrisCanvasGesture}
      onPointerDown={stopTetrisCanvasGesture}
      onMouseDown={stopTetrisCanvasGesture}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <TetrisThemeButton
        collapsed={collapsed}
        score={game.score}
        level={game.level}
        status={game.status}
        onToggle={() => setCollapsed((value) => !value)}
      />

      {(!collapsed || isStageMode) && (
        <section
          id="t8-tetris-panel"
          className={`t8-tetris-panel__panel ${game.status === 'paused' ? 'is-paused' : ''} ${game.status === 'game-over' ? 'is-game-over' : ''} ${isVictory ? 'is-victory' : ''} ${missionComplete ? 'has-mission-complete' : ''} ${feedbackPanelClass}`}
          data-stage-effect={chapter.effect.id}
        >
          <div className="t8-tetris-panel__scorebar">
            <span><b>{game.score}</b><small>SCORE</small></span>
            <span><b>{game.level}</b><small>LEVEL</small></span>
            <span><b>{game.lines}</b><small>LINES</small></span>
            <span><b>{formatSpeed(speedMultiplier)}</b><small>SPEED</small></span>
          </div>

          <div className="t8-tetris-panel__body">
            <div className="t8-tetris-panel__play">
              <div
                className="t8-tetris-panel__well"
                role="grid"
                aria-rowcount={TETRIS_HEIGHT}
                aria-colcount={TETRIS_WIDTH}
              >
                <div className="t8-tetris-panel__stage-chip" aria-hidden="true">
                  <strong>{chapter.effect.label}</strong>
                  <span>{chapter.effect.cue}</span>
                </div>
                {renderBoard.flatMap((row, y) =>
                  row.map((cell, x) => (
                    <i
                      key={`${x}-${y}`}
                      className={cellClass(cell)}
                      data-cell-type={cell?.type || 'empty'}
                      data-cell-state={cell?.active ? 'active' : cell?.ghost ? 'ghost' : cell?.locked ? 'locked' : 'empty'}
                    />
                  )),
                )}
                {(game.status === 'paused' || game.status === 'game-over' || isVictory) && (
                  <div className="t8-tetris-panel__well-status">
                    <strong>{isVictory ? 'ALL CLEAR' : game.status === 'game-over' ? 'GAME OVER' : 'PAUSE'}</strong>
                    <span>{isVictory ? '彩蛋终章通关' : autoPauseReason || 'READY'}</span>
                  </div>
                )}
                {missionFlash && (
                  <div className="t8-tetris-panel__mission-flash" role="status" aria-live="polite">
                    <strong>{missionFlash.title}</strong>
                    <span>{missionFlash.detail}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="t8-tetris-panel__side">
              <PiecePreview label="NEXT" type={game.next[0] || null} />
              <PiecePreview label="HOLD" type={game.held} />
              <div className="t8-tetris-panel__help" aria-label="俄罗斯方块按键说明">
                <span>KEYS</span>
                <dl>
                  <div><dt>← →</dt><dd>移动</dd></div>
                  <div><dt>↑</dt><dd>旋转</dd></div>
                  <div><dt>↓</dt><dd>下落</dd></div>
                  <div><dt>Space</dt><dd>硬降</dd></div>
                  <div><dt>C / Shift</dt><dd>暂存</dd></div>
                </dl>
              </div>
              <div className={`t8-tetris-panel__feedback-slot ${visibleFeedback ? 'has-feedback' : 'is-idle'}`} aria-live="polite">
                {visibleFeedback ? (
                  <div
                    key={visibleFeedback.id}
                    className={`t8-tetris-panel__feedback t8-tetris-panel__feedback--side is-${visibleFeedback.type} is-${visibleFeedback.intensity}`}
                    data-feedback-type={visibleFeedback.type}
                    role="status"
                  >
                    <strong>{visibleFeedback.label}</strong>
                    <span>{visibleFeedback.type === 'victory' ? 'FINALE COMPLETE' : visibleFeedback.type === 'power' ? 'POWER SKILL' : chapter.effect.label}</span>
                  </div>
                ) : (
                  <div className="t8-tetris-panel__feedback-idle" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                )}
              </div>
            </div>

            <div className={`t8-tetris-panel__mission ${missionComplete ? 'is-complete' : ''}`}>
              <div className="t8-tetris-panel__mission-head">
                <span>MISSION</span>
                <strong>{chapter.name}</strong>
              </div>
              <small>{game.mission.label}</small>
              {missionComplete && (
                <b className="t8-tetris-panel__mission-clear">CLEAR +{chapter.rewardEnergy} POWER</b>
              )}
              <div className="t8-tetris-panel__mission-bar" aria-hidden="true">
                <i style={{ width: `${missionPercent}%` }} />
              </div>
                <em>{game.mission.progress}/{game.mission.target}</em>
              </div>

              <div className="t8-tetris-panel__mechanic" aria-label="每5关特殊关卡机制">
                <div className="t8-tetris-panel__mechanic-head">
                  <span>5关机制</span>
                  <strong>Lv{chapter.levelStart}-{chapter.levelEnd}</strong>
                </div>
                <b>{chapter.name}</b>
                <small>{chapter.effect.cue}</small>
                <div className="t8-tetris-panel__mechanic-meta" aria-hidden="true">
                  <span>{chapter.effect.label}</span>
                  <span>{chapterSpeedLabel}</span>
                </div>
                <em>{chapterUnlockLabel}</em>
              </div>

              <div className="t8-tetris-panel__power">
                <div className="t8-tetris-panel__power-head">
                  <span>POWER</span>
                <strong><Zap size={11} />{game.energy}</strong>
              </div>
                  <small className="t8-tetris-panel__power-note">技能需 {powerCostSummary} POWER，随关卡上涨，亮起可释放</small>
                  <div className="t8-tetris-panel__power-grid">
                    {TETRIS_POWER_BUTTONS.map((powerButton) => {
                      const { id, icon: Icon, hint, key: hotkey } = powerButton;
                      const power = TETRIS_POWERS[id];
                      const powerCost = getTetrisPowerCost(id, game.level);
                      const usable = canUseTetrisPower(game, id);
                      return (
                    <button
                      key={id}
                      type="button"
                      className="t8-tetris-panel__power-button"
                          disabled={!usable}
                          onClick={() => usePower(id)}
                          title={`${power.label} · 快捷键 ${hotkey} · ${powerCost} POWER · ${hint}`}
                          data-power={id}
                          data-locked="0"
                        >
                          <kbd className="t8-tetris-panel__power-hotkey">{hotkey}</kbd>
                          <Icon size={12} />
                          <span>{power.shortLabel}</span>
                          <small className="t8-tetris-panel__power-cost">{powerCost} POWER</small>
                        </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isVictory && (
            <div className="t8-tetris-panel__victory-menu" role="status" aria-live="polite">
              <div className="t8-tetris-panel__victory-head">
                <Trophy size={16} />
                <span>ALL CLEAR</span>
                <strong>Lv99 彩蛋终章</strong>
              </div>
              <div className="t8-tetris-panel__victory-stats" aria-label="俄罗斯方块通关数据">
                <span><b>{game.score}</b><small>SCORE</small></span>
                <span><b>{game.lines}</b><small>LINES</small></span>
                <span><b>{best.level}</b><small>BEST LV</small></span>
              </div>
              <div className="t8-tetris-panel__victory-actions">
                <button type="button" onClick={resetGame} title={selectedCheckpoint ? `从 ${checkpointOptionLabel(selectedCheckpoint)} 再战` : '从 Lv1 再战'}>
                  <RotateCcw size={12} />
                  <span>checkpoint 再战</span>
                </button>
                <button type="button" onClick={startFreshGame} title="重新开始新局">
                  <Play size={12} />
                  <span>新局</span>
                </button>
              </div>
            </div>
          )}

          <div className="t8-tetris-panel__checkpoint" title={`每 ${TETRIS_CHECKPOINT_STEP} 级自动保存一次重开点`}>
            <span>CHECKPOINT</span>
            <select
              value={selectedCheckpointLevel}
              onChange={(event) => setSelectedCheckpointLevel(Number(event.target.value) || 1)}
              aria-label="选择俄罗斯方块重开点"
            >
              <option value={1}>Lv1 新局</option>
              {checkpointOptions.map((checkpoint) => (
                <option key={checkpoint.level} value={checkpoint.level}>
                  {checkpointOptionLabel(checkpoint)}
                </option>
              ))}
            </select>
            {TETRIS_DEV_FINALE_TEST && (
              <button
                type="button"
                className="t8-tetris-panel__dev-finale"
                onClick={startFinaleTestGame}
                title="开发测试：跳到 Lv99 彩蛋终章，任务差 1 点完成，便于验证通关结算和隐藏影片解锁"
              >
                Lv99 测试
              </button>
            )}
          </div>

          <div className="t8-tetris-panel__actions">
            <button type="button" onClick={togglePause} title={isVictory ? '已通关' : game.status === 'playing' ? '暂停' : '继续'} disabled={isVictory}>
              {isVictory ? <Trophy size={13} /> : game.status === 'playing' ? <Pause size={13} /> : <Play size={13} />}
              <span>{isVictory ? '通关' : game.status === 'playing' ? '暂停' : '继续'}</span>
            </button>
            <button
              type="button"
              onClick={resetGame}
              title={selectedCheckpoint ? `从 ${checkpointOptionLabel(selectedCheckpoint)} 重开` : '重开新局'}
            >
              <RotateCcw size={13} />
              <span>重开</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsStageMode(false);
                setCollapsed(true);
              }}
              title="折叠"
            >
              <Square size={12} />
              <span>折叠</span>
            </button>
            <button
              type="button"
              className="t8-tetris-panel__stage-mode"
              onClick={toggleStageMode}
              title={isStageMode ? '退出大屏模式' : '打开大屏模式'}
              aria-pressed={isStageMode}
            >
              {isStageMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isStageMode ? '退出' : '大屏'}</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );

  const renderedPanel = isStageMode && typeof document !== 'undefined'
    ? createPortal(panelMarkup, document.body)
    : panelMarkup;

  const victoryCutsceneMarkup = victoryCutsceneVisible && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="t8-tetris-victory-cutscene"
        role="dialog"
        aria-modal="true"
        aria-label="俄罗斯方块通关隐藏影片解锁过场"
      >
        <div className="t8-tetris-victory-cutscene__matrix" aria-hidden="true">
          {Array.from({ length: 32 }).map((_, index) => (
            <i key={index} />
          ))}
        </div>
        <section className="t8-tetris-victory-cutscene__card">
          <div className="t8-tetris-victory-cutscene__halo" aria-hidden="true" />
          <div className="t8-tetris-victory-cutscene__stack" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <i key={index} />
            ))}
          </div>
          <p className="t8-tetris-victory-cutscene__eyebrow">Lv99 FINALE COMPLETE</p>
          <h2>ALL CLEAR</h2>
          <strong>俄罗斯方块隐藏影片已解锁</strong>
          <p>
            彩色方块完成最后一次消行，彩蛋通道已经点亮。可以去成就影片馆解锁隐藏视频观看。
          </p>
          <div className="t8-tetris-victory-cutscene__timer" aria-label="10秒通关仪式动画">
            <span>10 秒仪式过场</span>
            <i />
          </div>
          <div className="t8-tetris-victory-cutscene__actions">
            <button type="button" onClick={() => setVictoryCutsceneVisible(false)}>
              回到画布
            </button>
            <button type="button" onClick={openTetrisFilmHall}>
              去成就影片馆
            </button>
          </div>
        </section>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      {renderedPanel}
      {victoryCutsceneMarkup}
    </>
  );
}

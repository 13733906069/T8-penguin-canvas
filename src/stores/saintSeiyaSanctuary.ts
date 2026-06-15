import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SAINT_SEIYA_CLOTH_BY_ID,
  type SaintClothRank,
} from '../data/saintSeiyaCloths';
import {
  type BattleStrategy,
  type SaintBattleReport,
  type SaintEnemy,
  buildSaintEnemy,
  chooseChestCloth,
  hasAllGoldCloths,
  saintLevelFromExp,
  simulateSaintBattle,
} from '../utils/saintSeiyaBattle';

export const SAINT_SEIYA_SPAWN_INTERVAL_MS = 60_000;
export const SAINT_SEIYA_CHEST_VISIBLE_MS = 10_000;
export const SAINT_SEIYA_OPEN_MS = 3_000;
export const SAINT_SEIYA_HADES_ANIMATION_MS = 10_000;

export interface SaintSeiyaPoint {
  x: number;
  y: number;
}

export interface SaintSeiyaChest extends SaintSeiyaPoint {
  id: string;
  clothId: string;
  rank: SaintClothRank;
  mapX: number;
  mapY: number;
  spawnedAt: number;
  expiresAt: number;
}

export interface SaintSeiyaCollectedCloth extends SaintSeiyaPoint {
  clothId: string;
  rank: SaintClothRank;
  collectedAt: number;
}

export interface SaintSeiyaOpeningTarget extends SaintSeiyaPoint {
  chestId: string;
  clothId: string;
  rank: SaintClothRank;
  progressMs: number;
  startedAt: number | null;
}

export interface SaintSeiyaBattleState {
  id: string;
  chest: SaintSeiyaChest;
  enemy: SaintEnemy;
  startedAt: number;
  strategy: BattleStrategy;
  report: SaintBattleReport | null;
  rewardApplied?: boolean;
}

export interface SaintSeiyaBattleResult {
  battle: SaintSeiyaBattleState | null;
  victory: boolean;
  clothId: string | null;
  rank: SaintClothRank | null;
  expGain: number;
  levelBefore: number;
  levelAfter: number;
  firstGold: boolean;
  goldCompleted: boolean;
  firstHadesUnlock: boolean;
  usedCosmoBurst: boolean;
  winCount: number;
}

interface SaintSeiyaSanctuaryState {
  collected: Partial<Record<string, SaintSeiyaCollectedCloth>>;
  activeChest: SaintSeiyaChest | null;
  openingTarget: SaintSeiyaOpeningTarget | null;
  battle: SaintSeiyaBattleState | null;
  nextSpawnAt: number;
  totalExp: number;
  winCount: number;
  battleCount: number;
  cosmoBurstCount: number;
  hadesUnlockedAt: string | null;
  hadesModeActive: boolean;
  hadesAnimationUntil: number;
  cleanupExpired: (now?: number) => void;
  setNextSpawnAt: (nextSpawnAt: number) => void;
  spawnChest: (chest: SaintSeiyaChest) => void;
  expireActiveChest: () => void;
  beginOpening: (chest: SaintSeiyaChest) => void;
  cancelOpening: () => void;
  setOpeningProgress: (progressMs: number, startedAt: number | null) => void;
  openTrackedChest: (now?: number) => SaintSeiyaBattleState | null;
  resolveBattle: (strategy?: BattleStrategy, now?: number) => SaintSeiyaBattleResult;
  finalizeBattleReward: (now?: number) => SaintSeiyaBattleResult;
  clearBattle: () => void;
  setHadesModeActive: (active: boolean) => void;
  resetSanctuary: () => void;
}

const emptyBattleResult: SaintSeiyaBattleResult = {
  battle: null,
  victory: false,
  clothId: null,
  rank: null,
  expGain: 0,
  levelBefore: 1,
  levelAfter: 1,
  firstGold: false,
  goldCompleted: false,
  firstHadesUnlock: false,
  usedCosmoBurst: false,
  winCount: 0,
};

function initialNextSpawnAt() {
  return Date.now() + SAINT_SEIYA_SPAWN_INTERVAL_MS;
}

function sanitizeCollected(value: Partial<Record<string, SaintSeiyaCollectedCloth>> = {}) {
  const next: Partial<Record<string, SaintSeiyaCollectedCloth>> = {};
  for (const [clothId, item] of Object.entries(value || {})) {
    const cloth = SAINT_SEIYA_CLOTH_BY_ID[clothId];
    if (!cloth || !item) continue;
    next[clothId] = {
      clothId,
      rank: cloth.rank,
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      collectedAt: Number(item.collectedAt) || Date.now(),
    };
  }
  return next;
}

function resultFromResolvedBattle(args: {
  state: SaintSeiyaSanctuaryState;
  battle: SaintSeiyaBattleState;
  report: SaintBattleReport;
  now: number;
  alreadyApplied?: boolean;
}): SaintSeiyaBattleResult {
  const { state, battle, report, now, alreadyApplied = false } = args;
  const currentTotalExp = Math.max(0, state.totalExp);
  const levelBefore = saintLevelFromExp(alreadyApplied ? Math.max(0, currentTotalExp - report.expGain) : currentTotalExp);
  const nextTotalExp = alreadyApplied ? currentTotalExp : Math.max(0, currentTotalExp + report.expGain);
  const levelAfter = saintLevelFromExp(nextTotalExp);
  const cloth = SAINT_SEIYA_CLOTH_BY_ID[battle.chest.clothId];
  const alreadyCollected = Boolean(state.collected[battle.chest.clothId]);
  const nextCollected = { ...state.collected };
  const firstGold = !alreadyApplied && report.victory && cloth?.rank === 'gold' && !alreadyCollected;
  if (!alreadyApplied && report.victory && cloth && !alreadyCollected) {
    nextCollected[cloth.id] = {
      clothId: cloth.id,
      rank: cloth.rank,
      x: battle.chest.x,
      y: battle.chest.y,
      collectedAt: now,
    };
  }
  const goldCompleted = hasAllGoldCloths(nextCollected);
  const firstHadesUnlock = !alreadyApplied && goldCompleted && !state.hadesUnlockedAt;
  const nextWinCount = alreadyApplied ? state.winCount : report.victory ? state.winCount + 1 : state.winCount;

  return {
    battle,
    victory: report.victory,
    clothId: report.victory ? battle.chest.clothId : null,
    rank: report.victory ? battle.chest.rank : null,
    expGain: report.expGain,
    levelBefore,
    levelAfter,
    firstGold,
    goldCompleted,
    firstHadesUnlock,
    usedCosmoBurst: report.usedCosmoBurst,
    winCount: nextWinCount,
  };
}

export function buildSaintSeiyaChest(args: {
  now: number;
  totalExp: number;
  collected: Partial<Record<string, SaintSeiyaCollectedCloth>>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  rng?: () => number;
}): SaintSeiyaChest | null {
  const rng = args.rng || Math.random;
  const cloth = chooseChestCloth(args.totalExp, args.collected, rng);
  if (!cloth) return null;
  const mapX = 12 + rng() * 76;
  const mapY = 12 + rng() * 76;
  const px = mapX / 100;
  const py = mapY / 100;
  return {
    id: `saint-chest-${cloth.id}-${args.now}`,
    clothId: cloth.id,
    rank: cloth.rank,
    x: args.bounds.minX + (args.bounds.maxX - args.bounds.minX) * px,
    y: args.bounds.minY + (args.bounds.maxY - args.bounds.minY) * py,
    mapX,
    mapY,
    spawnedAt: args.now,
    expiresAt: args.now + SAINT_SEIYA_CHEST_VISIBLE_MS,
  };
}

export const useSaintSeiyaSanctuaryStore = create<SaintSeiyaSanctuaryState>()(
  persist(
    (set, get) => ({
      collected: {},
      activeChest: null,
      openingTarget: null,
      battle: null,
      nextSpawnAt: initialNextSpawnAt(),
      totalExp: 0,
      winCount: 0,
      battleCount: 0,
      cosmoBurstCount: 0,
      hadesUnlockedAt: null,
      hadesModeActive: false,
      hadesAnimationUntil: 0,

      cleanupExpired(now = Date.now()) {
        const state = get();
        const openingActiveChest = Boolean(
          state.activeChest && state.openingTarget && state.activeChest.id === state.openingTarget.chestId,
        );
        const activeChest =
          state.activeChest && (state.activeChest.expiresAt > now || openingActiveChest) ? state.activeChest : null;
        if (state.activeChest === activeChest) return;
        set({ activeChest });
      },

      setNextSpawnAt(nextSpawnAt) {
        if (get().nextSpawnAt === nextSpawnAt) return;
        set({ nextSpawnAt });
      },

      spawnChest(chest) {
        set({
          activeChest: chest,
          nextSpawnAt: chest.spawnedAt + SAINT_SEIYA_SPAWN_INTERVAL_MS,
        });
      },

      expireActiveChest() {
        if (!get().activeChest) return;
        set({ activeChest: null, openingTarget: null });
      },

      beginOpening(chest) {
        set({
          activeChest: {
            ...chest,
            expiresAt: Math.max(chest.expiresAt, Date.now() + SAINT_SEIYA_OPEN_MS + 2_500),
          },
          openingTarget: {
            chestId: chest.id,
            clothId: chest.clothId,
            rank: chest.rank,
            x: chest.x,
            y: chest.y,
            progressMs: 0,
            startedAt: null,
          },
        });
      },

      cancelOpening() {
        set({ openingTarget: null });
      },

      setOpeningProgress(progressMs, startedAt) {
        const target = get().openingTarget;
        if (!target) return;
        const nextProgressMs = Math.max(0, Math.floor(progressMs));
        if (target.progressMs === nextProgressMs && target.startedAt === startedAt) return;
        set({ openingTarget: { ...target, progressMs: nextProgressMs, startedAt } });
      },

      openTrackedChest(now = Date.now()) {
        const state = get();
        const target = state.openingTarget;
        const chest = state.activeChest;
        if (!target || !chest || target.chestId !== chest.id) return null;
        const level = saintLevelFromExp(state.totalExp);
        const enemy = buildSaintEnemy(chest.clothId, level);
        const battle: SaintSeiyaBattleState = {
          id: `saint-battle-${chest.clothId}-${now}`,
          chest,
          enemy,
          startedAt: now,
          strategy: 'auto',
          report: null,
          rewardApplied: false,
        };
        set({
          activeChest: null,
          openingTarget: null,
          battle,
        });
        return battle;
      },

      resolveBattle(strategy = 'auto', now = Date.now()) {
        const state = get();
        const battle = state.battle;
        if (!battle) return { ...emptyBattleResult, levelBefore: saintLevelFromExp(state.totalExp), levelAfter: saintLevelFromExp(state.totalExp) };
        if (battle.report) {
          return resultFromResolvedBattle({
            state,
            battle,
            report: battle.report,
            now,
            alreadyApplied: Boolean(battle.rewardApplied),
          });
        }
        const report = simulateSaintBattle({
          totalExp: state.totalExp,
          collected: state.collected,
          enemy: battle.enemy,
          strategy,
        });
        const resolvedBattle = { ...battle, strategy, report, rewardApplied: false };
        set({
          battle: resolvedBattle,
        });
        return resultFromResolvedBattle({ state, battle: resolvedBattle, report, now });
      },

      finalizeBattleReward(now = Date.now()) {
        const state = get();
        const battle = state.battle;
        const report = battle?.report;
        if (!battle || !report) {
          return {
            ...emptyBattleResult,
            levelBefore: saintLevelFromExp(state.totalExp),
            levelAfter: saintLevelFromExp(state.totalExp),
            winCount: state.winCount,
          };
        }
        if (battle.rewardApplied) {
          return resultFromResolvedBattle({ state, battle, report, now, alreadyApplied: true });
        }
        const result = resultFromResolvedBattle({ state, battle, report, now });
        const cloth = SAINT_SEIYA_CLOTH_BY_ID[battle.chest.clothId];
        const nextCollected = { ...state.collected };
        if (report.victory && cloth && !state.collected[cloth.id]) {
          nextCollected[cloth.id] = {
            clothId: cloth.id,
            rank: cloth.rank,
            x: battle.chest.x,
            y: battle.chest.y,
            collectedAt: now,
          };
        }
        const goldCompleted = hasAllGoldCloths(nextCollected);
        const firstHadesUnlock = goldCompleted && !state.hadesUnlockedAt;
        const nextTotalExp = Math.max(0, state.totalExp + report.expGain);
        const nextWinCount = report.victory ? state.winCount + 1 : state.winCount;
        const nextCosmoBurstCount = report.usedCosmoBurst ? state.cosmoBurstCount + 1 : state.cosmoBurstCount;
        const rewardedBattle = { ...battle, rewardApplied: true };
        set({
          collected: nextCollected,
          battle: rewardedBattle,
          totalExp: nextTotalExp,
          battleCount: state.battleCount + 1,
          winCount: nextWinCount,
          cosmoBurstCount: nextCosmoBurstCount,
          hadesUnlockedAt: firstHadesUnlock ? new Date(now).toISOString() : state.hadesUnlockedAt,
          hadesModeActive: goldCompleted ? true : state.hadesModeActive,
          hadesAnimationUntil: firstHadesUnlock ? now + SAINT_SEIYA_HADES_ANIMATION_MS : state.hadesAnimationUntil,
        });
        return {
          ...result,
          battle: rewardedBattle,
          levelAfter: saintLevelFromExp(nextTotalExp),
          goldCompleted,
          firstHadesUnlock,
          winCount: nextWinCount,
        };
      },

      clearBattle() {
        if (!get().battle) return;
        set({ battle: null });
      },

      setHadesModeActive(active) {
        if (!get().hadesUnlockedAt) return;
        if (get().hadesModeActive === active) return;
        set({
          hadesModeActive: active,
          hadesAnimationUntil: active ? Date.now() + SAINT_SEIYA_HADES_ANIMATION_MS : get().hadesAnimationUntil,
        });
      },

      resetSanctuary() {
        set({
          collected: {},
          activeChest: null,
          openingTarget: null,
          battle: null,
          nextSpawnAt: initialNextSpawnAt(),
          totalExp: 0,
          winCount: 0,
          battleCount: 0,
          cosmoBurstCount: 0,
          hadesUnlockedAt: null,
          hadesModeActive: false,
          hadesAnimationUntil: 0,
        });
      },
    }),
    {
      name: 't8-saint-seiya-sanctuary',
      partialize: (state) => ({
        collected: sanitizeCollected(state.collected),
        nextSpawnAt: state.nextSpawnAt,
        totalExp: state.totalExp,
        winCount: state.winCount,
        battleCount: state.battleCount,
        cosmoBurstCount: state.cosmoBurstCount,
        hadesUnlockedAt: state.hadesUnlockedAt,
        hadesModeActive: state.hadesModeActive,
        hadesAnimationUntil: state.hadesAnimationUntil,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<SaintSeiyaSanctuaryState>;
        return {
          ...current,
          collected: sanitizeCollected(p.collected || {}),
          nextSpawnAt: Number(p.nextSpawnAt) || initialNextSpawnAt(),
          totalExp: Math.max(0, Math.floor(Number(p.totalExp) || 0)),
          winCount: Math.max(0, Math.floor(Number(p.winCount) || 0)),
          battleCount: Math.max(0, Math.floor(Number(p.battleCount) || 0)),
          cosmoBurstCount: Math.max(0, Math.floor(Number(p.cosmoBurstCount) || 0)),
          hadesUnlockedAt: typeof p.hadesUnlockedAt === 'string' ? p.hadesUnlockedAt : null,
          hadesModeActive: Boolean(p.hadesModeActive && p.hadesUnlockedAt),
          hadesAnimationUntil: Number(p.hadesAnimationUntil) || 0,
        };
      },
    },
  ),
);

export function seedSaintSeiyaGoldClothsForHadesTest(now = Date.now()) {
  const collected: Partial<Record<string, SaintSeiyaCollectedCloth>> = {};
  for (const cloth of Object.values(SAINT_SEIYA_CLOTH_BY_ID)) {
    if (cloth.rank !== 'gold') continue;
    collected[cloth.id] = {
      clothId: cloth.id,
      rank: cloth.rank,
      x: 0,
      y: 0,
      collectedAt: now,
    };
  }
  useSaintSeiyaSanctuaryStore.setState({
    collected,
    activeChest: null,
    openingTarget: null,
    battle: null,
    nextSpawnAt: now + 1_000,
    totalExp: 980,
    winCount: 12,
    battleCount: 12,
    cosmoBurstCount: 1,
    hadesUnlockedAt: new Date(now).toISOString(),
    hadesModeActive: true,
    hadesAnimationUntil: now + SAINT_SEIYA_HADES_ANIMATION_MS,
  });
}

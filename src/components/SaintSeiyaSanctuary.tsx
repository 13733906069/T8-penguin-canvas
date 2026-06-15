import { type MouseEvent, type PointerEvent, type WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import { Crown, Gem, MapPin, Power, RotateCcw, Shield, Sparkles, Swords } from 'lucide-react';
import {
  SAINT_CLOTH_RANK_ACCENT,
  SAINT_GOLD_CLOTH_UI,
  SAINT_SEIYA_CLOTH_BY_ID,
  SAINT_SEIYA_GOLD_CLOTHS,
  SAINT_SEIYA_CLOTHS,
  clothRankLabel,
  type SaintClothRank,
} from '../data/saintSeiyaCloths';
import { trackAchievementEvent } from '../stores/achievements';
import {
  SAINT_SEIYA_OPEN_MS,
  SAINT_SEIYA_SPAWN_INTERVAL_MS,
  buildSaintSeiyaChest,
  useSaintSeiyaSanctuaryStore,
} from '../stores/saintSeiyaSanctuary';
import {
  type BattleStrategy,
  type SaintBattleEvent,
  goldTempleProgress,
  saintLevelFromExp,
  unlockedSaintMoves,
} from '../utils/saintSeiyaBattle';

interface SaintSeiyaSanctuaryProps {
  visualStyle: string;
  viewportMoving: boolean;
  nodeDragging: boolean;
}

interface SanctuaryRuntimeSnapshot {
  collected: ReturnType<typeof useSaintSeiyaSanctuaryStore.getState>['collected'];
  activeChest: ReturnType<typeof useSaintSeiyaSanctuaryStore.getState>['activeChest'];
  openingTarget: ReturnType<typeof useSaintSeiyaSanctuaryStore.getState>['openingTarget'];
  battle: ReturnType<typeof useSaintSeiyaSanctuaryStore.getState>['battle'];
  nextSpawnAt: number;
  totalExp: number;
  hadesModeActive: boolean;
  viewportMoving: boolean;
  nodeDragging: boolean;
}

interface SaintClothUnlockEffect {
  clothId: string;
  rank: SaintClothRank;
  nonce: number;
}

const SANCTUARY_COLLAPSED_STORAGE_KEY = 't8.saintSeiyaSanctuary.collapsed.v2';
const SAINT_BATTLE_EVENT_REVEAL_MS = 820;

function formatMs(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function countByRank(
  collected: ReturnType<typeof useSaintSeiyaSanctuaryStore.getState>['collected'],
  rank: SaintClothRank,
) {
  return Object.values(collected).filter((item) => item?.rank === rank).length;
}

function rankTotal(rank: SaintClothRank) {
  return SAINT_SEIYA_CLOTHS.filter((cloth) => cloth.rank === rank).length;
}

function playSaintChestSound(rank: SaintClothRank) {
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor() as AudioContext;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(rank === 'gold' ? 0.14 : 0.1, ctx.currentTime + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.72);
    master.connect(ctx.destination);
    const base = rank === 'gold' ? 440 : rank === 'silver' ? 392 : 330;
    [0, 0.12, 0.24, 0.42].forEach((at, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + at;
      osc.type = index % 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(base * (1 + index * 0.25), start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.28);
    });
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    /* best-effort feedback */
  }
}

function battleEffectLabel(effectStyle?: string) {
  const labels: Record<string, string> = {
    strike: '音速拳压',
    cosmo: '小宇宙爆燃',
    meteor: '流星拳雨',
    dragon: '庐山龙气',
    ice: '冰结星尘',
    chain: '星云锁链',
    fire: '凤凰火羽',
    lightning: '雷光拳雨',
    galaxy: '银河裂隙',
    crystal: '水晶星屑',
    horn: '巨角震波',
    underworld: '冥界波纹',
    lotus: '六道光轮',
    weapon: '天秤兵装',
    needle: '猩红赤针',
    arrow: '黄金箭翼',
    blade: '圣剑斩线',
    aurora: '极光冰环',
    rose: '玫瑰花径',
    shield: '圣衣护壁',
  };
  return labels[effectStyle || ''] || '圣衣共鸣';
}

function playSaintBattleSound(event: Pick<SaintBattleEvent, 'kind' | 'actor' | 'soundCue' | 'damage' | 'intensity'>) {
  try {
    if (event.kind === 'intro' || event.kind === 'stance' || event.kind === 'reward') return;
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor() as AudioContext;
    const cue = event.soundCue || (event.kind === 'clash' ? 'cosmo' : event.actor === 'enemy' ? 'strike' : 'cosmo');
    const profile = (() => {
      switch (cue) {
        case 'meteor': return { freqs: [520, 720, 980, 1220], type: 'triangle' as OscillatorType, step: 0.045, dur: 0.16, bend: 1.18 };
        case 'dragon': return { freqs: [150, 220, 330, 460], type: 'sawtooth' as OscillatorType, step: 0.07, dur: 0.24, bend: 1.5 };
        case 'ice': return { freqs: [900, 1180, 1480], type: 'sine' as OscillatorType, step: 0.08, dur: 0.28, bend: 0.72 };
        case 'aurora': return { freqs: [760, 1040, 1320, 1660], type: 'sine' as OscillatorType, step: 0.055, dur: 0.24, bend: 1.28 };
        case 'chain': return { freqs: [380, 520, 420, 610], type: 'square' as OscillatorType, step: 0.045, dur: 0.11, bend: 0.92 };
        case 'fire': return { freqs: [220, 360, 540, 700], type: 'sawtooth' as OscillatorType, step: 0.052, dur: 0.2, bend: 1.22 };
        case 'lightning': return { freqs: [640, 1160, 820, 1480, 980], type: 'square' as OscillatorType, step: 0.032, dur: 0.09, bend: 1.08 };
        case 'galaxy': return { freqs: [260, 520, 780, 1040], type: 'triangle' as OscillatorType, step: 0.075, dur: 0.31, bend: 0.86 };
        case 'crystal': return { freqs: [620, 930, 1240, 1550], type: 'sine' as OscillatorType, step: 0.05, dur: 0.2, bend: 1.04 };
        case 'horn': return { freqs: [120, 180, 240], type: 'sawtooth' as OscillatorType, step: 0.08, dur: 0.32, bend: 1.12 };
        case 'underworld': return { freqs: [92, 138, 206], type: 'sine' as OscillatorType, step: 0.09, dur: 0.36, bend: 0.82 };
        case 'lotus': return { freqs: [432, 648, 864, 1080], type: 'triangle' as OscillatorType, step: 0.07, dur: 0.26, bend: 1.06 };
        case 'weapon': return { freqs: [330, 660, 495, 880], type: 'square' as OscillatorType, step: 0.05, dur: 0.12, bend: 1.02 };
        case 'needle': return { freqs: [760, 920, 1180, 1520], type: 'square' as OscillatorType, step: 0.035, dur: 0.085, bend: 1 };
        case 'arrow': return { freqs: [420, 840, 1260], type: 'triangle' as OscillatorType, step: 0.06, dur: 0.24, bend: 1.42 };
        case 'blade': return { freqs: [480, 960, 380], type: 'sawtooth' as OscillatorType, step: 0.055, dur: 0.14, bend: 0.64 };
        case 'rose': return { freqs: [520, 690, 880, 1170], type: 'triangle' as OscillatorType, step: 0.075, dur: 0.22, bend: 1.01 };
        case 'shield': return { freqs: [260, 390, 520], type: 'sine' as OscillatorType, step: 0.075, dur: 0.28, bend: 0.92 };
        case 'cosmo': return { freqs: [196, 392, 588, 784], type: 'triangle' as OscillatorType, step: 0.07, dur: 0.3, bend: 1.16 };
        default: return { freqs: [220, 330, 440], type: 'square' as OscillatorType, step: 0.045, dur: 0.12, bend: 1 };
      }
    })();
    const master = ctx.createGain();
    const intensity = Math.max(0.42, Math.min(1.18, event.intensity || 0.72));
    const damageLift = Math.min(0.035, Math.max(0, event.damage || 0) / 7200);
    const peakGain = Math.min(0.12, (0.045 + damageLift) * intensity);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(peakGain, ctx.currentTime + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.72);
    master.connect(ctx.destination);
    profile.freqs.forEach((freq, index) => {
      const start = ctx.currentTime + index * profile.step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = profile.type;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * profile.bend), start + profile.dur * 0.84);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.26, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + profile.dur + 0.04);
    });
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    /* best-effort feedback */
  }
}

function chestBounds(
  getNodes: ReturnType<typeof useReactFlow>['getNodes'],
  screenToFlowPosition: ReturnType<typeof useReactFlow>['screenToFlowPosition'],
) {
  const nodes = getNodes();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const w = (node as any).measured?.width || (node as any).width || 360;
    const h = (node as any).measured?.height || (node as any).height || 260;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    const shell = document.querySelector<HTMLElement>('.t8-canvas-shell');
    const rect = shell?.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
    });
    return {
      minX: center.x - 1200,
      maxX: center.x + 1200,
      minY: center.y - 900,
      maxY: center.y + 900,
    };
  }

  const padX = Math.max(900, (maxX - minX) * 0.34);
  const padY = Math.max(680, (maxY - minY) * 0.34);
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  };
}

export default function SaintSeiyaSanctuary({ visualStyle, viewportMoving, nodeDragging }: SaintSeiyaSanctuaryProps) {
  const { getNodes, getViewport, screenToFlowPosition, setCenter } = useReactFlow();
  const [now, setNow] = useState(Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [battleHideRemaining, setBattleHideRemaining] = useState<number | null>(null);
  const [visibleBattleEventCount, setVisibleBattleEventCount] = useState(0);
  const [clothUnlock, setClothUnlock] = useState<SaintClothUnlockEffect | null>(null);
  const holdStartedRef = useRef<number | null>(null);
  const autoBattleIdRef = useRef<string | null>(null);
  const clothUnlockTimerRef = useRef<number | null>(null);
  const battleSoundEventRef = useRef<string | null>(null);
  const battleRewardAppliedRef = useRef<string | null>(null);
  const battleLogRef = useRef<HTMLDivElement | null>(null);
  const devLevel99AppliedRef = useRef(false);
  const isSaintSeiyaTheme = visualStyle === 'saint-seiya';

  const collected = useSaintSeiyaSanctuaryStore((state) => state.collected);
  const activeChest = useSaintSeiyaSanctuaryStore((state) => state.activeChest);
  const openingTarget = useSaintSeiyaSanctuaryStore((state) => state.openingTarget);
  const nextSpawnAt = useSaintSeiyaSanctuaryStore((state) => state.nextSpawnAt);
  const battle = useSaintSeiyaSanctuaryStore((state) => state.battle);
  const totalExp = useSaintSeiyaSanctuaryStore((state) => state.totalExp);
  const winCount = useSaintSeiyaSanctuaryStore((state) => state.winCount);
  const hadesUnlockedAt = useSaintSeiyaSanctuaryStore((state) => state.hadesUnlockedAt);
  const hadesModeActive = useSaintSeiyaSanctuaryStore((state) => state.hadesModeActive);
  const hadesAnimationUntil = useSaintSeiyaSanctuaryStore((state) => state.hadesAnimationUntil);
  const cleanupExpired = useSaintSeiyaSanctuaryStore((state) => state.cleanupExpired);
  const setNextSpawnAt = useSaintSeiyaSanctuaryStore((state) => state.setNextSpawnAt);
  const spawnChest = useSaintSeiyaSanctuaryStore((state) => state.spawnChest);
  const expireActiveChest = useSaintSeiyaSanctuaryStore((state) => state.expireActiveChest);
  const beginOpening = useSaintSeiyaSanctuaryStore((state) => state.beginOpening);
  const setOpeningProgress = useSaintSeiyaSanctuaryStore((state) => state.setOpeningProgress);
  const openTrackedChest = useSaintSeiyaSanctuaryStore((state) => state.openTrackedChest);
  const resolveBattle = useSaintSeiyaSanctuaryStore((state) => state.resolveBattle);
  const finalizeBattleReward = useSaintSeiyaSanctuaryStore((state) => state.finalizeBattleReward);
  const clearBattle = useSaintSeiyaSanctuaryStore((state) => state.clearBattle);
  const setHadesModeActive = useSaintSeiyaSanctuaryStore((state) => state.setHadesModeActive);
  const resetSanctuary = useSaintSeiyaSanctuaryStore((state) => state.resetSanctuary);
  const runtimeRef = useRef<SanctuaryRuntimeSnapshot>({
    collected,
    activeChest,
    openingTarget,
    battle,
    nextSpawnAt,
    totalExp,
    hadesModeActive,
    viewportMoving,
    nodeDragging,
  });
  runtimeRef.current = {
    collected,
    activeChest,
    openingTarget,
    battle,
    nextSpawnAt,
    totalExp,
    hadesModeActive,
    viewportMoving,
    nodeDragging,
  };

  useEffect(() => {
    if (!isSaintSeiyaTheme || devLevel99AppliedRef.current || !import.meta.env.DEV || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('saintLv99') && !params.has('t8SaintLv99')) return;
    devLevel99AppliedRef.current = true;
    useSaintSeiyaSanctuaryStore.setState({
      activeChest: null,
      openingTarget: null,
      battle: null,
      nextSpawnAt: Date.now(),
      totalExp: 980,
    });
    setFeedback('测试模式：已设置 Lv99');
  }, [isSaintSeiyaTheme]);

  const level = saintLevelFromExp(totalExp);
  const expInLevel = Math.max(0, totalExp % 10);
  const bronzeCount = useMemo(() => countByRank(collected, 'bronze'), [collected]);
  const silverCount = useMemo(() => countByRank(collected, 'silver'), [collected]);
  const goldCount = useMemo(() => countByRank(collected, 'gold'), [collected]);
  const availableMoves = useMemo(() => unlockedSaintMoves(collected).slice(-5), [collected]);
  const goldTemple = useMemo(() => goldTempleProgress(collected), [collected]);
  const goldStageLabel = goldTemple.next
    ? `第${goldTemple.nextIndex + 1}宫 ${goldTemple.next.constellation}`
    : '十二宫完成';
  const openingRatio = openingTarget ? Math.max(0, Math.min(1, openingTarget.progressMs / SAINT_SEIYA_OPEN_MS)) : 0;
  const nextSpawnRemainingMs = Math.max(0, nextSpawnAt - now);
  const showHadesAnimation = isSaintSeiyaTheme && hadesAnimationUntil > now;
  const battleEventTotal = battle?.report
    ? (battle.report.events?.length || battle.report.log.length || 0)
    : 0;
  const battlePlaybackComplete = Boolean(battle?.report && battleEventTotal > 0 && visibleBattleEventCount >= battleEventTotal);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isSaintSeiyaTheme && hadesModeActive) {
      root.setAttribute('data-saint-mode', 'hades');
    } else {
      root.removeAttribute('data-saint-mode');
    }
    return () => root.removeAttribute('data-saint-mode');
  }, [hadesModeActive, isSaintSeiyaTheme]);

  useEffect(() => {
    return () => {
      if (clothUnlockTimerRef.current) {
        window.clearTimeout(clothUnlockTimerRef.current);
        clothUnlockTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!clothUnlock) return;
    const duration = clothUnlock.rank === 'gold' ? 4200 : clothUnlock.rank === 'silver' ? 3000 : 2400;
    const timer = window.setTimeout(() => setClothUnlock(null), duration);
    return () => window.clearTimeout(timer);
  }, [clothUnlock]);

  useEffect(() => {
    if (!isSaintSeiyaTheme || typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(SANCTUARY_COLLAPSED_STORAGE_KEY);
    setCollapsed(saved === '1');
  }, [isSaintSeiyaTheme]);

  useEffect(() => {
    if (!isSaintSeiyaTheme) return;
    cleanupExpired(Date.now());
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      cleanupExpired(current);
      const snapshot = runtimeRef.current;
      if (snapshot.activeChest && snapshot.activeChest.expiresAt <= current) {
        expireActiveChest();
        return;
      }
      if (
        snapshot.activeChest
        || snapshot.openingTarget
        || snapshot.battle
        || snapshot.viewportMoving
        || snapshot.nodeDragging
      ) return;
      if (typeof document !== 'undefined' && (document.visibilityState !== 'visible' || !document.hasFocus())) return;
      if (current < snapshot.nextSpawnAt) return;
      const chest = buildSaintSeiyaChest({
        now: current,
        totalExp: snapshot.totalExp,
        collected: snapshot.collected,
        bounds: chestBounds(getNodes, screenToFlowPosition),
      });
      if (!chest) {
        setNextSpawnAt(current + SAINT_SEIYA_SPAWN_INTERVAL_MS);
        return;
      }
      spawnChest(chest);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [
    cleanupExpired,
    expireActiveChest,
    getNodes,
    isSaintSeiyaTheme,
    screenToFlowPosition,
    setNextSpawnAt,
    spawnChest,
  ]);

  useEffect(() => {
    if (!isSaintSeiyaTheme || !openingTarget) {
      holdStartedRef.current = null;
      return;
    }
    const timer = window.setInterval(() => {
      const current = Date.now();
      const shell = document.querySelector<HTMLElement>('.t8-canvas-shell');
      const rect = shell?.getBoundingClientRect();
      const center = screenToFlowPosition({
        x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      });
      const zoom = Math.max(0.12, getViewport().zoom || 1);
      const threshold = Math.max(150, 170 / zoom);
      const distance = Math.hypot(center.x - openingTarget.x, center.y - openingTarget.y);
      if (distance <= threshold) {
        if (!holdStartedRef.current) holdStartedRef.current = current;
        const progressMs = current - holdStartedRef.current;
        setOpeningProgress(progressMs, holdStartedRef.current);
        if (progressMs >= SAINT_SEIYA_OPEN_MS) {
          const nextBattle = openTrackedChest(current);
          if (nextBattle) {
            playSaintChestSound(nextBattle.chest.rank);
            const cloth = SAINT_SEIYA_CLOTH_BY_ID[nextBattle.chest.clothId];
            setFeedback(`${cloth?.label || '圣衣'} 已开启试炼`);
          }
        }
      } else {
        holdStartedRef.current = null;
        setOpeningProgress(0, null);
      }
    }, 180);
    return () => window.clearInterval(timer);
  }, [
    getViewport,
    isSaintSeiyaTheme,
    openTrackedChest,
    openingTarget?.chestId,
    openingTarget?.x,
    openingTarget?.y,
    screenToFlowPosition,
    setOpeningProgress,
  ]);

  const handleResolveBattle = useCallback((strategy: BattleStrategy) => {
    const result = resolveBattle(strategy);
    if (!result.battle) return;
    setFeedback('圣衣试炼进行中，战斗结束后结算奖励');
  }, [resolveBattle]);

  useEffect(() => {
    if (!isSaintSeiyaTheme || !battle) {
      autoBattleIdRef.current = null;
      battleSoundEventRef.current = null;
      battleRewardAppliedRef.current = null;
      setVisibleBattleEventCount(0);
      return;
    }
    if (battle.report || autoBattleIdRef.current === battle.id) return;
    autoBattleIdRef.current = battle.id;
    const timer = window.setTimeout(() => handleResolveBattle('auto'), 680);
    return () => window.clearTimeout(timer);
  }, [battle?.id, battle?.report, handleResolveBattle, isSaintSeiyaTheme]);

  useEffect(() => {
    if (!isSaintSeiyaTheme || !battle?.report) {
      setVisibleBattleEventCount(0);
      return;
    }
    const total = battle.report.events?.length || battle.report.log.length || 0;
    setVisibleBattleEventCount(0);
    if (!total) return;
    let nextCount = 0;
    let timer: number | null = null;
    const revealNext = () => {
      nextCount += 1;
      setVisibleBattleEventCount(Math.min(nextCount, total));
      if (nextCount < total) {
        timer = window.setTimeout(revealNext, SAINT_BATTLE_EVENT_REVEAL_MS);
      }
    };
    timer = window.setTimeout(revealNext, 180);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [battle?.id, battle?.report, isSaintSeiyaTheme]);

  useEffect(() => {
    if (!isSaintSeiyaTheme || !battle?.report || !battlePlaybackComplete) return;
    if (battle.rewardApplied || battleRewardAppliedRef.current === battle.id) return;
    battleRewardAppliedRef.current = battle.id;
    const result = finalizeBattleReward();
    if (!result.battle) return;
    const cloth = result.clothId ? SAINT_SEIYA_CLOTH_BY_ID[result.clothId] : null;
    if (hadesModeActive) {
      trackAchievementEvent({
        type: 'hidden_mode.used',
        theme: 'saint-seiya',
        kind: 'saint-seiya-hades',
        mode: 'used',
      });
    }
    if (result.victory && cloth) {
      trackAchievementEvent({
        type: 'saint_seiya.cloth_collected',
        theme: 'saint-seiya',
        kind: cloth.rank,
      });
      if (clothUnlockTimerRef.current) window.clearTimeout(clothUnlockTimerRef.current);
      clothUnlockTimerRef.current = window.setTimeout(() => {
        setClothUnlock({ clothId: cloth.id, rank: cloth.rank, nonce: Date.now() });
        playSaintChestSound(cloth.rank);
        clothUnlockTimerRef.current = null;
      }, 240);
    }
    if (result.victory) {
      trackAchievementEvent({
        type: 'saint_seiya.battle_won',
        theme: 'saint-seiya',
        kind: result.rank || 'unknown',
      });
    }
    if (result.usedCosmoBurst) {
      trackAchievementEvent({
        type: 'saint_seiya.cosmo_burst',
        theme: 'saint-seiya',
        kind: 'cosmo',
      });
    }
    if (result.firstHadesUnlock) {
      trackAchievementEvent({
        type: 'saint_seiya.gold_completed',
        theme: 'saint-seiya',
        kind: 'twelve-gold',
      });
      trackAchievementEvent({
        type: 'hidden_mode.enabled',
        theme: 'saint-seiya',
        kind: 'saint-seiya-hades',
        mode: 'enabled',
      });
    }
    setFeedback(result.victory && cloth
      ? `${cloth.label} 获得，Lv${result.levelBefore} -> Lv${result.levelAfter}`
      : `试炼失败，获得 ${result.expGain} 经验`);
  }, [
    battle?.id,
    battle?.report,
    battle?.rewardApplied,
    battlePlaybackComplete,
    finalizeBattleReward,
    hadesModeActive,
    isSaintSeiyaTheme,
  ]);

  useEffect(() => {
    if (!isSaintSeiyaTheme || !battle?.report || !battlePlaybackComplete) {
      setBattleHideRemaining(null);
      return;
    }
    const battleId = battle.id;
    const deadline = Date.now() + 3000;
    const updateRemaining = () => {
      setBattleHideRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 200);
    const timer = window.setTimeout(() => {
      window.clearInterval(interval);
      setBattleHideRemaining(0);
      const currentBattle = useSaintSeiyaSanctuaryStore.getState().battle;
      if (currentBattle?.id === battleId && currentBattle.report) {
        clearBattle();
      }
    }, 3100);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, [battle?.id, battle?.report, battlePlaybackComplete, clearBattle, isSaintSeiyaTheme]);

  useEffect(() => {
    if (!isSaintSeiyaTheme || !battle?.report || visibleBattleEventCount <= 0) return;
    const source = battle.report.events?.length ? battle.report.events : [];
    const event = source[Math.min(visibleBattleEventCount, source.length) - 1];
    if (!event || battleSoundEventRef.current === event.id) return;
    battleSoundEventRef.current = event.id;
    playSaintBattleSound(event);
  }, [battle?.id, battle?.report, isSaintSeiyaTheme, visibleBattleEventCount]);

  useEffect(() => {
    if (!isSaintSeiyaTheme || !battle) return;
    const log = battleLogRef.current;
    if (!log) return;
    const raf = window.requestAnimationFrame(() => {
      log.scrollTop = log.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [battle?.id, isSaintSeiyaTheme, visibleBattleEventCount]);

  if (!isSaintSeiyaTheme) return null;

  const handleChestClick = () => {
    if (!activeChest) return;
    beginOpening(activeChest);
    const { zoom } = getViewport();
    setCenter(activeChest.x, activeChest.y, {
      zoom: Math.max(0.48, Math.min(1.15, zoom || 0.8)),
      duration: 620,
    });
  };

  const handleToggleCollapsed = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SANCTUARY_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* local preference is best-effort */
      }
      return next;
    });
  };

  const handleHadesModeSwitch = () => {
    const next = !hadesModeActive;
    setHadesModeActive(next);
    if (next) {
      trackAchievementEvent({
        type: 'hidden_mode.enabled',
        theme: 'saint-seiya',
        kind: 'saint-seiya-hades',
        mode: 'enabled',
      });
    }
  };

  const stopBattleLogCanvasEvent = (
    event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement> | WheelEvent<HTMLDivElement>,
  ) => {
    event.stopPropagation();
  };

  const chestCloth = activeChest ? SAINT_SEIYA_CLOTH_BY_ID[activeChest.clothId] : null;
  const battleCloth = battle ? SAINT_SEIYA_CLOTH_BY_ID[battle.chest.clothId] : null;
  const legacyBattleEvents: SaintBattleEvent[] = battle?.report && !battle.report.events?.length
    ? battle.report.log.map((text, index) => ({
        id: `${battle.id}-legacy-${index}`,
        turn: index,
        actor: 'system',
        kind: 'intro',
        text,
        playerHp: battle.report?.playerHp || 0,
        enemyHp: battle.report?.enemyHp || 0,
        playerMp: battle.report?.playerMp || 0,
        enemyMp: battle.report?.enemyMp || 0,
        playerMaxHp: battle.report?.playerMaxHp || 1,
        enemyMaxHp: battle.report?.enemyMaxHp || battle.enemy.stats.hp || 1,
        playerMaxMp: battle.report?.playerMaxMp || 1,
        enemyMaxMp: battle.report?.enemyMaxMp || battle.enemy.stats.mp || 1,
      }))
    : [];
  const battleEventSource = battle?.report?.events?.length ? battle.report.events : legacyBattleEvents;
  const visibleBattleEvents = battle?.report ? battleEventSource.slice(0, visibleBattleEventCount) : [];
  const battleDisplayLines = battle?.report
    ? visibleBattleEvents
    : battle
      ? [
          {
            id: `${battle.id}-pending-1`,
            actor: 'system',
            kind: 'intro',
            text: battleCloth ? `你与${battle.enemy.name}在${battleCloth.constellation}宫门前对峙，圣衣箱正在展开。` : '圣斗士试炼开始。',
          },
          {
            id: `${battle.id}-pending-2`,
            actor: 'player',
            kind: 'stance',
            text: '自动战斗中：系统会优先释放当前最强可用招式。',
          },
        ]
      : [];
  const latestBattleEvent = visibleBattleEvents[visibleBattleEvents.length - 1] || battleEventSource[0] || null;
  const battlePercent = (value: number, max: number) => `${Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)))}%`;
  const enemyHpNow = latestBattleEvent?.enemyHp ?? battle?.enemy.stats.hp ?? 0;
  const enemyHpMax = latestBattleEvent?.enemyMaxHp ?? battle?.enemy.stats.hp ?? 1;
  const playerHpNow = latestBattleEvent?.playerHp ?? battle?.report?.playerHp ?? 0;
  const playerHpMax = latestBattleEvent?.playerMaxHp ?? battle?.report?.playerMaxHp ?? 1;
  const playerMpNow = latestBattleEvent?.playerMp ?? battle?.report?.playerMp ?? 0;
  const playerMpMax = latestBattleEvent?.playerMaxMp ?? battle?.report?.playerMaxMp ?? 1;
  const unlockCloth = clothUnlock ? SAINT_SEIYA_CLOTH_BY_ID[clothUnlock.clothId] : null;
  const unlockGoldUi = unlockCloth?.rank === 'gold' ? SAINT_GOLD_CLOTH_UI[unlockCloth.id] : null;
  const minimapPingLeftRaw = activeChest
    ? hadesModeActive
      ? 18 + activeChest.mapX * 0.64
      : activeChest.mapX
    : 50;
  const minimapPingTopRaw = activeChest
    ? hadesModeActive
      ? 24 + activeChest.mapY * 0.48
      : activeChest.mapY
    : 50;
  const minimapPingLeft = hadesModeActive
    ? Math.max(18, Math.min(82, minimapPingLeftRaw))
    : Math.max(8, Math.min(92, minimapPingLeftRaw));
  const minimapPingTop = hadesModeActive
    ? Math.max(24, Math.min(72, minimapPingTopRaw))
    : Math.max(8, Math.min(92, minimapPingTopRaw));

  return (
    <>
      <div
        className={`t8-saint-sanctuary nodrag nopan ${collapsed ? 'is-collapsed' : 'is-expanded'} ${activeChest ? 'has-active-chest' : ''}`}
        data-canvas-floating-ui="saint-seiya-sanctuary"
      >
        <button
          type="button"
          className="t8-saint-sanctuary__toolbar-toggle"
          onClick={handleToggleCollapsed}
          title={collapsed ? '展开圣域罗盘' : '折叠圣域罗盘'}
          aria-label={collapsed ? '展开圣域罗盘' : '折叠圣域罗盘'}
          aria-expanded={!collapsed}
        >
          <span className="t8-saint-sanctuary__toggle-main">
            <Shield size={14} />
            <span>圣域</span>
            <strong>Lv{level}</strong>
          </span>
          <em>{goldStageLabel}</em>
        </button>

        {!collapsed && (
          <section className={`t8-saint-sanctuary__panel ${hadesModeActive ? 'is-hades' : ''}`}>
            <div className="t8-saint-sanctuary__header">
              <span>
                <Shield size={14} />
                圣域罗盘
              </span>
              <strong>Lv{level}</strong>
            </div>
            <div className="t8-saint-sanctuary__exp">
              <span>EXP {expInLevel}/10</span>
              <i style={{ width: `${Math.round((expInLevel / 10) * 100)}%` }} />
            </div>
            <div className="t8-saint-sanctuary__cloth-grid">
              <span style={{ '--saint-rank': SAINT_CLOTH_RANK_ACCENT.bronze } as any}>青铜 {bronzeCount}/{rankTotal('bronze')}</span>
              <span style={{ '--saint-rank': SAINT_CLOTH_RANK_ACCENT.silver } as any}>白银 {silverCount}/{rankTotal('silver')}</span>
              <span style={{ '--saint-rank': SAINT_CLOTH_RANK_ACCENT.gold } as any}>
                黄金 {goldCount}/12 · {goldTemple.next ? goldTemple.next.constellation : '冥界篇'}
              </span>
            </div>
            <div className="t8-saint-gold-track" aria-label="黄金十二宫圣衣进度">
              {SAINT_SEIYA_GOLD_CLOTHS.map((cloth) => {
                const ui = SAINT_GOLD_CLOTH_UI[cloth.id];
                const isCollected = Boolean(collected[cloth.id]);
                const isNext = goldTemple.next?.id === cloth.id;
                return (
                  <span
                    key={cloth.id}
                    className={`t8-saint-gold-card is-${cloth.id} ${isCollected ? 'is-collected' : ''} ${isNext ? 'is-next' : ''}`}
                    data-gold-cloth={cloth.id}
                    title={`第${ui?.temple || '?'}宫 · ${cloth.label} · ${ui?.effect || cloth.moves[0]?.name || '黄金圣衣'}`}
                    style={{
                      '--saint-gold-card-accent': ui?.accent || SAINT_CLOTH_RANK_ACCENT.gold,
                      '--saint-gold-card-secondary': ui?.secondary || SAINT_CLOTH_RANK_ACCENT.gold,
                      '--saint-gold-card-aura': ui?.aura || SAINT_CLOTH_RANK_ACCENT.gold,
                    } as any}
                  >
                    <b>{ui?.glyph || '★'}</b>
                    <span>{ui?.shortName || cloth.constellation.slice(0, 2)}</span>
                    <em>{ui?.temple || 0}</em>
                  </span>
                );
              })}
            </div>
            <div className="t8-saint-sanctuary__status">
              {feedback
                || (battle
                  ? `${battle.enemy.name} 试炼中`
                  : openingTarget
                    ? `保持视角 ${Math.max(0, Math.ceil((SAINT_SEIYA_OPEN_MS - openingTarget.progressMs) / 1000))}s`
                    : activeChest && chestCloth
                      ? `${clothRankLabel(activeChest.rank)}反应：${chestCloth.constellation} · ${Math.max(0, Math.ceil((activeChest.expiresAt - now) / 1000))}s`
                      : hadesModeActive
                        ? '冥界篇已开启'
                        : `下一次宝箱 ${formatMs(nextSpawnRemainingMs)}`)}
            </div>
            {openingTarget && (
              <div className="t8-saint-sanctuary__hold">
                <span style={{ width: `${Math.round(openingRatio * 100)}%` }} />
              </div>
            )}
            <div className="t8-saint-sanctuary__moves">
              {availableMoves.map((move) => (
                <span key={move.id}>{move.name}</span>
              ))}
            </div>
            <div className="t8-saint-sanctuary__actions">
              <button type="button" onClick={() => setNextSpawnAt(Date.now())} title="立即扫描下一处宝箱">
                <MapPin size={12} />
                巡查
              </button>
              <button
                type="button"
                onClick={handleHadesModeSwitch}
                disabled={!hadesUnlockedAt}
                title={hadesModeActive ? '退出冥界篇' : '进入冥界篇'}
              >
                <Power size={12} />
                {hadesModeActive ? '圣域' : '冥界'}
              </button>
              <button type="button" onClick={resetSanctuary} title="重置圣衣收集">
                <RotateCcw size={12} />
              </button>
            </div>
          </section>
        )}
      </div>

      {battle && (
        <div
          className={`t8-saint-battle t8-saint-battle--dock nodrag nopan is-${battle.enemy.rank} ${battle.report ? 'is-resolved' : 'is-running'}`}
          data-canvas-floating-ui="saint-seiya-battle-log"
          role="status"
          aria-live="polite"
        >
          <div className="t8-saint-battle__header">
            <span>
              <Swords size={15} />
              你 vs {battle.enemy.name}
            </span>
            <strong>Lv{battle.enemy.level}</strong>
          </div>
          <div className="t8-saint-battle__stats">
            <span>敌 HP {Math.max(0, enemyHpNow)}/{enemyHpMax}</span>
            <span>ATK {battle.enemy.stats.atk}</span>
            <span>{battleCloth?.label || '圣衣试炼'}</span>
          </div>
          {battle.report && (
            <div className="t8-saint-battle__bars" aria-label="战斗状态">
              <div className="t8-saint-battle__bar is-enemy">
                <span>敌方 HP</span>
                <i style={{ width: battlePercent(enemyHpNow, enemyHpMax) }} />
              </div>
              <div className="t8-saint-battle__bar is-player">
                <span>我方 HP</span>
                <i style={{ width: battlePercent(playerHpNow, playerHpMax) }} />
              </div>
              <div className="t8-saint-battle__bar is-cosmo">
                <span>小宇宙</span>
                <i style={{ width: battlePercent(playerMpNow, playerMpMax) }} />
              </div>
            </div>
          )}
          {battle.report && latestBattleEvent?.effectStyle && (
            <div
              key={latestBattleEvent.id}
              className={`t8-saint-battle__skill-fx is-${latestBattleEvent.effectStyle}`}
              data-effect-id={latestBattleEvent.effectId}
              style={{ '--saint-fx-accent': latestBattleEvent.accent || SAINT_CLOTH_RANK_ACCENT[battle.enemy.rank] } as any}
              aria-label={`当前技能特效：${battleEffectLabel(latestBattleEvent.effectStyle)}`}
            >
              <i />
              <i />
              <i />
              <strong>{latestBattleEvent.moveName || battleEffectLabel(latestBattleEvent.effectStyle)}</strong>
              <span>{battleEffectLabel(latestBattleEvent.effectStyle)}</span>
            </div>
          )}
          {battle.report && battlePlaybackComplete && (
            <div className={`t8-saint-battle__result ${battle.report.victory ? 'is-win' : 'is-lose'}`}>
              {battle.report.victory ? '胜利' : '失败'} · +{battle.report.expGain} EXP
            </div>
          )}
          <div
            ref={battleLogRef}
            className="t8-saint-battle__log"
            onWheelCapture={stopBattleLogCanvasEvent}
            onPointerDownCapture={stopBattleLogCanvasEvent}
            onMouseDownCapture={stopBattleLogCanvasEvent}
          >
            {battleDisplayLines.map((line, index) => (
              <span
                key={line.id}
                className={`t8-saint-battle__line is-${line.actor} is-${line.kind} ${index === battleDisplayLines.length - 1 ? 'is-current' : ''}`}
                style={{ '--saint-line-accent': 'accent' in line && line.accent ? line.accent : undefined } as any}
              >
                {line.text}
              </span>
            ))}
          </div>
          <div className="t8-saint-battle__meta">
            {battle.report
              ? battlePlaybackComplete
                ? <span><strong>{battleHideRemaining ?? 3}</strong> 秒后隐藏</span>
                : <span>{Math.min(visibleBattleEventCount, battleEventTotal)}/{battleEventTotal} 演出中</span>
              : <span>自动燃烧小宇宙...</span>}
            <span>胜场 {winCount} · 黄金 {goldCount}/12</span>
          </div>
        </div>
      )}

      {unlockCloth && (
        <div
          className={`t8-saint-cloth-unlock t8-saint-cloth-unlock--${unlockCloth.rank} nodrag nopan`}
          data-canvas-floating-ui="saint-seiya-cloth-unlock"
          data-gold-cloth={unlockGoldUi ? unlockCloth.id : undefined}
          style={{
            '--saint-unlock-accent': unlockGoldUi?.accent || SAINT_CLOTH_RANK_ACCENT[unlockCloth.rank],
            '--saint-unlock-secondary': unlockGoldUi?.secondary || SAINT_CLOTH_RANK_ACCENT[unlockCloth.rank],
            '--saint-unlock-aura': unlockGoldUi?.aura || SAINT_CLOTH_RANK_ACCENT[unlockCloth.rank],
          } as any}
        >
          <div className="t8-saint-cloth-unlock__ring" aria-hidden="true" />
          <div className="t8-saint-cloth-unlock__card">
            <span className="t8-saint-cloth-unlock__glyph">
              {unlockGoldUi?.glyph || (unlockCloth.rank === 'silver' ? '✦' : unlockCloth.rank === 'bronze' ? '◇' : '★')}
            </span>
            <small>
              {unlockGoldUi
                ? `第${unlockGoldUi.temple}宫 · ${unlockGoldUi.sigil}`
                : clothRankLabel(unlockCloth.rank)}
            </small>
            <strong>{unlockCloth.label}</strong>
            <em>{unlockGoldUi?.effect || unlockGoldUi?.motif || unlockCloth.element}</em>
            <p>{unlockGoldUi?.unlockText || `${clothRankLabel(unlockCloth.rank)}归位，新的招式已经加入小宇宙。`}</p>
          </div>
        </div>
      )}

      {activeChest && chestCloth && (
        <div
          className={`t8-saint-sanctuary__minimap-ping-layer nodrag nopan ${hadesModeActive ? 'is-hades' : 'is-sanctuary'}`}
          data-canvas-floating-ui="saint-seiya-minimap-ping"
          data-saint-rank={activeChest.rank}
        >
          {hadesModeActive && (
            <>
              <span className="t8-saint-hades-minimap__gate" aria-hidden="true" />
              <span className="t8-saint-hades-minimap__river" aria-hidden="true" />
              <span className="t8-saint-hades-minimap__orbit" aria-hidden="true" />
              <span className="t8-saint-hades-minimap__scanner" aria-hidden="true" />
              <span className="t8-saint-hades-minimap__athena" aria-hidden="true" />
              <span className="t8-saint-hades-minimap__label" aria-hidden="true">HADES MAP</span>
              <span className="t8-saint-hades-minimap__temples" aria-hidden="true">
                {SAINT_SEIYA_GOLD_CLOTHS.map((cloth, index) => (
                  <i key={cloth.id} style={{ '--saint-temple-index': index } as any}>
                    {index + 1}
                  </i>
                ))}
              </span>
            </>
          )}
          <button
            type="button"
            className={`t8-saint-sanctuary__ping is-${activeChest.rank} ${openingTarget?.chestId === activeChest.id ? 'is-opening' : ''}`}
            style={{ left: `${minimapPingLeft}%`, top: `${minimapPingTop}%` }}
            onClick={(event) => {
              event.stopPropagation();
              if (!openingTarget) handleChestClick();
            }}
            title={`发现 ${chestCloth.label}，点击跳转`}
            aria-label={`发现 ${chestCloth.label}，点击跳转`}
          >
            {activeChest.rank === 'gold' ? <Crown size={14} /> : activeChest.rank === 'silver' ? <Sparkles size={14} /> : <Gem size={14} />}
          </button>
        </div>
      )}

      {openingTarget && (
        <ViewportPortal>
          <div
            className={`t8-saint-sanctuary__target is-${openingTarget.rank}`}
            style={
              {
                left: openingTarget.x,
                top: openingTarget.y,
                '--saint-open-progress': openingRatio,
              } as any
            }
          >
            <span className="t8-saint-sanctuary__chest" aria-hidden="true">
              {openingTarget.rank === 'gold' ? <Crown size={18} /> : openingTarget.rank === 'silver' ? <Sparkles size={18} /> : <Gem size={18} />}
            </span>
            <strong>{Math.round(openingRatio * 100)}%</strong>
          </div>
        </ViewportPortal>
      )}

      {showHadesAnimation && (
        <div className="t8-saint-hades-cutscene" data-canvas-floating-ui="saint-seiya-hades-cutscene">
          <div className="t8-saint-hades-cutscene__zodiac">
            {SAINT_SEIYA_GOLD_CLOTHS.map((cloth, index) => (
              <span key={cloth.id} style={{ '--saint-zodiac-index': index } as any}>{cloth.constellation.slice(0, 2)}</span>
            ))}
          </div>
          <div className="t8-saint-hades-cutscene__athena" aria-hidden="true">
            <span className="t8-saint-hades-cutscene__aura" />
            <span className="t8-saint-hades-cutscene__halo" />
            <span className="t8-saint-hades-cutscene__hair" />
            <span className="t8-saint-hades-cutscene__face" />
            <span className="t8-saint-hades-cutscene__crown" />
            <span className="t8-saint-hades-cutscene__staff" />
            <span className="t8-saint-hades-cutscene__wings" />
            <span className="t8-saint-hades-cutscene__robe" />
            <span className="t8-saint-hades-cutscene__armor" />
            <span className="t8-saint-hades-cutscene__arm t8-saint-hades-cutscene__arm--staff" />
            <span className="t8-saint-hades-cutscene__arm t8-saint-hades-cutscene__arm--free" />
          </div>
          <div className="t8-saint-hades-cutscene__title">
            <Sparkles size={22} />
            雅典娜获救
            <small>冥界篇开启 · HADES CHAPTER</small>
          </div>
          <div className="t8-saint-hades-cutscene__temples" aria-hidden="true">
            {SAINT_SEIYA_GOLD_CLOTHS.map((cloth, index) => (
              <span key={`${cloth.id}-temple`}>{index + 1}. {cloth.constellation}</span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

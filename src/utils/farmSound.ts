import type { FarmEventKind, FarmTool } from '../types/canvas';

export type FarmSoundCue =
  | 'select'
  | 'till'
  | 'seed'
  | 'water'
  | 'harvest'
  | 'build'
  | 'decor'
  | 'order'
  | 'day'
  | 'error';

interface FarmSoundProfile {
  notes: number[];
  wave: OscillatorType;
  step: number;
  duration: number;
  peak: number;
}

export const FARM_SOUND_PROFILES: Record<FarmSoundCue, FarmSoundProfile> = {
  select: { notes: [360], wave: 'triangle', step: 0.04, duration: 0.1, peak: 0.025 },
  till: { notes: [185, 136], wave: 'square', step: 0.055, duration: 0.11, peak: 0.034 },
  seed: { notes: [420, 560], wave: 'triangle', step: 0.06, duration: 0.13, peak: 0.03 },
  water: { notes: [660, 520, 440], wave: 'sine', step: 0.045, duration: 0.12, peak: 0.026 },
  harvest: { notes: [523, 659, 784], wave: 'triangle', step: 0.055, duration: 0.16, peak: 0.036 },
  build: { notes: [164, 246, 196], wave: 'square', step: 0.065, duration: 0.13, peak: 0.032 },
  decor: { notes: [392, 523], wave: 'sine', step: 0.055, duration: 0.14, peak: 0.026 },
  order: { notes: [523, 659, 880, 988], wave: 'triangle', step: 0.052, duration: 0.18, peak: 0.04 },
  day: { notes: [330, 440, 550], wave: 'sine', step: 0.07, duration: 0.17, peak: 0.028 },
  error: { notes: [180, 126], wave: 'sawtooth', step: 0.065, duration: 0.14, peak: 0.024 },
};

let farmAudioContext: AudioContext | null = null;
let lastFarmSoundAt = 0;

function audioContextCtor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as any).webkitAudioContext || null;
}

function getFarmAudioContext() {
  const AudioContextCtor = audioContextCtor();
  if (!AudioContextCtor) return null;
  if (!farmAudioContext || farmAudioContext.state === 'closed') {
    farmAudioContext = new AudioContextCtor() as AudioContext;
  }
  return farmAudioContext;
}

export function farmSoundCueForEvent(kind?: FarmEventKind | null, hasError = false): FarmSoundCue {
  if (hasError) return 'error';
  if (kind === 'plot_tilled') return 'till';
  if (kind === 'crop_planted') return 'seed';
  if (kind === 'crop_watered') return 'water';
  if (kind === 'crop_harvested') return 'harvest';
  if (kind === 'order_completed') return 'order';
  if (kind === 'npc_request_completed') return 'order';
  if (kind === 'rare_event') return 'harvest';
  if (kind === 'building_placed') return 'build';
  if (kind === 'decor_placed') return 'decor';
  if (kind === 'day_advanced') return 'day';
  return 'select';
}

export function farmSoundCueForTool(tool: FarmTool, hasError = false): FarmSoundCue {
  if (hasError) return 'error';
  if (tool === 'hoe') return 'till';
  if (tool === 'seed') return 'seed';
  if (tool === 'water') return 'water';
  if (tool === 'harvest') return 'harvest';
  if (tool === 'build') return 'build';
  if (tool === 'decor') return 'decor';
  if (tool === 'shovel' || tool === 'delete') return 'till';
  return 'select';
}

function scheduleFarmTone(ctx: AudioContext, cue: FarmSoundCue) {
  const profile = FARM_SOUND_PROFILES[cue] || FARM_SOUND_PROFILES.select;
  const master = ctx.createGain();
  const start = ctx.currentTime + 0.006;
  const totalDuration = profile.duration + profile.step * Math.max(0, profile.notes.length - 1);
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(Math.max(0.0001, profile.peak), start + 0.018);
  master.gain.exponentialRampToValueAtTime(0.0001, start + totalDuration + 0.06);
  master.connect(ctx.destination);

  profile.notes.forEach((freq, index) => {
    const noteStart = start + index * profile.step;
    const noteEnd = noteStart + profile.duration;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = profile.wave;
    oscillator.frequency.setValueAtTime(freq, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.04);
  });

  window.setTimeout(() => {
    try {
      master.disconnect();
    } catch {
      // The short synthetic sound is best-effort only.
    }
  }, Math.ceil((totalDuration + 0.18) * 1000));
}

export function playFarmActionSound(cue: FarmSoundCue, options: { enabled?: boolean } = {}) {
  if (options.enabled === false) return;
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastFarmSoundAt < 55) return;
  lastFarmSoundAt = now;
  const ctx = getFarmAudioContext();
  if (!ctx) return;
  const play = () => scheduleFarmTone(ctx, cue);
  if (ctx.state === 'suspended') {
    void ctx.resume().then(play).catch(() => undefined);
    return;
  }
  play();
}

export const TETRIS_WIDTH = 10;
export const TETRIS_HEIGHT = 20;
export const TETRIS_BASE_FALL_INTERVAL_MS = 880;
export const TETRIS_MAX_SPEED_MULTIPLIER = 2;
export const TETRIS_MAX_POWER_COST_MULTIPLIER = 1.5;
export const TETRIS_FINAL_CLEAR_LINES = 990;
export const TETRIS_PIECES = [
  'I',
  'O',
  'T',
  'S',
  'Z',
  'J',
  'L',
  'DOT',
  'DOMINO',
  'TRIO',
  'BAR4',
  'CORNER',
  'PLUS',
  'STAIR',
  'HOOK',
] as const;

export type TetrisPieceType = typeof TETRIS_PIECES[number];
export type TetrisRotation = 0 | 1 | 2 | 3;
export type TetrisStatus = 'playing' | 'paused' | 'game-over' | 'victory';

export interface TetrisCell {
  type: TetrisPieceType;
  locked?: boolean;
  active?: boolean;
  ghost?: boolean;
  modifier?: TetrisCellModifier;
  hazard?: boolean;
}

export type TetrisBoard = Array<Array<TetrisCell | null>>;
export type TetrisCellModifier =
  | 'energy'
  | 'order'
  | 'combo'
  | 'cracked'
  | 'pulse'
  | 'gold'
  | 'side'
  | 'preview'
  | 'timer'
  | 'neon'
  | 'furnace'
  | 'dual'
  | 'beat'
  | 'lightning'
  | 'storm'
  | 'mist'
  | 'speed'
  | 'master'
  | 'finale';
export type TetrisPowerId = 'slow' | 'clear-bottom' | 'reroll' | 'shield';
export type TetrisHazardId =
  | 'classic'
  | 'energy'
  | 'order'
  | 'combo'
  | 'cracked-row'
  | 'gravity-pulse'
  | 'gold-cell'
  | 'side-wall'
  | 'preview-compress'
  | 'timer-order'
  | 'neon-noise'
  | 'furnace-row'
  | 'dual-mission'
  | 'beat-drop'
  | 'lightning-cell'
  | 'energy-storm'
  | 'danger-mist'
  | 'full-speed'
  | 'master-trial'
  | 'finale';

export type TetrisMissionKind =
  | 'lines'
  | 'energy'
  | 'order'
  | 'combo'
  | 'crack'
  | 'pulse-clear'
  | 'gold'
  | 'survival'
  | 'preview-compress'
  | 'timed-order'
  | 'tetris'
  | 'furnace'
  | 'dual'
  | 'beat'
  | 'lightning'
  | 'energy-storm'
  | 'danger'
  | 'power'
  | 'master'
  | 'finale';

export type TetrisStageEffectId =
  | 'classic-stack'
  | 'energy-surge'
  | 'order-target'
  | 'combo-reactor'
  | 'fault-sparks'
  | 'gravity-pulse'
  | 'gold-fever'
  | 'side-gate'
  | 'preview-glitch'
  | 'rush-clock'
  | 'neon-static'
  | 'furnace-floor'
  | 'dual-track'
  | 'beat-drop'
  | 'lightning-reactor'
  | 'energy-storm'
  | 'danger-mist'
  | 'full-speed'
  | 'master-trial'
  | 'finale-rainbow';

export type TetrisFeedbackType =
  | 'drop'
  | 'hard-drop'
  | 'line-clear'
  | 'tetris'
  | 'combo'
  | 'mission'
  | 'power'
  | 'hazard'
  | 'shield'
  | 'victory';

export type TetrisFeedbackIntensity = 'soft' | 'bright' | 'epic' | 'legendary';

export interface TetrisStageEffect {
  id: TetrisStageEffectId;
  label: string;
  cue: string;
  cellModifier?: TetrisCellModifier;
}

export interface TetrisFeedbackEvent {
  id: number;
  type: TetrisFeedbackType;
  label: string;
  intensity: TetrisFeedbackIntensity;
  lines?: number;
  combo?: number;
  power?: TetrisPowerId;
  chapterId: string;
  effectId: TetrisStageEffectId;
}

export interface TetrisChapter {
  id: string;
  name: string;
  levelStart: number;
  levelEnd: number;
  modifier: TetrisHazardId;
  missionKind: TetrisMissionKind;
  missionLabel: string;
  missionTarget: number;
  rewardEnergy: number;
  speedMultiplier?: number;
  unlockPower?: TetrisPowerId;
  hazards: TetrisHazardId[];
  effect: TetrisStageEffect;
}

export interface TetrisMission {
  id: string;
  chapterId: string;
  kind: TetrisMissionKind;
  label: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  rewardClaimed: boolean;
}

export interface TetrisPowerEffects {
  slowTicks: number;
  shieldCharges: number;
  rerollsUsedInChapter: number;
  clearBottomUsedInChapter: number;
}

export interface TetrisActivePiece {
  type: TetrisPieceType;
  x: number;
  y: number;
  rotation: TetrisRotation;
}

export interface TetrisClearResult {
  id: number;
  lines: number;
  score: number;
  tetris: boolean;
}

export interface TetrisGameState {
  board: TetrisBoard;
  active: TetrisActivePiece;
  next: TetrisPieceType[];
  queue: TetrisPieceType[];
  held: TetrisPieceType | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  status: TetrisStatus;
  seed: number;
  startedAt: number;
  lastClear: TetrisClearResult;
  eventSeq: number;
  chapter: TetrisChapter;
  mission: TetrisMission;
  energy: number;
  combo: number;
  activeHazards: TetrisHazardId[];
  unlockedPowers: TetrisPowerId[];
  powerEffects: TetrisPowerEffects;
  lastFeedback: TetrisFeedbackEvent | null;
}

export interface TetrisCheckpoint {
  level: number;
  lines: number;
  score: number;
  savedAt: number;
  state: TetrisGameState;
}

export type TetrisAction =
  | { type: 'move'; dx?: number; dy?: number }
  | { type: 'rotate'; direction?: 'clockwise' | 'counterclockwise' }
  | { type: 'softDrop' }
  | { type: 'hardDrop' }
  | { type: 'tick' }
  | { type: 'hold' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart'; seed?: number; queue?: TetrisPieceType[] }
  | { type: 'usePower'; power: TetrisPowerId }
  | { type: 'claimMissionReward' }
  | { type: 'applyCanvasEnergyBonus'; amount?: number };

interface CreateTetrisGameOptions {
  seed?: number;
  queue?: TetrisPieceType[];
  level?: number;
  lines?: number;
}

export const TETRIS_CHECKPOINT_STEP = 5;

type Coord = readonly [number, number];

function normalizeShape(cells: Coord[]): Coord[] {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY] as const)
    .sort(([ax, ay], [bx, by]) => (ay === by ? ax - bx : ay - by));
}

function shapeKey(cells: Coord[]) {
  return normalizeShape(cells).map(([x, y]) => `${x},${y}`).join('|');
}

function rotateShapeClockwise(cells: Coord[]): Coord[] {
  return normalizeShape(cells.map(([x, y]) => [y, -x] as const));
}

function sketchShape(...cells: Coord[]): Coord[][] {
  const rotations: Coord[][] = [normalizeShape(cells)];
  while (rotations.length < 4) {
    const next = rotateShapeClockwise(rotations[rotations.length - 1]);
    const duplicateIndex = rotations.findIndex((rotation) => shapeKey(rotation) === shapeKey(next));
    rotations.push(duplicateIndex >= 0 ? rotations[duplicateIndex] : next);
  }
  return rotations;
}

const SHAPES: Record<TetrisPieceType, Coord[][]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  DOT: sketchShape([0, 0]),
  DOMINO: sketchShape([0, 0], [0, 1]),
  TRIO: sketchShape([0, 0], [0, 1], [0, 2]),
  BAR4: sketchShape([0, 0], [0, 1], [0, 2], [0, 3]),
  CORNER: sketchShape([0, 0], [1, 0], [1, 1]),
  PLUS: sketchShape([1, 0], [0, 1], [1, 1], [2, 1], [1, 2]),
  STAIR: sketchShape([0, 0], [1, 0], [1, 1], [2, 1], [2, 2]),
  HOOK: sketchShape([0, 0], [0, 1], [1, 1], [2, 1], [2, 2]),
};

const SCORE_BY_LINES: Record<number, number> = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

export const TETRIS_POWERS: Record<TetrisPowerId, { id: TetrisPowerId; label: string; shortLabel: string; cost: number }> = {
  slow: { id: 'slow', label: '慢动作', shortLabel: 'SLOW', cost: 60 },
  'clear-bottom': { id: 'clear-bottom', label: '清底行', shortLabel: 'CLEAR', cost: 90 },
  reroll: { id: 'reroll', label: '重铸块', shortLabel: 'ROLL', cost: 45 },
  shield: { id: 'shield', label: '随机清障', shortLabel: 'GUARD', cost: 70 },
};

const TETRIS_GUARD_MIN_CLEAR = 5;
const TETRIS_GUARD_MAX_CLEAR = 10;

const TETRIS_STAGE_EFFECTS: Record<TetrisStageEffectId, TetrisStageEffect> = {
  'classic-stack': { id: 'classic-stack', label: 'CLASSIC', cue: '基础热身，熟悉落块节奏' },
  'energy-surge': { id: 'energy-surge', label: 'ENERGY', cue: '能量块登场，清掉会爆发 POWER', cellModifier: 'energy' },
  'order-target': { id: 'order-target', label: 'ORDER', cue: '订单靶标出现，按任务消行拿奖励', cellModifier: 'order' },
  'combo-reactor': { id: 'combo-reactor', label: 'COMBO', cue: '连击反应堆启动，断连会施压', cellModifier: 'combo' },
  'fault-sparks': { id: 'fault-sparks', label: 'FAULT', cue: '裂纹故障周期生成，清掉它们', cellModifier: 'cracked' },
  'gravity-pulse': { id: 'gravity-pulse', label: 'PULSE', cue: '重力脉冲会压实棋盘', cellModifier: 'pulse' },
  'gold-fever': { id: 'gold-fever', label: 'GOLD', cue: '金色方块高价值，清除爆奖', cellModifier: 'gold' },
  'side-gate': { id: 'side-gate', label: 'GATE', cue: '侧墙机关推进，别让边线封死', cellModifier: 'side' },
  'preview-glitch': { id: 'preview-glitch', label: 'GLITCH', cue: '预告压缩干扰 NEXT，靠判断续命', cellModifier: 'preview' },
  'rush-clock': { id: 'rush-clock', label: 'RUSH', cue: '快速订单倒计时，超时就塞块', cellModifier: 'timer' },
  'neon-static': { id: 'neon-static', label: 'NEON', cue: '霓虹噪声闪烁，四消清屏干扰', cellModifier: 'neon' },
  'furnace-floor': { id: 'furnace-floor', label: 'FURNACE', cue: '底层熔炉升温，拖久会变硬', cellModifier: 'furnace' },
  'dual-track': { id: 'dual-track', label: 'DUAL', cue: '双轨任务并行，消行和连击都要抓', cellModifier: 'dual' },
  'beat-drop': { id: 'beat-drop', label: 'BEAT', cue: '节拍下落窗口，硬降打出 PERFECT', cellModifier: 'beat' },
  'lightning-reactor': { id: 'lightning-reactor', label: 'FLASH', cue: '闪电反应块，硬降触发连锁', cellModifier: 'lightning' },
  'energy-storm': { id: 'energy-storm', label: 'STORM', cue: '能量风暴抽走 POWER，护盾可挡', cellModifier: 'storm' },
  'danger-mist': { id: 'danger-mist', label: 'MIST', cue: '终局迷雾压线，清行驱散危险', cellModifier: 'mist' },
  'full-speed': { id: 'full-speed', label: 'SPEED', cue: '全速工厂启动，技能延长生存窗口', cellModifier: 'speed' },
  'master-trial': { id: 'master-trial', label: 'MASTER', cue: '大师试炼混合订单、连击和技能', cellModifier: 'master' },
  'finale-rainbow': { id: 'finale-rainbow', label: 'FINALE', cue: '彩蛋终章全机制爆发', cellModifier: 'finale' },
};

export const TETRIS_CHAPTERS: TetrisChapter[] = [
  { id: 'classic-warmup', name: '经典热身', levelStart: 1, levelEnd: 5, modifier: 'classic', missionKind: 'lines', missionLabel: '完成 3 次消行', missionTarget: 3, rewardEnergy: 25, hazards: ['classic'], effect: TETRIS_STAGE_EFFECTS['classic-stack'] },
  { id: 'energy-workshop', name: '能量工坊', levelStart: 6, levelEnd: 10, modifier: 'energy', missionKind: 'energy', missionLabel: '积累 100 能量', missionTarget: 100, rewardEnergy: 40, unlockPower: 'slow', hazards: ['energy'], effect: TETRIS_STAGE_EFFECTS['energy-surge'] },
  { id: 'order-board', name: '订单任务', levelStart: 11, levelEnd: 15, modifier: 'order', missionKind: 'order', missionLabel: '完成章节订单', missionTarget: 6, rewardEnergy: 45, hazards: ['order'], effect: TETRIS_STAGE_EFFECTS['order-target'] },
  { id: 'combo-factory', name: '连击工厂', levelStart: 16, levelEnd: 20, modifier: 'combo', missionKind: 'combo', missionLabel: '达成 Combo x2', missionTarget: 2, rewardEnergy: 55, hazards: ['combo'], effect: TETRIS_STAGE_EFFECTS['combo-reactor'] },
  { id: 'fault-scan', name: '故障扫描', levelStart: 21, levelEnd: 25, modifier: 'cracked-row', missionKind: 'crack', missionLabel: '清理 2 组裂纹块', missionTarget: 2, rewardEnergy: 65, unlockPower: 'clear-bottom', hazards: ['cracked-row'], effect: TETRIS_STAGE_EFFECTS['fault-sparks'] },
  { id: 'gravity-pulse', name: '重力脉冲', levelStart: 26, levelEnd: 30, modifier: 'gravity-pulse', missionKind: 'pulse-clear', missionLabel: '脉冲期间消行', missionTarget: 4, rewardEnergy: 60, speedMultiplier: 0.9, hazards: ['gravity-pulse'], effect: TETRIS_STAGE_EFFECTS['gravity-pulse'] },
  { id: 'gold-blocks', name: '金色方块', levelStart: 31, levelEnd: 35, modifier: 'gold-cell', missionKind: 'gold', missionLabel: '清除 3 个金色格', missionTarget: 3, rewardEnergy: 70, unlockPower: 'reroll', hazards: ['gold-cell'], effect: TETRIS_STAGE_EFFECTS['gold-fever'] },
  { id: 'side-gates', name: '侧墙机关', levelStart: 36, levelEnd: 40, modifier: 'side-wall', missionKind: 'survival', missionLabel: '避开警戒线消行', missionTarget: 4, rewardEnergy: 70, hazards: ['side-wall'], effect: TETRIS_STAGE_EFFECTS['side-gate'] },
  { id: 'preview-compress', name: '预告压缩', levelStart: 41, levelEnd: 45, modifier: 'preview-compress', missionKind: 'preview-compress', missionLabel: '压缩预览完成 4 行', missionTarget: 4, rewardEnergy: 70, hazards: ['preview-compress'], effect: TETRIS_STAGE_EFFECTS['preview-glitch'] },
  { id: 'rapid-orders', name: '快速订单', levelStart: 46, levelEnd: 50, modifier: 'timer-order', missionKind: 'timed-order', missionLabel: '限时完成章节订单', missionTarget: 8, rewardEnergy: 85, speedMultiplier: 0.86, hazards: ['timer-order'], effect: TETRIS_STAGE_EFFECTS['rush-clock'] },
  { id: 'neon-noise', name: '霓虹干扰', levelStart: 51, levelEnd: 55, modifier: 'neon-noise', missionKind: 'tetris', missionLabel: '干扰中完成四消', missionTarget: 1, rewardEnergy: 95, hazards: ['neon-noise'], effect: TETRIS_STAGE_EFFECTS['neon-static'] },
  { id: 'furnace-floor', name: '底层熔炉', levelStart: 56, levelEnd: 60, modifier: 'furnace-row', missionKind: 'furnace', missionLabel: '清掉 3 次熔炉行', missionTarget: 3, rewardEnergy: 90, hazards: ['furnace-row'], effect: TETRIS_STAGE_EFFECTS['furnace-floor'] },
  { id: 'dual-mission', name: '双任务', levelStart: 61, levelEnd: 65, modifier: 'dual-mission', missionKind: 'dual', missionLabel: '完成主任务', missionTarget: 8, rewardEnergy: 90, hazards: ['dual-mission'], effect: TETRIS_STAGE_EFFECTS['dual-track'] },
  { id: 'beat-drop', name: '节拍下落', levelStart: 66, levelEnd: 70, modifier: 'beat-drop', missionKind: 'beat', missionLabel: '适应节拍完成 5 行', missionTarget: 5, rewardEnergy: 95, speedMultiplier: 0.84, hazards: ['beat-drop'], effect: TETRIS_STAGE_EFFECTS['beat-drop'] },
  { id: 'lightning-reaction', name: '反应挑战', levelStart: 71, levelEnd: 75, modifier: 'lightning-cell', missionKind: 'lightning', missionLabel: '硬降锁定闪电块', missionTarget: 3, rewardEnergy: 110, hazards: ['lightning-cell'], effect: TETRIS_STAGE_EFFECTS['lightning-reactor'] },
  { id: 'energy-storm', name: '能量风暴', levelStart: 76, levelEnd: 80, modifier: 'energy-storm', missionKind: 'energy-storm', missionLabel: '保持能量完成章节', missionTarget: 8, rewardEnergy: 110, unlockPower: 'shield', hazards: ['energy-storm'], effect: TETRIS_STAGE_EFFECTS['energy-storm'] },
  { id: 'endgame-mist', name: '终局迷雾', levelStart: 81, levelEnd: 85, modifier: 'danger-mist', missionKind: 'danger', missionLabel: '不进危险线完成消行', missionTarget: 8, rewardEnergy: 115, hazards: ['danger-mist'], effect: TETRIS_STAGE_EFFECTS['danger-mist'] },
  { id: 'full-speed', name: '全速工厂', levelStart: 86, levelEnd: 90, modifier: 'full-speed', missionKind: 'power', missionLabel: '用技能辅助完成 8 行', missionTarget: 8, rewardEnergy: 130, speedMultiplier: 0.72, hazards: ['full-speed'], effect: TETRIS_STAGE_EFFECTS['full-speed'] },
  { id: 'master-trial', name: '大师试炼', levelStart: 91, levelEnd: 95, modifier: 'master-trial', missionKind: 'master', missionLabel: '完成大师订单', missionTarget: 10, rewardEnergy: 140, speedMultiplier: 0.68, hazards: ['master-trial', 'combo', 'order'], effect: TETRIS_STAGE_EFFECTS['master-trial'] },
  { id: 'finale', name: '彩蛋终章', levelStart: 96, levelEnd: 99, modifier: 'finale', missionKind: 'finale', missionLabel: '完成终章任务', missionTarget: 12, rewardEnergy: 180, speedMultiplier: 0.62, hazards: ['finale', 'energy-storm', 'lightning-cell'], effect: TETRIS_STAGE_EFFECTS['finale-rainbow'] },
];

const TETRIS_CELL_MODIFIERS: TetrisCellModifier[] = [
  'energy',
  'order',
  'combo',
  'cracked',
  'pulse',
  'gold',
  'side',
  'preview',
  'timer',
  'neon',
  'furnace',
  'dual',
  'beat',
  'lightning',
  'storm',
  'mist',
  'speed',
  'master',
  'finale',
];

const TETRIS_FEEDBACK_TYPES: TetrisFeedbackType[] = ['drop', 'hard-drop', 'line-clear', 'tetris', 'combo', 'mission', 'power', 'hazard', 'shield', 'victory'];
const TETRIS_FEEDBACK_INTENSITIES: TetrisFeedbackIntensity[] = ['soft', 'bright', 'epic', 'legendary'];

type TetrisModifierCounts = Record<TetrisCellModifier, number>;

const TETRIS_MODIFIER_ENERGY: Record<TetrisCellModifier, number> = {
  energy: 18,
  order: 10,
  combo: 12,
  cracked: 8,
  pulse: 12,
  gold: 22,
  side: 8,
  preview: 10,
  timer: 12,
  neon: 14,
  furnace: 8,
  dual: 12,
  beat: 14,
  lightning: 12,
  storm: 16,
  mist: 12,
  speed: 10,
  master: 18,
  finale: 24,
};

interface TetrisClearDetails {
  board: TetrisBoard;
  cleared: number;
  modifiers: TetrisModifierCounts;
}

interface TetrisMissionEvent {
  lines?: number;
  tetris?: boolean;
  combo?: number;
  energy?: number;
  modifiers?: Partial<TetrisModifierCounts>;
  power?: TetrisPowerId;
  hardDrop?: boolean;
}

function normalizeSeed(seed?: number) {
  const raw = Math.floor(Number(seed));
  if (Number.isFinite(raw) && raw !== 0) return raw >>> 0;
  return (Date.now() ^ 0x9e3779b9) >>> 0;
}

function normalizeLevel(level: unknown, fallback = 1) {
  const raw = Math.floor(Number(level));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(99, raw));
}

function normalizeNonNegativeInt(value: unknown, fallback = 0) {
  const raw = Math.floor(Number(value));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, raw);
}

function clampEnergy(value: unknown) {
  const raw = Math.floor(Number(value));
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(999, raw));
}

function createModifierCounts(): TetrisModifierCounts {
  return Object.fromEntries(TETRIS_CELL_MODIFIERS.map((modifier) => [modifier, 0])) as TetrisModifierCounts;
}

export function getTetrisChapter(level: number): TetrisChapter {
  const normalized = normalizeLevel(level);
  return TETRIS_CHAPTERS.find((chapter) =>
    normalized >= chapter.levelStart && normalized <= chapter.levelEnd,
  ) || TETRIS_CHAPTERS[TETRIS_CHAPTERS.length - 1];
}

function createTetrisMission(chapter: TetrisChapter): TetrisMission {
  return {
    id: `${chapter.id}-mission`,
    chapterId: chapter.id,
    kind: chapter.missionKind,
    label: chapter.missionLabel,
    description: `${chapter.name}：${chapter.missionLabel}`,
    progress: 0,
    target: chapter.missionTarget,
    completed: false,
    rewardClaimed: false,
  };
}

function normalizeTetrisMission(value: unknown, chapter: TetrisChapter): TetrisMission {
  if (!value || typeof value !== 'object') return createTetrisMission(chapter);
  const raw = value as Partial<TetrisMission>;
  if (raw.chapterId !== chapter.id || raw.kind !== chapter.missionKind) {
    return createTetrisMission(chapter);
  }
  const target = Math.max(1, normalizeNonNegativeInt(raw.target, chapter.missionTarget) || chapter.missionTarget);
  const progress = Math.min(target, normalizeNonNegativeInt(raw.progress));
  const completed = Boolean(raw.completed) || progress >= target;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${chapter.id}-mission`,
    chapterId: chapter.id,
    kind: chapter.missionKind,
    label: typeof raw.label === 'string' && raw.label ? raw.label : chapter.missionLabel,
    description: typeof raw.description === 'string' && raw.description ? raw.description : `${chapter.name}：${chapter.missionLabel}`,
    progress,
    target,
    completed,
    rewardClaimed: Boolean(raw.rewardClaimed),
  };
}

function normalizePowerEffects(value?: Partial<TetrisPowerEffects>): TetrisPowerEffects {
  return {
    slowTicks: normalizeNonNegativeInt(value?.slowTicks),
    shieldCharges: normalizeNonNegativeInt(value?.shieldCharges),
    rerollsUsedInChapter: normalizeNonNegativeInt(value?.rerollsUsedInChapter),
    clearBottomUsedInChapter: normalizeNonNegativeInt(value?.clearBottomUsedInChapter),
  };
}

function normalizeTetrisFeedback(value: unknown, chapter: TetrisChapter): TetrisFeedbackEvent | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<TetrisFeedbackEvent>;
  if (!TETRIS_FEEDBACK_TYPES.includes(raw.type as TetrisFeedbackType)) return null;
  const power = raw.power && Object.prototype.hasOwnProperty.call(TETRIS_POWERS, raw.power)
    ? raw.power
    : undefined;
  return {
    id: Math.max(0, Math.floor(Number(raw.id) || 0)),
    type: raw.type as TetrisFeedbackType,
    label: typeof raw.label === 'string' && raw.label ? raw.label.slice(0, 32) : chapter.effect.label,
    intensity: TETRIS_FEEDBACK_INTENSITIES.includes(raw.intensity as TetrisFeedbackIntensity)
      ? raw.intensity as TetrisFeedbackIntensity
      : 'soft',
    lines: raw.lines === undefined ? undefined : normalizeNonNegativeInt(raw.lines),
    combo: raw.combo === undefined ? undefined : normalizeNonNegativeInt(raw.combo),
    power,
    chapterId: chapter.id,
    effectId: chapter.effect.id,
  };
}

function getTetrisUnlockedPowers(_level: number): TetrisPowerId[] {
  return Object.keys(TETRIS_POWERS) as TetrisPowerId[];
}

function nextFeedbackId(state: Pick<TetrisGameState, 'eventSeq' | 'lastFeedback'>, fallback = state.eventSeq + 1) {
  return Math.max(fallback, (state.lastFeedback?.id || 0) + 1);
}

function createTetrisFeedback(
  state: Pick<TetrisGameState, 'chapter' | 'eventSeq' | 'lastFeedback'>,
  type: TetrisFeedbackType,
  options: Partial<Pick<TetrisFeedbackEvent, 'lines' | 'combo' | 'power' | 'label' | 'intensity'>> = {},
  id = nextFeedbackId(state),
): TetrisFeedbackEvent {
  const lines = normalizeNonNegativeInt(options.lines);
  const combo = normalizeNonNegativeInt(options.combo);
  const power = options.power;
  const intensity = options.intensity
    || (type === 'tetris' || type === 'victory' ? 'legendary'
      : type === 'combo' || type === 'power' ? 'epic'
        : type === 'line-clear' || type === 'hazard' ? 'bright'
          : 'soft');
  const label = options.label
    || (type === 'victory' ? 'ALL CLEAR'
      : type === 'tetris' ? 'TETRIS!'
      : type === 'combo' ? `COMBO x${Math.max(2, combo)}`
        : type === 'line-clear' ? `CLEAR ${Math.max(1, lines)}`
          : type === 'hard-drop' ? 'HARD DROP'
            : type === 'power' && power ? `${TETRIS_POWERS[power].label} READY`
              : type === 'hazard' ? state.chapter.effect.label
                : type === 'shield' ? 'GUARD BLOCK'
                  : 'DROP');
  return {
    id,
    type,
    label,
    intensity,
    lines: lines || undefined,
    combo: combo || undefined,
    power,
    chapterId: state.chapter.id,
    effectId: state.chapter.effect.id,
  };
}

function withVictoryState(state: TetrisGameState): TetrisGameState {
  if (state.status === 'game-over') return state;
  if (state.chapter.id !== 'finale' || !state.mission.completed) return state;
  if (normalizeNonNegativeInt(state.lines) < TETRIS_FINAL_CLEAR_LINES) return state;
  if (state.status === 'victory' && state.lastFeedback?.type === 'victory') return state;
  const victoryState = { ...state, status: 'victory' as const };
  return {
    ...victoryState,
    lastFeedback: createTetrisFeedback(
      victoryState,
      'victory',
      { label: 'ALL CLEAR', intensity: 'legendary' },
      nextFeedbackId(victoryState, victoryState.eventSeq + 1),
    ),
  };
}

function withChapterState(state: TetrisGameState): TetrisGameState {
  const level = normalizeLevel(state.level);
  const chapter = getTetrisChapter(level);
  const chapterChanged = state.chapter?.id !== chapter.id;
  const powerEffects = normalizePowerEffects(state.powerEffects);
  if (chapterChanged) {
    powerEffects.rerollsUsedInChapter = 0;
    powerEffects.clearBottomUsedInChapter = 0;
  }
  return withVictoryState({
    ...state,
    level,
    chapter,
    mission: normalizeTetrisMission(state.mission, chapter),
    energy: clampEnergy(state.energy),
    combo: normalizeNonNegativeInt(state.combo),
    activeHazards: [...chapter.hazards],
    unlockedPowers: getTetrisUnlockedPowers(level),
    powerEffects,
  });
}

export function getTetrisPowerCostMultiplier(level: number): number {
  const normalized = normalizeLevel(level);
  if (normalized <= 5) return 1;
  if (normalized >= 95) return TETRIS_MAX_POWER_COST_MULTIPLIER;
  const step = Math.ceil((normalized - 5) / 5);
  const multiplier = 1 + ((TETRIS_MAX_POWER_COST_MULTIPLIER - 1) * step) / 19;
  return Math.min(TETRIS_MAX_POWER_COST_MULTIPLIER, multiplier);
}

export function getTetrisPowerCost(power: TetrisPowerId, level: number): number {
  const baseCost = TETRIS_POWERS[power]?.cost || 0;
  return Math.max(baseCost, Math.round(baseCost * getTetrisPowerCostMultiplier(level)));
}

export function canUseTetrisPower(state: TetrisGameState, power: TetrisPowerId): boolean {
  return state.status === 'playing'
    && state.unlockedPowers.includes(power)
    && clampEnergy(state.energy) >= getTetrisPowerCost(power, state.level);
}

function nextSeed(seed: number) {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = nextSeed(state);
    return state / 0x100000000;
  };
}

function emptyRow() {
  return Array.from({ length: TETRIS_WIDTH }, () => null) as Array<TetrisCell | null>;
}

function createEmptyBoard(): TetrisBoard {
  return Array.from({ length: TETRIS_HEIGHT }, emptyRow);
}

function cloneBoard(board: TetrisBoard): TetrisBoard {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function clearRandomHazardCells(board: TetrisBoard, seed: number) {
  const nextBoard = cloneBoard(board);
  const hazardCells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < TETRIS_HEIGHT; y += 1) {
    for (let x = 0; x < TETRIS_WIDTH; x += 1) {
      if (nextBoard[y][x]?.hazard) hazardCells.push({ x, y });
    }
  }
  if (!hazardCells.length) return { board: nextBoard, cleared: 0 };

  const random = seededRandom(seed);
  for (let index = hazardCells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [hazardCells[index], hazardCells[swapIndex]] = [hazardCells[swapIndex], hazardCells[index]];
  }
  const clearCount = Math.min(
    hazardCells.length,
    TETRIS_GUARD_MIN_CLEAR + Math.floor(random() * (TETRIS_GUARD_MAX_CLEAR - TETRIS_GUARD_MIN_CLEAR + 1)),
  );
  for (const { x, y } of hazardCells.slice(0, clearCount)) {
    nextBoard[y][x] = null;
  }
  return { board: nextBoard, cleared: clearCount };
}

function rowFillCount(board: TetrisBoard, row: number) {
  if (row < 0 || row >= TETRIS_HEIGHT) return TETRIS_WIDTH;
  return board[row].filter(Boolean).length;
}

function orderedHazardColumns(preferredX: number) {
  const columns: number[] = [];
  for (let offset = 0; offset < TETRIS_WIDTH; offset += 1) {
    const left = preferredX - offset;
    const right = preferredX + offset;
    if (left >= 0 && left < TETRIS_WIDTH && !columns.includes(left)) columns.push(left);
    if (right >= 0 && right < TETRIS_WIDTH && !columns.includes(right)) columns.push(right);
  }
  return columns;
}

function findSafeHazardTarget(board: TetrisBoard, preferredRow: number, preferredX: number) {
  const rowStart = Math.min(TETRIS_HEIGHT - 1, Math.max(0, preferredRow));
  for (let row = rowStart; row >= 0; row -= 1) {
    if (rowFillCount(board, row) >= TETRIS_WIDTH - 1) continue;
    for (const x of orderedHazardColumns(preferredX)) {
      if (!board[row][x]) return { row, x };
    }
  }
  return null;
}

export function makeSevenBag(seedOrRandom: number | (() => number) = Date.now()): TetrisPieceType[] {
  const random = typeof seedOrRandom === 'function'
    ? seedOrRandom
    : seededRandom(normalizeSeed(seedOrRandom));
  const bag = [...TETRIS_PIECES];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function cellsFor(piece: TetrisActivePiece): Coord[] {
  return SHAPES[piece.type][piece.rotation];
}

export function getPiecePreviewCells(type: TetrisPieceType): Coord[] {
  const cells = SHAPES[type][0];
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX + 1;
  const height = Math.max(...ys) - minY + 1;
  const offsetX = Math.floor((4 - width) / 2);
  const offsetY = Math.floor((4 - height) / 2);
  return cells.map(([x, y]) => [x - minX + offsetX, y - minY + offsetY] as const);
}

function spawnPiece(type: TetrisPieceType): TetrisActivePiece {
  return {
    type,
    x: type === 'O' ? 3 : 3,
    y: 0,
    rotation: 0,
  };
}

function pieceCells(piece: TetrisActivePiece): Array<{ x: number; y: number }> {
  return cellsFor(piece).map(([x, y]) => ({ x: piece.x + x, y: piece.y + y }));
}

function isPositionValid(board: TetrisBoard, piece: TetrisActivePiece) {
  return pieceCells(piece).every(({ x, y }) => {
    if (x < 0 || x >= TETRIS_WIDTH || y >= TETRIS_HEIGHT) return false;
    if (y < 0) return true;
    return !board[y][x];
  });
}

function fillQueue(queue: TetrisPieceType[], seed: number, minimum = 7) {
  let nextQueue = [...queue];
  let next = seed >>> 0;
  while (nextQueue.length < minimum) {
    next = nextSeed(next);
    nextQueue = [...nextQueue, ...makeSevenBag(next)];
  }
  return { queue: nextQueue, seed: next };
}

function withNext(state: Omit<TetrisGameState, 'next'>): TetrisGameState {
  return { ...state, next: state.queue.slice(0, 5) };
}

function spawnFromQueue(state: TetrisGameState, board = state.board): TetrisGameState {
  const filled = fillQueue(state.queue, state.seed);
  const type = filled.queue[0] || 'I';
  const active = spawnPiece(type);
  const nextState = withNext({
    ...state,
    board,
    active,
    queue: filled.queue.slice(1),
    seed: filled.seed,
    canHold: true,
    status: state.status === 'victory' ? 'victory' : isPositionValid(board, active) ? 'playing' : 'game-over',
  });
  return nextState;
}

function spawnHeldPiece(state: TetrisGameState, type: TetrisPieceType, held: TetrisPieceType): TetrisGameState {
  const active = spawnPiece(type);
  return withNext({
    ...state,
    active,
    held,
    canHold: false,
    status: isPositionValid(state.board, active) ? state.status : 'game-over',
  });
}

export function createTetrisGame(options: CreateTetrisGameOptions = {}): TetrisGameState {
  const seed = normalizeSeed(options.seed);
  const initialQueue = options.queue?.length ? [...options.queue] : makeSevenBag(seed);
  const filled = fillQueue(initialQueue, seed);
  const activeType = filled.queue[0] || 'I';
  const board = createEmptyBoard();
  const active = spawnPiece(activeType);
  const level = normalizeLevel(options.level);
  const chapter = getTetrisChapter(level);
  const lines = options.lines === undefined
    ? Math.max(0, (level - 1) * 10)
    : normalizeNonNegativeInt(options.lines);
  return withChapterState(withNext({
    board,
    active,
    queue: filled.queue.slice(1),
    held: null,
    canHold: true,
    score: 0,
    lines,
    level,
    status: isPositionValid(board, active) ? 'playing' : 'game-over',
    seed: filled.seed,
    startedAt: Date.now(),
    lastClear: { id: 0, lines: 0, score: 0, tetris: false },
    eventSeq: 0,
    chapter,
    mission: createTetrisMission(chapter),
    energy: 0,
    combo: 0,
    activeHazards: [...chapter.hazards],
    unlockedPowers: getTetrisUnlockedPowers(level),
    powerEffects: normalizePowerEffects(),
    lastFeedback: null,
  }));
}

function clearFullLines(board: TetrisBoard): TetrisClearDetails {
  const remaining: TetrisBoard = [];
  const modifiers = createModifierCounts();
  let cleared = 0;
  for (const row of board) {
    if (!row.every(Boolean)) {
      remaining.push(row);
      continue;
    }
    cleared += 1;
    for (const cell of row) {
      if (cell?.modifier) modifiers[cell.modifier] += 1;
    }
  }
  const newRows = Array.from({ length: cleared }, emptyRow);
  return {
    board: [...newRows, ...remaining],
    cleared,
    modifiers,
  };
}

function assignLockModifier(state: TetrisGameState, index: number, hardDrop = false): TetrisCellModifier | undefined {
  if (index !== 0) return undefined;
  if (state.chapter.modifier === 'lightning-cell' && hardDrop) return 'lightning';
  return state.chapter.effect.cellModifier;
}

function compactBoardByGravity(board: TetrisBoard): TetrisBoard {
  const nextBoard = createEmptyBoard();
  for (let x = 0; x < TETRIS_WIDTH; x += 1) {
    const cells: TetrisCell[] = [];
    for (let y = TETRIS_HEIGHT - 1; y >= 0; y -= 1) {
      const cell = board[y][x];
      if (cell) cells.push({ ...cell });
    }
    for (let index = 0; index < cells.length; index += 1) {
      nextBoard[TETRIS_HEIGHT - 1 - index][x] = cells[index];
    }
  }
  return nextBoard;
}

function addHazardCells(
  state: TetrisGameState,
  board: TetrisBoard,
  eventSeq: number,
  context: { lines: number; combo: number; hardDrop?: boolean },
) {
  const nextBoard = cloneBoard(board);
  let powerEffects = normalizePowerEffects(state.powerEffects);
  let hazardTriggered = false;
  let shieldBlocked = false;
  const consumeShield = () => {
    if (powerEffects.shieldCharges <= 0) return false;
    powerEffects = { ...powerEffects, shieldCharges: powerEffects.shieldCharges - 1 };
    shieldBlocked = true;
    return true;
  };
  const place = (row: number, xs: number[], type: TetrisPieceType, modifier: TetrisCellModifier) => {
    let placed = false;
    for (const x of xs) {
      if (x >= 0 && x < TETRIS_WIDTH) {
        const target = findSafeHazardTarget(nextBoard, row, x);
        if (!target) continue;
        nextBoard[target.row][target.x] = { type, locked: true, modifier, hazard: true };
        placed = true;
      }
    }
    if (placed) hazardTriggered = true;
  };
  const cycle = (base: number, _earlyPressure = 0) => {
    const level = normalizeLevel(state.level);
    if (level > 5) return 2;
    return Math.max(2, base);
  };

  if (state.activeHazards.includes('energy') && eventSeq % cycle(4, 2) === 0) {
    place(TETRIS_HEIGHT - 4, [eventSeq % TETRIS_WIDTH, (eventSeq + 3) % TETRIS_WIDTH, (eventSeq + 6) % TETRIS_WIDTH], 'I', 'energy');
  }
  if (state.activeHazards.includes('order') && eventSeq % cycle(4, 1) === 0) {
    place(TETRIS_HEIGHT - 3, [(eventSeq * 3) % TETRIS_WIDTH, (eventSeq * 3 + 2) % TETRIS_WIDTH], 'O', 'order');
  }
  if (state.activeHazards.includes('combo') && context.lines === 0 && eventSeq % cycle(3, 1) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 1, [2, 6, 8], 'T', 'combo');
  }
  if (state.activeHazards.includes('cracked-row') && eventSeq % cycle(3) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 1, [1, 5, 7, 9], 'Z', 'cracked');
  }
  if (state.activeHazards.includes('gravity-pulse') && eventSeq % cycle(4) === 0) {
    hazardTriggered = true;
    const compacted = compactBoardByGravity(nextBoard);
    for (let y = 0; y < TETRIS_HEIGHT; y += 1) nextBoard[y] = compacted[y];
    place(TETRIS_HEIGHT - 2, [1, 5, 8], 'T', 'pulse');
  }
  if (state.activeHazards.includes('gold-cell') && eventSeq % cycle(3) === 0) {
    place(TETRIS_HEIGHT - 2, [1, 5, 8], 'O', 'gold');
  }
  if (state.activeHazards.includes('furnace-row') && eventSeq % cycle(4) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 1, [1, 5, 7, 9], 'L', 'furnace');
  }
  if (state.activeHazards.includes('side-wall') && eventSeq % cycle(5) === 0) {
    if (!consumeShield()) {
      const row = TETRIS_HEIGHT - 2;
      place(row, [0, TETRIS_WIDTH - 1], 'J', 'side');
    }
  }
  if (state.activeHazards.includes('preview-compress') && eventSeq % cycle(4) === 0) {
    place(TETRIS_HEIGHT - 5, [(eventSeq + 2) % TETRIS_WIDTH, (eventSeq + 5) % TETRIS_WIDTH, (eventSeq + 8) % TETRIS_WIDTH], 'S', 'preview');
  }
  if (state.activeHazards.includes('timer-order') && context.lines === 0 && eventSeq % cycle(4) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 1, [0, 2, 6, 8], 'Z', 'timer');
  }
  if (state.activeHazards.includes('neon-noise') && eventSeq % cycle(3) === 0) {
    place(TETRIS_HEIGHT - 6, [(eventSeq + 1) % TETRIS_WIDTH, (eventSeq + 4) % TETRIS_WIDTH, (eventSeq + 7) % TETRIS_WIDTH], 'T', 'neon');
  }
  if (state.activeHazards.includes('dual-mission') && eventSeq % cycle(5) === 0) {
    place(TETRIS_HEIGHT - 4, [1, 5, 8], 'S', 'dual');
  }
  if (state.activeHazards.includes('beat-drop') && eventSeq % cycle(4) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 1, context.hardDrop ? [0, 2, 6, 8] : [1, 5, 7, 9], 'O', 'beat');
  }
  if (state.activeHazards.includes('lightning-cell') && eventSeq % cycle(3) === 0) {
    place(TETRIS_HEIGHT - 4, [1, 5, 8], 'I', 'lightning');
  }
  if (state.activeHazards.includes('energy-storm') && eventSeq % cycle(6) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 2, [1, 5, 8], 'I', 'storm');
  }
  if (state.activeHazards.includes('danger-mist') && context.lines === 0 && eventSeq % cycle(3) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 8, [1, 5, 8], 'J', 'mist');
  }
  if (state.activeHazards.includes('full-speed') && eventSeq % cycle(3) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 1, [0, 2, 6, 8], 'Z', 'speed');
  }
  if (state.activeHazards.includes('master-trial') && eventSeq % cycle(2) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 2, [1, 5, 8], 'T', 'master');
  }
  if (state.activeHazards.includes('finale') && eventSeq % cycle(3) === 0) {
    if (!consumeShield()) place(TETRIS_HEIGHT - 3, [1, 5, 8], 'L', 'finale');
  }

  return { board: nextBoard, powerEffects, hazardTriggered, shieldBlocked };
}

function applyMissionEvent(state: TetrisGameState, event: TetrisMissionEvent, energyBeforeReward: number) {
  const mission = { ...state.mission };
  const lines = normalizeNonNegativeInt(event.lines);
  const combo = normalizeNonNegativeInt(event.combo);
  const modifiers = { ...createModifierCounts(), ...(event.modifiers || {}) };
  let progress = mission.progress;

  switch (mission.kind) {
    case 'energy':
      progress = Math.max(progress, energyBeforeReward);
      break;
    case 'combo':
      progress = Math.max(progress, combo);
      break;
    case 'crack':
      progress += modifiers.cracked || (lines > 0 ? 1 : 0);
      break;
    case 'gold':
      progress += modifiers.gold || (lines >= 2 ? 1 : 0);
      break;
    case 'tetris':
      progress += event.tetris ? 1 : 0;
      break;
    case 'furnace':
      progress += modifiers.furnace || (lines > 0 ? 1 : 0);
      break;
    case 'lightning':
      progress += modifiers.lightning || (event.hardDrop && lines > 0 ? 1 : 0);
      break;
    case 'power':
      progress += event.power ? 2 : lines;
      break;
    case 'dual':
      progress += lines + (combo >= 2 ? 1 : 0);
      break;
    case 'master':
      progress += lines + (event.tetris ? 2 : 0) + (event.power ? 1 : 0);
      break;
    case 'finale':
      progress += lines + (event.tetris ? 2 : 0) + (event.power ? 2 : 0) + Math.min(2, combo);
      break;
    case 'order':
    case 'timed-order':
      progress += lines > 0 ? 1 : 0;
      break;
    case 'lines':
    case 'pulse-clear':
    case 'survival':
    case 'preview-compress':
    case 'beat':
    case 'energy-storm':
    case 'danger':
    default:
      progress += lines;
      break;
  }

  mission.progress = Math.min(mission.target, Math.max(0, progress));
  mission.completed = mission.progress >= mission.target;
  let energy = energyBeforeReward;
  if (mission.completed && !mission.rewardClaimed) {
    mission.rewardClaimed = true;
    energy += state.chapter.rewardEnergy;
  }
  return { mission, energy: clampEnergy(energy) };
}

function lockActivePiece(state: TetrisGameState, options: { hardDrop?: boolean } = {}): TetrisGameState {
  const board = cloneBoard(state.board);
  const cells = pieceCells(state.active);
  for (let index = 0; index < cells.length; index += 1) {
    const { x, y } = cells[index];
    if (y < 0) return { ...state, status: 'game-over' };
    board[y][x] = {
      type: state.active.type,
      locked: true,
      modifier: assignLockModifier(state, index, options.hardDrop),
    };
  }
  const clear = clearFullLines(board);
  const clearScore = (SCORE_BY_LINES[clear.cleared] || 0) * state.level;
  const lines = state.lines + clear.cleared;
  const level = Math.min(99, Math.floor(lines / 10) + 1);
  const combo = clear.cleared > 0 ? state.combo + 1 : 0;
  const lineEnergy = clear.cleared * 14 + (clear.cleared === 4 ? 24 : 0);
  const modifierEnergy = TETRIS_CELL_MODIFIERS.reduce((total, modifier) =>
    total + clear.modifiers[modifier] * TETRIS_MODIFIER_ENERGY[modifier],
  0);
  const comboEnergy = combo > 1 ? Math.min(32, combo * 4) : 0;
  const hardDropEnergy = options.hardDrop ? 3 : 0;
  const stormPenalty = state.activeHazards.includes('energy-storm') && clear.cleared === 0 ? 4 : 0;
  const energyBeforeMission = clampEnergy(state.energy + lineEnergy + modifierEnergy + comboEnergy + hardDropEnergy - stormPenalty);
  const eventSeq = state.eventSeq + 1;
  const missionResult = applyMissionEvent(state, {
    lines: clear.cleared,
    tetris: clear.cleared === 4,
    combo,
    energy: energyBeforeMission - state.energy,
    modifiers: clear.modifiers,
    hardDrop: options.hardDrop,
  }, energyBeforeMission);
  const hazard = addHazardCells(state, clear.board, eventSeq, { lines: clear.cleared, combo, hardDrop: options.hardDrop });
  const feedback = clear.cleared === 4
    ? createTetrisFeedback(state, 'tetris', { lines: clear.cleared, combo, intensity: 'legendary' }, eventSeq)
    : combo >= 2 && clear.cleared > 0
      ? createTetrisFeedback(state, 'combo', { lines: clear.cleared, combo, intensity: combo >= 4 ? 'legendary' : 'epic' }, eventSeq)
      : clear.cleared > 0
        ? createTetrisFeedback(state, 'line-clear', { lines: clear.cleared, intensity: clear.cleared >= 3 ? 'epic' : 'bright' }, eventSeq)
        : hazard.shieldBlocked
          ? createTetrisFeedback(state, 'shield', { intensity: 'epic' }, eventSeq)
          : hazard.hazardTriggered
            ? createTetrisFeedback(state, 'hazard', { intensity: 'bright' }, eventSeq)
            : options.hardDrop
              ? createTetrisFeedback(state, 'hard-drop', { intensity: 'bright' }, eventSeq)
              : createTetrisFeedback(state, 'drop', { intensity: 'soft' }, eventSeq);
  return spawnFromQueue(withChapterState({
    ...state,
    board: hazard.board,
    score: state.score + clearScore,
    lines,
    level,
    canHold: true,
    eventSeq,
    lastClear: {
      id: eventSeq,
      lines: clear.cleared,
      score: clearScore,
      tetris: clear.cleared === 4,
    },
    mission: missionResult.mission,
    energy: missionResult.energy,
    combo,
    powerEffects: hazard.powerEffects,
    lastFeedback: feedback,
  }));
}

function movePiece(state: TetrisGameState, dx: number, dy: number, lockOnBlocked = false): TetrisGameState {
  const active = { ...state.active, x: state.active.x + dx, y: state.active.y + dy };
  if (isPositionValid(state.board, active)) {
    return { ...state, active };
  }
  if (lockOnBlocked && dy > 0) return lockActivePiece(state);
  return state;
}

function rotatePiece(state: TetrisGameState, direction: 'clockwise' | 'counterclockwise' = 'clockwise') {
  if (state.active.type === 'O') return state;
  const delta = direction === 'counterclockwise' ? 3 : 1;
  const rotation = ((state.active.rotation + delta) % 4) as TetrisRotation;
  const kicks = state.active.type === 'I'
    ? [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, -1], [1, -1], [-1, -1]]
    : [[0, 0], [1, 0], [-1, 0], [0, -1], [1, -1], [-1, -1], [2, 0], [-2, 0]];

  for (const [kickX, kickY] of kicks) {
    const active = {
      ...state.active,
      rotation,
      x: state.active.x + kickX,
      y: state.active.y + kickY,
    };
    if (isPositionValid(state.board, active)) return { ...state, active };
  }
  return state;
}

export function getGhostY(state: TetrisGameState): number {
  let y = state.active.y;
  while (isPositionValid(state.board, { ...state.active, y: y + 1 })) y += 1;
  return y;
}

function hardDrop(state: TetrisGameState): TetrisGameState {
  return lockActivePiece({ ...state, active: { ...state.active, y: getGhostY(state) } }, { hardDrop: true });
}

function holdPiece(state: TetrisGameState): TetrisGameState {
  if (!state.canHold) return state;
  if (state.held) {
    return spawnHeldPiece(state, state.held, state.active.type);
  }
  const filled = fillQueue(state.queue, state.seed);
  const nextType = filled.queue[0] || 'I';
  const active = spawnPiece(nextType);
  return withNext({
    ...state,
    active,
    held: state.active.type,
    queue: filled.queue.slice(1),
    seed: filled.seed,
    canHold: false,
    status: isPositionValid(state.board, active) ? state.status : 'game-over',
  });
}

function tickPowerEffects(state: TetrisGameState): TetrisGameState {
  if (state.powerEffects.slowTicks <= 0) return state;
  return {
    ...state,
    powerEffects: {
      ...state.powerEffects,
      slowTicks: Math.max(0, state.powerEffects.slowTicks - 1),
    },
  };
}

function claimMissionReward(state: TetrisGameState): TetrisGameState {
  if (!state.mission.completed || state.mission.rewardClaimed) return state;
  return withChapterState({
    ...state,
    mission: { ...state.mission, rewardClaimed: true },
    energy: clampEnergy(state.energy + state.chapter.rewardEnergy),
  });
}

function useTetrisPower(state: TetrisGameState, power: TetrisPowerId): TetrisGameState {
  if (!canUseTetrisPower(state, power)) return state;
  const cost = getTetrisPowerCost(power, state.level);
  const energyAfterCost = clampEnergy(state.energy - cost);
  const createPowerFeedback = (label?: string) => createTetrisFeedback(
    state,
    'power',
    { power, intensity: 'epic', label },
    nextFeedbackId(state, state.eventSeq + 1),
  );
  const applyMission = (next: TetrisGameState, feedback = createPowerFeedback()) => {
    const result = applyMissionEvent(next, { power }, next.energy);
    return withChapterState({ ...next, mission: result.mission, energy: result.energy, lastFeedback: feedback });
  };

  if (power === 'slow') {
    return applyMission({
      ...state,
      energy: energyAfterCost,
      powerEffects: {
        ...state.powerEffects,
        slowTicks: Math.max(state.powerEffects.slowTicks, 30),
      },
    });
  }

  if (power === 'clear-bottom') {
    const board = cloneBoard(state.board);
    const shifted = [emptyRow(), ...board.slice(0, TETRIS_HEIGHT - 1)];
    return applyMission({
      ...state,
      board: shifted,
      energy: energyAfterCost,
      score: state.score + 50 * state.level,
      eventSeq: state.eventSeq + 1,
      powerEffects: {
        ...state.powerEffects,
        clearBottomUsedInChapter: state.powerEffects.clearBottomUsedInChapter + 1,
      },
      lastClear: {
        id: state.eventSeq + 1,
        lines: 1,
        score: 50 * state.level,
        tetris: false,
      },
    });
  }

  if (power === 'reroll') {
    const filled = fillQueue(state.queue, state.seed);
    const nextIndex = filled.queue.findIndex((type) => type !== state.active.type);
    const nextType = nextIndex >= 0 ? filled.queue[nextIndex] : TETRIS_PIECES.find((type) => type !== state.active.type) || 'I';
    const nextQueue = nextIndex >= 0
      ? [...filled.queue.slice(0, nextIndex), ...filled.queue.slice(nextIndex + 1)]
      : filled.queue;
    const active = spawnPiece(nextType);
    return applyMission(withNext({
      ...state,
      active,
      queue: nextQueue,
      seed: filled.seed,
      energy: energyAfterCost,
      powerEffects: {
        ...state.powerEffects,
        rerollsUsedInChapter: state.powerEffects.rerollsUsedInChapter + 1,
      },
      status: isPositionValid(state.board, active) ? state.status : 'game-over',
    }));
  }

  const clearedHazards = clearRandomHazardCells(state.board, nextSeed(state.seed + state.eventSeq + 41));
  return applyMission({
    ...state,
    board: clearedHazards.board,
    energy: energyAfterCost,
    powerEffects: {
      ...state.powerEffects,
      shieldCharges: 0,
    },
  }, createPowerFeedback(clearedHazards.cleared > 0 ? `清障 x${clearedHazards.cleared}` : '暂无障碍'));
}

export function updateTetrisGame(state: TetrisGameState, action: TetrisAction): TetrisGameState {
  if (action.type === 'restart') return createTetrisGame({ seed: action.seed ?? state.seed, queue: action.queue });
  if (action.type === 'applyCanvasEnergyBonus') {
    return withChapterState({
      ...state,
      energy: clampEnergy(state.energy + Math.max(5, normalizeNonNegativeInt(action.amount, 15))),
    });
  }
  if (action.type === 'pause') return state.status === 'playing' ? { ...state, status: 'paused' } : state;
  if (action.type === 'resume') return state.status === 'paused' ? { ...state, status: 'playing' } : state;
  if (state.status !== 'playing') return state;

  switch (action.type) {
    case 'move':
      return movePiece(state, Number(action.dx) || 0, Number(action.dy) || 0);
    case 'rotate':
      return rotatePiece(state, action.direction);
    case 'softDrop':
      return movePiece(state, 0, 1, true);
    case 'tick':
      return movePiece(tickPowerEffects(state), 0, 1, true);
    case 'hardDrop':
      return hardDrop(state);
    case 'hold':
      return holdPiece(state);
    case 'usePower':
      return useTetrisPower(state, action.power);
    case 'claimMissionReward':
      return claimMissionReward(state);
    default:
      return state;
  }
}

export function getTetrisSpeedMultiplier(level: number): number {
  const normalized = normalizeLevel(level);
  if (normalized <= 5) return 1;
  if (normalized >= 95) return TETRIS_MAX_SPEED_MULTIPLIER;
  const step = Math.ceil((normalized - 5) / 5);
  const multiplier = 1 + step / 19;
  return Math.min(TETRIS_MAX_SPEED_MULTIPLIER, Math.round(multiplier * 100) / 100);
}

export function getTetrisFallInterval(
  level: number,
  context?: Pick<TetrisGameState, 'chapter' | 'powerEffects'> | { slowTicks?: number },
): number {
  const normalized = normalizeLevel(level);
  let interval = TETRIS_BASE_FALL_INTERVAL_MS / getTetrisSpeedMultiplier(normalized);
  const slowTicks = context
    ? 'powerEffects' in context
      ? context.powerEffects.slowTicks
      : context.slowTicks || 0
    : 0;
  if (slowTicks > 0) interval *= 1.75;
  const fastestInterval = Math.round(TETRIS_BASE_FALL_INTERVAL_MS / TETRIS_MAX_SPEED_MULTIPLIER);
  return Math.max(fastestInterval, Math.round(interval));
}

export function getTetrisCheckpointLevel(level: number): number {
  const normalized = Math.max(1, Math.min(99, Math.floor(Number(level) || 1)));
  return Math.floor(normalized / TETRIS_CHECKPOINT_STEP) * TETRIS_CHECKPOINT_STEP;
}

function cloneGameState(state: TetrisGameState): TetrisGameState {
  return {
    ...state,
    board: cloneBoard(state.board),
    active: { ...state.active },
    next: [...state.next],
    queue: [...state.queue],
    lastClear: { ...state.lastClear },
    chapter: { ...state.chapter, hazards: [...state.chapter.hazards] },
    mission: { ...state.mission },
    activeHazards: [...state.activeHazards],
    unlockedPowers: [...state.unlockedPowers],
    powerEffects: { ...state.powerEffects },
    lastFeedback: state.lastFeedback ? { ...state.lastFeedback } : null,
  };
}

export function createTetrisCheckpoint(state: TetrisGameState, savedAt = Date.now()): TetrisCheckpoint | null {
  if (state.status === 'game-over') return null;
  const level = getTetrisCheckpointLevel(state.level);
  if (level < TETRIS_CHECKPOINT_STEP || state.level !== level) return null;
  return {
    level,
    lines: state.lines,
    score: state.score,
    savedAt: Math.max(0, Math.floor(Number(savedAt) || Date.now())),
    state: {
      ...cloneGameState(state),
      status: 'paused',
    },
  };
}

export function restoreTetrisCheckpoint(value: unknown): TetrisCheckpoint | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<TetrisCheckpoint>;
  const level = getTetrisCheckpointLevel(Number(raw.level));
  if (level < TETRIS_CHECKPOINT_STEP || Number(raw.level) !== level) return null;
  const state = restoreTetrisGame(raw.state);
  if (!state || state.level < level) return null;
  return {
    level,
    lines: Math.max(0, Math.floor(Number(raw.lines) || state.lines)),
    score: Math.max(0, Math.floor(Number(raw.score) || state.score)),
    savedAt: Math.max(0, Math.floor(Number(raw.savedAt) || 0)),
    state: {
      ...state,
      status: state.status === 'game-over' ? 'paused' : state.status,
    },
  };
}

export function getTetrisRenderBoard(state: TetrisGameState): TetrisBoard {
  const board = cloneBoard(state.board);
  const ghostY = getGhostY(state);
  for (const { x, y } of pieceCells({ ...state.active, y: ghostY })) {
    if (y >= 0 && y < TETRIS_HEIGHT && !board[y][x]) {
      board[y][x] = { type: state.active.type, ghost: true };
    }
  }
  for (const { x, y } of pieceCells(state.active)) {
    if (y >= 0 && y < TETRIS_HEIGHT) {
      board[y][x] = { type: state.active.type, active: true };
    }
  }
  return board;
}

export function restoreTetrisGame(value: unknown): TetrisGameState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<TetrisGameState>;
  if (!Array.isArray(raw.board) || raw.board.length !== TETRIS_HEIGHT) return null;
  if (!raw.active || !TETRIS_PIECES.includes(raw.active.type as TetrisPieceType)) return null;
  const board = raw.board.map((row) => {
    if (!Array.isArray(row) || row.length !== TETRIS_WIDTH) return emptyRow();
    return row.map((cell) => {
      if (!cell || !TETRIS_PIECES.includes((cell as TetrisCell).type)) return null;
      const modifier = TETRIS_CELL_MODIFIERS.includes((cell as TetrisCell).modifier as TetrisCellModifier)
        ? (cell as TetrisCell).modifier
        : undefined;
      return {
        type: (cell as TetrisCell).type,
        locked: Boolean((cell as TetrisCell).locked),
        modifier,
        hazard: (cell as TetrisCell).hazard || undefined,
      };
    });
  });
  const queue = Array.isArray(raw.queue)
    ? raw.queue.filter((item): item is TetrisPieceType => TETRIS_PIECES.includes(item as TetrisPieceType))
    : [];
  const seed = normalizeSeed(raw.seed);
  const filled = fillQueue(queue, seed);
  const level = normalizeLevel(raw.level);
  const chapter = getTetrisChapter(level);
  return withChapterState(withNext({
    board,
    active: {
      type: raw.active.type,
      x: Math.floor(Number(raw.active.x) || 0),
      y: Math.floor(Number(raw.active.y) || 0),
      rotation: ([0, 1, 2, 3].includes(raw.active.rotation) ? raw.active.rotation : 0) as TetrisRotation,
    },
    queue: filled.queue,
    held: raw.held && TETRIS_PIECES.includes(raw.held) ? raw.held : null,
    canHold: raw.canHold !== false,
    score: Math.max(0, Math.floor(Number(raw.score) || 0)),
    lines: Math.max(0, Math.floor(Number(raw.lines) || 0)),
    level,
    status: raw.status === 'game-over' ? 'game-over' : raw.status === 'victory' ? 'victory' : raw.status === 'paused' ? 'paused' : 'playing',
    seed: filled.seed,
    startedAt: Math.max(0, Math.floor(Number(raw.startedAt) || Date.now())),
    lastClear: {
      id: Math.max(0, Math.floor(Number(raw.lastClear?.id) || 0)),
      lines: Math.max(0, Math.floor(Number(raw.lastClear?.lines) || 0)),
      score: Math.max(0, Math.floor(Number(raw.lastClear?.score) || 0)),
      tetris: Boolean(raw.lastClear?.tetris),
    },
    eventSeq: Math.max(0, Math.floor(Number(raw.eventSeq) || 0)),
    chapter,
    mission: normalizeTetrisMission(raw.mission, chapter),
    energy: clampEnergy(raw.energy),
    combo: normalizeNonNegativeInt(raw.combo),
    activeHazards: [...chapter.hazards],
    unlockedPowers: getTetrisUnlockedPowers(level),
    powerEffects: normalizePowerEffects(raw.powerEffects),
    lastFeedback: normalizeTetrisFeedback(raw.lastFeedback, chapter),
  }));
}

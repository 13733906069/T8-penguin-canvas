import {
  SAINT_SEIYA_CLOTH_BY_ID,
  SAINT_SEIYA_CLOTHS,
  SAINT_SEIYA_GOLD_CLOTHS,
  type SaintCloth,
  type SaintClothRank,
  type SaintMove,
  clothRankSortValue,
} from '../data/saintSeiyaCloths';

export interface SaintCombatStats {
  level: number;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  cosmoRegen: number;
}

export interface SaintEnemy {
  id: string;
  clothId: string;
  rank: SaintClothRank;
  name: string;
  constellation: string;
  level: number;
  stats: SaintCombatStats;
  moves: SaintMove[];
}

export interface SaintBattleReport {
  victory: boolean;
  turns: number;
  expGain: number;
  playerHp: number;
  enemyHp: number;
  playerMaxHp: number;
  enemyMaxHp: number;
  playerMp: number;
  enemyMp: number;
  playerMaxMp: number;
  enemyMaxMp: number;
  usedCosmoBurst: boolean;
  log: string[];
  events: SaintBattleEvent[];
}

export type SaintSkillEffectStyle =
  | 'strike'
  | 'cosmo'
  | 'meteor'
  | 'dragon'
  | 'ice'
  | 'chain'
  | 'fire'
  | 'lightning'
  | 'galaxy'
  | 'crystal'
  | 'horn'
  | 'underworld'
  | 'lotus'
  | 'weapon'
  | 'needle'
  | 'arrow'
  | 'blade'
  | 'aurora'
  | 'rose'
  | 'shield';

export type SaintSkillSoundCue = SaintSkillEffectStyle;

export type SaintBattleEventKind =
  | 'intro'
  | 'stance'
  | 'clash'
  | 'player-guard'
  | 'player-attack'
  | 'enemy-attack'
  | 'victory'
  | 'defeat'
  | 'reward';

export interface SaintBattleEvent {
  id: string;
  turn: number;
  actor: 'player' | 'enemy' | 'system';
  kind: SaintBattleEventKind;
  text: string;
  moveName?: string;
  damage?: number;
  playerHp: number;
  enemyHp: number;
  playerMp: number;
  enemyMp: number;
  playerMaxHp: number;
  enemyMaxHp: number;
  playerMaxMp: number;
  enemyMaxMp: number;
  accent?: string;
  effectId?: string;
  effectStyle?: SaintSkillEffectStyle;
  soundCue?: SaintSkillSoundCue;
  intensity?: number;
}

export type BattleStrategy = 'attack' | 'skill' | 'guard' | 'cosmo' | 'auto';

const BASIC_ATTACK: SaintMove = {
  id: 'basic-attack',
  name: '音速拳',
  power: 1,
  mpCost: 0,
  kind: 'strike',
};

const AWAKENING_MOVE: SaintMove = {
  id: 'cosmo-awakening',
  name: '燃烧吧小宇宙',
  power: 1.72,
  mpCost: 18,
  kind: 'ultimate',
};

export function saintLevelFromExp(totalExp: number) {
  return Math.max(1, Math.min(99, 1 + Math.floor(Math.max(0, Math.floor(totalExp || 0)) / 10)));
}

export function rankExpValue(rank: SaintClothRank, victory: boolean) {
  if (victory) {
    if (rank === 'gold') return 9;
    if (rank === 'silver') return 6;
    return 3;
  }
  if (rank === 'gold') return 6;
  if (rank === 'silver') return 4;
  return 2;
}

export function rewardExpForRank(rank: SaintClothRank, victory: boolean) {
  return (victory ? 6 : 3) + rankExpValue(rank, victory);
}

export function enemyLevelRange(rank: SaintClothRank): [number, number] {
  if (rank === 'gold') return [67, 99];
  if (rank === 'silver') return [34, 66];
  return [1, 33];
}

export function clampEnemyLevel(rank: SaintClothRank, playerLevel: number, rng: () => number = Math.random) {
  const [min, max] = enemyLevelRange(rank);
  const drift = Math.floor((rng() - 0.35) * 10);
  const suggested = playerLevel + drift;
  return Math.max(min, Math.min(max, suggested));
}

export function bestCollectedCloth(collected: Record<string, unknown> | Partial<Record<string, unknown>>) {
  let best: SaintCloth | null = null;
  for (const cloth of SAINT_SEIYA_CLOTHS) {
    if (!collected[cloth.id]) continue;
    if (!best || clothRankSortValue(cloth.rank) > clothRankSortValue(best.rank)) best = cloth;
  }
  return best;
}

export function buildPlayerStats(level: number, equippedRank?: SaintClothRank | null): SaintCombatStats {
  const base = {
    level,
    hp: 150 + level * 18,
    mp: 44 + level * 5,
    atk: 10 + level * 1.45,
    def: 9 + level * 1.35,
    spd: 8 + level * 0.45,
    cosmoRegen: 0,
  };
  const bonus = equippedRank === 'gold'
    ? { hp: 1.28, mp: 1.22, atk: 1.26, def: 1.24, cosmoRegen: 8 }
    : equippedRank === 'silver'
      ? { hp: 1.16, mp: 1.12, atk: 1.15, def: 1.14, cosmoRegen: 5 }
      : equippedRank === 'bronze'
        ? { hp: 1.08, mp: 1.06, atk: 1.08, def: 1.06, cosmoRegen: 3 }
        : { hp: 1, mp: 1, atk: 1, def: 1, cosmoRegen: 0 };
  return {
    level,
    hp: Math.round(base.hp * bonus.hp),
    mp: Math.round(base.mp * bonus.mp),
    atk: Math.round(base.atk * bonus.atk),
    def: Math.round(base.def * bonus.def),
    spd: Math.round(base.spd),
    cosmoRegen: bonus.cosmoRegen,
  };
}

export function buildEnemyStats(rank: SaintClothRank, level: number): SaintCombatStats {
  if (rank === 'gold') {
    return {
      level,
      hp: Math.round(430 + level * 18),
      mp: Math.round(96 + level * 3.8),
      atk: Math.round(16 + level * 1.45),
      def: Math.round(17 + level * 1.32),
      spd: Math.round(11 + level * 0.5),
      cosmoRegen: 7,
    };
  }
  if (rank === 'silver') {
    return {
      level,
      hp: Math.round(250 + level * 16),
      mp: Math.round(58 + level * 3),
      atk: Math.round(11 + level * 1.35),
      def: Math.round(11 + level * 1.18),
      spd: Math.round(9 + level * 0.48),
      cosmoRegen: 5,
    };
  }
  return {
    level,
    hp: Math.round(145 + level * 14),
    mp: Math.round(34 + level * 2.4),
    atk: Math.round(8 + level * 1.25),
    def: Math.round(7 + level * 1.05),
    spd: Math.round(8 + level * 0.42),
    cosmoRegen: 3,
  };
}

export function buildSaintEnemy(clothId: string, playerLevel: number, rng: () => number = Math.random): SaintEnemy {
  const cloth = SAINT_SEIYA_CLOTH_BY_ID[clothId] || SAINT_SEIYA_CLOTHS[0];
  const level = clampEnemyLevel(cloth.rank, playerLevel, rng);
  return {
    id: `enemy-${cloth.id}-${level}`,
    clothId: cloth.id,
    rank: cloth.rank,
    name: `${cloth.constellation}${cloth.owner}`,
    constellation: cloth.constellation,
    level,
    stats: buildEnemyStats(cloth.rank, level),
    moves: cloth.moves,
  };
}

export function unlockedSaintMoves(collected: Record<string, unknown> | Partial<Record<string, unknown>>) {
  const moves: SaintMove[] = [BASIC_ATTACK, AWAKENING_MOVE];
  const collectedCloths = SAINT_SEIYA_CLOTHS
    .filter((cloth) => Boolean(collected[cloth.id]))
    .sort((a, b) => clothRankSortValue(a.rank) - clothRankSortValue(b.rank));
  for (const cloth of collectedCloths) {
    moves.push(...cloth.moves);
  }
  return moves;
}

function chooseMove(moves: SaintMove[], mp: number, strategy: BattleStrategy, rng: () => number) {
  const affordable = moves.filter((move) => move.mpCost <= mp);
  if (strategy === 'attack' || affordable.length === 0) return BASIC_ATTACK;
  if (strategy === 'guard') return affordable.find((move) => move.kind === 'guard') || BASIC_ATTACK;
  if (strategy === 'cosmo') return affordable.find((move) => move.kind === 'ultimate') || AWAKENING_MOVE;
  if (strategy === 'skill') {
    return affordable
      .filter((move) => move.kind !== 'guard')
      .sort((a, b) => b.power - a.power)[0] || BASIC_ATTACK;
  }
  const usable = affordable
    .filter((move) => move.kind !== 'guard')
    .sort((a, b) => b.power - a.power || a.mpCost - b.mpCost);
  return usable[0] || BASIC_ATTACK;
}

export function saintDamage(atk: number, def: number, power = 1, rng: () => number = Math.random) {
  const variance = 0.9 + rng() * 0.2;
  return Math.max(5, Math.round((atk * power * 0.78 - def * 0.38) * variance));
}

function textIncludes(source: string, terms: string[]) {
  return terms.some((term) => source.includes(term));
}

export function saintMoveEffectStyle(move: SaintMove, cloth?: SaintCloth | null): SaintSkillEffectStyle {
  if (move.kind === 'guard') return 'shield';
  const source = `${move.id} ${move.name} ${cloth?.id || ''} ${cloth?.constellation || ''} ${cloth?.element || ''}`.toLowerCase();
  if (textIncludes(source, ['pegasus', '流星', '彗星', '回旋'])) return 'meteor';
  if (textIncludes(source, ['dragon', 'rozan', '庐山', '升龙', '百龙', '龙气', '天龙'])) return 'dragon';
  if (textIncludes(source, ['aurora', '曙光', '极光'])) return 'aurora';
  if (textIncludes(source, ['diamond', 'freezing', 'cygnus', '冰', '钻石', '绝对零度', '白鸟'])) return 'ice';
  if (textIncludes(source, ['chain', 'andromeda', '锁链', '星云'])) return 'chain';
  if (textIncludes(source, ['phoenix', '凤凰', '凤翼', '不死鸟', '火焰', '烈焰'])) return 'fire';
  if (textIncludes(source, ['lightning', 'thunder', '闪电', '雷光', '雷电'])) return 'lightning';
  if (textIncludes(source, ['galaxy', 'dimension', 'genro', '银河', '异次元', '幻胧', '双子'])) return 'galaxy';
  if (textIncludes(source, ['crystal', 'starlight', 'stardust', '水晶', '星光', '星屑', '白羊'])) return 'crystal';
  if (textIncludes(source, ['horn', 'bull', '金牛', '巨角', '号角'])) return 'horn';
  if (textIncludes(source, ['sekishiki', 'hades', 'meikai', '冥界', '积尸', '黄泉', '巨蟹'])) return 'underworld';
  if (textIncludes(source, ['tenbu', 'rikudo', 'virgo', '天舞', '六道', '莲', '处女'])) return 'lotus';
  if (textIncludes(source, ['libra', '天秤', '兵器', '武器'])) return 'weapon';
  if (textIncludes(source, ['scarlet', 'antares', 'scorpio', '猩红', '赤针', '安达里士', '天蝎'])) return 'needle';
  if (textIncludes(source, ['arrow', 'sagittarius', '射手', '黄金箭'])) return 'arrow';
  if (textIncludes(source, ['excalibur', 'blade', 'capricorn', '圣剑', '山羊', '跳跃石'])) return 'blade';
  if (textIncludes(source, ['rose', 'pisces', '玫瑰', '双鱼'])) return 'rose';
  if (move.kind === 'ultimate' || move.kind === 'cosmo') return 'cosmo';
  return 'strike';
}

export function saintMoveSoundCue(move: SaintMove, cloth?: SaintCloth | null): SaintSkillSoundCue {
  return saintMoveEffectStyle(move, cloth);
}

function saintMoveEffectId(move: SaintMove, cloth?: SaintCloth | null) {
  return `${cloth?.id || 'basic'}-${move.id}-${saintMoveEffectStyle(move, cloth)}`;
}

function rankTrialName(rank: SaintClothRank) {
  if (rank === 'gold') return '黄金圣斗士';
  if (rank === 'silver') return '白银圣斗士';
  return '青铜圣斗士';
}

function battleEffectPhrase(style: SaintSkillEffectStyle, element: string) {
  switch (style) {
    case 'meteor': return `${element}划成数十道流星轨迹`;
    case 'dragon': return '龙形气劲沿地面盘旋升腾';
    case 'ice': return '冰晶从脚下铺开，空气瞬间凝白';
    case 'aurora': return '极光像薄刃一样横切战场';
    case 'chain': return '锁链绕成防线又突然收紧';
    case 'fire': return '火羽卷起，把残影烧成金红色';
    case 'lightning': return '雷光在一瞬间分裂成拳雨';
    case 'galaxy': return '星河裂缝在身后张开';
    case 'crystal': return '水晶碎屑折射出圣域星图';
    case 'horn': return '巨角冲击让石阶低鸣';
    case 'underworld': return '冥界波纹从脚下旋开';
    case 'lotus': return '六道光轮层层展开';
    case 'weapon': return '天秤兵装的虚影交错闪过';
    case 'needle': return '赤针星点沿直线刺入';
    case 'arrow': return '黄金箭翼拖出笔直光线';
    case 'blade': return '无形圣剑把气流切成两半';
    case 'rose': return '玫瑰花瓣在冲击前一刻静止';
    case 'shield': return `${element}凝成半透明护壁`;
    default: return `${element}小宇宙压缩成光`;
  }
}

function moveFlavor(
  move: SaintMove,
  element: string,
  damage: number,
  actor: 'player' | 'enemy',
  style: SaintSkillEffectStyle,
  ownerName?: string,
) {
  const owner = ownerName || (actor === 'player' ? '你' : '对手');
  const phrase = battleEffectPhrase(style, element);
  if (move.kind === 'guard') return `${owner}架起${move.name}，${element}的小宇宙化成护壁。`;
  if (move.kind === 'ultimate') {
    return `${move.name}爆发，${phrase}，最终造成 ${damage} 点冲击。`;
  }
  if (move.kind === 'cosmo') {
    return `${move.name}划出${element}轨迹，${phrase}，命中后造成 ${damage} 点伤害。`;
  }
  return `${move.name}连续逼近，${phrase}，拳压命中造成 ${damage} 点伤害。`;
}

function guardFlavor(move: SaintMove, regen: number) {
  return `${move.name}展开防线，小宇宙回流${regen > 0 ? ` +${regen}` : ''}，下一击伤害会被削弱。`;
}

function targetTurnsForRank(rank: SaintClothRank) {
  if (rank === 'gold') return 10;
  if (rank === 'silver') return 9;
  return 8;
}

function recoverMp(current: number, max: number, cost: number, regen: number) {
  return Math.min(max, Math.max(0, current - cost) + Math.max(0, regen));
}

function paceBattleDamage(rawDamage: number, currentHp: number, maxHp: number, turn: number, targetTurns: number) {
  if (turn >= targetTurns) return Math.max(1, Math.min(currentHp, rawDamage));
  const protectedHp = Math.max(1, Math.round(maxHp * 0.12));
  const availableDamage = Math.max(1, currentHp - protectedHp);
  const remainingTurns = Math.max(1, targetTurns - turn + 1);
  const rhythmCap = Math.max(6, Math.ceil(availableDamage / remainingTurns) + 10);
  return Math.max(1, Math.min(rawDamage, availableDamage, rhythmCap));
}

export function simulateSaintBattle(args: {
  totalExp: number;
  collected: Record<string, unknown> | Partial<Record<string, unknown>>;
  enemy: SaintEnemy;
  strategy?: BattleStrategy;
  rng?: () => number;
}): SaintBattleReport {
  const rng = args.rng || Math.random;
  const level = saintLevelFromExp(args.totalExp);
  const equipped = bestCollectedCloth(args.collected);
  const playerStats = buildPlayerStats(level, equipped?.rank);
  const enemyStats = { ...args.enemy.stats };
  let playerHp = playerStats.hp;
  let playerMp = playerStats.mp;
  let enemyHp = enemyStats.hp;
  let enemyMp = enemyStats.mp;
  let guardNext = false;
  let usedCosmoBurst = false;
  const strategy = args.strategy || 'auto';
  const playerMoves = unlockedSaintMoves(args.collected);
  const events: SaintBattleEvent[] = [];
  const pushEvent = (
    kind: SaintBattleEventKind,
    actor: SaintBattleEvent['actor'],
    turn: number,
    text: string,
    extra: Partial<Pick<SaintBattleEvent, 'moveName' | 'damage' | 'accent' | 'effectId' | 'effectStyle' | 'soundCue' | 'intensity'>> = {},
  ) => {
    events.push({
      id: `${args.enemy.id}-${turn}-${events.length}-${kind}`,
      turn,
      actor,
      kind,
      text,
      playerHp,
      enemyHp,
      playerMp,
      enemyMp,
      playerMaxHp: playerStats.hp,
      enemyMaxHp: enemyStats.hp,
      playerMaxMp: playerStats.mp,
      enemyMaxMp: enemyStats.mp,
      ...extra,
    });
  };

  pushEvent(
    'intro',
    'system',
    0,
    `圣域试炼展开：你 Lv${level} 对阵 ${args.enemy.name} Lv${args.enemy.level}，对方披挂${rankTrialName(args.enemy.rank)}的气息压迫全场。`,
  );
  pushEvent(
    'stance',
    'player',
    0,
    equipped
      ? `你披挂 ${equipped.label}，${equipped.element}小宇宙沿圣衣纹路燃起。`
      : '未装备圣衣，你以基础小宇宙摆开架势，准备硬闯这一宫。',
  );

  const targetTurns = targetTurnsForRank(args.enemy.rank);
  const maxTurns = targetTurns;
  let turnsResolved = 0;
  for (let turn = 1; turn <= maxTurns && playerHp > 0 && enemyHp > 0; turn += 1) {
    turnsResolved = turn;
    const playerFirst = playerStats.spd >= enemyStats.spd || rng() > 0.55;
    const playerMove = chooseMove(playerMoves, playerMp, strategy, rng);
    const enemyMove = chooseMove(args.enemy.moves, enemyMp, 'auto', rng);
    const playerMoveStyle = saintMoveEffectStyle(playerMove, equipped);
    const enemyCloth = SAINT_SEIYA_CLOTH_BY_ID[args.enemy.clothId];
    const enemyMoveStyle = saintMoveEffectStyle(enemyMove, enemyCloth);

    pushEvent(
      'clash',
      'system',
      turn,
      `第${turn}回合：你与${args.enemy.name}的小宇宙在宫门前相撞，星尘像潮水一样退开，双方寻找下一瞬的破绽。`,
      {
        moveName: '小宇宙交锋',
        accent: '#f8c84a',
        effectId: `cosmo-clash-${turn}`,
        effectStyle: 'cosmo',
        soundCue: 'cosmo',
        intensity: 0.62,
      },
    );

    const playerAction = () => {
      if (playerHp <= 0 || enemyHp <= 0) return;
      if (playerMove.kind === 'guard') {
        guardNext = true;
        const regen = playerStats.cosmoRegen + 8;
        playerMp = recoverMp(playerMp, playerStats.mp, playerMove.mpCost, regen);
        pushEvent('player-guard', 'player', turn, `第${turn}回合：${guardFlavor(playerMove, playerStats.cosmoRegen)}`, {
          moveName: playerMove.name,
          accent: '#67e8f9',
          effectId: saintMoveEffectId(playerMove, equipped),
          effectStyle: playerMoveStyle,
          soundCue: saintMoveSoundCue(playerMove, equipped),
          intensity: 0.58,
        });
        return;
      }
      playerMp = recoverMp(playerMp, playerStats.mp, playerMove.mpCost, playerStats.cosmoRegen);
      const isCosmoBurst = playerMove.kind === 'ultimate' || strategy === 'cosmo';
      const boost = isCosmoBurst && !usedCosmoBurst ? 1.22 : 1;
      if (isCosmoBurst) usedCosmoBurst = true;
      const rawDamage = saintDamage(playerStats.atk, enemyStats.def, playerMove.power * boost, rng);
      const damage = paceBattleDamage(rawDamage, enemyHp, enemyStats.hp, turn, targetTurns);
      enemyHp = Math.max(0, enemyHp - damage);
      const burstText = isCosmoBurst && boost > 1 ? '第七感瞬间点燃，' : '';
      pushEvent(
        'player-attack',
        'player',
        turn,
        `第${turn}回合：${burstText}${moveFlavor(playerMove, equipped?.element || '流星', damage, 'player', playerMoveStyle)}`,
        {
          moveName: playerMove.name,
          damage,
          accent: playerMove.kind === 'ultimate' ? '#f8c84a' : '#2dd4bf',
          effectId: saintMoveEffectId(playerMove, equipped),
          effectStyle: playerMoveStyle,
          soundCue: saintMoveSoundCue(playerMove, equipped),
          intensity: playerMove.kind === 'ultimate' ? 1 : 0.78,
        },
      );
    };

    const enemyAction = () => {
      if (playerHp <= 0 || enemyHp <= 0) return;
      enemyMp = recoverMp(enemyMp, enemyStats.mp, enemyMove.mpCost, enemyStats.cosmoRegen);
      const rawDamage = saintDamage(enemyStats.atk, playerStats.def, enemyMove.power, rng);
      const guardedDamage = guardNext ? Math.max(2, Math.round(rawDamage * 0.45)) : rawDamage;
      const damage = paceBattleDamage(guardedDamage, playerHp, playerStats.hp, turn, targetTurns);
      const guarded = guardNext;
      guardNext = false;
      playerHp = Math.max(0, playerHp - damage);
      pushEvent(
        'enemy-attack',
        'enemy',
        turn,
        `第${turn}回合：${args.enemy.name}以${enemyMove.name}反击，${guarded ? '护壁挡下大半冲击，' : ''}${moveFlavor(enemyMove, enemyCloth?.element || args.enemy.constellation, damage, 'enemy', enemyMoveStyle, args.enemy.name)}`,
        {
          moveName: enemyMove.name,
          damage,
          accent: args.enemy.rank === 'gold' ? '#f8c84a' : args.enemy.rank === 'silver' ? '#cbd5e1' : '#34d399',
          effectId: saintMoveEffectId(enemyMove, enemyCloth),
          effectStyle: enemyMoveStyle,
          soundCue: saintMoveSoundCue(enemyMove, enemyCloth),
          intensity: enemyMove.kind === 'ultimate' ? 0.96 : 0.72,
        },
      );
    };

    if (playerFirst) {
      playerAction();
      enemyAction();
    } else {
      enemyAction();
      playerAction();
    }
  }

  const playerHpRatio = playerHp / Math.max(1, playerStats.hp);
  const enemyHpRatio = enemyHp / Math.max(1, enemyStats.hp);
  const victory = enemyHp <= 0 || (playerHp > 0 && playerHpRatio >= enemyHpRatio);
  const expGain = rewardExpForRank(args.enemy.rank, victory);
  pushEvent(
    victory ? 'victory' : 'defeat',
    'system',
    Math.max(1, turnsResolved + 1),
    victory
      ? `你压制了${args.enemy.name}的圣衣共鸣，试炼胜利。`
      : `${args.enemy.name}守住了宫门，但你的星命点仍被点亮。`,
    { accent: victory ? '#34d399' : '#fb7185' },
  );
  pushEvent(
    'reward',
    'system',
    Math.max(1, turnsResolved + 1),
    victory ? `获得 ${expGain} 经验，圣衣将在光芒中归位。` : `试炼失败，仍获得 ${expGain} 经验；下一次小宇宙会燃得更高。`,
    { accent: victory ? '#f8c84a' : '#cbd5e1' },
  );
  const log = events.map((event) => event.text);
  return {
    victory,
    turns: turnsResolved,
    expGain,
    playerHp,
    enemyHp,
    playerMaxHp: playerStats.hp,
    enemyMaxHp: enemyStats.hp,
    playerMp,
    enemyMp,
    playerMaxMp: playerStats.mp,
    enemyMaxMp: enemyStats.mp,
    usedCosmoBurst,
    log,
    events,
  };
}

export function hasAllGoldCloths(collected: Record<string, unknown> | Partial<Record<string, unknown>>) {
  return SAINT_SEIYA_GOLD_CLOTHS.every((cloth) => Boolean(collected[cloth.id]));
}

export function nextGoldCloth(collected: Record<string, unknown> | Partial<Record<string, unknown>>) {
  return SAINT_SEIYA_GOLD_CLOTHS.find((cloth) => !collected[cloth.id]) || null;
}

export function goldTempleProgress(collected: Record<string, unknown> | Partial<Record<string, unknown>>) {
  const nextIndex = SAINT_SEIYA_GOLD_CLOTHS.findIndex((cloth) => !collected[cloth.id]);
  return {
    completed: nextIndex === -1 ? SAINT_SEIYA_GOLD_CLOTHS.length : nextIndex,
    total: SAINT_SEIYA_GOLD_CLOTHS.length,
    next: nextIndex === -1 ? null : SAINT_SEIYA_GOLD_CLOTHS[nextIndex],
    nextIndex: nextIndex === -1 ? SAINT_SEIYA_GOLD_CLOTHS.length : nextIndex,
  };
}

export function availableClothsByRank(
  rank: SaintClothRank,
  collected: Record<string, unknown> | Partial<Record<string, unknown>>,
) {
  if (rank === 'gold') {
    const next = nextGoldCloth(collected);
    return next ? [next] : [];
  }
  return SAINT_SEIYA_CLOTHS.filter((cloth) => cloth.rank === rank && !collected[cloth.id]);
}

export function rankWeightsForLevel(level: number): Array<{ rank: SaintClothRank; weight: number }> {
  if (level >= 67) {
    return [
      { rank: 'bronze', weight: 10 },
      { rank: 'silver', weight: 30 },
      { rank: 'gold', weight: 60 },
    ];
  }
  if (level >= 41) {
    return [
      { rank: 'bronze', weight: 30 },
      { rank: 'silver', weight: 50 },
      { rank: 'gold', weight: 20 },
    ];
  }
  if (level >= 21) {
    return [
      { rank: 'bronze', weight: 55 },
      { rank: 'silver', weight: 35 },
      { rank: 'gold', weight: 10 },
    ];
  }
  return [
    { rank: 'bronze', weight: 75 },
    { rank: 'silver', weight: 22 },
    { rank: 'gold', weight: 3 },
  ];
}

export function chooseChestCloth(
  totalExp: number,
  collected: Record<string, unknown> | Partial<Record<string, unknown>>,
  rng: () => number = Math.random,
): SaintCloth | null {
  const level = saintLevelFromExp(totalExp);
  const weighted = rankWeightsForLevel(level)
    .map((item) => ({
      ...item,
      pool: availableClothsByRank(item.rank, collected),
    }))
    .filter((item) => item.pool.length > 0);
  if (weighted.length === 0) return null;
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rng() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.pool[Math.floor(rng() * item.pool.length)] || item.pool[0];
  }
  const last = weighted[weighted.length - 1];
  return last.pool[Math.floor(rng() * last.pool.length)] || last.pool[0];
}

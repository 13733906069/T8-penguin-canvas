export type SaintClothRank = 'bronze' | 'silver' | 'gold';

export interface SaintMove {
  id: string;
  name: string;
  power: number;
  mpCost: number;
  kind: 'strike' | 'cosmo' | 'guard' | 'ultimate';
}

export interface SaintCloth {
  id: string;
  rank: SaintClothRank;
  constellation: string;
  owner: string;
  label: string;
  element: string;
  moves: SaintMove[];
}

export interface SaintGoldClothUi {
  temple: number;
  glyph: string;
  shortName: string;
  sigil: string;
  motif: string;
  title: string;
  effect: string;
  unlockText: string;
  accent: string;
  secondary: string;
  aura: string;
  pattern: string;
}

export const SAINT_CLOTH_RANK_LABEL: Record<SaintClothRank, string> = {
  bronze: '青铜圣衣',
  silver: '白银圣衣',
  gold: '黄金圣衣',
};

export const SAINT_CLOTH_RANK_ACCENT: Record<SaintClothRank, string> = {
  bronze: '#34d399',
  silver: '#cbd5e1',
  gold: '#f8c84a',
};

export const SAINT_GOLD_CLOTH_UI: Record<string, SaintGoldClothUi> = {
  aries: {
    temple: 1,
    glyph: '♈',
    shortName: '白羊',
    sigil: 'CRYSTAL',
    motif: '水晶墙',
    title: '水晶圣域',
    effect: '星屑水晶壁',
    unlockText: '星屑在水晶墙后旋转，白羊宫的光门开启。',
    accent: '#fff0a8',
    secondary: '#f6c453',
    aura: '#fef3c7',
    pattern: 'crystal',
  },
  taurus: {
    temple: 2,
    glyph: '♉',
    shortName: '金牛',
    sigil: 'HORN',
    motif: '巨型号角',
    title: '黄金巨角',
    effect: '巨角冲击波',
    unlockText: '大地震动，巨角的黄金冲击贯穿圣域石阶。',
    accent: '#f59e0b',
    secondary: '#92400e',
    aura: '#fde68a',
    pattern: 'horn',
  },
  gemini: {
    temple: 3,
    glyph: '♊',
    shortName: '双子',
    sigil: 'GALAXY',
    motif: '银河星爆',
    title: '双生银河',
    effect: '双生银河门',
    unlockText: '双子幻影分开现实与异次元，银河在掌心爆裂。',
    accent: '#a78bfa',
    secondary: '#22d3ee',
    aura: '#ddd6fe',
    pattern: 'galaxy',
  },
  cancer: {
    temple: 4,
    glyph: '♋',
    shortName: '巨蟹',
    sigil: 'MEIKAI',
    motif: '积尸气',
    title: '黄泉波纹',
    effect: '冥界波纹',
    unlockText: '冥界波纹从足下扩散，巨蟹宫的幽光浮现。',
    accent: '#fb7185',
    secondary: '#581c87',
    aura: '#fecdd3',
    pattern: 'underworld',
  },
  leo: {
    temple: 5,
    glyph: '♌',
    shortName: '狮子',
    sigil: 'LION',
    motif: '闪电光速拳',
    title: '雷光狮心',
    effect: '雷光拳雨',
    unlockText: '雷光撕开星空，狮子的咆哮在圣域回响。',
    accent: '#facc15',
    secondary: '#ea580c',
    aura: '#fef08a',
    pattern: 'lightning',
  },
  virgo: {
    temple: 6,
    glyph: '♍',
    shortName: '处女',
    sigil: 'LOTUS',
    motif: '天舞宝轮',
    title: '六道莲华',
    effect: '六道光轮',
    unlockText: '莲华光轮展开，六道幻象在静默中降临。',
    accent: '#fef3c7',
    secondary: '#c084fc',
    aura: '#fde68a',
    pattern: 'mandala',
  },
  libra: {
    temple: 7,
    glyph: '♎',
    shortName: '天秤',
    sigil: 'BALANCE',
    motif: '百龙与武器',
    title: '天秤圣库',
    effect: '十二兵装',
    unlockText: '十二件兵器共鸣，百龙之气守住圣域中央。',
    accent: '#fbbf24',
    secondary: '#0f766e',
    aura: '#ccfbf1',
    pattern: 'scales',
  },
  scorpio: {
    temple: 8,
    glyph: '♏',
    shortName: '天蝎',
    sigil: 'ANTARES',
    motif: '猩红毒针',
    title: '赤针终点',
    effect: '十五赤针',
    unlockText: '十五道赤针点亮夜空，安达里士的红星落下。',
    accent: '#ef4444',
    secondary: '#7f1d1d',
    aura: '#fecaca',
    pattern: 'needle',
  },
  sagittarius: {
    temple: 9,
    glyph: '♐',
    shortName: '射手',
    sigil: 'ARROW',
    motif: '黄金箭',
    title: '星矢之箭',
    effect: '黄金箭翼',
    unlockText: '黄金箭穿过圣域穹顶，指向雅典娜的方向。',
    accent: '#fde047',
    secondary: '#2563eb',
    aura: '#dbeafe',
    pattern: 'arrow',
  },
  capricorn: {
    temple: 10,
    glyph: '♑',
    shortName: '山羊',
    sigil: 'BLADE',
    motif: '圣剑',
    title: '圣剑断空',
    effect: '圣剑斩线',
    unlockText: '无形圣剑斩开空气，山羊宫的锋芒完成传承。',
    accent: '#e5e7eb',
    secondary: '#334155',
    aura: '#f8fafc',
    pattern: 'blade',
  },
  aquarius: {
    temple: 11,
    glyph: '♒',
    shortName: '水瓶',
    sigil: 'AURORA',
    motif: '曙光女神',
    title: '绝对零度',
    effect: '极光冰环',
    unlockText: '冰晶沿星图凝结，曙光女神的极光降临。',
    accent: '#67e8f9',
    secondary: '#1d4ed8',
    aura: '#cffafe',
    pattern: 'aurora',
  },
  pisces: {
    temple: 12,
    glyph: '♓',
    shortName: '双鱼',
    sigil: 'ROSE',
    motif: '血腥玫瑰',
    title: '玫瑰终章',
    effect: '玫瑰花径',
    unlockText: '玫瑰花瓣铺满最后一宫，血红光芒刺破静寂。',
    accent: '#fb7185',
    secondary: '#be185d',
    aura: '#fbcfe8',
    pattern: 'rose',
  },
};

const move = (
  id: string,
  name: string,
  power: number,
  mpCost: number,
  kind: SaintMove['kind'] = 'cosmo',
): SaintMove => ({ id, name, power, mpCost, kind });

export const SAINT_SEIYA_BRONZE_CLOTHS: SaintCloth[] = [
  {
    id: 'pegasus',
    rank: 'bronze',
    constellation: '天马座',
    owner: '星矢',
    label: '天马座青铜圣衣',
    element: '流星',
    moves: [
      move('pegasus-ryuseiken', '天马流星拳', 1.18, 8),
      move('pegasus-suiseiken', '天马彗星拳', 1.35, 12),
      move('pegasus-rolling-crash', '天马回旋碎击拳', 1.55, 18, 'ultimate'),
    ],
  },
  {
    id: 'dragon',
    rank: 'bronze',
    constellation: '天龙座',
    owner: '紫龙',
    label: '天龙座青铜圣衣',
    element: '龙气',
    moves: [
      move('rozanshoryuha', '庐山升龙霸', 1.24, 9),
      move('rozan-ryuhisho', '庐山龙飞翔', 1.42, 14),
      move('rozan-hyakuryuha-bronze', '庐山百龙霸', 1.72, 24, 'ultimate'),
    ],
  },
  {
    id: 'cygnus',
    rank: 'bronze',
    constellation: '白鸟座',
    owner: '冰河',
    label: '白鸟座青铜圣衣',
    element: '冰结',
    moves: [
      move('diamond-dust-bronze', '钻石星尘拳', 1.18, 9),
      move('aurora-thunder-attack', '金光火焰旋风拳', 1.45, 16),
      move('freezing-coffin-bronze', '冰柩', 1.55, 22, 'ultimate'),
    ],
  },
  {
    id: 'andromeda',
    rank: 'bronze',
    constellation: '仙女座',
    owner: '瞬',
    label: '仙女座青铜圣衣',
    element: '锁链',
    moves: [
      move('nebula-chain', '星云锁链', 1.12, 7),
      move('rolling-defense', '滚动防御', 0.95, 10, 'guard'),
      move('nebula-storm', '星云风暴', 1.78, 25, 'ultimate'),
    ],
  },
  {
    id: 'phoenix',
    rank: 'bronze',
    constellation: '凤凰座',
    owner: '一辉',
    label: '凤凰座青铜圣衣',
    element: '不死鸟',
    moves: [
      move('houyoku-tensho', '凤翼天翔', 1.3, 11),
      move('phoenix-genmaken', '凤凰幻魔拳', 1.5, 17),
      move('phoenix-rebirth', '凤凰再临', 1.82, 26, 'ultimate'),
    ],
  },
];

export const SAINT_SEIYA_SILVER_CLOTHS: SaintCloth[] = [
  {
    id: 'eagle',
    rank: 'silver',
    constellation: '天鹰座',
    owner: '魔铃',
    label: '天鹰座白银圣衣',
    element: '疾风',
    moves: [move('eagle-toe-flash', '鹰爪闪光', 1.32, 12), move('eagle-tornado', '天鹰旋风', 1.52, 18)],
  },
  {
    id: 'ophiuchus',
    rank: 'silver',
    constellation: '蛇夫座',
    owner: '莎尔娜',
    label: '蛇夫座白银圣衣',
    element: '雷蛇',
    moves: [move('thunder-claw', '雷电蛇爪', 1.34, 12), move('cobra-snare', '毒蛇缠锁', 1.48, 17)],
  },
  {
    id: 'lizard',
    rank: 'silver',
    constellation: '蜥蜴座',
    owner: '美斯狄',
    label: '蜥蜴座白银圣衣',
    element: '气流',
    moves: [move('marble-triperr', '云石旋风', 1.3, 11), move('air-shield', '气流护壁', 1.02, 8, 'guard')],
  },
  {
    id: 'perseus',
    rank: 'silver',
    constellation: '英仙座',
    owner: '亚鲁哥路',
    label: '英仙座白银圣衣',
    element: '石化',
    moves: [move('medusa-shield', '美杜莎盾', 1.4, 16), move('perseus-lance', '英仙刺击', 1.5, 18)],
  },
  {
    id: 'whale',
    rank: 'silver',
    constellation: '白鲸座',
    owner: '摩西斯',
    label: '白鲸座白银圣衣',
    element: '重压',
    moves: [move('kaitos-spouting-bomber', '白鲸喷射轰击', 1.38, 14), move('whale-press', '白鲸重压', 1.56, 20)],
  },
  {
    id: 'centaurus',
    rank: 'silver',
    constellation: '半人马座',
    owner: '巴别',
    label: '半人马座白银圣衣',
    element: '火焰',
    moves: [move('photia-roufihtra', '烈焰漩涡', 1.34, 13), move('centaur-charge', '半人马冲击', 1.5, 18)],
  },
  {
    id: 'crow',
    rank: 'silver',
    constellation: '乌鸦座',
    owner: '贾米安',
    label: '乌鸦座白银圣衣',
    element: '黑羽',
    moves: [move('black-wing-shaft', '黑翼突袭', 1.28, 11), move('crow-flock', '乌鸦群舞', 1.46, 16)],
  },
  {
    id: 'cerberus',
    rank: 'silver',
    constellation: '地狱犬座',
    owner: '达狄',
    label: '地狱犬座白银圣衣',
    element: '锁链',
    moves: [move('cerberus-chain', '地狱犬锁链', 1.32, 12), move('hades-bite', '冥犬咬击', 1.52, 18)],
  },
  {
    id: 'auriga',
    rank: 'silver',
    constellation: '御夫座',
    owner: '加比拉',
    label: '御夫座白银圣衣',
    element: '飞轮',
    moves: [move('saucer-attack', '飞轮攻击', 1.35, 13), move('auriga-disc', '御夫圆盘阵', 1.55, 19)],
  },
  {
    id: 'hercules',
    rank: 'silver',
    constellation: '武仙座',
    owner: '亚路杰狄',
    label: '武仙座白银圣衣',
    element: '怪力',
    moves: [move('hercules-might', '武仙怪力拳', 1.4, 14), move('kornephoros', '巨人冲撞', 1.62, 22)],
  },
  {
    id: 'hound',
    rank: 'silver',
    constellation: '猎犬座',
    owner: '亚狄里安',
    label: '猎犬座白银圣衣',
    element: '追踪',
    moves: [move('million-ghost-attack', '百万幽灵攻击', 1.42, 17), move('hound-fang', '猎犬牙突', 1.48, 16)],
  },
  {
    id: 'muscidae',
    rank: 'silver',
    constellation: '苍蝇座',
    owner: '迪奥',
    label: '苍蝇座白银圣衣',
    element: '扰乱',
    moves: [move('dead-end-fly', '苍蝇死角', 1.25, 10), move('fly-swarm', '群蝇扰乱', 1.44, 16)],
  },
];

export const SAINT_SEIYA_GOLD_CLOTHS: SaintCloth[] = [
  {
    id: 'aries',
    rank: 'gold',
    constellation: '白羊座',
    owner: '穆',
    label: '白羊座黄金圣衣',
    element: '星屑',
    moves: [move('crystal-wall', '水晶墙', 1, 10, 'guard'), move('starlight-extinction', '星光灭绝', 1.8, 26), move('stardust-revolution', '星屑旋转功', 2.05, 34, 'ultimate')],
  },
  {
    id: 'taurus',
    rank: 'gold',
    constellation: '金牛座',
    owner: '阿鲁迪巴',
    label: '金牛座黄金圣衣',
    element: '巨角',
    moves: [move('great-horn', '巨型号角', 1.95, 30, 'ultimate'), move('bull-charge', '金牛冲撞', 1.58, 22)],
  },
  {
    id: 'gemini',
    rank: 'gold',
    constellation: '双子座',
    owner: '撒加',
    label: '双子座黄金圣衣',
    element: '银河',
    moves: [move('galaxian-explosion', '银河星爆', 2.12, 36, 'ultimate'), move('another-dimension', '异次元空间', 1.78, 28), move('genro-mao-ken', '幻胧魔皇拳', 1.72, 26)],
  },
  {
    id: 'cancer',
    rank: 'gold',
    constellation: '巨蟹座',
    owner: '迪斯马斯克',
    label: '巨蟹座黄金圣衣',
    element: '冥界',
    moves: [move('sekishiki-meikaiha', '积尸气冥界波', 1.9, 30, 'ultimate'), move('crab-claw', '巨蟹钳击', 1.52, 20)],
  },
  {
    id: 'leo',
    rank: 'gold',
    constellation: '狮子座',
    owner: '艾欧里亚',
    label: '狮子座黄金圣衣',
    element: '雷光',
    moves: [move('lightning-bolt', '闪电光速拳', 1.7, 24), move('lightning-plasma', '等离子光速拳', 2.05, 34, 'ultimate')],
  },
  {
    id: 'virgo',
    rank: 'gold',
    constellation: '处女座',
    owner: '沙加',
    label: '处女座黄金圣衣',
    element: '六道',
    moves: [move('tenma-kofuku', '天魔降伏', 1.78, 26), move('rikudo-rinne', '六道轮回', 1.86, 30), move('tenbu-horin', '天舞宝轮', 2.12, 38, 'ultimate')],
  },
  {
    id: 'libra',
    rank: 'gold',
    constellation: '天秤座',
    owner: '童虎',
    label: '天秤座黄金圣衣',
    element: '百龙',
    moves: [move('rozan-hyakuryuha-gold', '庐山百龙霸', 2.08, 35, 'ultimate'), move('libra-shield', '天秤守护', 1.05, 12, 'guard')],
  },
  {
    id: 'scorpio',
    rank: 'gold',
    constellation: '天蝎座',
    owner: '米罗',
    label: '天蝎座黄金圣衣',
    element: '赤针',
    moves: [move('scarlet-needle', '猩红毒针', 1.72, 24), move('antares', '安达里士', 2.08, 36, 'ultimate')],
  },
  {
    id: 'sagittarius',
    rank: 'gold',
    constellation: '射手座',
    owner: '艾俄洛斯',
    label: '射手座黄金圣衣',
    element: '黄金箭',
    moves: [move('golden-arrow', '黄金箭', 2.1, 36, 'ultimate'), move('atomic-thunderbolt', '原子闪电光速拳', 1.86, 28)],
  },
  {
    id: 'capricorn',
    rank: 'gold',
    constellation: '山羊座',
    owner: '修罗',
    label: '山羊座黄金圣衣',
    element: '圣剑',
    moves: [move('excalibur', '圣剑', 2.02, 34, 'ultimate'), move('jumping-stone', '跳跃石', 1.68, 24)],
  },
  {
    id: 'aquarius',
    rank: 'gold',
    constellation: '水瓶座',
    owner: '卡妙',
    label: '水瓶座黄金圣衣',
    element: '绝对零度',
    moves: [move('diamond-dust-gold', '钻石星尘拳', 1.68, 24), move('aurora-execution', '曙光女神之宽恕', 2.12, 38, 'ultimate'), move('freezing-coffin-gold', '冰柩', 1.78, 28)],
  },
  {
    id: 'pisces',
    rank: 'gold',
    constellation: '双鱼座',
    owner: '阿布罗狄',
    label: '双鱼座黄金圣衣',
    element: '玫瑰',
    moves: [move('royal-demon-rose', '皇家魔宫玫瑰', 1.72, 24), move('piranhan-rose', '食人鱼玫瑰', 1.88, 30), move('bloody-rose', '血腥玫瑰', 2.08, 36, 'ultimate')],
  },
];

export const SAINT_SEIYA_CLOTHS: SaintCloth[] = [
  ...SAINT_SEIYA_BRONZE_CLOTHS,
  ...SAINT_SEIYA_SILVER_CLOTHS,
  ...SAINT_SEIYA_GOLD_CLOTHS,
];

export type SaintClothId = (typeof SAINT_SEIYA_CLOTHS)[number]['id'];

export const SAINT_SEIYA_CLOTH_BY_ID: Record<string, SaintCloth> = Object.fromEntries(
  SAINT_SEIYA_CLOTHS.map((cloth) => [cloth.id, cloth]),
);

export function clothRankSortValue(rank: SaintClothRank) {
  if (rank === 'gold') return 3;
  if (rank === 'silver') return 2;
  return 1;
}

export function clothRankLabel(rank: SaintClothRank) {
  return SAINT_CLOTH_RANK_LABEL[rank] || '圣衣';
}

export function getClothsByRank(rank: SaintClothRank) {
  return SAINT_SEIYA_CLOTHS.filter((cloth) => cloth.rank === rank);
}

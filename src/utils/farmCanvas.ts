import type {
  FarmAnimalKind,
  FarmAnimalMood,
  FarmAnimalProductId,
  FarmAnimalState,
  FarmCanvasInventory,
  FarmCanvasObject,
  FarmCanvasResources,
  FarmCanvasState,
  FarmCanvasStats,
  FarmCropId,
  FarmDecorObjectType,
  FarmSelectedResourceDecor,
  FarmCropStage,
  FarmCropState,
  FarmDailySummary,
  FarmEventKind,
  FarmEventLogItem,
  FarmFestivalTask,
  FarmLongTermGoal,
  FarmNpcRequestKind,
  FarmNpcVisitState,
  FarmNpcVisitorId,
  FarmObjectKind,
  FarmOrder,
  FarmOrderReward,
  FarmRareEventId,
  FarmRareEventState,
  FarmSeason,
  FarmTool,
  FarmWeather,
} from '../types/canvas';

export const FARM_CANVAS_VERSION = 1;
export const FARM_GRID_SIZE = 64;
export const MAX_FARM_OBJECTS = 1500;
export const MAX_FARM_ORDERS = 12;
export const MAX_FARM_EVENT_LOG = 50;
export const FARM_VIEWPORT_RENDER_MARGIN = FARM_GRID_SIZE * 4;
export const BASE_FARM_DAILY_WATER = 20;
export const FARM_WATER_PER_WELL = 12;
export const FARM_STORAGE_BONUS_PER_BUILDING = 20;
export const FARM_SCARECROW_RADIUS_CELLS = 6;
export const FARM_DEFAULT_DECOR_ID = 'stone-path';
export const FARM_STARTER_DECOR_IDS = [FARM_DEFAULT_DECOR_ID, 'flower-bed', 'lantern', 'sign', 'hay-bale'];
export const FARM_FESTIVAL_ORDER_GOLD_MULTIPLIER = 1.25;
export const FARM_FESTIVAL_TASK_ORDER_TARGET = 1;
export const FARM_SEASON_DAYS = 28;
export const MAX_FARM_ANIMALS = 24;
const MAX_FARM_FESTIVAL_TASKS = 12;
const MAX_FARM_NPC_VISITS = 16;
const MAX_FARM_RARE_EVENTS = 24;
export const FARM_RESOURCE_DECOR_OBJECT_TYPES: FarmDecorObjectType[] = ['sign', 'banner', 'poster-wall', 'tile'];
export const FARM_RESOURCE_DECOR_TYPE_TO_DECOR_ID: Record<FarmDecorObjectType, string> = {
  sign: 'resource-sign',
  banner: 'resource-banner',
  'poster-wall': 'resource-poster-wall',
  tile: 'resource-tile',
};
const FARM_RESOURCE_DECOR_IDS = new Set(Object.values(FARM_RESOURCE_DECOR_TYPE_TO_DECOR_ID));

export const FARM_SEASON_ORDER: FarmSeason[] = ['spring', 'summer', 'autumn', 'winter'];

export interface FarmCropDefinition {
  id: FarmCropId;
  label: string;
  growthDays: number;
  seedCost: number;
  sellPrice: number;
  regrowDays?: number;
}

export interface FarmBuildingDefinition {
  id: string;
  label: string;
  description: string;
  widthCells: number;
  heightCells: number;
  cost: Partial<Pick<FarmCanvasResources, 'gold' | 'wood' | 'stone'>>;
}

export interface FarmDecorDefinition {
  id: string;
  label: string;
  category: 'fence' | 'path' | 'flower' | 'light' | 'sign' | 'storage';
  description: string;
  resourceOnly?: boolean;
  unlockHint?: string;
}

export interface FarmAnimalDefinition {
  id: FarmAnimalKind;
  label: string;
  productId: FarmAnimalProductId;
  productLabel: string;
  dailyAmount: number;
  moodHint: string;
}

export interface FarmNpcVisitorDefinition {
  id: FarmNpcVisitorId;
  name: string;
  role: string;
  greeting: string;
}

export interface FarmRareEventDefinition {
  id: FarmRareEventId;
  title: string;
  message: string;
  rewards: FarmOrderReward;
}

export interface FarmSeasonDefinition {
  id: FarmSeason;
  label: string;
  shortLabel: string;
  themeLabel: string;
  hint: string;
  cropHint: string;
}

export interface FarmToolAction {
  tool: FarmTool;
  x: number;
  y: number;
  screenX?: number;
  screenY?: number;
  id?: string;
  cropId?: FarmCropId;
  buildingId?: string;
  decorId?: string;
  resourceId?: string;
  skinId?: string;
  objectType?: FarmDecorObjectType;
}

export interface FarmToolResult {
  state: FarmCanvasState;
  changed: boolean;
  feedback: string;
  error?: FarmToolError;
}

export type FarmPlacementPreviewStatus = 'ready' | 'blocked' | 'insufficient-resources' | 'invalid';

export interface FarmPlacementPreview {
  tool: Extract<FarmTool, 'build' | 'decor'>;
  kind: Extract<FarmObjectKind, 'building' | 'decor'>;
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  width: number;
  height: number;
  canPlace: boolean;
  status: FarmPlacementPreviewStatus;
  label: string;
  feedback: string;
  effectPreview?: string;
  reason?: FarmToolError;
  buildingId?: string;
  decorId?: string;
  missingResources?: Partial<Pick<FarmCanvasResources, 'gold' | 'wood' | 'stone'>>;
}

export interface FarmBuildingEffects {
  huts: number;
  storages: number;
  wells: number;
  boards: number;
  scarecrows: number;
  totalBuildings: number;
  dailyWaterCapacity: number;
  storageCapacityBonus: number;
  scarecrowRadiusCells: number;
  hasOrderBoard: boolean;
}

export type FarmMiniMapMarkerKind = 'mature' | 'dry' | 'withered' | 'building' | 'path' | 'order' | 'npc' | 'rare' | 'animal' | 'cluster';
export type FarmMiniMapClusterChildKind = Exclude<FarmMiniMapMarkerKind, 'cluster'>;
export type FarmMiniMapRouteHintTarget = 'water' | 'withered-crop' | 'ready-order' | 'ready-npc' | 'mature-crop' | 'rare-event' | 'scarecrow-risk' | 'day' | 'beauty' | 'building-yield-summary';

export interface FarmMiniMapMarker {
  id: string;
  kind: FarmMiniMapMarkerKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  objectId?: string;
  orderId?: string;
  npcVisitId?: string;
  visitorId?: FarmNpcVisitorId;
  rareEventId?: string;
  animalId?: string;
  clusterCount?: number;
  clusterKinds?: FarmMiniMapClusterChildKind[];
  routeTargets?: FarmMiniMapRouteHintTarget[];
}

export type FarmFocusGoalKind = 'urgent' | 'growth' | 'reward' | 'social' | 'build' | 'decorate' | 'season';

export type FarmFocusGoalAction =
  | { kind: 'select-tool'; tool: FarmTool }
  | { kind: 'jump-mature' }
  | { kind: 'complete-order'; orderId: string }
  | { kind: 'complete-npc'; visitId: string }
  | { kind: 'select-building'; buildingId: string }
  | { kind: 'select-decor'; decorId: string }
  | { kind: 'advance-day' };

export interface FarmFocusGoal {
  id: string;
  kind: FarmFocusGoalKind;
  title: string;
  detail: string;
  progress: number;
  target: number;
  percent: number;
  actionLabel: string;
  action: FarmFocusGoalAction;
  ready?: boolean;
}

export type FarmBeautyFactorId = 'paths' | 'flowers' | 'fences' | 'lights' | 'buildings' | 'resourceDecor';

export interface FarmBeautyFactor {
  id: FarmBeautyFactorId;
  label: string;
  current: number;
  target: number;
  points: number;
  maxPoints: number;
  done: boolean;
}

export interface FarmBeautyScore {
  score: number;
  level: number;
  title: string;
  summary: string;
  nextHint: string;
  factors: FarmBeautyFactor[];
}

export type FarmBeautyRewardId =
  | 'wooden-nameplate'
  | 'flower-sticker'
  | 'lantern-trim'
  | 'village-postcard'
  | 'festival-arch';

export interface FarmBeautyRewardDefinition {
  id: FarmBeautyRewardId;
  level: number;
  threshold: number;
  title: string;
  badgeLabel: string;
  description: string;
}

export interface FarmBeautyReward extends FarmBeautyRewardDefinition {
  unlocked: boolean;
  remainingScore: number;
}

export type FarmToolError =
  | 'blocked'
  | 'missing-plot'
  | 'already-tilled'
  | 'already-planted'
  | 'missing-seed'
  | 'missing-water'
  | 'not-ready'
  | 'empty'
  | 'unknown-crop'
  | 'unknown-building'
  | 'decor-locked'
  | 'insufficient-resources'
  | 'order-completed'
  | 'order-requirements-missing'
  | 'order-not-found';

export interface FarmViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FarmEventInput {
  kind: FarmEventKind;
  message?: string;
  amount?: number;
  cropId?: FarmCropId;
  objectKind?: FarmObjectKind;
  orderId?: string;
  npcVisitId?: string;
  rareEventId?: string;
}

export type FarmActivityTone = 'soil' | 'water' | 'reward' | 'build' | 'quest' | 'rare' | 'day' | 'neutral';

export interface FarmActivityFeedItem {
  id: string;
  kind: FarmEventKind;
  day: number;
  title: string;
  detail: string;
  tagLabel: string;
  amountLabel?: string;
  rewardLabel?: string;
  tone: FarmActivityTone;
}

export interface FarmActivityFeed {
  items: FarmActivityFeedItem[];
  todayTotal: number;
  todayRewardTotal: number;
  summary: string;
  emptyHint: string;
}

export type FarmActivityDigestTone = 'quiet' | 'steady' | 'busy' | 'reward';
export type FarmActivityRewardStreakTier = 'sprout' | 'harvest' | 'festival';
export type FarmActivityRewardStreakActionKind = 'harvest' | 'order' | 'npc' | 'decorate' | 'festival';
export type FarmActivityRewardStreakChestState = 'warming' | 'ready';
export type FarmActivityRewardStreakChestTrailState = 'done' | 'active' | 'next';

export interface FarmActivityDigestChip {
  id: string;
  label: string;
  count: number;
  tone: FarmActivityTone;
}

export interface FarmActivityRewardStreakChestTrailItem {
  tier: FarmActivityRewardStreakTier;
  label: string;
  progressLabel: string;
  state: FarmActivityRewardStreakChestTrailState;
  rewardLabel: string;
  shortRewardLabel: string;
}

export interface FarmActivityDigest {
  todayTotal: number;
  todayRewardTotal: number;
  rewardStreak: number;
  rewardStreakLabel?: string;
  rewardStreakHint?: string;
  rewardStreakTier?: FarmActivityRewardStreakTier;
  rewardStreakMilestoneLabel?: string;
  rewardStreakMilestoneTarget?: number;
  rewardStreakMilestonePercent?: number;
  rewardStreakMilestoneProgressLabel?: string;
  rewardStreakMilestoneCompletionLabel?: string;
  rewardStreakMilestoneRewardLabel?: string;
  rewardStreakMilestoneRewardItems?: string[];
  rewardStreakActionKind?: FarmActivityRewardStreakActionKind;
  rewardStreakActionShortLabel?: string;
  rewardStreakActionLabel?: string;
  rewardStreakAction?: FarmFocusGoalAction;
  rewardStreakChestState?: FarmActivityRewardStreakChestState;
  rewardStreakChestTier?: FarmActivityRewardStreakTier;
  rewardStreakChestLabel?: string;
  rewardStreakChestShortLabel?: string;
  rewardStreakChestProgressLabel?: string;
  rewardStreakChestRewardLabel?: string;
  rewardStreakChestCtaLabel?: string;
  rewardStreakChestClaimLabel?: string;
  rewardStreakChestNextLabel?: string;
  rewardStreakChestRewardItems?: string[];
  rewardStreakChestBurstLabel?: string;
  rewardStreakChestOpenedSummaryLabel?: string;
  rewardStreakChestPercent?: number;
  rewardStreakChestMeterLabel?: string;
  rewardStreakChestRemaining?: number;
  rewardStreakChestRemainingLabel?: string;
  rewardStreakChestTrailLabel?: string;
  rewardStreakChestTrailRewardLabel?: string;
  rewardStreakChestTrailItems?: FarmActivityRewardStreakChestTrailItem[];
  rewardStreakChestActiveTrailLabel?: string;
  rewardStreakChestActiveRewardLabel?: string;
  rewardStreakChestActiveHint?: string;
  rewardStreakChestNextRewardLabel?: string;
  rewardStreakChestChargeLabel?: string;
  rewardStreakChestChargeShortLabel?: string;
  rewardStreakChestChargeHint?: string;
  target: number;
  percent: number;
  tone: FarmActivityDigestTone;
  badgeLabel: string;
  headline: string;
  nextHint: string;
  chips: FarmActivityDigestChip[];
}

export const FARM_CROP_DEFINITIONS: Record<FarmCropId, FarmCropDefinition> = {
  turnip: { id: 'turnip', label: '萝卜', growthDays: 2, seedCost: 10, sellPrice: 22 },
  potato: { id: 'potato', label: '土豆', growthDays: 3, seedCost: 16, sellPrice: 38 },
  tomato: { id: 'tomato', label: '番茄', growthDays: 4, seedCost: 30, sellPrice: 24, regrowDays: 2 },
  sunflower: { id: 'sunflower', label: '向日葵', growthDays: 3, seedCost: 20, sellPrice: 45 },
};

export const FARM_SEASON_DEFINITIONS: Record<FarmSeason, FarmSeasonDefinition> = {
  spring: {
    id: 'spring',
    label: '春季',
    shortLabel: '春',
    themeLabel: '春日播种',
    hint: '草芽和小花点亮牧场，适合开垦和扩张第一批田。',
    cropHint: '萝卜和向日葵更适合新手路线。',
  },
  summer: {
    id: 'summer',
    label: '夏季',
    shortLabel: '夏',
    themeLabel: '夏日集市',
    hint: '阳光更强，集市订单更热闹，记得多准备水量。',
    cropHint: '番茄适合连续经营，水井收益更明显。',
  },
  autumn: {
    id: 'autumn',
    label: '秋季',
    shortLabel: '秋',
    themeLabel: '丰收金穗',
    hint: '麦穗和落叶铺满田边，订单更偏向储备和丰收。',
    cropHint: '土豆和向日葵适合堆库存换材料。',
  },
  winter: {
    id: 'winter',
    label: '冬季',
    shortLabel: '冬',
    themeLabel: '冬灯牧场',
    hint: '雪边和暖灯让画布更安静，动物和建筑收益更重要。',
    cropHint: '保守种植，优先完成订单和照料动物。',
  },
};

export const FARM_ANIMAL_PRODUCT_DEFINITIONS: Record<FarmAnimalProductId, { id: FarmAnimalProductId; label: string }> = {
  egg: { id: 'egg', label: '鸡蛋' },
  milk: { id: 'milk', label: '牛奶' },
  wool: { id: 'wool', label: '羊毛' },
};

export const FARM_ANIMAL_DEFINITIONS: Record<FarmAnimalKind, FarmAnimalDefinition> = {
  chicken: {
    id: 'chicken',
    label: '小鸡',
    productId: 'egg',
    productLabel: FARM_ANIMAL_PRODUCT_DEFINITIONS.egg.label,
    dailyAmount: 1,
    moodHint: '会在每天清晨送来鸡蛋。',
  },
  cow: {
    id: 'cow',
    label: '奶牛',
    productId: 'milk',
    productLabel: FARM_ANIMAL_PRODUCT_DEFINITIONS.milk.label,
    dailyAmount: 1,
    moodHint: '每天产出一瓶牛奶。',
  },
  sheep: {
    id: 'sheep',
    label: '绵羊',
    productId: 'wool',
    productLabel: FARM_ANIMAL_PRODUCT_DEFINITIONS.wool.label,
    dailyAmount: 1,
    moodHint: '每天整理出一团羊毛。',
  },
};

export const FARM_NPC_VISITOR_DEFINITIONS: Record<FarmNpcVisitorId, FarmNpcVisitorDefinition> = {
  mira: {
    id: 'mira',
    name: '米拉',
    role: '种子店',
    greeting: '今天的集市缺一点新鲜蔬菜，可以帮我留一份吗？',
  },
  taro: {
    id: 'taro',
    name: '太郎',
    role: '木匠',
    greeting: '工坊早餐想加个鸡蛋，换你一些材料。',
  },
  lina: {
    id: 'lina',
    name: '莉娜',
    role: '花店',
    greeting: '花店想做一份暖汤，土豆正合适。',
  },
};

export const FARM_RARE_EVENT_DEFINITIONS: Record<FarmRareEventId, FarmRareEventDefinition> = {
  'giant-turnip': {
    id: 'giant-turnip',
    title: '巨大萝卜',
    message: '萝卜从土里拔出来时比木桶还大，村里都来围观。',
    rewards: { gold: 66, experience: 18, seeds: { turnip: 2 } },
  },
  'rainbow-sunflower': {
    id: 'rainbow-sunflower',
    title: '彩虹向日葵',
    message: '向日葵盘里闪出彩虹光，留下了稀有种子。',
    rewards: { gold: 88, experience: 24, seeds: { sunflower: 1 } },
  },
  'meteor-seed': {
    id: 'meteor-seed',
    title: '流星夜来信',
    message: '夜里掉下一封星光来信，夹着一粒番茄种子。',
    rewards: { experience: 20, seeds: { tomato: 1 } },
  },
};

export const FARM_BUILDING_DEFINITIONS: Record<string, FarmBuildingDefinition> = {
  hut: { id: 'hut', label: '小屋', description: '每日结算入口', widthCells: 3, heightCells: 3, cost: { gold: 180, wood: 8, stone: 4 } },
  storage: { id: 'storage', label: '仓库', description: '库存容量 +20', widthCells: 3, heightCells: 2, cost: { gold: 120, wood: 10, stone: 2 } },
  well: { id: 'well', label: '水井', description: '每日补水 +12', widthCells: 2, heightCells: 2, cost: { gold: 90, wood: 4, stone: 8 } },
  board: { id: 'board', label: '公告板', description: '优先显示可交付订单', widthCells: 2, heightCells: 1, cost: { gold: 60, wood: 4 } },
  scarecrow: { id: 'scarecrow', label: '稻草人', description: '守护半径 6 格', widthCells: 1, heightCells: 1, cost: { gold: 40, wood: 3 } },
};

export const FARM_DECOR_DEFINITIONS: Record<string, FarmDecorDefinition> = {
  'wood-fence': { id: 'wood-fence', label: '木栅栏', category: 'fence', description: '圈出田地边界', unlockHint: '完成新手萝卜订单解锁' },
  'stone-path': { id: 'stone-path', label: '石子小路', category: 'path', description: '铺出村道路网' },
  'flower-bed': { id: 'flower-bed', label: '花坛', category: 'flower', description: '点缀作物区域' },
  lantern: { id: 'lantern', label: '路灯', category: 'light', description: '夜晚高亮地块' },
  sign: { id: 'sign', label: '木牌', category: 'sign', description: '标记牧场区域' },
  'hay-bale': { id: 'hay-bale', label: '干草堆', category: 'storage', description: '谷仓杂物装饰' },
  'resource-sign': { id: 'resource-sign', label: '资源招牌', category: 'sign', description: '把资源库图片做成牧场木牌', resourceOnly: true },
  'resource-banner': { id: 'resource-banner', label: '资源旗帜', category: 'sign', description: '把资源库图片做成飘旗装饰', resourceOnly: true },
  'resource-poster-wall': { id: 'resource-poster-wall', label: '资源海报墙', category: 'sign', description: '把资源库图片做成墙面海报', resourceOnly: true },
  'resource-tile': { id: 'resource-tile', label: '资源地砖', category: 'path', description: '把资源库图片做成可铺设地砖', resourceOnly: true },
};

export const FARM_BEAUTY_REWARD_DEFINITIONS: FarmBeautyRewardDefinition[] = [
  {
    id: 'wooden-nameplate',
    level: 1,
    threshold: 0,
    title: '牧场木牌',
    badgeLabel: '木牌',
    description: '基础牧场手账木牌，开局即可使用。',
  },
  {
    id: 'flower-sticker',
    level: 2,
    threshold: 25,
    title: '花朵贴纸',
    badgeLabel: '花贴',
    description: '漂亮度达到起步牧场后，手账获得花朵贴纸反馈。',
  },
  {
    id: 'lantern-trim',
    level: 3,
    threshold: 45,
    title: '暖灯边框',
    badgeLabel: '暖灯',
    description: '漂亮度达到整洁小院后，奖励更温暖的夜间灯火感。',
  },
  {
    id: 'village-postcard',
    level: 4,
    threshold: 65,
    title: '村口明信片',
    badgeLabel: '明信片',
    description: '漂亮度达到人气牧场后，牧场像村民愿意寄出的明信片。',
  },
  {
    id: 'festival-arch',
    level: 5,
    threshold: 85,
    title: '四季拱门',
    badgeLabel: '拱门',
    description: '漂亮度达到四季名场后，解锁最高档节庆感反馈。',
  },
];

const FARM_WEATHERS: FarmWeather[] = ['sunny', 'cloudy', 'rainy', 'festival'];

function normalizeFarmSeason(value: unknown, day: number): FarmSeason {
  return FARM_SEASON_ORDER.includes(value as FarmSeason) ? value as FarmSeason : farmSeasonForDay(day);
}

export function farmSeasonForDay(dayInput: unknown): FarmSeason {
  const day = Math.round(clamp(dayInput, 1, 1, 999999));
  const index = Math.floor((day - 1) / FARM_SEASON_DAYS) % FARM_SEASON_ORDER.length;
  return FARM_SEASON_ORDER[index] || 'spring';
}

export function farmSeasonDay(dayInput: unknown) {
  const day = Math.round(clamp(dayInput, 1, 1, 999999));
  return ((day - 1) % FARM_SEASON_DAYS) + 1;
}

export function farmNextSeason(seasonInput: FarmSeason | undefined): FarmSeason {
  const season = FARM_SEASON_ORDER.includes(seasonInput as FarmSeason) ? seasonInput as FarmSeason : 'spring';
  const index = FARM_SEASON_ORDER.indexOf(season);
  return FARM_SEASON_ORDER[(index + 1) % FARM_SEASON_ORDER.length] || 'spring';
}

export function farmSeasonProgress(dayInput: unknown) {
  const dayInSeason = farmSeasonDay(dayInput);
  const season = farmSeasonForDay(dayInput);
  return {
    season,
    dayInSeason,
    daysTotal: FARM_SEASON_DAYS,
    nextSeason: farmNextSeason(season),
    percent: Math.round((dayInSeason / FARM_SEASON_DAYS) * 100),
  };
}

export function farmSeasonLabel(season: FarmSeason | undefined) {
  return FARM_SEASON_DEFINITIONS[season || 'spring']?.label || FARM_SEASON_DEFINITIONS.spring.label;
}

export function farmSeasonShortLabel(season: FarmSeason | undefined) {
  return FARM_SEASON_DEFINITIONS[season || 'spring']?.shortLabel || FARM_SEASON_DEFINITIONS.spring.shortLabel;
}

export function farmWeatherForDay(dayInput: unknown, season: FarmSeason = 'spring'): FarmWeather {
  const day = Math.round(clamp(dayInput, 1, 1, 999999));
  if (day % 7 === 0) return 'festival';
  if (day % 5 === 0) return 'rainy';
  if (day % 3 === 0) return 'cloudy';
  return season === 'winter' && day % 4 === 0 ? 'cloudy' : 'sunny';
}

export function farmFestivalIdForDay(dayInput: unknown, season: FarmSeason = 'spring') {
  const day = Math.round(clamp(dayInput, 1, 1, 999999));
  if (farmWeatherForDay(day, season) !== 'festival') return undefined;
  if (season === 'summer') return `summer-market-${day}`;
  if (season === 'autumn') return `harvest-fair-${day}`;
  if (season === 'winter') return `winter-lights-${day}`;
  return `spring-sowing-${day}`;
}

export function farmWeatherLabel(weather: FarmWeather | undefined) {
  if (weather === 'rainy') return '雨天';
  if (weather === 'cloudy') return '阴天';
  if (weather === 'festival') return '节庆';
  return '晴天';
}

export function farmWeatherShortLabel(weather: FarmWeather | undefined) {
  if (weather === 'rainy') return '雨';
  if (weather === 'cloudy') return '阴';
  if (weather === 'festival') return '庆';
  return '晴';
}

function farmSeasonFestivalLabel(season: FarmSeason) {
  if (season === 'summer') return '夏日集市';
  if (season === 'autumn') return '丰收祭';
  if (season === 'winter') return '冬灯会';
  return '春播祭';
}

function createFarmFestivalTask(festivalId: string, day: number, season: FarmSeason): FarmFestivalTask {
  const label = farmSeasonFestivalLabel(season);
  const rewards: FarmOrderReward = season === 'summer'
    ? { experience: 24, stone: 2, seeds: { tomato: 3 }, decorIds: [] }
    : season === 'autumn'
      ? { experience: 26, wood: 4, seeds: { potato: 2 }, decorIds: [] }
      : season === 'winter'
        ? { experience: 22, stone: 3, seeds: { turnip: 4 }, decorIds: [] }
        : { experience: 24, wood: 3, seeds: { sunflower: 2 }, decorIds: [] };
  return {
    id: `festival-task-${festivalId}`,
    festivalId,
    title: `${label}委托`,
    description: `D${day} 完成 1 个公告板订单，村里会送来额外谢礼。`,
    kind: 'complete-orders',
    target: FARM_FESTIVAL_TASK_ORDER_TARGET,
    progress: 0,
    rewards,
    completed: false,
  };
}

const FARM_EVENT_KINDS: FarmEventKind[] = [
  'plot_tilled',
  'crop_planted',
  'crop_watered',
  'crop_harvested',
  'order_completed',
  'npc_request_completed',
  'rare_event',
  'building_placed',
  'decor_placed',
  'day_advanced',
  'tool_feedback',
];

const DEFAULT_STATS: FarmCanvasStats = {
  plotsTilled: 0,
  cropsPlanted: 0,
  cropsWatered: 0,
  cropsHarvested: 0,
  ordersCompleted: 0,
  npcVisitsCompleted: 0,
  rareEventsFound: 0,
  objectsPlaced: 0,
  buildingsPlaced: 0,
  decorPlaced: 0,
  daysAdvanced: 0,
};

const DEFAULT_RESOURCES: FarmCanvasResources = {
  gold: 300,
  wood: 8,
  stone: 6,
  water: 20,
  experience: 0,
  seeds: {
    turnip: 12,
  },
};

const DEFAULT_INVENTORY: FarmCanvasInventory = {
  crops: {},
  animalProducts: {},
  decorIds: [],
};

const DEFAULT_ANIMALS: FarmAnimalState[] = [
  {
    id: 'starter-chicken',
    kind: 'chicken',
    name: '啾啾',
    mood: 'calm',
    placedDay: 1,
    productCount: 0,
  },
];

const DEFAULT_ORDERS: FarmOrder[] = [
  {
    id: 'tutorial-turnip-order',
    title: '新手萝卜订单',
    requirements: [{ kind: 'crop', cropId: 'turnip', amount: 3 }],
    rewards: { gold: 120, wood: 4, experience: 30, decorIds: ['wood-fence'] },
  },
  {
    id: 'potato-lunch-order',
    title: '午餐土豆订单',
    requirements: [{ kind: 'crop', cropId: 'potato', amount: 2 }],
    rewards: { gold: 150, stone: 3, experience: 36 },
  },
  {
    id: 'sunflower-fair-order',
    title: '集市向日葵订单',
    requirements: [{ kind: 'crop', cropId: 'sunflower', amount: 2 }],
    rewards: { gold: 180, experience: 44, seeds: { tomato: 4 } },
  },
];

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeGridSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 16) return FARM_GRID_SIZE;
  return Math.round(Math.min(256, parsed));
}

function cleanText(value: unknown, fallback = '', maxLength = 120) {
  if (value == null) return fallback;
  const text = String(value).replace(/\0/g, '').trim();
  return text ? text.slice(0, maxLength) : fallback;
}

function cleanEventMessage(value: unknown) {
  return cleanText(value, '牧场有新动静', 120)
    .replace(/https?:\/\/\S+/gi, '[链接已隐藏]')
    .replace(/file:\/\/\S+/gi, '[路径已隐藏]')
    .replace(/[a-zA-Z]:\\[^\s]+/g, '[路径已隐藏]')
    .replace(/data:[^\s]+/gi, '[素材已隐藏]')
    .replace(/prompt\s*[:：][^，。;；]*/gi, '提示词已隐藏')
    .slice(0, 120);
}

function cleanId(value: unknown, fallback: string) {
  const text = cleanText(value, fallback, 96);
  return /^[a-zA-Z0-9:_-]+$/.test(text) ? text : fallback;
}

function cleanOptionalId(value: unknown) {
  const id = cleanId(value, '');
  return id || undefined;
}

function normalizeFarmBuildingId(value: unknown) {
  const id = cleanId(value, 'hut');
  return FARM_BUILDING_DEFINITIONS[id] ? id : 'hut';
}

function normalizeFarmDecorId(value: unknown) {
  const id = cleanId(value, FARM_DEFAULT_DECOR_ID);
  return FARM_DECOR_DEFINITIONS[id] ? id : FARM_DEFAULT_DECOR_ID;
}

export function isFarmResourceDecorObjectType(value: unknown): value is FarmDecorObjectType {
  return typeof value === 'string' && FARM_RESOURCE_DECOR_OBJECT_TYPES.includes(value as FarmDecorObjectType);
}

function normalizeFarmDecorObjectType(value: unknown): FarmDecorObjectType | undefined {
  return isFarmResourceDecorObjectType(value) ? value : undefined;
}

export function farmDecorIdForResourceObjectType(value: unknown): string {
  const objectType = normalizeFarmDecorObjectType(value) || 'sign';
  return FARM_RESOURCE_DECOR_TYPE_TO_DECOR_ID[objectType];
}

function normalizeSelectedResourceDecor(value: unknown): FarmSelectedResourceDecor | undefined {
  const input = value && typeof value === 'object' ? value as Partial<FarmSelectedResourceDecor> : undefined;
  if (!input) return undefined;
  const objectType = normalizeFarmDecorObjectType(input.objectType);
  const resourceId = cleanOptionalId(input.resourceId);
  if (!objectType || !resourceId || /^data:/i.test(String(input.resourceId))) return undefined;
  return {
    resourceId,
    skinId: cleanId(input.skinId, `resource-${objectType}`),
    objectType,
  };
}

function isFarmCropId(value: unknown): value is FarmCropId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FARM_CROP_DEFINITIONS, value);
}

function isFarmAnimalKind(value: unknown): value is FarmAnimalKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FARM_ANIMAL_DEFINITIONS, value);
}

function isFarmAnimalProductId(value: unknown): value is FarmAnimalProductId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FARM_ANIMAL_PRODUCT_DEFINITIONS, value);
}

function isFarmNpcVisitorId(value: unknown): value is FarmNpcVisitorId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FARM_NPC_VISITOR_DEFINITIONS, value);
}

function isFarmRareEventId(value: unknown): value is FarmRareEventId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FARM_RARE_EVENT_DEFINITIONS, value);
}

function normalizeFarmNpcRequestKind(value: unknown): FarmNpcRequestKind {
  return value === 'animal-product' ? 'animal-product' : 'crop';
}

function isFarmObjectKind(value: unknown): value is FarmObjectKind {
  return value === 'plot' || value === 'building' || value === 'decor' || value === 'path' || value === 'obstacle';
}

function normalizeEventKind(value: unknown): FarmEventKind {
  return FARM_EVENT_KINDS.includes(value as FarmEventKind) ? value as FarmEventKind : 'tool_feedback';
}

function normalizeFarmWeather(value: unknown, day: number, season: FarmSeason): FarmWeather {
  return FARM_WEATHERS.includes(value as FarmWeather) ? value as FarmWeather : farmWeatherForDay(day, season);
}

function normalizeSeedBag(value: unknown): Partial<Record<FarmCropId, number>> {
  const input = value && typeof value === 'object' ? value as Partial<Record<FarmCropId, unknown>> : {};
  const seeds: Partial<Record<FarmCropId, number>> = {};
  (Object.keys(FARM_CROP_DEFINITIONS) as FarmCropId[]).forEach((cropId) => {
    const amount = Math.round(clamp(input[cropId], 0, 0, 9999));
    if (amount > 0) seeds[cropId] = amount;
  });
  return seeds;
}

function normalizeAnimalProductBag(value: unknown): Partial<Record<FarmAnimalProductId, number>> {
  const input = value && typeof value === 'object' ? value as Partial<Record<FarmAnimalProductId, unknown>> : {};
  const products: Partial<Record<FarmAnimalProductId, number>> = {};
  (Object.keys(FARM_ANIMAL_PRODUCT_DEFINITIONS) as FarmAnimalProductId[]).forEach((productId) => {
    const amount = Math.round(clamp(input[productId], 0, 0, 9999));
    if (amount > 0) products[productId] = amount;
  });
  return products;
}

function normalizeFarmAnimalMood(value: unknown): FarmAnimalMood {
  return value === 'happy' || value === 'hungry' || value === 'calm' ? value : 'calm';
}

function normalizeResources(value: unknown): FarmCanvasResources {
  const input = value && typeof value === 'object' ? value as Partial<FarmCanvasResources> : {};
  return {
    gold: Math.round(clamp(input.gold, DEFAULT_RESOURCES.gold, 0, 9999999)),
    wood: Math.round(clamp(input.wood, DEFAULT_RESOURCES.wood, 0, 999999)),
    stone: Math.round(clamp(input.stone, DEFAULT_RESOURCES.stone, 0, 999999)),
    water: Math.round(clamp(input.water, DEFAULT_RESOURCES.water, 0, 999)),
    experience: Math.round(clamp(input.experience, DEFAULT_RESOURCES.experience, 0, 9999999)),
    seeds: normalizeSeedBag(input.seeds || DEFAULT_RESOURCES.seeds),
  };
}

function normalizeInventory(value: unknown): FarmCanvasInventory {
  const input = value && typeof value === 'object' ? value as Partial<FarmCanvasInventory> : {};
  const cropInput = input.crops && typeof input.crops === 'object' ? input.crops as Partial<Record<FarmCropId, unknown>> : {};
  const crops: Partial<Record<FarmCropId, number>> = {};
  (Object.keys(FARM_CROP_DEFINITIONS) as FarmCropId[]).forEach((cropId) => {
    const amount = Math.round(clamp(cropInput[cropId], 0, 0, 9999));
    if (amount > 0) crops[cropId] = amount;
  });
  const decorIds = Array.isArray(input.decorIds)
    ? Array.from(new Set(input.decorIds.map((id, index) => cleanId(id, `decor-${index}`)))).slice(0, 200)
    : [];
  return { crops, animalProducts: normalizeAnimalProductBag(input.animalProducts), decorIds };
}

function normalizeStats(value: unknown): FarmCanvasStats {
  const input = value && typeof value === 'object' ? value as Partial<FarmCanvasStats> : {};
  return {
    plotsTilled: Math.round(clamp(input.plotsTilled, 0, 0, 999999)),
    cropsPlanted: Math.round(clamp(input.cropsPlanted, 0, 0, 999999)),
    cropsWatered: Math.round(clamp(input.cropsWatered, 0, 0, 999999)),
    cropsHarvested: Math.round(clamp(input.cropsHarvested, 0, 0, 999999)),
    ordersCompleted: Math.round(clamp(input.ordersCompleted, 0, 0, 999999)),
    npcVisitsCompleted: Math.round(clamp(input.npcVisitsCompleted, 0, 0, 999999)),
    rareEventsFound: Math.round(clamp(input.rareEventsFound, 0, 0, 999999)),
    objectsPlaced: Math.round(clamp(input.objectsPlaced, 0, 0, 999999)),
    buildingsPlaced: Math.round(clamp(input.buildingsPlaced, 0, 0, 999999)),
    decorPlaced: Math.round(clamp(input.decorPlaced, 0, 0, 999999)),
    daysAdvanced: Math.round(clamp(input.daysAdvanced, 0, 0, 999999)),
  };
}

function cloneOrders(orders = DEFAULT_ORDERS): FarmOrder[] {
  return orders.map((order) => ({
    id: order.id,
    title: order.title,
    requirements: order.requirements.map((requirement) => ({ ...requirement })),
    rewards: {
      ...order.rewards,
      seeds: order.rewards.seeds ? { ...order.rewards.seeds } : undefined,
      decorIds: order.rewards.decorIds ? [...order.rewards.decorIds] : undefined,
    },
    completed: order.completed === true,
  }));
}

function cloneDefaultAnimals(day = 1): FarmAnimalState[] {
  return DEFAULT_ANIMALS.map((animal) => ({
    ...animal,
    placedDay: Math.min(day, animal.placedDay),
  }));
}

function normalizeFarmAnimals(value: unknown, day: number): FarmAnimalState[] {
  if (!Array.isArray(value)) return cloneDefaultAnimals(day);
  return value
    .slice(0, MAX_FARM_ANIMALS)
    .map((item, index) => {
      const source = item && typeof item === 'object' ? item as Partial<FarmAnimalState> : {};
      if (!isFarmAnimalKind(source.kind)) return null;
      const definition = FARM_ANIMAL_DEFINITIONS[source.kind];
      const placedDay = Math.round(clamp(source.placedDay, day, 1, day));
      const lastProducedDay = source.lastProducedDay == null
        ? undefined
        : Math.round(clamp(source.lastProducedDay, placedDay, 1, day));
      return {
        id: cleanId(source.id, `farm-animal-${index}`),
        kind: source.kind,
        name: cleanEventMessage(source.name || definition.label).slice(0, 16),
        mood: normalizeFarmAnimalMood(source.mood),
        placedDay,
        ...(lastProducedDay ? { lastProducedDay } : {}),
        productCount: Math.round(clamp(source.productCount, 0, 0, 999999)),
      };
    })
    .filter((animal): animal is FarmAnimalState => Boolean(animal));
}

function normalizeFarmOrderReward(value: unknown): FarmOrderReward {
  const source = value && typeof value === 'object' ? value as FarmOrderReward : {};
  return {
    gold: Math.round(clamp(source.gold, 0, 0, 999999)),
    wood: Math.round(clamp(source.wood, 0, 0, 999999)),
    stone: Math.round(clamp(source.stone, 0, 0, 999999)),
    experience: Math.round(clamp(source.experience, 0, 0, 999999)),
    seeds: normalizeSeedBag(source.seeds),
    decorIds: Array.isArray(source.decorIds)
      ? source.decorIds
        .map((id, rewardIndex) => cleanId(id, `decor-reward-${rewardIndex}`))
        .filter((id) => Boolean(FARM_DECOR_DEFINITIONS[id]))
        .slice(0, 20)
      : [],
  };
}

function normalizeOrders(value: unknown): FarmOrder[] {
  const input = Array.isArray(value) ? value : DEFAULT_ORDERS;
  const orders: FarmOrder[] = [];
  input.slice(0, MAX_FARM_ORDERS).forEach((order, index) => {
    if (!order || typeof order !== 'object') return;
    const source = order as Partial<FarmOrder>;
    const requirements = Array.isArray(source.requirements)
      ? source.requirements
        .map((requirement) => {
          const item = requirement && typeof requirement === 'object'
            ? requirement as { kind?: unknown; cropId?: unknown; amount?: unknown }
            : {};
          if (item.kind !== 'crop' || !isFarmCropId(item.cropId)) return null;
          const amount = Math.round(clamp(item.amount, 1, 1, 999));
          return { kind: 'crop' as const, cropId: item.cropId, amount };
        })
        .filter((item): item is FarmOrder['requirements'][number] => Boolean(item))
      : [];
    if (requirements.length === 0) return;
    const rewards = normalizeFarmOrderReward(source.rewards);
    orders.push({
      id: cleanId(source.id, `farm-order-${index}`),
      title: cleanText(source.title, `牧场订单 ${index + 1}`, 80),
      requirements,
      rewards,
      completed: source.completed === true,
    });
  });
  return orders.length > 0 ? orders : cloneOrders();
}

function normalizeFestivalTasks(
  value: unknown,
  day: number,
  season: FarmSeason,
  weather: FarmWeather,
  festivalId?: string,
): FarmFestivalTask[] {
  const input = Array.isArray(value) ? value : [];
  const tasks: FarmFestivalTask[] = [];
  input.slice(0, MAX_FARM_FESTIVAL_TASKS).forEach((task, index) => {
    const source = task && typeof task === 'object' ? task as Partial<FarmFestivalTask> : {};
    const cleanFestivalId = cleanOptionalId(source.festivalId) || (festivalId || `festival-${day}`);
    const target = Math.round(clamp(source.target, FARM_FESTIVAL_TASK_ORDER_TARGET, 1, 9));
    const progress = Math.round(clamp(source.progress, 0, 0, target));
    const completed = source.completed === true || progress >= target;
    tasks.push({
      id: cleanId(source.id, `festival-task-${cleanFestivalId}-${index}`),
      festivalId: cleanFestivalId,
      title: cleanText(source.title, `${farmSeasonFestivalLabel(season)}委托`, 80),
      description: cleanEventMessage(source.description || `完成 ${target} 个公告板订单，领取节庆谢礼。`),
      kind: 'complete-orders',
      target,
      progress,
      rewards: normalizeFarmOrderReward(source.rewards),
      completed,
      completedDay: completed ? Math.round(clamp(source.completedDay, day, 1, 999999)) : undefined,
    });
  });
  if (weather === 'festival' && festivalId && !tasks.some((task) => task.festivalId === festivalId)) {
    tasks.unshift(createFarmFestivalTask(festivalId, day, season));
  }
  return tasks.slice(0, MAX_FARM_FESTIVAL_TASKS);
}

export function createFarmNpcVisitForDay(dayInput: unknown, season: FarmSeason = 'spring'): FarmNpcVisitState {
  const day = Math.round(clamp(dayInput, 1, 1, 999999));
  const slot = day % 3;
  const visitorId: FarmNpcVisitorId = slot === 0 ? 'taro' : slot === 1 ? 'mira' : 'lina';
  const visitor = FARM_NPC_VISITOR_DEFINITIONS[visitorId];
  const autumnPotatoReward = season === 'autumn' ? { seeds: { sunflower: 1 as const } } : {};
  if (visitorId === 'taro') {
    return {
      id: `npc-visit-${day}-${visitorId}`,
      visitorId,
      visitorName: visitor.name,
      day,
      title: `${visitor.role}来访：工坊早餐`,
      message: visitor.greeting,
      requestKind: 'animal-product',
      animalProductId: 'egg',
      amount: 1,
      rewards: { gold: 48, wood: 2, experience: 10 },
      completed: false,
    };
  }
  if (visitorId === 'lina') {
    return {
      id: `npc-visit-${day}-${visitorId}`,
      visitorId,
      visitorName: visitor.name,
      day,
      title: `${visitor.role}来访：暖汤材料`,
      message: visitor.greeting,
      requestKind: 'crop',
      cropId: 'potato',
      amount: 1,
      rewards: { gold: 54, experience: 12, ...autumnPotatoReward },
      completed: false,
    };
  }
  return {
    id: `npc-visit-${day}-${visitorId}`,
    visitorId,
    visitorName: visitor.name,
    day,
    title: `${visitor.role}来访：清晨蔬菜`,
    message: visitor.greeting,
    requestKind: 'crop',
    cropId: 'turnip',
    amount: 1,
    rewards: { gold: 36, experience: 8, seeds: { potato: 1 } },
    completed: false,
  };
}

function normalizeFarmNpcVisit(value: unknown, index: number, currentDay: number, season: FarmSeason): FarmNpcVisitState | null {
  const source = value && typeof value === 'object' ? value as Partial<FarmNpcVisitState> : {};
  const day = Math.round(clamp(source.day, currentDay, 1, currentDay));
  const fallback = createFarmNpcVisitForDay(day, season);
  const visitorId = isFarmNpcVisitorId(source.visitorId) ? source.visitorId : fallback.visitorId;
  const visitor = FARM_NPC_VISITOR_DEFINITIONS[visitorId];
  const requestKind = normalizeFarmNpcRequestKind(source.requestKind || fallback.requestKind);
  const cropId = isFarmCropId(source.cropId) ? source.cropId : fallback.cropId;
  const animalProductId = isFarmAnimalProductId(source.animalProductId) ? source.animalProductId : fallback.animalProductId;
  if (requestKind === 'crop' && !cropId) return null;
  if (requestKind === 'animal-product' && !animalProductId) return null;
  const amount = Math.round(clamp(source.amount, fallback.amount, 1, 99));
  const completed = source.completed === true;
  return {
    id: cleanId(source.id, `npc-visit-${day}-${visitorId}-${index}`),
    visitorId,
    visitorName: cleanEventMessage(source.visitorName || visitor.name).slice(0, 18),
    day,
    title: cleanText(source.title, fallback.title, 80),
    message: cleanEventMessage(source.message || fallback.message),
    requestKind,
    ...(requestKind === 'crop' ? { cropId } : { animalProductId }),
    amount,
    rewards: normalizeFarmOrderReward(source.rewards || fallback.rewards),
    completed,
    completedDay: completed ? Math.round(clamp(source.completedDay, day, 1, currentDay)) : undefined,
  };
}

function normalizeFarmNpcVisits(value: unknown, day: number, season: FarmSeason): FarmNpcVisitState[] {
  const input = Array.isArray(value) ? value : [];
  const visits = input
    .slice(0, MAX_FARM_NPC_VISITS)
    .map((visit, index) => normalizeFarmNpcVisit(visit, index, day, season))
    .filter((visit): visit is FarmNpcVisitState => Boolean(visit));
  if (!visits.some((visit) => visit.day === day)) {
    visits.unshift(createFarmNpcVisitForDay(day, season));
  }
  return visits
    .sort((a, b) => b.day - a.day || a.id.localeCompare(b.id))
    .slice(0, MAX_FARM_NPC_VISITS);
}

function farmStableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createFarmRareEvent(
  eventId: FarmRareEventId,
  day: number,
  cropId: FarmCropId | undefined,
  sourceId: string,
): FarmRareEventState {
  const definition = FARM_RARE_EVENT_DEFINITIONS[eventId];
  return {
    id: `rare-event-${day}-${eventId}-${cleanId(sourceId, 'farm')}`,
    eventId,
    title: definition.title,
    message: definition.message,
    day,
    ...(cropId ? { cropId } : {}),
    rewards: {
      ...definition.rewards,
      seeds: definition.rewards.seeds ? { ...definition.rewards.seeds } : undefined,
      decorIds: definition.rewards.decorIds ? [...definition.rewards.decorIds] : undefined,
    },
  };
}

export function createFarmRareHarvestEvent(
  stateInput: FarmCanvasState | undefined,
  objectInput: FarmCanvasObject | undefined,
  cropInput: FarmCropState | undefined,
): FarmRareEventState | undefined {
  if (!stateInput || !objectInput || !cropInput) return undefined;
  const state = sanitizeFarmCanvasState(stateInput);
  const object = state.objects.find((item) => item.id === objectInput.id) || objectInput;
  const crop = { ...cropInput, stage: cropStageForDays(cropInput) };
  if (crop.stage !== 'mature') return undefined;
  const definition = FARM_CROP_DEFINITIONS[crop.cropId];
  const source = `${state.season}:${state.weather}:${state.day}:${object.id}:${crop.cropId}:${crop.plantedDay}:${crop.daysGrown}:${crop.quality || 'normal'}`;
  const roll = farmStableHash(source) % 100;
  if (crop.quality === 'rainbow' || (crop.cropId === 'sunflower' && roll < 18)) {
    return createFarmRareEvent('rainbow-sunflower', state.day, crop.cropId, object.id);
  }
  if (crop.cropId === 'turnip' && (crop.daysGrown >= definition.growthDays + 2 || roll < 12)) {
    return createFarmRareEvent('giant-turnip', state.day, crop.cropId, object.id);
  }
  if (state.weather === 'festival' && roll < 24) {
    return createFarmRareEvent('meteor-seed', state.day, crop.cropId, object.id);
  }
  return undefined;
}

function normalizeFarmRareEvent(value: unknown, index: number, currentDay: number): FarmRareEventState | null {
  const source = value && typeof value === 'object' ? value as Partial<FarmRareEventState> : {};
  if (!isFarmRareEventId(source.eventId)) return null;
  const definition = FARM_RARE_EVENT_DEFINITIONS[source.eventId];
  const day = Math.round(clamp(source.day, currentDay, 1, currentDay));
  const cropId = isFarmCropId(source.cropId) ? source.cropId : undefined;
  return {
    id: cleanId(source.id, `rare-event-${day}-${source.eventId}-${index}`),
    eventId: source.eventId,
    title: cleanText(source.title, definition.title, 80),
    message: cleanEventMessage(source.message || definition.message),
    day,
    ...(cropId ? { cropId } : {}),
    rewards: normalizeFarmOrderReward(source.rewards || definition.rewards),
  };
}

function normalizeFarmRareEvents(value: unknown, day: number): FarmRareEventState[] {
  const input = Array.isArray(value) ? value : [];
  return input
    .slice(0, MAX_FARM_RARE_EVENTS)
    .map((event, index) => normalizeFarmRareEvent(event, index, day))
    .filter((event): event is FarmRareEventState => Boolean(event))
    .sort((a, b) => b.day - a.day || a.id.localeCompare(b.id))
    .slice(0, MAX_FARM_RARE_EVENTS);
}

function normalizeEventLog(value: unknown, fallbackDay: number): FarmEventLogItem[] {
  const input = Array.isArray(value) ? value : [];
  return input.slice(0, MAX_FARM_EVENT_LOG).map((item, index) => {
    const source = item && typeof item === 'object' ? item as Partial<FarmEventLogItem> : {};
    const day = Math.round(clamp(source.day, fallbackDay, 1, 999999));
    const event: FarmEventLogItem = {
      id: cleanId(source.id, `farm-event-${day}-${index}`),
      kind: normalizeEventKind(source.kind),
      day,
      message: cleanEventMessage(source.message),
      createdAt: Math.round(clamp(source.createdAt, day * 100000 + index, 1, 9999999999999)),
    };
    const amount = Math.round(clamp(source.amount, 0, -999999, 999999));
    if (amount !== 0) event.amount = amount;
    if (isFarmCropId(source.cropId)) event.cropId = source.cropId;
    if (isFarmObjectKind(source.objectKind)) event.objectKind = source.objectKind;
    if (source.orderId) event.orderId = cleanId(source.orderId, 'farm-order');
    if (source.npcVisitId) event.npcVisitId = cleanId(source.npcVisitId, 'npc-visit');
    if (source.rareEventId) event.rareEventId = cleanId(source.rareEventId, 'rare-event');
    return event;
  });
}

function normalizeDailySummary(value: unknown, fallbackDay: number): FarmDailySummary | undefined {
  const source = value && typeof value === 'object' ? value as Partial<FarmDailySummary> : undefined;
  if (!source) return undefined;
  const toDay = Math.round(clamp(source.toDay, fallbackDay, 1, 999999));
  const fromDay = Math.round(clamp(source.fromDay, Math.max(1, toDay - 1), 1, 999999));
  const weather = FARM_WEATHERS.includes(source.weather as FarmWeather)
    ? source.weather as FarmWeather
    : farmWeatherForDay(toDay);
  return {
    id: cleanId(source.id, `farm-summary-${fromDay}-${toDay}`),
    fromDay,
    toDay,
    weather,
    festivalId: weather === 'festival' ? cleanOptionalId(source.festivalId) || farmFestivalIdForDay(toDay) : undefined,
    message: cleanEventMessage(source.message),
    harvestedCrops: Math.round(clamp(source.harvestedCrops, 0, 0, 9999)),
    ordersCompleted: Math.round(clamp(source.ordersCompleted, 0, 0, 9999)),
    goldEarned: Math.round(clamp(source.goldEarned, 0, 0, 9999999)),
    rainWateredCrops: Math.round(clamp(source.rainWateredCrops, 0, 0, 9999)),
    festivalBonusGold: Math.round(clamp(source.festivalBonusGold, 0, 0, 9999999)),
    animalProductsProduced: Math.round(clamp(source.animalProductsProduced, 0, 0, 9999)),
    animalProductSummary: source.animalProductSummary ? cleanEventMessage(source.animalProductSummary) : undefined,
    npcVisitsCompleted: Math.round(clamp(source.npcVisitsCompleted, 0, 0, 9999)),
    rareEventsFound: Math.round(clamp(source.rareEventsFound, 0, 0, 9999)),
    rareEventSummary: source.rareEventSummary ? cleanEventMessage(source.rareEventSummary) : undefined,
    readyOrders: Math.round(clamp(source.readyOrders, 0, 0, 9999)),
    readyNpcVisits: Math.round(clamp(source.readyNpcVisits, 0, 0, 9999)),
    dailyWaterCapacity: Math.round(clamp(source.dailyWaterCapacity, 0, 0, 9999)),
    scarecrowProtectedCrops: Math.round(clamp(source.scarecrowProtectedCrops, 0, 0, 9999)),
    wateredCrops: Math.round(clamp(source.wateredCrops, 0, 0, 9999)),
    dryCrops: Math.round(clamp(source.dryCrops, 0, 0, 9999)),
    witheredCrops: Math.round(clamp(source.witheredCrops, 0, 0, 9999)),
    newMatureCrops: Math.round(clamp(source.newMatureCrops, 0, 0, 9999)),
    matureCrops: Math.round(clamp(source.matureCrops, 0, 0, 9999)),
    nextMatureCrops: Math.round(clamp(source.nextMatureCrops, 0, 0, 9999)),
    highlights: Array.isArray(source.highlights)
      ? source.highlights.map((item) => cleanEventMessage(item)).filter(Boolean).slice(0, 5)
      : [],
    createdAt: Math.round(clamp(source.createdAt, toDay * 100000, 1, 9999999999999)),
  };
}

export function snapFarmPoint(point: { x: number; y: number }, gridSize = FARM_GRID_SIZE) {
  const grid = normalizeGridSize(gridSize);
  const x = clamp(point.x, 0, -2000000, 2000000);
  const y = clamp(point.y, 0, -2000000, 2000000);
  return {
    x: Math.floor(x / grid) * grid,
    y: Math.floor(y / grid) * grid,
  };
}

export function farmToolSupportsContinuousAction(tool: FarmTool) {
  return tool === 'hoe'
    || tool === 'seed'
    || tool === 'water'
    || tool === 'harvest'
    || tool === 'shovel'
    || tool === 'delete'
    || tool === 'decor';
}

export function farmToolActionGridKey(action: Pick<FarmToolAction, 'tool' | 'x' | 'y'>, gridSize = FARM_GRID_SIZE) {
  const point = snapFarmPoint({ x: action.x, y: action.y }, gridSize);
  return `${action.tool}:${point.x}:${point.y}`;
}

function makeId(prefix: string, state: FarmCanvasState, extra = state.objects.length + 1) {
  return `${prefix}-${state.day}-${extra}`;
}

function makeEventStamp(state: FarmCanvasState) {
  const newest = state.eventLog.reduce((max, event) => Math.max(max, event.createdAt || 0), state.day * 100000);
  return Math.max(newest + 1, state.day * 100000 + 1);
}

function rectOf(object: Pick<FarmCanvasObject, 'x' | 'y' | 'widthCells' | 'heightCells'>, gridSize = FARM_GRID_SIZE) {
  return {
    x: object.x,
    y: object.y,
    width: Math.max(1, object.widthCells) * gridSize,
    height: Math.max(1, object.heightCells) * gridSize,
  };
}

function rectsOverlap(a: ReturnType<typeof rectOf>, b: ReturnType<typeof rectOf>) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function findObjectAt(state: FarmCanvasState, x: number, y: number, kinds?: FarmObjectKind[]) {
  const point = snapFarmPoint({ x, y }, state.gridSize);
  return state.objects.find((object) => {
    if (kinds && !kinds.includes(object.kind)) return false;
    const rect = rectOf(object, state.gridSize);
    return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
  });
}

function hasBlockingObject(state: FarmCanvasState, candidate: Pick<FarmCanvasObject, 'x' | 'y' | 'widthCells' | 'heightCells'>, ignoreId?: string) {
  return Boolean(findBlockingObject(state, candidate, ignoreId));
}

function findBlockingObject(state: FarmCanvasState, candidate: Pick<FarmCanvasObject, 'x' | 'y' | 'widthCells' | 'heightCells'>, ignoreId?: string) {
  const candidateRect = rectOf(candidate, state.gridSize);
  return state.objects.find((object) => {
    if (object.id === ignoreId) return false;
    if (object.kind === 'path') return false;
    return rectsOverlap(candidateRect, rectOf(object, state.gridSize));
  });
}

function cropStageForDays(crop: FarmCropState): FarmCropStage {
  if (crop.stage === 'withered' || crop.dryDays >= 3) return 'withered';
  const definition = FARM_CROP_DEFINITIONS[crop.cropId];
  if (crop.daysGrown >= definition.growthDays) return 'mature';
  const ratio = crop.daysGrown / Math.max(1, definition.growthDays);
  if (ratio >= 0.72) return 'flowering';
  if (ratio >= 0.38) return 'growing';
  if (crop.daysGrown > 0) return 'sprout';
  return 'seed';
}

function normalizeCrop(value: unknown, fallbackDay: number): FarmCropState | undefined {
  const input = value && typeof value === 'object' ? value as Partial<FarmCropState> : {};
  if (!isFarmCropId(input.cropId)) return undefined;
  const crop: FarmCropState = {
    cropId: input.cropId,
    plantedDay: Math.round(clamp(input.plantedDay, fallbackDay, 1, 999999)),
    daysGrown: Math.round(clamp(input.daysGrown, 0, 0, 9999)),
    wateredToday: input.wateredToday === true,
    dryDays: Math.round(clamp(input.dryDays, 0, 0, 99)),
    stage: input.stage === 'withered' ? 'withered' : 'seed',
    quality: input.quality === 'silver' || input.quality === 'gold' || input.quality === 'rainbow'
      ? input.quality
      : 'normal',
  };
  return { ...crop, stage: cropStageForDays(crop) };
}

function normalizeObject(value: unknown, index: number, fallbackDay: number, gridSize = FARM_GRID_SIZE): FarmCanvasObject | null {
  const input = value && typeof value === 'object' ? value as Partial<FarmCanvasObject> : {};
  if (input.kind !== 'plot' && input.kind !== 'building' && input.kind !== 'decor' && input.kind !== 'path' && input.kind !== 'obstacle') {
    return null;
  }
  const point = snapFarmPoint({ x: Number(input.x), y: Number(input.y) }, gridSize);
  const object: FarmCanvasObject = {
    id: cleanId(input.id, `farm-object-${index}`),
    kind: input.kind,
    x: point.x,
    y: point.y,
    widthCells: Math.round(clamp(input.widthCells, 1, 1, 32)),
    heightCells: Math.round(clamp(input.heightCells, 1, 1, 32)),
    createdDay: Math.round(clamp(input.createdDay, fallbackDay, 1, 999999)),
  };
  if (input.rotation === 90 || input.rotation === 180 || input.rotation === 270) object.rotation = input.rotation;
  if (input.kind === 'plot') object.crop = normalizeCrop(input.crop, object.createdDay);
  if (input.kind === 'building') object.buildingId = normalizeFarmBuildingId(input.buildingId);
  if (input.kind === 'decor') object.decorId = normalizeFarmDecorId(input.decorId);
  if (input.kind === 'decor' && input.resourceId && !/^data:/i.test(String(input.resourceId))) {
    object.resourceId = cleanId(input.resourceId, 'resource');
  }
  if (input.kind === 'decor') {
    const objectType = normalizeFarmDecorObjectType(input.objectType);
    if (objectType) object.objectType = objectType;
  }
  if (input.skinId) object.skinId = cleanId(input.skinId, 'default');
  return object;
}

export function createFarmState(options: Partial<FarmCanvasState> = {}): FarmCanvasState {
  const baseDay = options.day ?? 1;
  const baseSeason = options.season ?? farmSeasonForDay(baseDay);
  return sanitizeFarmCanvasState({
    version: FARM_CANVAS_VERSION,
    coordinateMode: 'flow',
    gridSize: FARM_GRID_SIZE,
    day: baseDay,
    season: baseSeason,
    weather: options.weather || farmWeatherForDay(baseDay, baseSeason),
    festivalId: options.festivalId,
    resources: {
      ...DEFAULT_RESOURCES,
      ...(options.resources || {}),
      seeds: {
        ...DEFAULT_RESOURCES.seeds,
        ...(options.resources?.seeds || {}),
      },
    },
    inventory: {
      ...DEFAULT_INVENTORY,
      ...(options.inventory || {}),
      crops: {
        ...DEFAULT_INVENTORY.crops,
        ...(options.inventory?.crops || {}),
      },
      animalProducts: {
        ...DEFAULT_INVENTORY.animalProducts,
        ...(options.inventory?.animalProducts || {}),
      },
    },
    objects: options.objects || [],
    animals: options.animals,
    orders: options.orders || DEFAULT_ORDERS,
    festivalTasks: options.festivalTasks || [],
    npcVisits: options.npcVisits || [],
    rareEvents: options.rareEvents || [],
    eventLog: options.eventLog || [],
    lastDailySummary: options.lastDailySummary,
    discoveredCropIds: options.discoveredCropIds || [],
    unlockedDecorIds: options.unlockedDecorIds || [],
    stats: {
      ...DEFAULT_STATS,
      ...(options.stats || {}),
    },
    selectedTool: options.selectedTool || 'select',
    selectedBuildingId: normalizeFarmBuildingId(options.selectedBuildingId),
    selectedDecorId: normalizeFarmDecorId(options.selectedDecorId),
    selectedResourceDecor: normalizeSelectedResourceDecor(options.selectedResourceDecor),
    selectedObjectId: cleanOptionalId(options.selectedObjectId),
  });
}

export function sanitizeFarmCanvasState(value: unknown): FarmCanvasState {
  const input = value && typeof value === 'object' ? value as Partial<FarmCanvasState> : {};
  const day = Math.round(clamp(input.day, 1, 1, 999999));
  const gridSize = normalizeGridSize(input.gridSize);
  const season = normalizeFarmSeason(input.season, day);
  const weather = normalizeFarmWeather(input.weather, day, season);
  const festivalId = weather === 'festival' ? cleanOptionalId(input.festivalId) || farmFestivalIdForDay(day, season) : undefined;
  const objects = Array.isArray(input.objects)
    ? input.objects
      .slice(0, MAX_FARM_OBJECTS)
      .map((object, index) => normalizeObject(object, index, day, gridSize))
      .filter((object): object is FarmCanvasObject => Boolean(object))
    : [];
  return {
    version: FARM_CANVAS_VERSION,
    coordinateMode: 'flow',
    gridSize,
    day,
    season,
    weather,
    festivalId,
    resources: normalizeResources(input.resources),
    inventory: normalizeInventory(input.inventory),
    objects,
    animals: normalizeFarmAnimals(input.animals, day),
    orders: normalizeOrders(input.orders),
    festivalTasks: normalizeFestivalTasks(input.festivalTasks, day, season, weather, festivalId),
    npcVisits: normalizeFarmNpcVisits(input.npcVisits, day, season),
    rareEvents: normalizeFarmRareEvents(input.rareEvents, day),
    eventLog: normalizeEventLog(input.eventLog, day),
    lastDailySummary: normalizeDailySummary(input.lastDailySummary, day),
    discoveredCropIds: Array.isArray(input.discoveredCropIds)
      ? Array.from(new Set(input.discoveredCropIds.filter(isFarmCropId))).slice(0, 64)
      : [],
    unlockedDecorIds: Array.isArray(input.unlockedDecorIds)
      ? Array.from(new Set(input.unlockedDecorIds.map((id, index) => cleanId(id, `decor-${index}`)))).slice(0, 200)
      : [],
    stats: normalizeStats(input.stats),
    selectedTool: input.selectedTool || 'select',
    selectedBuildingId: normalizeFarmBuildingId(input.selectedBuildingId),
    selectedDecorId: normalizeFarmDecorId(input.selectedDecorId),
    selectedResourceDecor: normalizeSelectedResourceDecor(input.selectedResourceDecor),
    selectedObjectId: cleanOptionalId(input.selectedObjectId),
  };
}

export function appendFarmEvent(stateInput: FarmCanvasState, eventInput: FarmEventInput): FarmCanvasState {
  const state = sanitizeFarmCanvasState(stateInput);
  const createdAt = makeEventStamp(state);
  const [event] = normalizeEventLog([{
    id: `farm-event-${createdAt}-${eventInput.kind}`,
    kind: eventInput.kind,
    day: state.day,
    message: eventInput.message,
    amount: eventInput.amount,
    cropId: eventInput.cropId,
    objectKind: eventInput.objectKind,
    orderId: eventInput.orderId,
    npcVisitId: eventInput.npcVisitId,
    rareEventId: eventInput.rareEventId,
    createdAt,
  }], state.day);
  return {
    ...state,
    eventLog: [event, ...state.eventLog].slice(0, MAX_FARM_EVENT_LOG),
  };
}

function farmActivityMeta(event: FarmEventLogItem): Pick<FarmActivityFeedItem, 'title' | 'tagLabel' | 'tone'> {
  if (event.kind === 'plot_tilled') return { title: '开垦土地', tagLabel: '土', tone: 'soil' };
  if (event.kind === 'crop_planted') return { title: '播下种子', tagLabel: '种', tone: 'soil' };
  if (event.kind === 'crop_watered') return { title: '浇水照料', tagLabel: '水', tone: 'water' };
  if (event.kind === 'crop_harvested') return { title: '收获作物', tagLabel: '收', tone: 'reward' };
  if (event.kind === 'order_completed') return { title: '订单完成', tagLabel: '单', tone: 'quest' };
  if (event.kind === 'npc_request_completed') return { title: '来访委托', tagLabel: '客', tone: 'quest' };
  if (event.kind === 'rare_event') return { title: '发现惊喜', tagLabel: '星', tone: 'rare' };
  if (event.kind === 'building_placed') return { title: '建筑落成', tagLabel: '建', tone: 'build' };
  if (event.kind === 'decor_placed') return { title: '布置装饰', tagLabel: '饰', tone: 'build' };
  if (event.kind === 'day_advanced') return { title: '过了一天', tagLabel: '日', tone: 'day' };
  return { title: '工具反馈', tagLabel: '记', tone: 'neutral' };
}

function farmActivityAmountLabel(event: FarmEventLogItem) {
  const amount = Math.round(Number(event.amount || 0));
  if (!amount) return undefined;
  if (event.kind === 'order_completed' || event.kind === 'npc_request_completed' || event.kind === 'rare_event') {
    return amount > 0 ? `+${amount}` : String(amount);
  }
  if (event.kind === 'crop_harvested' || event.kind === 'crop_planted' || event.kind === 'crop_watered' || event.kind === 'plot_tilled') {
    return `x${Math.abs(amount)}`;
  }
  return amount > 0 ? `+${amount}` : String(amount);
}

function farmActivityRewardLabel(kind: FarmEventKind) {
  if (kind === 'crop_harvested') return '收获奖励';
  if (kind === 'order_completed') return '订单奖励';
  if (kind === 'npc_request_completed') return '来访奖励';
  if (kind === 'rare_event') return '惊喜奖励';
  if (kind === 'building_placed') return '建造奖励';
  if (kind === 'decor_placed') return '美化奖励';
  return undefined;
}

function farmActivityIsReward(kind: FarmEventKind) {
  return kind === 'crop_harvested'
    || kind === 'order_completed'
    || kind === 'npc_request_completed'
    || kind === 'rare_event'
    || kind === 'building_placed'
    || kind === 'decor_placed';
}

function farmActivityRewardStreak(events: FarmEventLogItem[]) {
  const sortedEvents = [...events].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
  let streak = 0;
  for (const event of sortedEvents) {
    if (!farmActivityIsReward(event.kind)) break;
    streak += 1;
  }
  return streak;
}

function farmActivityRewardStreakHint(streak: number) {
  if (streak >= 3) return `连击火热 x${streak}，今天的牧场正在丰收。`;
  if (streak >= 2) return `连续正反馈 ${streak} 次，继续收获、交单或布置来保持连击。`;
  if (streak === 1) return '已经拿到 1 次正反馈，再来一次就能开启今日连击。';
  return undefined;
}

function farmActivityRewardStreakTier(streak: number): FarmActivityRewardStreakTier | undefined {
  if (streak >= 5) return 'festival';
  if (streak >= 3) return 'harvest';
  if (streak >= 1) return 'sprout';
  return undefined;
}

function farmActivityRewardStreakMilestoneLabel(streak: number) {
  if (streak >= 5) return '节庆连击已点亮，今天的牧场进入高光时刻。';
  if (streak >= 3) return `再来 ${5 - streak} 次正反馈，点亮节庆连击。`;
  if (streak >= 2) return '再来 1 次正反馈，升级为丰收连击。';
  if (streak === 1) return '再来 1 次正反馈，开启今日连击。';
  return undefined;
}

function farmActivityRewardStreakMilestoneProgress(streak: number) {
  if (streak < 1) return undefined;
  const target = streak >= 3 ? 5 : streak >= 2 ? 3 : 2;
  const current = Math.min(streak, target);
  return {
    target,
    percent: Math.round((current / target) * 100),
    label: `${current}/${target}`,
  };
}

const FARM_ACTIVITY_REWARD_STREAK_CHEST_TRAIL: Array<{
  tier: FarmActivityRewardStreakTier;
  label: string;
  progressLabel: string;
  target: number;
  rewardLabel: string;
  shortRewardLabel: string;
}> = [
  {
    tier: 'sprout',
    label: '宝箱萌芽',
    progressLabel: '1/2',
    target: 2,
    rewardLabel: '奖励：今日连击提示和下一步行动。',
    shortRewardLabel: '连击提示',
  },
  {
    tier: 'harvest',
    label: '丰收预热',
    progressLabel: '2/3',
    target: 3,
    rewardLabel: '奖励：丰收连击徽章和奖励印章苗头。',
    shortRewardLabel: '丰收徽章',
  },
  {
    tier: 'festival',
    label: '节庆点亮',
    progressLabel: '5/5',
    target: 5,
    rewardLabel: '奖励：高光手账、订单气氛、美化收益。',
    shortRewardLabel: '节庆三件套',
  },
];

function farmActivityRewardStreakChestTrailItems(streak: number): FarmActivityRewardStreakChestTrailItem[] | undefined {
  const milestone = farmActivityRewardStreakMilestoneProgress(streak);
  if (!milestone) return undefined;
  return FARM_ACTIVITY_REWARD_STREAK_CHEST_TRAIL.map((item) => ({
    tier: item.tier,
    label: item.label,
    progressLabel: item.progressLabel,
    state: streak >= item.target ? 'done' : milestone.target === item.target ? 'active' : 'next',
    rewardLabel: item.rewardLabel,
    shortRewardLabel: item.shortRewardLabel,
  }));
}

function farmActivityRewardStreakChestTrailLabel(items: FarmActivityRewardStreakChestTrailItem[] | undefined) {
  if (!items?.length) return undefined;
  return `宝箱路线：${items.map((item) => `${item.label} ${item.progressLabel}`).join(' · ')}`;
}

function farmActivityRewardStreakChestTrailRewardLabel(items: FarmActivityRewardStreakChestTrailItem[] | undefined) {
  if (!items?.length) return undefined;
  return `路线奖励：${items.map((item) => item.shortRewardLabel).join(' -> ')}`;
}

function farmActivityRewardStreakChestActiveTrailItem(items: FarmActivityRewardStreakChestTrailItem[] | undefined) {
  if (!items?.length) return undefined;
  return items.find((item) => item.state === 'active') || [...items].reverse().find((item) => item.state === 'done');
}

function farmActivityRewardStreakChestActiveHint(
  item: FarmActivityRewardStreakChestTrailItem | undefined,
  remainingLabel: string | undefined,
) {
  if (!item || !remainingLabel) return undefined;
  return `当前冲刺：${item.shortRewardLabel}，${remainingLabel}。`;
}

function farmActivityRewardStreakChestNextRewardLabel(
  items: FarmActivityRewardStreakChestTrailItem[] | undefined,
  remaining: number,
) {
  if (!items?.length) return undefined;
  const nextItem = items.find((item) => item.state === 'next');
  if (nextItem) return `下一段：${nextItem.shortRewardLabel}`;
  return remaining <= 0 ? '下一轮：连击提示' : '下一步：开箱入袋';
}

function farmActivityRewardStreakMilestoneCompletionLabel(streak: number) {
  if (streak >= 5) return '节庆连击奖励已点亮，今天的高光已经写进牧场手账。';
  return undefined;
}

function farmActivityRewardStreakMilestoneRewardLabel(streak: number) {
  if (streak >= 5) return '节庆奖励：高光手账、订单气氛和美化收益已汇总。';
  return undefined;
}

function farmActivityRewardStreakMilestoneRewardItems(streak: number) {
  if (streak >= 5) return ['高光手账', '订单气氛', '美化收益'];
  return undefined;
}

function farmActivityRewardStreakChestPreview(streak: number) {
  const milestone = farmActivityRewardStreakMilestoneProgress(streak);
  const tier = farmActivityRewardStreakTier(streak);
  if (!milestone || !tier) return undefined;
  const remaining = Math.max(0, milestone.target - Math.min(streak, milestone.target));
  const remainingLabel = remaining > 0 ? `还差 ${remaining} 次点亮宝箱` : '已可开箱';
  const trailItems = farmActivityRewardStreakChestTrailItems(streak);
  const trailLabel = farmActivityRewardStreakChestTrailLabel(trailItems);
  const trailRewardLabel = farmActivityRewardStreakChestTrailRewardLabel(trailItems);
  const activeTrailItem = farmActivityRewardStreakChestActiveTrailItem(trailItems);
  const activeTrailLabel = activeTrailItem ? `当前阶段：${activeTrailItem.label} ${activeTrailItem.progressLabel}` : undefined;
  const activeRewardLabel = activeTrailItem ? `当前奖励：${activeTrailItem.shortRewardLabel}` : undefined;
  const activeHint = farmActivityRewardStreakChestActiveHint(activeTrailItem, remainingLabel);
  const nextRewardLabel = farmActivityRewardStreakChestNextRewardLabel(trailItems, remaining);
  if (streak >= 5) {
    const rewardItems = farmActivityRewardStreakMilestoneRewardItems(streak);
    const rewardCount = rewardItems?.length || 0;
    return {
      state: 'ready' as const,
      tier,
      label: '节庆宝箱已点亮，奖励可以入袋。',
      shortLabel: '宝箱亮',
      progressLabel: milestone.label,
      rewardLabel: '奖励：高光手账、订单气氛和美化收益。',
      ctaLabel: '开宝箱',
      claimLabel: '开箱奖励已入袋：高光手账、订单气氛、美化收益。',
      nextLabel: '下一轮：再拿 2 次正反馈，开启新宝箱。',
      rewardItems,
      burstLabel: rewardCount > 0 ? `宝箱奖励 +${rewardCount}` : undefined,
      openedSummaryLabel: rewardItems?.length ? `宝箱奖励 +${rewardCount}：${rewardItems.join(' / ')}。` : undefined,
      percent: milestone.percent,
      meterLabel: `宝箱蓄能 ${milestone.label}`,
      remaining,
      remainingLabel,
      trailLabel,
      trailRewardLabel,
      trailItems,
      activeTrailLabel,
      activeRewardLabel,
      activeHint,
      nextRewardLabel,
    };
  }
  if (streak >= 3) {
    return {
      state: 'warming' as const,
      tier,
      label: `节庆宝箱预热，${milestone.label} 后点亮节庆连击。`,
      shortLabel: '宝箱热',
      progressLabel: milestone.label,
      rewardLabel: '预览：高光手账、订单气氛和美化收益。',
      ctaLabel: '看宝箱',
      nextLabel: `继续连击：还差 ${5 - Math.min(streak, 5)} 次正反馈点亮节庆宝箱。`,
      percent: milestone.percent,
      meterLabel: `宝箱蓄能 ${milestone.label}`,
      remaining,
      remainingLabel,
      trailLabel,
      trailRewardLabel,
      trailItems,
      activeTrailLabel,
      activeRewardLabel,
      activeHint,
      nextRewardLabel,
      chargeLabel: '给宝箱蓄能',
      chargeShortLabel: '蓄能',
      chargeHint: '执行连击建议，宝箱蓄能会继续上涨。',
    };
  }
  if (streak >= 2) {
    return {
      state: 'warming' as const,
      tier,
      label: `丰收宝箱预热，${milestone.label} 后升级丰收连击。`,
      shortLabel: '宝箱热',
      progressLabel: milestone.label,
      rewardLabel: '预览：丰收连击徽章和奖励印章苗头。',
      ctaLabel: '看宝箱',
      nextLabel: '继续连击：再拿 1 次正反馈，宝箱会升级。',
      percent: milestone.percent,
      meterLabel: `宝箱蓄能 ${milestone.label}`,
      remaining,
      remainingLabel,
      trailLabel,
      trailRewardLabel,
      trailItems,
      activeTrailLabel,
      activeRewardLabel,
      activeHint,
      nextRewardLabel,
      chargeLabel: '给宝箱蓄能',
      chargeShortLabel: '蓄能',
      chargeHint: '执行连击建议，宝箱蓄能会继续上涨。',
    };
  }
  return {
    state: 'warming' as const,
    tier,
    label: `连击宝箱萌芽，${milestone.label} 后开启今日连击。`,
    shortLabel: '宝箱芽',
    progressLabel: milestone.label,
    rewardLabel: '预览：今日连击提示、下一步行动和小额惊喜。',
    ctaLabel: '看宝箱',
    nextLabel: '继续连击：再拿 1 次正反馈，宝箱会发芽。',
    percent: milestone.percent,
    meterLabel: `宝箱蓄能 ${milestone.label}`,
    remaining,
    remainingLabel,
    trailLabel,
    trailRewardLabel,
    trailItems,
    activeTrailLabel,
    activeRewardLabel,
    activeHint,
    nextRewardLabel,
    chargeLabel: '给宝箱蓄能',
    chargeShortLabel: '蓄能',
    chargeHint: '执行连击建议，宝箱蓄能会继续上涨。',
  };
}

function farmActivityRewardStreakAction(state: FarmCanvasState, streak: number): {
  kind: FarmActivityRewardStreakActionKind;
  shortLabel: string;
  label: string;
  action: FarmFocusGoalAction;
} | undefined {
  if (streak < 1) return undefined;
  const activeNpcVisit = getActiveFarmNpcVisit(state);
  if (activeNpcVisit && canCompleteFarmNpcVisit(state, activeNpcVisit.id)) {
    return {
      kind: 'npc',
      shortLabel: '交来访',
      label: `交付来访：${activeNpcVisit.visitorName}，稳稳续上连击。`,
      action: { kind: 'complete-npc', visitId: activeNpcVisit.id },
    };
  }
  const readyOrder = state.orders.find((order) => canCompleteFarmOrder(state, order.id));
  if (readyOrder) {
    return {
      kind: 'order',
      shortLabel: '去交单',
      label: `交付订单：${readyOrder.title}，把连击推进一格。`,
      action: { kind: 'complete-order', orderId: readyOrder.id },
    };
  }
  const matureCrops = state.objects.filter((object) =>
    object.kind === 'plot'
    && object.crop
    && cropStageForDays(object.crop) === 'mature').length;
  if (matureCrops > 0) {
    return {
      kind: 'harvest',
      shortLabel: '去收获',
      label: `先收获 ${matureCrops} 块成熟作物，续上今天的连击。`,
      action: { kind: 'jump-mature' },
    };
  }
  if (streak >= 5) {
    return {
      kind: 'festival',
      shortLabel: '守连击',
      label: '继续收获、交单或布置，守住节庆连击。',
      action: { kind: 'select-decor', decorId: FARM_DEFAULT_DECOR_ID },
    };
  }
  if (streak >= 3) {
    return {
      kind: 'decorate',
      shortLabel: '去布置',
      label: '补一次布置或建造，冲刺节庆连击。',
      action: { kind: 'select-decor', decorId: FARM_DEFAULT_DECOR_ID },
    };
  }
  return {
    kind: 'harvest',
    shortLabel: streak === 1 ? '再来一次' : '续连击',
    label: streak === 1
      ? '再拿一次收获、交单或布置，开启今日连击。'
      : '再拿一次收获、交单或布置，升级丰收连击。',
    action: { kind: 'select-decor', decorId: FARM_DEFAULT_DECOR_ID },
  };
}

export function buildFarmActivityFeed(
  stateInput: FarmCanvasState | undefined,
  options: { maxItems?: number } = {},
): FarmActivityFeed {
  const state = sanitizeFarmCanvasState(stateInput);
  const maxItems = Math.round(clamp(options.maxItems, 3, 1, 6));
  const todayEvents = state.eventLog.filter((event) => event.day === state.day);
  const todayRewardTotal = todayEvents.filter((event) => farmActivityIsReward(event.kind)).length;
  const items = state.eventLog
    .filter((event) => Boolean(event.message))
    .slice(0, maxItems)
    .map((event): FarmActivityFeedItem => {
      const meta = farmActivityMeta(event);
      return {
        id: event.id,
        kind: event.kind,
        day: event.day,
        title: meta.title,
        detail: cleanEventMessage(event.message),
        tagLabel: meta.tagLabel,
        amountLabel: farmActivityAmountLabel(event),
        rewardLabel: farmActivityRewardLabel(event.kind),
        tone: meta.tone,
      };
    });
  return {
    items,
    todayTotal: todayEvents.length,
    todayRewardTotal,
    summary: todayEvents.length > 0
      ? `今日 ${todayEvents.length} 条记录 · ${todayRewardTotal} 次正反馈`
      : '今天还没有农活记录',
    emptyHint: '开垦、播种、浇水、收获后，这里会留下最近农活。',
  };
}

export function buildFarmActivityDigest(stateInput: FarmCanvasState | undefined): FarmActivityDigest {
  const state = sanitizeFarmCanvasState(stateInput);
  const target = 6;
  const todayEvents = state.eventLog.filter((event) => event.day === state.day && Boolean(event.message));
  const todayTotal = todayEvents.length;
  const todayRewardTotal = todayEvents.filter((event) => farmActivityIsReward(event.kind)).length;
  const rewardStreak = farmActivityRewardStreak(todayEvents);
  const rewardStreakLabel = rewardStreak >= 2
    ? `连击 x${rewardStreak}`
    : rewardStreak === 1
      ? '连击苗头'
      : undefined;
  const rewardStreakHint = farmActivityRewardStreakHint(rewardStreak);
  const rewardStreakTier = farmActivityRewardStreakTier(rewardStreak);
  const rewardStreakMilestoneLabel = farmActivityRewardStreakMilestoneLabel(rewardStreak);
  const rewardStreakMilestoneProgress = farmActivityRewardStreakMilestoneProgress(rewardStreak);
  const rewardStreakMilestoneCompletionLabel = farmActivityRewardStreakMilestoneCompletionLabel(rewardStreak);
  const rewardStreakMilestoneRewardLabel = farmActivityRewardStreakMilestoneRewardLabel(rewardStreak);
  const rewardStreakMilestoneRewardItems = farmActivityRewardStreakMilestoneRewardItems(rewardStreak);
  const rewardStreakChest = farmActivityRewardStreakChestPreview(rewardStreak);
  const rewardStreakAction = farmActivityRewardStreakAction(state, rewardStreak);
  const percent = Math.round((Math.min(todayTotal, target) / target) * 100);
  const tone: FarmActivityDigestTone = todayRewardTotal >= 2
    ? 'reward'
    : todayTotal >= target
      ? 'busy'
      : todayTotal >= 3
        ? 'steady'
        : 'quiet';
  const badgeLabel = tone === 'reward'
    ? `丰收 +${todayRewardTotal}`
    : tone === 'busy'
      ? '忙碌日'
      : tone === 'steady'
        ? '节奏起'
        : '待开工';
  const headline = todayTotal > 0
    ? `今天已有 ${todayTotal} 条农活，${todayRewardTotal} 次正反馈。`
    : '今天还没开始农活，牧场手账等着第一笔记录。';
  const nextHint = todayTotal <= 0
    ? '先锄一块地、播一粒种子或浇一次水，成果条会马上点亮。'
    : todayTotal < target
      ? `再完成 ${target - todayTotal} 次农活，点亮忙碌牧场日。`
      : todayRewardTotal > 0
        ? '继续收获、交付或布置，保持今天的丰收节奏。'
        : '今天操作量已经足够，接下来争取一次收获或交付。';
  const counts = new Map<FarmEventKind, number>();
  todayEvents.forEach((event) => {
    counts.set(event.kind, (counts.get(event.kind) || 0) + 1);
  });
  const chips = Array.from(counts.entries())
    .map(([kind, count]) => {
      const meta = farmActivityMeta({ ...todayEvents[0], kind });
      return {
        id: kind,
        label: meta.title,
        count,
        tone: meta.tone,
      };
    })
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-Hans-CN'))
    .slice(0, 3);
  return {
    todayTotal,
    todayRewardTotal,
    rewardStreak,
    rewardStreakLabel,
    rewardStreakHint,
    rewardStreakTier,
    rewardStreakMilestoneLabel,
    rewardStreakMilestoneTarget: rewardStreakMilestoneProgress?.target,
    rewardStreakMilestonePercent: rewardStreakMilestoneProgress?.percent,
    rewardStreakMilestoneProgressLabel: rewardStreakMilestoneProgress?.label,
    rewardStreakMilestoneCompletionLabel,
    rewardStreakMilestoneRewardLabel,
    rewardStreakMilestoneRewardItems,
    rewardStreakActionKind: rewardStreakAction?.kind,
    rewardStreakActionShortLabel: rewardStreakAction?.shortLabel,
    rewardStreakActionLabel: rewardStreakAction?.label,
    rewardStreakAction: rewardStreakAction?.action,
    rewardStreakChestState: rewardStreakChest?.state,
    rewardStreakChestTier: rewardStreakChest?.tier,
    rewardStreakChestLabel: rewardStreakChest?.label,
    rewardStreakChestShortLabel: rewardStreakChest?.shortLabel,
    rewardStreakChestProgressLabel: rewardStreakChest?.progressLabel,
    rewardStreakChestRewardLabel: rewardStreakChest?.rewardLabel,
    rewardStreakChestCtaLabel: rewardStreakChest?.ctaLabel,
    rewardStreakChestClaimLabel: rewardStreakChest?.claimLabel,
    rewardStreakChestNextLabel: rewardStreakChest?.nextLabel,
    rewardStreakChestRewardItems: rewardStreakChest?.rewardItems,
    rewardStreakChestBurstLabel: rewardStreakChest?.burstLabel,
    rewardStreakChestOpenedSummaryLabel: rewardStreakChest?.openedSummaryLabel,
    rewardStreakChestPercent: rewardStreakChest?.percent,
    rewardStreakChestMeterLabel: rewardStreakChest?.meterLabel,
    rewardStreakChestRemaining: rewardStreakChest?.remaining,
    rewardStreakChestRemainingLabel: rewardStreakChest?.remainingLabel,
    rewardStreakChestTrailLabel: rewardStreakChest?.trailLabel,
    rewardStreakChestTrailRewardLabel: rewardStreakChest?.trailRewardLabel,
    rewardStreakChestTrailItems: rewardStreakChest?.trailItems,
    rewardStreakChestActiveTrailLabel: rewardStreakChest?.activeTrailLabel,
    rewardStreakChestActiveRewardLabel: rewardStreakChest?.activeRewardLabel,
    rewardStreakChestActiveHint: rewardStreakChest?.activeHint,
    rewardStreakChestNextRewardLabel: rewardStreakChest?.nextRewardLabel,
    rewardStreakChestChargeLabel: rewardStreakChest?.chargeLabel,
    rewardStreakChestChargeShortLabel: rewardStreakChest?.chargeShortLabel,
    rewardStreakChestChargeHint: rewardStreakChest?.chargeHint,
    target,
    percent,
    tone,
    badgeLabel,
    headline,
    nextHint,
    chips,
  };
}

function withFeedback(state: FarmCanvasState, feedback: string, changed = true, event?: FarmEventInput): FarmToolResult {
  return { state: event ? appendFarmEvent(state, { ...event, message: event.message || feedback }) : state, changed, feedback };
}

function withError(state: FarmCanvasState, error: FarmToolError, feedback: string): FarmToolResult {
  return { state, changed: false, feedback, error };
}

function updateStats(state: FarmCanvasState, patch: Partial<FarmCanvasStats>): FarmCanvasStats {
  return normalizeStats({ ...state.stats, ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, (state.stats as any)[key] + Number(value || 0)])) });
}

function addInventoryCrop(inventory: FarmCanvasInventory, cropId: FarmCropId, amount: number): FarmCanvasInventory {
  return {
    ...inventory,
    crops: {
      ...inventory.crops,
      [cropId]: Math.round(clamp((inventory.crops[cropId] || 0) + amount, 0, 0, 9999)),
    },
  };
}

function applyReward(state: FarmCanvasState, reward: FarmOrderReward): FarmCanvasState {
  const seeds = { ...state.resources.seeds };
  (Object.entries(reward.seeds || {}) as Array<[FarmCropId, number]>).forEach(([cropId, amount]) => {
    if (!isFarmCropId(cropId)) return;
    seeds[cropId] = Math.round(clamp((seeds[cropId] || 0) + amount, 0, 0, 9999));
  });
  const decorRewards = Array.isArray(reward.decorIds) ? reward.decorIds : [];
  return {
    ...state,
    resources: normalizeResources({
      ...state.resources,
      gold: state.resources.gold + (reward.gold || 0),
      wood: state.resources.wood + (reward.wood || 0),
      stone: state.resources.stone + (reward.stone || 0),
      experience: state.resources.experience + (reward.experience || 0),
      seeds,
    }),
    inventory: {
      ...state.inventory,
      decorIds: Array.from(new Set([...state.inventory.decorIds, ...decorRewards])),
    },
    unlockedDecorIds: Array.from(new Set([...state.unlockedDecorIds, ...decorRewards])),
  };
}

function addAnimalProducts(
  inventory: FarmCanvasInventory,
  products: Partial<Record<FarmAnimalProductId, number>>,
): FarmCanvasInventory {
  const current = normalizeInventory(inventory);
  const nextProducts: Partial<Record<FarmAnimalProductId, number>> = { ...current.animalProducts };
  (Object.keys(FARM_ANIMAL_PRODUCT_DEFINITIONS) as FarmAnimalProductId[]).forEach((productId) => {
    const amount = Math.round(clamp(products[productId], 0, 0, 9999));
    if (amount <= 0) return;
    nextProducts[productId] = Math.round(clamp((nextProducts[productId] || 0) + amount, 0, 0, 9999));
  });
  return normalizeInventory({ ...current, animalProducts: nextProducts });
}

function diffAnimalProducts(
  previous: Partial<Record<FarmAnimalProductId, number>> | undefined,
  next: Partial<Record<FarmAnimalProductId, number>> | undefined,
) {
  const deltas: Partial<Record<FarmAnimalProductId, number>> = {};
  (Object.keys(FARM_ANIMAL_PRODUCT_DEFINITIONS) as FarmAnimalProductId[]).forEach((productId) => {
    const delta = Math.max(0, Math.round((next?.[productId] || 0) - (previous?.[productId] || 0)));
    if (delta > 0) deltas[productId] = delta;
  });
  return deltas;
}

export function formatAnimalProductTotals(products: Partial<Record<FarmAnimalProductId, number>> | undefined) {
  return (Object.keys(FARM_ANIMAL_PRODUCT_DEFINITIONS) as FarmAnimalProductId[])
    .map((productId) => {
      const amount = Math.round(clamp(products?.[productId], 0, 0, 9999));
      if (amount <= 0) return '';
      return `${FARM_ANIMAL_PRODUCT_DEFINITIONS[productId].label} x${amount}`;
    })
    .filter(Boolean)
    .join(' / ');
}

function farmAnimalMoodForDay(weather: FarmWeather): FarmAnimalMood {
  if (weather === 'festival') return 'happy';
  if (weather === 'rainy') return 'calm';
  return 'happy';
}

function produceFarmAnimalProducts(state: FarmCanvasState) {
  const products: Partial<Record<FarmAnimalProductId, number>> = {};
  const animals = state.animals.map((animal) => {
    const definition = FARM_ANIMAL_DEFINITIONS[animal.kind];
    if (!definition || animal.placedDay > state.day || animal.lastProducedDay === state.day) return animal;
    products[definition.productId] = (products[definition.productId] || 0) + definition.dailyAmount;
    return {
      ...animal,
      mood: farmAnimalMoodForDay(state.weather),
      lastProducedDay: state.day,
      productCount: Math.round(clamp(animal.productCount + definition.dailyAmount, 0, 0, 999999)),
    };
  });
  const total = Object.values(products).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return {
    animals,
    products,
    total,
    summary: formatAnimalProductTotals(products),
  };
}

function countFarmEvents(state: FarmCanvasState, kind: FarmEventKind, day = state.day) {
  return state.eventLog.filter((event) => event.day === day && event.kind === kind).length;
}

function sumFarmEventAmounts(state: FarmCanvasState, kind: FarmEventKind, day = state.day) {
  return state.eventLog
    .filter((event) => event.day === day && event.kind === kind)
    .reduce((total, event) => total + (Number(event.amount) || 0), 0);
}

function isMatureCrop(object: FarmCanvasObject) {
  return object.kind === 'plot' && object.crop?.stage === 'mature';
}

function canRainWaterCrop(object: FarmCanvasObject) {
  return object.kind === 'plot'
    && Boolean(object.crop)
    && object.crop?.stage !== 'mature'
    && object.crop?.stage !== 'withered'
    && object.crop?.wateredToday !== true;
}

export function getFarmBuildingEffects(stateInput: FarmCanvasState | undefined): FarmBuildingEffects {
  const state = sanitizeFarmCanvasState(stateInput);
  const counts = {
    huts: 0,
    storages: 0,
    wells: 0,
    boards: 0,
    scarecrows: 0,
  };
  state.objects.forEach((object) => {
    if (object.kind !== 'building') return;
    if (object.buildingId === 'hut') counts.huts += 1;
    if (object.buildingId === 'storage') counts.storages += 1;
    if (object.buildingId === 'well') counts.wells += 1;
    if (object.buildingId === 'board') counts.boards += 1;
    if (object.buildingId === 'scarecrow') counts.scarecrows += 1;
  });
  const totalBuildings = counts.huts + counts.storages + counts.wells + counts.boards + counts.scarecrows;
  return {
    ...counts,
    totalBuildings,
    dailyWaterCapacity: BASE_FARM_DAILY_WATER + counts.wells * FARM_WATER_PER_WELL,
    storageCapacityBonus: counts.storages * FARM_STORAGE_BONUS_PER_BUILDING,
    scarecrowRadiusCells: counts.scarecrows > 0 ? FARM_SCARECROW_RADIUS_CELLS : 0,
    hasOrderBoard: counts.boards > 0,
  };
}

function clampFarmLongTermProgress(value: unknown, target: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(target, Math.max(0, Math.round(parsed)));
}

function makeFarmLongTermGoal(
  goal: Omit<FarmLongTermGoal, 'current' | 'percent' | 'done'> & { current: unknown },
): FarmLongTermGoal {
  const current = clampFarmLongTermProgress(goal.current, goal.target);
  return {
    ...goal,
    current,
    percent: Math.round((current / Math.max(1, goal.target)) * 100),
    done: current >= goal.target,
  };
}

export function buildFarmLongTermGoals(stateInput: FarmCanvasState | undefined): FarmLongTermGoal[] {
  const state = sanitizeFarmCanvasState(stateInput);
  const stats = state.stats;
  const cropCatalogTarget = (Object.keys(FARM_CROP_DEFINITIONS) as FarmCropId[]).length;
  const discoveredCropCount = new Set(state.discoveredCropIds.filter(isFarmCropId)).size;
  const builtBuildingTypes = new Set(
    state.objects
      .filter((object) => object.kind === 'building' && object.buildingId)
      .map((object) => object.buildingId),
  ).size;
  const currentDecorCount = state.objects.filter((object) => object.kind === 'decor').length;
  const starterDoneCount = [
    stats.plotsTilled >= 3,
    stats.cropsPlanted >= 3,
    stats.cropsWatered >= 3,
    stats.cropsHarvested >= 3,
    stats.ordersCompleted >= 1,
  ].filter(Boolean).length;
  return [
    makeFarmLongTermGoal({
      id: 'starter-route',
      title: '完成新手路线',
      hint: '开垦、播种、浇水、收获并交付第一单。',
      current: starterDoneCount,
      target: 5,
      unit: '步',
    }),
    makeFarmLongTermGoal({
      id: 'crop-catalog',
      title: '点亮全部作物',
      hint: '收获不同作物，慢慢补齐牧场图鉴。',
      current: discoveredCropCount,
      target: cropCatalogTarget,
      unit: '种',
    }),
    makeFarmLongTermGoal({
      id: 'farmstead-buildings',
      title: '建成 5 类建筑',
      hint: '小屋、水井、仓库、公告板和稻草人都要落地。',
      current: builtBuildingTypes,
      target: Math.min(5, Object.keys(FARM_BUILDING_DEFINITIONS).length),
      unit: '类',
    }),
    makeFarmLongTermGoal({
      id: 'orders-10',
      title: '完成 10 单委托',
      hint: '持续交付公告板订单，让村里记住这座牧场。',
      current: stats.ordersCompleted,
      target: 10,
      unit: '单',
    }),
    makeFarmLongTermGoal({
      id: 'decor-30',
      title: '布置 30 件装饰',
      hint: '用道路、花坛、灯和资源库图像把画布变成牧场。',
      current: Math.max(stats.decorPlaced || 0, currentDecorCount),
      target: 30,
      unit: '件',
    }),
    makeFarmLongTermGoal({
      id: 'days-7',
      title: '连续经营 7 天',
      hint: '推进天数，观察天气、动物、来访和节庆变化。',
      current: Math.max(state.day, (stats.daysAdvanced || 0) + 1),
      target: 7,
      unit: '天',
    }),
  ];
}

function makeFarmBeautyFactor(
  id: FarmBeautyFactorId,
  label: string,
  currentInput: number,
  targetInput: number,
  maxPointsInput: number,
): FarmBeautyFactor {
  const target = Math.max(1, Math.round(clamp(targetInput, 1, 1, 9999)));
  const current = Math.round(clamp(currentInput, 0, 0, 9999));
  const maxPoints = Math.max(1, Math.round(clamp(maxPointsInput, 1, 1, 100)));
  const points = Math.round((Math.min(current, target) / target) * maxPoints);
  return {
    id,
    label,
    current,
    target,
    points,
    maxPoints,
    done: current >= target,
  };
}

function farmBeautyTitle(score: number) {
  if (score >= 85) return { level: 5, title: '四季名场' };
  if (score >= 65) return { level: 4, title: '人气牧场' };
  if (score >= 45) return { level: 3, title: '整洁小院' };
  if (score >= 25) return { level: 2, title: '起步牧场' };
  return { level: 1, title: '朴素空地' };
}

export function buildFarmBeautyScore(stateInput: FarmCanvasState | undefined): FarmBeautyScore {
  const state = sanitizeFarmCanvasState(stateInput);
  const decorObjects = state.objects.filter((object) => object.kind === 'decor');
  const buildingTypes = new Set(
    state.objects
      .filter((object) => object.kind === 'building' && object.buildingId)
      .map((object) => object.buildingId),
  );
  const countDecorByCategory = (category: FarmDecorDefinition['category']) => decorObjects.filter((object) => {
    const definition = FARM_DECOR_DEFINITIONS[object.decorId || ''];
    return definition?.category === category;
  }).length;
  const pathCount = decorObjects.filter((object) => {
    const definition = FARM_DECOR_DEFINITIONS[object.decorId || ''];
    return object.objectType === 'tile' || definition?.category === 'path';
  }).length + state.objects.filter((object) => object.kind === 'path').length;
  const resourceDecorTypeCount = new Set(
    decorObjects
      .filter((object) => Boolean(object.resourceId || FARM_DECOR_DEFINITIONS[object.decorId || '']?.resourceOnly))
      .map((object) => object.objectType || object.decorId || 'resource'),
  ).size;

  const factors = [
    makeFarmBeautyFactor('paths', '道路连通', pathCount, 6, 24),
    makeFarmBeautyFactor('flowers', '花坛点缀', countDecorByCategory('flower'), 4, 16),
    makeFarmBeautyFactor('fences', '栅栏边界', countDecorByCategory('fence'), 6, 14),
    makeFarmBeautyFactor('lights', '夜间路灯', countDecorByCategory('light'), 3, 12),
    makeFarmBeautyFactor('buildings', '建筑布局', buildingTypes.size, 4, 20),
    makeFarmBeautyFactor('resourceDecor', '作品装饰', resourceDecorTypeCount, 3, 14),
  ];
  const score = Math.round(clamp(factors.reduce((total, factor) => total + factor.points, 0), 0, 0, 100));
  const level = farmBeautyTitle(score);
  const nextFactor = factors.find((factor) => !factor.done) || factors[factors.length - 1];
  const doneCount = factors.filter((factor) => factor.done).length;
  const summary = doneCount > 0
    ? `${doneCount}/${factors.length} 项美化已成形，画布开始有经营痕迹。`
    : '先铺几块路、放花坛或建筑，牧场会立刻更有生活感。';
  return {
    score,
    level: level.level,
    title: level.title,
    summary,
    nextHint: nextFactor.done
      ? '继续按自己的审美扩建，牧场已经很有记忆点。'
      : `下一步推荐：${nextFactor.label} ${nextFactor.current}/${nextFactor.target}`,
    factors,
  };
}

export function buildFarmBeautyRewards(stateInput: FarmCanvasState | undefined): FarmBeautyReward[] {
  const beautyScore = buildFarmBeautyScore(stateInput);
  return FARM_BEAUTY_REWARD_DEFINITIONS.map((reward) => ({
    ...reward,
    unlocked: beautyScore.score >= reward.threshold,
    remainingScore: Math.max(0, reward.threshold - beautyScore.score),
  }));
}

export function isFarmDecorUnlocked(stateInput: FarmCanvasState | undefined, decorIdInput: unknown) {
  const decorId = normalizeFarmDecorId(decorIdInput);
  if (FARM_STARTER_DECOR_IDS.includes(decorId)) return true;
  if (FARM_DECOR_DEFINITIONS[decorId]?.resourceOnly) return true;
  const state = sanitizeFarmCanvasState(stateInput);
  return state.unlockedDecorIds.includes(decorId) || state.inventory.decorIds.includes(decorId);
}

export function canCompleteFarmOrder(stateInput: FarmCanvasState | undefined, orderId: string) {
  const state = sanitizeFarmCanvasState(stateInput);
  const order = state.orders.find((item) => item.id === orderId);
  if (!order || order.completed) return false;
  return order.requirements.every((requirement) =>
    (state.inventory.crops[requirement.cropId] || 0) >= requirement.amount);
}

export function getActiveFarmNpcVisit(stateInput: FarmCanvasState | undefined): FarmNpcVisitState | undefined {
  const state = sanitizeFarmCanvasState(stateInput);
  return state.npcVisits.find((visit) => visit.day === state.day && !visit.completed)
    || state.npcVisits.find((visit) => visit.day === state.day);
}

export function canCompleteFarmNpcVisit(stateInput: FarmCanvasState | undefined, visitId: string) {
  const state = sanitizeFarmCanvasState(stateInput);
  const visit = state.npcVisits.find((item) => item.id === visitId);
  if (!visit || visit.completed) return false;
  if (visit.requestKind === 'crop' && visit.cropId) {
    return (state.inventory.crops[visit.cropId] || 0) >= visit.amount;
  }
  if (visit.requestKind === 'animal-product' && visit.animalProductId) {
    return (state.inventory.animalProducts[visit.animalProductId] || 0) >= visit.amount;
  }
  return false;
}

function makeFarmFocusGoal(goal: Omit<FarmFocusGoal, 'progress' | 'target' | 'percent'> & { progress?: number; target?: number }): FarmFocusGoal {
  const target = Math.max(1, Math.round(clamp(goal.target, 1, 1, 9999)));
  const progress = Math.round(clamp(goal.progress, 0, 0, target));
  return {
    ...goal,
    progress,
    target,
    percent: Math.round((progress / target) * 100),
  };
}

function canAffordFarmBuilding(state: FarmCanvasState, buildingId: string) {
  const building = FARM_BUILDING_DEFINITIONS[buildingId];
  if (!building) return false;
  return (building.cost.gold || 0) <= state.resources.gold
    && (building.cost.wood || 0) <= state.resources.wood
    && (building.cost.stone || 0) <= state.resources.stone;
}

export function buildFarmFocusGoals(
  stateInput: FarmCanvasState | undefined,
  options: { maxGoals?: number } = {},
): FarmFocusGoal[] {
  const state = sanitizeFarmCanvasState(stateInput);
  const maxGoals = Math.round(clamp(options.maxGoals, 4, 1, 8));
  const plots = state.objects.filter((object) => object.kind === 'plot');
  const maturePlots = plots.filter((object) => object.crop && cropStageForDays(object.crop) === 'mature');
  const dryGrowingPlots = plots.filter((object) => {
    if (!object.crop) return false;
    const stage = cropStageForDays(object.crop);
    return stage !== 'mature' && stage !== 'withered' && !object.crop.wateredToday;
  });
  const emptyPlots = plots.filter((object) => !object.crop);
  const growingPlots = plots.filter((object) => {
    if (!object.crop) return false;
    const stage = cropStageForDays(object.crop);
    return stage !== 'mature' && stage !== 'withered';
  });
  const seedCount = Object.values(state.resources.seeds || {}).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const readyOrder = state.orders.find((order) => canCompleteFarmOrder(state, order.id));
  const activeNpcVisit = getActiveFarmNpcVisit(state);
  const npcReady = activeNpcVisit && canCompleteFarmNpcVisit(state, activeNpcVisit.id);
  const buildingEffects = getFarmBuildingEffects(state);
  const scarecrowRiskCount = countFarmScarecrowUnprotectedDryCrops(state);
  const decorCount = state.objects.filter((object) => object.kind === 'decor').length;
  const beautyScore = buildFarmBeautyScore(state);
  const nextBeautyReward = buildFarmBeautyRewards(state).find((reward) => !reward.unlocked);
  const seasonProgress = farmSeasonProgress(state.day);
  const goals: FarmFocusGoal[] = [];

  if (maturePlots.length > 0) {
    goals.push(makeFarmFocusGoal({
      id: 'harvest-ready',
      kind: 'reward',
      title: `收获 ${maturePlots.length} 块成熟作物`,
      detail: '成熟地块已经在 MiniMap 上点亮，先收一轮最有金币和图鉴反馈。',
      progress: maturePlots.length,
      target: maturePlots.length,
      actionLabel: '定位收获',
      action: { kind: 'jump-mature' },
      ready: true,
    }));
  }

  if (readyOrder) {
    const totalRequired = readyOrder.requirements.reduce((sum, requirement) => sum + requirement.amount, 0);
    goals.push(makeFarmFocusGoal({
      id: `order-${readyOrder.id}`,
      kind: 'reward',
      title: `交付订单：${readyOrder.title}`,
      detail: `材料已备齐，交付后可获得 ${readyOrder.rewards.gold || 0} 金和额外奖励。`,
      progress: totalRequired,
      target: totalRequired,
      actionLabel: '交付订单',
      action: { kind: 'complete-order', orderId: readyOrder.id },
      ready: true,
    }));
  }

  if (activeNpcVisit && npcReady) {
    goals.push(makeFarmFocusGoal({
      id: `npc-${activeNpcVisit.id}`,
      kind: 'social',
      title: `交付来访：${activeNpcVisit.visitorName}`,
      detail: activeNpcVisit.message,
      progress: activeNpcVisit.amount,
      target: activeNpcVisit.amount,
      actionLabel: '交付来访',
      action: { kind: 'complete-npc', visitId: activeNpcVisit.id },
      ready: true,
    }));
  }

  if (dryGrowingPlots.length > 0 && state.resources.water > 0) {
    goals.push(makeFarmFocusGoal({
      id: 'water-today',
      kind: 'urgent',
      title: `给 ${dryGrowingPlots.length} 块作物浇水`,
      detail: `水桶还剩 ${state.resources.water}，今天浇过的作物明天才会继续长。`,
      progress: Math.max(0, growingPlots.length - dryGrowingPlots.length),
      target: Math.max(1, growingPlots.length),
      actionLabel: '选择浇水',
      action: { kind: 'select-tool', tool: 'water' },
    }));
  }

  if (scarecrowRiskCount > 0 && canAffordFarmBuilding(state, 'scarecrow')) {
    goals.push(makeFarmFocusGoal({
      id: 'build-scarecrow-protection',
      kind: 'build',
      title: `补稻草人守护 ${scarecrowRiskCount} 块作物`,
      detail: `${scarecrowRiskCount} 块缺水作物不在稻草人 ${FARM_SCARECROW_RADIUS_CELLS} 格守护内，补一个稻草人可减少过天枯萎风险。`,
      progress: buildingEffects.scarecrows,
      target: buildingEffects.scarecrows + 1,
      actionLabel: '选择稻草人',
      action: { kind: 'select-building', buildingId: 'scarecrow' },
    }));
  }

  if (emptyPlots.length > 0 && seedCount > 0) {
    goals.push(makeFarmFocusGoal({
      id: 'seed-empty-plots',
      kind: 'growth',
      title: `播种 ${Math.min(emptyPlots.length, seedCount)} 块空地`,
      detail: '把空地补上种子，下一次过天才会有成长反馈。',
      progress: plots.length - emptyPlots.length,
      target: Math.max(1, plots.length),
      actionLabel: '选择播种',
      action: { kind: 'select-tool', tool: 'seed' },
    }));
  }

  if (state.stats.plotsTilled < 3) {
    goals.push(makeFarmFocusGoal({
      id: 'starter-till',
      kind: 'growth',
      title: '开出第一片 3 块田',
      detail: '先开垦三块地，播种、浇水、收获和第一单都会顺起来。',
      progress: state.stats.plotsTilled,
      target: 3,
      actionLabel: '选择锄地',
      action: { kind: 'select-tool', tool: 'hoe' },
    }));
  }

  if (activeNpcVisit && !npcReady) {
    goals.push(makeFarmFocusGoal({
      id: `npc-${activeNpcVisit.id}`,
      kind: 'social',
      title: `准备来访材料：${activeNpcVisit.visitorName}`,
      detail: activeNpcVisit.message,
      progress: 0,
      target: activeNpcVisit.amount,
      actionLabel: '查看需求',
      action: { kind: 'select-tool', tool: 'select' },
    }));
  }

  if (buildingEffects.wells === 0 && canAffordFarmBuilding(state, 'well')) {
    goals.push(makeFarmFocusGoal({
      id: 'build-well',
      kind: 'build',
      title: '建一口水井',
      detail: `水井会把每日水量提升到 ${BASE_FARM_DAILY_WATER + FARM_WATER_PER_WELL}，连续种植更轻松。`,
      progress: 0,
      target: 1,
      actionLabel: '选择水井',
      action: { kind: 'select-building', buildingId: 'well' },
    }));
  }

  if (buildingEffects.boards === 0 && canAffordFarmBuilding(state, 'board')) {
    goals.push(makeFarmFocusGoal({
      id: 'build-board',
      kind: 'build',
      title: '放下公告板',
      detail: '公告板会优先显示可交付订单，让经营路线更清楚。',
      progress: 0,
      target: 1,
      actionLabel: '选择公告板',
      action: { kind: 'select-building', buildingId: 'board' },
    }));
  }

  if ((decorCount < 5 || beautyScore.score < 45) && isFarmDecorUnlocked(state, FARM_DEFAULT_DECOR_ID)) {
    goals.push(makeFarmFocusGoal({
      id: 'decorate-farm',
      kind: 'decorate',
      title: '铺几块石子小路',
      detail: nextBeautyReward
        ? `当前漂亮度 ${beautyScore.score}/100，下一档奖励：${nextBeautyReward.title}，还差 ${nextBeautyReward.remainingScore} 分。`
        : `当前漂亮度 ${beautyScore.score}/100，${beautyScore.nextHint}。`,
      progress: Math.min(beautyScore.score, 45),
      target: 45,
      actionLabel: '选择装饰',
      action: { kind: 'select-decor', decorId: FARM_DEFAULT_DECOR_ID },
    }));
  }

  if (seasonProgress.dayInSeason >= FARM_SEASON_DAYS - 2) {
    goals.push(makeFarmFocusGoal({
      id: 'season-ending',
      kind: 'season',
      title: `${farmSeasonLabel(state.season)}快结束了`,
      detail: `还剩 ${FARM_SEASON_DAYS - seasonProgress.dayInSeason + 1} 天进入${farmSeasonLabel(seasonProgress.nextSeason)}，可以先清订单和收成熟作物。`,
      progress: seasonProgress.dayInSeason,
      target: FARM_SEASON_DAYS,
      actionLabel: '过一天',
      action: { kind: 'advance-day' },
    }));
  }

  if (goals.length === 0) {
    goals.push(makeFarmFocusGoal({
      id: 'advance-day',
      kind: 'growth',
      title: '推进到下一天',
      detail: '当前地块已经处理完，可以看看天气、动物、来访和作物成长。',
      progress: 1,
      target: 1,
      actionLabel: '过一天',
      action: { kind: 'advance-day' },
      ready: true,
    }));
  }

  return goals.slice(0, maxGoals);
}

export function getActiveFarmFestivalTask(stateInput: FarmCanvasState | undefined): FarmFestivalTask | undefined {
  const state = sanitizeFarmCanvasState(stateInput);
  if (state.weather !== 'festival' || !state.festivalId) return undefined;
  return state.festivalTasks.find((task) => task.festivalId === state.festivalId && !task.completed)
    || state.festivalTasks.find((task) => task.festivalId === state.festivalId);
}

function objectCenter(object: FarmCanvasObject, gridSize: number) {
  const rect = rectOf(object, gridSize);
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function isScarecrowBuilding(object: FarmCanvasObject) {
  return object.kind === 'building' && object.buildingId === 'scarecrow';
}

function isFarmPlotProtectedByScarecrow(object: FarmCanvasObject, scarecrowObjects: FarmCanvasObject[], gridSize: number) {
  if (object.kind !== 'plot' || !object.crop || object.crop.stage === 'withered' || scarecrowObjects.length === 0) return false;
  const plotCenter = objectCenter(object, gridSize);
  const radius = FARM_SCARECROW_RADIUS_CELLS * gridSize;
  return scarecrowObjects.some((scarecrow) => {
    const scarecrowCenter = objectCenter(scarecrow, gridSize);
    return Math.hypot(plotCenter.x - scarecrowCenter.x, plotCenter.y - scarecrowCenter.y) <= radius;
  });
}

export function isFarmPlotNeedingScarecrowProtection(object: FarmCanvasObject, state: FarmCanvasState, scarecrowObjects: FarmCanvasObject[]) {
  if (object.kind !== 'plot' || !object.crop || object.crop.stage === 'withered') return false;
  if (object.crop.wateredToday) return false;
  if (state.weather === 'rainy' && canRainWaterCrop(object)) return false;
  return isFarmPlotProtectedByScarecrow(object, scarecrowObjects, state.gridSize);
}

export function countFarmScarecrowUnprotectedDryCrops(stateInput: FarmCanvasState | undefined) {
  const state = sanitizeFarmCanvasState(stateInput);
  const scarecrowObjects = state.objects.filter(isScarecrowBuilding);
  return state.objects.filter((object) => {
    if (object.kind !== 'plot' || !object.crop || object.crop.stage === 'withered') return false;
    if (object.crop.wateredToday || object.crop.dryDays <= 0) return false;
    if (state.weather === 'rainy' && canRainWaterCrop(object)) return false;
    return !isFarmPlotProtectedByScarecrow(object, scarecrowObjects, state.gridSize);
  }).length;
}

function miniMapMarkerRect(object: FarmCanvasObject, gridSize: number) {
  const rect = rectOf(object, gridSize);
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function farmMiniMapMarkerPriority(kind: FarmMiniMapMarkerKind) {
  if (kind === 'order') return 0;
  if (kind === 'npc') return 1;
  if (kind === 'rare') return 2;
  if (kind === 'mature') return 3;
  if (kind === 'dry') return 4;
  if (kind === 'withered') return 5;
  if (kind === 'building') return 6;
  if (kind === 'animal') return 7;
  if (kind === 'cluster') return 8;
  return 9;
}

function sortFarmMiniMapMarkers(markers: FarmMiniMapMarker[]) {
  return markers
    .slice()
    .sort((a, b) => farmMiniMapMarkerPriority(a.kind) - farmMiniMapMarkerPriority(b.kind) || a.id.localeCompare(b.id));
}

function farmMiniMapMarkerKindLabel(kind: FarmMiniMapClusterChildKind) {
  if (kind === 'mature') return '成熟';
  if (kind === 'dry') return '缺水';
  if (kind === 'withered') return '枯萎';
  if (kind === 'building') return '建筑';
  if (kind === 'path') return '道路';
  if (kind === 'order') return '订单';
  if (kind === 'npc') return '来访';
  if (kind === 'rare') return '惊喜';
  return '动物';
}

function uniqueFarmMiniMapRouteTargets(
  targets: Array<FarmMiniMapRouteHintTarget | '' | false | null | undefined>,
) {
  return Array.from(new Set(targets.filter((target): target is FarmMiniMapRouteHintTarget => Boolean(target))));
}

export function farmMiniMapMarkerMatchesRouteTarget(
  marker: FarmMiniMapMarker | null | undefined,
  target: FarmMiniMapRouteHintTarget | '' | null | undefined,
) {
  if (!marker || !target) return false;
  return Boolean(marker.routeTargets?.includes(target));
}

function makeFarmMiniMapClusterMarker(
  markers: FarmMiniMapMarker[],
  cellX: number,
  cellY: number,
  gridSize: number,
): FarmMiniMapMarker {
  const sorted = sortFarmMiniMapMarkers(markers);
  const minX = Math.min(...markers.map((marker) => marker.x));
  const minY = Math.min(...markers.map((marker) => marker.y));
  const maxX = Math.max(...markers.map((marker) => marker.x + marker.width));
  const maxY = Math.max(...markers.map((marker) => marker.y + marker.height));
  const clusterKinds = Array.from(
    new Set(sorted.map((marker) => marker.kind).filter((kind): kind is FarmMiniMapClusterChildKind => kind !== 'cluster')),
  );
  const routeTargets = uniqueFarmMiniMapRouteTargets(sorted.flatMap((marker) => marker.routeTargets || []));
  const kindSummary = clusterKinds.slice(0, 3).map(farmMiniMapMarkerKindLabel).join('、') || '标记';
  return {
    id: `cluster-${cellX}-${cellY}-${clusterKinds.join('-') || 'mixed'}-${markers.length}`,
    kind: 'cluster',
    x: minX,
    y: minY,
    width: Math.max(gridSize * 0.72, maxX - minX),
    height: Math.max(gridSize * 0.72, maxY - minY),
    label: `${kindSummary}标记 x${markers.length}`,
    clusterCount: markers.length,
    clusterKinds,
    ...(routeTargets.length > 0 ? { routeTargets } : {}),
  };
}

function clusterFarmMiniMapMarkers(
  markers: FarmMiniMapMarker[],
  state: FarmCanvasState,
  maxClusters: number,
  strictLarge: boolean,
) {
  if (markers.length === 0 || maxClusters <= 0) return [];
  let cellSize = Math.max(state.gridSize * (strictLarge ? 2 : 1), strictLarge ? 128 : 64);
  let clusters: FarmMiniMapMarker[] = [];

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const groups = new Map<string, { cellX: number; cellY: number; markers: FarmMiniMapMarker[] }>();
    markers.forEach((marker) => {
      const centerX = marker.x + marker.width / 2;
      const centerY = marker.y + marker.height / 2;
      const cellX = Math.floor(centerX / cellSize);
      const cellY = Math.floor(centerY / cellSize);
      const key = `${cellX}:${cellY}`;
      const group = groups.get(key) || { cellX, cellY, markers: [] };
      group.markers.push(marker);
      groups.set(key, group);
    });

    clusters = Array.from(groups.values()).map((group) => (
      group.markers.length === 1 && !strictLarge
        ? group.markers[0]
        : makeFarmMiniMapClusterMarker(group.markers, group.cellX, group.cellY, state.gridSize)
    ));
    if (clusters.length <= maxClusters) break;
    cellSize *= 2;
  }

  return sortFarmMiniMapMarkers(clusters).slice(0, maxClusters);
}

function compactFarmMiniMapMarkers(
  markers: FarmMiniMapMarker[],
  state: FarmCanvasState,
  maxMarkers: number,
) {
  const objectVolume = state.objects.length + state.animals.length;
  const strictLarge = objectVolume > 1000 || markers.length > 1000;
  const shouldCluster = strictLarge || objectVolume > 500 || markers.length > maxMarkers;
  if (!shouldCluster) return sortFarmMiniMapMarkers(markers).slice(0, maxMarkers);

  const buildingCount = markers.filter((marker) => marker.kind === 'building').length;
  const buildingKeepLimit = strictLarge ? 24 : 48;
  const kept: FarmMiniMapMarker[] = [];
  const candidates: FarmMiniMapMarker[] = [];

  markers.forEach((marker) => {
    const highSignal = marker.kind === 'order' || marker.kind === 'npc' || marker.kind === 'rare' || marker.kind === 'mature';
    const keepBuilding = marker.kind === 'building' && buildingCount <= buildingKeepLimit;
    if (highSignal || keepBuilding) {
      kept.push(marker);
    } else {
      candidates.push(marker);
    }
  });

  const keptMarkers = sortFarmMiniMapMarkers(kept).slice(0, maxMarkers);
  const remainingSlots = maxMarkers - keptMarkers.length;
  if (remainingSlots <= 0) return keptMarkers;

  if (!strictLarge && candidates.length <= remainingSlots) {
    return sortFarmMiniMapMarkers([...keptMarkers, ...candidates]).slice(0, maxMarkers);
  }

  const clustered = clusterFarmMiniMapMarkers(candidates, state, remainingSlots, strictLarge);
  return sortFarmMiniMapMarkers([...keptMarkers, ...clustered]).slice(0, maxMarkers);
}

export function buildFarmMiniMapMarkers(
  stateInput: FarmCanvasState | undefined,
  options: { maxMarkers?: number } = {},
): FarmMiniMapMarker[] {
  const state = sanitizeFarmCanvasState(stateInput);
  const maxMarkers = Math.round(clamp(options.maxMarkers, 120, 1, 260));
  const markers: FarmMiniMapMarker[] = [];
  const scarecrowObjects = state.objects.filter(isScarecrowBuilding);

  state.objects.forEach((object) => {
    const rect = miniMapMarkerRect(object, state.gridSize);
    if (object.kind === 'plot' && object.crop) {
      const crop = { ...object.crop, stage: cropStageForDays(object.crop) };
      if (crop.stage === 'mature') {
        markers.push({
          id: `mature-${object.id}`,
          kind: 'mature',
          ...rect,
          label: `${FARM_CROP_DEFINITIONS[crop.cropId]?.label || '作物'}成熟`,
          objectId: object.id,
          routeTargets: ['mature-crop'],
        });
        return;
      }
      if (crop.stage === 'withered') {
        markers.push({
          id: `withered-${object.id}`,
          kind: 'withered',
          ...rect,
          label: `${FARM_CROP_DEFINITIONS[crop.cropId]?.label || '作物'}枯萎待清理`,
          objectId: object.id,
          routeTargets: ['withered-crop'],
        });
        return;
      }
      if (!crop.wateredToday) {
        const routeTargets = uniqueFarmMiniMapRouteTargets([
          'water',
          object.crop.dryDays > 0 && !isFarmPlotProtectedByScarecrow(object, scarecrowObjects, state.gridSize)
            ? 'scarecrow-risk'
            : undefined,
        ]);
        markers.push({
          id: `dry-${object.id}`,
          kind: 'dry',
          ...rect,
          label: `${FARM_CROP_DEFINITIONS[crop.cropId]?.label || '作物'}待浇水`,
          objectId: object.id,
          routeTargets,
        });
        return;
      }
    }

    if (object.kind === 'building') {
      const routeTargets = uniqueFarmMiniMapRouteTargets([
        'building-yield-summary',
        'beauty',
        object.buildingId === 'hut' ? 'day' : undefined,
        object.buildingId === 'board' ? 'ready-order' : undefined,
        object.buildingId === 'scarecrow' ? 'scarecrow-risk' : undefined,
      ]);
      markers.push({
        id: `building-${object.id}`,
        kind: 'building',
        ...rect,
        label: FARM_BUILDING_DEFINITIONS[object.buildingId || '']?.label || '牧场建筑',
        objectId: object.id,
        routeTargets,
      });
      return;
    }

    const decorDefinition = object.kind === 'decor' ? FARM_DECOR_DEFINITIONS[object.decorId || ''] : undefined;
    if (object.kind === 'path' || decorDefinition?.category === 'path' || object.objectType === 'tile') {
      markers.push({
        id: `path-${object.id}`,
        kind: 'path',
        ...rect,
        label: decorDefinition?.label || '道路 / 地砖',
        objectId: object.id,
        routeTargets: ['beauty'],
      });
    }
  });

  if (state.animals.length > 0) {
    const animalHome = state.objects.find((object) => object.kind === 'building' && object.buildingId === 'hut')
      || state.objects.find((object) => object.kind === 'building')
      || state.objects[0];
    const homeCenter = animalHome ? objectCenter(animalHome, state.gridSize) : { x: 0, y: 0 };
    state.animals.slice(0, 16).forEach((animal, index) => {
      const definition = FARM_ANIMAL_DEFINITIONS[animal.kind];
      const offsetX = ((index % 4) - 1.5) * state.gridSize * 0.34;
      const offsetY = (Math.floor(index / 4) + 0.8) * state.gridSize * 0.28;
      markers.push({
        id: `animal-${animal.id}`,
        kind: 'animal',
        x: homeCenter.x + offsetX - state.gridSize / 4,
        y: homeCenter.y + offsetY - state.gridSize / 4,
        width: state.gridSize / 2,
        height: state.gridSize / 2,
        label: `${animal.name || definition.label}：${definition.productLabel}`,
        animalId: animal.id,
      });
    });
  }

  const readyOrder = state.orders.find((order) => canCompleteFarmOrder(state, order.id));
  if (readyOrder) {
    const orderTarget = state.objects.find((object) => object.kind === 'building' && object.buildingId === 'board')
      || state.objects.find((object) => object.kind === 'building')
      || state.objects[0];
    const center = orderTarget ? objectCenter(orderTarget, state.gridSize) : { x: 0, y: 0 };
    markers.push({
      id: `order-${readyOrder.id}`,
      kind: 'order',
      x: center.x - state.gridSize / 2,
      y: center.y - state.gridSize / 2,
      width: state.gridSize,
      height: state.gridSize,
      label: `可交付：${readyOrder.title}`,
      objectId: orderTarget?.id,
      orderId: readyOrder.id,
      routeTargets: ['ready-order'],
    });
  }

  const activeNpcVisit = getActiveFarmNpcVisit(state);
  if (activeNpcVisit && !activeNpcVisit.completed) {
    const npcTarget = state.objects.find((object) => object.kind === 'building' && object.buildingId === 'board')
      || state.objects.find((object) => object.kind === 'building' && object.buildingId === 'hut')
      || state.objects.find((object) => object.kind === 'building')
      || state.objects[0];
    const center = npcTarget ? objectCenter(npcTarget, state.gridSize) : { x: state.gridSize * 2, y: state.gridSize * 2 };
    const ready = canCompleteFarmNpcVisit(state, activeNpcVisit.id);
    markers.push({
      id: `npc-${activeNpcVisit.id}`,
      kind: 'npc',
      x: center.x + state.gridSize * 0.52,
      y: center.y - state.gridSize * 0.5,
      width: state.gridSize * 0.72,
      height: state.gridSize * 0.72,
      label: ready ? `来访可交付：${activeNpcVisit.visitorName}` : `来访委托：${activeNpcVisit.visitorName}`,
      objectId: npcTarget?.id,
      npcVisitId: activeNpcVisit.id,
      visitorId: activeNpcVisit.visitorId,
      routeTargets: ['ready-npc'],
    });
  }

  const todayRareEvent = state.rareEvents.find((event) => event.day === state.day);
  if (todayRareEvent) {
    const rareTarget = state.objects.find((object) => object.kind === 'building' && object.buildingId === 'board')
      || state.objects.find((object) => object.kind === 'building' && object.buildingId === 'hut')
      || state.objects.find((object) => object.kind === 'building')
      || state.objects[0];
    const center = rareTarget ? objectCenter(rareTarget, state.gridSize) : { x: state.gridSize * 2, y: state.gridSize * 2 };
    markers.push({
      id: `rare-${todayRareEvent.id}`,
      kind: 'rare',
      x: center.x + state.gridSize * 0.08,
      y: center.y - state.gridSize * 0.86,
      width: state.gridSize * 0.64,
      height: state.gridSize * 0.64,
      label: `今日惊喜：${todayRareEvent.title}`,
      objectId: rareTarget?.id,
      rareEventId: todayRareEvent.id,
      routeTargets: ['rare-event'],
    });
  }

  return compactFarmMiniMapMarkers(markers, state, maxMarkers);
}

function buildFarmDailySummary(previous: FarmCanvasState, next: FarmCanvasState): FarmDailySummary {
  const previousById = new Map(previous.objects.map((object) => [object.id, object]));
  const buildingEffects = getFarmBuildingEffects(previous);
  const scarecrowObjects = previous.objects.filter(isScarecrowBuilding);
  const seasonChanged = previous.season !== next.season;
  const harvestedCrops = countFarmEvents(previous, 'crop_harvested');
  const ordersCompleted = countFarmEvents(previous, 'order_completed');
  const goldEarned = sumFarmEventAmounts(previous, 'order_completed');
  const npcVisitsCompleted = countFarmEvents(previous, 'npc_request_completed');
  const npcGoldEarned = sumFarmEventAmounts(previous, 'npc_request_completed');
  const rareEventsFound = countFarmEvents(previous, 'rare_event');
  const rareEventSummary = previous.eventLog
    .filter((event) => event.day === previous.day && event.kind === 'rare_event')
    .map((event) => event.message)
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');
  const rainWateredCrops = previous.weather === 'rainy'
    ? previous.objects.filter(canRainWaterCrop).length
    : 0;
  const festivalBonusGold = previous.weather === 'festival' && goldEarned > 0
    ? Math.max(0, goldEarned - Math.round(goldEarned / FARM_FESTIVAL_ORDER_GOLD_MULTIPLIER))
    : 0;
  const festivalTasksCompleted = previous.weather === 'festival'
    ? previous.festivalTasks.filter((task) => task.festivalId === previous.festivalId && task.completed && task.completedDay === previous.day).length
    : 0;
  const animalProductDeltas = diffAnimalProducts(previous.inventory.animalProducts, next.inventory.animalProducts);
  const animalProductsProduced = Object.values(animalProductDeltas).reduce((total, amount) => total + (Number(amount) || 0), 0);
  const animalProductSummary = formatAnimalProductTotals(animalProductDeltas);
  const readyOrders = next.orders.filter((order) => !order.completed && canCompleteFarmOrder(next, order.id)).length;
  const readyNpcVisits = next.npcVisits.filter((visit) => !visit.completed && canCompleteFarmNpcVisit(next, visit.id)).length;
  const dailyWaterCapacity = buildingEffects.dailyWaterCapacity;
  const scarecrowProtectedCrops = previous.objects.filter((object) => isFarmPlotNeedingScarecrowProtection(object, previous, scarecrowObjects)).length;
  const wateredCrops = previous.objects.filter((object) => object.kind === 'plot' && object.crop?.wateredToday).length + rainWateredCrops;
  const dryCrops = next.objects.filter((object) => object.kind === 'plot' && object.crop && object.crop.dryDays > 0 && object.crop.stage !== 'withered').length;
  const witheredCrops = next.objects.filter((object) => object.kind === 'plot' && object.crop?.stage === 'withered').length;
  const matureCrops = next.objects.filter(isMatureCrop).length;
  const newMatureCrops = next.objects.filter((object) => {
    if (!isMatureCrop(object)) return false;
    const previousObject = previousById.get(object.id);
    return !previousObject || previousObject.crop?.stage !== 'mature';
  }).length;
  const nextMatureCrops = next.objects.filter((object) => {
    if (object.kind !== 'plot' || !object.crop || object.crop.stage === 'mature' || object.crop.stage === 'withered') return false;
    const definition = FARM_CROP_DEFINITIONS[object.crop.cropId];
    return definition.growthDays - object.crop.daysGrown <= 1;
  }).length;
  const highlights = [
    harvestedCrops > 0 ? `今日收获 ${harvestedCrops} 个作物` : '',
    ordersCompleted > 0 ? `完成 ${ordersCompleted} 个订单，金币 +${goldEarned}` : '',
    npcVisitsCompleted > 0 ? `完成 ${npcVisitsCompleted} 个来访委托，金币 +${npcGoldEarned}` : '',
    rainWateredCrops > 0 ? `雨天自动照料 ${rainWateredCrops} 块地` : '',
    festivalBonusGold > 0 ? `节庆订单加成 +${festivalBonusGold} 金` : '',
    festivalTasksCompleted > 0 ? `节庆委托完成 ${festivalTasksCompleted} 个` : '',
    animalProductsProduced > 0 ? `动物产出 ${animalProductSummary}` : '',
    rareEventsFound > 0 ? `发现惊喜 ${rareEventSummary || `${rareEventsFound} 件`}` : '',
    seasonChanged ? `换季到${farmSeasonLabel(next.season)}：${FARM_SEASON_DEFINITIONS[next.season].themeLabel}` : '',
    wateredCrops > 0 ? `浇水照料 ${wateredCrops} 块地` : '',
    dryCrops > 0 ? `今日还有 ${dryCrops} 块地缺水` : '',
    scarecrowProtectedCrops > 0 ? `稻草人守护 ${scarecrowProtectedCrops} 块地` : '',
    newMatureCrops > 0 ? `${newMatureCrops} 块作物已经成熟` : '',
    witheredCrops > 0 ? `${witheredCrops} 块作物枯萎，记得铲除` : '',
    nextMatureCrops > 0 ? `预计明天 ${nextMatureCrops} 块作物可成熟` : '',
    readyOrders > 0 ? `可交付订单 ${readyOrders} 个，公告板等盖章` : '',
    readyNpcVisits > 0 ? `可交付来访委托 ${readyNpcVisits} 个` : '',
    buildingEffects.wells > 0 ? `水井补水到 ${dailyWaterCapacity}` : '',
  ].filter(Boolean);
  const message = newMatureCrops > 0
    ? `${newMatureCrops} 块作物成熟了，收获篮在等你。`
    : witheredCrops > 0
      ? `${witheredCrops} 块作物枯萎了，先清理再重新播种。`
      : rainWateredCrops > 0
        ? `雨水照料了 ${rainWateredCrops} 块地，作物稳稳长了一截。`
        : festivalBonusGold > 0
          ? festivalTasksCompleted > 0
            ? `节庆订单很热闹，还完成了 ${festivalTasksCompleted} 个节庆委托。`
            : `节庆订单很热闹，额外赚到 ${festivalBonusGold} 金。`
          : scarecrowProtectedCrops > 0
            ? `稻草人守护了 ${scarecrowProtectedCrops} 块地，作物没有继续枯下去。`
          : nextMatureCrops > 0
            ? `第 ${next.day} 天开始，明天会有 ${nextMatureCrops} 块作物接近成熟。`
            : npcVisitsCompleted > 0
              ? `村民来访很顺利，完成了 ${npcVisitsCompleted} 个小委托。`
              : rareEventsFound > 0
                ? `今天的牧场出现了小惊喜：${rareEventSummary || '稀有收获'}。`
                : seasonChanged
                  ? `${farmSeasonLabel(next.season)}开始了，${FARM_SEASON_DEFINITIONS[next.season].hint}`
                  : animalProductsProduced > 0
                    ? `动物小屋今天收到了 ${animalProductSummary}。`
                    : wateredCrops > 0
                      ? `第 ${next.day} 天开始，作物稳稳长了一截。`
                      : buildingEffects.wells > 0
                        ? `第 ${next.day} 天开始，水井把水桶补到了 ${buildingEffects.dailyWaterCapacity}。`
                        : `第 ${next.day} 天开始，牧场今天很安静。`;
  return normalizeDailySummary({
    id: `farm-summary-${previous.day}-${next.day}-${makeEventStamp(previous)}`,
    fromDay: previous.day,
    toDay: next.day,
    weather: previous.weather,
    festivalId: previous.festivalId,
    message,
    harvestedCrops,
    ordersCompleted,
    goldEarned,
    npcVisitsCompleted,
    rareEventsFound,
    rareEventSummary,
    rainWateredCrops,
    festivalBonusGold,
    animalProductsProduced,
    animalProductSummary,
    readyOrders,
    readyNpcVisits,
    dailyWaterCapacity,
    scarecrowProtectedCrops,
    wateredCrops,
    dryCrops,
    witheredCrops,
    newMatureCrops,
    matureCrops,
    nextMatureCrops,
    highlights: highlights.length > 0 ? highlights : ['今日暂无收获，继续布置和照料牧场。'],
    createdAt: makeEventStamp(previous),
  }, next.day) as FarmDailySummary;
}

function farmResourceLabel(key: keyof Pick<FarmCanvasResources, 'gold' | 'wood' | 'stone'>) {
  if (key === 'gold') return '金币';
  if (key === 'wood') return '木材';
  return '石头';
}

function findMissingFarmResources(cost: Partial<Pick<FarmCanvasResources, 'gold' | 'wood' | 'stone'>>, resources: FarmCanvasResources) {
  const missing: Partial<Pick<FarmCanvasResources, 'gold' | 'wood' | 'stone'>> = {};
  (['gold', 'wood', 'stone'] as const).forEach((key) => {
    const required = cost[key] || 0;
    if (required > resources[key]) missing[key] = required;
  });
  return missing;
}

function formatMissingFarmResources(missing: Partial<Pick<FarmCanvasResources, 'gold' | 'wood' | 'stone'>>, resources: FarmCanvasResources) {
  const parts = (['gold', 'wood', 'stone'] as const)
    .filter((key) => missing[key])
    .map((key) => `${farmResourceLabel(key)} ${resources[key]}/${missing[key]}`);
  return parts.length > 0 ? `资源不足：${parts.join('，')}` : '资源不足，无法放置';
}

function describeFarmBlocker(object: FarmCanvasObject | undefined) {
  if (!object) return '放置区域被占用';
  if (object.kind === 'plot' && object.crop) return '挡住作物';
  if (object.kind === 'plot') return '挡住田地';
  if (object.kind === 'building') return '挡住建筑';
  if (object.kind === 'decor') return '挡住装饰';
  return '放置区域被占用';
}

function describeFarmObject(object: FarmCanvasObject | undefined) {
  if (!object) return '牧场物件';
  if (object.kind === 'plot') return object.crop ? '作物地块' : '田地';
  if (object.kind === 'building') return FARM_BUILDING_DEFINITIONS[object.buildingId || '']?.label || '建筑';
  if (object.kind === 'decor') return FARM_DECOR_DEFINITIONS[object.decorId || '']?.label || '装饰';
  if (object.kind === 'path') return '道路';
  return '障碍物';
}

export function farmBuildingActivationHint(buildingId: string | undefined) {
  if (buildingId === 'hut') return '每日结算已就绪';
  if (buildingId === 'storage') return `库存容量 +${FARM_STORAGE_BONUS_PER_BUILDING}`;
  if (buildingId === 'well') return `每日补水 +${FARM_WATER_PER_WELL}`;
  if (buildingId === 'board') return '可交付订单优先显示';
  if (buildingId === 'scarecrow') return `守护半径 ${FARM_SCARECROW_RADIUS_CELLS} 格`;
  return FARM_BUILDING_DEFINITIONS[buildingId || '']?.description || '功能已启用';
}

export function farmDecorActivationHint(decorId: string | undefined, objectType?: FarmDecorObjectType) {
  if (objectType === 'banner') return '资源旗帜已挂起';
  if (objectType === 'poster-wall') return '资源海报墙已上墙';
  if (objectType === 'tile') return '资源地砖已铺好';
  if (objectType === 'sign') return '资源招牌已立好';
  const decor = FARM_DECOR_DEFINITIONS[normalizeFarmDecorId(decorId)];
  if (decor?.category === 'fence') return '边界会自动衔接';
  if (decor?.category === 'path') return '道路会连成路线';
  if (decor?.category === 'flower') return '漂亮度得到点缀';
  if (decor?.category === 'light') return '夜间地块更醒目';
  if (decor?.category === 'sign') return '区域标记已立好';
  if (decor?.category === 'storage') return '谷仓生活感提升';
  return decor?.description || '装饰已生效';
}

function farmPlacementSuccessFeedback(input: {
  kind: 'building' | 'decor' | 'path';
  building?: FarmBuildingDefinition;
  decorId?: string;
  objectType?: FarmDecorObjectType;
}) {
  if (input.kind === 'building') {
    const label = input.building?.label || '建筑';
    return `已建造 ${label} · ${farmBuildingActivationHint(input.building?.id)}`;
  }
  const decorId = normalizeFarmDecorId(input.decorId);
  const label = FARM_DECOR_DEFINITIONS[decorId]?.label || '装饰';
  return `已放置 ${label} · ${farmDecorActivationHint(decorId, input.objectType)}`;
}

export function previewFarmPlacement(
  stateInput: FarmCanvasState,
  input: {
    tool: Extract<FarmTool, 'build' | 'decor'>;
    x: number;
    y: number;
    buildingId?: string;
    decorId?: string;
    objectType?: FarmDecorObjectType;
  },
): FarmPlacementPreview {
  const state = sanitizeFarmCanvasState(stateInput);
  const point = snapFarmPoint({ x: input.x, y: input.y }, state.gridSize);
  const kind: FarmPlacementPreview['kind'] = input.tool === 'build' ? 'building' : 'decor';
  const rawBuildingId = cleanId(input.buildingId || state.selectedBuildingId || 'hut', 'hut');
  const rawDecorId = normalizeFarmDecorId(input.decorId || state.selectedDecorId || FARM_DEFAULT_DECOR_ID);
  const building = kind === 'building' ? FARM_BUILDING_DEFINITIONS[rawBuildingId] : undefined;
  const decor = kind === 'decor' ? FARM_DECOR_DEFINITIONS[rawDecorId] : undefined;
  const widthCells = building?.widthCells || 1;
  const heightCells = building?.heightCells || 1;
  const label = building?.label || decor?.label || (kind === 'building' ? '未知建筑' : '装饰');
  const effectPreview = kind === 'building'
    ? farmBuildingActivationHint(building?.id)
    : farmDecorActivationHint(rawDecorId, input.objectType);
  const base = {
    tool: input.tool,
    kind,
    x: point.x,
    y: point.y,
    widthCells,
    heightCells,
    width: widthCells * state.gridSize,
    height: heightCells * state.gridSize,
    label,
    effectPreview,
    ...(kind === 'building' ? { buildingId: rawBuildingId } : { decorId: rawDecorId }),
  };

  if (kind === 'building' && !building) {
    return {
      ...base,
      canPlace: false,
      status: 'invalid',
      reason: 'unknown-building',
      feedback: '未知建筑，先换一个建造目标',
    };
  }

  if (kind === 'decor' && !isFarmDecorUnlocked(state, rawDecorId)) {
    return {
      ...base,
      canPlace: false,
      status: 'invalid',
      reason: 'decor-locked',
      feedback: FARM_DECOR_DEFINITIONS[rawDecorId]?.unlockHint || '装饰尚未解锁，先完成订单',
    };
  }

  const candidate: Pick<FarmCanvasObject, 'x' | 'y' | 'widthCells' | 'heightCells'> = {
    x: point.x,
    y: point.y,
    widthCells,
    heightCells,
  };
  const cost = building?.cost || {};
  const missingResources = findMissingFarmResources(cost, state.resources);
  if (Object.keys(missingResources).length > 0) {
    return {
      ...base,
      canPlace: false,
      status: 'insufficient-resources',
      reason: 'insufficient-resources',
      missingResources,
      feedback: formatMissingFarmResources(missingResources, state.resources),
    };
  }

  const blocker = findBlockingObject(state, candidate);
  if (blocker) {
    return {
      ...base,
      canPlace: false,
      status: 'blocked',
      reason: 'blocked',
      feedback: describeFarmBlocker(blocker),
    };
  }

  return {
    ...base,
    canPlace: true,
    status: 'ready',
    feedback: kind === 'building'
      ? `可建造 ${label} · ${widthCells}x${heightCells}`
      : `可放置 ${label}`,
  };
}

export function applyFarmTool(stateInput: FarmCanvasState, action: FarmToolAction): FarmToolResult {
  const state = sanitizeFarmCanvasState(stateInput);
  const point = snapFarmPoint({ x: action.x, y: action.y }, state.gridSize);
  const target = findObjectAt(state, point.x, point.y);

  if (action.tool === 'select') {
    return withFeedback({ ...state, selectedTool: action.tool, selectedObjectId: undefined }, '已切换牧场工具', true);
  }

  if (action.tool === 'move') {
    const selectedObject = state.selectedObjectId
      ? state.objects.find((object) => object.id === state.selectedObjectId)
      : undefined;
    if (!selectedObject) {
      if (!target) return withError({ ...state, selectedTool: 'move', selectedObjectId: undefined }, 'empty', '先点一个牧场物件');
      return withFeedback({
        ...state,
        selectedTool: 'move',
        selectedObjectId: target.id,
      }, `已选中 ${describeFarmObject(target)}，再点空地搬过去`);
    }

    if (target && target.id !== selectedObject.id) {
      return withError(state, 'blocked', describeFarmBlocker(target));
    }
    const candidate = {
      ...selectedObject,
      x: point.x,
      y: point.y,
    };
    const blocker = findBlockingObject(state, candidate, selectedObject.id);
    if (blocker) return withError(state, 'blocked', describeFarmBlocker(blocker));
    return withFeedback({
      ...state,
      selectedTool: 'move',
      selectedObjectId: undefined,
      objects: state.objects.map((object) => object.id === selectedObject.id ? candidate : object),
    }, `已移动 ${describeFarmObject(selectedObject)}`);
  }

  if (action.tool === 'hoe') {
    if (target) return withError(state, target.kind === 'plot' ? 'already-tilled' : 'blocked', target.kind === 'plot' ? '这里已经开垦过' : '这里被其他牧场物件挡住');
    const object: FarmCanvasObject = {
      id: action.id || makeId('plot', state),
      kind: 'plot',
      x: point.x,
      y: point.y,
      widthCells: 1,
      heightCells: 1,
      createdDay: state.day,
    };
    return withFeedback({
      ...state,
      selectedTool: 'hoe',
      selectedObjectId: undefined,
      objects: [...state.objects, object].slice(0, MAX_FARM_OBJECTS),
      stats: updateStats(state, { plotsTilled: 1 }),
    }, '+1 已开垦', true, { kind: 'plot_tilled', amount: 1, objectKind: 'plot' });
  }

  if (action.tool === 'seed') {
    if (!target || target.kind !== 'plot') return withError(state, 'missing-plot', '需要先开垦土地');
    if (target.crop) return withError(state, 'already-planted', '这块地已经播种');
    const cropId = action.cropId || 'turnip';
    if (!isFarmCropId(cropId)) return withError(state, 'unknown-crop', '未知作物');
    if ((state.resources.seeds[cropId] || 0) <= 0) return withError(state, 'missing-seed', '种子不足');
    const crop: FarmCropState = {
      cropId,
      plantedDay: state.day,
      daysGrown: 0,
      wateredToday: false,
      dryDays: 0,
      stage: 'seed',
      quality: 'normal',
    };
    return withFeedback({
      ...state,
      selectedTool: 'seed',
      selectedObjectId: undefined,
      resources: normalizeResources({
        ...state.resources,
        seeds: {
          ...state.resources.seeds,
          [cropId]: (state.resources.seeds[cropId] || 0) - 1,
        },
      }),
      objects: state.objects.map((object) => object.id === target.id ? { ...object, crop } : object),
      stats: updateStats(state, { cropsPlanted: 1 }),
    }, `已播种 ${FARM_CROP_DEFINITIONS[cropId].label}`, true, { kind: 'crop_planted', amount: 1, cropId });
  }

  if (action.tool === 'water') {
    if (!target || target.kind !== 'plot' || !target.crop) return withError(state, 'missing-plot', '这里没有可浇水作物');
    if (target.crop.stage === 'withered') return withError(state, 'not-ready', '枯萎作物需要铲除');
    if (target.crop.wateredToday) return withError(state, 'not-ready', '今天已经浇过水');
    if (state.resources.water <= 0) return withError(state, 'missing-water', '水量不足');
    return withFeedback({
      ...state,
      selectedTool: 'water',
      selectedObjectId: undefined,
      resources: normalizeResources({ ...state.resources, water: state.resources.water - 1 }),
      objects: state.objects.map((object) => object.id === target.id && object.crop
        ? { ...object, crop: { ...object.crop, wateredToday: true, dryDays: 0 } }
        : object),
      stats: updateStats(state, { cropsWatered: 1 }),
    }, '已浇水', true, { kind: 'crop_watered', amount: 1, cropId: target.crop.cropId });
  }

  if (action.tool === 'harvest') {
    if (!target || target.kind !== 'plot' || !target.crop) return withError(state, 'empty', '这里没有可收获作物');
    const crop = { ...target.crop, stage: cropStageForDays(target.crop) };
    if (crop.stage !== 'mature') return withError(state, 'not-ready', '作物还没成熟');
    const definition = FARM_CROP_DEFINITIONS[crop.cropId];
    const nextCrop = definition.regrowDays
      ? { ...crop, daysGrown: Math.max(0, definition.growthDays - definition.regrowDays), wateredToday: false, stage: 'growing' as FarmCropStage }
      : undefined;
    const rareEvent = createFarmRareHarvestEvent(state, target, crop);
    let nextState: FarmCanvasState = {
      ...state,
      selectedTool: 'harvest',
      selectedObjectId: undefined,
      inventory: addInventoryCrop(state.inventory, crop.cropId, 1),
      discoveredCropIds: Array.from(new Set([...state.discoveredCropIds, crop.cropId])),
      objects: state.objects.map((object) => object.id === target.id ? { ...object, crop: nextCrop } : object),
      stats: updateStats(state, { cropsHarvested: 1 }),
    };
    nextState = appendFarmEvent(nextState, {
      kind: 'crop_harvested',
      amount: 1,
      cropId: crop.cropId,
      message: `收获 ${definition.label} +1`,
    });
    if (!rareEvent) return { state: nextState, changed: true, feedback: `收获 ${definition.label} +1` };

    nextState = applyReward({
      ...nextState,
      rareEvents: [rareEvent, ...nextState.rareEvents].slice(0, MAX_FARM_RARE_EVENTS),
      stats: updateStats(nextState, { rareEventsFound: 1 }),
    }, rareEvent.rewards);
    nextState = appendFarmEvent(nextState, {
      kind: 'rare_event',
      amount: rareEvent.rewards.gold || 0,
      cropId: crop.cropId,
      rareEventId: rareEvent.id,
      message: `${rareEvent.title}：${rareEvent.message}`,
    });
    return {
      state: nextState,
      changed: true,
      feedback: `发现${rareEvent.title}！${definition.label} +1`,
    };
  }

  if (action.tool === 'shovel' || action.tool === 'delete') {
    if (!target) return withError(state, 'empty', '这里没有可清理物件');
    return withFeedback({
      ...state,
      selectedTool: action.tool,
      selectedObjectId: undefined,
      objects: state.objects.filter((object) => object.id !== target.id),
    }, target.kind === 'plot' ? '已铲除地块' : '已移除牧场物件');
  }

  if (action.tool === 'build') {
    return placeFarmObject(state, {
      kind: 'building',
      x: point.x,
      y: point.y,
      buildingId: action.buildingId || state.selectedBuildingId || 'hut',
      id: action.id,
    });
  }

  if (action.tool === 'decor') {
    return placeFarmObject(state, {
      kind: 'decor',
      x: point.x,
      y: point.y,
      decorId: action.decorId || state.selectedDecorId || FARM_DEFAULT_DECOR_ID,
      resourceId: action.resourceId,
      skinId: action.skinId,
      objectType: action.objectType,
      id: action.id,
    });
  }

  return withError(state, 'empty', '工具暂未接入');
}

export function advanceFarmDay(stateInput: FarmCanvasState): FarmCanvasState {
  const state = sanitizeFarmCanvasState(stateInput);
  const buildingEffects = getFarmBuildingEffects(state);
  const scarecrowObjects = state.objects.filter(isScarecrowBuilding);
  const animalProduction = produceFarmAnimalProducts(state);
  const nextDay = state.day + 1;
  const nextSeason = farmSeasonForDay(nextDay);
  const nextWeather = farmWeatherForDay(nextDay, nextSeason);
  const nextFestivalId = nextWeather === 'festival'
    ? farmFestivalIdForDay(nextDay, nextSeason)
    : undefined;
  const rainyDay = state.weather === 'rainy';
  const nextState = {
    ...state,
    day: nextDay,
    season: nextSeason,
    weather: nextWeather,
    festivalId: nextFestivalId,
    festivalTasks: normalizeFestivalTasks(state.festivalTasks, nextDay, nextSeason, nextWeather, nextFestivalId),
    npcVisits: normalizeFarmNpcVisits(state.npcVisits, nextDay, nextSeason),
    resources: normalizeResources({ ...state.resources, water: Math.max(state.resources.water, buildingEffects.dailyWaterCapacity) }),
    inventory: addAnimalProducts(state.inventory, animalProduction.products),
    animals: animalProduction.animals,
    objects: state.objects.map((object) => {
      if (object.kind !== 'plot' || !object.crop) return object;
      const crop = object.crop;
      const growsToday = crop.wateredToday || (rainyDay && canRainWaterCrop(object));
      const protectedByScarecrow = !growsToday && isFarmPlotNeedingScarecrowProtection(object, state, scarecrowObjects);
      const nextCrop: FarmCropState = growsToday
        ? {
            ...crop,
            daysGrown: crop.daysGrown + 1,
            wateredToday: false,
            dryDays: 0,
          }
        : protectedByScarecrow
          ? {
              ...crop,
              wateredToday: false,
            }
        : {
            ...crop,
            wateredToday: false,
            dryDays: crop.dryDays + 1,
          };
      return {
        ...object,
        crop: {
          ...nextCrop,
          stage: protectedByScarecrow ? crop.stage : cropStageForDays(nextCrop),
        },
      };
    }),
    stats: updateStats(state, { daysAdvanced: 1 }),
  };
  const summary = buildFarmDailySummary(state, nextState);
  return appendFarmEvent({ ...nextState, lastDailySummary: summary }, {
    kind: 'day_advanced',
    amount: nextState.day,
    message: summary.message,
  });
}

export function placeFarmObject(
  stateInput: FarmCanvasState,
  input: {
    kind: 'building' | 'decor' | 'path';
    x: number;
    y: number;
    id?: string;
    buildingId?: string;
    decorId?: string;
    resourceId?: string;
    skinId?: string;
    objectType?: FarmDecorObjectType;
  },
): FarmToolResult {
  const state = sanitizeFarmCanvasState(stateInput);
  const point = snapFarmPoint({ x: input.x, y: input.y }, state.gridSize);
  const effectiveBuildingId = input.kind === 'building'
    ? input.buildingId || state.selectedBuildingId || 'hut'
    : undefined;
  const effectiveDecorId = input.kind === 'decor'
    ? input.decorId || state.selectedDecorId || FARM_DEFAULT_DECOR_ID
    : undefined;
  const fallbackResourceDecor = input.kind === 'decor' && effectiveDecorId && FARM_RESOURCE_DECOR_IDS.has(effectiveDecorId)
    ? state.selectedResourceDecor
    : undefined;
  const resourceObjectType = input.kind === 'decor'
    ? normalizeFarmDecorObjectType(input.objectType) || fallbackResourceDecor?.objectType
    : undefined;
  const resourceId = input.kind === 'decor'
    ? input.resourceId || fallbackResourceDecor?.resourceId
    : undefined;
  const skinId = input.skinId || fallbackResourceDecor?.skinId;
  const previewTool = input.kind === 'building' ? 'build' : input.kind === 'decor' ? 'decor' : undefined;
  if (previewTool) {
    const preview = previewFarmPlacement(state, {
      tool: previewTool,
      x: input.x,
      y: input.y,
      buildingId: effectiveBuildingId,
      decorId: effectiveDecorId,
    });
    if (!preview.canPlace) {
      return withError(state, preview.reason || 'blocked', preview.feedback);
    }
  }
  const building = input.kind === 'building'
    ? FARM_BUILDING_DEFINITIONS[effectiveBuildingId || 'hut']
    : undefined;
  if (input.kind === 'building' && !building) return withError(state, 'unknown-building', '未知建筑');

  const cost = building?.cost || {};
  if ((cost.gold || 0) > state.resources.gold || (cost.wood || 0) > state.resources.wood || (cost.stone || 0) > state.resources.stone) {
    return withError(state, 'insufficient-resources', '资源不足，无法放置');
  }

  const object: FarmCanvasObject = {
    id: input.id || makeId(input.kind, state),
    kind: input.kind,
    x: point.x,
    y: point.y,
    widthCells: building?.widthCells || 1,
    heightCells: building?.heightCells || 1,
    createdDay: state.day,
    ...(building ? { buildingId: building.id } : {}),
    ...(input.kind === 'decor' ? { decorId: normalizeFarmDecorId(effectiveDecorId) } : {}),
    ...(input.kind === 'decor' && resourceId && !/^data:/i.test(resourceId) ? { resourceId: cleanId(resourceId, 'resource') } : {}),
    ...(input.kind === 'decor' && resourceObjectType ? { objectType: resourceObjectType } : {}),
    ...(skinId ? { skinId: cleanId(skinId, 'default') } : {}),
  };

  if (hasBlockingObject(state, object)) {
    return withError(state, 'blocked', '放置区域被占用');
  }

  const feedback = farmPlacementSuccessFeedback({
    kind: input.kind,
    building,
    decorId: effectiveDecorId,
    objectType: resourceObjectType,
  });

  return withFeedback({
    ...state,
    selectedTool: input.kind === 'building' ? 'build' : 'decor',
    selectedBuildingId: input.kind === 'building' && building ? building.id : state.selectedBuildingId,
    selectedDecorId: input.kind === 'decor' ? normalizeFarmDecorId(effectiveDecorId) : state.selectedDecorId,
    selectedObjectId: undefined,
    resources: normalizeResources({
      ...state.resources,
      gold: state.resources.gold - (cost.gold || 0),
      wood: state.resources.wood - (cost.wood || 0),
      stone: state.resources.stone - (cost.stone || 0),
    }),
    objects: [...state.objects, object].slice(0, MAX_FARM_OBJECTS),
    stats: updateStats(state, {
      objectsPlaced: 1,
      buildingsPlaced: input.kind === 'building' ? 1 : 0,
      decorPlaced: input.kind === 'decor' ? 1 : 0,
    }),
  }, feedback, true, {
    kind: input.kind === 'building' ? 'building_placed' : 'decor_placed',
    amount: 1,
    objectKind: input.kind,
  });
}

export function completeFarmOrder(stateInput: FarmCanvasState, orderId: string): FarmToolResult {
  const state = sanitizeFarmCanvasState(stateInput);
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return withError(state, 'order-not-found', '找不到这个订单');
  if (order.completed) return withError(state, 'order-completed', '订单已经完成');
  const canComplete = order.requirements.every((requirement) =>
    (state.inventory.crops[requirement.cropId] || 0) >= requirement.amount);
  if (!canComplete) return withError(state, 'order-requirements-missing', '订单材料不足');

  const crops = { ...state.inventory.crops };
  order.requirements.forEach((requirement) => {
    crops[requirement.cropId] = Math.max(0, (crops[requirement.cropId] || 0) - requirement.amount);
  });
  const baseGold = order.rewards.gold || 0;
  const festivalBonusGold = state.weather === 'festival'
    ? Math.max(0, Math.round(baseGold * (FARM_FESTIVAL_ORDER_GOLD_MULTIPLIER - 1)))
    : 0;
  const reward = festivalBonusGold > 0
    ? { ...order.rewards, gold: baseGold + festivalBonusGold }
    : order.rewards;
  const activeFestivalTask = state.weather === 'festival'
    ? getActiveFarmFestivalTask(state)
    : undefined;
  const canProgressFestivalTask = activeFestivalTask?.kind === 'complete-orders' && !activeFestivalTask.completed;
  const nextFestivalTaskProgress = canProgressFestivalTask
    ? Math.min(activeFestivalTask.target, activeFestivalTask.progress + 1)
    : activeFestivalTask?.progress;
  const festivalTaskCompleted = Boolean(canProgressFestivalTask && nextFestivalTaskProgress === activeFestivalTask?.target);
  const nextFestivalTasks = canProgressFestivalTask && activeFestivalTask
    ? state.festivalTasks.map((task) => task.id === activeFestivalTask.id
      ? {
          ...task,
          progress: nextFestivalTaskProgress || task.progress,
          completed: festivalTaskCompleted ? true : task.completed,
          completedDay: festivalTaskCompleted ? state.day : task.completedDay,
        }
      : task)
    : state.festivalTasks;
  const rewarded = applyReward({
    ...state,
    inventory: {
      ...state.inventory,
      crops,
    },
    orders: state.orders.map((item) => item.id === order.id ? { ...item, completed: true } : item),
    festivalTasks: nextFestivalTasks,
    stats: updateStats(state, { ordersCompleted: 1 }),
  }, reward);
  const finalState = festivalTaskCompleted && activeFestivalTask
    ? applyReward(rewarded, activeFestivalTask.rewards)
    : rewarded;
  const feedback = festivalTaskCompleted && activeFestivalTask
    ? `${festivalBonusGold > 0 ? '节庆订单完成' : '订单完成'} +${reward.gold || 0} 金，委托完成：${activeFestivalTask.title}`
    : festivalBonusGold > 0 ? `节庆订单完成 +${reward.gold || 0} 金` : `订单完成 +${reward.gold || 0} 金`;
  return withFeedback(finalState, feedback, true, {
    kind: 'order_completed',
    amount: reward.gold || 0,
    orderId: order.id,
  });
}

export function completeFarmNpcVisit(stateInput: FarmCanvasState, visitId: string): FarmToolResult {
  const state = sanitizeFarmCanvasState(stateInput);
  const visit = state.npcVisits.find((item) => item.id === visitId);
  if (!visit) return withError(state, 'order-not-found', '找不到这个来访委托');
  if (visit.completed) return withError(state, 'order-completed', '这个来访委托已经完成');
  if (!canCompleteFarmNpcVisit(state, visit.id)) return withError(state, 'order-requirements-missing', '来访委托材料不足');

  const crops = { ...state.inventory.crops };
  const animalProducts = { ...state.inventory.animalProducts };
  if (visit.requestKind === 'crop' && visit.cropId) {
    crops[visit.cropId] = Math.max(0, (crops[visit.cropId] || 0) - visit.amount);
  }
  if (visit.requestKind === 'animal-product' && visit.animalProductId) {
    animalProducts[visit.animalProductId] = Math.max(0, (animalProducts[visit.animalProductId] || 0) - visit.amount);
  }

  const rewarded = applyReward({
    ...state,
    inventory: normalizeInventory({
      ...state.inventory,
      crops,
      animalProducts,
    }),
    npcVisits: state.npcVisits.map((item) => item.id === visit.id
      ? { ...item, completed: true, completedDay: state.day }
      : item),
    stats: updateStats(state, { npcVisitsCompleted: 1 }),
  }, visit.rewards);

  return withFeedback(rewarded, `${visit.visitorName}委托完成 +${visit.rewards.gold || 0} 金`, true, {
    kind: 'npc_request_completed',
    amount: visit.rewards.gold || 0,
    npcVisitId: visit.id,
  });
}

export function getFarmObjectsInViewport(
  stateInput: FarmCanvasState,
  bounds: FarmViewportBounds,
  margin = FARM_VIEWPORT_RENDER_MARGIN,
): FarmCanvasObject[] {
  const state = sanitizeFarmCanvasState(stateInput);
  const viewportRect = {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: Math.max(0, bounds.width) + margin * 2,
    height: Math.max(0, bounds.height) + margin * 2,
  };
  return state.objects.filter((object) => rectsOverlap(viewportRect, rectOf(object, state.gridSize)));
}

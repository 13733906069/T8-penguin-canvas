// 画布数据 CRUD 路由(Phase 0 占位,Phase 1 完整实现)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const router = express.Router();

// 工具函数
function readJsonFile(file) {
  const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '').replace(/\0/g, '');
  return JSON.parse(raw);
}

function canvasCreatedAtFromId(id, fallback) {
  const match = String(id || '').match(/^canvas-(\d+)-/);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function recoverCanvasListFromFiles() {
  if (!fs.existsSync(config.DATA_DIR)) return [];
  const items = [];
  for (const entry of fs.readdirSync(config.DATA_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/^canvas_canvas-[\w-]+\.json$/.test(entry.name)) continue;
    const id = entry.name.replace(/^canvas_/, '').replace(/\.json$/, '');
    const file = path.join(config.DATA_DIR, entry.name);
    try {
      const data = readJsonFile(file);
      if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) continue;
      const stat = fs.statSync(file);
      const updatedAt = Math.max(1, Math.round(stat.mtimeMs));
      items.push({
        id,
        name: id,
        nodeCount: data.nodes.length,
        createdAt: canvasCreatedAtFromId(id, updatedAt),
        updatedAt,
      });
    } catch {
      // Ignore corrupt canvas payloads; the list should still recover valid canvases.
    }
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

function loadCanvasList() {
  if (!fs.existsSync(config.CANVAS_FILE)) return recoverCanvasListFromFiles();
  try {
    const list = readJsonFile(config.CANVAS_FILE);
    return Array.isArray(list) ? list : recoverCanvasListFromFiles();
  } catch (e) {
    console.warn(`⚠ 画布列表读取失败，尝试从单画布文件恢复: ${e?.message || e}`);
    return recoverCanvasListFromFiles();
  }
}

function saveCanvasList(list) {
  atomicWriteJson(config.CANVAS_FILE, list);
}

function getCanvasFile(id) {
  return path.join(config.DATA_DIR, `canvas_${id}.json`);
}

function safeFilename(input) {
  return String(input || 'canvas')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'canvas';
}

function loadSettings() {
  try {
    if (!fs.existsSync(config.SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function getCanvasAutoSaveDir() {
  const settings = loadSettings();
  const base = String(settings.canvasAutoSavePath || config.DEFAULT_CANVAS_AUTO_SAVE_DIR || '').trim();
  if (!base) return '';
  return path.join(base, 'T8-penguin-canvas', 'canvases');
}

function atomicWriteJson(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function parseNodeSerialId(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '').trim();
  if (!/^\d+$/.test(raw)) return 0;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function deriveNextNodeSerialId(nodes, incomingNext) {
  const requested = parseNodeSerialId(incomingNext);
  let maxSerial = 0;
  for (const node of Array.isArray(nodes) ? nodes : []) {
    maxSerial = Math.max(maxSerial, parseNodeSerialId(node?.data?.nodeSerialId));
  }
  return Math.max(1, requested || 1, maxSerial + 1);
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeCreativeDeskText(value, maxLength = 160) {
  if (value == null) return undefined;
  const text = String(value).replace(/\0/g, '').trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function sanitizeCreativeDeskUrl(value) {
  const url = sanitizeCreativeDeskText(value, 2048);
  if (!url) return '';
  if (/^data:/i.test(url)) return '';
  return url;
}

function sanitizeCreativeDeskState(value) {
  const items = Array.isArray(value?.items) ? value.items : [];
  const sanitizedItems = [];
  for (const item of items.slice(0, 48)) {
    const url = sanitizeCreativeDeskUrl(item?.url);
    if (!url) continue;
    const id = sanitizeCreativeDeskText(item?.id, 80) || `desk-${sanitizedItems.length + 1}`;
    sanitizedItems.push({
      id,
      kind: 'image',
      url,
      title: sanitizeCreativeDeskText(item?.title, 120),
      resourceId: sanitizeCreativeDeskText(item?.resourceId, 120),
      x: clampNumber(item?.x, 0, -200000, 200000),
      y: clampNumber(item?.y, 0, -200000, 200000),
      width: clampNumber(item?.width, 320, 24, 8000),
      height: clampNumber(item?.height, 220, 24, 8000),
      scale: clampNumber(item?.scale, 1, 0.05, 12),
      rotation: clampNumber(item?.rotation, 0, -720, 720),
      opacity: clampNumber(item?.opacity, 0.42, 0, 1),
      frameId: sanitizeCreativeDeskText(item?.frameId, 40) || 'poster-card',
      frameColorId: sanitizeCreativeDeskText(item?.frameColorId, 40) || 'cream',
      zIndex: Math.round(clampNumber(item?.zIndex, sanitizedItems.length + 1, 0, 9999)),
      locked: item?.locked === true,
      visible: item?.visible !== false,
      createdAt: Math.round(clampNumber(item?.createdAt, Date.now(), 1, 9999999999999)),
    });
  }
  const state = {
    version: 1,
    defaultOpacity: clampNumber(value?.defaultOpacity, 0.42, 0, 1),
    items: sanitizedItems,
  };
  if (value?.coordinateMode === 'viewport' || value?.coordinateMode === 'flow') {
    state.coordinateMode = value.coordinateMode;
  }
  return state;
}

const FARM_GRID_SIZE = 64;
const MAX_FARM_OBJECTS = 1500;
const MAX_FARM_ORDERS = 12;
const MAX_FARM_EVENT_LOG = 50;
const MAX_FARM_FESTIVAL_TASKS = 12;
const MAX_FARM_NPC_VISITS = 16;
const MAX_FARM_RARE_EVENTS = 24;
const MAX_FARM_ANIMALS = 24;
const FARM_SEASON_DAYS = 28;
const FARM_SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const FARM_CROP_IDS = ['turnip', 'potato', 'tomato', 'sunflower'];
const FARM_ANIMAL_KINDS = ['chicken', 'cow', 'sheep'];
const FARM_ANIMAL_PRODUCT_IDS = ['egg', 'milk', 'wool'];
const FARM_ANIMAL_MOODS = ['happy', 'calm', 'hungry'];
const FARM_NPC_VISITOR_IDS = ['mira', 'taro', 'lina'];
const FARM_NPC_REQUEST_KINDS = ['crop', 'animal-product'];
const FARM_RARE_EVENT_IDS = ['giant-turnip', 'rainbow-sunflower', 'meteor-seed'];
const FARM_OBJECT_KINDS = ['plot', 'building', 'decor', 'path', 'obstacle'];
const FARM_CROP_STAGES = ['seed', 'sprout', 'growing', 'flowering', 'mature', 'withered'];
const FARM_WEATHERS = ['sunny', 'cloudy', 'rainy', 'festival'];
const FARM_EVENT_KINDS = [
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
const FARM_DECOR_IDS = [
  'wood-fence',
  'stone-path',
  'flower-bed',
  'lantern',
  'sign',
  'crate',
  'hay-bale',
  'resource-sign',
  'resource-banner',
  'resource-poster-wall',
  'resource-tile',
];
const DEFAULT_FARM_ORDERS = [
  {
    id: 'tutorial-turnip-order',
    title: '新手萝卜订单',
    requirements: [{ kind: 'crop', cropId: 'turnip', amount: 3 }],
    rewards: { gold: 120, wood: 4, experience: 30, seeds: {}, decorIds: ['wood-fence'] },
    completed: false,
  },
  {
    id: 'potato-lunch-order',
    title: '午餐土豆订单',
    requirements: [{ kind: 'crop', cropId: 'potato', amount: 2 }],
    rewards: { gold: 150, stone: 3, experience: 36, seeds: {}, decorIds: [] },
    completed: false,
  },
  {
    id: 'sunflower-fair-order',
    title: '集市向日葵订单',
    requirements: [{ kind: 'crop', cropId: 'sunflower', amount: 2 }],
    rewards: { gold: 180, experience: 44, seeds: { tomato: 4 }, decorIds: [] },
    completed: false,
  },
];
const DEFAULT_FARM_ANIMALS = [
  {
    id: 'starter-chicken',
    kind: 'chicken',
    name: '啾啾',
    mood: 'calm',
    placedDay: 1,
    productCount: 0,
  },
];
const FARM_NPC_VISITOR_DEFINITIONS = {
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
const FARM_RARE_EVENT_DEFINITIONS = {
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

function farmSeasonForDay(dayInput) {
  const day = Math.round(clampNumber(dayInput, 1, 1, 999999));
  const index = Math.floor((day - 1) / FARM_SEASON_DAYS) % FARM_SEASONS.length;
  return FARM_SEASONS[index] || 'spring';
}

function farmWeatherForDay(dayInput, season = 'spring') {
  const day = Math.round(clampNumber(dayInput, 1, 1, 999999));
  if (day % 7 === 0) return 'festival';
  if (day % 5 === 0) return 'rainy';
  if (day % 3 === 0) return 'cloudy';
  return season === 'winter' && day % 4 === 0 ? 'cloudy' : 'sunny';
}

function farmFestivalIdForDay(dayInput, season = 'spring') {
  const day = Math.round(clampNumber(dayInput, 1, 1, 999999));
  if (farmWeatherForDay(day, season) !== 'festival') return undefined;
  if (season === 'summer') return `summer-market-${day}`;
  if (season === 'autumn') return `harvest-fair-${day}`;
  if (season === 'winter') return `winter-lights-${day}`;
  return `spring-sowing-${day}`;
}

function farmSeasonFestivalLabel(season) {
  if (season === 'summer') return '夏日集市';
  if (season === 'autumn') return '丰收祭';
  if (season === 'winter') return '冬灯会';
  return '春播祭';
}

function createFarmFestivalTask(festivalId, day, season) {
  const label = farmSeasonFestivalLabel(season);
  const rewards = season === 'summer'
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
    target: 1,
    progress: 0,
    rewards,
    completed: false,
  };
}

function createFarmNpcVisitForDay(dayInput, season = 'spring') {
  const day = Math.round(clampNumber(dayInput, 1, 1, 999999));
  const slot = day % 3;
  const visitorId = slot === 0 ? 'taro' : slot === 1 ? 'mira' : 'lina';
  const visitor = FARM_NPC_VISITOR_DEFINITIONS[visitorId];
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
      rewards: {
        gold: 54,
        experience: 12,
        ...(season === 'autumn' ? { seeds: { sunflower: 1 } } : {}),
      },
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

function sanitizeFarmText(value, maxLength = 120) {
  if (value == null) return undefined;
  const text = String(value).replace(/\0/g, '').trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function sanitizeFarmEventMessage(value) {
  const text = sanitizeFarmText(value, 120) || '牧场有新动静';
  return text
    .replace(/https?:\/\/\S+/gi, '[链接已隐藏]')
    .replace(/file:\/\/\S+/gi, '[路径已隐藏]')
    .replace(/[a-zA-Z]:\\[^\s]+/g, '[路径已隐藏]')
    .replace(/data:[^\s]+/gi, '[素材已隐藏]')
    .replace(/prompt\s*[:：][^，。;；]*/gi, '提示词已隐藏')
    .slice(0, 120);
}

function sanitizeFarmId(value, fallback) {
  const text = sanitizeFarmText(value, 96) || fallback;
  return /^[a-zA-Z0-9:_-]+$/.test(text) ? text : fallback;
}

function sanitizeFarmGridSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 16) return FARM_GRID_SIZE;
  return Math.round(Math.min(256, parsed));
}

function snapFarmCoordinate(value, gridSize) {
  const parsed = clampNumber(value, 0, -2000000, 2000000);
  return Math.floor(parsed / gridSize) * gridSize;
}

function sanitizeFarmCropBag(value) {
  const input = value && typeof value === 'object' ? value : {};
  const bag = {};
  for (const cropId of FARM_CROP_IDS) {
    const amount = Math.round(clampNumber(input[cropId], 0, 0, 9999));
    if (amount > 0) bag[cropId] = amount;
  }
  return bag;
}

function sanitizeFarmAnimalProductBag(value) {
  const input = value && typeof value === 'object' ? value : {};
  const bag = {};
  for (const productId of FARM_ANIMAL_PRODUCT_IDS) {
    const amount = Math.round(clampNumber(input[productId], 0, 0, 9999));
    if (amount > 0) bag[productId] = amount;
  }
  return bag;
}

function sanitizeFarmResources(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    gold: Math.round(clampNumber(input.gold, 300, 0, 9999999)),
    wood: Math.round(clampNumber(input.wood, 8, 0, 999999)),
    stone: Math.round(clampNumber(input.stone, 6, 0, 999999)),
    water: Math.round(clampNumber(input.water, 20, 0, 999)),
    experience: Math.round(clampNumber(input.experience, 0, 0, 9999999)),
    seeds: sanitizeFarmCropBag(input.seeds || { turnip: 12 }),
  };
}

function sanitizeFarmInventory(value) {
  const input = value && typeof value === 'object' ? value : {};
  const decorIds = Array.isArray(input.decorIds)
    ? [...new Set(input.decorIds.map((id, index) => sanitizeFarmId(id, `decor-${index}`)))].slice(0, 200)
    : [];
  return {
    crops: sanitizeFarmCropBag(input.crops),
    animalProducts: sanitizeFarmAnimalProductBag(input.animalProducts),
    decorIds,
  };
}

function sanitizeFarmStats(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    plotsTilled: Math.round(clampNumber(input.plotsTilled, 0, 0, 999999)),
    cropsPlanted: Math.round(clampNumber(input.cropsPlanted, 0, 0, 999999)),
    cropsWatered: Math.round(clampNumber(input.cropsWatered, 0, 0, 999999)),
    cropsHarvested: Math.round(clampNumber(input.cropsHarvested, 0, 0, 999999)),
    ordersCompleted: Math.round(clampNumber(input.ordersCompleted, 0, 0, 999999)),
    npcVisitsCompleted: Math.round(clampNumber(input.npcVisitsCompleted, 0, 0, 999999)),
    rareEventsFound: Math.round(clampNumber(input.rareEventsFound, 0, 0, 999999)),
    objectsPlaced: Math.round(clampNumber(input.objectsPlaced, 0, 0, 999999)),
    buildingsPlaced: Math.round(clampNumber(input.buildingsPlaced, 0, 0, 999999)),
    decorPlaced: Math.round(clampNumber(input.decorPlaced, 0, 0, 999999)),
    daysAdvanced: Math.round(clampNumber(input.daysAdvanced, 0, 0, 999999)),
  };
}

function sanitizeFarmAnimals(value, day) {
  const input = Array.isArray(value) ? value : DEFAULT_FARM_ANIMALS;
  return input
    .slice(0, MAX_FARM_ANIMALS)
    .map((animal, index) => {
      const source = animal && typeof animal === 'object' ? animal : {};
      if (!FARM_ANIMAL_KINDS.includes(source.kind)) return null;
      const placedDay = Math.round(clampNumber(source.placedDay, day, 1, day));
      const lastProducedDay = source.lastProducedDay == null
        ? undefined
        : Math.round(clampNumber(source.lastProducedDay, placedDay, 1, day));
      const item = {
        id: sanitizeFarmId(source.id, `farm-animal-${index}`),
        kind: source.kind,
        name: sanitizeFarmEventMessage(source.name || source.kind).slice(0, 16),
        mood: FARM_ANIMAL_MOODS.includes(source.mood) ? source.mood : 'calm',
        placedDay,
        productCount: Math.round(clampNumber(source.productCount, 0, 0, 999999)),
      };
      if (lastProducedDay) item.lastProducedDay = lastProducedDay;
      return item;
    })
    .filter(Boolean);
}

function sanitizeFarmReward(value) {
  const rewards = value && typeof value === 'object' ? value : {};
  return {
    gold: Math.round(clampNumber(rewards.gold, 0, 0, 999999)),
    wood: Math.round(clampNumber(rewards.wood, 0, 0, 999999)),
    stone: Math.round(clampNumber(rewards.stone, 0, 0, 999999)),
    experience: Math.round(clampNumber(rewards.experience, 0, 0, 999999)),
    seeds: sanitizeFarmCropBag(rewards.seeds),
    decorIds: Array.isArray(rewards.decorIds)
      ? rewards.decorIds
        .map((id, rewardIndex) => sanitizeFarmId(id, `decor-reward-${rewardIndex}`))
        .filter((id) => FARM_DECOR_IDS.includes(id))
        .slice(0, 20)
      : [],
  };
}

function sanitizeFarmCrop(value, fallbackDay) {
  const input = value && typeof value === 'object' ? value : {};
  if (!FARM_CROP_IDS.includes(input.cropId)) return undefined;
  const dryDays = Math.round(clampNumber(input.dryDays, 0, 0, 99));
  const stage = dryDays >= 3
    ? 'withered'
    : (FARM_CROP_STAGES.includes(input.stage) ? input.stage : 'seed');
  return {
    cropId: input.cropId,
    plantedDay: Math.round(clampNumber(input.plantedDay, fallbackDay, 1, 999999)),
    daysGrown: Math.round(clampNumber(input.daysGrown, 0, 0, 9999)),
    wateredToday: input.wateredToday === true,
    dryDays,
    stage,
    quality: ['silver', 'gold', 'rainbow'].includes(input.quality) ? input.quality : 'normal',
  };
}

function sanitizeFarmObject(value, index, day, gridSize) {
  const input = value && typeof value === 'object' ? value : {};
  if (!FARM_OBJECT_KINDS.includes(input.kind)) return null;
  const item = {
    id: sanitizeFarmId(input.id, `farm-object-${index}`),
    kind: input.kind,
    x: snapFarmCoordinate(input.x, gridSize),
    y: snapFarmCoordinate(input.y, gridSize),
    widthCells: Math.round(clampNumber(input.widthCells, 1, 1, 32)),
    heightCells: Math.round(clampNumber(input.heightCells, 1, 1, 32)),
    createdDay: Math.round(clampNumber(input.createdDay, day, 1, 999999)),
  };
  if ([90, 180, 270].includes(input.rotation)) item.rotation = input.rotation;
  if (item.kind === 'plot') {
    const crop = sanitizeFarmCrop(input.crop, item.createdDay);
    if (crop) item.crop = crop;
  }
  if (item.kind === 'building') item.buildingId = sanitizeFarmId(input.buildingId, 'hut');
  if (item.kind === 'decor') {
    item.decorId = sanitizeFarmId(input.decorId, 'wood-fence');
    const resourceId = sanitizeFarmText(input.resourceId, 120);
    if (resourceId && !/^data:/i.test(resourceId)) item.resourceId = sanitizeFarmId(resourceId, 'resource');
  }
  const skinId = sanitizeFarmText(input.skinId, 80);
  if (skinId) item.skinId = sanitizeFarmId(skinId, 'default');
  return item;
}

function sanitizeFarmOrders(value) {
  const input = Array.isArray(value) ? value : [];
  const orders = [];
  for (let index = 0; index < input.length && orders.length < MAX_FARM_ORDERS; index += 1) {
    const order = input[index];
    if (!order || typeof order !== 'object') continue;
    const requirements = Array.isArray(order.requirements)
      ? order.requirements
        .map((requirement) => {
          if (requirement?.kind !== 'crop' || !FARM_CROP_IDS.includes(requirement.cropId)) return null;
          return {
            kind: 'crop',
            cropId: requirement.cropId,
            amount: Math.round(clampNumber(requirement.amount, 1, 1, 999)),
          };
        })
        .filter(Boolean)
      : [];
    if (requirements.length === 0) continue;
    orders.push({
      id: sanitizeFarmId(order.id, `farm-order-${index}`),
      title: sanitizeFarmText(order.title, 80) || `牧场订单 ${index + 1}`,
      requirements,
      rewards: sanitizeFarmReward(order.rewards),
      completed: order.completed === true,
    });
  }
  return orders.length > 0 ? orders : DEFAULT_FARM_ORDERS.map((order) => ({
    ...order,
    requirements: order.requirements.map((requirement) => ({ ...requirement })),
    rewards: {
      ...order.rewards,
      seeds: { ...(order.rewards.seeds || {}) },
      decorIds: [...(order.rewards.decorIds || [])],
    },
  }));
}

function sanitizeFarmFestivalTasks(value, day, season, weather, festivalId) {
  const input = Array.isArray(value) ? value : [];
  const tasks = [];
  for (let index = 0; index < input.length && tasks.length < MAX_FARM_FESTIVAL_TASKS; index += 1) {
    const source = input[index] && typeof input[index] === 'object' ? input[index] : {};
    const cleanFestivalId = sanitizeFarmId(source.festivalId, festivalId || `festival-${day}`);
    const target = Math.round(clampNumber(source.target, 1, 1, 9));
    const progress = Math.round(clampNumber(source.progress, 0, 0, target));
    const completed = source.completed === true || progress >= target;
    tasks.push({
      id: sanitizeFarmId(source.id, `festival-task-${cleanFestivalId}-${index}`),
      festivalId: cleanFestivalId,
      title: sanitizeFarmText(source.title, 80) || `${farmSeasonFestivalLabel(season)}委托`,
      description: sanitizeFarmEventMessage(source.description || `完成 ${target} 个公告板订单，领取节庆谢礼。`),
      kind: 'complete-orders',
      target,
      progress,
      rewards: sanitizeFarmReward(source.rewards),
      completed,
      completedDay: completed ? Math.round(clampNumber(source.completedDay, day, 1, 999999)) : undefined,
    });
  }
  if (weather === 'festival' && festivalId && !tasks.some((task) => task.festivalId === festivalId)) {
    tasks.unshift(createFarmFestivalTask(festivalId, day, season));
  }
  return tasks.slice(0, MAX_FARM_FESTIVAL_TASKS);
}

function sanitizeFarmNpcVisit(value, index, currentDay, season) {
  const source = value && typeof value === 'object' ? value : {};
  const day = Math.round(clampNumber(source.day, currentDay, 1, currentDay));
  const fallback = createFarmNpcVisitForDay(day, season);
  const visitorId = FARM_NPC_VISITOR_IDS.includes(source.visitorId) ? source.visitorId : fallback.visitorId;
  const visitor = FARM_NPC_VISITOR_DEFINITIONS[visitorId];
  const requestKind = FARM_NPC_REQUEST_KINDS.includes(source.requestKind) ? source.requestKind : fallback.requestKind;
  const cropId = FARM_CROP_IDS.includes(source.cropId) ? source.cropId : fallback.cropId;
  const animalProductId = FARM_ANIMAL_PRODUCT_IDS.includes(source.animalProductId) ? source.animalProductId : fallback.animalProductId;
  if (requestKind === 'crop' && !cropId) return null;
  if (requestKind === 'animal-product' && !animalProductId) return null;
  const amount = Math.round(clampNumber(source.amount, fallback.amount, 1, 99));
  const completed = source.completed === true;
  const item = {
    id: sanitizeFarmId(source.id, `npc-visit-${day}-${visitorId}-${index}`),
    visitorId,
    visitorName: sanitizeFarmEventMessage(source.visitorName || visitor.name).slice(0, 18),
    day,
    title: sanitizeFarmText(source.title, 80) || fallback.title,
    message: sanitizeFarmEventMessage(source.message || fallback.message),
    requestKind,
    amount,
    rewards: sanitizeFarmReward(source.rewards || fallback.rewards),
    completed,
  };
  if (requestKind === 'crop') item.cropId = cropId;
  if (requestKind === 'animal-product') item.animalProductId = animalProductId;
  if (completed) item.completedDay = Math.round(clampNumber(source.completedDay, day, 1, currentDay));
  return item;
}

function sanitizeFarmNpcVisits(value, day, season) {
  const input = Array.isArray(value) ? value : [];
  const visits = input
    .slice(0, MAX_FARM_NPC_VISITS)
    .map((visit, index) => sanitizeFarmNpcVisit(visit, index, day, season))
    .filter(Boolean);
  if (!visits.some((visit) => visit.day === day)) {
    visits.unshift(createFarmNpcVisitForDay(day, season));
  }
  return visits
    .sort((a, b) => b.day - a.day || String(a.id).localeCompare(String(b.id)))
    .slice(0, MAX_FARM_NPC_VISITS);
}

function sanitizeFarmRareEvent(value, index, currentDay) {
  const source = value && typeof value === 'object' ? value : {};
  if (!FARM_RARE_EVENT_IDS.includes(source.eventId)) return null;
  const definition = FARM_RARE_EVENT_DEFINITIONS[source.eventId];
  const day = Math.round(clampNumber(source.day, currentDay, 1, currentDay));
  const item = {
    id: sanitizeFarmId(source.id, `rare-event-${day}-${source.eventId}-${index}`),
    eventId: source.eventId,
    title: sanitizeFarmText(source.title, 80) || definition.title,
    message: sanitizeFarmEventMessage(source.message || definition.message),
    day,
    rewards: sanitizeFarmReward(source.rewards || definition.rewards),
  };
  if (FARM_CROP_IDS.includes(source.cropId)) item.cropId = source.cropId;
  return item;
}

function sanitizeFarmRareEvents(value, day) {
  const input = Array.isArray(value) ? value : [];
  return input
    .slice(0, MAX_FARM_RARE_EVENTS)
    .map((event, index) => sanitizeFarmRareEvent(event, index, day))
    .filter(Boolean)
    .sort((a, b) => b.day - a.day || String(a.id).localeCompare(String(b.id)))
    .slice(0, MAX_FARM_RARE_EVENTS);
}

function sanitizeFarmEventLog(value, fallbackDay) {
  const input = Array.isArray(value) ? value : [];
  return input.slice(0, MAX_FARM_EVENT_LOG).map((event, index) => {
    const source = event && typeof event === 'object' ? event : {};
    const day = Math.round(clampNumber(source.day, fallbackDay, 1, 999999));
    const item = {
      id: sanitizeFarmId(source.id, `farm-event-${day}-${index}`),
      kind: FARM_EVENT_KINDS.includes(source.kind) ? source.kind : 'tool_feedback',
      day,
      message: sanitizeFarmEventMessage(source.message),
      createdAt: Math.round(clampNumber(source.createdAt, day * 100000 + index, 1, 9999999999999)),
    };
    const amount = Math.round(clampNumber(source.amount, 0, -999999, 999999));
    if (amount !== 0) item.amount = amount;
    if (FARM_CROP_IDS.includes(source.cropId)) item.cropId = source.cropId;
    if (FARM_OBJECT_KINDS.includes(source.objectKind)) item.objectKind = source.objectKind;
    if (source.orderId) item.orderId = sanitizeFarmId(source.orderId, 'farm-order');
    if (source.npcVisitId) item.npcVisitId = sanitizeFarmId(source.npcVisitId, 'npc-visit');
    if (source.rareEventId) item.rareEventId = sanitizeFarmId(source.rareEventId, 'rare-event');
    return item;
  });
}

function sanitizeFarmDailySummary(value, fallbackDay) {
  const source = value && typeof value === 'object' ? value : null;
  if (!source) return undefined;
  const toDay = Math.round(clampNumber(source.toDay, fallbackDay, 1, 999999));
  const fromDay = Math.round(clampNumber(source.fromDay, Math.max(1, toDay - 1), 1, 999999));
  const weather = FARM_WEATHERS.includes(source.weather) ? source.weather : farmWeatherForDay(toDay);
  return {
    id: sanitizeFarmId(source.id, `farm-summary-${fromDay}-${toDay}`),
    fromDay,
    toDay,
    weather,
    festivalId: weather === 'festival' ? sanitizeFarmId(source.festivalId, farmFestivalIdForDay(toDay)) : undefined,
    message: sanitizeFarmEventMessage(source.message),
    harvestedCrops: Math.round(clampNumber(source.harvestedCrops, 0, 0, 9999)),
    ordersCompleted: Math.round(clampNumber(source.ordersCompleted, 0, 0, 9999)),
    goldEarned: Math.round(clampNumber(source.goldEarned, 0, 0, 9999999)),
    rainWateredCrops: Math.round(clampNumber(source.rainWateredCrops, 0, 0, 9999)),
    festivalBonusGold: Math.round(clampNumber(source.festivalBonusGold, 0, 0, 9999999)),
    animalProductsProduced: Math.round(clampNumber(source.animalProductsProduced, 0, 0, 9999)),
    animalProductSummary: source.animalProductSummary ? sanitizeFarmEventMessage(source.animalProductSummary) : undefined,
    npcVisitsCompleted: Math.round(clampNumber(source.npcVisitsCompleted, 0, 0, 9999)),
    rareEventsFound: Math.round(clampNumber(source.rareEventsFound, 0, 0, 9999)),
    rareEventSummary: source.rareEventSummary ? sanitizeFarmEventMessage(source.rareEventSummary) : undefined,
    readyOrders: Math.round(clampNumber(source.readyOrders, 0, 0, 9999)),
    readyNpcVisits: Math.round(clampNumber(source.readyNpcVisits, 0, 0, 9999)),
    dailyWaterCapacity: Math.round(clampNumber(source.dailyWaterCapacity, 0, 0, 9999)),
    scarecrowProtectedCrops: Math.round(clampNumber(source.scarecrowProtectedCrops, 0, 0, 9999)),
    wateredCrops: Math.round(clampNumber(source.wateredCrops, 0, 0, 9999)),
    dryCrops: Math.round(clampNumber(source.dryCrops, 0, 0, 9999)),
    witheredCrops: Math.round(clampNumber(source.witheredCrops, 0, 0, 9999)),
    newMatureCrops: Math.round(clampNumber(source.newMatureCrops, 0, 0, 9999)),
    matureCrops: Math.round(clampNumber(source.matureCrops, 0, 0, 9999)),
    nextMatureCrops: Math.round(clampNumber(source.nextMatureCrops, 0, 0, 9999)),
    highlights: Array.isArray(source.highlights)
      ? source.highlights.map((item) => sanitizeFarmEventMessage(item)).filter(Boolean).slice(0, 5)
      : [],
    createdAt: Math.round(clampNumber(source.createdAt, toDay * 100000, 1, 9999999999999)),
  };
}

function sanitizeFarmCanvasState(value) {
  const input = value && typeof value === 'object' ? value : {};
  const day = Math.round(clampNumber(input.day, 1, 1, 999999));
  const gridSize = sanitizeFarmGridSize(input.gridSize);
  const season = FARM_SEASONS.includes(input.season) ? input.season : farmSeasonForDay(day);
  const weather = FARM_WEATHERS.includes(input.weather) ? input.weather : farmWeatherForDay(day, season);
  const festivalId = weather === 'festival' ? sanitizeFarmId(input.festivalId, farmFestivalIdForDay(day, season)) : undefined;
  return {
    version: 1,
    coordinateMode: 'flow',
    gridSize,
    day,
    season,
    weather,
    festivalId,
    resources: sanitizeFarmResources(input.resources),
    inventory: sanitizeFarmInventory(input.inventory),
    objects: Array.isArray(input.objects)
      ? input.objects
        .slice(0, MAX_FARM_OBJECTS)
        .map((item, index) => sanitizeFarmObject(item, index, day, gridSize))
        .filter(Boolean)
      : [],
    animals: sanitizeFarmAnimals(input.animals, day),
    orders: sanitizeFarmOrders(input.orders),
    festivalTasks: sanitizeFarmFestivalTasks(input.festivalTasks, day, season, weather, festivalId),
    npcVisits: sanitizeFarmNpcVisits(input.npcVisits, day, season),
    rareEvents: sanitizeFarmRareEvents(input.rareEvents, day),
    eventLog: sanitizeFarmEventLog(input.eventLog, day),
    lastDailySummary: sanitizeFarmDailySummary(input.lastDailySummary, day),
    discoveredCropIds: Array.isArray(input.discoveredCropIds)
      ? [...new Set(input.discoveredCropIds.filter((id) => FARM_CROP_IDS.includes(id)))].slice(0, 64)
      : [],
    unlockedDecorIds: Array.isArray(input.unlockedDecorIds)
      ? [...new Set(input.unlockedDecorIds.map((id, index) => sanitizeFarmId(id, `decor-${index}`)))].slice(0, 200)
      : [],
    stats: sanitizeFarmStats(input.stats),
    selectedTool: ['select', 'hoe', 'seed', 'water', 'harvest', 'shovel', 'build', 'decor', 'move', 'delete'].includes(input.selectedTool)
      ? input.selectedTool
      : 'select',
  };
}

function createDefaultFarmCanvasState() {
  return sanitizeFarmCanvasState();
}

// GET /api/canvas — 获取画布列表
router.get('/', (_req, res) => {
  const list = loadCanvasList();
  res.json({ success: true, data: list });
});

// POST /api/canvas — 创建画布
router.post('/', (req, res) => {
  const list = loadCanvasList();
  const id = `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const canvas = {
    id,
    name: req.body?.name || '未命名画布',
    nodeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  list.push(canvas);
  saveCanvasList(list);
  // 初始化空画布数据
  atomicWriteJson(getCanvasFile(id), {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    nextNodeSerialId: 1,
    farmCanvas: createDefaultFarmCanvasState(),
  });
  res.json({ success: true, data: canvas });
});

// GET /api/canvas/:id — 获取单个画布数据
router.get('/:id', (req, res) => {
  const file = getCanvasFile(req.params.id);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ success: false, error: '画布不存在' });
  }
  try {
    const data = readJsonFile(file);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: '读取失败: ' + e.message });
  }
});

// PUT /api/canvas/:id — 更新画布数据(防空数据覆盖)
router.put('/:id', (req, res) => {
  const file = getCanvasFile(req.params.id);
  const incoming = req.body;
  const allowEmptyOverwrite = req.query?.allowEmpty === '1' || incoming?.allowEmpty === true;
  // 防空数据覆盖保护
  if (
    !incoming ||
    !Array.isArray(incoming.nodes) ||
    (!allowEmptyOverwrite && incoming.nodes.length === 0 && fs.existsSync(file))
  ) {
    const existing = fs.existsSync(file) ? readJsonFile(file) : null;
    if (existing && Array.isArray(existing.nodes) && existing.nodes.length > 0) {
      console.warn(`⚠ 拒绝空数据覆盖画布 ${req.params.id}(原 ${existing.nodes.length} 节点)`);
      return res.status(400).json({ success: false, error: '拒绝空数据覆盖' });
    }
  }
  const persisted = {
    nodes: Array.isArray(incoming?.nodes) ? incoming.nodes : [],
    edges: Array.isArray(incoming?.edges) ? incoming.edges : [],
    viewport: incoming?.viewport || { x: 0, y: 0, zoom: 1 },
    nextNodeSerialId: deriveNextNodeSerialId(incoming?.nodes, incoming?.nextNodeSerialId),
  };
  if (Object.prototype.hasOwnProperty.call(incoming || {}, 'creativeDesk')) {
    persisted.creativeDesk = sanitizeCreativeDeskState(incoming.creativeDesk);
  }
  if (Object.prototype.hasOwnProperty.call(incoming || {}, 'farmCanvas')) {
    persisted.farmCanvas = sanitizeFarmCanvasState(incoming.farmCanvas);
  }
  atomicWriteJson(file, persisted);
  // 更新列表元数据
  const list = loadCanvasList();
  const item = list.find((x) => x.id === req.params.id);
  if (item) {
    item.nodeCount = persisted.nodes.length;
    item.updatedAt = Date.now();
    saveCanvasList(list);
  }
  res.json({ success: true });
});

// POST /api/canvas/:id/auto-save — 将当前画布镜像保存到用户配置的本地目录
// 用于跨版本迁移: 用户可在「API 设置 → 画布自动保存路径」配置基础路径。
// 实际保存位置: <path>/T8-penguin-canvas/canvases/<画布名>-<id>.json
router.post('/:id/auto-save', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || !Array.isArray(incoming.nodes) || !Array.isArray(incoming.edges)) {
      return res.status(400).json({ success: false, error: '画布数据格式错误' });
    }
    const saveDir = getCanvasAutoSaveDir();
    if (!saveDir) {
      return res.status(400).json({ success: false, error: '未配置 canvasAutoSavePath' });
    }

    const list = loadCanvasList();
    const item = list.find((x) => x.id === req.params.id);
    const name = item?.name || req.params.id;
    const shortId = String(req.params.id).replace(/^canvas-/, '').slice(0, 24);
    const filename = `${safeFilename(name)}-${safeFilename(shortId)}.json`;
    const target = path.join(saveDir, filename);
    const now = Date.now();
    const payload = {
      schema: 't8-penguin-canvas-autosave',
      version: 1,
      autoSavedAt: new Date(now).toISOString(),
      canvas: {
        id: req.params.id,
        name,
        nodeCount: incoming.nodes.length,
        edgeCount: incoming.edges.length,
        createdAt: item?.createdAt || null,
        updatedAt: item?.updatedAt || now,
      },
      nodes: incoming.nodes,
      edges: incoming.edges,
      viewport: incoming.viewport || { x: 0, y: 0, zoom: 1 },
      nextNodeSerialId: deriveNextNodeSerialId(incoming.nodes, incoming.nextNodeSerialId),
    };
    if (Object.prototype.hasOwnProperty.call(incoming || {}, 'creativeDesk')) {
      payload.creativeDesk = sanitizeCreativeDeskState(incoming.creativeDesk);
    }
    if (Object.prototype.hasOwnProperty.call(incoming || {}, 'farmCanvas')) {
      payload.farmCanvas = sanitizeFarmCanvasState(incoming.farmCanvas);
    }

    atomicWriteJson(target, payload);
    res.json({ success: true, data: { path: target, nodeCount: incoming.nodes.length, edgeCount: incoming.edges.length } });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

// DELETE /api/canvas/:id
router.delete('/:id', (req, res) => {
  const list = loadCanvasList();
  const filtered = list.filter((x) => x.id !== req.params.id);
  saveCanvasList(filtered);
  const file = getCanvasFile(req.params.id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ success: true });
});

// PATCH /api/canvas/:id/name — 重命名
router.patch('/:id/name', (req, res) => {
  const list = loadCanvasList();
  const item = list.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: '画布不存在' });
  item.name = req.body?.name || item.name;
  item.updatedAt = Date.now();
  saveCanvasList(list);
  res.json({ success: true, data: item });
});

module.exports = router;

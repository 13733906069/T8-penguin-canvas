import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  CalendarDays,
  CloudSun,
  Coins,
  Droplets,
  Flag,
  Grid2X2,
  Hammer,
  Image as ImageIcon,
  Move,
  Package,
  PawPrint,
  RefreshCw,
  Scissors,
  Shovel,
  Sparkles,
  Sprout,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
  Wheat,
  X,
} from 'lucide-react';
import { trackAchievementEvent } from '../stores/achievements';
import type { ThemeMode, ThemeVisualStyle } from '../theme/types';
import type { FarmCanvasFloatingFeedback } from './FarmCanvasLayer';
import type { FarmAnimalMood, FarmAnimalProductId, FarmCanvasState, FarmCropId, FarmDecorObjectType, FarmLongTermGoal, FarmNpcVisitState, FarmTool } from '../types/canvas';
import {
  FARM_ANIMAL_DEFINITIONS,
  FARM_ANIMAL_PRODUCT_DEFINITIONS,
  FARM_BUILDING_DEFINITIONS,
  FARM_CROP_DEFINITIONS,
  FARM_DECOR_DEFINITIONS,
  FARM_DEFAULT_DECOR_ID,
  FARM_SEASON_DEFINITIONS,
  canCompleteFarmNpcVisit,
  formatAnimalProductTotals,
  farmSeasonLabel,
  farmSeasonProgress,
  farmSeasonShortLabel,
  farmWeatherLabel,
  farmWeatherShortLabel,
  buildFarmActivityDigest,
  buildFarmActivityFeed,
  buildFarmBeautyScore,
  buildFarmBeautyRewards,
  buildFarmFocusGoals,
  buildFarmLongTermGoals,
  getActiveFarmFestivalTask,
  getActiveFarmNpcVisit,
  getFarmBuildingEffects,
  countFarmScarecrowUnprotectedDryCrops,
  isFarmDecorUnlocked,
  type FarmBeautyReward,
  type FarmFocusGoal,
  type FarmFocusGoalAction,
} from '../utils/farmCanvas';

interface FarmStoryPanelProps {
  visualStyle: ThemeVisualStyle | string;
  themeMode?: ThemeMode | string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showInlineToggle?: boolean;
  priorityFocusRequestId?: number;
  viewportMoving?: boolean;
  nodeDragging?: boolean;
  farmCanvas?: FarmCanvasState;
  editing?: boolean;
  feedback?: string;
  soundEnabled?: boolean;
  devToolsEnabled?: boolean;
  onToggleEditing?: (editing: boolean) => void;
  onToggleSound?: (enabled: boolean) => void;
  onGrantDevMaterials?: () => void;
  onSelectTool?: (tool: FarmTool) => void;
  onSelectBuilding?: (buildingId: string) => void;
  onSelectDecor?: (decorId: string) => void;
  resourceDecorItems?: FarmResourceDecorItem[];
  resourceDecorLoading?: boolean;
  onRefreshResourceDecor?: () => void;
  onSelectResourceDecor?: (resourceId: string, objectType: FarmDecorObjectType) => void;
  onJumpToMature?: () => void;
  onAdvanceDay?: () => void;
  onCompleteOrder?: (orderId: string) => void;
  onCompleteNpcVisit?: (visitId: string) => void;
  onFollowupCanvasHint?: (hint: FarmStoryPanelCanvasHint) => void;
}

export type FarmStoryPanelRouteHintTarget = 'water' | 'withered-crop' | 'ready-order' | 'ready-npc' | 'mature-crop' | 'rare-event' | 'scarecrow-risk' | 'day' | 'beauty' | 'building-yield-summary';

export interface FarmStoryPanelCanvasHint {
  message: string;
  tone: FarmCanvasFloatingFeedback['tone'];
  routeTarget?: FarmStoryPanelRouteHintTarget;
  routeLabel?: string;
  routeTitle?: string;
}

export const T8_FARM_STORY_PANEL_COLLAPSED_STORAGE_KEY = 't8-farm-story-panel-collapsed';
const FARM_PANEL_SECTION_STORAGE_KEY = 't8-farm-story-panel-sections-v1';
const FARM_REWARD_BURST_MS = 1700;
const MAX_FARM_REWARD_BURSTS = 4;

type FarmPanelSectionId = 'feedback' | 'season' | 'focus' | 'beauty' | 'guide' | 'tools' | 'build' | 'building' | 'animals' | 'visits' | 'summary' | 'activity' | 'actions';
type FarmPanelSectionExpandedState = Partial<Record<FarmPanelSectionId, boolean>>;
type FarmPanelSectionPresetId = 'priority' | 'daily' | 'close-all';
type FarmMonitorPriorityTone = 'water' | 'order' | 'visit' | 'mature' | 'guard' | 'focus' | 'stable';
type FarmPriorityActionKind = 'water-route' | 'order-submit' | 'visit-deliver' | 'mature-route' | 'guard-route' | 'focus-action' | 'activity-open';
type FarmPriorityQueueActionKind = FarmPriorityActionKind | 'focus-next' | 'activity-next' | 'order-next' | 'visit-next';
type FarmPriorityComboSource = 'priority' | 'queue';
type FarmRewardBurstKind = 'gold' | 'experience' | 'catalog' | 'quest' | 'animal' | 'npc' | 'rare' | 'beauty' | 'festival';
type FarmLiveFeedbackKind = 'action' | 'reward' | 'quest' | 'ready' | 'mature' | 'water' | 'cleanup' | 'build';
type FarmSummaryActionTone = 'mature' | 'water' | 'cleanup' | 'ready' | 'quest' | 'build';
type FarmSummaryDetailActionKind = 'tool' | 'water' | 'seed' | 'harvest' | 'cleanup' | 'order' | 'npc' | 'build' | 'decor' | 'day' | 'mature';
type FarmActionResourceTarget = 'gold' | 'seed' | 'water' | 'wood' | 'stone' | 'mature' | 'withered' | 'beauty' | 'day' | 'scarecrow';
type FarmFocusActionNextTarget = 'water' | 'cleanup' | 'seed' | 'harvest' | 'build' | 'scarecrow' | 'reward' | 'social' | 'decor' | 'day' | 'action';
type FarmActivityFocusTarget = 'section' | 'reward-digest' | 'streak' | 'milestone' | 'completion' | 'streak-meter' | 'action' | 'chest' | '';
type FarmMiniRewardPocketTarget = 'beauty' | 'ready-order' | 'activity-streak-reward';
type FarmPlacementHudReceiptKind = 'building' | 'decor' | '';
type FarmPlacementHudReceiptNextTarget = FarmStoryPanelRouteHintTarget | '';

interface FarmRewardSnapshot {
  gold: number;
  experience: number;
  discoveredCropIds: FarmCropId[];
  beautyRewardIds: string[];
  completedFestivalTasks: Array<{ id: string; rewardLabel: string }>;
  animalProducts: Partial<Record<FarmAnimalProductId, number>>;
  npcVisitsCompleted: number;
  rareEventsFound: number;
}

interface FarmRewardBurst {
  id: string;
  kind: FarmRewardBurstKind;
  label: string;
}

interface FarmLiveFeedbackItem {
  id: string;
  kind: FarmLiveFeedbackKind;
  label: string;
  icon: typeof Sparkles;
  rewardKind?: FarmRewardBurstKind;
  rewardKindLabel?: string;
  action?: FarmFocusGoalAction;
  actionLabel?: string;
}

interface FarmLiveFeedbackCompletionReceipt {
  itemId: string;
  goalId: string;
  goalTitle: string;
  icon: typeof Sparkles;
  goalKind: FarmFocusGoal['kind'];
  goalKindLabel: string;
  resourceTargets: FarmActionResourceTarget[];
  resourceLabel: string;
  progress: number;
  target: number;
  progressLabel: string;
  summaryLabel: string;
  actionKind?: FarmFocusGoalAction['kind'];
  actionLabel: string;
}

interface FarmMiniQuickActionFeedback {
  id: number;
  label: string;
  kind: FarmFocusGoal['kind'];
  actionKind: FarmFocusGoalAction['kind'];
  buildingId?: string;
  tool?: FarmTool;
  icon: typeof Sparkles;
}

interface FarmSummaryActionItem {
  id: string;
  label: string;
  title: string;
  tone: FarmSummaryActionTone;
  icon: typeof Sparkles;
  action: FarmFocusGoalAction;
}

interface FarmSummaryActionReceiptNextCounts {
  dryCount: number;
  witheredCount: number;
  matureCount: number;
  scarecrowRiskCount: number;
  readyOrderCount: number;
  readyNpcVisitCount: number;
}

interface FarmDailyRouteStep {
  id: string;
  stageLabel: string;
  title: string;
  detail: string;
  actionLabel: string;
  routeLabel: string;
  routeTitle: string;
  countLabel: string;
  resourceLabel: string;
  action: FarmFocusGoalAction;
  routeTarget?: FarmStoryPanelRouteHintTarget;
  canvasTarget: FarmFocusActionNextTarget;
}

interface FarmDailyRouteWrapupReceipt {
  id: string;
  summaryLabel: string;
  stepCount: number;
  fromDay: number;
  toDay: number;
}

type FarmMorningBriefAction = FarmFocusGoalAction | { kind: 'open-animals' } | { kind: 'open-building' };
type FarmMorningBriefTone = 'mature' | 'ready' | 'quest' | 'animal' | 'water';

interface FarmMorningBriefItem {
  id: string;
  label: string;
  detail: string;
  countLabel: string;
  rewardLabel: string;
  tone: FarmMorningBriefTone;
  icon: typeof Sparkles;
  action?: FarmMorningBriefAction;
  routeTarget?: FarmStoryPanelRouteHintTarget;
  routeLabel: string;
}

type FarmToolBadgeTone = 'neutral' | 'ready' | 'warning' | 'seed' | 'water' | 'mature' | 'build' | 'decor';

interface FarmToolBadge {
  label: string;
  title: string;
  tone: FarmToolBadgeTone;
  empty?: boolean;
}

interface FarmQuickToolRouteHint {
  routeTarget: FarmStoryPanelRouteHintTarget;
  routeLabel: string;
  routeTitle: string;
  message: string;
  tone: FarmCanvasFloatingFeedback['tone'];
}

interface FarmQuickToolAssistHint {
  label: string;
  title: string;
  message: string;
  tone: FarmCanvasFloatingFeedback['tone'];
  routeTarget?: FarmStoryPanelRouteHintTarget;
  routeLabel?: string;
  routeTitle?: string;
}

interface FarmPanelSectionPresetReceipt {
  presetId: FarmPanelSectionPresetId;
  label: string;
  detail: string;
  count: number;
  targetSection?: FarmPanelSectionId;
}

interface FarmControlConsoleFocusReceipt {
  id: number;
  section: FarmPanelSectionId;
  sectionLabel: string;
  primary: string;
  secondary: string;
  tone: FarmMonitorPriorityTone;
  actionKind: FarmPriorityActionKind;
  routeTarget?: FarmStoryPanelRouteHintTarget;
  routeLabel?: string;
  routeTitle?: string;
}

interface FarmPriorityAction {
  kind: FarmPriorityActionKind;
  label: string;
  detail: string;
  section: FarmPanelSectionId;
  routeTarget?: FarmStoryPanelRouteHintTarget;
  routeLabel?: string;
  routeTitle?: string;
  message: string;
  tone: FarmCanvasFloatingFeedback['tone'];
}

interface FarmPriorityQueueItem {
  id: string;
  kind: FarmPriorityQueueActionKind;
  label: string;
  detail: string;
  impactLabel: string;
  reasonLabel: string;
  safetyLabel: string;
  actionLabel: string;
  section: FarmPanelSectionId;
  routeTarget?: FarmStoryPanelRouteHintTarget;
  routeLabel?: string;
  routeTitle?: string;
  message: string;
  tone: FarmCanvasFloatingFeedback['tone'];
  focusGoal?: FarmFocusGoal;
}

interface FarmPriorityComboReceipt {
  id: string;
  source: FarmPriorityComboSource;
  count: number;
  actionLabel: string;
  comboLabel: string;
  rewardLabel: string;
}

interface FarmPriorityFlowReceipt {
  id: string;
  source: FarmPriorityComboSource;
  label: string;
  actionLabel: string;
  detailLabel: string;
  impactLabel?: string;
  reasonLabel?: string;
  nextItemId?: string;
  nextLabel?: string;
  nextActionLabel?: string;
  nextSection?: FarmPanelSectionId;
  nextRouteTarget?: FarmStoryPanelRouteHintTarget;
  nextRouteLabel?: string;
  nextRouteTitle?: string;
  nextMessage?: string;
  tone: FarmCanvasFloatingFeedback['tone'];
}

interface FarmTutorialStep {
  id: string;
  label: string;
  hint: string;
  current: number;
  target: number;
  done: boolean;
}

interface FarmLongGoalActionHint {
  label: string;
  title: string;
  action: FarmFocusGoalAction;
  routeTarget: FarmStoryPanelRouteHintTarget;
  routeLabel: string;
  canvasTarget: FarmFocusActionNextTarget;
}

type FarmDecorOption = (typeof FARM_DECOR_DEFINITIONS)[string];

interface FarmDecorUnlockRouteHint {
  label: string;
  title: string;
  sourceLabel: string;
  action: FarmFocusGoalAction;
  routeTarget: FarmStoryPanelRouteHintTarget;
  routeLabel: string;
  canvasTarget: FarmFocusActionNextTarget;
}

interface FarmOrderRewardPocketReceipt {
  orderId: string;
  title: string;
  rewardLabel: string;
  festivalRewardLabel: string;
  nextLabel: string;
  nextHint: string;
  nextCountLabel: string;
  nextActionLabel: string;
  nextActionTitle: string;
  action?: FarmFocusGoalAction;
  routeTarget?: FarmStoryPanelRouteHintTarget;
  routeLabel: string;
  routeTitle: string;
  tone: FarmCanvasFloatingFeedback['tone'];
}

interface FarmNpcBondPreview {
  levelLabel: string;
  progressLabel: string;
  nextRewardLabel: string;
  afterDeliveryLabel: string;
  title: string;
  percent: number;
}

interface FarmNpcBondMilestoneReward {
  targetLabel: string;
  rewardLabel: string;
  storyLabel: string;
  title: string;
}

interface FarmNpcReturnPromisePreview {
  nextVisitLabel: string;
  promiseLabel: string;
  storyLabel: string;
  completedLabel: string;
  title: string;
  tone: 'seed' | 'build' | 'flower';
}

type FarmNpcPrepHintAction = 'deliver' | 'harvest' | 'water' | 'plant' | 'wait-day' | 'animal';

interface FarmNpcPrepHintPreview {
  statusLabel: string;
  actionLabel: string;
  storyLabel: string;
  routeLabel: string;
  title: string;
  action: FarmNpcPrepHintAction;
  tone: 'ready' | 'crop' | 'water' | 'animal' | 'day';
  routeTarget?: FarmStoryPanelRouteHintTarget;
}

interface FarmResourceDecorItem {
  id: string;
  title: string;
  fileUrl?: string;
  thumbUrl?: string;
}

const FARM_PANEL_SECTION_IDS: FarmPanelSectionId[] = [
  'feedback',
  'season',
  'focus',
  'beauty',
  'guide',
  'tools',
  'build',
  'building',
  'animals',
  'visits',
  'summary',
  'activity',
  'actions',
];

const FARM_PANEL_DAILY_SECTION_IDS: FarmPanelSectionId[] = ['feedback', 'focus', 'tools', 'activity'];

const FARM_PANEL_SECTION_ID_SET = new Set<string>(FARM_PANEL_SECTION_IDS);

const FARM_TOOLS = [
  { id: 'select' as const, label: '选择', icon: Move },
  { id: 'hoe' as const, label: '锄地', icon: Shovel },
  { id: 'seed' as const, label: '播种', icon: Sprout },
  { id: 'water' as const, label: '浇水', icon: Droplets },
  { id: 'harvest' as const, label: '收获', icon: Scissors },
  { id: 'shovel' as const, label: '铲除', icon: Shovel },
  { id: 'build' as const, label: '建造', icon: Hammer },
  { id: 'decor' as const, label: '装饰', icon: Package },
  { id: 'move' as const, label: '移动', icon: Move },
  { id: 'delete' as const, label: '删除', icon: Trash2 },
];

function farmToolOption(tool: FarmTool) {
  return FARM_TOOLS.find((item) => item.id === tool) || FARM_TOOLS[0];
}

function readFarmPanelSectionExpanded(): FarmPanelSectionExpandedState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FARM_PANEL_SECTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const activeEntry = Object.entries(parsed).find(([key, value]) => FARM_PANEL_SECTION_ID_SET.has(key) && value === true);
    return activeEntry ? { [activeEntry[0] as FarmPanelSectionId]: true } : {};
  } catch {
    return {};
  }
}

function farmMiniFocusActionLabel(goal?: FarmFocusGoal) {
  if (!goal) return '';
  if (goal.action.kind === 'select-tool') return farmToolOption(goal.action.tool).label;
  if (goal.action.kind === 'jump-mature') return '收获';
  if (goal.action.kind === 'complete-order') return '交单';
  if (goal.action.kind === 'complete-npc') return '来访';
  if (goal.action.kind === 'select-building') return goal.actionLabel.replace(/^选择/, '').slice(0, 4) || '建造';
  if (goal.action.kind === 'select-decor') return '装饰';
  if (goal.action.kind === 'advance-day') return '过天';
  return goal.actionLabel.replace(/^选择/, '').slice(0, 4);
}

function farmPlacementHudReceiptKindFromFeedback(feedback?: string): FarmPlacementHudReceiptKind {
  if (!feedback) return '';
  if (feedback.includes('落成：')) return 'building';
  if (feedback.includes('布置：')) return 'decor';
  return '';
}

function farmPlacementHudReceiptSourceFromFeedback(feedback?: string) {
  if (!feedback) return '';
  const match = feedback.match(/(?:落成|布置)：([^·\n]+)/);
  return match?.[1]?.trim() || '';
}

function farmFocusGoalKindLabel(kind: FarmFocusGoal['kind']) {
  switch (kind) {
    case 'urgent':
      return '紧急';
    case 'growth':
      return '成长';
    case 'reward':
      return '收获';
    case 'social':
      return '来访';
    case 'build':
      return '建造';
    case 'decorate':
      return '装饰';
    case 'season':
      return '换季';
    default:
      return '目标';
  }
}

function farmLiveFeedbackCompletionSummaryLabel(receipt: Pick<FarmLiveFeedbackCompletionReceipt, 'goalTitle' | 'actionLabel' | 'goalKindLabel' | 'progressLabel' | 'resourceLabel'>) {
  const resourcePart = receipt.resourceLabel ? `，资源 ${receipt.resourceLabel}` : '';
  return `小目标完成：${receipt.goalTitle}，动作 ${receipt.actionLabel}，类型 ${receipt.goalKindLabel}，${receipt.progressLabel}${resourcePart}`;
}

function FarmLiveFeedbackCompletionIcon({ icon: CompletionIcon }: { icon: typeof Sparkles }) {
  return <CompletionIcon size={11} data-farm-live-feedback-completion-icon="true" aria-hidden="true" />;
}

function farmRewardBurstIcon(kind: FarmRewardBurstKind) {
  switch (kind) {
    case 'gold':
      return Coins;
    case 'experience':
      return Sprout;
    case 'catalog':
      return Grid2X2;
    case 'quest':
      return Package;
    case 'animal':
      return PawPrint;
    case 'npc':
      return UserRound;
    case 'beauty':
      return ImageIcon;
    case 'festival':
      return Flag;
    case 'rare':
    default:
      return Sparkles;
  }
}

function farmRewardKindLabel(kind: FarmRewardBurstKind) {
  switch (kind) {
    case 'gold':
      return '金币奖励';
    case 'experience':
      return '经验奖励';
    case 'catalog':
      return '图鉴奖励';
    case 'quest':
      return '任务奖励';
    case 'animal':
      return '动物产出';
    case 'npc':
      return '来访奖励';
    case 'beauty':
      return '美化奖励';
    case 'festival':
      return '节庆奖励';
    case 'rare':
    default:
      return '惊喜奖励';
  }
}

function farmMiniFocusActionIcon(goal: FarmFocusGoal) {
  if (goal.action.kind === 'select-tool') {
    if (goal.action.tool === 'water') return Droplets;
    if (goal.action.tool === 'seed') return Sprout;
    if (goal.action.tool === 'harvest') return Wheat;
    if (goal.action.tool === 'shovel' || goal.action.tool === 'hoe') return Shovel;
    if (goal.action.tool === 'build') return Hammer;
    if (goal.action.tool === 'decor') return ImageIcon;
    if (goal.action.tool === 'move') return Move;
    if (goal.action.tool === 'delete') return Trash2;
    return Sparkles;
  }
  if (goal.action.kind === 'jump-mature') return Wheat;
  if (goal.action.kind === 'complete-order') return Package;
  if (goal.action.kind === 'complete-npc') return UserRound;
  if (goal.action.kind === 'select-building') return Hammer;
  if (goal.action.kind === 'select-decor') return ImageIcon;
  if (goal.action.kind === 'advance-day') return CalendarDays;
  return Sparkles;
}

function farmSummaryDetailActionKind(action?: FarmFocusGoalAction): FarmSummaryDetailActionKind {
  if (!action) return 'tool';
  if (action.kind === 'select-tool') {
    if (action.tool === 'water') return 'water';
    if (action.tool === 'seed') return 'seed';
    if (action.tool === 'harvest') return 'harvest';
    if (action.tool === 'shovel' || action.tool === 'hoe') return 'cleanup';
    if (action.tool === 'build') return 'build';
    if (action.tool === 'decor') return 'decor';
    return 'tool';
  }
  if (action.kind === 'jump-mature') return 'mature';
  if (action.kind === 'complete-order') return 'order';
  if (action.kind === 'complete-npc') return 'npc';
  if (action.kind === 'select-building') return 'build';
  if (action.kind === 'select-decor') return 'decor';
  if (action.kind === 'advance-day') return 'day';
  return 'tool';
}

function farmActionResourceTargets(action?: FarmFocusGoalAction): FarmActionResourceTarget[] {
  if (!action) return [];
  if (action.kind === 'select-tool') {
    if (action.tool === 'water') return ['water'];
    if (action.tool === 'seed') return ['seed'];
    if (action.tool === 'harvest') return ['mature'];
    if (action.tool === 'shovel' || action.tool === 'delete') return ['withered'];
    if (action.tool === 'build') return ['wood', 'stone'];
    if (action.tool === 'decor') return ['beauty'];
    return [];
  }
  if (action.kind === 'jump-mature') return ['mature'];
  if (action.kind === 'complete-order') return ['gold'];
  if (action.kind === 'complete-npc') return ['gold'];
  if (action.kind === 'select-building' && action.buildingId === 'scarecrow') return ['wood', 'stone', 'scarecrow'];
  if (action.kind === 'select-building') return ['wood', 'stone'];
  if (action.kind === 'select-decor') return ['beauty'];
  if (action.kind === 'advance-day') return ['day', 'water'];
  return [];
}

function farmActionResourcePreviewLabel(targets: FarmActionResourceTarget[]): string {
  if (targets.length === 0) return '';
  const labels: string[] = [];
  if (targets.includes('wood') && targets.includes('stone')) labels.push('木石');
  else if (targets.includes('wood')) labels.push('木材');
  else if (targets.includes('stone')) labels.push('石头');
  if (targets.includes('water')) labels.push('水量');
  if (targets.includes('seed')) labels.push('种子');
  if (targets.includes('gold')) labels.push('金币');
  if (targets.includes('mature')) labels.push('成熟');
  if (targets.includes('withered')) labels.push('枯萎');
  if (targets.includes('beauty')) labels.push('漂亮度');
  if (targets.includes('day')) labels.push('天数');
  if (targets.includes('scarecrow')) labels.push('守护');
  return labels.length ? `预期：${labels.join('/')}` : '';
}

function farmSummaryActionFeedbackLabel(action: FarmSummaryActionItem): string {
  const summaryAction = action.action;
  if (summaryAction.kind === 'select-building' && summaryAction.buildingId === 'scarecrow') return '已选择稻草人';
  if (summaryAction.kind === 'select-tool') {
    if (summaryAction.tool === 'water') return '已切到水壶';
    if (summaryAction.tool === 'shovel') return '已切到铲子';
    if (summaryAction.tool === 'seed') return '已切到种子';
    if (summaryAction.tool === 'harvest') return '已准备收获';
    return `已选择${farmToolOption(summaryAction.tool).label}`;
  }
  if (summaryAction.kind === 'jump-mature') return '已定位成熟';
  if (summaryAction.kind === 'complete-order') return '已交付订单';
  if (summaryAction.kind === 'complete-npc') return '已交付来访';
  if (summaryAction.kind === 'select-building') {
    const building = FARM_BUILDING_DEFINITIONS[summaryAction.buildingId];
    return `已选择${building?.label || '建筑'}`;
  }
  if (summaryAction.kind === 'select-decor') {
    const decor = FARM_DECOR_DEFINITIONS[summaryAction.decorId];
    return `已选择${decor?.label || '装饰'}`;
  }
  if (summaryAction.kind === 'advance-day') return '已推进一天';
  return `已${action.label}`;
}

function farmSummaryActionReceiptNextHint(action: FarmSummaryActionItem): string {
  const summaryAction = action.action;
  if (summaryAction.kind === 'select-tool') {
    if (summaryAction.tool === 'water') return '下一步：点缺水作物浇水';
    if (summaryAction.tool === 'shovel') return '下一步：点枯萎地块清理';
    if (summaryAction.tool === 'seed') return '下一步：点空地播种';
    if (summaryAction.tool === 'harvest') return '下一步：点成熟作物收获';
    return '下一步：在牧场格子上操作';
  }
  if (summaryAction.kind === 'jump-mature') return '下一步：点成熟作物收获';
  if (summaryAction.kind === 'select-building' && summaryAction.buildingId === 'scarecrow') return '下一步：放到缺水区旁守护作物';
  if (summaryAction.kind === 'complete-order') return '下一步：查看金币和节庆奖励';
  if (summaryAction.kind === 'complete-npc') return '下一步：查看来访奖励';
  if (summaryAction.kind === 'select-building') return '下一步：在空地放置建筑';
  if (summaryAction.kind === 'select-decor') return '下一步：布置装饰提升漂亮度';
  if (summaryAction.kind === 'advance-day') return '下一步：查看明日成熟和总结';
  return '下一步：继续经营牧场';
}

function farmFocusActionNextHint(action?: FarmFocusGoalAction): string {
  if (!action) return '';
  if (action.kind === 'select-tool') {
    if (action.tool === 'water') return '下一步：点缺水作物浇水';
    if (action.tool === 'shovel') return '下一步：点枯萎地块清理';
    if (action.tool === 'seed') return '下一步：点空地播种';
    if (action.tool === 'harvest') return '下一步：点成熟作物收获';
    return '下一步：在牧场格子上操作';
  }
  if (action.kind === 'jump-mature') return '下一步：点成熟作物收获';
  if (action.kind === 'select-building' && action.buildingId === 'scarecrow') return '下一步：放到缺水区旁守护作物';
  if (action.kind === 'complete-order') return '下一步：查看金币和节庆奖励';
  if (action.kind === 'complete-npc') return '下一步：查看来访奖励';
  if (action.kind === 'select-building') return '下一步：在空地放置建筑';
  if (action.kind === 'select-decor') return '下一步：布置装饰提升漂亮度';
  if (action.kind === 'advance-day') return '下一步：查看明日成熟和总结';
  return '下一步：继续经营牧场';
}

function farmFocusActionNextTarget(action?: FarmFocusGoalAction): FarmFocusActionNextTarget | undefined {
  if (!action) return undefined;
  if (action.kind === 'select-tool') {
    if (action.tool === 'water') return 'water';
    if (action.tool === 'shovel') return 'cleanup';
    if (action.tool === 'seed') return 'seed';
    if (action.tool === 'harvest') return 'harvest';
    if (action.tool === 'build') return 'build';
    if (action.tool === 'decor') return 'decor';
    return 'action';
  }
  if (action.kind === 'jump-mature') return 'harvest';
  if (action.kind === 'select-building' && action.buildingId === 'scarecrow') return 'scarecrow';
  if (action.kind === 'complete-order') return 'reward';
  if (action.kind === 'complete-npc') return 'social';
  if (action.kind === 'select-building') return 'build';
  if (action.kind === 'select-decor') return 'decor';
  if (action.kind === 'advance-day') return 'day';
  return 'action';
}

function farmRouteTargetForFocusAction(action?: FarmFocusGoalAction): FarmStoryPanelRouteHintTarget | undefined {
  if (!action) return undefined;
  if (action.kind === 'select-tool') {
    if (action.tool === 'water') return 'water';
    if (action.tool === 'harvest') return 'mature-crop';
    if (action.tool === 'shovel') return 'withered-crop';
    if (action.tool === 'decor') return 'beauty';
    return undefined;
  }
  if (action.kind === 'jump-mature') return 'mature-crop';
  if (action.kind === 'complete-order') return 'ready-order';
  if (action.kind === 'complete-npc') return 'ready-npc';
  if (action.kind === 'select-building' && action.buildingId === 'scarecrow') return 'scarecrow-risk';
  if (action.kind === 'select-building') return 'building-yield-summary';
  if (action.kind === 'select-decor') return 'beauty';
  if (action.kind === 'advance-day') return 'day';
  return undefined;
}

function farmRouteLabelForTarget(target?: FarmStoryPanelRouteHintTarget) {
  switch (target) {
    case 'water':
      return '缺水';
    case 'withered-crop':
      return '枯萎';
    case 'ready-order':
      return '订单';
    case 'ready-npc':
      return '来访';
    case 'mature-crop':
      return '成熟';
    case 'rare-event':
      return '惊喜';
    case 'scarecrow-risk':
      return '守护';
    case 'day':
      return '日结';
    case 'beauty':
      return '美化';
    case 'building-yield-summary':
      return '建效';
    default:
      return '';
  }
}

function farmFocusActionCanvasTone(target: FarmFocusActionNextTarget | undefined): FarmCanvasFloatingFeedback['tone'] {
  if (target === 'water') return 'water';
  if (target === 'harvest' || target === 'reward' || target === 'social') return 'reward';
  if (target === 'build' || target === 'scarecrow' || target === 'decor') return 'build';
  if (target === 'cleanup') return 'warning';
  return 'success';
}

function farmFocusActionNextTargetLabel(target: FarmFocusActionNextTarget | undefined) {
  switch (target) {
    case 'water':
      return '浇水';
    case 'cleanup':
      return '清理';
    case 'seed':
      return '播种';
    case 'harvest':
      return '收获';
    case 'build':
      return '建造';
    case 'scarecrow':
      return '守护';
    case 'reward':
      return '奖励';
    case 'social':
      return '来访';
    case 'decor':
      return '装饰';
    case 'day':
      return '过天';
    case 'action':
      return '行动';
    default:
      return '';
  }
}

function farmFocusActionNextBadgeLabel(action?: FarmFocusGoalAction): string {
  if (!action) return '';
  if (action.kind === 'select-tool') {
    if (action.tool === 'water') return '浇水';
    if (action.tool === 'shovel') return '清理';
    if (action.tool === 'seed') return '播种';
    if (action.tool === 'harvest') return '收获';
    if (action.tool === 'build') return '建造';
    if (action.tool === 'decor') return '装饰';
    return '操作';
  }
  if (action.kind === 'jump-mature') return '收获';
  if (action.kind === 'select-building' && action.buildingId === 'scarecrow') return '守护';
  if (action.kind === 'complete-order') return '奖励';
  if (action.kind === 'complete-npc') return '来访';
  if (action.kind === 'select-building') return '建造';
  if (action.kind === 'select-decor') return '装饰';
  if (action.kind === 'advance-day') return '过天';
  return '操作';
}

function farmFocusActionNextCountLabel(action: FarmFocusGoalAction | undefined, counts: FarmSummaryActionReceiptNextCounts): string {
  if (!action) return '';
  if (action.kind === 'select-tool') {
    if (action.tool === 'water') return counts.dryCount > 0 ? `${counts.dryCount}块` : '';
    if (action.tool === 'shovel') return counts.witheredCount > 0 ? `${counts.witheredCount}块` : '';
    if (action.tool === 'harvest') return counts.matureCount > 0 ? `${counts.matureCount}个` : '';
    return '';
  }
  if (action.kind === 'jump-mature') return counts.matureCount > 0 ? `${counts.matureCount}个` : '';
  if (action.kind === 'select-building' && action.buildingId === 'scarecrow') return counts.scarecrowRiskCount > 0 ? `${counts.scarecrowRiskCount}处` : '';
  if (action.kind === 'complete-order') return counts.readyOrderCount > 0 ? `${counts.readyOrderCount}单` : '';
  if (action.kind === 'complete-npc') return counts.readyNpcVisitCount > 0 ? `${counts.readyNpcVisitCount}访` : '';
  return '';
}

function buildFarmDailyRouteSteps(goals: FarmFocusGoal[], counts: FarmSummaryActionReceiptNextCounts): FarmDailyRouteStep[] {
  const stageLabels = ['先做', '再接', '收尾'];
  return goals.slice(0, 3).map((goal, index) => {
    const routeTarget = farmRouteTargetForFocusAction(goal.action);
    const routeLabel = farmRouteLabelForTarget(routeTarget) || farmFocusActionNextBadgeLabel(goal.action) || '牧场';
    const canvasTarget = farmFocusActionNextTarget(goal.action) || 'action';
    const countLabel = farmFocusActionNextCountLabel(goal.action, counts);
    const resourceLabel = farmActionResourcePreviewLabel(farmActionResourceTargets(goal.action)).replace(/^预期：/, '');
    const nextHint = farmFocusActionNextHint(goal.action).replace(/^下一步：/, '');
    const stageLabel = stageLabels[index] || `第${index + 1}步`;
    const routeTitle = `今日路线：${stageLabel} ${goal.title} -> ${routeLabel}${countLabel ? ` · 目标 ${countLabel}` : ''}${nextHint ? ` · ${nextHint}` : ''}`;
    return {
      id: `${goal.id}-${index}`,
      stageLabel,
      title: goal.title,
      detail: nextHint || goal.detail,
      actionLabel: goal.actionLabel,
      routeLabel,
      routeTitle,
      countLabel,
      resourceLabel,
      action: goal.action,
      routeTarget,
      canvasTarget,
    };
  });
}

function farmSummaryActionReceiptNextBadgeLabel(action: FarmSummaryActionItem): string {
  const summaryAction = action.action;
  if (summaryAction.kind === 'select-tool') {
    if (summaryAction.tool === 'water') return '浇水';
    if (summaryAction.tool === 'shovel') return '清理';
    if (summaryAction.tool === 'seed') return '播种';
    if (summaryAction.tool === 'harvest') return '收获';
    return '操作';
  }
  if (summaryAction.kind === 'jump-mature') return '收获';
  if (summaryAction.kind === 'select-building' && summaryAction.buildingId === 'scarecrow') return '守护';
  if (summaryAction.kind === 'complete-order') return '奖励';
  if (summaryAction.kind === 'complete-npc') return '来访';
  if (summaryAction.kind === 'select-building') return '建造';
  if (summaryAction.kind === 'select-decor') return '装饰';
  if (summaryAction.kind === 'advance-day') return '明日';
  return '继续';
}

function farmSummaryActionReceiptNextCountLabel(action: FarmSummaryActionItem, counts: FarmSummaryActionReceiptNextCounts): string {
  const summaryAction = action.action;
  if (summaryAction.kind === 'select-tool') {
    if (summaryAction.tool === 'water') return counts.dryCount > 0 ? `${counts.dryCount}块` : '';
    if (summaryAction.tool === 'shovel') return counts.witheredCount > 0 ? `${counts.witheredCount}块` : '';
    if (summaryAction.tool === 'harvest') return counts.matureCount > 0 ? `${counts.matureCount}个` : '';
    return '';
  }
  if (summaryAction.kind === 'jump-mature') return counts.matureCount > 0 ? `${counts.matureCount}个` : '';
  if (summaryAction.kind === 'select-building' && summaryAction.buildingId === 'scarecrow') return counts.scarecrowRiskCount > 0 ? `${counts.scarecrowRiskCount}处` : '';
  if (summaryAction.kind === 'complete-order') return counts.readyOrderCount > 0 ? `${counts.readyOrderCount}单` : '';
  if (summaryAction.kind === 'complete-npc') return counts.readyNpcVisitCount > 0 ? `${counts.readyNpcVisitCount}访` : '';
  return '';
}

function farmFocusActionMatches(left?: FarmFocusGoalAction, right?: FarmFocusGoalAction) {
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === 'select-tool') return right.kind === 'select-tool' && left.tool === right.tool;
  if (left.kind === 'complete-order') return right.kind === 'complete-order' && left.orderId === right.orderId;
  if (left.kind === 'complete-npc') return right.kind === 'complete-npc' && left.visitId === right.visitId;
  if (left.kind === 'select-building') return right.kind === 'select-building' && left.buildingId === right.buildingId;
  if (left.kind === 'select-decor') return right.kind === 'select-decor' && left.decorId === right.decorId;
  return true;
}

function farmMiniActionResourceTargets(feedback: FarmMiniQuickActionFeedback | null): string[] {
  if (!feedback) return [];
  if (feedback.tool === 'water') return ['water'];
  if (feedback.tool === 'seed') return ['seed'];
  if (feedback.tool === 'harvest') return ['mature'];
  if (feedback.tool === 'shovel' || feedback.tool === 'delete') return ['withered'];
  if (feedback.actionKind === 'select-building' && feedback.buildingId === 'scarecrow') return ['wood', 'stone', 'scarecrow'];
  if (feedback.actionKind === 'select-building') return ['wood', 'stone'];
  if (feedback.actionKind === 'complete-order') return ['gold'];
  if (feedback.actionKind === 'complete-npc') return ['gold'];
  if (feedback.actionKind === 'select-decor') return ['beauty'];
  if (feedback.actionKind === 'jump-mature') return ['mature'];
  if (feedback.actionKind === 'advance-day') return ['day', 'water'];
  return [];
}

function farmMiniResourceFeedbackLabel(targets: string[], feedback: FarmMiniQuickActionFeedback | null): string {
  if (!feedback || targets.length === 0) return '';
  let resourceLabel = '资源';
  if (targets.includes('scarecrow')) resourceLabel = '木石/守护';
  else if (targets.includes('wood') && targets.includes('stone')) resourceLabel = '木石';
  else if (targets.includes('water')) resourceLabel = '水量';
  else if (targets.includes('seed')) resourceLabel = '种子';
  else if (targets.includes('gold')) resourceLabel = '金币';
  else if (targets.includes('mature')) resourceLabel = '成熟';
  else if (targets.includes('withered')) resourceLabel = '枯萎';
  else if (targets.includes('beauty')) resourceLabel = '漂亮度';
  else if (targets.includes('day')) resourceLabel = '天数';
  else if (targets.includes('scarecrow')) resourceLabel = '守护';
  return `${resourceLabel} · ${feedback.label}`;
}

function farmMiniActivityFeedbackLabel(feedback: FarmMiniQuickActionFeedback | null): string {
  if (!feedback) return '';
  return `今日 · ${feedback.label}`;
}

function buildFarmMiniQuickActionSummaryLabel(
  feedback: FarmMiniQuickActionFeedback | null,
  options: { resourceLabel?: string; activityLabel?: string; focusTitle?: string },
): string {
  if (!feedback) return '';
  const { resourceLabel, activityLabel, focusTitle } = options;
  const parts = [
    feedback.label,
    resourceLabel && `资源：${resourceLabel}`,
    activityLabel && `今日：${activityLabel}`,
    focusTitle && `小目标：${focusTitle}`,
  ].filter(Boolean);
  return parts.join(' · ');
}

function buildFarmToolBadge(
  tool: FarmTool,
  options: {
    farmCanvas?: FarmCanvasState;
    matureCount: number;
    selectedBuildingId: string;
    selectedDecorId: string;
    selectedResourceDecorChoice: { label: string };
    selectedResourceDecor?: FarmCanvasState['selectedResourceDecor'];
  },
): FarmToolBadge | undefined {
  const { farmCanvas, matureCount, selectedBuildingId, selectedDecorId, selectedResourceDecorChoice, selectedResourceDecor } = options;
  if (!farmCanvas) return undefined;
  if (tool === 'select') {
    return farmCanvas.selectedObjectId
      ? { label: '已选', title: '已有牧场对象被选中', tone: 'ready' }
      : { label: '查看', title: '点击牧场对象查看状态', tone: 'neutral' };
  }
  if (tool === 'hoe') {
    return { label: `地块 ${farmCanvas.stats.plotsTilled}`, title: `已开垦 ${farmCanvas.stats.plotsTilled} 块地`, tone: 'ready' };
  }
  if (tool === 'seed') {
    const cropId: FarmCropId = 'turnip';
    const seedCount = farmCanvas.resources.seeds[cropId] || 0;
    const cropLabel = FARM_CROP_DEFINITIONS[cropId]?.label || '萝卜';
    return seedCount > 0
      ? { label: `种子 ${seedCount}`, title: `${cropLabel}种子剩余 ${seedCount}`, tone: 'seed' }
      : { label: '缺种', title: `${cropLabel}种子不足，先完成订单或补充种子`, tone: 'warning', empty: true };
  }
  if (tool === 'water') {
    const water = farmCanvas.resources.water || 0;
    return water > 0
      ? { label: `水量 ${water}`, title: `水桶剩余 ${water}`, tone: 'water' }
      : { label: '缺水', title: '水桶已空，过一天或建造水井补水', tone: 'warning', empty: true };
  }
  if (tool === 'harvest') {
    return matureCount > 0
      ? { label: `成熟 ${matureCount}`, title: `当前有 ${matureCount} 块成熟作物`, tone: 'mature' }
      : { label: '未熟', title: '当前没有成熟作物', tone: 'neutral', empty: true };
  }
  if (tool === 'shovel') {
    return { label: '清理', title: '铲除田地、作物或装饰', tone: 'neutral' };
  }
  if (tool === 'build') {
    const building = FARM_BUILDING_DEFINITIONS[selectedBuildingId] || FARM_BUILDING_DEFINITIONS.hut;
    const shortage = formatFarmBuildShortage(building.cost, farmCanvas.resources);
    return shortage
      ? { label: '缺资源', title: `${building.label}资源不足：${shortage}`, tone: 'warning', empty: true }
      : { label: '可建', title: `可建造：${building.label}`, tone: 'build' };
  }
  if (tool === 'decor') {
    if (selectedResourceDecor) {
      return { label: '图饰', title: `资源库图片将做成${selectedResourceDecorChoice.label}`, tone: 'decor' };
    }
    const decor = FARM_DECOR_DEFINITIONS[selectedDecorId] || FARM_DECOR_DEFINITIONS[FARM_DEFAULT_DECOR_ID];
    const unlocked = isFarmDecorUnlocked(farmCanvas, decor.id);
    return unlocked
      ? { label: '可饰', title: `可布置：${decor.label}`, tone: 'decor' }
      : { label: '未解', title: `${decor.label}尚未解锁`, tone: 'warning', empty: true };
  }
  if (tool === 'move') {
    return farmCanvas.selectedObjectId
      ? { label: '搬运', title: '点击新位置移动选中对象', tone: 'ready' }
      : { label: '先选', title: '先选择一个牧场对象再移动', tone: 'neutral', empty: true };
  }
  if (tool === 'delete') {
    return { label: `物 ${farmCanvas.objects.length}`, title: `当前牧场对象 ${farmCanvas.objects.length} 个`, tone: 'warning' };
  }
  return undefined;
}

function farmQuickToolRouteHint(
  tool: FarmTool,
  options: {
    farmCanvas?: FarmCanvasState;
    dryCount: number;
    matureCount: number;
    witheredCount: number;
    scarecrowRiskCount: number;
    selectedBuildingId: string;
    selectedBuildingLabel: string;
    selectedDecorId: string;
    selectedDecorLabel: string;
    selectedResourceDecorChoice: { label: string };
    selectedResourceDecor?: FarmCanvasState['selectedResourceDecor'];
  },
): FarmQuickToolRouteHint | undefined {
  const {
    farmCanvas,
    dryCount,
    matureCount,
    witheredCount,
    scarecrowRiskCount,
    selectedBuildingId,
    selectedBuildingLabel,
    selectedDecorId,
    selectedDecorLabel,
    selectedResourceDecorChoice,
    selectedResourceDecor,
  } = options;
  if (!farmCanvas) return undefined;
  const makeHint = (
    routeTarget: FarmStoryPanelRouteHintTarget,
    routeTitle: string,
    message: string,
    tone: FarmCanvasFloatingFeedback['tone'],
    routeLabel = farmRouteLabelForTarget(routeTarget),
  ): FarmQuickToolRouteHint => ({
    routeTarget,
    routeLabel,
    routeTitle,
    message,
    tone,
  });

  if (tool === 'water' && dryCount > 0 && (farmCanvas.resources.water || 0) > 0) {
    return makeHint(
      'water',
      `自动定位最近缺水作物 ${dryCount}块`,
      `快捷浇水：${dryCount}块缺水，已切到水壶`,
      'water',
    );
  }
  if (tool === 'harvest' && matureCount > 0) {
    return makeHint(
      'mature-crop',
      `自动定位最近成熟作物 ${matureCount}块`,
      `快捷收获：${matureCount}块成熟，已切到镰刀`,
      'reward',
    );
  }
  if (tool === 'shovel' && witheredCount > 0) {
    return makeHint(
      'withered-crop',
      `自动定位最近枯萎作物 ${witheredCount}块`,
      `快捷铲除：${witheredCount}块枯萎，已切到铲子`,
      'warning',
    );
  }
  if (tool === 'build') {
    const building = FARM_BUILDING_DEFINITIONS[selectedBuildingId] || FARM_BUILDING_DEFINITIONS.hut;
    const shortage = formatFarmBuildShortage(building.cost, farmCanvas.resources);
    if (selectedBuildingId === 'scarecrow' && scarecrowRiskCount > 0) {
      return makeHint(
        'scarecrow-risk',
        `自动定位最近未守护作物 ${scarecrowRiskCount}块`,
        `快捷建造：${scarecrowRiskCount}块作物需要守护，已切到建造`,
        'build',
      );
    }
    if (!shortage) {
      return makeHint(
        'building-yield-summary',
        `快捷建造：当前选择 ${selectedBuildingLabel}，查看建效和放置反馈`,
        `快捷建造：${selectedBuildingLabel}可建，已切到建造`,
        'build',
      );
    }
    return undefined;
  }
  if (tool === 'decor') {
    if (selectedResourceDecor) {
      return makeHint(
        'beauty',
        `资源库图片将做成${selectedResourceDecorChoice.label}，布置后提升美化`,
        `快捷装饰：资源图饰，已切到装饰`,
        'build',
      );
    }
    const decor = FARM_DECOR_DEFINITIONS[selectedDecorId] || FARM_DECOR_DEFINITIONS[FARM_DEFAULT_DECOR_ID];
    if (isFarmDecorUnlocked(farmCanvas, decor.id)) {
      return makeHint(
        'beauty',
        `快捷装饰：当前选择 ${selectedDecorLabel}，布置后提升漂亮度`,
        `快捷装饰：${selectedDecorLabel}可布置，已切到装饰`,
        'build',
      );
    }
  }
  return undefined;
}

function farmQuickToolAssistHint(
  tool: FarmTool,
  options: {
    farmCanvas?: FarmCanvasState;
    routeActive?: boolean;
    matureCount: number;
    readyOrderCount: number;
    selectedBuildingId: string;
    selectedBuildingLabel: string;
    selectedDecorId: string;
    selectedDecorLabel: string;
  },
): FarmQuickToolAssistHint | undefined {
  const {
    farmCanvas,
    routeActive,
    matureCount,
    readyOrderCount,
    selectedBuildingId,
    selectedBuildingLabel,
    selectedDecorId,
    selectedDecorLabel,
  } = options;
  if (!farmCanvas || routeActive) return undefined;
  const makeAssist = (
    label: string,
    title: string,
    message: string,
    tone: FarmCanvasFloatingFeedback['tone'],
    routeTarget?: FarmStoryPanelRouteHintTarget,
    routeLabel = farmRouteLabelForTarget(routeTarget),
  ): FarmQuickToolAssistHint => ({
    label,
    title,
    message,
    tone,
    routeTarget,
    routeLabel,
    routeTitle: routeTarget ? title : undefined,
  });

  if (tool === 'seed' && (farmCanvas.resources.seeds.turnip || 0) <= 0) {
    const routeTarget: FarmStoryPanelRouteHintTarget = readyOrderCount > 0
      ? 'ready-order'
      : matureCount > 0
        ? 'mature-crop'
        : 'day';
    return makeAssist(
      '备种',
      routeTarget === 'ready-order'
        ? '种子不足：先交付可完成订单，拿回种子或金币'
        : routeTarget === 'mature-crop'
          ? '种子不足：先收获成熟作物，为订单和种子周转备料'
          : '种子不足：推进到明天刷新订单和日结资源',
      '快捷播种：种子不足，先去备种',
      'warning',
      routeTarget,
      routeTarget === 'day' ? '明日' : farmRouteLabelForTarget(routeTarget),
    );
  }
  if (tool === 'water' && (farmCanvas.resources.water || 0) <= 0) {
    return makeAssist(
      '补水',
      '水桶已空：查看水井收益，或过一天补水后再浇',
      '快捷浇水：水量不足，先补水',
      'water',
      'building-yield-summary',
      '补水',
    );
  }
  if (tool === 'harvest' && matureCount === 0) {
    return makeAssist(
      '等熟',
      '暂无成熟作物：先浇水或推进到下一天',
      '快捷收获：暂无成熟作物，先等成熟',
      'success',
      'day',
      '等熟',
    );
  }
  if (tool === 'build') {
    const building = FARM_BUILDING_DEFINITIONS[selectedBuildingId] || FARM_BUILDING_DEFINITIONS.hut;
    const shortage = formatFarmBuildShortage(building.cost, farmCanvas.resources);
    if (shortage) {
      const routeTarget: FarmStoryPanelRouteHintTarget = readyOrderCount > 0
        ? 'ready-order'
        : matureCount > 0
          ? 'mature-crop'
          : 'building-yield-summary';
      return makeAssist(
        '补料',
        `${selectedBuildingLabel}资源不足：${shortage}。先补齐材料再建造`,
        `快捷建造：${selectedBuildingLabel}缺材料，先补料`,
        'warning',
        routeTarget,
        '补料',
      );
    }
  }
  if (tool === 'decor') {
    const decor = FARM_DECOR_DEFINITIONS[selectedDecorId] || FARM_DECOR_DEFINITIONS[FARM_DEFAULT_DECOR_ID];
    if (!isFarmDecorUnlocked(farmCanvas, decor.id)) {
      const unlockRoute = farmDecorUnlockRouteHint(decor, farmCanvas);
      return makeAssist(
        '解锁',
        unlockRoute.title,
        `快捷装饰：${selectedDecorLabel}未解锁，先${unlockRoute.label}`,
        'warning',
        unlockRoute.routeTarget,
        unlockRoute.routeLabel,
      );
    }
  }
  if (tool === 'move' && !farmCanvas.selectedObjectId) {
    return makeAssist(
      '先选',
      '移动前需要先选中一个牧场对象',
      '快捷移动：先选择要移动的牧场对象',
      'success',
    );
  }
  return undefined;
}

const FARM_STEPS = ['开垦 6 块地', '种下并浇水', '完成每日订单'];

const FARM_RESOURCE_DECOR_CHOICES: Array<{
  id: FarmDecorObjectType;
  label: string;
  hint: string;
  icon: typeof ImageIcon;
}> = [
  { id: 'sign', label: '招牌', hint: '木牌展示', icon: ImageIcon },
  { id: 'banner', label: '旗帜', hint: '节庆飘旗', icon: Flag },
  { id: 'poster-wall', label: '海报墙', hint: '墙面陈列', icon: Package },
  { id: 'tile', label: '地砖', hint: '铺成路面', icon: Grid2X2 },
];

function sumValues(record: Record<string, number | undefined> | undefined) {
  return Object.values(record || {}).reduce<number>((total, value) => total + (Number(value) || 0), 0);
}

function formatFarmBuildCost(cost: { gold?: number; wood?: number; stone?: number }) {
  const parts = [
    cost.gold ? `${cost.gold}金` : '',
    cost.wood ? `${cost.wood}木` : '',
    cost.stone ? `${cost.stone}石` : '',
  ].filter(Boolean);
  return parts.join(' ') || '免费';
}

function formatFarmReward(reward: FarmCanvasState['orders'][number]['rewards'] | undefined) {
  const seedParts = Object.entries(reward?.seeds || {})
    .filter(([, amount]) => Number(amount) > 0)
    .map(([cropId, amount]) => `${FARM_CROP_DEFINITIONS[cropId as FarmCropId]?.label || cropId}种子 x${amount}`);
  const parts = [
    reward?.gold ? `${reward.gold}金` : '',
    reward?.wood ? `${reward.wood}木` : '',
    reward?.stone ? `${reward.stone}石` : '',
    reward?.experience ? `${reward.experience}经验` : '',
    ...seedParts,
    ...(reward?.decorIds?.length ? [`装饰 x${reward.decorIds.length}`] : []),
  ].filter(Boolean);
  return parts.join(' / ') || '节庆谢礼';
}

function formatFarmResourceLabel(key: 'gold' | 'wood' | 'stone') {
  if (key === 'gold') return '金币';
  if (key === 'wood') return '木';
  return '石';
}

function farmBuildShortageTargets(cost: { gold?: number; wood?: number; stone?: number }, resources: FarmCanvasState['resources'] | undefined) {
  if (!resources) return [];
  return (['gold', 'wood', 'stone'] as const).filter((key) => (cost[key] || 0) > resources[key]);
}

function formatFarmBuildShortage(cost: { gold?: number; wood?: number; stone?: number }, resources: FarmCanvasState['resources'] | undefined) {
  if (!resources) return '';
  return farmBuildShortageTargets(cost, resources)
    .map((key) => `${formatFarmResourceLabel(key)}${resources[key]}/${cost[key]}`)
    .join(' ');
}

function formatFarmBuildingEffectHint(buildingId: string) {
  if (buildingId === 'hut') return '日结入口';
  if (buildingId === 'storage') return '容量 +20';
  if (buildingId === 'well') return '每日水 +12';
  if (buildingId === 'board') return '订单高亮';
  if (buildingId === 'scarecrow') return '守护 6 格';
  return '牧场功能';
}

function formatFarmBuildMeta(
  building: { widthCells: number; heightCells: number; cost: { gold?: number; wood?: number; stone?: number } },
  resources: FarmCanvasState['resources'] | undefined,
) {
  const size = `${building.widthCells}x${building.heightCells}`;
  const shortage = formatFarmBuildShortage(building.cost, resources);
  return shortage ? `${size} · 缺 ${shortage}` : `${size} · ${formatFarmBuildCost(building.cost)}`;
}

function formatFarmDecorCategory(category: string) {
  if (category === 'fence') return '栅栏';
  if (category === 'path') return '小路';
  if (category === 'flower') return '花草';
  if (category === 'light') return '灯';
  if (category === 'sign') return '标识';
  if (category === 'storage') return '杂物';
  return '装饰';
}

function formatFarmDecorEffectHint(decor: { category: string; description: string }) {
  if (decor.category === 'fence') return '边界感';
  if (decor.category === 'path') return '连路网';
  if (decor.category === 'flower') return '漂亮度';
  if (decor.category === 'light') return '夜间高亮';
  if (decor.category === 'sign') return '区域标记';
  if (decor.category === 'storage') return '生活杂物';
  return decor.description;
}

function farmAnimalMoodLabel(mood: FarmAnimalMood | undefined) {
  if (mood === 'happy') return '开心';
  if (mood === 'hungry') return '饿了';
  return '安静';
}

function formatFarmAnimalProducts(products: Partial<Record<FarmAnimalProductId, number>> | undefined) {
  return formatAnimalProductTotals(products) || '暂无产物';
}

function compactFarmHudFeedback(value: unknown, maxLength = 34) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatFarmNpcRequirement(visit: FarmNpcVisitState | undefined, farmCanvas: FarmCanvasState | undefined) {
  if (!visit) return '';
  if (visit.requestKind === 'animal-product' && visit.animalProductId) {
    const product = FARM_ANIMAL_PRODUCT_DEFINITIONS[visit.animalProductId];
    const owned = farmCanvas?.inventory.animalProducts[visit.animalProductId] || 0;
    return `${product?.label || visit.animalProductId} ${owned}/${visit.amount}`;
  }
  if (visit.cropId) {
    const crop = FARM_CROP_DEFINITIONS[visit.cropId];
    const owned = farmCanvas?.inventory.crops[visit.cropId] || 0;
    return `${crop?.label || visit.cropId} ${owned}/${visit.amount}`;
  }
  return `材料 0/${visit.amount}`;
}

function farmNpcPrepHintPreview(visit: FarmNpcVisitState | undefined, farmCanvas: FarmCanvasState | undefined, ready: boolean): FarmNpcPrepHintPreview | null {
  if (!visit || visit.completed) return null;
  if (ready) {
    return {
      statusLabel: '材料已齐',
      actionLabel: '交付委托',
      storyLabel: `${visit.visitorName}要的材料已经备好，交付后熟络和谢礼都会马上入袋。`,
      routeLabel: '来访',
      title: `${visit.visitorName}来访备货：材料已齐，可以交付委托。`,
      action: 'deliver',
      tone: 'ready',
      routeTarget: 'ready-npc',
    };
  }
  if (visit.requestKind === 'animal-product' && visit.animalProductId) {
    const product = FARM_ANIMAL_PRODUCT_DEFINITIONS[visit.animalProductId];
    const productLabel = product?.label || visit.animalProductId;
    const owned = farmCanvas?.inventory.animalProducts[visit.animalProductId] || 0;
    const missing = Math.max(0, visit.amount - owned);
    return {
      statusLabel: `缺 ${productLabel} x${missing}`,
      actionLabel: '看动物小屋',
      storyLabel: `${visit.visitorName}还差 ${productLabel}，先去动物小屋看看今天的产物和心情。`,
      routeLabel: '动物',
      title: `${visit.visitorName}来访备货：${productLabel} ${owned}/${visit.amount}，建议查看动物小屋。`,
      action: 'animal',
      tone: 'animal',
    };
  }
  if (!visit.cropId) return null;
  const crop = FARM_CROP_DEFINITIONS[visit.cropId];
  const cropLabel = crop?.label || visit.cropId;
  const owned = farmCanvas?.inventory.crops[visit.cropId] || 0;
  const missing = Math.max(0, visit.amount - owned);
  const cropPlots = farmCanvas?.objects.filter((object) => object.kind === 'plot' && object.crop?.cropId === visit.cropId) || [];
  const matureCount = cropPlots.filter((object) => (object.crop?.daysGrown || 0) >= (crop?.growthDays || 1)).length;
  const dryGrowingCount = cropPlots.filter((object) => {
    if (!object.crop) return false;
    return object.crop.daysGrown < (crop?.growthDays || 1) && !object.crop.wateredToday;
  }).length;
  const growingCount = cropPlots.filter((object) => {
    if (!object.crop) return false;
    return object.crop.daysGrown < (crop?.growthDays || 1);
  }).length;
  const seedCount = farmCanvas?.resources.seeds[visit.cropId] || 0;
  if (matureCount > 0) {
    return {
      statusLabel: `缺 ${cropLabel} x${missing}`,
      actionLabel: '收获备货',
      storyLabel: `${cropLabel}已经成熟 ${matureCount} 块，先收一轮就能把 ${visit.visitorName} 的袋子补上。`,
      routeLabel: '成熟',
      title: `${visit.visitorName}来访备货：缺 ${cropLabel} x${missing}，已有成熟作物。`,
      action: 'harvest',
      tone: 'crop',
      routeTarget: 'mature-crop',
    };
  }
  if (dryGrowingCount > 0 && (farmCanvas?.resources.water || 0) > 0) {
    return {
      statusLabel: `缺 ${cropLabel} x${missing}`,
      actionLabel: '先浇水',
      storyLabel: `${cropLabel}还在长，今天先浇水，明天更容易接上 ${visit.visitorName} 的委托。`,
      routeLabel: '缺水',
      title: `${visit.visitorName}来访备货：缺 ${cropLabel} x${missing}，建议先浇水。`,
      action: 'water',
      tone: 'water',
      routeTarget: 'water',
    };
  }
  if (seedCount > 0) {
    return {
      statusLabel: `缺 ${cropLabel} x${missing}`,
      actionLabel: '播种备货',
      storyLabel: `仓库里还有 ${cropLabel}种子 x${seedCount}，先补种，后面来访就不会卡材料。`,
      routeLabel: '播种',
      title: `${visit.visitorName}来访备货：缺 ${cropLabel} x${missing}，可播种 ${cropLabel}。`,
      action: 'plant',
      tone: 'crop',
    };
  }
  if (growingCount > 0) {
    return {
      statusLabel: `缺 ${cropLabel} x${missing}`,
      actionLabel: '过一天',
      storyLabel: `${cropLabel}还需要时间，确认今天农活后过一天，再回来交付更稳。`,
      routeLabel: '日结',
      title: `${visit.visitorName}来访备货：缺 ${cropLabel} x${missing}，等待作物成长。`,
      action: 'wait-day',
      tone: 'day',
      routeTarget: 'day',
    };
  }
  return {
    statusLabel: `缺 ${cropLabel} x${missing}`,
    actionLabel: '先找种子',
    storyLabel: `${cropLabel}库存和种子都不够，先交订单或推进一天，给下次来访攒材料。`,
    routeLabel: '订单',
    title: `${visit.visitorName}来访备货：缺 ${cropLabel} x${missing}，需要先补种子来源。`,
    action: 'wait-day',
    tone: 'day',
    routeTarget: 'ready-order',
  };
}

function farmNpcBondRewardLabel(visitorId: FarmNpcVisitState['visitorId'], target: number) {
  const visitorRewardLabels: Record<FarmNpcVisitState['visitorId'], Record<number, string>> = {
    mira: {
      1: '种子店谢礼',
      3: '新品种子情报',
      5: '集市熟客贴纸',
    },
    taro: {
      1: '木匠小礼',
      3: '工坊建材包',
      5: '木屋熟客牌',
    },
    lina: {
      1: '花店谢礼',
      3: '花坛灵感',
      5: '花店明信片',
    },
  };
  return visitorRewardLabels[visitorId]?.[target] || '村里谢礼';
}

function farmNpcBondLevelLabel(completedCount: number) {
  if (completedCount >= 5) return '挚友';
  if (completedCount >= 3) return '熟络';
  if (completedCount >= 1) return '认识';
  return '初见';
}

function farmNpcBondMilestoneStoryLabel(visitorId: FarmNpcVisitState['visitorId'], target: number) {
  const visitorStoryLabels: Record<FarmNpcVisitState['visitorId'], Record<number, string>> = {
    mira: {
      1: '米拉把新种子的便签夹进订单袋，提醒你下次试种。',
      3: '种子店开始给你留柜台后面的新品种子情报。',
      5: '集市熟客贴纸贴在看板角落，来访委托会更像老朋友的请求。',
    },
    taro: {
      1: '太郎把一小捆打磨好的木料送到门口。',
      3: '工坊给你留了一包建材，适合继续扩建牧场角落。',
      5: '木屋熟客牌挂上后，建造区看起来更像有人常来帮忙。',
    },
    lina: {
      1: '莉娜送来一束小花，花香让入口多了一点生活感。',
      3: '花店给你画了花坛灵感草图，适合继续布置小路边。',
      5: '花店明信片被别在木牌上，牧场像被村里正式记住了。',
    },
  };
  return visitorStoryLabels[visitorId]?.[target] || '村里送来一份熟络谢礼，下一次来访会更亲近。';
}

function farmNpcBondMilestoneReward(visit: FarmNpcVisitState | undefined, farmCanvas: FarmCanvasState | undefined): FarmNpcBondMilestoneReward | null {
  if (!visit) return null;
  const completedCount = (farmCanvas?.npcVisits || []).filter((item) => item.visitorId === visit.visitorId && item.completed).length;
  const milestoneTarget = [5, 3, 1].find((target) => completedCount >= target);
  if (!milestoneTarget) return null;
  const rewardLabel = farmNpcBondRewardLabel(visit.visitorId, milestoneTarget);
  const targetLabel = `${milestoneTarget}次来访`;
  const storyLabel = farmNpcBondMilestoneStoryLabel(visit.visitorId, milestoneTarget);
  return {
    targetLabel,
    rewardLabel,
    storyLabel,
    title: `${visit.visitorName}熟络礼物：${targetLabel} · ${rewardLabel}。${storyLabel}`,
  };
}

function farmNpcReturnPromisePreview(visit: FarmNpcVisitState | undefined, farmCanvas: FarmCanvasState | undefined): FarmNpcReturnPromisePreview | null {
  if (!visit) return null;
  const completedCount = (farmCanvas?.npcVisits || []).filter((item) => item.visitorId === visit.visitorId && item.completed).length;
  const promisedCount = visit.completed ? completedCount : completedCount + 1;
  const promiseStage = promisedCount >= 5 ? 5 : promisedCount >= 3 ? 3 : promisedCount >= 1 ? 1 : 0;
  const visitorPromises: Record<FarmNpcVisitState['visitorId'], Record<number, { promiseLabel: string; storyLabel: string; tone: FarmNpcReturnPromisePreview['tone'] }>> = {
    mira: {
      0: { promiseLabel: '完成委托后留种子便签', storyLabel: '米拉会先看这次材料，完成后再把下次试种线索夹进订单袋。', tone: 'seed' },
      1: { promiseLabel: '带新品种子线索', storyLabel: '米拉说下次经过集市，会给你留一张更适合当前季节的种子便签。', tone: 'seed' },
      3: { promiseLabel: '预留稀有种子情报', storyLabel: '种子店开始把柜台后面的新品情报留给你，下一次回访会更值得期待。', tone: 'seed' },
      5: { promiseLabel: '带集市熟客消息', storyLabel: '米拉已经把牧场记进熟客名单，下次来会优先带来集市里的好消息。', tone: 'seed' },
    },
    taro: {
      0: { promiseLabel: '完成委托后看建材', storyLabel: '太郎会先确认这次材料，完成后再帮你估下一块木料和石材。', tone: 'build' },
      1: { promiseLabel: '带木料打磨建议', storyLabel: '太郎说下次路过工坊，会顺手带来一条适合扩建的小建议。', tone: 'build' },
      3: { promiseLabel: '预留工坊建材包', storyLabel: '工坊开始给你留角料和钉子，下次回访会更像有人帮忙扩建。', tone: 'build' },
      5: { promiseLabel: '带木屋熟客牌消息', storyLabel: '太郎把你当成老主顾，下次会带来更完整的木屋维护建议。', tone: 'build' },
    },
    lina: {
      0: { promiseLabel: '完成委托后留花签', storyLabel: '莉娜会先收下这次材料，完成后再把下次花坛灵感写成小花签。', tone: 'flower' },
      1: { promiseLabel: '带花束布置灵感', storyLabel: '莉娜说下次会带一束小花，帮你把入口布置得更有生活感。', tone: 'flower' },
      3: { promiseLabel: '预留花坛草图', storyLabel: '花店开始给你画专属草图，下次回访会带来更完整的小路边灵感。', tone: 'flower' },
      5: { promiseLabel: '带花店明信片', storyLabel: '莉娜已经把牧场写进明信片，下次来会像朋友一样分享花店近况。', tone: 'flower' },
    },
  };
  const promise = visitorPromises[visit.visitorId]?.[promiseStage] || visitorPromises[visit.visitorId]?.[0];
  if (!promise) return null;
  const nextVisitLabel = visit.completed ? '下次来访' : '交付后回访';
  const completedLabel = `熟络 ${completedCount} 次`;
  return {
    nextVisitLabel,
    promiseLabel: promise.promiseLabel,
    storyLabel: promise.storyLabel,
    completedLabel,
    title: `${visit.visitorName}${nextVisitLabel}：${promise.promiseLabel}。${promise.storyLabel}（${completedLabel}）`,
    tone: promise.tone,
  };
}

function farmNpcBondPreview(visit: FarmNpcVisitState | undefined, farmCanvas: FarmCanvasState | undefined): FarmNpcBondPreview | null {
  if (!visit) return null;
  const completedCount = (farmCanvas?.npcVisits || []).filter((item) => item.visitorId === visit.visitorId && item.completed).length;
  const nextTarget = [1, 3, 5].find((target) => completedCount < target) || completedCount + 3;
  const nextCompletedCount = visit.completed ? completedCount : completedCount + 1;
  const nextRewardLabel = farmNpcBondRewardLabel(visit.visitorId, nextTarget);
  const levelLabel = farmNpcBondLevelLabel(completedCount);
  const progressValue = Math.min(completedCount, nextTarget);
  const nextProgressValue = Math.min(nextCompletedCount, nextTarget);
  const progressLabel = `${progressValue}/${nextTarget}`;
  const percent = Math.round((progressValue / Math.max(1, nextTarget)) * 100);
  const afterDeliveryLabel = nextCompletedCount >= nextTarget && completedCount < nextTarget
    ? `交付后解锁：${nextRewardLabel}`
    : visit.completed
      ? '今日熟络已记录'
      : `交付后熟络 ${nextProgressValue}/${nextTarget}`;
  return {
    levelLabel,
    progressLabel,
    nextRewardLabel,
    afterDeliveryLabel,
    title: `${visit.visitorName}熟络：${levelLabel} ${progressLabel}，下一档 ${nextRewardLabel}。${afterDeliveryLabel}`,
    percent,
  };
}

function farmWeatherIcon(weather: FarmCanvasState['weather'] | undefined) {
  if (weather === 'rainy') return Droplets;
  if (weather === 'cloudy') return CloudSun;
  if (weather === 'festival') return Flag;
  return Sprout;
}

function farmLongTermGoalIcon(goalId: FarmLongTermGoal['id']) {
  if (goalId === 'crop-catalog') return Package;
  if (goalId === 'farmstead-buildings') return Hammer;
  if (goalId === 'orders-10') return Wheat;
  if (goalId === 'decor-30') return ImageIcon;
  if (goalId === 'days-7') return CalendarDays;
  return Sprout;
}

function farmLongGoalActionHint(
  goal: FarmLongTermGoal,
  farmCanvas: FarmCanvasState | undefined,
): FarmLongGoalActionHint {
  const objects = farmCanvas?.objects || [];
  const tutorialStep = buildFarmTutorialSteps(farmCanvas).find((step) => !step.done);
  const matureCount = objects.filter((object) => object.crop?.stage === 'mature').length;
  const dryCount = objects.filter((object) =>
    object.kind === 'plot'
    && object.crop
    && object.crop.dryDays > 0
    && object.crop.stage !== 'withered'
  ).length;
  const builtBuildingIds = new Set(
    objects
      .filter((object) => object.kind === 'building' && object.buildingId)
      .map((object) => object.buildingId || ''),
  );
  const nextBuildingId = Object.keys(FARM_BUILDING_DEFINITIONS).find((buildingId) => !builtBuildingIds.has(buildingId)) || 'hut';
  const selectedDecorId = farmCanvas?.selectedDecorId || FARM_DEFAULT_DECOR_ID;
  const readyOrder = farmCanvas?.orders.find((order) => canCompleteOrder(farmCanvas, order.id));
  const activeVisit = getActiveFarmNpcVisit(farmCanvas);
  const readyVisit = activeVisit && canCompleteFarmNpcVisit(farmCanvas, activeVisit.id) ? activeVisit : undefined;
  const makeHint = (
    label: string,
    title: string,
    action: FarmFocusGoalAction,
    routeTarget: FarmStoryPanelRouteHintTarget,
    routeLabel = farmRouteLabelForTarget(routeTarget),
  ): FarmLongGoalActionHint => ({
    label,
    title,
    action,
    routeTarget,
    routeLabel,
    canvasTarget: farmFocusActionNextTarget(action) || 'action',
  });

  if (goal.done) {
    return makeHint('继续经营', `手账已完成：${goal.title}，继续过一天刷新天气、订单和来访。`, { kind: 'advance-day' }, 'day');
  }

  if (goal.id === 'starter-route') {
    if (tutorialStep?.id === 'till') {
      return makeHint('去锄地', '新手路线下一步：把空地翻成可播种的田。', { kind: 'select-tool', tool: 'hoe' }, 'building-yield-summary', '开田');
    }
    if (tutorialStep?.id === 'plant') {
      return makeHint('去播种', '新手路线下一步：给空田播下第一批种子。', { kind: 'select-tool', tool: 'seed' }, 'day', '播种');
    }
    if (tutorialStep?.id === 'water' || dryCount > 0) {
      return makeHint('去浇水', '新手路线下一步：给缺水作物补水。', { kind: 'select-tool', tool: 'water' }, 'water');
    }
    if (tutorialStep?.id === 'harvest') {
      return makeHint('去收获', '新手路线下一步：收获成熟作物。', matureCount > 0 ? { kind: 'jump-mature' } : { kind: 'select-tool', tool: 'harvest' }, 'mature-crop');
    }
    if (tutorialStep?.id === 'order' && readyOrder) {
      return makeHint('去交单', '新手路线下一步：交付第一张萝卜订单。', { kind: 'complete-order', orderId: readyOrder.id }, 'ready-order');
    }
    return makeHint('看成熟', '新手路线下一步：先找到可收获作物。', matureCount > 0 ? { kind: 'jump-mature' } : { kind: 'select-tool', tool: 'harvest' }, 'mature-crop');
  }

  if (goal.id === 'crop-catalog') {
    return makeHint(
      matureCount > 0 ? '收图鉴' : '种图鉴',
      matureCount > 0 ? '作物图鉴下一步：收获成熟作物点亮新条目。' : '作物图鉴下一步：继续播种并等待成熟。',
      matureCount > 0 ? { kind: 'jump-mature' } : { kind: 'select-tool', tool: 'seed' },
      matureCount > 0 ? 'mature-crop' : 'day',
      matureCount > 0 ? '成熟' : '播种',
    );
  }

  if (goal.id === 'farmstead-buildings') {
    const building = FARM_BUILDING_DEFINITIONS[nextBuildingId] || FARM_BUILDING_DEFINITIONS.hut;
    return makeHint(`建${building.label}`, `建筑手账下一步：选择${building.label}，补齐牧场设施。`, { kind: 'select-building', buildingId: building.id }, 'building-yield-summary');
  }

  if (goal.id === 'orders-10') {
    if (readyOrder) {
      return makeHint('交订单', '委托手账下一步：交付已经备齐材料的订单。', { kind: 'complete-order', orderId: readyOrder.id }, 'ready-order');
    }
    if (!builtBuildingIds.has('board')) {
      return makeHint('建公告板', '委托手账下一步：先建公告板，让订单路线更清楚。', { kind: 'select-building', buildingId: 'board' }, 'building-yield-summary', '公告板');
    }
    return makeHint('备材料', '委托手账下一步：先收获作物，为订单备齐材料。', matureCount > 0 ? { kind: 'jump-mature' } : { kind: 'select-tool', tool: 'seed' }, matureCount > 0 ? 'mature-crop' : 'ready-order');
  }

  if (goal.id === 'decor-30') {
    return makeHint('去布置', '装饰手账下一步：选择装饰，继续提升牧场生活感。', { kind: 'select-decor', decorId: selectedDecorId }, 'beauty');
  }

  if (goal.id === 'days-7') {
    return makeHint('过一天', '经营手账下一步：推进到明天，刷新天气、动物产出和来访。', { kind: 'advance-day' }, 'day');
  }

  if (readyVisit) {
    return makeHint('见来访', '手账下一步：先交付已经备齐材料的来访委托。', { kind: 'complete-npc', visitId: readyVisit.id }, 'ready-npc');
  }
  return makeHint('看目标', `手账下一步：继续推进 ${goal.title}。`, { kind: 'advance-day' }, 'day');
}

function farmDecorUnlockRouteHint(
  decor: FarmDecorOption,
  farmCanvas: FarmCanvasState | undefined,
): FarmDecorUnlockRouteHint {
  const objects = farmCanvas?.objects || [];
  const matureCount = objects.filter((object) => object.kind === 'plot' && object.crop?.stage === 'mature').length;
  const builtBuildingIds = new Set(
    objects
      .filter((object) => object.kind === 'building' && object.buildingId)
      .map((object) => object.buildingId || ''),
  );
  const readyOrder = farmCanvas?.orders.find((order) => canCompleteOrder(farmCanvas, order.id));
  const sourceLabel = decor.unlockHint || '完成订单解锁';
  const makeHint = (
    label: string,
    title: string,
    action: FarmFocusGoalAction,
    routeTarget: FarmStoryPanelRouteHintTarget,
    routeLabel = farmRouteLabelForTarget(routeTarget),
  ): FarmDecorUnlockRouteHint => ({
    label,
    title,
    sourceLabel,
    action,
    routeTarget,
    routeLabel,
    canvasTarget: farmFocusActionNextTarget(action) || 'action',
  });

  if (sourceLabel.includes('订单') || decor.id === 'wood-fence') {
    if (readyOrder) {
      return makeHint('交订单', `解锁${decor.label}：${sourceLabel}。现在已有订单材料备齐，可以先交付。`, { kind: 'complete-order', orderId: readyOrder.id }, 'ready-order');
    }
    if (matureCount > 0) {
      return makeHint('收材料', `解锁${decor.label}：${sourceLabel}。先收获成熟作物，为订单备料。`, { kind: 'jump-mature' }, 'mature-crop');
    }
    if (!builtBuildingIds.has('board')) {
      return makeHint('建公告板', `解锁${decor.label}：${sourceLabel}。先选择公告板，让订单路线更明显。`, { kind: 'select-building', buildingId: 'board' }, 'building-yield-summary', '公告板');
    }
    return makeHint('播种备货', `解锁${decor.label}：${sourceLabel}。先播种并准备下一轮订单材料。`, { kind: 'select-tool', tool: 'seed' }, 'ready-order', '备料');
  }

  return makeHint('看美化', `解锁${decor.label}：${sourceLabel}。先继续布置已解锁装饰，提升漂亮度和生活感。`, { kind: 'select-decor', decorId: FARM_DEFAULT_DECOR_ID }, 'beauty');
}

function clampFarmTutorialProgress(value: unknown, target: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(target, Math.max(0, Math.round(parsed)));
}

function buildFarmTutorialSteps(farmCanvas: FarmCanvasState | undefined): FarmTutorialStep[] {
  const stats = farmCanvas?.stats;
  const steps = [
    { id: 'till', label: '开出 3 块田', hint: '把空地翻成田。', current: clampFarmTutorialProgress(stats?.plotsTilled, 3), target: 3 },
    { id: 'plant', label: '种下 3 颗种子', hint: '让田里长出第一批小芽。', current: clampFarmTutorialProgress(stats?.cropsPlanted, 3), target: 3 },
    { id: 'water', label: '浇水 3 次', hint: '给小芽补水，第二天才会继续长。', current: clampFarmTutorialProgress(stats?.cropsWatered, 3), target: 3 },
    { id: 'harvest', label: '收获 3 个作物', hint: '成熟后装进收获篮。', current: clampFarmTutorialProgress(stats?.cropsHarvested, 3), target: 3 },
    { id: 'order', label: '交付 1 个订单', hint: '把订单材料交给公告板。', current: clampFarmTutorialProgress(stats?.ordersCompleted, 1), target: 1 },
  ];
  return steps.map((step) => ({ ...step, done: step.current >= step.target }));
}

function canCompleteOrder(farmCanvas: FarmCanvasState | undefined, orderId: string) {
  const order = farmCanvas?.orders.find((item) => item.id === orderId);
  if (!farmCanvas || !order || order.completed) return false;
  return order.requirements.every((requirement) =>
    (farmCanvas.inventory.crops[requirement.cropId] || 0) >= requirement.amount);
}

export default function FarmStoryPanel(props: FarmStoryPanelProps) {
  if (props.visualStyle !== 'farm-story') return null;
  return <FarmStoryPanelRuntime {...props} />;
}

function FarmStoryPanelRuntime({
  visualStyle,
  themeMode,
  open: controlledOpen,
  onOpenChange,
  showInlineToggle = true,
  priorityFocusRequestId = 0,
  viewportMoving,
  nodeDragging,
  farmCanvas,
  editing = false,
  feedback,
  soundEnabled = true,
  devToolsEnabled = false,
  onToggleEditing,
  onToggleSound,
  onGrantDevMaterials,
  onSelectTool,
  onSelectBuilding,
  onSelectDecor,
  resourceDecorItems = [],
  resourceDecorLoading = false,
  onRefreshResourceDecor,
  onSelectResourceDecor,
  onJumpToMature,
  onAdvanceDay,
  onCompleteOrder,
  onCompleteNpcVisit,
  onFollowupCanvasHint,
}: FarmStoryPanelProps) {
  const [internalOpen, setInternalOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(T8_FARM_STORY_PANEL_COLLAPSED_STORAGE_KEY) === '0';
    } catch {
      return false;
    }
  });
  const panelOpen = controlledOpen ?? internalOpen;
  const setOpen = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(panelOpen) : next;
    if (controlledOpen === undefined) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  }, [controlledOpen, onOpenChange, panelOpen]);
  const [farmPanelSectionExpanded, setFarmPanelSectionExpanded] = useState<FarmPanelSectionExpandedState>(readFarmPanelSectionExpanded);
  const [dismissedSummaryId, setDismissedSummaryId] = useState('');
  const [resourceDecorType, setResourceDecorType] = useState<FarmDecorObjectType>('sign');
  const [farmRewardBursts, setFarmRewardBursts] = useState<FarmRewardBurst[]>([]);
  const [farmMiniQuickActionFeedback, setFarmMiniQuickActionFeedback] = useState<FarmMiniQuickActionFeedback | null>(null);
  const [farmQuickToolRouteReceipt, setFarmQuickToolRouteReceipt] = useState<FarmTool | ''>('');
  const [farmQuickToolAssistReceipt, setFarmQuickToolAssistReceipt] = useState<FarmTool | ''>('');
  const [farmPlacementFollowupActionReceipt, setFarmPlacementFollowupActionReceipt] = useState('');
  const [farmPlacementRouteHintReceipt, setFarmPlacementRouteHintReceipt] = useState('');
  const [farmDecorUnlockRouteReceipt, setFarmDecorUnlockRouteReceipt] = useState('');
  const [farmSummaryDetailActionFeedback, setFarmSummaryDetailActionFeedback] = useState('');
  const [farmSummaryDetailActionFeedbackItemId, setFarmSummaryDetailActionFeedbackItemId] = useState('');
  const [farmLiveFeedbackCompletionReceipt, setFarmLiveFeedbackCompletionReceipt] = useState<FarmLiveFeedbackCompletionReceipt | null>(null);
  const [farmOrderStampFeedbackId, setFarmOrderStampFeedbackId] = useState('');
  const [farmOrderRewardPocketReceipt, setFarmOrderRewardPocketReceipt] = useState<FarmOrderRewardPocketReceipt | null>(null);
  const [farmOrderRewardRouteReceipt, setFarmOrderRewardRouteReceipt] = useState('');
  const [farmOrderRewardNextActionReceipt, setFarmOrderRewardNextActionReceipt] = useState('');
  const [farmOrderLocatePulseId, setFarmOrderLocatePulseId] = useState('');
  const [farmMatureJumpPulseId, setFarmMatureJumpPulseId] = useState('');
  const [farmDryWaterPulseId, setFarmDryWaterPulseId] = useState('');
  const [farmSeedToolPulseId, setFarmSeedToolPulseId] = useState('');
  const [farmWaterToolPulseId, setFarmWaterToolPulseId] = useState('');
  const [farmWoodBuildPulseId, setFarmWoodBuildPulseId] = useState('');
  const [farmStoneBuildPulseId, setFarmStoneBuildPulseId] = useState('');
  const [farmWitheredShovelPulseId, setFarmWitheredShovelPulseId] = useState('');
  const [farmScarecrowRiskPulseId, setFarmScarecrowRiskPulseId] = useState('');
  const [farmNpcDeliveryFeedbackId, setFarmNpcDeliveryFeedbackId] = useState('');
  const [farmNpcVisitPulseId, setFarmNpcVisitPulseId] = useState('');
  const [farmBeautyDetailPulseId, setFarmBeautyDetailPulseId] = useState('');
  const [farmBeautyRewardRouteReceipt, setFarmBeautyRewardRouteReceipt] = useState('');
  const [farmSeasonDetailPulseId, setFarmSeasonDetailPulseId] = useState('');
  const [farmToolDetailPulseId, setFarmToolDetailPulseId] = useState('');
  const [farmSummaryPulseId, setFarmSummaryPulseId] = useState('');
  const [farmActivityDetailPulseId, setFarmActivityDetailPulseId] = useState('');
  const [farmActivityFocusTarget, setFarmActivityFocusTarget] = useState<FarmActivityFocusTarget>('');
  const [farmActivityRewardStreakActionReceipt, setFarmActivityRewardStreakActionReceipt] = useState('');
  const [farmActivityRewardStreakActionReceiptFollowup, setFarmActivityRewardStreakActionReceiptFollowup] = useState('');
  const [farmActivityRewardStreakActionReceiptRouteReceipt, setFarmActivityRewardStreakActionReceiptRouteReceipt] = useState('');
  const [farmActivityChestClaimPulseId, setFarmActivityChestClaimPulseId] = useState('');
  const [farmActivityChestChargeReceipt, setFarmActivityChestChargeReceipt] = useState('');
  const [farmActivityChestClaimNextReceipt, setFarmActivityChestClaimNextReceipt] = useState('');
  const [farmRewardDetailPulseId, setFarmRewardDetailPulseId] = useState('');
  const [farmBuildingEffectPulseId, setFarmBuildingEffectPulseId] = useState('');
  const [farmBuildingEffectQuestRouteReceipt, setFarmBuildingEffectQuestRouteReceipt] = useState('');
  const [farmAnimalProductPulseId, setFarmAnimalProductPulseId] = useState('');
  const [farmLongGoalActionReceiptId, setFarmLongGoalActionReceiptId] = useState('');
  const [farmDailyRouteReceipt, setFarmDailyRouteReceipt] = useState('');
  const [farmDailyRouteWrapupReceipt, setFarmDailyRouteWrapupReceipt] = useState<FarmDailyRouteWrapupReceipt | null>(null);
  const [farmTomorrowRouteReceipt, setFarmTomorrowRouteReceipt] = useState('');
  const [farmMorningBriefReceipt, setFarmMorningBriefReceipt] = useState('');
  const [farmPrioritySectionReceipt, setFarmPrioritySectionReceipt] = useState<FarmPanelSectionId | ''>('');
  const [farmPriorityActionReceipt, setFarmPriorityActionReceipt] = useState<FarmPriorityActionKind | ''>('');
  const [farmMonitorBriefRouteReceipt, setFarmMonitorBriefRouteReceipt] = useState<FarmPriorityActionKind | ''>('');
  const [farmPriorityQueueReceipt, setFarmPriorityQueueReceipt] = useState<string>('');
  const [farmPriorityQueueRouteReceipt, setFarmPriorityQueueRouteReceipt] = useState<string>('');
  const [farmPriorityComboReceipt, setFarmPriorityComboReceipt] = useState<FarmPriorityComboReceipt | null>(null);
  const [farmPriorityFlowReceipt, setFarmPriorityFlowReceipt] = useState<FarmPriorityFlowReceipt | null>(null);
  const [farmPanelSectionPresetReceipt, setFarmPanelSectionPresetReceipt] = useState<FarmPanelSectionPresetReceipt | null>(null);
  const [farmControlConsoleFocusReceipt, setFarmControlConsoleFocusReceipt] = useState<FarmControlConsoleFocusReceipt | null>(null);
  const farmRewardItemsRef = useRef<HTMLSpanElement | null>(null);
  const farmLiveFeedbackRef = useRef<HTMLDivElement | null>(null);
  const farmBeautyRef = useRef<HTMLDivElement | null>(null);
  const farmSeasonRef = useRef<HTMLDivElement | null>(null);
  const farmFocusRef = useRef<HTMLDivElement | null>(null);
  const farmTutorialRef = useRef<HTMLDivElement | null>(null);
  const farmLongGoalsRef = useRef<HTMLDivElement | null>(null);
  const farmToolsRef = useRef<HTMLDivElement | null>(null);
  const farmPaletteRef = useRef<HTMLDivElement | null>(null);
  const farmSummaryRef = useRef<HTMLDivElement | null>(null);
  const farmActivityRef = useRef<HTMLDivElement | null>(null);
  const farmActivityRewardDigestRef = useRef<HTMLDivElement | null>(null);
  const farmActivityStreakRef = useRef<HTMLElement | null>(null);
  const farmActivityMilestoneRef = useRef<HTMLElement | null>(null);
  const farmActivityStreakMeterRef = useRef<HTMLDivElement | null>(null);
  const farmActivityCompletionRef = useRef<HTMLElement | null>(null);
  const farmActivityActionRef = useRef<HTMLElement | null>(null);
  const farmActivityChestRef = useRef<HTMLElement | null>(null);
  const farmBuildingEffectsRef = useRef<HTMLDivElement | null>(null);
  const farmAnimalsRef = useRef<HTMLDivElement | null>(null);
  const farmNpcVisitRef = useRef<HTMLDivElement | null>(null);
  const farmOrderRef = useRef<HTMLDivElement | null>(null);
  const farmActionsRef = useRef<HTMLDivElement | null>(null);
  const farmRewardSnapshotRef = useRef<FarmRewardSnapshot | null>(null);
  const farmTutorialCompletionRef = useRef<Set<string> | null>(null);
  const farmLongGoalCompletionRef = useRef<Set<string> | null>(null);
  const farmRewardTimersRef = useRef<Map<string, number>>(new Map());
  const farmMiniQuickActionTimerRef = useRef<number | null>(null);
  const farmQuickToolRouteTimerRef = useRef<number | null>(null);
  const farmQuickToolAssistTimerRef = useRef<number | null>(null);
  const farmPlacementFollowupActionTimerRef = useRef<number | null>(null);
  const farmPlacementRouteHintTimerRef = useRef<number | null>(null);
  const farmDecorUnlockRouteTimerRef = useRef<number | null>(null);
  const farmSummaryDetailActionTimerRef = useRef<number | null>(null);
  const farmOrderStampTimerRef = useRef<number | null>(null);
  const farmOrderRewardPocketTimerRef = useRef<number | null>(null);
  const farmOrderRewardRouteTimerRef = useRef<number | null>(null);
  const farmOrderRewardNextActionTimerRef = useRef<number | null>(null);
  const farmOrderLocatePulseTimerRef = useRef<number | null>(null);
  const farmOrderLocateScrollFrameRef = useRef<number | null>(null);
  const farmMatureJumpTimerRef = useRef<number | null>(null);
  const farmDryWaterTimerRef = useRef<number | null>(null);
  const farmSeedToolTimerRef = useRef<number | null>(null);
  const farmWaterToolTimerRef = useRef<number | null>(null);
  const farmWoodBuildTimerRef = useRef<number | null>(null);
  const farmStoneBuildTimerRef = useRef<number | null>(null);
  const farmWitheredShovelTimerRef = useRef<number | null>(null);
  const farmScarecrowRiskTimerRef = useRef<number | null>(null);
  const farmNpcDeliveryTimerRef = useRef<number | null>(null);
  const farmNpcVisitPulseTimerRef = useRef<number | null>(null);
  const farmNpcVisitScrollFrameRef = useRef<number | null>(null);
  const farmBeautyDetailPulseTimerRef = useRef<number | null>(null);
  const farmBeautyDetailScrollFrameRef = useRef<number | null>(null);
  const farmBeautyRewardRouteTimerRef = useRef<number | null>(null);
  const farmSeasonDetailPulseTimerRef = useRef<number | null>(null);
  const farmSeasonDetailScrollFrameRef = useRef<number | null>(null);
  const farmToolDetailPulseTimerRef = useRef<number | null>(null);
  const farmToolDetailScrollFrameRef = useRef<number | null>(null);
  const farmSummaryPulseTimerRef = useRef<number | null>(null);
  const farmSummaryScrollFrameRef = useRef<number | null>(null);
  const farmActivityDetailPulseTimerRef = useRef<number | null>(null);
  const farmActivityRewardStreakActionReceiptTimerRef = useRef<number | null>(null);
  const farmActivityRewardStreakActionReceiptRouteTimerRef = useRef<number | null>(null);
  const farmActivityChestClaimTimerRef = useRef<number | null>(null);
  const farmActivityChestChargeReceiptTimerRef = useRef<number | null>(null);
  const farmActivityChestClaimNextReceiptTimerRef = useRef<number | null>(null);
  const farmActivityDetailScrollFrameRef = useRef<number | null>(null);
  const farmFollowupCanvasHintKeyRef = useRef('');
  const farmPlacementReceiptCanvasHintKeyRef = useRef('');
  const farmRewardDetailPulseTimerRef = useRef<number | null>(null);
  const farmRewardDetailScrollFrameRef = useRef<number | null>(null);
  const farmBuildingEffectPulseTimerRef = useRef<number | null>(null);
  const farmBuildingEffectQuestRouteTimerRef = useRef<number | null>(null);
  const farmBuildingEffectScrollFrameRef = useRef<number | null>(null);
  const farmAnimalProductPulseTimerRef = useRef<number | null>(null);
  const farmAnimalProductScrollFrameRef = useRef<number | null>(null);
  const farmLongGoalActionTimerRef = useRef<number | null>(null);
  const farmDailyRouteReceiptTimerRef = useRef<number | null>(null);
  const farmDailyRouteWrapupReceiptTimerRef = useRef<number | null>(null);
  const farmTomorrowRouteReceiptTimerRef = useRef<number | null>(null);
  const farmMorningBriefReceiptTimerRef = useRef<number | null>(null);
  const farmPrioritySectionTimerRef = useRef<number | null>(null);
  const farmPrioritySectionScrollFrameRef = useRef<number | null>(null);
  const farmPriorityFocusRequestRef = useRef(priorityFocusRequestId);
  const farmControlConsoleFocusReceiptTimerRef = useRef<number | null>(null);
  const farmPriorityActionTimerRef = useRef<number | null>(null);
  const farmMonitorBriefRouteTimerRef = useRef<number | null>(null);
  const farmPriorityQueueTimerRef = useRef<number | null>(null);
  const farmPriorityQueueRouteTimerRef = useRef<number | null>(null);
  const farmPriorityComboTimerRef = useRef<number | null>(null);
  const farmPriorityFlowTimerRef = useRef<number | null>(null);
  const farmPanelSectionPresetTimerRef = useRef<number | null>(null);
  const farmPanelRef = useRef<HTMLElement | null>(null);
  const dailySummary = farmCanvas?.lastDailySummary;
  const showDailySummary = visualStyle === 'farm-story' && Boolean(dailySummary && dismissedSummaryId !== dailySummary.id);

  const pushFarmRewardBurst = useCallback((burst: Omit<FarmRewardBurst, 'id'>) => {
    if (typeof window === 'undefined') return;
    const id = `farm-reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFarmRewardBursts((prev) => [{ ...burst, id }, ...prev].slice(0, MAX_FARM_REWARD_BURSTS));
    const timerId = window.setTimeout(() => {
      farmRewardTimersRef.current.delete(id);
      setFarmRewardBursts((prev) => prev.filter((item) => item.id !== id));
    }, FARM_REWARD_BURST_MS);
    farmRewardTimersRef.current.set(id, timerId);
  }, []);

  const flashFarmOrderStamp = useCallback((orderId: string) => {
    if (farmOrderStampTimerRef.current !== null) {
      window.clearTimeout(farmOrderStampTimerRef.current);
    }
    setFarmOrderStampFeedbackId(orderId);
    farmOrderStampTimerRef.current = window.setTimeout(() => {
      setFarmOrderStampFeedbackId('');
      farmOrderStampTimerRef.current = null;
    }, 1200);
  }, []);

  const flashFarmNpcDelivery = useCallback((visitId: string) => {
    if (farmNpcDeliveryTimerRef.current !== null) {
      window.clearTimeout(farmNpcDeliveryTimerRef.current);
    }
    setFarmNpcDeliveryFeedbackId(visitId);
    farmNpcDeliveryTimerRef.current = window.setTimeout(() => {
      setFarmNpcDeliveryFeedbackId('');
      farmNpcDeliveryTimerRef.current = null;
    }, 1200);
  }, []);

  const isFarmPanelSectionExpanded = useCallback((id: FarmPanelSectionId) => farmPanelSectionExpanded[id] === true, [farmPanelSectionExpanded]);

  const setFarmPanelSectionOpen = useCallback((id: FarmPanelSectionId, expanded = true) => {
    setFarmPanelSectionExpanded((current) => {
      if (!expanded) return current[id] === true ? {} : current;
      if (current[id] === true && Object.keys(current).length === 1) return current;
      return { [id]: true };
    });
  }, []);

  const toggleFarmPanelSection = useCallback((id: FarmPanelSectionId) => {
    setFarmPanelSectionExpanded((current) => current[id] === true ? {} : { [id]: true });
  }, []);

  const flashFarmPanelSectionPreset = useCallback((receipt: FarmPanelSectionPresetReceipt) => {
    if (typeof window === 'undefined') return;
    if (farmPanelSectionPresetTimerRef.current !== null) {
      window.clearTimeout(farmPanelSectionPresetTimerRef.current);
    }
    setFarmPanelSectionPresetReceipt(receipt);
    farmPanelSectionPresetTimerRef.current = window.setTimeout(() => {
      setFarmPanelSectionPresetReceipt(null);
      farmPanelSectionPresetTimerRef.current = null;
    }, 1400);
  }, []);

  const farmPrioritySectionElement = useCallback((sectionId: FarmPanelSectionId): HTMLElement | null => {
    switch (sectionId) {
      case 'feedback':
        return farmLiveFeedbackRef.current;
      case 'season':
        return farmSeasonRef.current;
      case 'focus':
        return farmFocusRef.current;
      case 'beauty':
        return farmBeautyRef.current;
      case 'guide':
        return farmTutorialRef.current || farmLongGoalsRef.current;
      case 'tools':
        return farmToolsRef.current;
      case 'build':
        return farmPaletteRef.current;
      case 'building':
        return farmBuildingEffectsRef.current;
      case 'animals':
        return farmAnimalsRef.current;
      case 'visits':
        return farmOrderRef.current || farmNpcVisitRef.current;
      case 'summary':
        return farmSummaryRef.current;
      case 'activity':
        return farmActivityRef.current;
      case 'actions':
        return farmActionsRef.current;
      default:
        return null;
    }
  }, []);

  const flashFarmPrioritySection = useCallback((sectionId: FarmPanelSectionId) => {
    if (typeof window === 'undefined') return;
    if (farmPrioritySectionTimerRef.current !== null) {
      window.clearTimeout(farmPrioritySectionTimerRef.current);
    }
    if (farmPrioritySectionScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmPrioritySectionScrollFrameRef.current);
    }
    setFarmPrioritySectionReceipt(sectionId);
    farmPrioritySectionScrollFrameRef.current = window.requestAnimationFrame(() => {
      const priorityElement = farmPrioritySectionElement(sectionId);
      const prefersReducedPriorityMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const priorityScrollBehavior: ScrollBehavior = prefersReducedPriorityMotion ? 'auto' : 'smooth';
      priorityElement?.scrollIntoView({ block: 'nearest', behavior: priorityScrollBehavior });
      priorityElement?.focus({ preventScroll: true });
      farmPrioritySectionScrollFrameRef.current = null;
    });
    farmPrioritySectionTimerRef.current = window.setTimeout(() => {
      setFarmPrioritySectionReceipt('');
      farmPrioritySectionTimerRef.current = null;
    }, 1300);
  }, [farmPrioritySectionElement]);

  const flashFarmPriorityAction = useCallback((kind: FarmPriorityActionKind) => {
    if (typeof window === 'undefined') return;
    if (farmPriorityActionTimerRef.current !== null) {
      window.clearTimeout(farmPriorityActionTimerRef.current);
    }
    setFarmPriorityActionReceipt(kind);
    farmPriorityActionTimerRef.current = window.setTimeout(() => {
      setFarmPriorityActionReceipt('');
      farmPriorityActionTimerRef.current = null;
    }, 1300);
  }, []);

  const flashFarmMonitorBriefRoute = useCallback((kind: FarmPriorityActionKind) => {
    if (typeof window === 'undefined') return;
    if (farmMonitorBriefRouteTimerRef.current !== null) {
      window.clearTimeout(farmMonitorBriefRouteTimerRef.current);
    }
    setFarmMonitorBriefRouteReceipt(kind);
    farmMonitorBriefRouteTimerRef.current = window.setTimeout(() => {
      setFarmMonitorBriefRouteReceipt('');
      farmMonitorBriefRouteTimerRef.current = null;
    }, 1300);
  }, []);

  const flashFarmControlConsoleFocusReceipt = useCallback((receipt: FarmControlConsoleFocusReceipt) => {
    if (typeof window === 'undefined') return;
    if (farmControlConsoleFocusReceiptTimerRef.current !== null) {
      window.clearTimeout(farmControlConsoleFocusReceiptTimerRef.current);
    }
    setFarmControlConsoleFocusReceipt(receipt);
    farmControlConsoleFocusReceiptTimerRef.current = window.setTimeout(() => {
      setFarmControlConsoleFocusReceipt(null);
      farmControlConsoleFocusReceiptTimerRef.current = null;
    }, 1700);
  }, []);

  const flashFarmPriorityQueue = useCallback((itemId: string) => {
    if (typeof window === 'undefined') return;
    if (farmPriorityQueueTimerRef.current !== null) {
      window.clearTimeout(farmPriorityQueueTimerRef.current);
    }
    setFarmPriorityQueueReceipt(itemId);
    farmPriorityQueueTimerRef.current = window.setTimeout(() => {
      setFarmPriorityQueueReceipt('');
      farmPriorityQueueTimerRef.current = null;
    }, 1300);
  }, []);

  const flashFarmPriorityQueueRoute = useCallback((itemId: string) => {
    if (typeof window === 'undefined') return;
    if (farmPriorityQueueRouteTimerRef.current !== null) {
      window.clearTimeout(farmPriorityQueueRouteTimerRef.current);
    }
    setFarmPriorityQueueRouteReceipt(itemId);
    farmPriorityQueueRouteTimerRef.current = window.setTimeout(() => {
      setFarmPriorityQueueRouteReceipt('');
      farmPriorityQueueRouteTimerRef.current = null;
    }, 1300);
  }, []);

  const flashFarmPriorityCombo = useCallback((actionLabel: string, source: FarmPriorityComboSource) => {
    if (typeof window === 'undefined') return;
    if (farmPriorityComboTimerRef.current !== null) {
      window.clearTimeout(farmPriorityComboTimerRef.current);
    }
    setFarmPriorityComboReceipt((current) => {
      const nextCount = Math.min((current?.count || 0) + 1, 9);
      const comboLabel = nextCount >= 5 ? '丰收连击' : nextCount >= 3 ? '顺手连击' : '节奏接上';
      const rewardLabel = nextCount >= 5 ? '今日成果加速' : nextCount >= 3 ? '路线更顺' : '下一件已亮';
      return {
        id: `priority-combo-${source}-${Date.now()}`,
        source,
        count: nextCount,
        actionLabel,
        comboLabel,
        rewardLabel,
      };
    });
    farmPriorityComboTimerRef.current = window.setTimeout(() => {
      setFarmPriorityComboReceipt(null);
      farmPriorityComboTimerRef.current = null;
    }, 2600);
  }, []);

  const flashFarmPriorityFlowReceipt = useCallback((receipt: Omit<FarmPriorityFlowReceipt, 'id'>) => {
    if (typeof window === 'undefined') return;
    if (farmPriorityFlowTimerRef.current !== null) {
      window.clearTimeout(farmPriorityFlowTimerRef.current);
    }
    setFarmPriorityFlowReceipt({
      ...receipt,
      id: `priority-flow-${receipt.source}-${Date.now()}`,
    });
    farmPriorityFlowTimerRef.current = window.setTimeout(() => {
      setFarmPriorityFlowReceipt(null);
      farmPriorityFlowTimerRef.current = null;
    }, 3400);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(T8_FARM_STORY_PANEL_COLLAPSED_STORAGE_KEY, panelOpen ? '0' : '1');
    } catch {
      // Storage is optional for this preview panel.
    }
  }, [panelOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FARM_PANEL_SECTION_STORAGE_KEY, JSON.stringify(farmPanelSectionExpanded));
    } catch {
      // Section preferences are a convenience; the panel still works without storage.
    }
  }, [farmPanelSectionExpanded]);

  useEffect(() => () => {
    farmRewardTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    farmRewardTimersRef.current.clear();
    if (farmMiniQuickActionTimerRef.current !== null) {
      window.clearTimeout(farmMiniQuickActionTimerRef.current);
      farmMiniQuickActionTimerRef.current = null;
    }
    if (farmQuickToolRouteTimerRef.current !== null) {
      window.clearTimeout(farmQuickToolRouteTimerRef.current);
      farmQuickToolRouteTimerRef.current = null;
    }
    if (farmQuickToolAssistTimerRef.current !== null) {
      window.clearTimeout(farmQuickToolAssistTimerRef.current);
      farmQuickToolAssistTimerRef.current = null;
    }
    if (farmPlacementFollowupActionTimerRef.current !== null) {
      window.clearTimeout(farmPlacementFollowupActionTimerRef.current);
      farmPlacementFollowupActionTimerRef.current = null;
    }
    if (farmPlacementRouteHintTimerRef.current !== null) {
      window.clearTimeout(farmPlacementRouteHintTimerRef.current);
      farmPlacementRouteHintTimerRef.current = null;
    }
    if (farmDecorUnlockRouteTimerRef.current !== null) {
      window.clearTimeout(farmDecorUnlockRouteTimerRef.current);
      farmDecorUnlockRouteTimerRef.current = null;
    }
    if (farmSummaryDetailActionTimerRef.current !== null) {
      window.clearTimeout(farmSummaryDetailActionTimerRef.current);
      farmSummaryDetailActionTimerRef.current = null;
    }
    if (farmOrderStampTimerRef.current !== null) {
      window.clearTimeout(farmOrderStampTimerRef.current);
      farmOrderStampTimerRef.current = null;
    }
    if (farmOrderRewardPocketTimerRef.current !== null) {
      window.clearTimeout(farmOrderRewardPocketTimerRef.current);
      farmOrderRewardPocketTimerRef.current = null;
    }
    if (farmOrderRewardRouteTimerRef.current !== null) {
      window.clearTimeout(farmOrderRewardRouteTimerRef.current);
      farmOrderRewardRouteTimerRef.current = null;
    }
    if (farmOrderRewardNextActionTimerRef.current !== null) {
      window.clearTimeout(farmOrderRewardNextActionTimerRef.current);
      farmOrderRewardNextActionTimerRef.current = null;
    }
    if (farmOrderLocatePulseTimerRef.current !== null) {
      window.clearTimeout(farmOrderLocatePulseTimerRef.current);
      farmOrderLocatePulseTimerRef.current = null;
    }
    if (farmOrderLocateScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmOrderLocateScrollFrameRef.current);
      farmOrderLocateScrollFrameRef.current = null;
    }
    if (farmMatureJumpTimerRef.current !== null) {
      window.clearTimeout(farmMatureJumpTimerRef.current);
      farmMatureJumpTimerRef.current = null;
    }
    if (farmDryWaterTimerRef.current !== null) {
      window.clearTimeout(farmDryWaterTimerRef.current);
      farmDryWaterTimerRef.current = null;
    }
    if (farmSeedToolTimerRef.current !== null) {
      window.clearTimeout(farmSeedToolTimerRef.current);
      farmSeedToolTimerRef.current = null;
    }
    if (farmWaterToolTimerRef.current !== null) {
      window.clearTimeout(farmWaterToolTimerRef.current);
      farmWaterToolTimerRef.current = null;
    }
    if (farmWoodBuildTimerRef.current !== null) {
      window.clearTimeout(farmWoodBuildTimerRef.current);
      farmWoodBuildTimerRef.current = null;
    }
    if (farmStoneBuildTimerRef.current !== null) {
      window.clearTimeout(farmStoneBuildTimerRef.current);
      farmStoneBuildTimerRef.current = null;
    }
    if (farmWitheredShovelTimerRef.current !== null) {
      window.clearTimeout(farmWitheredShovelTimerRef.current);
      farmWitheredShovelTimerRef.current = null;
    }
    if (farmScarecrowRiskTimerRef.current !== null) {
      window.clearTimeout(farmScarecrowRiskTimerRef.current);
      farmScarecrowRiskTimerRef.current = null;
    }
    if (farmNpcDeliveryTimerRef.current !== null) {
      window.clearTimeout(farmNpcDeliveryTimerRef.current);
      farmNpcDeliveryTimerRef.current = null;
    }
    if (farmNpcVisitPulseTimerRef.current !== null) {
      window.clearTimeout(farmNpcVisitPulseTimerRef.current);
      farmNpcVisitPulseTimerRef.current = null;
    }
    if (farmNpcVisitScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmNpcVisitScrollFrameRef.current);
      farmNpcVisitScrollFrameRef.current = null;
    }
    if (farmBeautyDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmBeautyDetailPulseTimerRef.current);
      farmBeautyDetailPulseTimerRef.current = null;
    }
    if (farmBeautyDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmBeautyDetailScrollFrameRef.current);
      farmBeautyDetailScrollFrameRef.current = null;
    }
    if (farmBeautyRewardRouteTimerRef.current !== null) {
      window.clearTimeout(farmBeautyRewardRouteTimerRef.current);
      farmBeautyRewardRouteTimerRef.current = null;
    }
    if (farmSeasonDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmSeasonDetailPulseTimerRef.current);
      farmSeasonDetailPulseTimerRef.current = null;
    }
    if (farmSeasonDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmSeasonDetailScrollFrameRef.current);
      farmSeasonDetailScrollFrameRef.current = null;
    }
    if (farmToolDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmToolDetailPulseTimerRef.current);
      farmToolDetailPulseTimerRef.current = null;
    }
    if (farmToolDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmToolDetailScrollFrameRef.current);
      farmToolDetailScrollFrameRef.current = null;
    }
    if (farmSummaryPulseTimerRef.current !== null) {
      window.clearTimeout(farmSummaryPulseTimerRef.current);
      farmSummaryPulseTimerRef.current = null;
    }
    if (farmSummaryScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmSummaryScrollFrameRef.current);
      farmSummaryScrollFrameRef.current = null;
    }
    if (farmActivityDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmActivityDetailPulseTimerRef.current);
      farmActivityDetailPulseTimerRef.current = null;
    }
    if (farmActivityRewardStreakActionReceiptTimerRef.current !== null) {
      window.clearTimeout(farmActivityRewardStreakActionReceiptTimerRef.current);
      farmActivityRewardStreakActionReceiptTimerRef.current = null;
    }
    if (farmActivityRewardStreakActionReceiptRouteTimerRef.current !== null) {
      window.clearTimeout(farmActivityRewardStreakActionReceiptRouteTimerRef.current);
      farmActivityRewardStreakActionReceiptRouteTimerRef.current = null;
    }
    if (farmBuildingEffectQuestRouteTimerRef.current !== null) {
      window.clearTimeout(farmBuildingEffectQuestRouteTimerRef.current);
      farmBuildingEffectQuestRouteTimerRef.current = null;
    }
    if (farmActivityChestClaimTimerRef.current !== null) {
      window.clearTimeout(farmActivityChestClaimTimerRef.current);
      farmActivityChestClaimTimerRef.current = null;
    }
    if (farmActivityChestClaimNextReceiptTimerRef.current !== null) {
      window.clearTimeout(farmActivityChestClaimNextReceiptTimerRef.current);
      farmActivityChestClaimNextReceiptTimerRef.current = null;
    }
    if (farmActivityChestChargeReceiptTimerRef.current !== null) {
      window.clearTimeout(farmActivityChestChargeReceiptTimerRef.current);
      farmActivityChestChargeReceiptTimerRef.current = null;
    }
    if (farmActivityDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmActivityDetailScrollFrameRef.current);
      farmActivityDetailScrollFrameRef.current = null;
    }
    if (farmRewardDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmRewardDetailPulseTimerRef.current);
      farmRewardDetailPulseTimerRef.current = null;
    }
    if (farmRewardDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmRewardDetailScrollFrameRef.current);
      farmRewardDetailScrollFrameRef.current = null;
    }
    if (farmBuildingEffectPulseTimerRef.current !== null) {
      window.clearTimeout(farmBuildingEffectPulseTimerRef.current);
      farmBuildingEffectPulseTimerRef.current = null;
    }
    if (farmBuildingEffectScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmBuildingEffectScrollFrameRef.current);
      farmBuildingEffectScrollFrameRef.current = null;
    }
    if (farmAnimalProductPulseTimerRef.current !== null) {
      window.clearTimeout(farmAnimalProductPulseTimerRef.current);
      farmAnimalProductPulseTimerRef.current = null;
    }
    if (farmAnimalProductScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmAnimalProductScrollFrameRef.current);
      farmAnimalProductScrollFrameRef.current = null;
    }
    if (farmLongGoalActionTimerRef.current !== null) {
      window.clearTimeout(farmLongGoalActionTimerRef.current);
      farmLongGoalActionTimerRef.current = null;
    }
    if (farmDailyRouteReceiptTimerRef.current !== null) {
      window.clearTimeout(farmDailyRouteReceiptTimerRef.current);
      farmDailyRouteReceiptTimerRef.current = null;
    }
    if (farmDailyRouteWrapupReceiptTimerRef.current !== null) {
      window.clearTimeout(farmDailyRouteWrapupReceiptTimerRef.current);
      farmDailyRouteWrapupReceiptTimerRef.current = null;
    }
    if (farmTomorrowRouteReceiptTimerRef.current !== null) {
      window.clearTimeout(farmTomorrowRouteReceiptTimerRef.current);
      farmTomorrowRouteReceiptTimerRef.current = null;
    }
    if (farmMorningBriefReceiptTimerRef.current !== null) {
      window.clearTimeout(farmMorningBriefReceiptTimerRef.current);
      farmMorningBriefReceiptTimerRef.current = null;
    }
    if (farmPrioritySectionTimerRef.current !== null) {
      window.clearTimeout(farmPrioritySectionTimerRef.current);
      farmPrioritySectionTimerRef.current = null;
    }
    if (farmPrioritySectionScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmPrioritySectionScrollFrameRef.current);
      farmPrioritySectionScrollFrameRef.current = null;
    }
    if (farmControlConsoleFocusReceiptTimerRef.current !== null) {
      window.clearTimeout(farmControlConsoleFocusReceiptTimerRef.current);
      farmControlConsoleFocusReceiptTimerRef.current = null;
    }
    if (farmPriorityActionTimerRef.current !== null) {
      window.clearTimeout(farmPriorityActionTimerRef.current);
      farmPriorityActionTimerRef.current = null;
    }
    if (farmMonitorBriefRouteTimerRef.current !== null) {
      window.clearTimeout(farmMonitorBriefRouteTimerRef.current);
      farmMonitorBriefRouteTimerRef.current = null;
    }
    if (farmPriorityQueueTimerRef.current !== null) {
      window.clearTimeout(farmPriorityQueueTimerRef.current);
      farmPriorityQueueTimerRef.current = null;
    }
    if (farmPriorityQueueRouteTimerRef.current !== null) {
      window.clearTimeout(farmPriorityQueueRouteTimerRef.current);
      farmPriorityQueueRouteTimerRef.current = null;
    }
    if (farmPriorityComboTimerRef.current !== null) {
      window.clearTimeout(farmPriorityComboTimerRef.current);
      farmPriorityComboTimerRef.current = null;
    }
    if (farmPriorityFlowTimerRef.current !== null) {
      window.clearTimeout(farmPriorityFlowTimerRef.current);
      farmPriorityFlowTimerRef.current = null;
    }
    if (farmPanelSectionPresetTimerRef.current !== null) {
      window.clearTimeout(farmPanelSectionPresetTimerRef.current);
      farmPanelSectionPresetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (visualStyle !== 'farm-story' || !farmCanvas) {
      farmRewardSnapshotRef.current = null;
      setFarmRewardBursts([]);
      return;
    }

    const discoveredCropIds = Array.from(new Set(farmCanvas.discoveredCropIds || []));
    const beautyRewards = buildFarmBeautyRewards(farmCanvas);
    const snapshot: FarmRewardSnapshot = {
      gold: farmCanvas.resources.gold || 0,
      experience: farmCanvas.resources.experience || 0,
      discoveredCropIds,
      beautyRewardIds: beautyRewards.filter((reward) => reward.unlocked).map((reward) => reward.id),
      completedFestivalTasks: farmCanvas.festivalTasks
        .filter((task) => task.completed)
        .map((task) => ({ id: task.id, rewardLabel: formatFarmReward(task.rewards) })),
      animalProducts: { ...(farmCanvas.inventory.animalProducts || {}) },
      npcVisitsCompleted: farmCanvas.stats.npcVisitsCompleted || 0,
      rareEventsFound: farmCanvas.stats.rareEventsFound || 0,
    };
    const previous = farmRewardSnapshotRef.current;
    farmRewardSnapshotRef.current = snapshot;
    if (!previous) return;

    const goldDelta = snapshot.gold - previous.gold;
    const experienceDelta = snapshot.experience - previous.experience;
    const npcDelta = snapshot.npcVisitsCompleted - previous.npcVisitsCompleted;
    const rareDelta = snapshot.rareEventsFound - previous.rareEventsFound;
    const newlyDiscovered = snapshot.discoveredCropIds.filter((cropId) => !previous.discoveredCropIds.includes(cropId));
    const previousBeautyRewardIds = Array.isArray(previous.beautyRewardIds) ? previous.beautyRewardIds : [];
    const newlyUnlockedBeauty = snapshot.beautyRewardIds.filter((rewardId) => !previousBeautyRewardIds.includes(rewardId));
    const newlyCompletedFestivalTasks = snapshot.completedFestivalTasks.filter((completedTask) =>
      !previous.completedFestivalTasks.some((task) => task.id === completedTask.id));
    const animalProductDelta: Partial<Record<FarmAnimalProductId, number>> = {};
    (Object.keys(FARM_ANIMAL_PRODUCT_DEFINITIONS) as FarmAnimalProductId[]).forEach((productId) => {
      const delta = (snapshot.animalProducts[productId] || 0) - (previous.animalProducts[productId] || 0);
      if (delta > 0) animalProductDelta[productId] = delta;
    });

    if (goldDelta > 0) {
      pushFarmRewardBurst({ kind: 'gold', label: `金币 +${goldDelta}` });
    }
    if (experienceDelta > 0) {
      pushFarmRewardBurst({ kind: 'experience', label: `经验 +${experienceDelta}` });
    }
    if (newlyDiscovered.length > 0) {
      const firstCrop = FARM_CROP_DEFINITIONS[newlyDiscovered[0]];
      pushFarmRewardBurst({
        kind: 'catalog',
        label: newlyDiscovered.length === 1
          ? `图鉴点亮：${firstCrop?.label || newlyDiscovered[0]}`
          : `图鉴 +${newlyDiscovered.length}`,
      });
    }
    const animalProductSummary = formatAnimalProductTotals(animalProductDelta);
    if (animalProductSummary) {
      pushFarmRewardBurst({ kind: 'animal', label: `动物产出：${animalProductSummary}` });
    }
    if (npcDelta > 0) {
      pushFarmRewardBurst({ kind: 'npc', label: `来访委托完成 +${npcDelta}` });
    }
    if (rareDelta > 0) {
      pushFarmRewardBurst({ kind: 'rare', label: `发现惊喜 +${rareDelta}` });
    }
    if (newlyUnlockedBeauty.length > 0) {
      const firstReward = beautyRewards.find((reward) => reward.id === newlyUnlockedBeauty[0]);
      newlyUnlockedBeauty.forEach((rewardId) => {
        trackAchievementEvent({ type: 'farm.beauty_reward', theme: 'farm-story', kind: rewardId });
      });
      pushFarmRewardBurst({
        kind: 'beauty',
        label: newlyUnlockedBeauty.length === 1
          ? `美化奖励：${firstReward?.title || '新奖励'}`
          : `美化奖励 +${newlyUnlockedBeauty.length}`,
      });
    }
    if (newlyCompletedFestivalTasks.length > 0) {
      const firstFestivalTask = newlyCompletedFestivalTasks[0];
      pushFarmRewardBurst({
        kind: 'festival',
        label: newlyCompletedFestivalTasks.length === 1
          ? `节庆谢礼：${firstFestivalTask.rewardLabel}`
          : `节庆谢礼 +${newlyCompletedFestivalTasks.length}`,
      });
    }
  }, [farmCanvas, pushFarmRewardBurst, visualStyle]);

  useEffect(() => {
    if (visualStyle !== 'farm-story' || !farmCanvas) {
      farmTutorialCompletionRef.current = null;
      return;
    }

    const tutorialSteps = buildFarmTutorialSteps(farmCanvas);
    const completedIds = new Set(tutorialSteps.filter((step) => step.done).map((step) => step.id));
    const previous = farmTutorialCompletionRef.current;
    farmTutorialCompletionRef.current = completedIds;
    if (!previous) return;

    tutorialSteps
      .filter((step) => step.done && !previous.has(step.id))
      .slice(0, 2)
      .forEach((step) => {
        pushFarmRewardBurst({ kind: 'quest', label: `任务完成：${step.label}` });
      });
  }, [farmCanvas, pushFarmRewardBurst, visualStyle]);

  useEffect(() => {
    if (visualStyle !== 'farm-story' || !farmCanvas) {
      farmLongGoalCompletionRef.current = null;
      return;
    }

    const longGoals = buildFarmLongTermGoals(farmCanvas);
    const completedIds = new Set(longGoals.filter((goal) => goal.done).map((goal) => goal.id));
    const previous = farmLongGoalCompletionRef.current;
    farmLongGoalCompletionRef.current = completedIds;
    if (!previous) return;

    longGoals
      .filter((goal) => goal.done && !previous.has(goal.id))
      .slice(0, 2)
      .forEach((goal) => {
        pushFarmRewardBurst({ kind: 'quest', label: `长期目标：${goal.title}` });
      });
  }, [farmCanvas, pushFarmRewardBurst, visualStyle]);

  useEffect(() => {
    if (!showDailySummary || !dailySummary) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissedSummaryId(dailySummary.id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dailySummary, showDailySummary]);

  useEffect(() => {
    const selectedType = farmCanvas?.selectedResourceDecor?.objectType;
    if (selectedType) setResourceDecorType(selectedType);
  }, [farmCanvas?.selectedResourceDecor?.objectType]);

  const busy = Boolean(viewportMoving || nodeDragging);
  const selectedTool = farmCanvas?.selectedTool || 'select';
  const selectedToolOption = farmToolOption(selectedTool);
  const SelectedToolIcon = selectedToolOption.icon;
  const matureCount = farmCanvas?.objects.filter((object) => object.crop?.stage === 'mature').length || 0;
  const witheredCount = farmCanvas?.objects.filter((object) => object.crop?.stage === 'withered').length || 0;
  const dryCount = farmCanvas?.objects.filter((object) =>
    object.kind === 'plot' &&
    object.crop &&
    object.crop.dryDays > 0 &&
    object.crop.stage !== 'withered'
  ).length || 0;
  const scarecrowRiskCount = countFarmScarecrowUnprotectedDryCrops(farmCanvas);
  const farmBuildingEffects = getFarmBuildingEffects(farmCanvas);
  const activeFestivalTask = getActiveFarmFestivalTask(farmCanvas);
  const activeNpcVisit = getActiveFarmNpcVisit(farmCanvas);
  const npcVisitReady = activeNpcVisit ? canCompleteFarmNpcVisit(farmCanvas, activeNpcVisit.id) : false;
  const farmNpcDeliveryActive = Boolean(activeNpcVisit && farmNpcDeliveryFeedbackId === activeNpcVisit.id);
  const farmNpcVisitOpened = Boolean(farmNpcVisitPulseId);
  const festivalTaskProgress = activeFestivalTask
    ? Math.round(Math.min(activeFestivalTask.target, Math.max(0, activeFestivalTask.progress)))
    : 0;
  const festivalTaskPercent = activeFestivalTask
    ? Math.round((festivalTaskProgress / Math.max(1, activeFestivalTask.target)) * 100)
    : 0;
  const currentOrder = (farmBuildingEffects.hasOrderBoard
    ? farmCanvas?.orders.find((order) => canCompleteOrder(farmCanvas, order.id))
    : undefined)
    || farmCanvas?.orders.find((order) => !order.completed)
    || farmCanvas?.orders[0];
  const orderReady = currentOrder ? canCompleteOrder(farmCanvas, currentOrder.id) : false;
  const currentOrderRewardLabel = currentOrder ? formatFarmReward(currentOrder.rewards) : '';
  const farmOrderStampActive = Boolean(currentOrder && farmOrderStampFeedbackId === currentOrder.id);
  const farmOrderLocateOpened = Boolean(farmOrderLocatePulseId);
  const farmMatureJumpOpened = Boolean(farmMatureJumpPulseId);
  const farmDryWaterOpened = Boolean(farmDryWaterPulseId);
  const farmSeedToolOpened = Boolean(farmSeedToolPulseId);
  const farmWaterToolOpened = Boolean(farmWaterToolPulseId);
  const farmWoodBuildOpened = Boolean(farmWoodBuildPulseId);
  const farmStoneBuildOpened = Boolean(farmStoneBuildPulseId);
  const farmWitheredShovelOpened = Boolean(farmWitheredShovelPulseId);
  const farmScarecrowRiskSelected = Boolean(farmScarecrowRiskPulseId);
  const farmBeautyDetailOpened = Boolean(farmBeautyDetailPulseId);
  const farmSeasonDetailOpened = Boolean(farmSeasonDetailPulseId);
  const farmToolDetailOpened = Boolean(farmToolDetailPulseId);
  const farmSummaryOpened = Boolean(farmSummaryPulseId);
  const farmActivityDetailOpened = Boolean(farmActivityDetailPulseId);
  const farmActivitySectionOpened = farmActivityFocusTarget === 'section';
  const farmActivityRewardDigestOpened = farmActivityFocusTarget === 'reward-digest';
  const farmActivityStreakOpened = farmActivityFocusTarget === 'streak';
  const farmActivityMilestoneOpened = farmActivityFocusTarget === 'milestone';
  const farmActivityLocatedLabel = farmActivityFocusTarget === 'streak-meter'
    ? '已定位进度'
    : farmActivityFocusTarget === 'completion'
      ? '已定位完成'
    : farmActivityFocusTarget === 'action'
      ? '已定位建议'
      : farmActivityFocusTarget === 'chest'
        ? '已定位宝箱'
        : farmActivityFocusTarget === 'reward-digest'
          ? '已定位奖励'
          : farmActivityFocusTarget === 'streak'
            ? '已定位连击'
            : farmActivityFocusTarget === 'milestone'
              ? '已定位里程碑'
              : '已定位成果';
  const festivalTaskReadyViaOrder = Boolean(
    activeFestivalTask &&
    !activeFestivalTask.completed &&
    activeFestivalTask.kind === 'complete-orders' &&
    orderReady &&
    currentOrder
  );
  const festivalTaskNextProgress = activeFestivalTask
    ? Math.min(
        festivalTaskProgress + (festivalTaskReadyViaOrder ? 1 : 0),
        activeFestivalTask.target
      )
    : 0;
  const festivalTaskNextPercent = activeFestivalTask
    ? Math.round((festivalTaskNextProgress / Math.max(1, activeFestivalTask.target)) * 100)
    : 0;
  const festivalTaskRewardLabel = activeFestivalTask ? formatFarmReward(activeFestivalTask.rewards) : '';
  const festivalTaskCompletesViaOrder = Boolean(
    activeFestivalTask &&
    festivalTaskReadyViaOrder &&
    festivalTaskNextProgress >= activeFestivalTask.target
  );
  const festivalTaskCompletionLabel = festivalTaskCompletesViaOrder ? '交单后完成' : '';
  const festivalTaskForecastTone = festivalTaskCompletesViaOrder ? 'complete' : festivalTaskReadyViaOrder ? 'progress' : '';
  const festivalTaskForecastLabel = festivalTaskReadyViaOrder && activeFestivalTask
    ? `${festivalTaskCompletesViaOrder ? '交付订单完成节庆' : '交付订单推进节庆'} ${festivalTaskNextProgress}/${activeFestivalTask.target}`
    : '';
  const currentOrderFestivalCompletes = Boolean(
    activeFestivalTask &&
    festivalTaskReadyViaOrder &&
    festivalTaskNextProgress >= activeFestivalTask.target
  );
  const currentOrderFestivalLinkLabel = festivalTaskReadyViaOrder && activeFestivalTask
    ? currentOrderFestivalCompletes ? `完成节庆 ${festivalTaskNextProgress}/${activeFestivalTask.target}` : `推进节庆 ${festivalTaskNextProgress}/${activeFestivalTask.target}`
    : '';
  const currentOrderFestivalRewardLabel = currentOrderFestivalCompletes ? festivalTaskRewardLabel : '';
  const farmOrderStampFeedbackLabel = farmOrderStampActive ? currentOrderFestivalRewardLabel ? '节庆奖入袋' : '盖章中' : '';
  const farmOrderSubmitLabel = farmOrderStampActive ? farmOrderStampFeedbackLabel : currentOrderFestivalRewardLabel ? '交单领节庆奖' : currentOrderFestivalCompletes ? '交单完成节庆' : '完成订单';
  const farmOrderSubmitTitle = farmOrderStampActive
    ? currentOrderFestivalRewardLabel ? `节庆奖励领取中：${currentOrderFestivalRewardLabel}` : `订单盖章中：${currentOrderRewardLabel}`
    : orderReady
      ? currentOrderFestivalRewardLabel ? `交单后领取节庆奖励：${currentOrderRewardLabel} · 节庆额外奖励：${currentOrderFestivalRewardLabel}` : currentOrderFestivalCompletes ? `交单后完成节庆：${currentOrderRewardLabel}` : `订单完成盖章：${currentOrderRewardLabel}`
      : '订单材料不足';
  const farmOrderRewardTitle = `订单奖励：${currentOrderRewardLabel}${currentOrderFestivalLinkLabel ? ` · ${currentOrderFestivalLinkLabel}` : ''}${currentOrderFestivalRewardLabel ? ` · 节庆额外奖励：${currentOrderFestivalRewardLabel}` : ''}${farmOrderStampFeedbackLabel ? ` · 回执：${farmOrderStampFeedbackLabel}` : ''}`;
  const readyOrderCount = farmCanvas
    ? farmCanvas.orders.filter((order) => canCompleteOrder(farmCanvas, order.id)).length
    : 0;
  const readyNpcVisitCount = farmCanvas
    ? farmCanvas.npcVisits.filter((visit) => !visit.completed && canCompleteFarmNpcVisit(farmCanvas, visit.id)).length
    : 0;
  const farmActivityFeed = buildFarmActivityFeed(farmCanvas, { maxItems: 3 });
  const farmActivityDigest = buildFarmActivityDigest(farmCanvas);
  const farmMiniActivityStreakTitle = farmActivityDigest.rewardStreakLabel
    ? `今日连击：${farmActivityDigest.rewardStreakLabel}${farmActivityDigest.rewardStreakMilestoneLabel ? ` · ${farmActivityDigest.rewardStreakMilestoneLabel}` : ''}${farmActivityDigest.rewardStreakMilestoneCompletionLabel ? ` · ${farmActivityDigest.rewardStreakMilestoneCompletionLabel}` : ''}${farmActivityDigest.rewardStreakMilestoneRewardLabel ? ` · ${farmActivityDigest.rewardStreakMilestoneRewardLabel}` : ''}`
    : '今日连击：暂无';
  const farmMiniActivityRewardStampLabel = farmActivityDigest.rewardStreakMilestoneRewardItems?.length
    ? `奖励x${farmActivityDigest.rewardStreakMilestoneRewardItems.length}`
    : '';
  const farmMiniActivityStreakActionLabel = farmActivityDigest.rewardStreakActionShortLabel || farmActivityDigest.rewardStreakActionLabel || '';
  const farmMiniActivityStreakChestLabel = farmActivityDigest.rewardStreakChestShortLabel || farmActivityDigest.rewardStreakChestLabel || '';
  const farmActivityRewardStreakGoal: FarmFocusGoal | undefined = farmActivityDigest.rewardStreakAction ? {
    id: 'activity-reward-streak-action',
    kind: farmActivityDigest.rewardStreakActionKind === 'npc'
      ? 'social'
      : farmActivityDigest.rewardStreakActionKind === 'decorate' || farmActivityDigest.rewardStreakActionKind === 'festival'
        ? 'decorate'
        : 'reward',
    title: farmActivityDigest.rewardStreakActionShortLabel || '连击建议',
    detail: farmActivityDigest.rewardStreakActionLabel || '执行连击建议，续上今天的正反馈。',
    progress: farmActivityDigest.rewardStreak,
    target: farmActivityDigest.rewardStreakMilestoneTarget || Math.max(1, farmActivityDigest.rewardStreak + 1),
    percent: farmActivityDigest.rewardStreakMilestonePercent ?? 0,
    actionLabel: farmActivityDigest.rewardStreakActionShortLabel || '执行建议',
    action: farmActivityDigest.rewardStreakAction,
    ready: true,
  } : undefined;
  const farmActivityRewardStreakActionResourceTargets = farmActivityRewardStreakGoal?.action ? farmActionResourceTargets(farmActivityRewardStreakGoal.action) : [];
  const farmActivityRewardStreakActionResourcePreview = farmActionResourcePreviewLabel(farmActivityRewardStreakActionResourceTargets);
  const farmActivityChestClaimNextReceiptNextLabel = farmActivityDigest.rewardStreakChestNextRewardLabel || farmActivityDigest.rewardStreakChestNextLabel || farmActivityDigest.rewardStreakChestActiveHint || '';
  const farmActivityChestClaimNextReceiptNextShortLabel = farmActivityChestClaimNextReceiptNextLabel
    .replace('下一段：', '下段 ')
    .replace('下一轮：', '下轮 ')
    .replace('当前冲刺：', '冲 ');
  const farmActivityChestClaimNextReceiptProgressTarget = farmActivityDigest.rewardStreakMilestoneTarget || farmActivityRewardStreakGoal?.target || 0;
  const farmActivityChestClaimNextReceiptProgressValue = farmActivityChestClaimNextReceiptProgressTarget
    ? Math.min(farmActivityDigest.rewardStreak + 1, farmActivityChestClaimNextReceiptProgressTarget)
    : 0;
  const farmActivityChestClaimNextReceiptProgressLabel = farmActivityRewardStreakGoal ? '连击 +1' : '';
  const farmActivityChestClaimNextReceiptProgressTitle = farmActivityChestClaimNextReceiptProgressTarget
    ? `预计连击进度：${farmActivityChestClaimNextReceiptProgressValue}/${farmActivityChestClaimNextReceiptProgressTarget}`
    : '';
  const farmActivityChestClaimNextReceiptProgressState = farmActivityChestClaimNextReceiptProgressTarget && farmActivityChestClaimNextReceiptProgressValue >= farmActivityChestClaimNextReceiptProgressTarget ? 'complete' : 'next';
  const farmActivityChestClaimNextReceiptMilestoneTitle = farmActivityChestClaimNextReceiptProgressState === 'complete' ? '本次续连击将点亮里程碑' : '';
  const farmActivityChestClaimNextReceiptMilestoneLabel = farmActivityChestClaimNextReceiptMilestoneTitle ? '本次点亮' : '';
  const farmActivityChestClaimNextReceiptRewardItems = farmActivityChestClaimNextReceiptMilestoneTitle && farmActivityChestClaimNextReceiptProgressTarget >= 5
    ? ['高光手账', '订单气氛', '美化收益']
    : [];
  const farmActivityChestClaimNextReceiptRewardLabel = farmActivityChestClaimNextReceiptMilestoneTitle
    ? farmActivityChestClaimNextReceiptRewardItems.length
      ? `奖励x${farmActivityChestClaimNextReceiptRewardItems.length}`
      : farmActivityDigest.rewardStreakChestActiveRewardLabel?.replace('当前奖励：', '奖励 ') || farmActivityDigest.rewardStreakChestRewardLabel?.replace('预览：', '奖励 ') || ''
    : '';
  const farmActivityChestClaimNextReceiptRewardTitle = farmActivityChestClaimNextReceiptRewardLabel
    ? `本次点亮奖励：${farmActivityChestClaimNextReceiptRewardItems.length ? farmActivityChestClaimNextReceiptRewardItems.join('、') : farmActivityChestClaimNextReceiptRewardLabel.replace('奖励 ', '')}`
    : '';
  const farmActivityChestClaimNextReceiptRewardShortItems = farmActivityChestClaimNextReceiptRewardItems.map((item) =>
    item.replace('手账', '').replace('气氛', '').replace('收益', '')
  );
  const farmActivityChestClaimNextReceiptRewardPocketLabel = farmActivityChestClaimNextReceiptRewardShortItems.length ? '已入袋' : '';
  const farmActivityChestClaimNextReceiptRewardPocketTitle = farmActivityChestClaimNextReceiptRewardPocketLabel
    ? `本次点亮奖励已入袋：${farmActivityChestClaimNextReceiptRewardItems.join('、')}`
    : '';
  const farmActivityChestClaimNextReceiptRewardPocketTargets = farmActivityChestClaimNextReceiptRewardItems.reduce<Array<FarmMiniRewardPocketTarget>>((targets, item) => {
    let target: FarmMiniRewardPocketTarget | '' = '';
    if (item.includes('美化')) {
      target = 'beauty';
    } else if (item.includes('订单')) {
      target = 'ready-order';
    } else if (item.includes('手账')) {
      target = 'activity-streak-reward';
    }
    if (target && !targets.includes(target)) {
      targets.push(target);
    }
    return targets;
  }, []);
  const farmActivityChestClaimNextReceiptRewardPocketTargetsLabel = farmActivityChestClaimNextReceiptRewardPocketTargets.length
    ? `入袋点亮：${farmActivityChestClaimNextReceiptRewardPocketTargets.map((target) =>
      target === 'beauty' ? '漂亮度' : target === 'ready-order' ? '订单' : '奖励印章'
    ).join('、')}`
    : '';
  const farmActivityChestClaimNextReceiptRewardPocketTargetsShortLabel = farmActivityChestClaimNextReceiptRewardPocketTargets.length
    ? `点亮${farmActivityChestClaimNextReceiptRewardPocketTargets.length}处`
    : '';
  const farmRewardDetailOpened = Boolean(farmRewardDetailPulseId);
  const farmActivityChestClaimNextReceiptRewardPocketAnyTargetOpened = Boolean(
    farmActivityChestClaimNextReceipt && (
      (farmActivityChestClaimNextReceiptRewardPocketTargets.includes('beauty') && farmBeautyDetailOpened) ||
      (farmActivityChestClaimNextReceiptRewardPocketTargets.includes('ready-order') && farmOrderLocateOpened) ||
      (farmActivityChestClaimNextReceiptRewardPocketTargets.includes('activity-streak-reward') && farmRewardDetailOpened)
    )
  );
  const farmActivityChestClaimNextReceiptRewardPocketFollowupLabel = farmActivityChestClaimNextReceiptRewardPocketAnyTargetOpened
    ? farmActivityRewardStreakGoal?.actionLabel
      ? `继续${farmActivityRewardStreakGoal.actionLabel}`
      : farmActivityChestClaimNextReceiptNextShortLabel
        ? `回到${farmActivityChestClaimNextReceiptNextShortLabel}`
        : ''
    : '';
  const farmActivityRewardStreakActionReceiptFollowupLabel = farmActivityRewardStreakActionReceiptFollowup
    ? farmActivityRewardStreakActionReceiptFollowup.startsWith('继续')
      ? `已接上${farmActivityRewardStreakActionReceiptFollowup.replace(/^继续/, '')}`
      : `已接上${farmActivityRewardStreakActionReceiptFollowup}`
    : '';
  const farmActivityRewardStreakActionReceiptEchoLabel = farmActivityRewardStreakActionReceiptFollowup
    ? farmActivityRewardStreakActionReceiptFollowup.startsWith('继续')
      ? `刚刚接上${farmActivityRewardStreakActionReceiptFollowup.replace(/^继续/, '')}`
      : farmActivityRewardStreakActionReceiptFollowup.startsWith('回到')
        ? `刚刚接上${farmActivityRewardStreakActionReceiptFollowup.replace(/^回到/, '')}`
        : `刚刚接上${farmActivityRewardStreakActionReceiptFollowup}`
    : '';
  const farmActivityRewardStreakActionReceiptNextHint = farmActivityRewardStreakGoal?.action ? farmFocusActionNextHint(farmActivityRewardStreakGoal.action) : '';
  const farmActivityRewardStreakActionReceiptNextTarget = farmActivityRewardStreakGoal?.action ? farmFocusActionNextTarget(farmActivityRewardStreakGoal.action) : undefined;
  const farmActivityRewardStreakActionReceiptRouteTarget = farmActivityRewardStreakGoal?.action ? farmRouteTargetForFocusAction(farmActivityRewardStreakGoal.action) : undefined;
  const farmActivityRewardStreakActionReceiptRouteLabel = farmRouteLabelForTarget(farmActivityRewardStreakActionReceiptRouteTarget);
  const farmActivityRewardStreakActionRouteTarget = farmActivityRewardStreakActionReceiptRouteTarget;
  const farmActivityRewardStreakActionRouteLabel = farmActivityRewardStreakActionReceiptRouteLabel;
  const farmActivityRewardStreakActionReceiptNextBadgeLabel = farmActivityRewardStreakGoal?.action ? farmFocusActionNextBadgeLabel(farmActivityRewardStreakGoal.action) : '';
  const farmActivityRewardStreakActionReceiptNextCountLabel = farmActivityRewardStreakGoal?.action
    ? farmFocusActionNextCountLabel(farmActivityRewardStreakGoal.action, {
        dryCount,
        witheredCount,
        matureCount,
        scarecrowRiskCount,
        readyOrderCount,
        readyNpcVisitCount,
      })
    : '';
  const farmActivityRewardStreakActionReceiptNextTitle = farmActivityRewardStreakActionReceiptNextHint
    ? `${farmActivityRewardStreakActionReceiptEchoLabel} · ${farmActivityRewardStreakActionReceiptNextHint}${farmActivityRewardStreakActionReceiptNextCountLabel ? ` · 目标 ${farmActivityRewardStreakActionReceiptNextCountLabel}` : ''}${farmActivityRewardStreakActionResourcePreview ? ` · ${farmActivityRewardStreakActionResourcePreview}` : ''} · 点击查看连击建议`
    : '';
  const farmActivityRewardStreakActionReceiptCanvasHint = farmActivityRewardStreakActionReceiptEchoLabel && farmActivityRewardStreakActionReceiptNextHint
    ? `${farmActivityRewardStreakActionReceiptEchoLabel} · ${farmActivityRewardStreakActionReceiptNextHint.replace('下一步：', '')}${farmActivityRewardStreakActionReceiptNextCountLabel ? ` · ${farmActivityRewardStreakActionReceiptNextCountLabel}` : ''}`
    : '';
  const farmActivityRewardStreakActionReceiptCanvasTone = farmFocusActionCanvasTone(farmActivityRewardStreakActionReceiptNextTarget);
  useEffect(() => {
    if (!farmActivityRewardStreakActionReceiptCanvasHint || !onFollowupCanvasHint) {
      farmFollowupCanvasHintKeyRef.current = '';
      return;
    }
    const canvasHintKey = `${farmActivityRewardStreakActionReceiptCanvasHint}|${farmActivityRewardStreakActionResourcePreview}`;
    if (farmFollowupCanvasHintKeyRef.current === canvasHintKey) return;
    farmFollowupCanvasHintKeyRef.current = canvasHintKey;
    onFollowupCanvasHint({
      message: farmActivityRewardStreakActionReceiptCanvasHint,
      tone: farmActivityRewardStreakActionReceiptCanvasTone,
      routeTarget: farmActivityRewardStreakActionReceiptRouteTarget,
      routeLabel: farmActivityRewardStreakActionReceiptRouteLabel,
      routeTitle: farmActivityRewardStreakActionReceiptNextTitle,
    });
  }, [
    farmActivityRewardStreakActionReceiptCanvasHint,
    farmActivityRewardStreakActionReceiptCanvasTone,
    farmActivityRewardStreakActionReceiptNextTitle,
    farmActivityRewardStreakActionReceiptRouteLabel,
    farmActivityRewardStreakActionReceiptRouteTarget,
    farmActivityRewardStreakActionResourcePreview,
    onFollowupCanvasHint,
  ]);
  const farmActivityChestClaimed = Boolean(farmActivityChestClaimPulseId);
  const farmBuildingEffectOpened = Boolean(farmBuildingEffectPulseId);
  const farmAnimalProductOpened = Boolean(farmAnimalProductPulseId);
  const handleFarmMiniMatureJump = () => {
    if (matureCount === 0) return;
    if (typeof window !== 'undefined') {
      if (farmMatureJumpTimerRef.current !== null) {
        window.clearTimeout(farmMatureJumpTimerRef.current);
      }
      setFarmMatureJumpPulseId(`mature-jump-${Date.now()}`);
      farmMatureJumpTimerRef.current = window.setTimeout(() => {
        setFarmMatureJumpPulseId('');
        farmMatureJumpTimerRef.current = null;
      }, 1200);
    }
    onJumpToMature?.();
  };
  const handleFarmMiniDryWaterAction = () => {
    if (dryCount === 0) return;
    if (typeof window !== 'undefined') {
      if (farmDryWaterTimerRef.current !== null) {
        window.clearTimeout(farmDryWaterTimerRef.current);
      }
      setFarmDryWaterPulseId(`dry-water-${Date.now()}`);
      farmDryWaterTimerRef.current = window.setTimeout(() => {
        setFarmDryWaterPulseId('');
        farmDryWaterTimerRef.current = null;
      }, 1200);
    }
    onSelectTool?.('water');
    onFollowupCanvasHint?.({
      message: `地图找缺水：${dryCount}块，已切到水壶`,
      tone: 'water',
      routeTarget: 'water',
      routeLabel: '缺水',
      routeTitle: `自动定位最近缺水作物 ${dryCount}块`,
    });
  };
  const handleFarmMiniSeedToolAction = () => {
    if (totalSeedCount === 0) return;
    if (typeof window !== 'undefined') {
      if (farmSeedToolTimerRef.current !== null) {
        window.clearTimeout(farmSeedToolTimerRef.current);
      }
      setFarmSeedToolPulseId(`seed-tool-${Date.now()}`);
      farmSeedToolTimerRef.current = window.setTimeout(() => {
        setFarmSeedToolPulseId('');
        farmSeedToolTimerRef.current = null;
      }, 1200);
    }
    onSelectTool?.('seed');
  };
  const handleFarmMiniWaterToolAction = () => {
    if (waterAmount === 0) return;
    if (typeof window !== 'undefined') {
      if (farmWaterToolTimerRef.current !== null) {
        window.clearTimeout(farmWaterToolTimerRef.current);
      }
      setFarmWaterToolPulseId(`water-tool-${Date.now()}`);
      farmWaterToolTimerRef.current = window.setTimeout(() => {
        setFarmWaterToolPulseId('');
        farmWaterToolTimerRef.current = null;
      }, 1200);
    }
    onSelectTool?.('water');
  };
  const handleFarmQuickToolAction = (tool: FarmTool, quickRoute?: FarmQuickToolRouteHint, quickAssist?: FarmQuickToolAssistHint) => {
    onSelectTool?.(tool);
    const quickHint = quickRoute || quickAssist;
    if (!quickHint) return;
    if (typeof window !== 'undefined') {
      if (quickRoute) {
        if (farmQuickToolRouteTimerRef.current !== null) {
          window.clearTimeout(farmQuickToolRouteTimerRef.current);
        }
        setFarmQuickToolAssistReceipt('');
        setFarmQuickToolRouteReceipt(tool);
        farmQuickToolRouteTimerRef.current = window.setTimeout(() => {
          setFarmQuickToolRouteReceipt('');
          farmQuickToolRouteTimerRef.current = null;
        }, 1300);
      } else {
        if (farmQuickToolAssistTimerRef.current !== null) {
          window.clearTimeout(farmQuickToolAssistTimerRef.current);
        }
        setFarmQuickToolRouteReceipt('');
        setFarmQuickToolAssistReceipt(tool);
        farmQuickToolAssistTimerRef.current = window.setTimeout(() => {
          setFarmQuickToolAssistReceipt('');
          farmQuickToolAssistTimerRef.current = null;
        }, 1300);
      }
    }
    onFollowupCanvasHint?.({
      message: quickHint.message,
      tone: quickHint.tone,
      routeTarget: quickHint.routeTarget,
      routeLabel: quickHint.routeLabel,
      routeTitle: quickHint.routeTitle,
    });
  };
  const handleFarmMiniBuildToolAction = (resourceKind: 'wood' | 'stone') => {
    if (typeof window !== 'undefined') {
      const timerRef = resourceKind === 'wood' ? farmWoodBuildTimerRef : farmStoneBuildTimerRef;
      const setPulseId = resourceKind === 'wood' ? setFarmWoodBuildPulseId : setFarmStoneBuildPulseId;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      setPulseId(`${resourceKind}-build-${Date.now()}`);
      timerRef.current = window.setTimeout(() => {
        setPulseId('');
        timerRef.current = null;
      }, 1200);
    }
    onSelectBuilding?.(selectedBuildingDefinition.id);
  };
  const handleFarmMiniWitheredShovelAction = () => {
    if (witheredCount === 0) return;
    if (typeof window !== 'undefined') {
      if (farmWitheredShovelTimerRef.current !== null) {
        window.clearTimeout(farmWitheredShovelTimerRef.current);
      }
      setFarmWitheredShovelPulseId(`withered-shovel-${Date.now()}`);
      farmWitheredShovelTimerRef.current = window.setTimeout(() => {
        setFarmWitheredShovelPulseId('');
        farmWitheredShovelTimerRef.current = null;
      }, 1200);
    }
    onSelectTool?.('shovel');
    onFollowupCanvasHint?.({
      message: `地图找枯萎：${witheredCount}块，已切到铲子`,
      tone: 'warning',
      routeTarget: 'withered-crop',
      routeLabel: '枯萎',
      routeTitle: `自动定位最近枯萎作物 ${witheredCount}块`,
    });
  };
  const handleOpenFarmOrder = () => {
    setOpen(true);
    setFarmPanelSectionOpen('visits');
    if (typeof window === 'undefined') return;
    if (farmOrderLocatePulseTimerRef.current !== null) {
      window.clearTimeout(farmOrderLocatePulseTimerRef.current);
    }
    setFarmOrderLocatePulseId(`order-locate-${Date.now()}`);
    farmOrderLocatePulseTimerRef.current = window.setTimeout(() => {
      setFarmOrderLocatePulseId('');
      farmOrderLocatePulseTimerRef.current = null;
    }, 1400);
    if (farmOrderLocateScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmOrderLocateScrollFrameRef.current);
    }
    farmOrderLocateScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmOrderElement = farmOrderRef.current;
      const prefersReducedOrderMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const orderScrollBehavior: ScrollBehavior = prefersReducedOrderMotion ? 'auto' : 'smooth';
      farmOrderElement?.scrollIntoView({ block: 'nearest', behavior: orderScrollBehavior });
      farmOrderElement?.focus({ preventScroll: true });
      farmOrderLocateScrollFrameRef.current = null;
    });
  };
  const handleOpenFarmRewardDetail = () => {
    setOpen(true);
    setFarmPanelSectionOpen('activity');
    if (typeof window === 'undefined') return;
    if (farmRewardDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmRewardDetailPulseTimerRef.current);
    }
    setFarmRewardDetailPulseId(`reward-detail-${Date.now()}`);
    farmRewardDetailPulseTimerRef.current = window.setTimeout(() => {
      setFarmRewardDetailPulseId('');
      farmRewardDetailPulseTimerRef.current = null;
    }, 1400);
    if (farmRewardDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmRewardDetailScrollFrameRef.current);
    }
    farmRewardDetailScrollFrameRef.current = window.requestAnimationFrame(() => {
      const rewardItemsElement = farmRewardItemsRef.current;
      const prefersReducedRewardMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const rewardScrollBehavior: ScrollBehavior = prefersReducedRewardMotion ? 'auto' : 'smooth';
      rewardItemsElement?.scrollIntoView({ block: 'nearest', behavior: rewardScrollBehavior });
      rewardItemsElement?.focus({ preventScroll: true });
      farmRewardDetailScrollFrameRef.current = null;
    });
  };
  const handleOpenFarmBeautyDetail = () => {
    setOpen(true);
    setFarmPanelSectionOpen('beauty');
    if (typeof window === 'undefined') return;
    if (farmBeautyDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmBeautyDetailPulseTimerRef.current);
    }
    setFarmBeautyDetailPulseId(`beauty-detail-${Date.now()}`);
    farmBeautyDetailPulseTimerRef.current = window.setTimeout(() => {
      setFarmBeautyDetailPulseId('');
      farmBeautyDetailPulseTimerRef.current = null;
    }, 1400);
    if (farmBeautyDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmBeautyDetailScrollFrameRef.current);
    }
    farmBeautyDetailScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmBeautyElement = farmBeautyRef.current;
      const prefersReducedBeautyMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const beautyScrollBehavior: ScrollBehavior = prefersReducedBeautyMotion ? 'auto' : 'smooth';
      farmBeautyElement?.scrollIntoView({ block: 'nearest', behavior: beautyScrollBehavior });
      farmBeautyElement?.focus({ preventScroll: true });
      farmBeautyDetailScrollFrameRef.current = null;
    });
  };
  const flashFarmBeautyRewardRouteHint = (label: string) => {
    if (typeof window === 'undefined') return;
    if (farmBeautyRewardRouteTimerRef.current !== null) {
      window.clearTimeout(farmBeautyRewardRouteTimerRef.current);
    }
    setFarmBeautyRewardRouteReceipt(label);
    farmBeautyRewardRouteTimerRef.current = window.setTimeout(() => {
      setFarmBeautyRewardRouteReceipt('');
      farmBeautyRewardRouteTimerRef.current = null;
    }, 1200);
  };
  const handleFarmBeautyRewardRouteHintAction = () => {
    flashFarmBeautyRewardRouteHint('已指路');
    onFollowupCanvasHint?.({
      message: `美化奖励路线：${farmBeautyRewardRouteRewardLabel} · ${farmBeautyRewardRouteCountLabel}`,
      tone: farmFocusActionCanvasTone('decor'),
      routeTarget: farmBeautyRewardRouteTarget,
      routeLabel: farmBeautyRewardRouteLabel,
      routeTitle: farmBeautyRewardRouteTitle,
    });
  };
  const handleOpenFarmSeasonDetail = () => {
    setOpen(true);
    setFarmPanelSectionOpen('season');
    if (typeof window === 'undefined') return;
    if (farmSeasonDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmSeasonDetailPulseTimerRef.current);
    }
    setFarmSeasonDetailPulseId(`season-detail-${Date.now()}`);
    farmSeasonDetailPulseTimerRef.current = window.setTimeout(() => {
      setFarmSeasonDetailPulseId('');
      farmSeasonDetailPulseTimerRef.current = null;
    }, 1400);
    if (farmSeasonDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmSeasonDetailScrollFrameRef.current);
    }
    farmSeasonDetailScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmSeasonElement = farmSeasonRef.current;
      const prefersReducedSeasonMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const seasonScrollBehavior: ScrollBehavior = prefersReducedSeasonMotion ? 'auto' : 'smooth';
      farmSeasonElement?.scrollIntoView({ block: 'nearest', behavior: seasonScrollBehavior });
      farmSeasonElement?.focus({ preventScroll: true });
      farmSeasonDetailScrollFrameRef.current = null;
    });
  };
  const handleOpenFarmTools = () => {
    setOpen(true);
    setFarmPanelSectionOpen('tools');
    if (typeof window === 'undefined') return;
    if (farmToolDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmToolDetailPulseTimerRef.current);
    }
    setFarmToolDetailPulseId(`tool-detail-${Date.now()}`);
    farmToolDetailPulseTimerRef.current = window.setTimeout(() => {
      setFarmToolDetailPulseId('');
      farmToolDetailPulseTimerRef.current = null;
    }, 1400);
    if (farmToolDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmToolDetailScrollFrameRef.current);
    }
    farmToolDetailScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmToolsElement = farmToolsRef.current;
      const prefersReducedToolMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const toolScrollBehavior: ScrollBehavior = prefersReducedToolMotion ? 'auto' : 'smooth';
      farmToolsElement?.scrollIntoView({ block: 'nearest', behavior: toolScrollBehavior });
      farmToolsElement?.focus({ preventScroll: true });
      farmToolDetailScrollFrameRef.current = null;
    });
  };
  const handleOpenFarmSummary = () => {
    setOpen(true);
    setFarmPanelSectionOpen('summary');
    setDismissedSummaryId('');
    if (typeof window === 'undefined') return;
    if (farmSummaryPulseTimerRef.current !== null) {
      window.clearTimeout(farmSummaryPulseTimerRef.current);
    }
    setFarmSummaryPulseId(`summary-detail-${Date.now()}`);
    farmSummaryPulseTimerRef.current = window.setTimeout(() => {
      setFarmSummaryPulseId('');
      farmSummaryPulseTimerRef.current = null;
    }, 1400);
    if (farmSummaryScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmSummaryScrollFrameRef.current);
    }
    farmSummaryScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmSummaryElement = farmSummaryRef.current;
      const prefersReducedSummaryMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const summaryScrollBehavior: ScrollBehavior = prefersReducedSummaryMotion ? 'auto' : 'smooth';
      farmSummaryElement?.scrollIntoView({ block: 'nearest', behavior: summaryScrollBehavior });
      farmSummaryElement?.focus({ preventScroll: true });
      farmSummaryScrollFrameRef.current = null;
    });
  };
  const handleOpenFarmActivity = (focusTarget: FarmActivityFocusTarget = 'section') => {
    setOpen(true);
    setFarmPanelSectionOpen('activity');
    setFarmActivityFocusTarget(focusTarget);
    if (typeof window === 'undefined') return;
    if (farmActivityDetailPulseTimerRef.current !== null) {
      window.clearTimeout(farmActivityDetailPulseTimerRef.current);
    }
    setFarmActivityDetailPulseId(`activity-detail-${Date.now()}`);
    farmActivityDetailPulseTimerRef.current = window.setTimeout(() => {
      setFarmActivityDetailPulseId('');
      setFarmActivityFocusTarget('');
      farmActivityDetailPulseTimerRef.current = null;
    }, 1400);
    if (farmActivityDetailScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmActivityDetailScrollFrameRef.current);
    }
    farmActivityDetailScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmActivityElement = focusTarget === 'reward-digest'
        ? farmActivityRewardDigestRef.current || farmActivityRef.current
        : focusTarget === 'streak'
          ? farmActivityStreakRef.current || farmActivityRef.current
          : focusTarget === 'milestone'
            ? farmActivityMilestoneRef.current || farmActivityRef.current
            : focusTarget === 'streak-meter'
              ? farmActivityStreakMeterRef.current || farmActivityRef.current
              : focusTarget === 'completion'
                ? farmActivityCompletionRef.current || farmActivityRef.current
                : focusTarget === 'action'
                  ? farmActivityActionRef.current || farmActivityRef.current
                  : focusTarget === 'chest'
                    ? farmActivityChestRef.current || farmActivityRef.current
                : farmActivityRef.current;
      const prefersReducedActivityMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const activityScrollBehavior: ScrollBehavior = prefersReducedActivityMotion ? 'auto' : 'smooth';
      farmActivityElement?.scrollIntoView({ block: 'nearest', behavior: activityScrollBehavior });
      farmActivityElement?.focus({ preventScroll: true });
      farmActivityDetailScrollFrameRef.current = null;
    });
  };
  const handleOpenFarmBuildingEffects = () => {
    setOpen(true);
    setFarmPanelSectionOpen('building');
    if (typeof window === 'undefined') return;
    if (farmBuildingEffectPulseTimerRef.current !== null) {
      window.clearTimeout(farmBuildingEffectPulseTimerRef.current);
    }
    setFarmBuildingEffectPulseId(`building-effect-${Date.now()}`);
    farmBuildingEffectPulseTimerRef.current = window.setTimeout(() => {
      setFarmBuildingEffectPulseId('');
      farmBuildingEffectPulseTimerRef.current = null;
    }, 1400);
    if (farmBuildingEffectScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmBuildingEffectScrollFrameRef.current);
    }
    farmBuildingEffectScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmBuildingEffectsElement = farmBuildingEffectsRef.current;
      const prefersReducedBuildingEffectMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const buildingEffectScrollBehavior: ScrollBehavior = prefersReducedBuildingEffectMotion ? 'auto' : 'smooth';
      farmBuildingEffectsElement?.scrollIntoView({ block: 'nearest', behavior: buildingEffectScrollBehavior });
      farmBuildingEffectsElement?.focus({ preventScroll: true });
      farmBuildingEffectScrollFrameRef.current = null;
    });
  };
  const handleFarmPlacementHudReceiptAction = () => {
    if (farmPlacementHudReceiptCanvasHint) {
      onFollowupCanvasHint?.({
        message: `已定位：${farmPlacementHudReceiptCanvasHint}`,
        tone: farmPlacementHudReceiptCanvasTone,
      });
    }
    if (farmPlacementHudReceiptKind === 'building') {
      handleOpenFarmBuildingEffects();
      return;
    }
    if (farmPlacementHudReceiptKind === 'decor') {
      handleOpenFarmBeautyDetail();
    }
  };
  const flashFarmPlacementFollowupAction = (label: string) => {
    if (farmPlacementFollowupActionTimerRef.current !== null) {
      window.clearTimeout(farmPlacementFollowupActionTimerRef.current);
    }
    setFarmPlacementFollowupActionReceipt(label);
    farmPlacementFollowupActionTimerRef.current = window.setTimeout(() => {
      setFarmPlacementFollowupActionReceipt('');
      farmPlacementFollowupActionTimerRef.current = null;
    }, 1400);
  };
  const flashFarmPlacementRouteHint = (label: string) => {
    if (farmPlacementRouteHintTimerRef.current !== null) {
      window.clearTimeout(farmPlacementRouteHintTimerRef.current);
    }
    setFarmPlacementRouteHintReceipt(label);
    farmPlacementRouteHintTimerRef.current = window.setTimeout(() => {
      setFarmPlacementRouteHintReceipt('');
      farmPlacementRouteHintTimerRef.current = null;
    }, 1400);
  };
  const flashFarmBuildingEffectQuestRouteHint = (label: string) => {
    if (farmBuildingEffectQuestRouteTimerRef.current !== null) {
      window.clearTimeout(farmBuildingEffectQuestRouteTimerRef.current);
    }
    setFarmBuildingEffectQuestRouteReceipt(label);
    farmBuildingEffectQuestRouteTimerRef.current = window.setTimeout(() => {
      setFarmBuildingEffectQuestRouteReceipt('');
      farmBuildingEffectQuestRouteTimerRef.current = null;
    }, 1400);
  };
  const flashFarmActivityRewardStreakRouteHint = (label: string) => {
    if (farmActivityRewardStreakActionReceiptRouteTimerRef.current !== null) {
      window.clearTimeout(farmActivityRewardStreakActionReceiptRouteTimerRef.current);
    }
    setFarmActivityRewardStreakActionReceiptRouteReceipt(label);
    farmActivityRewardStreakActionReceiptRouteTimerRef.current = window.setTimeout(() => {
      setFarmActivityRewardStreakActionReceiptRouteReceipt('');
      farmActivityRewardStreakActionReceiptRouteTimerRef.current = null;
    }, 1400);
  };
  const handleFarmPlacementHudReceiptRouteHintAction = () => {
    if (!farmPlacementHudReceiptFollowupRouteLabel) return;
    flashFarmPlacementRouteHint('已指路');
    onFollowupCanvasHint?.({
      message: `路线：${farmPlacementHudReceiptFollowupRouteLabel}${farmPlacementHudReceiptFollowupCountLabel ? ` · 目标 ${farmPlacementHudReceiptFollowupCountLabel}` : ''}${farmPlacementHudReceiptFollowupResourceLabel ? ` · 预期 ${farmPlacementHudReceiptFollowupResourceLabel}` : ''} · ${farmPlacementHudReceiptNextTitle}`,
      tone: farmPlacementHudReceiptNextTargetOpenedCanvasTone,
      routeTarget: farmPlacementHudReceiptFollowupTarget || undefined,
      routeLabel: farmPlacementHudReceiptFollowupRouteLabel,
      routeTitle: farmPlacementHudReceiptFollowupRouteTitle,
    });
  };
  const handleFarmActivityRewardStreakRouteHintAction = () => {
    if (!farmActivityRewardStreakActionRouteTarget || !farmActivityRewardStreakActionRouteLabel) return;
    flashFarmActivityRewardStreakRouteHint('已指路');
    onFollowupCanvasHint?.({
      message: `路线：${farmActivityRewardStreakActionRouteLabel}${farmActivityRewardStreakActionReceiptNextCountLabel ? ` · 目标 ${farmActivityRewardStreakActionReceiptNextCountLabel}` : ''}${farmActivityRewardStreakActionResourcePreview ? ` · ${farmActivityRewardStreakActionResourcePreview}` : ''}${farmActivityRewardStreakActionReceiptNextHint ? ` · ${farmActivityRewardStreakActionReceiptNextHint.replace('下一步：', '')}` : ''}`,
      tone: farmActivityRewardStreakActionReceiptCanvasTone,
      routeTarget: farmActivityRewardStreakActionRouteTarget,
      routeLabel: farmActivityRewardStreakActionRouteLabel,
      routeTitle: farmActivityRewardStreakActionReceiptNextTitle,
    });
  };
  const handleFarmPlacementHudReceiptFollowupAction = () => {
    if (!farmPlacementHudReceiptFollowupLabel || farmPlacementFollowupActionBusy) return;
    const receiptLabel = `已接上：${farmPlacementHudReceiptFollowupLabel}`;
    const followupDetail = `${farmPlacementHudReceiptFollowupCountLabel ? ` · 目标 ${farmPlacementHudReceiptFollowupCountLabel}` : ''}${farmPlacementHudReceiptFollowupResourceLabel ? ` · 预期 ${farmPlacementHudReceiptFollowupResourceLabel}` : ''}`;
    flashFarmPlacementFollowupAction(receiptLabel);
    onFollowupCanvasHint?.({
      message: `${receiptLabel} · ${farmPlacementHudReceiptNextTitle}${followupDetail}`,
      tone: farmPlacementHudReceiptNextTargetOpenedCanvasTone,
    });
    if (farmPlacementHudReceiptFollowupTarget === 'water') {
      onSelectTool?.('water');
      return;
    }
    if (farmPlacementHudReceiptFollowupTarget === 'ready-order') {
      if (currentOrder && orderReady) {
        handleFarmCompleteCurrentOrder();
        return;
      }
      handleOpenFarmOrder();
      return;
    }
    if (farmPlacementHudReceiptFollowupTarget === 'scarecrow-risk') {
      onSelectBuilding?.('scarecrow');
      return;
    }
    if (farmPlacementHudReceiptFollowupTarget === 'day') {
      onAdvanceDay?.();
      return;
    }
    if (farmPlacementHudReceiptFollowupTarget === 'beauty') {
      onSelectDecor?.(selectedDecorId);
      return;
    }
    if (farmPlacementHudReceiptFollowupTarget === 'building-yield-summary') {
      handleOpenFarmBuildingEffects();
    }
  };
  const handleOpenFarmAnimals = () => {
    setOpen(true);
    setFarmPanelSectionOpen('animals');
    if (typeof window === 'undefined') return;
    if (farmAnimalProductPulseTimerRef.current !== null) {
      window.clearTimeout(farmAnimalProductPulseTimerRef.current);
    }
    setFarmAnimalProductPulseId(`animal-product-${Date.now()}`);
    farmAnimalProductPulseTimerRef.current = window.setTimeout(() => {
      setFarmAnimalProductPulseId('');
      farmAnimalProductPulseTimerRef.current = null;
    }, 1400);
    if (farmAnimalProductScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmAnimalProductScrollFrameRef.current);
    }
    farmAnimalProductScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmAnimalsElement = farmAnimalsRef.current;
      const prefersReducedAnimalProductMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const animalProductScrollBehavior: ScrollBehavior = prefersReducedAnimalProductMotion ? 'auto' : 'smooth';
      farmAnimalsElement?.scrollIntoView({ block: 'nearest', behavior: animalProductScrollBehavior });
      farmAnimalsElement?.focus({ preventScroll: true });
      farmAnimalProductScrollFrameRef.current = null;
    });
  };
  const handleOpenFarmNpcVisit = () => {
    setOpen(true);
    setFarmPanelSectionOpen('visits');
    if (typeof window === 'undefined') return;
    if (farmNpcVisitPulseTimerRef.current !== null) {
      window.clearTimeout(farmNpcVisitPulseTimerRef.current);
    }
    setFarmNpcVisitPulseId(`npc-visit-${Date.now()}`);
    farmNpcVisitPulseTimerRef.current = window.setTimeout(() => {
      setFarmNpcVisitPulseId('');
      farmNpcVisitPulseTimerRef.current = null;
    }, 1400);
    if (farmNpcVisitScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(farmNpcVisitScrollFrameRef.current);
    }
    farmNpcVisitScrollFrameRef.current = window.requestAnimationFrame(() => {
      const farmNpcElement = farmNpcVisitRef.current;
      const prefersReducedNpcMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const npcScrollBehavior: ScrollBehavior = prefersReducedNpcMotion ? 'auto' : 'smooth';
      farmNpcElement?.scrollIntoView({ block: 'nearest', behavior: npcScrollBehavior });
      farmNpcElement?.focus({ preventScroll: true });
      farmNpcVisitScrollFrameRef.current = null;
    });
  };
  const farmTutorialSteps = buildFarmTutorialSteps(farmCanvas);
  const farmTutorialCompletedCount = farmTutorialSteps.filter((step) => step.done).length;
  const farmTutorialActiveStep = farmTutorialSteps.find((step) => !step.done);
  const farmTutorialProgress = Math.round((farmTutorialCompletedCount / farmTutorialSteps.length) * 100);
  const farmLongTermGoals = buildFarmLongTermGoals(farmCanvas);
  const farmLongTermCompletedCount = farmLongTermGoals.filter((goal) => goal.done).length;
  const farmLongGoalActionHints = new Map(farmLongTermGoals.map((goal) => [goal.id, farmLongGoalActionHint(goal, farmCanvas)]));
  const farmBuildingOptions = Object.values(FARM_BUILDING_DEFINITIONS);
  const farmDecorOptions = Object.values(FARM_DECOR_DEFINITIONS).filter((decor) => !decor.resourceOnly);
  const selectedBuildingId = farmCanvas?.selectedBuildingId || 'hut';
  const selectedBuildingDefinition = FARM_BUILDING_DEFINITIONS[selectedBuildingId] || FARM_BUILDING_DEFINITIONS.hut;
  const selectedDecorId = farmCanvas?.selectedDecorId || FARM_DEFAULT_DECOR_ID;
  const selectedResourceDecor = farmCanvas?.selectedResourceDecor;
  const selectedResourceDecorChoice = FARM_RESOURCE_DECOR_CHOICES.find((item) => item.id === resourceDecorType) || FARM_RESOURCE_DECOR_CHOICES[0];
  const visibleResourceDecorItems = resourceDecorItems.slice(0, 18);
  const visibleFarmAnimals = (farmCanvas?.animals || []).slice(0, 4);
  const animalCount = farmCanvas?.animals.length || 0;
  const farmAnimalProductionDay = farmCanvas?.day || 1;
  const farmAnimalNextProductTotals = (farmCanvas?.animals || []).reduce((totals, animal) => {
    const definition = FARM_ANIMAL_DEFINITIONS[animal.kind];
    if (!definition || animal.placedDay > farmAnimalProductionDay || animal.lastProducedDay === farmAnimalProductionDay) return totals;
    totals[definition.productId] = (totals[definition.productId] || 0) + definition.dailyAmount;
    return totals;
  }, {} as Partial<Record<FarmAnimalProductId, number>>);
  const farmAnimalNextProductSummary = formatAnimalProductTotals(farmAnimalNextProductTotals);
  const farmAnimalNextProductCount = sumValues(farmAnimalNextProductTotals);
  const farmAnimalProductReceiptCount = dailySummary?.animalProductsProduced || 0;
  const farmAnimalProductReceiptSummary = farmAnimalProductReceiptCount > 0
    ? dailySummary?.animalProductSummary || `动物产出 x${farmAnimalProductReceiptCount}`
    : '';
  const farmAnimalMoodCounts = (farmCanvas?.animals || []).reduce((counts, animal) => {
    counts[animal.mood] += 1;
    return counts;
  }, { happy: 0, calm: 0, hungry: 0 } as Record<FarmAnimalMood, number>);
  const farmAnimalMoodSummaryLabel = [
    farmAnimalMoodCounts.hungry > 0 ? `饿${farmAnimalMoodCounts.hungry}` : '',
    farmAnimalMoodCounts.happy > 0 ? `开心${farmAnimalMoodCounts.happy}` : '',
    farmAnimalMoodCounts.calm > 0 ? `安静${farmAnimalMoodCounts.calm}` : '',
  ].filter(Boolean).join(' / ');
  const farmAnimalMoodPreviewLabel =
    farmAnimalMoodCounts.hungry > 0
      ? `饿${farmAnimalMoodCounts.hungry}`
      : farmAnimalMoodCounts.happy > 0
        ? `开心${farmAnimalMoodCounts.happy}`
        : farmAnimalMoodCounts.calm > 0
          ? `安静${farmAnimalMoodCounts.calm}`
          : '';
  const farmAnimalMoodTone =
    farmAnimalMoodCounts.hungry > 0
      ? 'hungry'
      : farmAnimalMoodCounts.happy > 0
        ? 'happy'
        : farmAnimalMoodCounts.calm > 0
          ? 'calm'
          : '';
  const farmAnimalMoodHintLabel =
    farmAnimalMoodCounts.hungry > 0
      ? `留意 ${farmAnimalMoodCounts.hungry} 只饿了的动物`
      : farmAnimalMoodCounts.happy > 0
        ? `开心 ${farmAnimalMoodCounts.happy} 只，产物更有盼头`
        : animalCount > 0
          ? '小屋安静运转'
          : '';
  const animalProductSummary = formatFarmAnimalProducts(farmCanvas?.inventory.animalProducts);
  const totalAnimalProducts = sumValues(farmCanvas?.inventory.animalProducts);
  const farmMiniAnimalProductPreviewLabel = totalAnimalProducts > 0 ? compactFarmHudFeedback(animalProductSummary, 12) : '';
  const farmMiniAnimalProductReceiptPreviewLabel = farmAnimalProductReceiptCount > 0 ? compactFarmHudFeedback(farmAnimalProductReceiptSummary, 12) : '';
  const farmMiniAnimalNextProductPreviewLabel = farmAnimalNextProductCount > 0 ? compactFarmHudFeedback(farmAnimalNextProductSummary, 12) : '';
  const totalSeedCount = sumValues(farmCanvas?.resources.seeds);
  const waterAmount = farmCanvas?.resources.water || 0;
  const woodAmount = farmCanvas?.resources.wood || 0;
  const stoneAmount = farmCanvas?.resources.stone || 0;
  const seasonProgress = farmSeasonProgress(farmCanvas?.day || 1);
  const currentSeason = farmCanvas?.season || seasonProgress.season;
  const seasonDefinition = FARM_SEASON_DEFINITIONS[currentSeason] || FARM_SEASON_DEFINITIONS.spring;
  const nextSeasonLabel = farmSeasonLabel(seasonProgress.nextSeason);
  const farmBeautyScore = buildFarmBeautyScore(farmCanvas);
  const farmBeautyRewards = buildFarmBeautyRewards(farmCanvas);
  const unlockedBeautyRewardCount = farmBeautyRewards.filter((reward) => reward.unlocked).length;
  const nextBeautyReward: FarmBeautyReward | undefined = farmBeautyRewards.find((reward) => !reward.unlocked);
  const farmBeautyRewardRouteTarget: FarmStoryPanelRouteHintTarget = 'beauty';
  const farmBeautyRewardRouteLabel = farmRouteLabelForTarget(farmBeautyRewardRouteTarget);
  const farmBeautyRewardRouteCountLabel = nextBeautyReward
    ? `差${nextBeautyReward.remainingScore}分`
    : `${farmBeautyScore.score}分`;
  const farmBeautyRewardRouteRewardLabel = nextBeautyReward ? nextBeautyReward.title : '美化满级';
  const farmBeautyRewardRouteTitle = nextBeautyReward
    ? `美化奖励路线：冲${nextBeautyReward.title} · 还差 ${nextBeautyReward.remainingScore} 分 · 地图找${farmBeautyRewardRouteLabel}`
    : `美化奖励路线：${farmBeautyScore.title} · 奖励已全部解锁 · 地图找${farmBeautyRewardRouteLabel}`;
  const farmBeautyRewardRouteActionLabel = nextBeautyReward ? `冲${nextBeautyReward.title}` : '继续美化';
  const farmFocusGoals = buildFarmFocusGoals(farmCanvas, { maxGoals: 3 });
  const farmDailyRouteSteps = buildFarmDailyRouteSteps(farmFocusGoals, {
    dryCount,
    witheredCount,
    matureCount,
    scarecrowRiskCount,
    readyOrderCount,
    readyNpcVisitCount,
  });
  const farmDailyRouteSummaryLabel = farmDailyRouteSteps.map((step) =>
    `${step.stageLabel}${step.routeLabel}${step.countLabel ? step.countLabel : ''}`
  ).join(' -> ');
  const farmDailyRouteReceiptIndex = farmDailyRouteReceipt
    ? farmDailyRouteSteps.findIndex((step) => step.id === farmDailyRouteReceipt)
    : -1;
  const farmDailyRouteNextStep = farmDailyRouteReceiptIndex >= 0
    ? farmDailyRouteSteps[farmDailyRouteReceiptIndex + 1]
    : undefined;
  const farmDailyRouteNextTitle = farmDailyRouteNextStep
    ? `今日路线接力：下一步 ${farmDailyRouteNextStep.stageLabel} ${farmDailyRouteNextStep.title} -> ${farmDailyRouteNextStep.routeLabel}${farmDailyRouteNextStep.countLabel ? ` · ${farmDailyRouteNextStep.countLabel}` : ''}`
    : '';
  const farmDailyRouteCompleteReceipt = farmDailyRouteReceiptIndex >= 0 && !farmDailyRouteNextStep && farmDailyRouteSteps.length > 0;
  const farmDailyRouteCompleteTitle = farmDailyRouteCompleteReceipt
    ? `今日路线完成：${farmDailyRouteSummaryLabel || `${farmDailyRouteSteps.length}步`}`
    : '';
  const farmDailyRouteWrapupTitle = farmDailyRouteCompleteReceipt
    ? `今日收尾：路线 ${farmDailyRouteSteps.length} 步完成，过一天查看明日总结`
    : '';
  const farmTomorrowRouteSteps = dailySummary ? farmDailyRouteSteps.slice(0, 3) : [];
  const farmTomorrowRouteSummaryLabel = farmTomorrowRouteSteps.map((step) => {
    const countLabel = step.countLabel ? ` ${step.countLabel}` : '';
    return `${step.stageLabel}${step.routeLabel}${countLabel}`;
  }).join(' / ');
  const farmMorningBriefItems = ([
    dailySummary && matureCount > 0
      ? {
          id: 'morning-mature',
          label: '成熟可收',
          detail: `${matureCount} 个作物等着进篮子`,
          countLabel: `${matureCount}个`,
          rewardLabel: '收获入袋',
          tone: 'mature',
          icon: Wheat,
          action: { kind: 'jump-mature' },
          routeTarget: 'mature-crop',
          routeLabel: farmRouteLabelForTarget('mature-crop'),
        }
      : null,
    dailySummary && readyOrderCount > 0 && orderReady && currentOrder
      ? {
          id: `morning-order-${currentOrder.id}`,
          label: '订单可交',
          detail: currentOrder.title,
          countLabel: `${readyOrderCount}单`,
          rewardLabel: formatFarmReward(currentOrder.rewards),
          tone: 'ready',
          icon: Package,
          action: { kind: 'complete-order', orderId: currentOrder.id },
          routeTarget: 'ready-order',
          routeLabel: farmRouteLabelForTarget('ready-order'),
        }
      : null,
    dailySummary && readyNpcVisitCount > 0 && npcVisitReady && activeNpcVisit
      ? {
          id: `morning-npc-${activeNpcVisit.id}`,
          label: '来访可交',
          detail: activeNpcVisit.visitorName,
          countLabel: `${readyNpcVisitCount}访`,
          rewardLabel: '谢礼/熟络',
          tone: 'quest',
          icon: UserRound,
          action: { kind: 'complete-npc', visitId: activeNpcVisit.id },
          routeTarget: 'ready-npc',
          routeLabel: farmRouteLabelForTarget('ready-npc'),
        }
      : null,
    dailySummary && dailySummary.animalProductsProduced > 0
      ? {
          id: 'morning-animal',
          label: '动物小屋',
          detail: dailySummary.animalProductSummary || `产物 ${dailySummary.animalProductsProduced}`,
          countLabel: `${dailySummary.animalProductsProduced}份`,
          rewardLabel: '产物已入袋',
          tone: 'animal',
          icon: PawPrint,
          action: { kind: 'open-animals' },
          routeLabel: '动物',
        }
      : null,
    dailySummary && dailySummary.dailyWaterCapacity > 0
      ? {
          id: 'morning-water',
          label: '水井补给',
          detail: dryCount > 0 ? `还有 ${dryCount} 块地可浇水` : '水桶已经补满，随时能开工',
          countLabel: `水量 ${waterAmount}`,
          rewardLabel: `补给 ${dailySummary.dailyWaterCapacity}`,
          tone: 'water',
          icon: Droplets,
          action: dryCount > 0 ? { kind: 'select-tool', tool: 'water' } : { kind: 'open-building' },
          routeTarget: dryCount > 0 ? 'water' : 'building-yield-summary',
          routeLabel: farmRouteLabelForTarget(dryCount > 0 ? 'water' : 'building-yield-summary'),
        }
      : null,
  ] as Array<FarmMorningBriefItem | null>).filter((item): item is FarmMorningBriefItem => Boolean(item)).slice(0, 4);
  const farmDailyRouteWrapupReceiptTitle = farmDailyRouteWrapupReceipt
    ? [
        `收尾已完成：D${farmDailyRouteWrapupReceipt.fromDay} -> D${farmDailyRouteWrapupReceipt.toDay}`,
        `${farmDailyRouteWrapupReceipt.stepCount}步路线`,
        farmMorningBriefItems.length > 0 ? `明日晨报 ${farmMorningBriefItems.length}条` : '',
        farmTomorrowRouteSteps.length > 0 ? `明日路线 ${farmTomorrowRouteSteps.length}步` : '',
      ].filter(Boolean).join(' · ')
    : '';
  const farmDailyRouteWrapupNextStep = farmDailyRouteWrapupReceipt ? farmTomorrowRouteSteps[0] : undefined;
  const farmDailyRouteWrapupNextTitle = farmDailyRouteWrapupNextStep
    ? `接明日开局：${farmDailyRouteWrapupNextStep.stageLabel} ${farmDailyRouteWrapupNextStep.title} -> ${farmDailyRouteWrapupNextStep.routeLabel}${farmDailyRouteWrapupNextStep.countLabel ? ` · ${farmDailyRouteWrapupNextStep.countLabel}` : ''}`
    : '';
  const farmMorningKickstartItem = farmMorningBriefItems[0];
  const farmMorningFollowupItem = farmMorningBriefItems[1];
  const farmMorningKickstartSummary = farmMorningKickstartItem
    ? `${farmMorningKickstartItem.label} · ${farmMorningKickstartItem.detail}${farmMorningKickstartItem.rewardLabel ? ` · ${farmMorningKickstartItem.rewardLabel}` : ''}`
    : '';
  const farmMorningFollowupSummary = farmMorningFollowupItem
    ? `${farmMorningFollowupItem.label} · ${farmMorningFollowupItem.detail}${farmMorningFollowupItem.rewardLabel ? ` · ${farmMorningFollowupItem.rewardLabel}` : ''}`
    : '';
  const farmMorningComboReceipt = Boolean(
    farmMorningKickstartItem
    && farmMorningFollowupItem
    && farmMorningBriefReceipt === farmMorningFollowupItem.id
  );
  const farmMorningComboSummary = farmMorningComboReceipt && farmMorningKickstartItem && farmMorningFollowupItem
    ? `${farmMorningKickstartItem.label} -> ${farmMorningFollowupItem.label}`
    : '';
  const farmMorningComboRewardLabel = farmMorningComboReceipt && farmMorningFollowupItem
    ? farmMorningFollowupItem.rewardLabel || farmMorningFollowupItem.countLabel || '已接上'
    : '';
  const farmMorningKickstartFocusAction = farmMorningKickstartItem?.action
    && farmMorningKickstartItem.action.kind !== 'open-animals'
    && farmMorningKickstartItem.action.kind !== 'open-building'
    ? farmMorningKickstartItem.action
    : undefined;
  const farmMorningFollowupFocusAction = farmMorningFollowupItem?.action
    && farmMorningFollowupItem.action.kind !== 'open-animals'
    && farmMorningFollowupItem.action.kind !== 'open-building'
    ? farmMorningFollowupItem.action
    : undefined;
  const farmMorningComboRouteStep = farmMorningComboReceipt
    ? farmDailyRouteSteps.find((step) =>
      !farmFocusActionMatches(step.action, farmMorningKickstartFocusAction)
      && !farmFocusActionMatches(step.action, farmMorningFollowupFocusAction)
    ) || farmDailyRouteSteps[2] || farmDailyRouteSteps[1] || farmDailyRouteSteps[0]
    : undefined;
  const farmMorningComboRouteReceipt = Boolean(
    farmMorningComboRouteStep && farmDailyRouteReceipt === farmMorningComboRouteStep.id
  );
  const farmMorningComboRouteTitle = farmMorningComboRouteStep
    ? `晨报二连完成，接今日路线：${farmMorningComboRouteStep.stageLabel} ${farmMorningComboRouteStep.title} -> ${farmMorningComboRouteStep.routeLabel}${farmMorningComboRouteStep.countLabel ? ` · ${farmMorningComboRouteStep.countLabel}` : ''}`
    : '';
  const FarmMorningKickstartIcon = farmMorningKickstartItem?.icon || Sparkles;
  const FarmMorningFollowupIcon = farmMorningFollowupItem?.icon || Sparkles;
  const farmDailyRouteMonitorLabel = farmDailyRouteSteps.map((step) => {
    const countLabel = step.countLabel ? ` ${step.countLabel}` : '';
    return `${step.stageLabel}${step.routeLabel}${countLabel}`;
  }).join(' / ');
  const farmDailyRouteFocusStep = farmDailyRouteCompleteReceipt
    ? undefined
    : farmDailyRouteNextStep || farmDailyRouteSteps[0];
  const farmDailyRouteFocusMode = farmDailyRouteWrapupReceipt
    ? 'tomorrow'
    : farmDailyRouteCompleteReceipt
      ? 'wrapup'
      : farmDailyRouteReceiptIndex >= 0 && farmDailyRouteNextStep
        ? 'next'
        : farmDailyRouteFocusStep
          ? 'start'
          : '';
  const farmDailyRouteFocusStageLabel = farmDailyRouteFocusMode === 'tomorrow'
    ? '明日'
    : farmDailyRouteFocusMode === 'wrapup'
      ? '收尾'
      : farmDailyRouteFocusMode === 'next'
        ? '下一步'
        : farmDailyRouteFocusStep
          ? farmDailyRouteFocusStep.stageLabel
          : '';
  const farmDailyRouteFocusLabel = farmDailyRouteFocusMode === 'tomorrow'
    ? (farmDailyRouteWrapupNextStep?.routeLabel || farmDailyRouteWrapupNextStep?.title || '明日开局')
    : farmDailyRouteCompleteReceipt
      ? '路线完成'
      : (farmDailyRouteFocusStep?.routeLabel || farmDailyRouteFocusStep?.title || '');
  const farmDailyRouteFocusMetaLabel = farmDailyRouteFocusMode === 'tomorrow'
    ? (farmDailyRouteWrapupNextStep?.countLabel || '待接上')
    : farmDailyRouteCompleteReceipt
      ? `${farmDailyRouteSteps.length}步完成`
      : (farmDailyRouteFocusStep?.countLabel || farmDailyRouteFocusStep?.title || `${farmDailyRouteSteps.length}步`);
  const farmDailyRouteFocusTarget = farmDailyRouteFocusMode === 'tomorrow'
    ? farmDailyRouteWrapupNextStep?.routeTarget
    : farmDailyRouteFocusStep?.routeTarget;
  const farmDailyRouteFocusTitle = farmDailyRouteFocusMode === 'tomorrow'
    ? farmDailyRouteWrapupNextTitle || farmDailyRouteWrapupReceiptTitle
    : farmDailyRouteCompleteReceipt
      ? farmDailyRouteWrapupTitle || farmDailyRouteCompleteTitle
      : farmDailyRouteFocusStep
        ? `${farmDailyRouteFocusStageLabel}：${farmDailyRouteFocusStep.title} -> ${farmDailyRouteFocusStep.routeLabel}${farmDailyRouteFocusStep.countLabel ? ` · ${farmDailyRouteFocusStep.countLabel}` : ''}`
        : '';
  const primaryFarmFocus = farmFocusGoals[0];
  const primaryFarmFocusReady = Boolean(primaryFarmFocus?.ready);
  const primaryFarmFocusComplete = Boolean(primaryFarmFocus && primaryFarmFocus.percent >= 100);
  const primaryFarmFocusStatusLabel = primaryFarmFocusComplete ? '已完成' : primaryFarmFocusReady ? '可执行' : '推进中';
  const primaryFarmFocusActionLabel = farmMiniFocusActionLabel(primaryFarmFocus);
  const farmMiniQuickActionBusy = Boolean(farmMiniQuickActionFeedback);
  const farmMiniToolFlash = Boolean(farmMiniQuickActionFeedback?.tool && farmMiniQuickActionFeedback.tool === selectedTool);
  function buildFarmOrderRewardPocketReceipt(orderId: string): FarmOrderRewardPocketReceipt | null {
    const order = farmCanvas?.orders.find((candidate) => candidate.id === orderId)
      || (currentOrder?.id === orderId ? currentOrder : undefined);
    if (!order) return null;
    const nextFocus = farmFocusGoals.find((goal) => !(goal.action.kind === 'complete-order' && goal.action.orderId === order.id)) || primaryFarmFocus;
    const nextTarget = nextFocus?.action ? farmFocusActionNextTarget(nextFocus.action) : undefined;
    const routeTarget = nextFocus?.action ? farmRouteTargetForFocusAction(nextFocus.action) : undefined;
    const routeLabel = farmRouteLabelForTarget(routeTarget);
    const nextHint = nextFocus?.action ? farmFocusActionNextHint(nextFocus.action) : '';
    const nextCountLabel = nextFocus?.action
      ? farmFocusActionNextCountLabel(nextFocus.action, {
          dryCount,
          witheredCount,
          matureCount,
          scarecrowRiskCount,
          readyOrderCount: Math.max(0, readyOrderCount - (canCompleteOrder(farmCanvas, order.id) ? 1 : 0)),
          readyNpcVisitCount,
        })
      : '';
    const nextLabel = farmMiniFocusActionLabel(nextFocus) || nextFocus?.actionLabel || '';
    const nextActionLabel = nextLabel ? `接${nextLabel}` : '';
    const rewardLabel = formatFarmReward(order.rewards);
    const festivalRewardLabel = currentOrder?.id === order.id ? currentOrderFestivalRewardLabel : '';
    const routeTitle = routeLabel
      ? `订单奖励路线：${routeLabel}${nextCountLabel ? ` · 目标 ${nextCountLabel}` : ''}${nextHint ? ` · ${nextHint}` : ''}`
      : '';
    const nextActionTitle = nextFocus?.action
      ? `奖励入袋后继续：${nextLabel || nextFocus.actionLabel}${nextCountLabel ? ` · 目标 ${nextCountLabel}` : ''}${nextHint ? ` · ${nextHint}` : ''}`
      : '';
    const title = [
      `奖励入袋：${order.title}`,
      rewardLabel ? `奖励 ${rewardLabel}` : '',
      festivalRewardLabel ? `节庆 ${festivalRewardLabel}` : '',
      nextLabel ? `下一步 ${nextLabel}` : '',
      nextCountLabel ? `目标 ${nextCountLabel}` : '',
      nextActionLabel ? `可一键${nextActionLabel}` : '',
    ].filter(Boolean).join(' · ');
    return {
      orderId: order.id,
      title,
      rewardLabel,
      festivalRewardLabel,
      nextLabel,
      nextHint,
      nextCountLabel,
      nextActionLabel,
      nextActionTitle,
      action: nextFocus?.action,
      routeTarget,
      routeLabel,
      routeTitle,
      tone: farmFocusActionCanvasTone(nextTarget),
    };
  }
  function flashFarmOrderRewardPocket(orderId: string) {
    const receipt = buildFarmOrderRewardPocketReceipt(orderId);
    if (!receipt) return;
    if (farmOrderRewardPocketTimerRef.current !== null) {
      window.clearTimeout(farmOrderRewardPocketTimerRef.current);
    }
    setFarmOrderRewardPocketReceipt(receipt);
    setFarmOrderRewardRouteReceipt('');
    setFarmOrderRewardNextActionReceipt('');
    farmOrderRewardPocketTimerRef.current = window.setTimeout(() => {
      setFarmOrderRewardPocketReceipt(null);
      setFarmOrderRewardRouteReceipt('');
      setFarmOrderRewardNextActionReceipt('');
      farmOrderRewardPocketTimerRef.current = null;
    }, 2400);
  }
  function handleFarmOrderRewardPocketRouteHint() {
    if (!farmOrderRewardPocketReceipt?.routeTarget || !farmOrderRewardPocketReceipt.routeLabel) return;
    if (farmOrderRewardRouteTimerRef.current !== null) {
      window.clearTimeout(farmOrderRewardRouteTimerRef.current);
    }
    setFarmOrderRewardRouteReceipt(farmOrderRewardPocketReceipt.routeLabel);
    farmOrderRewardRouteTimerRef.current = window.setTimeout(() => {
      setFarmOrderRewardRouteReceipt('');
      farmOrderRewardRouteTimerRef.current = null;
    }, 1400);
    onFollowupCanvasHint?.({
      message: `订单奖励路线：${farmOrderRewardPocketReceipt.routeLabel}${farmOrderRewardPocketReceipt.nextCountLabel ? ` · 目标 ${farmOrderRewardPocketReceipt.nextCountLabel}` : ''}${farmOrderRewardPocketReceipt.nextHint ? ` · ${farmOrderRewardPocketReceipt.nextHint}` : ''}`,
      tone: farmOrderRewardPocketReceipt.tone,
      routeTarget: farmOrderRewardPocketReceipt.routeTarget,
      routeLabel: farmOrderRewardPocketReceipt.routeLabel,
      routeTitle: farmOrderRewardPocketReceipt.routeTitle,
    });
  }
  function handleFarmOrderRewardPocketNextAction() {
    if (!farmOrderRewardPocketReceipt?.action) return;
    if (farmOrderRewardNextActionTimerRef.current !== null) {
      window.clearTimeout(farmOrderRewardNextActionTimerRef.current);
    }
    setFarmOrderRewardNextActionReceipt(farmOrderRewardPocketReceipt.nextActionLabel || '已接上');
    farmOrderRewardNextActionTimerRef.current = window.setTimeout(() => {
      setFarmOrderRewardNextActionReceipt('');
      farmOrderRewardNextActionTimerRef.current = null;
    }, 1200);
    onFollowupCanvasHint?.({
      message: `订单奖励接上：${farmOrderRewardPocketReceipt.nextLabel || farmOrderRewardPocketReceipt.nextActionLabel}${farmOrderRewardPocketReceipt.nextCountLabel ? ` · 目标 ${farmOrderRewardPocketReceipt.nextCountLabel}` : ''}`,
      tone: farmOrderRewardPocketReceipt.tone,
      routeTarget: farmOrderRewardPocketReceipt.routeTarget,
      routeLabel: farmOrderRewardPocketReceipt.routeLabel,
      routeTitle: farmOrderRewardPocketReceipt.nextActionTitle || farmOrderRewardPocketReceipt.routeTitle,
    });
    handleFarmGoalAction(farmOrderRewardPocketReceipt.action);
  }
  function handleFarmCompleteCurrentOrder() {
    if (!currentOrder || farmOrderStampActive) return;
    flashFarmOrderStamp(currentOrder.id);
    flashFarmOrderRewardPocket(currentOrder.id);
    onCompleteOrder?.(currentOrder.id);
  }
  const handleFarmGoalAction = (action: FarmFocusGoalAction) => {
    if (action.kind === 'select-tool') onSelectTool?.(action.tool);
    if (action.kind === 'jump-mature') onJumpToMature?.();
    if (action.kind === 'complete-order') {
      flashFarmOrderStamp(action.orderId);
      flashFarmOrderRewardPocket(action.orderId);
      onCompleteOrder?.(action.orderId);
    }
    if (action.kind === 'complete-npc') onCompleteNpcVisit?.(action.visitId);
    if (action.kind === 'select-building') onSelectBuilding?.(action.buildingId);
    if (action.kind === 'select-decor') onSelectDecor?.(action.decorId);
    if (action.kind === 'advance-day') onAdvanceDay?.();
  };
  function flashFarmDailyRouteReceipt(stepId: string) {
    if (farmDailyRouteReceiptTimerRef.current !== null) {
      window.clearTimeout(farmDailyRouteReceiptTimerRef.current);
    }
    setFarmDailyRouteReceipt(stepId);
    farmDailyRouteReceiptTimerRef.current = window.setTimeout(() => {
      setFarmDailyRouteReceipt('');
      farmDailyRouteReceiptTimerRef.current = null;
    }, 1300);
  }
  function flashFarmDailyRouteWrapupReceipt() {
    if (farmDailyRouteWrapupReceiptTimerRef.current !== null) {
      window.clearTimeout(farmDailyRouteWrapupReceiptTimerRef.current);
    }
    setFarmDailyRouteWrapupReceipt({
      id: `wrapup-${Date.now()}`,
      summaryLabel: farmDailyRouteSummaryLabel || `${farmDailyRouteSteps.length}步`,
      stepCount: farmDailyRouteSteps.length,
      fromDay: farmCanvas?.day || 1,
      toDay: (farmCanvas?.day || 1) + 1,
    });
    farmDailyRouteWrapupReceiptTimerRef.current = window.setTimeout(() => {
      setFarmDailyRouteWrapupReceipt(null);
      farmDailyRouteWrapupReceiptTimerRef.current = null;
    }, 2800);
  }
  function handleFarmDailyRouteStepAction(step: FarmDailyRouteStep) {
    handleFarmGoalAction(step.action);
    flashFarmDailyRouteReceipt(step.id);
    onFollowupCanvasHint?.({
      message: `${step.routeTitle} · ${step.actionLabel}`,
      tone: farmFocusActionCanvasTone(step.canvasTarget),
      routeTarget: step.routeTarget,
      routeLabel: step.routeLabel,
      routeTitle: step.routeTitle,
    });
  }
  function handleFarmDailyRouteWrapupAction() {
    flashFarmDailyRouteWrapupReceipt();
    handleFarmGoalAction({ kind: 'advance-day' });
    onFollowupCanvasHint?.({
      message: `今日收尾：路线 ${farmDailyRouteSteps.length} 步完成，过一天查看明日总结`,
      tone: farmFocusActionCanvasTone('day'),
      routeTarget: 'day',
      routeLabel: farmRouteLabelForTarget('day'),
      routeTitle: farmDailyRouteWrapupTitle,
    });
  }
  function flashFarmTomorrowRouteReceipt(stepId: string) {
    if (farmTomorrowRouteReceiptTimerRef.current !== null) {
      window.clearTimeout(farmTomorrowRouteReceiptTimerRef.current);
    }
    setFarmTomorrowRouteReceipt(stepId);
    farmTomorrowRouteReceiptTimerRef.current = window.setTimeout(() => {
      setFarmTomorrowRouteReceipt('');
      farmTomorrowRouteReceiptTimerRef.current = null;
    }, 1400);
  }
  function handleFarmTomorrowRouteStepAction(step: FarmDailyRouteStep) {
    handleFarmGoalAction(step.action);
    flashFarmTomorrowRouteReceipt(step.id);
    onFollowupCanvasHint?.({
      message: `明日待办：${step.stageLabel} ${step.title} · ${step.actionLabel}`,
      tone: farmFocusActionCanvasTone(step.canvasTarget),
      routeTarget: step.routeTarget,
      routeLabel: step.routeLabel,
      routeTitle: `明日开局路线：${step.routeLabel}${step.countLabel ? ` · ${step.countLabel}` : ''}`,
    });
  }
  function flashFarmMorningBriefReceipt(itemId: string) {
    if (farmMorningBriefReceiptTimerRef.current !== null) {
      window.clearTimeout(farmMorningBriefReceiptTimerRef.current);
    }
    setFarmMorningBriefReceipt(itemId);
    farmMorningBriefReceiptTimerRef.current = window.setTimeout(() => {
      setFarmMorningBriefReceipt('');
      farmMorningBriefReceiptTimerRef.current = null;
    }, 1400);
  }
  function handleFarmMorningBriefAction(item: FarmMorningBriefItem) {
    if (!item.action) return;
    flashFarmMorningBriefReceipt(item.id);
    let tone: FarmCanvasFloatingFeedback['tone'] = 'success';
    if (item.action.kind === 'open-animals') handleOpenFarmAnimals();
    else if (item.action.kind === 'open-building') handleOpenFarmBuildingEffects();
    else {
      handleFarmGoalAction(item.action);
      tone = farmFocusActionCanvasTone(farmFocusActionNextTarget(item.action));
    }
    if (item.action.kind === 'open-animals') tone = 'reward';
    if (item.action.kind === 'open-building') tone = 'build';
    onFollowupCanvasHint?.({
      message: `晨报接上：${item.label} · ${item.detail}`,
      tone,
      routeTarget: item.routeTarget,
      routeLabel: item.routeLabel,
      routeTitle: `明日晨报：${item.label}${item.countLabel ? ` · ${item.countLabel}` : ''}${item.rewardLabel ? ` · ${item.rewardLabel}` : ''}`,
    });
  }
  function handleFarmLongGoalAction(goal: FarmLongTermGoal, actionHint: FarmLongGoalActionHint) {
    handleFarmGoalAction(actionHint.action);
    setFarmLongGoalActionReceiptId(goal.id);
    if (farmLongGoalActionTimerRef.current !== null) {
      window.clearTimeout(farmLongGoalActionTimerRef.current);
    }
    farmLongGoalActionTimerRef.current = window.setTimeout(() => {
      setFarmLongGoalActionReceiptId('');
      farmLongGoalActionTimerRef.current = null;
    }, 1400);
    onFollowupCanvasHint?.({
      message: `手账路线：${goal.title} -> ${actionHint.routeLabel}`,
      tone: farmFocusActionCanvasTone(actionHint.canvasTarget),
      routeTarget: actionHint.routeTarget,
      routeLabel: actionHint.routeLabel,
      routeTitle: actionHint.title,
    });
  }
  function handleFarmDecorUnlockRoute(decor: FarmDecorOption, routeHint: FarmDecorUnlockRouteHint) {
    handleFarmGoalAction(routeHint.action);
    setFarmDecorUnlockRouteReceipt(decor.id);
    if (farmDecorUnlockRouteTimerRef.current !== null) {
      window.clearTimeout(farmDecorUnlockRouteTimerRef.current);
    }
    farmDecorUnlockRouteTimerRef.current = window.setTimeout(() => {
      setFarmDecorUnlockRouteReceipt('');
      farmDecorUnlockRouteTimerRef.current = null;
    }, 1400);
    onFollowupCanvasHint?.({
      message: `装饰解锁：${decor.label} -> ${routeHint.routeLabel}`,
      tone: farmFocusActionCanvasTone(routeHint.canvasTarget),
      routeTarget: routeHint.routeTarget,
      routeLabel: routeHint.routeLabel,
      routeTitle: routeHint.title,
    });
  }
  const flashFarmSummaryDetailAction = (label: string, itemId = '') => {
    if (typeof window === 'undefined') return;
    if (farmSummaryDetailActionTimerRef.current !== null) {
      window.clearTimeout(farmSummaryDetailActionTimerRef.current);
    }
    setFarmSummaryDetailActionFeedback(label);
    setFarmSummaryDetailActionFeedbackItemId(itemId);
    farmSummaryDetailActionTimerRef.current = window.setTimeout(() => {
      setFarmSummaryDetailActionFeedback('');
      setFarmSummaryDetailActionFeedbackItemId('');
      setFarmLiveFeedbackCompletionReceipt(null);
      farmSummaryDetailActionTimerRef.current = null;
    }, 1200);
  };
  const flashFarmMiniQuickAction = (goal: FarmFocusGoal, actionLabel: string) => {
    if (typeof window === 'undefined') return;
    if (farmMiniQuickActionTimerRef.current !== null) {
      window.clearTimeout(farmMiniQuickActionTimerRef.current);
    }
    setFarmMiniQuickActionFeedback({
      id: Date.now(),
      label: `已${actionLabel}`,
      kind: goal.kind,
      actionKind: goal.action.kind,
      buildingId: goal.action.kind === 'select-building' ? goal.action.buildingId : undefined,
      tool: goal.action.kind === 'select-tool' ? goal.action.tool : undefined,
      icon: farmMiniFocusActionIcon(goal),
    });
    farmMiniQuickActionTimerRef.current = window.setTimeout(() => {
      setFarmMiniQuickActionFeedback(null);
      farmMiniQuickActionTimerRef.current = null;
    }, 1200);
  };
  const handleFarmMiniFocusAction = () => {
    if (!primaryFarmFocus || !primaryFarmFocusActionLabel || farmMiniQuickActionBusy) return;
    handleFarmGoalAction(primaryFarmFocus.action);
    flashFarmMiniQuickAction(primaryFarmFocus, primaryFarmFocusActionLabel);
  };
  const handleFarmFocusAction = (goal: FarmFocusGoal) => {
    if (farmMiniQuickActionBusy) return;
    const actionLabel = farmMiniFocusActionLabel(goal) || goal.actionLabel;
    handleFarmGoalAction(goal.action);
    flashFarmMiniQuickAction(goal, actionLabel);
  };
  const handleFarmActivityRewardStreakAction = () => {
    if (!farmActivityRewardStreakGoal || farmMiniQuickActionBusy) {
      handleOpenFarmActivity('action');
      return;
    }
    const rewardPocketActionFollowup = farmActivityChestClaimNextReceiptRewardPocketFollowupLabel;
    if (typeof window !== 'undefined') {
      if (farmActivityRewardStreakActionReceiptTimerRef.current !== null) {
        window.clearTimeout(farmActivityRewardStreakActionReceiptTimerRef.current);
      }
      setFarmActivityRewardStreakActionReceipt(`建议已执行：${farmActivityRewardStreakGoal.actionLabel}`);
      setFarmActivityRewardStreakActionReceiptFollowup(rewardPocketActionFollowup);
      farmActivityRewardStreakActionReceiptTimerRef.current = window.setTimeout(() => {
        setFarmActivityRewardStreakActionReceipt('');
        setFarmActivityRewardStreakActionReceiptFollowup('');
        farmActivityRewardStreakActionReceiptTimerRef.current = null;
      }, 1400);
    }
    handleFarmFocusAction(farmActivityRewardStreakGoal);
    handleOpenFarmActivity('action');
  };
  const handleFarmActivityChestClaimNextAction = () => {
    if (!farmActivityRewardStreakGoal || farmMiniQuickActionBusy) {
      handleOpenFarmActivity('action');
      return;
    }
    if (typeof window !== 'undefined') {
      if (farmActivityChestClaimNextReceiptTimerRef.current !== null) {
        window.clearTimeout(farmActivityChestClaimNextReceiptTimerRef.current);
      }
      setFarmActivityChestClaimNextReceipt(`续连击已确认：${farmActivityRewardStreakGoal.actionLabel}`);
      farmActivityChestClaimNextReceiptTimerRef.current = window.setTimeout(() => {
        setFarmActivityChestClaimNextReceipt('');
        farmActivityChestClaimNextReceiptTimerRef.current = null;
      }, 1800);
    }
    handleFarmActivityRewardStreakAction();
  };
  const handleFarmActivityChestChargeAction = () => {
    if (!farmActivityRewardStreakGoal || farmMiniQuickActionBusy) {
      handleOpenFarmActivity('chest');
      return;
    }
    if (typeof window !== 'undefined') {
      if (farmActivityRewardStreakActionReceiptTimerRef.current !== null) {
        window.clearTimeout(farmActivityRewardStreakActionReceiptTimerRef.current);
      }
      setFarmActivityRewardStreakActionReceipt(`宝箱蓄能：${farmActivityRewardStreakGoal.actionLabel}`);
      farmActivityRewardStreakActionReceiptTimerRef.current = window.setTimeout(() => {
        setFarmActivityRewardStreakActionReceipt('');
        farmActivityRewardStreakActionReceiptTimerRef.current = null;
      }, 1400);
      if (farmActivityChestChargeReceiptTimerRef.current !== null) {
        window.clearTimeout(farmActivityChestChargeReceiptTimerRef.current);
      }
      setFarmActivityChestChargeReceipt(`蓄能已确认：${farmActivityRewardStreakGoal.actionLabel}`);
      farmActivityChestChargeReceiptTimerRef.current = window.setTimeout(() => {
        setFarmActivityChestChargeReceipt('');
        farmActivityChestChargeReceiptTimerRef.current = null;
      }, 2600);
    }
    handleFarmFocusAction(farmActivityRewardStreakGoal);
    handleOpenFarmActivity('chest');
  };
  const handleFarmActivityChestAction = () => {
    if (farmActivityDigest.rewardStreakChestState !== 'ready') {
      handleOpenFarmActivity('chest');
      return;
    }
    if (typeof window !== 'undefined') {
      if (farmActivityChestClaimTimerRef.current !== null) {
        window.clearTimeout(farmActivityChestClaimTimerRef.current);
      }
      setFarmActivityChestClaimPulseId(`activity-chest-claim-${Date.now()}`);
      farmActivityChestClaimTimerRef.current = window.setTimeout(() => {
        setFarmActivityChestClaimPulseId('');
        farmActivityChestClaimTimerRef.current = null;
      }, 1800);
    }
    handleOpenFarmActivity('chest');
  };
  const handleFarmMiniScarecrowRiskAction = () => {
    if (scarecrowRiskCount === 0) return;
    if (typeof window !== 'undefined') {
      if (farmScarecrowRiskTimerRef.current !== null) {
        window.clearTimeout(farmScarecrowRiskTimerRef.current);
      }
      setFarmScarecrowRiskPulseId(`scarecrow-risk-${Date.now()}`);
      farmScarecrowRiskTimerRef.current = window.setTimeout(() => {
        setFarmScarecrowRiskPulseId('');
        farmScarecrowRiskTimerRef.current = null;
      }, 1200);
    }
    onSelectBuilding?.('scarecrow');
    onFollowupCanvasHint?.({
      message: `地图找守护：${scarecrowRiskCount}块缺水地旁补稻草人`,
      tone: 'build',
      routeTarget: 'scarecrow-risk',
      routeLabel: '守护',
      routeTitle: `自动定位最近未守护作物 ${scarecrowRiskCount}块`,
    });
  };
  const handleFarmLiveFeedbackAction = (item: FarmLiveFeedbackItem) => {
    if (!item.action) return;
    if (farmSummaryDetailActionFeedbackItemId === item.id && farmSummaryDetailActionFeedback) return;
    const farmLiveFeedbackCompletionResourceTargets = farmActionResourceTargets(item.action);
    const farmLiveFeedbackCompletionResourceLabel = farmActionResourcePreviewLabel(farmLiveFeedbackCompletionResourceTargets).replace('预期：', '');
    const completionReceipt = item.action && primaryFarmFocus &&
      farmFocusActionMatches(item.action, primaryFarmFocus.action) &&
      primaryFarmFocusNextProgress >= primaryFarmFocus.target &&
      !primaryFarmFocusComplete
      ? {
          itemId: item.id,
          goalId: primaryFarmFocus.id,
          goalTitle: primaryFarmFocus.title,
          icon: item.icon,
          goalKind: primaryFarmFocus.kind,
          goalKindLabel: farmFocusGoalKindLabel(primaryFarmFocus.kind),
          resourceTargets: farmLiveFeedbackCompletionResourceTargets,
          resourceLabel: farmLiveFeedbackCompletionResourceLabel,
          progress: Math.min(primaryFarmFocusNextProgress, primaryFarmFocus.target),
          target: primaryFarmFocus.target,
          progressLabel: `达成 ${Math.min(primaryFarmFocusNextProgress, primaryFarmFocus.target)}/${primaryFarmFocus.target}`,
          summaryLabel: farmLiveFeedbackCompletionSummaryLabel({
            goalTitle: primaryFarmFocus.title,
            actionLabel: item.actionLabel || '执行',
            goalKindLabel: farmFocusGoalKindLabel(primaryFarmFocus.kind),
            progressLabel: `达成 ${Math.min(primaryFarmFocusNextProgress, primaryFarmFocus.target)}/${primaryFarmFocus.target}`,
            resourceLabel: farmLiveFeedbackCompletionResourceLabel,
          }),
          actionKind: item.action.kind,
          actionLabel: item.actionLabel || '执行',
        }
      : null;
    setFarmLiveFeedbackCompletionReceipt(completionReceipt);
    handleFarmGoalAction(item.action);
    flashFarmSummaryDetailAction(item.actionLabel || '执行', item.id);
  };
  const farmBuildingEffectWaterRefillLabel = farmBuildingEffects.dailyWaterCapacity > waterAmount
    ? `补${farmBuildingEffects.dailyWaterCapacity - waterAmount}水`
    : '已满';
  const farmBuildingEffectReadyOrderLabel = readyOrderCount > 0 ? `${readyOrderCount}单` : '候单';
  const farmBuildingEffectScarecrowTargetLabel = scarecrowRiskCount > 0 ? `${scarecrowRiskCount}处` : '已守';
  const farmBuildingEffectItems = [
    farmBuildingEffects.wells > 0
      ? { id: 'well', label: `水井 x${farmBuildingEffects.wells}`, value: `每日补水到 ${farmBuildingEffects.dailyWaterCapacity}`, supportLabel: '补水', supportTone: 'water', statusLabel: '补水中', actionHint: '明天补水', yieldLabel: `水量 ${farmBuildingEffects.dailyWaterCapacity}`, yieldTone: 'water', yieldStampLabel: '已生效', nextTargetLabel: farmBuildingEffectWaterRefillLabel }
      : null,
    farmBuildingEffects.storages > 0
      ? { id: 'storage', label: `仓库 x${farmBuildingEffects.storages}`, value: `库存容量 +${farmBuildingEffects.storageCapacityBonus}`, supportLabel: '容量', supportTone: 'storage', statusLabel: '扩容中', actionHint: '可多囤货', yieldLabel: `容量 +${farmBuildingEffects.storageCapacityBonus}`, yieldTone: 'storage', yieldStampLabel: '已生效', nextTargetLabel: `+${farmBuildingEffects.storageCapacityBonus}容` }
      : null,
    farmBuildingEffects.boards > 0
      ? { id: 'board', label: `公告板 x${farmBuildingEffects.boards}`, value: '优先显示可交付订单', supportLabel: '订单', supportTone: 'board', statusLabel: '派单中', actionHint: '看订单', yieldLabel: '订单优先', yieldTone: 'board', yieldStampLabel: '已生效', nextTargetLabel: farmBuildingEffectReadyOrderLabel }
      : null,
    farmBuildingEffects.scarecrows > 0
      ? { id: 'scarecrow', label: `稻草人 x${farmBuildingEffects.scarecrows}`, value: `守护半径 ${farmBuildingEffects.scarecrowRadiusCells} 格`, supportLabel: '守护', supportTone: 'scarecrow', statusLabel: '守护中', actionHint: '看范围', yieldLabel: `半径 ${farmBuildingEffects.scarecrowRadiusCells}`, yieldTone: 'scarecrow', yieldStampLabel: '已生效', nextTargetLabel: farmBuildingEffectScarecrowTargetLabel }
      : null,
    farmBuildingEffects.huts > 0
      ? { id: 'hut', label: `小屋 x${farmBuildingEffects.huts}`, value: '每日结算入口已布置', supportLabel: '日结', supportTone: 'home', statusLabel: '可日结', actionHint: '过天结算', yieldLabel: '可过天', yieldTone: 'home', yieldStampLabel: '已生效', nextTargetLabel: `D${farmCanvas?.day || 1}` }
      : null,
  ].filter((item): item is { id: string; label: string; value: string; supportLabel: string; supportTone: string; statusLabel: string; actionHint: string; yieldLabel: string; yieldTone: string; yieldStampLabel: string; nextTargetLabel: string } => Boolean(item));
  const farmBuildingEffectSummaryLabel = farmBuildingEffectItems.length > 0 ? `已生效 ${farmBuildingEffectItems.length} 项` : '';
  const farmBuildingEffectSummaryDetailLabel = farmBuildingEffectItems.map((item) => item.supportLabel).join(' / ');
  const farmBuildingEffectSummaryDetailItems = farmBuildingEffectItems.map((item) => ({ id: item.id, label: item.supportLabel, tone: item.supportTone, yieldLabel: item.yieldLabel, nextTargetLabel: item.nextTargetLabel }));
  const farmBuildingEffectSummaryYieldLabel = farmBuildingEffectSummaryDetailItems.map((item) => `${item.label}：${item.yieldLabel}`).join(' / ');
  const farmBuildingEffectSummaryNextLabel = farmBuildingEffectSummaryDetailItems.map((item) => `${item.label}目标：${item.nextTargetLabel}`).join(' / ');
  const farmBuildingEffectQuestItems = farmBuildingEffectItems.map((item) => {
    const routeTarget: FarmStoryPanelRouteHintTarget = item.supportTone === 'water'
      ? 'water'
      : item.supportTone === 'board' && readyOrderCount > 0
        ? 'ready-order'
        : item.supportTone === 'scarecrow' && scarecrowRiskCount > 0
          ? 'scarecrow-risk'
          : item.supportTone === 'home'
            ? 'day'
            : 'building-yield-summary';
    const routeLabel = farmRouteLabelForTarget(routeTarget);
    const countLabel = routeTarget === 'water'
      ? (dryCount > 0 ? `${dryCount}块` : farmBuildingEffectWaterRefillLabel)
      : routeTarget === 'ready-order'
        ? (readyOrderCount > 0 ? `${readyOrderCount}单` : farmBuildingEffectReadyOrderLabel)
        : routeTarget === 'scarecrow-risk'
          ? (scarecrowRiskCount > 0 ? `${scarecrowRiskCount}处` : farmBuildingEffectScarecrowTargetLabel)
          : routeTarget === 'day'
            ? `第${(farmCanvas?.day || 1) + 1}天`
            : item.nextTargetLabel;
    const actionLabel = routeTarget === 'water'
      ? '去补水'
      : routeTarget === 'ready-order'
        ? '去交订单'
        : routeTarget === 'scarecrow-risk'
          ? '补守护'
          : routeTarget === 'day'
            ? '过一天'
            : '看建效';
    const resourceLabel = item.yieldLabel;
    const title = `建筑任务链：${item.label} · ${actionLabel} · 地图找${routeLabel}${countLabel ? ` · 目标 ${countLabel}` : ''}${resourceLabel ? ` · 收益 ${resourceLabel}` : ''}`;
    return { ...item, routeTarget, routeLabel, countLabel, actionLabel, resourceLabel, title };
  });
  const farmBuildingEffectQuestPrimary = farmBuildingEffectQuestItems.find((item) => item.routeTarget !== 'building-yield-summary') || farmBuildingEffectQuestItems[0];
  const farmBuildingEffectQuestPrimaryTitle = farmBuildingEffectQuestPrimary
    ? `建筑任务链：${farmBuildingEffectQuestPrimary.label} · ${farmBuildingEffectQuestPrimary.actionLabel} · 地图找${farmBuildingEffectQuestPrimary.routeLabel}${farmBuildingEffectQuestPrimary.countLabel ? ` · 目标 ${farmBuildingEffectQuestPrimary.countLabel}` : ''}${farmBuildingEffectQuestPrimary.resourceLabel ? ` · 收益 ${farmBuildingEffectQuestPrimary.resourceLabel}` : ''}`
    : '';
  const handleFarmBuildingEffectQuestRouteHintAction = (item: typeof farmBuildingEffectQuestItems[number] | undefined = farmBuildingEffectQuestPrimary) => {
    if (!item?.routeTarget || !item.routeLabel) return;
    flashFarmBuildingEffectQuestRouteHint('已指路');
    const routeCanvasTarget: FarmFocusActionNextTarget | undefined = item.routeTarget === 'water'
      ? 'water'
      : item.routeTarget === 'ready-order'
        ? 'reward'
        : item.routeTarget === 'scarecrow-risk'
          ? 'scarecrow'
          : item.routeTarget === 'day'
            ? 'day'
            : 'build';
    const farmBuildingEffectQuestRouteTitle = item.title;
    onFollowupCanvasHint?.({
      message: `建筑任务链：${item.routeLabel}${item.countLabel ? ` · 目标 ${item.countLabel}` : ''}${item.resourceLabel ? ` · 收益 ${item.resourceLabel}` : ''}`,
      tone: farmFocusActionCanvasTone(routeCanvasTarget),
      routeTarget: item.routeTarget,
      routeLabel: item.routeLabel,
      routeTitle: farmBuildingEffectQuestRouteTitle,
    });
  };
  const farmPlacementHudReceiptKind = farmPlacementHudReceiptKindFromFeedback(feedback);
  const farmPlacementHudReceiptSource = farmPlacementHudReceiptSourceFromFeedback(feedback);
  const farmPlacementHudReceiptLabel = farmPlacementHudReceiptKind === 'building' ? '收益接入' : farmPlacementHudReceiptKind === 'decor' ? '美化接入' : '';
  const farmPlacementHudReceiptTitle = farmPlacementHudReceiptLabel && farmPlacementHudReceiptSource
    ? `刚刚${farmPlacementHudReceiptSource} · ${farmPlacementHudReceiptLabel}`
    : farmPlacementHudReceiptLabel;
  const farmPlacementHudReceiptActionLabel = farmPlacementHudReceiptKind === 'building' ? '查看收益' : farmPlacementHudReceiptKind === 'decor' ? '看美化' : '';
  const farmPlacementHudReceiptCanvasTone = farmFocusActionCanvasTone(
    farmPlacementHudReceiptKind === 'building' ? 'build' : farmPlacementHudReceiptKind === 'decor' ? 'decor' : undefined
  );
  const farmPlacementHudReceiptCanvasHint = farmPlacementHudReceiptTitle && farmPlacementHudReceiptActionLabel
    ? `${farmPlacementHudReceiptTitle} · ${farmPlacementHudReceiptActionLabel}`
    : farmPlacementHudReceiptTitle;
  const farmMiniBuildingEffectItems = ([
    farmBuildingEffects.wells > 0
      ? {
          id: 'well',
          label: `井${farmBuildingEffects.wells}`,
          title: `水井 ${farmBuildingEffects.wells} · 每日补水到 ${farmBuildingEffects.dailyWaterCapacity}`,
          supportTone: 'water',
          yieldLabel: `水量 ${farmBuildingEffects.dailyWaterCapacity}`,
          nextTargetLabel: farmBuildingEffectWaterRefillLabel,
          icon: Droplets,
        }
      : null,
    farmBuildingEffects.storages > 0
      ? {
          id: 'storage',
          label: `仓${farmBuildingEffects.storages}`,
          title: `仓库 ${farmBuildingEffects.storages} · 库存容量 +${farmBuildingEffects.storageCapacityBonus}`,
          supportTone: 'storage',
          yieldLabel: `容量 +${farmBuildingEffects.storageCapacityBonus}`,
          nextTargetLabel: `+${farmBuildingEffects.storageCapacityBonus}容`,
          icon: Package,
        }
      : null,
    farmBuildingEffects.boards > 0
      ? {
          id: 'board',
          label: `板${farmBuildingEffects.boards}`,
          title: `公告板 ${farmBuildingEffects.boards} · 可交付订单优先显示`,
          supportTone: 'board',
          yieldLabel: '订单优先',
          nextTargetLabel: farmBuildingEffectReadyOrderLabel,
          icon: Flag,
        }
      : null,
    farmBuildingEffects.scarecrows > 0
      ? {
          id: 'scarecrow',
          label: `守${farmBuildingEffects.scarecrows}`,
          title: `稻草人 ${farmBuildingEffects.scarecrows} · 守护半径 ${farmBuildingEffects.scarecrowRadiusCells} 格`,
          supportTone: 'scarecrow',
          yieldLabel: `半径 ${farmBuildingEffects.scarecrowRadiusCells}`,
          nextTargetLabel: farmBuildingEffectScarecrowTargetLabel,
          icon: Hammer,
        }
      : null,
    farmBuildingEffects.huts > 0
      ? {
          id: 'hut',
          label: `屋${farmBuildingEffects.huts}`,
          title: `小屋 ${farmBuildingEffects.huts} · 每日结算入口已布置`,
          supportTone: 'home',
          yieldLabel: '可过天',
          nextTargetLabel: `D${farmCanvas?.day || 1}`,
          icon: Hammer,
        }
      : null,
  ] as Array<{ id: string; label: string; title: string; supportTone: string; yieldLabel: string; nextTargetLabel: string; icon: typeof Sparkles } | null>)
    .filter((item): item is { id: string; label: string; title: string; supportTone: string; yieldLabel: string; nextTargetLabel: string; icon: typeof Sparkles } => Boolean(item));
  const farmMiniBuildingEffectSummaryLabel = farmMiniBuildingEffectItems.map((item) => `${item.label}：${item.yieldLabel}`).join(' / ');
  const farmMiniBuildingEffectTargetLabel = farmMiniBuildingEffectItems.map((item) => `${item.label}目标：${item.nextTargetLabel}`).join(' / ');
  const farmMiniBuildingEffectPrimaryTarget = farmMiniBuildingEffectItems[0];
  const farmMiniBuildingEffectPrimaryTargetLabel = farmMiniBuildingEffectPrimaryTarget ? farmMiniBuildingEffectPrimaryTarget.nextTargetLabel : '';
  const farmMiniBuildingEffectPrimaryTargetTone = farmMiniBuildingEffectPrimaryTarget?.supportTone || '';
  const farmPlacementHudReceiptNextTarget: FarmPlacementHudReceiptNextTarget = farmPlacementHudReceiptKind === 'decor'
    ? 'beauty'
    : farmPlacementHudReceiptKind === 'building'
      ? farmMiniBuildingEffectPrimaryTargetTone === 'water'
        ? 'water'
        : farmMiniBuildingEffectPrimaryTargetTone === 'board' && readyOrderCount > 0
          ? 'ready-order'
          : farmMiniBuildingEffectPrimaryTargetTone === 'scarecrow' && scarecrowRiskCount > 0
            ? 'scarecrow-risk'
            : farmMiniBuildingEffectPrimaryTargetTone === 'home'
              ? 'day'
              : 'building-yield-summary'
      : '';
  const farmPlacementHudReceiptNextLabel = farmPlacementHudReceiptKind === 'building'
    ? (farmMiniBuildingEffectPrimaryTargetLabel ? `追${farmMiniBuildingEffectPrimaryTargetLabel}` : '看收益')
    : farmPlacementHudReceiptKind === 'decor'
      ? (nextBeautyReward ? `差${nextBeautyReward.remainingScore}分` : '满美化')
      : '';
  const farmPlacementHudReceiptNextTitle = farmPlacementHudReceiptKind === 'building'
    ? (farmBuildingEffectSummaryNextLabel ? `收益目标：${farmBuildingEffectSummaryNextLabel}` : '查看建筑收益')
    : farmPlacementHudReceiptKind === 'decor'
      ? (nextBeautyReward ? `下一档美化：${nextBeautyReward.title}，还差 ${nextBeautyReward.remainingScore} 分` : '美化奖励已全部解锁')
      : '';
  const farmPlacementHudReceiptNextTargetTitle = farmPlacementHudReceiptNextTarget && farmPlacementHudReceiptNextTitle
    ? `接入目标：${farmPlacementHudReceiptNextTitle}`
    : '';
  const farmPlacementHudReceiptNextTargetOpened = farmPlacementHudReceiptNextTarget === 'water'
    ? farmWaterToolOpened
    : farmPlacementHudReceiptNextTarget === 'ready-order'
      ? farmOrderLocateOpened
      : farmPlacementHudReceiptNextTarget === 'scarecrow-risk'
        ? farmScarecrowRiskSelected
        : farmPlacementHudReceiptNextTarget === 'day'
          ? farmSummaryOpened
          : farmPlacementHudReceiptNextTarget === 'beauty'
            ? farmBeautyDetailOpened
            : farmPlacementHudReceiptNextTarget === 'building-yield-summary'
              ? farmBuildingEffectOpened
              : false;
  const farmPlacementHudReceiptNextTargetOpenedTitle = farmPlacementHudReceiptNextTargetOpened && farmPlacementHudReceiptNextTitle
    ? `目标已接入：${farmPlacementHudReceiptNextTitle}`
    : '';
  const farmPlacementHudReceiptNextTargetCanvasTarget: FarmFocusActionNextTarget | undefined = farmPlacementHudReceiptNextTarget === 'water'
    ? 'water'
    : farmPlacementHudReceiptNextTarget === 'ready-order'
      ? 'reward'
      : farmPlacementHudReceiptNextTarget === 'scarecrow-risk'
        ? 'scarecrow'
        : farmPlacementHudReceiptNextTarget === 'day'
          ? 'day'
          : farmPlacementHudReceiptNextTarget === 'beauty'
            ? 'decor'
            : farmPlacementHudReceiptNextTarget === 'building-yield-summary'
              ? 'build'
              : undefined;
  const farmPlacementHudReceiptNextTargetOpenedCanvasTone = farmFocusActionCanvasTone(farmPlacementHudReceiptNextTargetCanvasTarget);
  const farmPlacementHudReceiptNextTargetOpenedCanvasHint = farmPlacementHudReceiptNextTargetOpenedTitle
    ? `接入完成：${farmPlacementHudReceiptNextTitle}`
    : '';
  const farmPlacementHudReceiptFollowupLabel = farmPlacementHudReceiptNextTargetOpened
    ? farmPlacementHudReceiptNextTarget === 'water'
      ? '继续补水'
      : farmPlacementHudReceiptNextTarget === 'ready-order'
        ? '去交订单'
        : farmPlacementHudReceiptNextTarget === 'scarecrow-risk'
          ? '补守护'
          : farmPlacementHudReceiptNextTarget === 'day'
            ? '过一天'
            : farmPlacementHudReceiptNextTarget === 'beauty'
              ? '继续美化'
              : farmPlacementHudReceiptNextTarget === 'building-yield-summary'
                ? '看收益'
                : ''
    : '';
  const farmPlacementHudReceiptFollowupTitle = farmPlacementHudReceiptFollowupLabel && farmPlacementHudReceiptNextTitle
    ? `接入完成：${farmPlacementHudReceiptFollowupLabel} · ${farmPlacementHudReceiptNextTitle}`
    : '';
  const farmPlacementHudReceiptFollowupTarget = farmPlacementHudReceiptFollowupLabel ? farmPlacementHudReceiptNextTarget : '';
  const farmPlacementHudReceiptFollowupCountLabel = farmPlacementHudReceiptFollowupTarget === 'water'
    ? dryCount > 0 ? `${dryCount}块` : ''
    : farmPlacementHudReceiptFollowupTarget === 'ready-order'
      ? readyOrderCount > 0 ? `${readyOrderCount}单` : ''
      : farmPlacementHudReceiptFollowupTarget === 'scarecrow-risk'
        ? scarecrowRiskCount > 0 ? `${scarecrowRiskCount}处` : ''
        : farmPlacementHudReceiptFollowupTarget === 'day'
          ? `第${(farmCanvas?.day || 1) + 1}天`
          : farmPlacementHudReceiptFollowupTarget === 'beauty'
            ? nextBeautyReward ? `差${nextBeautyReward.remainingScore}分` : `${farmBeautyScore.score}分`
            : farmPlacementHudReceiptFollowupTarget === 'building-yield-summary'
              ? farmMiniBuildingEffectItems.length > 0 ? `${farmMiniBuildingEffectItems.length}项` : ''
              : '';
  const farmPlacementHudReceiptFollowupResourceLabel = farmPlacementHudReceiptFollowupTarget === 'water'
    ? waterAmount > 0 ? `水量${waterAmount}` : '水量不足'
    : farmPlacementHudReceiptFollowupTarget === 'ready-order'
      ? currentOrderRewardLabel ? `奖励${currentOrderRewardLabel}` : ''
      : farmPlacementHudReceiptFollowupTarget === 'scarecrow-risk'
        ? '木材/石头'
        : farmPlacementHudReceiptFollowupTarget === 'day'
          ? farmMiniBuildingEffectSummaryLabel ? `日结${farmMiniBuildingEffectSummaryLabel}` : ''
          : farmPlacementHudReceiptFollowupTarget === 'beauty'
            ? nextBeautyReward ? `美化${nextBeautyReward.title}` : '美化满级'
            : farmPlacementHudReceiptFollowupTarget === 'building-yield-summary'
              ? farmMiniBuildingEffectPrimaryTarget?.nextTargetLabel ? `目标${farmMiniBuildingEffectPrimaryTarget.nextTargetLabel}` : farmMiniBuildingEffectSummaryLabel
              : '';
  const farmPlacementHudReceiptFollowupRouteLabel = farmPlacementHudReceiptFollowupTarget === 'water'
    ? '地图看缺水'
    : farmPlacementHudReceiptFollowupTarget === 'ready-order'
      ? '地图看订单'
      : farmPlacementHudReceiptFollowupTarget === 'scarecrow-risk'
        ? '地图看守护'
        : farmPlacementHudReceiptFollowupTarget === 'day'
          ? '回看日结'
          : farmPlacementHudReceiptFollowupTarget === 'beauty'
            ? '地图看美化'
            : farmPlacementHudReceiptFollowupTarget === 'building-yield-summary'
              ? '地图看建效'
              : '';
  const farmPlacementHudReceiptFollowupRouteTitle = farmPlacementHudReceiptFollowupRouteLabel
    ? `路线指引：${farmPlacementHudReceiptFollowupRouteLabel}${farmPlacementHudReceiptFollowupCountLabel ? ` · 目标 ${farmPlacementHudReceiptFollowupCountLabel}` : ''}${farmPlacementHudReceiptFollowupResourceLabel ? ` · 预期 ${farmPlacementHudReceiptFollowupResourceLabel}` : ''}`
    : '';
  const farmPlacementFollowupActionBusy = Boolean(farmPlacementFollowupActionReceipt);

  useEffect(() => {
    if (!farmPlacementHudReceiptNextTargetOpenedCanvasHint || !onFollowupCanvasHint) {
      farmPlacementReceiptCanvasHintKeyRef.current = '';
      return;
    }
    const canvasHintKey = `${farmPlacementHudReceiptKind}:${farmPlacementHudReceiptSource}:${farmPlacementHudReceiptNextTarget}:${farmPlacementHudReceiptNextTargetOpenedCanvasHint}`;
    if (farmPlacementReceiptCanvasHintKeyRef.current === canvasHintKey) return;
    farmPlacementReceiptCanvasHintKeyRef.current = canvasHintKey;
    onFollowupCanvasHint({
      message: farmPlacementHudReceiptNextTargetOpenedCanvasHint,
      tone: farmPlacementHudReceiptNextTargetOpenedCanvasTone,
    });
  }, [
    farmPlacementHudReceiptKind,
    farmPlacementHudReceiptNextTarget,
    farmPlacementHudReceiptSource,
    farmPlacementHudReceiptNextTargetOpenedCanvasHint,
    farmPlacementHudReceiptNextTargetOpenedCanvasTone,
    onFollowupCanvasHint,
  ]);

  const farmMiniBuildingEffectTitleLabel = `建筑收益：${farmMiniBuildingEffectSummaryLabel || '暂无'}；目标：${farmMiniBuildingEffectTargetLabel || '暂无'}`;
  const currentWeather = farmCanvas?.weather || 'sunny';
  const weatherTitle = farmCanvas?.festivalId
    ? `${farmWeatherLabel(currentWeather)} · ${farmCanvas.festivalId}`
    : farmWeatherLabel(currentWeather);
  const MiniWeatherIcon = farmWeatherIcon(currentWeather);
  const stats: Array<{ label: string; value: string; icon: typeof CalendarDays; title?: string }> = [
    { label: 'Day', value: String(farmCanvas?.day || 1), icon: CalendarDays },
    { label: 'Season', value: farmSeasonShortLabel(currentSeason), icon: Sprout, title: seasonDefinition.label },
    { label: 'Weather', value: farmWeatherShortLabel(currentWeather), icon: farmWeatherIcon(currentWeather), title: weatherTitle },
    { label: 'Gold', value: String(farmCanvas?.resources.gold || 0), icon: Coins },
    { label: 'Seed', value: String(totalSeedCount), icon: Package },
    { label: 'Animal', value: String(totalAnimalProducts), icon: PawPrint, title: animalProductSummary },
    { label: 'Wood', value: String(woodAmount), icon: Wheat },
  ];
  const MiniQuickActionIcon = farmMiniQuickActionFeedback?.icon || Sparkles;
  const farmMiniQuickActionResourceTargets = farmMiniActionResourceTargets(farmMiniQuickActionFeedback);
  const farmMiniQuickActionResourceFeedbackLabel = farmMiniResourceFeedbackLabel(farmMiniQuickActionResourceTargets, farmMiniQuickActionFeedback);
  const farmMiniQuickActionActivityFeedbackLabel = farmMiniActivityFeedbackLabel(farmMiniQuickActionFeedback);
  const farmMiniQuickActionSummaryLabel = buildFarmMiniQuickActionSummaryLabel(farmMiniQuickActionFeedback, {
    resourceLabel: farmMiniQuickActionResourceFeedbackLabel,
    activityLabel: farmMiniQuickActionActivityFeedbackLabel,
    focusTitle: primaryFarmFocus?.title,
  });
  const primaryFarmFocusActionResourceTargets = primaryFarmFocus?.action ? farmActionResourceTargets(primaryFarmFocus.action) : [];
  const primaryFarmFocusActionResourcePreview = farmActionResourcePreviewLabel(primaryFarmFocusActionResourceTargets);
  const farmMiniFocusActionBaseLabel = primaryFarmFocus?.actionLabel || primaryFarmFocusActionLabel;
  const primaryFarmFocusNextProgress = primaryFarmFocus ? Math.min(primaryFarmFocus.target, primaryFarmFocus.progress + 1) : 0;
  const primaryFarmFocusNextPercent = primaryFarmFocus ? Math.round((primaryFarmFocusNextProgress / Math.max(1, primaryFarmFocus.target)) * 100) : 0;
  const primaryFarmFocusProgressPreview = primaryFarmFocus
    ? primaryFarmFocusComplete ? '已完成' : `预计：${primaryFarmFocusNextProgress}/${primaryFarmFocus.target}`
    : '';
  const farmActivityEmptyForecastReceiptProgressState = primaryFarmFocusComplete
    ? 'complete'
    : primaryFarmFocusReady
      ? 'ready'
      : primaryFarmFocusProgressPreview
        ? 'next'
        : undefined;
  const farmActivityEmptyForecastReceiptProgressStateLabel = farmActivityEmptyForecastReceiptProgressState === 'complete'
    ? '完成'
    : farmActivityEmptyForecastReceiptProgressState === 'ready'
      ? '可做'
      : farmActivityEmptyForecastReceiptProgressState === 'next'
        ? '预计'
        : '';
  const farmActivityEmptyForecastReceiptNextHint = primaryFarmFocus?.action
    ? farmFocusActionNextHint(primaryFarmFocus.action)
    : '';
  const farmActivityEmptyForecastReceiptNextTarget = primaryFarmFocus?.action
    ? farmFocusActionNextTarget(primaryFarmFocus.action)
    : undefined;
  const farmActivityEmptyForecastReceiptNextTargetLabel = farmFocusActionNextTargetLabel(farmActivityEmptyForecastReceiptNextTarget);
  const farmActivityEmptyForecastReceiptNextBadgeLabel = primaryFarmFocus?.action
    ? farmFocusActionNextBadgeLabel(primaryFarmFocus.action)
    : '';
  const farmActivityEmptyForecastReceiptNextBadgeTitle = farmActivityEmptyForecastReceiptNextBadgeLabel
    ? `行动 ${farmActivityEmptyForecastReceiptNextBadgeLabel}`
    : '';
  const farmActivityEmptyForecastReceiptNextCountLabel = primaryFarmFocus?.action
    ? farmFocusActionNextCountLabel(primaryFarmFocus.action, {
        dryCount,
        witheredCount,
        matureCount,
        scarecrowRiskCount,
        readyOrderCount,
        readyNpcVisitCount,
      })
    : '';
  const farmActivityEmptyForecastReceiptNextCountTitle = farmActivityEmptyForecastReceiptNextCountLabel
    ? `目标 ${farmActivityEmptyForecastReceiptNextCountLabel}`
    : '';
  const farmNpcDeliveryReceiptNextFocus = farmNpcDeliveryActive && activeNpcVisit
    ? farmFocusGoals.find((goal) => !(goal.action.kind === 'complete-npc' && goal.action.visitId === activeNpcVisit.id)) || primaryFarmFocus
    : primaryFarmFocus;
  const farmNpcDeliveryReceiptRewardLabel = activeNpcVisit ? formatFarmReward(activeNpcVisit.rewards) : '';
  const farmNpcDeliveryReceiptNextLabel = farmMiniFocusActionLabel(farmNpcDeliveryReceiptNextFocus) || farmNpcDeliveryReceiptNextFocus?.actionLabel || '';
  const farmNpcDeliveryReceiptNextHint = farmNpcDeliveryReceiptNextFocus?.action
    ? farmFocusActionNextHint(farmNpcDeliveryReceiptNextFocus.action)
    : '';
  const farmNpcDeliveryReceiptNextCountLabel = farmNpcDeliveryReceiptNextFocus?.action
    ? farmFocusActionNextCountLabel(farmNpcDeliveryReceiptNextFocus.action, {
        dryCount,
        witheredCount,
        matureCount,
        scarecrowRiskCount,
        readyOrderCount,
        readyNpcVisitCount,
      })
    : '';
  const farmNpcDeliveryReceiptNextTarget = farmNpcDeliveryReceiptNextFocus?.action
    ? farmFocusActionNextTarget(farmNpcDeliveryReceiptNextFocus.action)
    : undefined;
  const farmNpcDeliveryReceiptCanvasTone = farmFocusActionCanvasTone(farmNpcDeliveryReceiptNextTarget);
  const farmNpcDeliveryReceiptRouteTarget = farmNpcDeliveryReceiptNextFocus?.action ? farmRouteTargetForFocusAction(farmNpcDeliveryReceiptNextFocus.action) : undefined;
  const farmNpcDeliveryReceiptRouteLabel = farmRouteLabelForTarget(farmNpcDeliveryReceiptRouteTarget);
  const farmNpcDeliveryReceiptRouteTitle = farmNpcDeliveryReceiptRouteLabel
    ? `路线指引：${farmNpcDeliveryReceiptRouteLabel}${farmNpcDeliveryReceiptNextCountLabel ? ` · 目标 ${farmNpcDeliveryReceiptNextCountLabel}` : ''}${farmNpcDeliveryReceiptNextHint ? ` · ${farmNpcDeliveryReceiptNextHint}` : ''}`
    : '';
  const farmNpcDeliveryReceiptTitle = farmNpcDeliveryActive && activeNpcVisit
    ? [
        `谢礼入袋：${activeNpcVisit.visitorName}`,
        farmNpcDeliveryReceiptRewardLabel ? `奖励 ${farmNpcDeliveryReceiptRewardLabel}` : '',
        farmNpcDeliveryReceiptNextLabel ? `下一步 ${farmNpcDeliveryReceiptNextLabel}` : '',
        farmNpcDeliveryReceiptNextCountLabel ? `目标 ${farmNpcDeliveryReceiptNextCountLabel}` : '',
      ].filter(Boolean).join(' · ')
    : '';
  const farmNpcBond = farmNpcBondPreview(activeNpcVisit, farmCanvas);
  const farmNpcBondMilestone = farmNpcBondMilestoneReward(activeNpcVisit, farmCanvas);
  const farmNpcReturnPromise = farmNpcReturnPromisePreview(activeNpcVisit, farmCanvas);
  const farmNpcPrepHint = farmNpcPrepHintPreview(activeNpcVisit, farmCanvas, npcVisitReady);
  const handleFarmNpcPrepHintAction = () => {
    if (!farmNpcPrepHint || !activeNpcVisit) return;
    onFollowupCanvasHint?.({
      message: `来访备货：${farmNpcPrepHint.statusLabel} · ${farmNpcPrepHint.actionLabel}${farmNpcPrepHint.routeLabel ? ` · ${farmNpcPrepHint.routeLabel}` : ''}`,
      tone: farmNpcPrepHint.tone === 'ready' ? 'reward' : farmNpcPrepHint.tone === 'water' ? 'water' : 'success',
      routeTarget: farmNpcPrepHint.routeTarget,
      routeLabel: farmNpcPrepHint.routeLabel || undefined,
      routeTitle: farmNpcPrepHint.title,
    });
    if (farmNpcPrepHint.action === 'deliver') {
      if (!farmNpcDeliveryActive && npcVisitReady) {
        flashFarmNpcDelivery(activeNpcVisit.id);
        onCompleteNpcVisit?.(activeNpcVisit.id);
      }
      return;
    }
    if (farmNpcPrepHint.action === 'harvest') {
      onJumpToMature?.();
      return;
    }
    if (farmNpcPrepHint.action === 'water') {
      onSelectTool?.('water');
      return;
    }
    if (farmNpcPrepHint.action === 'plant') {
      onSelectTool?.('seed');
      return;
    }
    if (farmNpcPrepHint.action === 'wait-day') {
      onAdvanceDay?.();
      return;
    }
    if (farmNpcPrepHint.action === 'animal') {
      handleOpenFarmAnimals();
    }
  };
  const handleFarmNpcDeliveryReceiptRouteHint = () => {
    if (!farmNpcDeliveryReceiptRouteTarget || !farmNpcDeliveryReceiptRouteLabel) return;
    onFollowupCanvasHint?.({
      message: `来访谢礼路线：${farmNpcDeliveryReceiptRouteLabel}${farmNpcDeliveryReceiptNextCountLabel ? ` · 目标 ${farmNpcDeliveryReceiptNextCountLabel}` : ''}${farmNpcDeliveryReceiptNextHint ? ` · ${farmNpcDeliveryReceiptNextHint}` : ''}`,
      tone: farmNpcDeliveryReceiptCanvasTone,
      routeTarget: farmNpcDeliveryReceiptRouteTarget,
      routeLabel: farmNpcDeliveryReceiptRouteLabel,
      routeTitle: farmNpcDeliveryReceiptRouteTitle,
    });
  };
  const farmActivityEmptyForecastReceiptNextAccessibleTypeLabel = farmActivityEmptyForecastReceiptNextTargetLabel
    ? `类型 ${farmActivityEmptyForecastReceiptNextTargetLabel}`
    : '';
  const farmActivityEmptyForecastReceiptNextAccessibleHint = [
    farmActivityEmptyForecastReceiptNextAccessibleTypeLabel,
    farmActivityEmptyForecastReceiptNextHint,
    farmActivityEmptyForecastReceiptNextCountLabel ? `目标 ${farmActivityEmptyForecastReceiptNextCountLabel}` : '',
  ].filter(Boolean).join('，');
  const farmActivityEmptyForecastReceiptNextTypeTitle = [
    farmActivityEmptyForecastReceiptNextAccessibleTypeLabel,
    farmActivityEmptyForecastReceiptNextHint ? `下一步 ${farmActivityEmptyForecastReceiptNextHint}` : '',
    farmActivityEmptyForecastReceiptNextCountLabel ? `目标 ${farmActivityEmptyForecastReceiptNextCountLabel}` : '',
  ].filter(Boolean).join(' · ');
  const farmActivityEmptyForecastReceiptNextTypeCountTitle = [
    farmActivityEmptyForecastReceiptNextCountTitle,
    farmActivityEmptyForecastReceiptNextAccessibleTypeLabel,
    farmActivityEmptyForecastReceiptNextHint ? `下一步 ${farmActivityEmptyForecastReceiptNextHint}` : '',
  ].filter(Boolean).join(' · ');
  const farmActivityEmptyForecastReceiptNextCopyTitle = farmActivityEmptyForecastReceiptNextHint
    ? farmActivityEmptyForecastReceiptNextTargetLabel
      ? `下一步 ${farmActivityEmptyForecastReceiptNextTargetLabel}：${farmActivityEmptyForecastReceiptNextHint}`
      : `下一步 ${farmActivityEmptyForecastReceiptNextHint}`
    : '';
  const farmActivityEmptyForecastReceiptLabel = farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel;
  const farmActivityEmptyForecastReceiptDetails = [
    farmMiniQuickActionResourceFeedbackLabel ? `资源：${farmMiniQuickActionResourceFeedbackLabel}` : '',
    farmMiniQuickActionActivityFeedbackLabel ? `今日：${farmMiniQuickActionActivityFeedbackLabel}` : '',
    primaryFarmFocusProgressPreview ? `进度：${farmActivityEmptyForecastReceiptProgressStateLabel ? `${farmActivityEmptyForecastReceiptProgressStateLabel} ` : ''}${primaryFarmFocusProgressPreview}` : '',
    farmActivityEmptyForecastReceiptNextAccessibleHint ? farmActivityEmptyForecastReceiptNextAccessibleHint : '',
  ].filter(Boolean);
  const farmActivityEmptyForecastReceiptTitle = farmActivityEmptyForecastReceiptDetails.length > 0
    ? `预期已确认：${farmActivityEmptyForecastReceiptLabel} · ${farmActivityEmptyForecastReceiptDetails.join(' · ')}`
    : `预期已确认：${farmActivityEmptyForecastReceiptLabel}`;
  const primaryFarmFocusForecastItems = [
    primaryFarmFocus?.actionLabel
      ? { id: 'action', tone: 'action', label: `下一步：${primaryFarmFocus.actionLabel}`, actionable: true }
      : null,
    primaryFarmFocusActionResourcePreview
      ? { id: 'resource', tone: 'resource', label: primaryFarmFocusActionResourcePreview }
      : null,
    primaryFarmFocusProgressPreview
      ? { id: 'progress', tone: 'progress', label: primaryFarmFocusProgressPreview }
      : null,
  ].filter((item): item is { id: string; tone: 'action' | 'resource' | 'progress'; label: string; actionable?: boolean } => Boolean(item));
  const farmActivityEmptyForecastLabels = primaryFarmFocusForecastItems.map((item) => item.label);
  const farmActivityEmptyForecastText = farmActivityEmptyForecastLabels.join('、');
  const farmActivityEmptyForecastAccessibleText = farmActivityEmptyForecastLabels.join('，');
  const farmActivityEmptyForecastBusyLabel = farmMiniQuickActionBusy
    ? farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel
    : '';
  const farmActivityEmptyForecastBusyMetaLabel = farmMiniQuickActionBusy
    ? [primaryFarmFocusActionResourcePreview, primaryFarmFocusProgressPreview].filter(Boolean).join(' · ')
    : '';
  const farmActivityEmptyForecastBusyMetaStateLabel = farmActivityEmptyForecastBusyMetaLabel && farmActivityEmptyForecastReceiptProgressStateLabel
    ? farmActivityEmptyForecastReceiptProgressStateLabel
    : '';
  const farmActivityEmptyForecastBusyMetaAccessibleLabel = [farmActivityEmptyForecastBusyMetaStateLabel, farmActivityEmptyForecastBusyMetaLabel].filter(Boolean).join(' · ');
  const farmActivityEmptyForecastBusyMetaAriaLabel = [farmActivityEmptyForecastBusyMetaStateLabel, farmActivityEmptyForecastBusyMetaLabel].filter(Boolean).join('，');
  const farmActivityEmptyForecastBusyMetaTitleSuffix = farmActivityEmptyForecastBusyMetaAccessibleLabel ? ` · ${farmActivityEmptyForecastBusyMetaAccessibleLabel}` : '';
  const farmActivityEmptyForecastBusyMetaAriaSuffix = farmActivityEmptyForecastBusyMetaAriaLabel ? `，${farmActivityEmptyForecastBusyMetaAriaLabel}` : '';
  const farmActivityEmptyForecastActionProgressTitleSuffix = primaryFarmFocusProgressPreview
    ? farmActivityEmptyForecastReceiptProgressStateLabel
      ? ` · ${farmActivityEmptyForecastReceiptProgressStateLabel} ${primaryFarmFocusProgressPreview}`
      : ` · ${primaryFarmFocusProgressPreview}`
    : '';
  const farmActivityEmptyForecastActionProgressAriaSuffix = primaryFarmFocusProgressPreview
    ? farmActivityEmptyForecastReceiptProgressStateLabel
      ? `，${farmActivityEmptyForecastReceiptProgressStateLabel}${primaryFarmFocusProgressPreview}`
      : `，${primaryFarmFocusProgressPreview}`
    : '';
  const farmActivityEmptyForecastActionProgressValueTitle = primaryFarmFocusProgressPreview
    ? farmActivityEmptyForecastReceiptProgressStateLabel
      ? `进度 ${farmActivityEmptyForecastReceiptProgressStateLabel} ${primaryFarmFocusProgressPreview}`
      : `进度 ${primaryFarmFocusProgressPreview}`
    : '';
  const farmActivityEmptyForecastTitle = farmActivityEmptyForecastBusyLabel
    ? `空状态小目标预期正在执行：${farmActivityEmptyForecastBusyLabel}${farmActivityEmptyForecastBusyMetaTitleSuffix} · ${farmActivityEmptyForecastText}`
    : `空状态小目标预期：${farmActivityEmptyForecastText}`;
  const farmActivityEmptyForecastAriaLabel = farmActivityEmptyForecastBusyLabel
    ? `空状态小目标预期正在执行：${farmActivityEmptyForecastBusyLabel}${farmActivityEmptyForecastBusyMetaAriaSuffix}，${farmActivityEmptyForecastAccessibleText}`
    : `空状态小目标预期：${farmActivityEmptyForecastAccessibleText}`;
  const farmMiniFocusActionResourceSuffix = primaryFarmFocusActionResourcePreview ? ` · ${primaryFarmFocusActionResourcePreview}` : '';
  const farmMiniFocusActionProgressSuffix = primaryFarmFocusProgressPreview ? ` · ${primaryFarmFocusProgressPreview}` : '';
  const farmMiniFocusActionTitle = farmMiniQuickActionBusy
    ? `刚刚执行：${farmMiniQuickActionSummaryLabel || farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel}${farmMiniFocusActionResourceSuffix}${farmMiniFocusActionProgressSuffix}`
    : `下一步：${farmMiniFocusActionBaseLabel}${farmMiniFocusActionResourceSuffix}${farmMiniFocusActionProgressSuffix}`;
  const farmMiniFocusActionAriaLabel = farmMiniQuickActionBusy
    ? `刚刚执行：${farmMiniQuickActionSummaryLabel || farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel}${farmMiniFocusActionResourceSuffix}${farmMiniFocusActionProgressSuffix}`
    : `执行今日小目标：${farmMiniFocusActionBaseLabel}${farmMiniFocusActionResourceSuffix}${farmMiniFocusActionProgressSuffix}`;
  const farmMiniQuickActionDetailItems = ([
    {
      id: 'result',
      label: farmMiniQuickActionFeedback?.label,
      title: '结果',
    },
    {
      id: 'resource',
      label: farmMiniQuickActionResourceFeedbackLabel,
      title: '资源',
    },
    {
      id: 'activity',
      label: farmMiniQuickActionActivityFeedbackLabel,
      title: '今日',
    },
    {
      id: 'focus',
      label: primaryFarmFocus?.title,
      title: '小目标',
      action: primaryFarmFocus?.action,
      actionLabel: primaryFarmFocusActionLabel ? `继续${primaryFarmFocusActionLabel}` : '继续小目标',
      actionKind: primaryFarmFocus?.action ? farmSummaryDetailActionKind(primaryFarmFocus.action) : undefined,
      actionResourceTargets: primaryFarmFocusActionResourceTargets,
      actionResourcePreview: primaryFarmFocusActionResourcePreview,
    },
  ] as Array<{
    id: string;
    label?: string;
    title: string;
    action?: FarmFocusGoalAction;
    actionLabel?: string;
    actionKind?: FarmSummaryDetailActionKind;
    actionResourceTargets?: FarmActionResourceTarget[];
    actionResourcePreview?: string;
  }>).filter(
    (item): item is {
      id: string;
      label: string;
      title: string;
      action?: FarmFocusGoalAction;
      actionLabel?: string;
      actionKind?: FarmSummaryDetailActionKind;
      actionResourceTargets?: FarmActionResourceTarget[];
      actionResourcePreview?: string;
    } => Boolean(item.label),
  );
  const farmMiniQuickActionReceiptItems = farmMiniQuickActionDetailItems.filter((item) => item.id !== 'result');
  const primaryActivity = farmActivityFeed.items[0];
  const farmLiveFeedbackItems: FarmLiveFeedbackItem[] = ([
    feedback ? { id: 'current-feedback', kind: 'action', label: compactFarmHudFeedback(feedback), icon: Sparkles } : null,
    farmRewardBursts[0] ? { id: `reward-${farmRewardBursts[0].id}`, kind: 'reward', rewardKind: farmRewardBursts[0].kind, rewardKindLabel: farmRewardKindLabel(farmRewardBursts[0].kind), label: compactFarmHudFeedback(farmRewardBursts[0].label), icon: farmRewardBurstIcon(farmRewardBursts[0].kind) } : null,
    witheredCount > 0
      ? {
          id: 'withered-crops',
          kind: 'cleanup',
          label: `枯萎作物 x${witheredCount}`,
          icon: Shovel,
          action: { kind: 'select-tool', tool: 'shovel' },
          actionLabel: '切到铲子',
        }
      : null,
    dryCount > 0
      ? {
          id: 'dry-crops',
          kind: 'water',
          label: `缺水作物 x${dryCount}`,
          icon: Droplets,
          action: { kind: 'select-tool', tool: 'water' },
          actionLabel: '切到水壶',
        }
      : null,
    scarecrowRiskCount > 0
      ? {
          id: 'scarecrow-risk-build',
          kind: 'build',
          label: `补稻草人 x${scarecrowRiskCount}`,
          icon: Hammer,
          action: { kind: 'select-building', buildingId: 'scarecrow' },
          actionLabel: '选择稻草人',
        }
      : null,
    orderReady && currentOrder
      ? {
          id: `order-${currentOrder.id}`,
          kind: 'ready',
          label: compactFarmHudFeedback(`订单可交付：${currentOrder.title}`),
          icon: Package,
          action: { kind: 'complete-order', orderId: currentOrder.id },
          actionLabel: '交付订单',
        }
      : null,
    npcVisitReady && activeNpcVisit
      ? {
          id: `npc-${activeNpcVisit.id}`,
          kind: 'quest',
          label: compactFarmHudFeedback(`来访可交付：${activeNpcVisit.visitorName}`),
          icon: UserRound,
          action: { kind: 'complete-npc', visitId: activeNpcVisit.id },
          actionLabel: '交付来访',
        }
      : null,
    matureCount > 0
      ? {
          id: 'mature-crops',
          kind: 'mature',
          label: `成熟作物 x${matureCount}`,
          icon: Wheat,
          action: { kind: 'jump-mature' },
          actionLabel: '定位成熟作物',
        }
      : null,
    primaryActivity
      ? {
          id: `activity-${primaryActivity.id}`,
          kind: 'action',
          label: compactFarmHudFeedback(`${primaryActivity.title}${primaryActivity.amountLabel ? ` ${primaryActivity.amountLabel}` : ''}`),
          icon: Sparkles,
        }
      : null,
  ] as Array<FarmLiveFeedbackItem | null>)
    .filter((item): item is FarmLiveFeedbackItem => Boolean(item && item.label))
    .filter((item, index, items) => items.findIndex((other) => other.label === item.label) === index)
    .slice(0, 4);
  const farmLiveFeedbackCompletionNotice = farmLiveFeedbackCompletionReceipt &&
    farmSummaryDetailActionFeedbackItemId === farmLiveFeedbackCompletionReceipt.itemId &&
    Boolean(farmSummaryDetailActionFeedback)
    ? farmLiveFeedbackCompletionReceipt
    : null;
  const farmSummaryActions: FarmSummaryActionItem[] = ([
    dailySummary && matureCount > 0
      ? {
          id: 'summary-jump-mature',
          label: `定位成熟 ${matureCount}`,
          title: '跳转到成熟作物并准备收获',
          tone: 'mature',
          icon: Wheat,
          action: { kind: 'jump-mature' },
        }
      : null,
    dailySummary && dailySummary.dryCrops > 0
      ? {
          id: 'summary-water-dry',
          label: `浇水 ${dailySummary.dryCrops}`,
          title: '切换浇水工具，照料缺水作物',
          tone: 'water',
          icon: Droplets,
          action: { kind: 'select-tool', tool: 'water' },
        }
      : null,
    dailySummary && dailySummary.witheredCrops > 0
      ? {
          id: 'summary-cleanup-withered',
          label: `铲除 ${dailySummary.witheredCrops}`,
          title: '切换铲除工具，清理枯萎作物后重新播种',
          tone: 'cleanup',
          icon: Shovel,
          action: { kind: 'select-tool', tool: 'shovel' },
        }
      : null,
    dailySummary && scarecrowRiskCount > 0
      ? {
          id: 'summary-scarecrow-risk',
          label: `补稻草人 ${scarecrowRiskCount}`,
          title: `选择稻草人，守护 ${scarecrowRiskCount} 块缺水作物`,
          tone: 'build',
          icon: Hammer,
          action: { kind: 'select-building', buildingId: 'scarecrow' },
        }
      : null,
    dailySummary && dailySummary.readyOrders > 0 && orderReady && currentOrder
      ? {
          id: `summary-order-${currentOrder.id}`,
          label: `交付订单 ${dailySummary.readyOrders}`,
          title: `交付订单：${currentOrder.title}`,
          tone: 'ready',
          icon: Package,
          action: { kind: 'complete-order', orderId: currentOrder.id },
        }
      : null,
    dailySummary && dailySummary.readyNpcVisits > 0 && npcVisitReady && activeNpcVisit
      ? {
          id: `summary-npc-${activeNpcVisit.id}`,
          label: `交付来访 ${dailySummary.readyNpcVisits}`,
          title: `交付来访委托：${activeNpcVisit.visitorName}`,
          tone: 'quest',
          icon: UserRound,
          action: { kind: 'complete-npc', visitId: activeNpcVisit.id },
        }
      : null,
  ] as Array<FarmSummaryActionItem | null>).filter((item): item is FarmSummaryActionItem => Boolean(item));
  const farmSummaryActionReceipt = farmSummaryDetailActionFeedback
    ? farmSummaryActions.find((action) => action.id === farmSummaryDetailActionFeedbackItemId)
    : undefined;
  const farmSummaryActionReceiptResourceTargets = farmSummaryActionReceipt
    ? farmActionResourceTargets(farmSummaryActionReceipt.action)
    : [];
  const farmSummaryActionReceiptResourceLabel = farmSummaryActionReceipt
    ? farmActionResourcePreviewLabel(farmSummaryActionReceiptResourceTargets).replace('预期：', '')
    : '';
  const farmSummaryActionReceiptTitle = farmSummaryActionReceipt
    ? `每日总结刚执行：${farmSummaryDetailActionFeedback}${farmSummaryActionReceiptResourceLabel ? ` · ${farmSummaryActionReceiptResourceLabel}` : ''}`
    : '';
  const farmSummaryActionReceiptNextHintText = farmSummaryActionReceipt
    ? farmSummaryActionReceiptNextHint(farmSummaryActionReceipt)
    : '';
  const farmSummaryActionReceiptNextBadgeText = farmSummaryActionReceipt
    ? farmSummaryActionReceiptNextBadgeLabel(farmSummaryActionReceipt)
    : '';
  const farmSummaryActionReceiptNextCountText = farmSummaryActionReceipt
    ? farmSummaryActionReceiptNextCountLabel(farmSummaryActionReceipt, {
        dryCount,
        witheredCount,
        matureCount,
        scarecrowRiskCount,
        readyOrderCount,
        readyNpcVisitCount,
      })
    : '';
  const farmSummaryActionReceiptNextAccessibleHint = farmSummaryActionReceiptNextCountText
    ? `${farmSummaryActionReceiptNextHintText}，目标 ${farmSummaryActionReceiptNextCountText}`
    : farmSummaryActionReceiptNextHintText;
  const farmSummaryActionReceiptAccessibleTitle = farmSummaryActionReceiptNextAccessibleHint
    ? `${farmSummaryActionReceiptTitle}，${farmSummaryActionReceiptNextAccessibleHint}`
    : farmSummaryActionReceiptTitle;
  const farmPanelSectionItems: Array<{ id: FarmPanelSectionId; label: string; summary: string; icon: typeof Sparkles }> = [
    { id: 'feedback', label: '短反馈', summary: farmLiveFeedbackItems.length > 0 ? `${farmLiveFeedbackItems.length}条` : '暂无', icon: Sparkles },
    { id: 'season', label: '季节天气', summary: `${seasonDefinition.label} · ${weatherTitle}`, icon: CloudSun },
    { id: 'focus', label: '今日目标', summary: primaryFarmFocus ? `${primaryFarmFocus.progress}/${primaryFarmFocus.target}` : '暂无', icon: Flag },
    { id: 'beauty', label: '美化奖励', summary: `${farmBeautyScore.score}/100`, icon: ImageIcon },
    { id: 'guide', label: '新手手账', summary: `${farmTutorialCompletedCount}/${farmTutorialSteps.length}步`, icon: Package },
    { id: 'tools', label: '工具栏', summary: selectedToolOption.label, icon: Grid2X2 },
    { id: 'build', label: '建造装饰', summary: selectedBuildingDefinition.label, icon: Hammer },
    { id: 'building', label: '建筑收益', summary: farmMiniBuildingEffectSummaryLabel || '暂无', icon: Hammer },
    { id: 'animals', label: '动物小屋', summary: animalCount > 0 ? `${animalCount}只` : '暂无', icon: PawPrint },
    { id: 'visits', label: '订单来访', summary: `订单 ${readyOrderCount} · 来访 ${readyNpcVisitCount}`, icon: UserRound },
    { id: 'summary', label: '每日总结', summary: dailySummary ? `第${dailySummary.toDay}天` : '暂无', icon: CalendarDays },
    { id: 'activity', label: '最近农活', summary: farmActivityDigest.badgeLabel, icon: Wheat },
    { id: 'actions', label: '底部操作', summary: '成熟 / 过天 / 交单', icon: Sparkles },
  ];
  const farmMonitorBriefPrimary = dryCount > 0
    ? `缺水 ${dryCount}`
    : readyOrderCount > 0
      ? `订单 ${readyOrderCount}`
      : readyNpcVisitCount > 0
        ? `来访 ${readyNpcVisitCount}`
        : matureCount > 0
          ? `成熟 ${matureCount}`
          : scarecrowRiskCount > 0
            ? `守护 ${scarecrowRiskCount}`
            : primaryFarmFocus
              ? primaryFarmFocus.title
              : '牧场稳定';
  const farmMonitorBriefSecondary = farmDailyRouteCompleteReceipt
    ? '路线完成'
    : primaryFarmFocusActionLabel
      ? `下一步 ${primaryFarmFocusActionLabel}`
      : farmActivityDigest.rewardStreakLabel || farmActivityDigest.badgeLabel || `${seasonDefinition.label} · ${weatherTitle}`;
  const farmMonitorBriefTone: FarmMonitorPriorityTone = dryCount > 0
    ? 'water'
    : readyOrderCount > 0
      ? 'order'
      : readyNpcVisitCount > 0
        ? 'visit'
        : matureCount > 0
          ? 'mature'
          : scarecrowRiskCount > 0
            ? 'guard'
            : primaryFarmFocus
              ? 'focus'
              : 'stable';
  const farmMonitorBriefToneLabel = farmMonitorBriefTone === 'water'
    ? '补水'
    : farmMonitorBriefTone === 'order'
      ? '交单'
      : farmMonitorBriefTone === 'visit'
        ? '来访'
        : farmMonitorBriefTone === 'mature'
          ? '收获'
          : farmMonitorBriefTone === 'guard'
            ? '守护'
            : farmMonitorBriefTone === 'focus'
              ? '目标'
              : '稳定';
  const farmMonitorBriefCount = dryCount > 0
    ? dryCount
    : readyOrderCount > 0
      ? readyOrderCount
      : readyNpcVisitCount > 0
        ? readyNpcVisitCount
        : matureCount > 0
          ? matureCount
          : scarecrowRiskCount > 0
            ? scarecrowRiskCount
            : primaryFarmFocus
              ? primaryFarmFocus.progress
              : farmActivityDigest.todayTotal;
  const farmMonitorBriefSection: FarmPanelSectionId = farmMonitorBriefTone === 'water'
    ? 'tools'
    : farmMonitorBriefTone === 'order' || farmMonitorBriefTone === 'visit'
      ? 'visits'
      : farmMonitorBriefTone === 'mature'
        ? 'actions'
        : farmMonitorBriefTone === 'guard'
          ? 'build'
          : farmMonitorBriefTone === 'stable'
            ? 'activity'
            : 'focus';
  const farmMonitorBriefProgressLabel = primaryFarmFocus
    ? `${primaryFarmFocus.progress}/${primaryFarmFocus.target}`
    : farmDailyRouteCompleteReceipt
      ? '已完成'
      : farmActivityDigest.badgeLabel || `${farmActivityDigest.todayTotal}条`;
  const farmMonitorBriefSectionLabel = farmPanelSectionItems.find((item) => item.id === farmMonitorBriefSection)?.label || '今日目标';
  const farmMonitorBriefTitle = `今日提醒：${farmMonitorBriefPrimary} · ${farmMonitorBriefSecondary} · ${farmMonitorBriefToneLabel} · ${farmMonitorBriefProgressLabel}`;
  const farmQuickPanelToggleBadge = panelOpen ? '收起' : farmMonitorBriefToneLabel;
  const farmQuickPanelToggleTitle = `${panelOpen ? '收起' : '展开'}牧场控制台：当前优先 ${farmMonitorBriefPrimary} · ${farmMonitorBriefSecondary} · ${farmMonitorBriefSectionLabel}`;
  const activeFarmPanelSectionId = FARM_PANEL_SECTION_IDS.find((id) => isFarmPanelSectionExpanded(id)) || '';
  const activeFarmPanelSectionItem = farmPanelSectionItems.find((item) => item.id === activeFarmPanelSectionId);
  const farmPanelOpenSectionCount = FARM_PANEL_SECTION_IDS.filter((id) => isFarmPanelSectionExpanded(id)).length;
  const farmPanelDailyOpenSectionCount = FARM_PANEL_DAILY_SECTION_IDS.filter((id) => isFarmPanelSectionExpanded(id)).length;
  const farmPanelPriorityPresetActive = farmPanelOpenSectionCount === 1 && isFarmPanelSectionExpanded(farmMonitorBriefSection);
  const farmPanelDailyPresetActive = Boolean(activeFarmPanelSectionId && FARM_PANEL_DAILY_SECTION_IDS.includes(activeFarmPanelSectionId as FarmPanelSectionId));

  useEffect(() => {
    if (typeof window === 'undefined' || !panelOpen || !activeFarmPanelSectionId) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      const panelElement = farmPanelRef.current;
      if (!panelElement || panelElement.dataset.farmPanelLayout !== 'split-detail') return;
      panelElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeFarmPanelSectionId, panelOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !panelOpen) return undefined;
    const panelElement = farmPanelRef.current;
    if (!panelElement || panelElement.dataset.farmPanelLayout !== 'split-detail') return undefined;
    const syncDetailHeight = () => {
      panelElement.style.setProperty('--farm-panel-detail-height', `${panelElement.getBoundingClientRect().height}px`);
    };
    syncDetailHeight();
    window.addEventListener('resize', syncDetailHeight);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncDetailHeight) : null;
    resizeObserver?.observe(panelElement);
    return () => {
      window.removeEventListener('resize', syncDetailHeight);
      resizeObserver?.disconnect();
      panelElement.style.removeProperty('--farm-panel-detail-height');
    };
  }, [activeFarmPanelSectionId, panelOpen]);
  const applyFarmPanelSectionPreset = (presetId: FarmPanelSectionPresetId) => {
    const activeDailyIndex = FARM_PANEL_DAILY_SECTION_IDS.indexOf(activeFarmPanelSectionId as FarmPanelSectionId);
    const presetSection = presetId === 'priority'
      ? farmMonitorBriefSection
      : presetId === 'daily'
        ? FARM_PANEL_DAILY_SECTION_IDS[activeDailyIndex >= 0 ? (activeDailyIndex + 1) % FARM_PANEL_DAILY_SECTION_IDS.length : 0]
        : undefined;
    const presetSectionLabel = presetSection
      ? farmPanelSectionItems.find((item) => item.id === presetSection)?.label || '常用栏目'
      : '';
    setFarmPanelSectionExpanded(() => presetSection ? { [presetSection]: true } : {});
    flashFarmPanelSectionPreset({
      presetId,
      label: presetId === 'priority' ? '已打开优先' : presetId === 'daily' ? '常用已切换' : '已全部收起',
      detail: presetId === 'priority'
        ? `${farmMonitorBriefSectionLabel} · ${farmMonitorBriefPrimary}`
        : presetId === 'daily'
          ? `单栏展开：${presetSectionLabel}`
          : '控制台已整理，保留顶部看板',
      count: presetSection ? 1 : 0,
      targetSection: presetSection,
    });
    if (presetSection) {
      flashFarmPrioritySection(presetSection);
    }
  };
  const handleFarmQuickPanelToggle = () => {
    const nextOpen = !panelOpen;
    if (nextOpen) {
      setFarmPanelSectionOpen(farmMonitorBriefSection, true);
      flashFarmPrioritySection(farmMonitorBriefSection);
    }
    setOpen(nextOpen);
  };
  const farmMonitorPriorityAction: FarmPriorityAction = (() => {
    if (farmMonitorBriefTone === 'water') {
      return {
        kind: 'water-route',
        label: waterAmount > 0 ? '接上浇水' : '先补水',
        detail: waterAmount > 0 ? `缺水 ${dryCount} 块，切工具并找最近` : `缺水 ${dryCount} 块，水量不足`,
        section: 'tools',
        routeTarget: waterAmount > 0 ? 'water' : 'building-yield-summary',
        routeLabel: waterAmount > 0 ? '缺水' : '补水',
        routeTitle: waterAmount > 0 ? `自动定位最近缺水作物 ${dryCount}块` : '查看水井收益或推进日结补水',
        message: waterAmount > 0 ? `当前优先接上：缺水 ${dryCount}块，已切到浇水并指路` : `当前优先接上：缺水 ${dryCount}块，水量不足，先查看补水来源`,
        tone: 'water',
      };
    }
    if (farmMonitorBriefTone === 'order') {
      const orderLabel = currentOrder?.title || '订单';
      return {
        kind: 'order-submit',
        label: orderReady ? '交付订单' : '查看订单',
        detail: orderReady ? `${orderLabel} 已备齐` : `${orderLabel} 还差材料`,
        section: 'visits',
        routeTarget: 'ready-order',
        routeLabel: '订单',
        routeTitle: orderReady ? `交付当前订单：${orderLabel}` : `查看订单材料：${orderLabel}`,
        message: orderReady ? `当前优先接上：交付订单 ${orderLabel}` : `当前优先接上：查看订单 ${orderLabel}`,
        tone: orderReady ? 'reward' : 'success',
      };
    }
    if (farmMonitorBriefTone === 'visit') {
      const visitorLabel = activeNpcVisit?.visitorName || '来访客人';
      return {
        kind: 'visit-deliver',
        label: npcVisitReady ? '交付来访' : '查看来访',
        detail: npcVisitReady ? `${visitorLabel} 的材料已备齐` : `${visitorLabel} 等待备货`,
        section: 'visits',
        routeTarget: 'ready-npc',
        routeLabel: '来访',
        routeTitle: npcVisitReady ? `交付来访委托：${visitorLabel}` : `查看来访委托：${visitorLabel}`,
        message: npcVisitReady ? `当前优先接上：交付来访 ${visitorLabel}` : `当前优先接上：查看来访 ${visitorLabel}`,
        tone: npcVisitReady ? 'reward' : 'success',
      };
    }
    if (farmMonitorBriefTone === 'mature') {
      return {
        kind: 'mature-route',
        label: '去收成熟',
        detail: `成熟 ${matureCount} 块，切收获并跳最近`,
        section: 'actions',
        routeTarget: 'mature-crop',
        routeLabel: '成熟',
        routeTitle: `自动定位最近成熟作物 ${matureCount}块`,
        message: `当前优先接上：成熟 ${matureCount}块，已切到收获并跳转`,
        tone: 'success',
      };
    }
    if (farmMonitorBriefTone === 'guard') {
      return {
        kind: 'guard-route',
        label: '补守护',
        detail: `未守护 ${scarecrowRiskCount} 块，选择稻草人`,
        section: 'build',
        routeTarget: 'scarecrow-risk',
        routeLabel: '守护',
        routeTitle: `自动定位稻草人守护风险 ${scarecrowRiskCount}块`,
        message: `当前优先接上：未守护 ${scarecrowRiskCount}块，已选择稻草人并指路`,
        tone: 'build',
      };
    }
    if (farmMonitorBriefTone === 'focus' && primaryFarmFocus) {
      const routeTarget = farmRouteTargetForFocusAction(primaryFarmFocus.action);
      const routeLabel = farmRouteLabelForTarget(routeTarget);
      return {
        kind: 'focus-action',
        label: primaryFarmFocusActionLabel ? `执行${primaryFarmFocusActionLabel}` : '执行目标',
        detail: `${primaryFarmFocus.progress}/${primaryFarmFocus.target} · ${primaryFarmFocus.title}`,
        section: 'focus',
        routeTarget,
        routeLabel: routeLabel || undefined,
        routeTitle: routeLabel ? `当前目标路线：${routeLabel} · ${primaryFarmFocus.title}` : `当前目标：${primaryFarmFocus.title}`,
        message: `当前优先接上：${primaryFarmFocus.title}`,
        tone: farmFocusActionCanvasTone(farmFocusActionNextTarget(primaryFarmFocus.action)),
      };
    }
    return {
      kind: 'activity-open',
      label: '查看成果',
      detail: farmActivityDigest.rewardStreakLabel || farmActivityDigest.badgeLabel || `${farmActivityDigest.todayTotal}条农活`,
      section: 'activity',
      routeTarget: 'day',
      routeLabel: '成果',
      routeTitle: '查看最近农活和今日成果',
      message: '当前优先接上：查看最近农活和今日成果',
      tone: 'success',
    };
  })();
  useEffect(() => {
    if (!priorityFocusRequestId || farmPriorityFocusRequestRef.current === priorityFocusRequestId) return;
    farmPriorityFocusRequestRef.current = priorityFocusRequestId;
    setOpen(true);
    setFarmPanelSectionOpen(farmMonitorBriefSection, true);
    flashFarmPrioritySection(farmMonitorBriefSection);
    flashFarmControlConsoleFocusReceipt({
      id: priorityFocusRequestId,
      section: farmMonitorBriefSection,
      sectionLabel: farmMonitorBriefSectionLabel,
      primary: farmMonitorBriefPrimary,
      secondary: farmMonitorBriefSecondary,
      tone: farmMonitorBriefTone,
      actionKind: farmMonitorPriorityAction.kind,
      routeTarget: farmMonitorPriorityAction.routeTarget,
      routeLabel: farmMonitorPriorityAction.routeLabel,
      routeTitle: farmMonitorPriorityAction.routeTitle,
    });
  }, [
    flashFarmControlConsoleFocusReceipt,
    flashFarmPrioritySection,
    farmMonitorBriefPrimary,
    farmMonitorBriefSecondary,
    farmMonitorBriefSection,
    farmMonitorBriefSectionLabel,
    farmMonitorBriefTone,
    farmMonitorPriorityAction.kind,
    farmMonitorPriorityAction.routeLabel,
    farmMonitorPriorityAction.routeTarget,
    farmMonitorPriorityAction.routeTitle,
    priorityFocusRequestId,
    setFarmPanelSectionOpen,
    setOpen,
  ]);
  const farmMonitorPriorityRouteReceiptActive = farmMonitorBriefRouteReceipt === farmMonitorPriorityAction.kind;
  const farmControlConsoleFocusRouteReceiptActive = Boolean(
    farmControlConsoleFocusReceipt
      && farmMonitorBriefRouteReceipt === farmControlConsoleFocusReceipt.actionKind,
  );
  const farmMonitorPriorityActionReceiptActive = farmPriorityActionReceipt === farmMonitorPriorityAction.kind;
  const farmControlConsoleFocusActionReceiptActive = Boolean(
    farmControlConsoleFocusReceipt
      && farmPriorityActionReceipt === farmControlConsoleFocusReceipt.actionKind,
  );
  const farmPriorityActionRouteReady = farmMonitorPriorityRouteReceiptActive
    && !farmMonitorPriorityActionReceiptActive;
  const farmPriorityActionButtonTitle = farmMonitorPriorityActionReceiptActive
    ? `已接上当前优先：${farmMonitorPriorityAction.label} · ${farmMonitorPriorityAction.detail}`
    : farmPriorityActionRouteReady
      ? `路线已亮，再点执行：${farmMonitorPriorityAction.label} · ${farmMonitorPriorityAction.detail}`
      : `接上当前优先：${farmMonitorPriorityAction.label} · ${farmMonitorPriorityAction.detail}`;
  const farmPriorityActionButtonAriaLabel = farmMonitorPriorityActionReceiptActive
    ? `已接上当前优先：${farmMonitorPriorityAction.label}，${farmMonitorPriorityAction.detail}`
    : farmPriorityActionRouteReady
      ? `路线已亮，再点执行：${farmMonitorPriorityAction.label}，${farmMonitorPriorityAction.detail}`
      : `接上当前优先：${farmMonitorPriorityAction.label}，${farmMonitorPriorityAction.detail}`;
  const farmPriorityActionLeadLabel = farmMonitorPriorityActionReceiptActive
    ? '已接上当前优先'
    : farmPriorityActionRouteReady
      ? '路线已亮，再点执行'
      : '接上当前优先';
  const farmPriorityActionStatusLabel = farmMonitorPriorityActionReceiptActive
    ? '已接上'
    : farmPriorityActionRouteReady
      ? '再点执行'
      : farmMonitorPriorityAction.routeLabel || '继续';
  const farmPriorityQueueItems: FarmPriorityQueueItem[] = (() => {
    const items: FarmPriorityQueueItem[] = [];
    const addItem = (item: FarmPriorityQueueItem) => {
      if (item.kind === farmMonitorPriorityAction.kind) return;
      if (items.some((current) => (
        current.id === item.id
        || current.kind === item.kind
        || Boolean(current.routeTarget && item.routeTarget && current.routeTarget === item.routeTarget)
      ))) {
        return;
      }
      items.push(item);
    };
    const focusQueueItem = (
      goal: FarmFocusGoal | undefined,
      id: string,
      kind: Extract<FarmPriorityQueueActionKind, 'focus-next' | 'activity-next'>,
      section: FarmPanelSectionId,
      prefix: string,
    ) => {
      if (!goal) return;
      const routeTarget = farmRouteTargetForFocusAction(goal.action);
      const routeLabel = farmRouteLabelForTarget(routeTarget);
      const canvasTarget = farmFocusActionNextTarget(goal.action);
      addItem({
        id,
        kind,
        label: `${prefix}${goal.actionLabel}`,
        detail: `${goal.progress}/${goal.target} · ${goal.title}`,
        impactLabel: `进度 ${goal.progress}/${goal.target}`,
        reasonLabel: routeLabel ? `路线 ${routeLabel}` : `目标 ${goal.actionLabel}`,
        safetyLabel: kind === 'activity-next' ? '点了接连击' : '点了做目标',
        actionLabel: goal.actionLabel,
        section,
        routeTarget,
        routeLabel: routeLabel || undefined,
        routeTitle: routeLabel ? `顺手路线：${routeLabel} · ${goal.title}` : `顺手接：${goal.title}`,
        message: `顺手接下一件：${goal.title} · ${goal.actionLabel}`,
        tone: farmFocusActionCanvasTone(canvasTarget),
        focusGoal: goal,
      });
    };
    if (matureCount > 0) {
      addItem({
        id: 'queue-mature',
        kind: 'mature-route',
        label: '顺手收成熟',
        detail: `成熟 ${matureCount} 块，跳到最近一块`,
        impactLabel: `成熟 ${matureCount}块`,
        reasonLabel: '收获入袋',
        safetyLabel: '点了切镰刀',
        actionLabel: '收获',
        section: 'actions',
        routeTarget: 'mature-crop',
        routeLabel: '成熟',
        routeTitle: `顺手收成熟作物 ${matureCount}块`,
        message: `顺手接下一件：成熟 ${matureCount}块，已切到收获并指路`,
        tone: 'reward',
      });
    }
    if (dryCount > 0) {
      addItem({
        id: 'queue-water',
        kind: 'water-route',
        label: waterAmount > 0 ? '顺手补水' : '先找补水',
        detail: waterAmount > 0 ? `缺水 ${dryCount} 块，切浇水并指路` : `缺水 ${dryCount} 块，水量不足`,
        impactLabel: `缺水 ${dryCount}块`,
        reasonLabel: waterAmount > 0 ? `水量 ${waterAmount}` : '先找水源',
        safetyLabel: waterAmount > 0 ? '点了切水壶' : '只打开线索',
        actionLabel: waterAmount > 0 ? '浇水' : '补水',
        section: waterAmount > 0 ? 'tools' : 'building',
        routeTarget: waterAmount > 0 ? 'water' : 'building-yield-summary',
        routeLabel: waterAmount > 0 ? '缺水' : '补水',
        routeTitle: waterAmount > 0 ? `顺手定位缺水作物 ${dryCount}块` : '查看水井收益或推进日结补水',
        message: waterAmount > 0 ? `顺手接下一件：缺水 ${dryCount}块，已切到浇水并指路` : `顺手接下一件：缺水 ${dryCount}块，先查看补水来源`,
        tone: 'water',
      });
    }
    if (currentOrder) {
      const orderLabel = currentOrder.title || '订单';
      addItem({
        id: `queue-order-${currentOrder.id}`,
        kind: 'order-next',
        label: orderReady ? '顺手交单' : '看订单差料',
        detail: orderReady ? `${orderLabel} 已备齐` : `${orderLabel} 还差材料`,
        impactLabel: orderReady ? '材料齐' : '缺材料',
        reasonLabel: orderReady ? `奖励 ${currentOrderRewardLabel}` : '先看差料',
        safetyLabel: orderReady ? '点了交单' : '只打开订单',
        actionLabel: orderReady ? '交单' : '查看',
        section: 'visits',
        routeTarget: 'ready-order',
        routeLabel: '订单',
        routeTitle: orderReady ? `顺手交付订单：${orderLabel}` : `查看订单材料：${orderLabel}`,
        message: orderReady ? `顺手接下一件：交付订单 ${orderLabel}` : `顺手接下一件：查看订单 ${orderLabel}`,
        tone: orderReady ? 'reward' : 'success',
      });
    }
    if (activeNpcVisit) {
      const visitorLabel = activeNpcVisit.visitorName || '来访客人';
      addItem({
        id: `queue-visit-${activeNpcVisit.id}`,
        kind: 'visit-next',
        label: npcVisitReady ? '顺手交来访' : '看来访备货',
        detail: npcVisitReady ? `${visitorLabel} 的材料已备齐` : `${visitorLabel} 等待备货`,
        impactLabel: npcVisitReady ? '可交付' : '待备货',
        reasonLabel: npcVisitReady ? `谢礼 ${formatFarmReward(activeNpcVisit.rewards)}` : '先看材料',
        safetyLabel: npcVisitReady ? '点了交付' : '只打开来访',
        actionLabel: npcVisitReady ? '交付' : '查看',
        section: 'visits',
        routeTarget: 'ready-npc',
        routeLabel: '来访',
        routeTitle: npcVisitReady ? `顺手交付来访：${visitorLabel}` : `查看来访委托：${visitorLabel}`,
        message: npcVisitReady ? `顺手接下一件：交付来访 ${visitorLabel}` : `顺手接下一件：查看来访 ${visitorLabel}`,
        tone: npcVisitReady ? 'reward' : 'success',
      });
    }
    if (scarecrowRiskCount > 0) {
      addItem({
        id: 'queue-guard',
        kind: 'guard-route',
        label: '顺手补守护',
        detail: `未守护 ${scarecrowRiskCount} 块，选稻草人`,
        impactLabel: `风险 ${scarecrowRiskCount}处`,
        reasonLabel: '稻草人守护',
        safetyLabel: '点了选建筑',
        actionLabel: '守护',
        section: 'build',
        routeTarget: 'scarecrow-risk',
        routeLabel: '守护',
        routeTitle: `顺手定位稻草人守护风险 ${scarecrowRiskCount}块`,
        message: `顺手接下一件：未守护 ${scarecrowRiskCount}块，已选择稻草人并指路`,
        tone: 'build',
      });
    }
    if (primaryFarmFocus && farmMonitorPriorityAction.kind !== 'focus-action') {
      focusQueueItem(primaryFarmFocus, `queue-focus-${primaryFarmFocus.id}`, 'focus-next', 'focus', '目标：');
    }
    if (farmActivityRewardStreakGoal && farmActivityRewardStreakGoal.id !== primaryFarmFocus?.id) {
      focusQueueItem(farmActivityRewardStreakGoal, `queue-activity-${farmActivityRewardStreakGoal.id}`, 'activity-next', 'activity', '连击：');
    }
    return items;
  })();
  const farmPriorityQueueRoutePreviewItem = farmPriorityQueueItems.find((item) => item.routeTarget);
  const farmPriorityComboExcludedQueueId = farmPriorityComboReceipt?.source === 'queue' ? farmPriorityQueueReceipt : '';
  const farmPriorityComboNextItem = farmPriorityComboReceipt
    ? farmPriorityQueueItems.find((item) => item.id !== farmPriorityComboExcludedQueueId && item.routeTarget)
      || farmPriorityQueueItems.find((item) => item.id !== farmPriorityComboExcludedQueueId)
    : undefined;
  const farmPriorityComboNextRouteReceipt = Boolean(
    farmPriorityComboNextItem && farmPriorityQueueRouteReceipt === farmPriorityComboNextItem.id,
  );
  const farmPriorityComboNextMode = farmPriorityComboNextItem
    ? farmPriorityComboNextRouteReceipt
      ? 'action'
      : 'route'
    : undefined;
  const farmPriorityComboNextActionLabel = farmPriorityComboNextItem
    ? `接${farmPriorityComboNextItem.actionLabel || farmPriorityComboNextItem.routeLabel || '上'}`
    : '';
  const farmPriorityComboNextButtonLabel = farmPriorityComboNextItem
    ? farmPriorityComboNextRouteReceipt
      ? farmPriorityComboNextActionLabel
      : farmPriorityComboNextItem.routeLabel
        ? `看${farmPriorityComboNextItem.routeLabel}`
        : '看下一件'
    : '';
  const farmPriorityFlowNextRouteReceipt = Boolean(
    farmPriorityFlowReceipt?.nextItemId && farmPriorityQueueRouteReceipt === farmPriorityFlowReceipt.nextItemId,
  );
  const farmPriorityFlowNextLiveItem = farmPriorityFlowReceipt?.nextItemId
    ? farmPriorityQueueItems.find((item) => item.id === farmPriorityFlowReceipt.nextItemId)
    : undefined;
  const farmPriorityFlowNextStale = Boolean(farmPriorityFlowReceipt?.nextItemId && !farmPriorityFlowNextLiveItem);
  const farmPriorityFlowNextActionReady = Boolean(farmPriorityFlowNextLiveItem && farmPriorityFlowNextRouteReceipt);
  const farmPriorityFlowNextMode = farmPriorityFlowReceipt?.nextLabel
    ? farmPriorityFlowNextStale
      ? 'stale'
      : farmPriorityFlowNextActionReady
        ? 'action'
        : 'route'
    : undefined;
  const farmPriorityFlowNextActionLabel = farmPriorityFlowNextLiveItem
    ? `接${farmPriorityFlowNextLiveItem.actionLabel || farmPriorityFlowNextLiveItem.routeLabel || '上'}`
    : '';
  const farmPriorityFlowNextButtonLabel = farmPriorityFlowReceipt?.nextLabel
    ? farmPriorityFlowNextStale
      ? '队列已刷新'
      : farmPriorityFlowNextActionReady
        ? farmPriorityFlowNextActionLabel
        : farmPriorityFlowNextRouteReceipt
          ? '已指路'
          : farmPriorityFlowReceipt.nextRouteLabel
            ? `看${farmPriorityFlowReceipt.nextRouteLabel}`
            : '看下一件'
    : '';
  const farmPriorityFlowMiniNextLabel = farmPriorityFlowReceipt?.nextLabel
    ? farmPriorityFlowNextStale
      ? '队列已刷新'
      : farmPriorityFlowNextActionReady
        ? `${farmPriorityFlowNextActionLabel}可接上`
        : farmPriorityFlowNextRouteReceipt
          ? `已指路 ${farmPriorityFlowReceipt.nextRouteLabel || farmPriorityFlowReceipt.nextLabel}`
          : `下一件 ${farmPriorityFlowReceipt.nextLabel}`
    : farmPriorityFlowReceipt
      ? '节奏稳定'
      : '';
  const farmPriorityFlowMiniTitle = farmPriorityFlowReceipt
    ? `刚接上 ${farmPriorityFlowReceipt.actionLabel} · ${farmPriorityFlowReceipt.detailLabel}${farmPriorityFlowMiniNextLabel ? ` · ${farmPriorityFlowMiniNextLabel}` : ''}`
    : '';
  const farmPriorityReceiptNextSnapshot = (item?: FarmPriorityQueueItem) => item
    ? {
        nextItemId: item.id,
        nextLabel: item.label,
        nextActionLabel: item.actionLabel || item.routeLabel || '接上',
        nextSection: item.section,
        nextRouteTarget: item.routeTarget,
        nextRouteLabel: item.routeLabel,
        nextRouteTitle: item.routeTitle,
        nextMessage: `回执下一件：${item.label} · ${item.detail}`,
      }
    : {};

  const handleFarmMonitorBriefRoute = () => {
    setOpen(true);
    setFarmPanelSectionOpen(farmMonitorPriorityAction.section, true);
    flashFarmPrioritySection(farmMonitorPriorityAction.section);
    flashFarmMonitorBriefRoute(farmMonitorPriorityAction.kind);
    onFollowupCanvasHint?.({
      message: `优先指路：${farmMonitorPriorityAction.label} · ${farmMonitorPriorityAction.detail}`,
      tone: farmMonitorPriorityAction.tone,
      routeTarget: farmMonitorPriorityAction.routeTarget,
      routeLabel: farmMonitorPriorityAction.routeLabel,
      routeTitle: farmMonitorPriorityAction.routeTitle || `当前优先：${farmMonitorPriorityAction.label}`,
    });
  };

  const handleFarmMonitorPriorityAction = () => {
    const nextItemAfterPriority = farmPriorityQueueItems.find((item) => item.kind !== farmMonitorPriorityAction.kind);
    setOpen(true);
    setFarmPanelSectionOpen(farmMonitorPriorityAction.section, true);
    flashFarmPrioritySection(farmMonitorPriorityAction.section);
    flashFarmPriorityAction(farmMonitorPriorityAction.kind);
    flashFarmPriorityCombo(farmMonitorPriorityAction.label, 'priority');
    flashFarmPriorityFlowReceipt({
      source: 'priority',
      label: farmMonitorPriorityAction.label,
      actionLabel: farmMonitorPriorityAction.routeLabel || farmMonitorPriorityAction.label,
      detailLabel: farmMonitorPriorityAction.detail,
      impactLabel: farmMonitorBriefProgressLabel,
      reasonLabel: farmMonitorBriefSecondary,
      tone: farmMonitorPriorityAction.tone,
      ...farmPriorityReceiptNextSnapshot(nextItemAfterPriority),
    });
    onFollowupCanvasHint?.({
      message: farmMonitorPriorityAction.message,
      tone: farmMonitorPriorityAction.tone,
      routeTarget: farmMonitorPriorityAction.routeTarget,
      routeLabel: farmMonitorPriorityAction.routeLabel,
      routeTitle: farmMonitorPriorityAction.routeTitle,
    });
    if (farmMonitorPriorityAction.kind === 'water-route') {
      if (waterAmount > 0) {
        onSelectTool?.('water');
        return;
      }
      handleOpenFarmBuildingEffects();
      return;
    }
    if (farmMonitorPriorityAction.kind === 'mature-route') {
      onSelectTool?.('harvest');
      onJumpToMature?.();
      return;
    }
    if (farmMonitorPriorityAction.kind === 'guard-route') {
      onSelectBuilding?.('scarecrow');
      return;
    }
    if (farmMonitorPriorityAction.kind === 'order-submit') {
      if (currentOrder && orderReady && !farmOrderStampActive) {
        handleFarmCompleteCurrentOrder();
        return;
      }
      handleOpenFarmOrder();
      return;
    }
    if (farmMonitorPriorityAction.kind === 'visit-deliver') {
      if (activeNpcVisit && npcVisitReady && !farmNpcDeliveryActive) {
        flashFarmNpcDelivery(activeNpcVisit.id);
        onCompleteNpcVisit?.(activeNpcVisit.id);
        return;
      }
      handleOpenFarmNpcVisit();
      return;
    }
    if (farmMonitorPriorityAction.kind === 'focus-action' && primaryFarmFocus) {
      handleFarmFocusAction(primaryFarmFocus);
      return;
    }
    handleOpenFarmActivity('section');
  };
  const handleFarmPriorityQueueAction = (item: FarmPriorityQueueItem) => {
    const nextItemAfterQueue = farmPriorityQueueItems.find((candidate) => candidate.id !== item.id);
    setOpen(true);
    setFarmPanelSectionOpen(item.section, true);
    flashFarmPrioritySection(item.section);
    flashFarmPriorityQueue(item.id);
    flashFarmPriorityCombo(item.actionLabel || item.label, 'queue');
    flashFarmPriorityFlowReceipt({
      source: 'queue',
      label: item.label,
      actionLabel: item.actionLabel || item.routeLabel || item.label,
      detailLabel: item.detail,
      impactLabel: item.impactLabel,
      reasonLabel: item.reasonLabel,
      tone: item.tone,
      ...farmPriorityReceiptNextSnapshot(nextItemAfterQueue),
    });
    onFollowupCanvasHint?.({
      message: item.message,
      tone: item.tone,
      routeTarget: item.routeTarget,
      routeLabel: item.routeLabel,
      routeTitle: item.routeTitle,
    });
    if (item.kind === 'focus-next') {
      if (item.focusGoal) handleFarmFocusAction(item.focusGoal);
      else handleOpenFarmActivity('action');
      return;
    }
    if (item.kind === 'activity-next') {
      handleFarmActivityRewardStreakAction();
      return;
    }
    if (item.kind === 'order-next' || item.kind === 'order-submit') {
      if (currentOrder && orderReady && !farmOrderStampActive) {
        handleFarmCompleteCurrentOrder();
        return;
      }
      handleOpenFarmOrder();
      return;
    }
    if (item.kind === 'visit-next' || item.kind === 'visit-deliver') {
      if (activeNpcVisit && npcVisitReady && !farmNpcDeliveryActive) {
        flashFarmNpcDelivery(activeNpcVisit.id);
        onCompleteNpcVisit?.(activeNpcVisit.id);
        return;
      }
      handleOpenFarmNpcVisit();
      return;
    }
    if (item.kind === 'water-route') {
      if (waterAmount > 0) {
        onSelectTool?.('water');
        return;
      }
      handleOpenFarmBuildingEffects();
      return;
    }
    if (item.kind === 'mature-route') {
      onSelectTool?.('harvest');
      onJumpToMature?.();
      return;
    }
    if (item.kind === 'guard-route') {
      onSelectBuilding?.('scarecrow');
      return;
    }
    handleOpenFarmActivity('section');
  };
  const handleFarmPriorityQueueRoutePreview = (item: FarmPriorityQueueItem) => {
    setOpen(true);
    setFarmPanelSectionOpen(item.section, true);
    flashFarmPrioritySection(item.section);
    flashFarmPriorityQueueRoute(item.id);
    onFollowupCanvasHint?.({
      message: `先看路线：${item.routeLabel || item.label} · ${item.detail}`,
      tone: item.tone,
      routeTarget: item.routeTarget,
      routeLabel: item.routeLabel,
      routeTitle: item.routeTitle || `顺手接下一件：${item.label}`,
    });
  };
  const handleFarmPriorityFlowReceiptNextRoute = () => {
    if (!farmPriorityFlowReceipt?.nextLabel) return;
    if (farmPriorityFlowNextStale) return;
    if (farmPriorityFlowNextActionReady && farmPriorityFlowNextLiveItem) {
      handleFarmPriorityQueueAction(farmPriorityFlowNextLiveItem);
      return;
    }
    setOpen(true);
    if (farmPriorityFlowReceipt.nextSection) {
      setFarmPanelSectionOpen(farmPriorityFlowReceipt.nextSection, true);
      flashFarmPrioritySection(farmPriorityFlowReceipt.nextSection);
    }
    if (farmPriorityFlowReceipt.nextItemId) {
      flashFarmPriorityQueueRoute(farmPriorityFlowReceipt.nextItemId);
    }
    onFollowupCanvasHint?.({
      message: farmPriorityFlowReceipt.nextMessage || `回执下一件：${farmPriorityFlowReceipt.nextLabel}`,
      tone: farmPriorityFlowReceipt.tone,
      routeTarget: farmPriorityFlowReceipt.nextRouteTarget,
      routeLabel: farmPriorityFlowReceipt.nextRouteLabel,
      routeTitle: farmPriorityFlowReceipt.nextRouteTitle || `回执下一件：${farmPriorityFlowReceipt.nextLabel}`,
    });
  };

  return (
    <div
      className={`t8-farm-story-panel nodrag nopan${panelOpen ? ' is-open' : ''}${busy ? ' is-muted' : ''}`}
      data-canvas-floating-ui="farm-story-root"
      data-theme-mode={themeMode}
      data-farm-panel-night-readable={themeMode === 'dark' ? 'true' : undefined}
      data-farm-control-console-focus-request={priorityFocusRequestId || undefined}
      data-farm-control-console-focus-section={farmMonitorBriefSection}
      data-farm-control-console-focus-section-label={farmMonitorBriefSectionLabel}
      data-farm-control-console-focus-receipt={farmControlConsoleFocusReceipt ? 'true' : undefined}
      data-farm-control-console-focus-receipt-tone={farmControlConsoleFocusReceipt?.tone}
      data-farm-control-console-focus-receipt-section={farmControlConsoleFocusReceipt?.section}
      data-farm-control-console-focus-route-receipt={farmControlConsoleFocusRouteReceiptActive ? 'true' : undefined}
      onPointerDownCapture={(event) => event.stopPropagation()}
      onPointerMoveCapture={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      {showInlineToggle && (
        <button
          type="button"
          className={`t8-control-rail-help t8-farm-story-panel__toggle t8-mini-icon-button${panelOpen ? ' is-active' : ''}`}
          data-canvas-floating-ui="farm-story-toggle"
          data-farm-control-console-toggle="inline"
          data-farm-control-console-priority={farmMonitorBriefTone}
          data-farm-control-console-priority-label={farmMonitorBriefPrimary}
          data-farm-control-console-priority-section={farmMonitorBriefSection}
          data-farm-control-console-priority-section-label={farmMonitorBriefSectionLabel}
          data-farm-control-console-auto-section={farmMonitorBriefSection}
          data-farm-control-console-auto-focus={panelOpen ? undefined : 'true'}
          aria-label={farmQuickPanelToggleTitle}
          title={farmQuickPanelToggleTitle}
          aria-expanded={panelOpen}
          aria-pressed={panelOpen}
          onClick={(event) => {
            event.stopPropagation();
            handleFarmQuickPanelToggle();
          }}
        >
          <Sprout size={16} />
          <span className="t8-farm-story-panel__toggle-label">牧场</span>
          <i aria-hidden="true" data-farm-inline-priority-dot="true" />
        </button>
      )}
      <div
          className="t8-farm-story-panel__mini-status"
          data-farm-mini-status="monitor"
          data-farm-mini-panel-state={panelOpen ? 'open' : 'closed'}
          data-farm-monitor-panel="true"
          data-farm-monitor-layout="pasture-dashboard-v1"
          data-farm-monitor-rail="compact-clean-v2"
          data-farm-monitor-density="focused"
          data-farm-monitor-active-label={farmMonitorBriefPrimary}
          data-farm-monitor-active-summary={farmMonitorBriefSecondary}
          data-farm-mini-day={farmCanvas?.day || 1}
          data-farm-mini-season={currentSeason}
          data-farm-mini-weather={currentWeather}
          data-farm-mini-gold={farmCanvas?.resources.gold || 0}
          data-farm-mini-seeds={totalSeedCount}
          data-farm-mini-water={waterAmount}
          data-farm-mini-wood={woodAmount}
          data-farm-mini-stone={stoneAmount}
          data-farm-mini-buildings={farmBuildingEffects.totalBuildings}
          data-farm-mini-wells={farmBuildingEffects.wells}
          data-farm-mini-storages={farmBuildingEffects.storages}
          data-farm-mini-boards={farmBuildingEffects.boards}
          data-farm-mini-scarecrows={farmBuildingEffects.scarecrows}
          data-farm-mini-building-yields={farmMiniBuildingEffectSummaryLabel || undefined}
          data-farm-mini-building-targets={farmMiniBuildingEffectTargetLabel || undefined}
          data-farm-mini-placement-receipt={farmPlacementHudReceiptLabel || undefined}
          data-farm-mini-placement-receipt-kind={farmPlacementHudReceiptKind || undefined}
          data-farm-mini-placement-receipt-source={farmPlacementHudReceiptSource || undefined}
          data-farm-mini-placement-receipt-title={farmPlacementHudReceiptTitle || undefined}
          data-farm-mini-placement-receipt-canvas-hint={farmPlacementHudReceiptCanvasHint || undefined}
          data-farm-mini-placement-receipt-canvas-tone={farmPlacementHudReceiptLabel ? farmPlacementHudReceiptCanvasTone : undefined}
          data-farm-mini-placement-receipt-next={farmPlacementHudReceiptNextLabel || undefined}
          data-farm-mini-placement-receipt-next-title={farmPlacementHudReceiptNextTitle || undefined}
          data-farm-mini-placement-receipt-next-target={farmPlacementHudReceiptNextTarget || undefined}
          data-farm-mini-placement-receipt-next-target-title={farmPlacementHudReceiptNextTargetTitle || undefined}
          data-farm-mini-placement-receipt-next-target-opened={farmPlacementHudReceiptNextTargetOpened ? 'true' : undefined}
          data-farm-mini-placement-receipt-next-target-opened-title={farmPlacementHudReceiptNextTargetOpenedTitle || undefined}
          data-farm-mini-placement-receipt-next-target-opened-canvas-hint={farmPlacementHudReceiptNextTargetOpenedCanvasHint || undefined}
          data-farm-mini-placement-receipt-next-target-opened-canvas-tone={farmPlacementHudReceiptNextTargetOpenedCanvasHint ? farmPlacementHudReceiptNextTargetOpenedCanvasTone : undefined}
          data-farm-mini-placement-receipt-followup={farmPlacementHudReceiptFollowupLabel || undefined}
          data-farm-mini-placement-receipt-followup-title={farmPlacementHudReceiptFollowupTitle || undefined}
          data-farm-mini-placement-receipt-followup-target={farmPlacementHudReceiptFollowupTarget || undefined}
          data-farm-mini-placement-receipt-followup-route={farmPlacementHudReceiptFollowupTarget ? 'true' : undefined}
          data-farm-mini-placement-receipt-followup-route-label={farmPlacementHudReceiptFollowupRouteLabel || undefined}
          data-farm-mini-placement-receipt-followup-route-title={farmPlacementHudReceiptFollowupRouteTitle || undefined}
          data-farm-mini-placement-receipt-followup-route-receipt={farmPlacementRouteHintReceipt || undefined}
          data-farm-mini-placement-receipt-followup-action-receipt={farmPlacementFollowupActionReceipt || undefined}
          data-farm-mini-placement-receipt-followup-action-count={farmPlacementHudReceiptFollowupCountLabel || undefined}
          data-farm-mini-placement-receipt-followup-action-resource={farmPlacementHudReceiptFollowupResourceLabel || undefined}
          data-farm-mini-scarecrow-risk={scarecrowRiskCount}
          data-farm-mini-animals={animalCount}
          data-farm-mini-animal-products={totalAnimalProducts}
          data-farm-mini-animal-mood-summary={farmAnimalMoodSummaryLabel || undefined}
          data-farm-mini-animal-mood-preview={farmAnimalMoodPreviewLabel || undefined}
          data-farm-mini-animal-mood-tone={farmAnimalMoodTone || undefined}
          data-farm-mini-animal-product-summary={animalProductSummary || undefined}
          data-farm-mini-animal-product-preview={farmMiniAnimalProductPreviewLabel || undefined}
          data-farm-mini-animal-product-receipt={farmAnimalProductReceiptSummary || undefined}
          data-farm-mini-animal-product-receipt-count={farmAnimalProductReceiptCount || undefined}
          data-farm-mini-animal-product-receipt-preview={farmMiniAnimalProductReceiptPreviewLabel || undefined}
          data-farm-mini-animal-next-products={farmAnimalNextProductSummary || undefined}
          data-farm-mini-animal-next-products-count={farmAnimalNextProductCount || undefined}
          data-farm-mini-animal-next-products-preview={farmMiniAnimalNextProductPreviewLabel || undefined}
          data-farm-mini-beauty-score={farmBeautyScore.score}
          data-farm-mini-beauty-level={farmBeautyScore.level}
          data-farm-mini-mature={matureCount}
          data-farm-mini-dry={dryCount}
          data-farm-mini-withered={witheredCount}
          data-farm-mini-ready-orders={readyOrderCount}
          data-farm-mini-ready-npc={readyNpcVisitCount}
          data-farm-mini-activity-count={farmActivityDigest.todayTotal}
          data-farm-mini-activity-rewards={farmActivityDigest.todayRewardTotal}
          data-farm-mini-activity-percent={farmActivityDigest.percent}
          data-farm-mini-activity-tone={farmActivityDigest.tone}
          data-farm-mini-activity-action-linked={farmMiniQuickActionBusy ? 'true' : undefined}
          data-farm-mini-activity-action-result={farmMiniQuickActionFeedback?.label || undefined}
          data-farm-mini-followup-resource-targets={farmActivityRewardStreakActionReceiptEchoLabel && farmActivityRewardStreakActionResourceTargets.length ? farmActivityRewardStreakActionResourceTargets.join(' ') : undefined}
          data-farm-mini-followup-resource-preview={farmActivityRewardStreakActionReceiptEchoLabel && farmActivityRewardStreakActionResourcePreview ? farmActivityRewardStreakActionResourcePreview : undefined}
          data-farm-mini-activity-feedback-label={farmMiniQuickActionActivityFeedbackLabel || undefined}
          data-farm-mini-activity-reward-streak={farmActivityDigest.rewardStreak || undefined}
          data-farm-mini-activity-reward-streak-label={farmActivityDigest.rewardStreakLabel || undefined}
          data-farm-mini-activity-reward-streak-tier={farmActivityDigest.rewardStreakTier || undefined}
          data-farm-mini-activity-reward-streak-milestone={farmActivityDigest.rewardStreakMilestoneLabel || undefined}
          data-farm-mini-activity-reward-streak-target={farmActivityDigest.rewardStreakMilestoneTarget || undefined}
          data-farm-mini-activity-reward-streak-percent={farmActivityDigest.rewardStreakMilestonePercent ?? undefined}
          data-farm-mini-activity-reward-streak-progress={farmActivityDigest.rewardStreakMilestoneProgressLabel || undefined}
          data-farm-mini-activity-reward-streak-complete={farmActivityDigest.rewardStreakMilestonePercent === 100 ? 'true' : undefined}
          data-farm-mini-activity-reward-streak-completion={farmActivityDigest.rewardStreakMilestoneCompletionLabel || undefined}
          data-farm-mini-activity-reward-streak-reward={farmActivityDigest.rewardStreakMilestoneRewardLabel || undefined}
          data-farm-mini-activity-reward-streak-items={farmActivityDigest.rewardStreakMilestoneRewardItems?.join(' ') || undefined}
          data-farm-mini-activity-streak-chest-state={farmActivityDigest.rewardStreakChestState || undefined}
          data-farm-mini-activity-streak-chest-tier={farmActivityDigest.rewardStreakChestTier || undefined}
          data-farm-mini-activity-streak-chest-progress={farmActivityDigest.rewardStreakChestProgressLabel || undefined}
          data-farm-mini-activity-streak-chest-reward={farmActivityDigest.rewardStreakChestRewardLabel || undefined}
          data-farm-mini-activity-streak-chest-cta={farmActivityDigest.rewardStreakChestCtaLabel || undefined}
          data-farm-mini-activity-streak-chest-claim={farmActivityDigest.rewardStreakChestClaimLabel || undefined}
          data-farm-mini-activity-streak-chest-next={farmActivityDigest.rewardStreakChestNextLabel || undefined}
          data-farm-mini-activity-streak-chest-items={farmActivityDigest.rewardStreakChestRewardItems?.join(' ') || undefined}
          data-farm-mini-activity-streak-chest-burst={farmActivityDigest.rewardStreakChestBurstLabel || undefined}
          data-farm-mini-activity-streak-chest-opened-summary={farmActivityDigest.rewardStreakChestOpenedSummaryLabel || undefined}
          data-farm-mini-activity-streak-chest-percent={farmActivityDigest.rewardStreakChestPercent ?? undefined}
          data-farm-mini-activity-streak-chest-meter={farmActivityDigest.rewardStreakChestMeterLabel || undefined}
          data-farm-mini-activity-streak-chest-active-stage={farmActivityDigest.rewardStreakChestActiveTrailLabel || undefined}
          data-farm-mini-activity-streak-chest-active-reward={farmActivityDigest.rewardStreakChestActiveRewardLabel || undefined}
          data-farm-mini-activity-streak-chest-charge={farmActivityDigest.rewardStreakChestChargeLabel || undefined}
          data-farm-mini-activity-streak-chest-charge-short={farmActivityDigest.rewardStreakChestChargeShortLabel || undefined}
          data-farm-mini-activity-streak-action={farmActivityDigest.rewardStreakActionKind || undefined}
          data-farm-mini-activity-streak-action-short-label={farmActivityDigest.rewardStreakActionShortLabel || undefined}
          data-farm-mini-activity-streak-action-label={farmActivityDigest.rewardStreakActionLabel || undefined}
          data-farm-mini-focus-id={primaryFarmFocus?.id || undefined}
          data-farm-mini-focus-kind={primaryFarmFocus?.kind || undefined}
          data-farm-mini-focus-progress={primaryFarmFocus?.progress ?? undefined}
          data-farm-mini-focus-target={primaryFarmFocus?.target ?? undefined}
          data-farm-mini-focus-percent={primaryFarmFocus?.percent ?? undefined}
          data-farm-mini-focus-progress-preview={primaryFarmFocusProgressPreview || undefined}
          data-farm-mini-focus-next-progress={primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
          data-farm-mini-focus-next-percent={primaryFarmFocus ? primaryFarmFocusNextPercent : undefined}
          data-farm-mini-focus-action={primaryFarmFocusActionLabel || undefined}
          data-farm-mini-focus-action-flash={farmMiniQuickActionBusy ? 'true' : undefined}
          data-farm-mini-focus-action-busy={farmMiniQuickActionBusy ? 'true' : undefined}
          data-farm-mini-focus-action-feedback={farmMiniQuickActionFeedback?.label || undefined}
          data-farm-mini-focus-action-feedback-kind={farmMiniQuickActionFeedback?.kind || undefined}
          data-farm-mini-focus-action-feedback-action={farmMiniQuickActionFeedback?.actionKind || undefined}
          data-farm-mini-focus-action-feedback-tool={farmMiniQuickActionFeedback?.tool || undefined}
          data-farm-mini-resource-feedback-targets={farmMiniQuickActionResourceTargets.join(' ') || undefined}
          data-farm-mini-resource-feedback-label={farmMiniQuickActionResourceFeedbackLabel || undefined}
          data-farm-mini-reward-pocket-targets={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.length ? farmActivityChestClaimNextReceiptRewardPocketTargets.join(' ') : undefined}
          data-farm-mini-reward-pocket-targets-label={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargetsLabel ? farmActivityChestClaimNextReceiptRewardPocketTargetsLabel : undefined}
          data-farm-mini-reward-pocket-collected={farmActivityChestClaimNextReceiptRewardPocketAnyTargetOpened ? 'true' : undefined}
          data-farm-mini-reward-pocket-followup={farmActivityChestClaimNextReceiptRewardPocketFollowupLabel || undefined}
          data-farm-mini-action-summary={farmMiniQuickActionSummaryLabel || undefined}
          data-farm-mini-daily-route={farmDailyRouteMonitorLabel || undefined}
          data-farm-mini-daily-route-count={farmDailyRouteSteps.length || undefined}
          data-farm-mini-daily-route-complete={farmDailyRouteCompleteReceipt ? 'true' : undefined}
          data-farm-mini-daily-route-complete-title={farmDailyRouteCompleteTitle || undefined}
          data-farm-mini-daily-route-focus-mode={farmDailyRouteFocusMode || undefined}
          data-farm-mini-daily-route-focus-stage={farmDailyRouteFocusStageLabel || undefined}
          data-farm-mini-daily-route-focus-label={farmDailyRouteFocusLabel || undefined}
          data-farm-mini-daily-route-focus-target={farmDailyRouteFocusTarget || undefined}
          data-farm-mini-daily-route-focus-title={farmDailyRouteFocusTitle || undefined}
          data-farm-mini-morning-combo={farmMorningComboReceipt ? 'true' : undefined}
          data-farm-mini-morning-combo-summary={farmMorningComboReceipt ? farmMorningComboSummary || undefined : undefined}
          data-farm-mini-morning-combo-reward={farmMorningComboReceipt ? farmMorningComboRewardLabel || undefined : undefined}
          data-farm-mini-priority-combo={farmPriorityComboReceipt ? 'true' : undefined}
          data-farm-mini-priority-combo-source={farmPriorityComboReceipt?.source || undefined}
          data-farm-mini-priority-combo-count={farmPriorityComboReceipt?.count ?? undefined}
          data-farm-mini-priority-combo-label={farmPriorityComboReceipt?.comboLabel || undefined}
          data-farm-mini-priority-combo-next={farmPriorityComboNextItem?.label || undefined}
          data-farm-mini-priority-combo-next-route={farmPriorityComboNextItem?.routeTarget || undefined}
          data-farm-mini-priority-combo-next-mode={farmPriorityComboNextMode}
          data-farm-mini-priority-combo-route-receipt={farmPriorityComboNextRouteReceipt ? 'true' : undefined}
          data-farm-mini-priority-flow={farmPriorityFlowReceipt ? 'true' : undefined}
          data-farm-mini-priority-flow-source={farmPriorityFlowReceipt?.source || undefined}
          data-farm-mini-priority-flow-action={farmPriorityFlowReceipt?.actionLabel || undefined}
          data-farm-mini-priority-flow-next={farmPriorityFlowReceipt?.nextLabel || undefined}
          data-farm-mini-priority-flow-next-mode={farmPriorityFlowNextMode}
          data-farm-mini-priority-flow-next-live={farmPriorityFlowNextLiveItem ? 'true' : undefined}
          data-farm-mini-priority-flow-next-stale={farmPriorityFlowNextStale ? 'true' : undefined}
          data-farm-mini-priority-flow-route-receipt={farmPriorityFlowNextRouteReceipt ? 'true' : undefined}
          data-farm-mini-priority-flow-next-status={farmPriorityFlowMiniNextLabel || undefined}
          data-farm-mini-focus-ready={primaryFarmFocusReady ? 'true' : undefined}
          data-farm-mini-focus-complete={primaryFarmFocusComplete ? 'true' : undefined}
          data-farm-mini-tool={selectedTool}
          data-farm-mini-tool-flash={farmMiniToolFlash ? 'true' : undefined}
          title={farmMiniBuildingEffectTitleLabel}
          role="status"
          aria-live="polite"
          aria-label={`牧场折叠状态：第 ${farmCanvas?.day || 1} 天，季节 ${seasonDefinition.label}，天气 ${weatherTitle}，金币 ${farmCanvas?.resources.gold || 0}，种子 ${totalSeedCount}，水量 ${waterAmount}，木材 ${woodAmount}，石头 ${stoneAmount}，建筑 ${farmBuildingEffects.totalBuildings}，建筑收益 ${farmMiniBuildingEffectSummaryLabel || '暂无'}，建筑目标 ${farmMiniBuildingEffectTargetLabel || '暂无'}，水井 ${farmBuildingEffects.wells}，仓库 ${farmBuildingEffects.storages}，公告板 ${farmBuildingEffects.boards}，稻草人 ${farmBuildingEffects.scarecrows}，稻草人待守护 ${scarecrowRiskCount}，动物 ${animalCount}，产物 ${totalAnimalProducts}，明早产物 ${farmAnimalNextProductSummary || '暂无'}，今日动物产出 ${farmAnimalProductReceiptSummary || '暂无'}，漂亮度 ${farmBeautyScore.score}/100，等级 ${farmBeautyScore.title}，成熟 ${matureCount}，缺水 ${dryCount}，枯萎 ${witheredCount}，可交付订单 ${readyOrderCount}，可交付来访 ${readyNpcVisitCount}，今日农活 ${farmActivityDigest.todayTotal}，正反馈 ${farmActivityDigest.todayRewardTotal}，今日连击 ${farmActivityDigest.rewardStreakLabel || '暂无'}，连击里程碑 ${farmActivityDigest.rewardStreakMilestoneProgressLabel || '暂无'}，连击完成 ${farmActivityDigest.rewardStreakMilestoneCompletionLabel || '暂无'}，连击奖励 ${farmActivityDigest.rewardStreakMilestoneRewardLabel || '暂无'}，连击建议 ${farmActivityDigest.rewardStreakActionLabel || '暂无'}，连击宝箱 ${farmActivityDigest.rewardStreakChestLabel || '暂无'}，今日路线 ${farmDailyRouteFocusTitle || farmDailyRouteCompleteTitle || farmDailyRouteMonitorLabel || '暂无'}，晨报二连 ${farmMorningComboReceipt ? `${farmMorningComboSummary}${farmMorningComboRewardLabel ? ` ${farmMorningComboRewardLabel}` : ''}` : '暂无'}，顺手连击 ${farmPriorityComboReceipt ? `${farmPriorityComboReceipt.comboLabel} ${farmPriorityComboReceipt.count}次，下一件 ${farmPriorityComboNextItem?.label || '暂无'}` : '暂无'}，刚接上 ${farmPriorityFlowReceipt ? `${farmPriorityFlowReceipt.actionLabel}，${farmPriorityFlowMiniNextLabel || '节奏稳定'}` : '暂无'}，小目标 ${primaryFarmFocus ? `${primaryFarmFocus.title} ${primaryFarmFocus.progress}/${primaryFarmFocus.target} ${primaryFarmFocusStatusLabel}` : '暂无'}，下一步 ${primaryFarmFocusActionLabel || '暂无'}，当前工具 ${selectedToolOption.label}${farmPlacementHudReceiptNextTargetTitle ? `，${farmPlacementHudReceiptNextTargetTitle}` : ''}${farmPlacementHudReceiptNextTargetOpenedTitle ? `，${farmPlacementHudReceiptNextTargetOpenedTitle}` : ''}${farmPlacementHudReceiptFollowupTitle ? `，${farmPlacementHudReceiptFollowupTitle}` : ''}`}
        >
          {farmPlacementHudReceiptNextTargetTitle && (
            <span
              className="t8-farm-story-panel__sr-only t8-farm-story-panel__mini-placement-target-live"
              data-farm-sr-only-lock="mini-placement-target-live"
              data-farm-mini-placement-receipt-next-target-live="true"
              data-farm-mini-placement-receipt-next-target-live-target={farmPlacementHudReceiptNextTarget}
              aria-live="polite"
            >
              {farmPlacementHudReceiptNextTargetTitle}
            </span>
          )}
          <button
            type="button"
            className="t8-farm-story-panel__monitor-brief"
            data-farm-mini-status-item="monitor-brief"
            data-farm-mini-status-clickable="true"
            data-farm-monitor-group="brief"
            data-farm-monitor-brief-primary={farmMonitorBriefPrimary}
            data-farm-monitor-brief-secondary={farmMonitorBriefSecondary}
            data-farm-monitor-brief-tone={farmMonitorBriefTone}
            data-farm-monitor-brief-count={farmMonitorBriefCount}
            data-farm-monitor-brief-section={farmMonitorBriefSection}
            data-farm-monitor-brief-progress={farmMonitorBriefProgressLabel}
            data-farm-monitor-brief-route-button="true"
            data-farm-monitor-brief-route-target={farmMonitorPriorityAction.routeTarget}
            data-farm-monitor-brief-route-label={farmMonitorPriorityAction.routeLabel}
            data-farm-monitor-brief-route-receipt={farmMonitorBriefRouteReceipt === farmMonitorPriorityAction.kind ? 'true' : undefined}
            data-farm-monitor-brief-action-receipt={farmMonitorPriorityActionReceiptActive ? 'true' : undefined}
            title={farmMonitorPriorityActionReceiptActive
              ? `当前优先已接上：${farmMonitorPriorityAction.label} · ${farmMonitorPriorityAction.detail}，点击查看${farmMonitorBriefSectionLabel}`
              : `${farmMonitorBriefTitle}，点击只指路不执行`}
            aria-label={farmMonitorPriorityActionReceiptActive
              ? `当前优先已接上：${farmMonitorPriorityAction.label}，${farmMonitorPriorityAction.detail}，打开${farmMonitorBriefSectionLabel}`
              : `优先指路：${farmMonitorBriefPrimary}，${farmMonitorBriefSecondary}，打开${farmMonitorBriefSectionLabel}并定位${farmMonitorPriorityAction.routeLabel || farmMonitorBriefToneLabel}`}
            onClick={(event) => {
              event.stopPropagation();
              if (farmMonitorPriorityActionReceiptActive) {
                setOpen(true);
                setFarmPanelSectionOpen(farmMonitorBriefSection, true);
                flashFarmPrioritySection(farmMonitorBriefSection);
                return;
              }
              handleFarmMonitorBriefRoute();
            }}
          >
            <Sparkles size={12} />
            <strong data-farm-monitor-brief-label-chip="true">优先</strong>
            <b>{farmMonitorBriefPrimary}</b>
            <small>{farmMonitorBriefSecondary}</small>
            <i data-farm-monitor-brief-tone-chip="true">{farmMonitorBriefToneLabel}</i>
            <mark data-farm-monitor-brief-progress-chip="true">{farmMonitorPriorityActionReceiptActive ? '已接上' : farmMonitorBriefRouteReceipt === farmMonitorPriorityAction.kind ? '已指路' : farmMonitorBriefProgressLabel}</mark>
          </button>
          {farmPriorityComboReceipt && (
            <span
              data-farm-mini-status-item="priority-combo"
              data-farm-monitor-group="combo"
              data-farm-mini-priority-combo-chip="true"
              data-farm-mini-priority-combo-source={farmPriorityComboReceipt.source}
              data-farm-mini-priority-combo-count={farmPriorityComboReceipt.count}
              data-farm-mini-priority-combo-next={farmPriorityComboNextItem?.label || undefined}
              data-farm-mini-priority-combo-next-route={farmPriorityComboNextItem?.routeTarget || undefined}
              data-farm-mini-priority-combo-next-mode={farmPriorityComboNextMode}
              data-farm-mini-priority-combo-route-receipt={farmPriorityComboNextRouteReceipt ? 'true' : undefined}
              title={`${farmPriorityComboReceipt.comboLabel} x${farmPriorityComboReceipt.count} · ${farmPriorityComboReceipt.actionLabel}${farmPriorityComboNextItem ? ` · 下一件 ${farmPriorityComboNextItem.label}` : ''}`}
              aria-hidden="true"
            >
              <Sparkles size={11} />
              <b>{farmPriorityComboReceipt.comboLabel} x{farmPriorityComboReceipt.count}</b>
              <small>{farmPriorityComboNextRouteReceipt && farmPriorityComboNextItem ? `已指路 ${farmPriorityComboNextItem.routeLabel || farmPriorityComboNextItem.label}` : farmPriorityComboNextItem ? `下一件 ${farmPriorityComboNextItem.label}` : farmPriorityComboReceipt.rewardLabel}</small>
            </span>
          )}
          {farmPriorityFlowReceipt && (
            <span
              data-farm-mini-status-item="priority-flow"
              data-farm-monitor-group="flow"
              data-farm-mini-priority-flow-chip="true"
              data-farm-mini-priority-flow-source={farmPriorityFlowReceipt.source}
              data-farm-mini-priority-flow-action={farmPriorityFlowReceipt.actionLabel}
              data-farm-mini-priority-flow-next={farmPriorityFlowReceipt.nextLabel || undefined}
              data-farm-mini-priority-flow-next-mode={farmPriorityFlowNextMode}
              data-farm-mini-priority-flow-next-live={farmPriorityFlowNextLiveItem ? 'true' : undefined}
              data-farm-mini-priority-flow-next-stale={farmPriorityFlowNextStale ? 'true' : undefined}
              data-farm-mini-priority-flow-route-receipt={farmPriorityFlowNextRouteReceipt ? 'true' : undefined}
              data-farm-mini-priority-flow-next-status={farmPriorityFlowMiniNextLabel || undefined}
              title={farmPriorityFlowMiniTitle}
              aria-hidden="true"
            >
              <Sparkles size={11} />
              <b>刚接上 {farmPriorityFlowReceipt.actionLabel}</b>
              <small>{farmPriorityFlowMiniNextLabel}</small>
            </span>
          )}
          <button
            type="button"
            data-farm-mini-status-item="day"
            data-farm-mini-status-clickable="true"
            data-farm-monitor-group="rhythm"
            data-farm-mini-summary-opened={farmSummaryOpened ? 'true' : undefined}
            data-farm-mini-resource-linked={farmMiniQuickActionResourceTargets.includes('day') ? 'true' : undefined}
            data-farm-mini-resource-linked-kind="day"
            data-farm-mini-resource-linked-result={farmMiniQuickActionResourceTargets.includes('day') ? farmMiniQuickActionFeedback?.label || undefined : undefined}
            data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('day') ? 'true' : undefined}
            data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('day') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
            data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('day') ? farmMiniFocusActionBaseLabel || undefined : undefined}
            data-farm-mini-placement-followup-route={farmPlacementHudReceiptFollowupTarget === 'day' ? 'true' : undefined}
            data-farm-mini-placement-followup-route-count={farmPlacementHudReceiptFollowupTarget === 'day' ? farmPlacementHudReceiptFollowupCountLabel || undefined : undefined}
            data-farm-mini-placement-followup-route-resource={farmPlacementHudReceiptFollowupTarget === 'day' ? farmPlacementHudReceiptFollowupResourceLabel || undefined : undefined}
            title={farmSummaryOpened ? `已定位每日总结 · 第 ${farmCanvas?.day || 1} 天` : dailySummary ? `查看每日总结 · 第 ${farmCanvas?.day || 1} 天` : farmMiniQuickActionResourceTargets.includes('day') ? `刚刚影响：${farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel} · 第 ${farmCanvas?.day || 1} 天` : primaryFarmFocusActionResourceTargets.includes('day') ? `预计影响：${farmMiniFocusActionBaseLabel} · ${primaryFarmFocusActionResourcePreview} · 第 ${farmCanvas?.day || 1} 天` : `第 ${farmCanvas?.day || 1} 天，过一天后生成每日总结`}
            aria-label={farmSummaryOpened ? `已定位每日总结，第 ${farmCanvas?.day || 1} 天` : dailySummary ? `查看每日总结，第 ${farmCanvas?.day || 1} 天` : `第 ${farmCanvas?.day || 1} 天，过一天后生成每日总结`}
            onClick={(event) => {
              event.stopPropagation();
              handleOpenFarmSummary();
            }}
          >
            <CalendarDays size={11} />
            <b>第{farmCanvas?.day || 1}天</b>
          </button>
          <button
            type="button"
            data-farm-mini-status-item="season"
            data-farm-mini-status-clickable="true"
            data-farm-monitor-group="rhythm"
            data-farm-mini-season-opened={farmSeasonDetailOpened ? 'true' : undefined}
            title={farmSeasonDetailOpened ? `已定位季节：${seasonDefinition.label}` : `查看季节：${seasonDefinition.label}`}
            aria-label={farmSeasonDetailOpened ? `已定位季节：${seasonDefinition.label}` : `查看季节：${seasonDefinition.label}`}
            onClick={(event) => {
              event.stopPropagation();
              handleOpenFarmSeasonDetail();
            }}
          >
            <Sprout size={11} />
            <b>{seasonDefinition.label}</b>
          </button>
          <button
            type="button"
            data-farm-mini-status-item="weather"
            data-farm-mini-status-clickable="true"
            data-farm-monitor-group="rhythm"
            data-farm-mini-weather-opened={farmSeasonDetailOpened ? 'true' : undefined}
            title={farmSeasonDetailOpened ? `已定位天气：${weatherTitle}` : `查看天气：${weatherTitle}`}
            aria-label={farmSeasonDetailOpened ? `已定位天气：${weatherTitle}` : `查看天气：${weatherTitle}`}
            onClick={(event) => {
              event.stopPropagation();
              handleOpenFarmSeasonDetail();
            }}
          >
            <MiniWeatherIcon size={11} />
            <b>{weatherTitle}</b>
          </button>
          <span
            data-farm-mini-status-item="gold"
            data-farm-monitor-group="resource"
            data-farm-mini-resource-linked={farmMiniQuickActionResourceTargets.includes('gold') ? 'true' : undefined}
            data-farm-mini-resource-linked-kind="gold"
            data-farm-mini-resource-linked-result={farmMiniQuickActionResourceTargets.includes('gold') ? farmMiniQuickActionFeedback?.label || undefined : undefined}
            data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('gold') ? 'true' : undefined}
            data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('gold') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
            data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('gold') ? farmMiniFocusActionBaseLabel || undefined : undefined}
            title={farmMiniQuickActionResourceTargets.includes('gold') ? `刚刚影响：${farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel} · 金币 ${farmCanvas?.resources.gold || 0}` : primaryFarmFocusActionResourceTargets.includes('gold') ? `预计影响：${farmMiniFocusActionBaseLabel} · ${primaryFarmFocusActionResourcePreview} · 金币 ${farmCanvas?.resources.gold || 0}` : `金币 ${farmCanvas?.resources.gold || 0}`}
          >
            <Coins size={11} />
            <b>金币 {farmCanvas?.resources.gold || 0}</b>
          </span>
          <button
            type="button"
            data-farm-mini-status-item="seed"
            data-farm-mini-status-clickable="true"
            data-farm-monitor-group="resource"
            data-farm-mini-seed-tool-opened={farmSeedToolOpened ? 'true' : undefined}
            data-farm-mini-resource-linked={farmMiniQuickActionResourceTargets.includes('seed') ? 'true' : undefined}
            data-farm-mini-resource-linked-kind="seed"
            data-farm-mini-resource-linked-result={farmMiniQuickActionResourceTargets.includes('seed') ? farmMiniQuickActionFeedback?.label || undefined : undefined}
            data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('seed') ? 'true' : undefined}
            data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('seed') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
            data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('seed') ? farmMiniFocusActionBaseLabel || undefined : undefined}
            disabled={totalSeedCount === 0}
            aria-disabled={totalSeedCount === 0}
            title={farmSeedToolOpened ? `已切到播种，种子 ${totalSeedCount}` : totalSeedCount > 0 ? `切到播种，种子 ${totalSeedCount}` : '没有可播种子'}
            aria-label={farmSeedToolOpened ? `已切到播种，种子 ${totalSeedCount}` : totalSeedCount > 0 ? `切到播种，种子 ${totalSeedCount}` : '没有可播种子'}
            onClick={(event) => {
              event.stopPropagation();
              handleFarmMiniSeedToolAction();
            }}
          >
            <Package size={11} />
            <b>种子 {totalSeedCount}</b>
          </button>
          <button
            type="button"
            data-farm-mini-status-item="water"
            data-farm-mini-status-clickable="true"
            data-farm-monitor-group="resource"
            data-farm-mini-water-tool-opened={farmWaterToolOpened ? 'true' : undefined}
            data-farm-mini-resource-linked={farmMiniQuickActionResourceTargets.includes('water') ? 'true' : undefined}
            data-farm-mini-resource-linked-kind="water"
            data-farm-mini-resource-linked-result={farmMiniQuickActionResourceTargets.includes('water') ? farmMiniQuickActionFeedback?.label || undefined : undefined}
            data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('water') ? 'true' : undefined}
            data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('water') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
            data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('water') ? farmMiniFocusActionBaseLabel || undefined : undefined}
            data-farm-mini-placement-followup-route={farmPlacementHudReceiptFollowupTarget === 'water' ? 'true' : undefined}
            data-farm-mini-placement-followup-route-count={farmPlacementHudReceiptFollowupTarget === 'water' ? farmPlacementHudReceiptFollowupCountLabel || undefined : undefined}
            data-farm-mini-placement-followup-route-resource={farmPlacementHudReceiptFollowupTarget === 'water' ? farmPlacementHudReceiptFollowupResourceLabel || undefined : undefined}
            disabled={waterAmount === 0}
            aria-disabled={waterAmount === 0}
            title={farmWaterToolOpened ? `已切到水壶，水量 ${waterAmount}` : waterAmount > 0 ? `切到水壶，水量 ${waterAmount}` : '水量不足'}
            aria-label={farmWaterToolOpened ? `已切到水壶，水量 ${waterAmount}` : waterAmount > 0 ? `切到水壶，水量 ${waterAmount}` : '水量不足'}
            onClick={(event) => {
              event.stopPropagation();
              handleFarmMiniWaterToolAction();
            }}
          >
            <Droplets size={11} />
            <b>水量 {waterAmount}</b>
          </button>
          {farmDailyRouteMonitorLabel && (
            <span
              className="t8-farm-story-panel__mini-daily-route"
              data-farm-mini-status-item="daily-route"
              data-farm-monitor-group="agenda"
              data-farm-mini-daily-route-label={farmDailyRouteMonitorLabel}
              data-farm-mini-daily-route-count={farmDailyRouteSteps.length}
              data-farm-mini-daily-route-focus-mode={farmDailyRouteFocusMode || undefined}
              data-farm-mini-daily-route-focus-stage={farmDailyRouteFocusStageLabel || undefined}
              data-farm-mini-daily-route-focus-label={farmDailyRouteFocusLabel || undefined}
              data-farm-mini-daily-route-focus-target={farmDailyRouteFocusTarget || undefined}
              data-farm-mini-daily-route-focus-title={farmDailyRouteFocusTitle || undefined}
              title={farmDailyRouteFocusTitle || (farmDailyRouteCompleteReceipt ? farmDailyRouteCompleteTitle : `今日路线：${farmDailyRouteMonitorLabel}`)}
              aria-hidden="true"
            >
              <Sparkles size={11} />
              {farmDailyRouteFocusStageLabel && (
                <i data-farm-mini-daily-route-focus-stage="true">{farmDailyRouteFocusStageLabel}</i>
              )}
              <b>{farmDailyRouteFocusLabel || (farmDailyRouteCompleteReceipt ? '路线完成' : farmDailyRouteMonitorLabel)}</b>
              {farmDailyRouteCompleteReceipt ? (
                <small data-farm-mini-daily-route-complete-chip="true">{farmDailyRouteSteps.length}步完成</small>
              ) : (
                <small data-farm-mini-daily-route-focus-meta="true">{farmDailyRouteFocusMetaLabel || `${farmDailyRouteSteps.length}步`}</small>
              )}
            </span>
          )}
          {farmMorningComboReceipt && (
            <span
              className="t8-farm-story-panel__mini-morning-combo"
              data-farm-mini-status-item="morning-combo"
              data-farm-monitor-group="agenda"
              data-farm-mini-morning-combo-receipt="true"
              data-farm-mini-morning-combo-summary={farmMorningComboSummary || undefined}
              data-farm-mini-morning-combo-reward={farmMorningComboRewardLabel || undefined}
              title={`晨报二连完成：${farmMorningComboSummary}${farmMorningComboRewardLabel ? ` · ${farmMorningComboRewardLabel}` : ''}`}
              aria-hidden="true"
            >
              <Sparkles size={11} />
              <b>二连完成</b>
              {farmMorningComboRewardLabel && <small>{farmMorningComboRewardLabel}</small>}
            </span>
          )}
          <button
            type="button"
            data-farm-mini-status-item="wood"
            data-farm-mini-status-clickable="true"
            data-farm-mini-wood-build-opened={farmWoodBuildOpened ? 'true' : undefined}
            data-farm-mini-resource-linked={farmMiniQuickActionResourceTargets.includes('wood') ? 'true' : undefined}
            data-farm-mini-resource-linked-kind="wood"
            data-farm-mini-resource-linked-result={farmMiniQuickActionResourceTargets.includes('wood') ? farmMiniQuickActionFeedback?.label || undefined : undefined}
            data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('wood') ? 'true' : undefined}
            data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('wood') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
            data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('wood') ? farmMiniFocusActionBaseLabel || undefined : undefined}
            title={farmWoodBuildOpened ? `已切到建造，${selectedBuildingDefinition.label} · 木材 ${woodAmount}` : `切到建造，${selectedBuildingDefinition.label} · 木材 ${woodAmount}`}
            aria-label={farmWoodBuildOpened ? `已切到建造，${selectedBuildingDefinition.label}，木材 ${woodAmount}` : `切到建造，${selectedBuildingDefinition.label}，木材 ${woodAmount}`}
            onClick={(event) => {
              event.stopPropagation();
              handleFarmMiniBuildToolAction('wood');
            }}
          >
            <Wheat size={11} />
            <b>木材 {woodAmount}</b>
          </button>
          <button
            type="button"
            data-farm-mini-status-item="stone"
            data-farm-mini-status-clickable="true"
            data-farm-mini-stone-build-opened={farmStoneBuildOpened ? 'true' : undefined}
            data-farm-mini-resource-linked={farmMiniQuickActionResourceTargets.includes('stone') ? 'true' : undefined}
            data-farm-mini-resource-linked-kind="stone"
            data-farm-mini-resource-linked-result={farmMiniQuickActionResourceTargets.includes('stone') ? farmMiniQuickActionFeedback?.label || undefined : undefined}
            data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('stone') ? 'true' : undefined}
            data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('stone') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
            data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('stone') ? farmMiniFocusActionBaseLabel || undefined : undefined}
            title={farmStoneBuildOpened ? `已切到建造，${selectedBuildingDefinition.label} · 石头 ${stoneAmount}` : `切到建造，${selectedBuildingDefinition.label} · 石头 ${stoneAmount}`}
            aria-label={farmStoneBuildOpened ? `已切到建造，${selectedBuildingDefinition.label}，石头 ${stoneAmount}` : `切到建造，${selectedBuildingDefinition.label}，石头 ${stoneAmount}`}
            onClick={(event) => {
              event.stopPropagation();
              handleFarmMiniBuildToolAction('stone');
            }}
          >
            <Hammer size={11} />
            <b>石头 {stoneAmount}</b>
          </button>
          {farmMiniQuickActionResourceFeedbackLabel && (
            <span
              className="t8-farm-story-panel__mini-resource-feedback"
              data-farm-mini-status-item="resource-feedback"
              data-farm-mini-resource-feedback-targets={farmMiniQuickActionResourceTargets.join(' ')}
              data-farm-mini-resource-feedback-result={farmMiniQuickActionFeedback?.label || undefined}
              title={`资源联动：${farmMiniQuickActionResourceFeedbackLabel}`}
              aria-hidden="true"
            >
              <Sparkles size={10} />
              <b>{farmMiniQuickActionResourceFeedbackLabel}</b>
            </span>
          )}
          {farmPlacementHudReceiptLabel && (
            <>
              <button
                type="button"
                className="t8-farm-story-panel__mini-placement-receipt"
                data-farm-mini-status-item="placement-receipt"
                data-farm-mini-status-clickable="true"
                data-farm-mini-placement-receipt-action={farmPlacementHudReceiptKind}
                data-farm-mini-placement-receipt-source={farmPlacementHudReceiptSource || undefined}
                data-farm-mini-placement-receipt-label={farmPlacementHudReceiptLabel}
                data-farm-mini-placement-receipt-canvas-hint={farmPlacementHudReceiptCanvasHint || undefined}
                data-farm-mini-placement-receipt-canvas-tone={farmPlacementHudReceiptCanvasTone}
                data-farm-mini-placement-receipt-next={farmPlacementHudReceiptNextLabel || undefined}
                data-farm-mini-placement-receipt-next-title={farmPlacementHudReceiptNextTitle || undefined}
                data-farm-mini-placement-receipt-next-target={farmPlacementHudReceiptNextTarget || undefined}
                data-farm-mini-placement-receipt-next-target-title={farmPlacementHudReceiptNextTargetTitle || undefined}
                data-farm-mini-placement-receipt-next-target-opened={farmPlacementHudReceiptNextTargetOpened ? 'true' : undefined}
                data-farm-mini-placement-receipt-next-target-opened-title={farmPlacementHudReceiptNextTargetOpenedTitle || undefined}
                data-farm-mini-placement-receipt-next-target-opened-canvas-hint={farmPlacementHudReceiptNextTargetOpenedCanvasHint || undefined}
                data-farm-mini-placement-receipt-next-target-opened-canvas-tone={farmPlacementHudReceiptNextTargetOpenedCanvasHint ? farmPlacementHudReceiptNextTargetOpenedCanvasTone : undefined}
                data-farm-mini-placement-receipt-followup={farmPlacementHudReceiptFollowupLabel || undefined}
                data-farm-mini-placement-receipt-followup-title={farmPlacementHudReceiptFollowupTitle || undefined}
                data-farm-mini-placement-receipt-followup-target={farmPlacementHudReceiptFollowupTarget || undefined}
                data-farm-mini-placement-receipt-followup-action-receipt={farmPlacementFollowupActionReceipt || undefined}
                data-farm-mini-placement-receipt-followup-action-count={farmPlacementHudReceiptFollowupCountLabel || undefined}
                data-farm-mini-placement-receipt-followup-action-resource={farmPlacementHudReceiptFollowupResourceLabel || undefined}
                title={`${farmPlacementHudReceiptCanvasHint} · 画布提示${farmPlacementHudReceiptNextTargetTitle ? ` · ${farmPlacementHudReceiptNextTargetTitle}` : ''}${farmPlacementHudReceiptNextTargetOpenedTitle ? ` · ${farmPlacementHudReceiptNextTargetOpenedTitle}` : ''}${farmPlacementHudReceiptFollowupTitle ? ` · ${farmPlacementHudReceiptFollowupTitle}` : ''}`}
                aria-label={`${farmPlacementHudReceiptCanvasHint}，画布同步提示${farmPlacementHudReceiptNextTargetTitle ? `，${farmPlacementHudReceiptNextTargetTitle}` : ''}${farmPlacementHudReceiptNextTargetOpenedTitle ? `，${farmPlacementHudReceiptNextTargetOpenedTitle}` : ''}${farmPlacementHudReceiptFollowupTitle ? `，${farmPlacementHudReceiptFollowupTitle}` : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleFarmPlacementHudReceiptAction();
                }}
              >
                <Sparkles size={10} />
                <b>{farmPlacementHudReceiptLabel}</b>
                {farmPlacementHudReceiptSource && (
                  <small data-farm-mini-placement-receipt-source-text="true">{farmPlacementHudReceiptSource}</small>
                )}
                {farmPlacementHudReceiptNextLabel && (
                  <i
                    data-farm-mini-placement-receipt-next-text="true"
                    title={farmPlacementHudReceiptNextTargetTitle || farmPlacementHudReceiptNextTitle}
                    aria-hidden="true"
                  >
                    {farmPlacementHudReceiptNextLabel}
                  </i>
                )}
                {farmPlacementHudReceiptNextTargetOpenedTitle && (
                  <strong
                    data-farm-mini-placement-receipt-next-target-opened-chip="true"
                    title={farmPlacementHudReceiptNextTargetOpenedTitle}
                    aria-hidden="true"
                  >
                    已接入
                  </strong>
                )}
                {farmPlacementHudReceiptFollowupLabel && (
                  <i
                    data-farm-mini-placement-receipt-followup-text="true"
                    title={farmPlacementHudReceiptFollowupTitle}
                    aria-hidden="true"
                  >
                    {farmPlacementHudReceiptFollowupLabel}
                  </i>
                )}
                <em data-farm-mini-placement-receipt-action-text="true">{farmPlacementHudReceiptActionLabel}</em>
              </button>
              {farmPlacementHudReceiptFollowupLabel && (
                <button
                  type="button"
                  className="t8-farm-story-panel__mini-placement-followup-action"
                  data-farm-mini-status-item="placement-followup"
                  data-farm-mini-status-clickable="true"
                  data-farm-mini-placement-receipt-followup-action="true"
                  data-farm-mini-placement-receipt-followup-action-target={farmPlacementHudReceiptFollowupTarget || undefined}
                  data-farm-mini-placement-receipt-followup-action-title={farmPlacementHudReceiptFollowupTitle || undefined}
                  data-farm-mini-placement-receipt-followup-action-receipt={farmPlacementFollowupActionReceipt || undefined}
                  data-farm-mini-placement-receipt-followup-action-count={farmPlacementHudReceiptFollowupCountLabel || undefined}
                  data-farm-mini-placement-receipt-followup-action-resource={farmPlacementHudReceiptFollowupResourceLabel || undefined}
                  disabled={farmPlacementFollowupActionBusy}
                  aria-disabled={farmPlacementFollowupActionBusy ? 'true' : undefined}
                  title={farmPlacementFollowupActionReceipt || `${farmPlacementHudReceiptFollowupTitle}${farmPlacementHudReceiptFollowupCountLabel ? ` · 目标 ${farmPlacementHudReceiptFollowupCountLabel}` : ''}${farmPlacementHudReceiptFollowupResourceLabel ? ` · 预期 ${farmPlacementHudReceiptFollowupResourceLabel}` : ''}`}
                  aria-label={farmPlacementFollowupActionReceipt || `接入完成后继续：${farmPlacementHudReceiptFollowupLabel}，${farmPlacementHudReceiptNextTitle}${farmPlacementHudReceiptFollowupCountLabel ? `，目标 ${farmPlacementHudReceiptFollowupCountLabel}` : ''}${farmPlacementHudReceiptFollowupResourceLabel ? `，预期 ${farmPlacementHudReceiptFollowupResourceLabel}` : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmPlacementHudReceiptFollowupAction();
                  }}
                >
                  <Sparkles size={10} />
                  <b>{farmPlacementFollowupActionReceipt ? '已接上' : farmPlacementHudReceiptFollowupLabel}</b>
                  {farmPlacementHudReceiptFollowupCountLabel && (
                    <small data-farm-mini-placement-followup-action-count="true">{farmPlacementHudReceiptFollowupCountLabel}</small>
                  )}
                  {farmPlacementHudReceiptFollowupResourceLabel && (
                    <small data-farm-mini-placement-followup-action-resource="true">{farmPlacementHudReceiptFollowupResourceLabel}</small>
                  )}
                </button>
              )}
              {farmPlacementHudReceiptFollowupRouteLabel && (
                <button
                  type="button"
                  className="t8-farm-story-panel__mini-placement-route-hint"
                  data-farm-mini-status-item="placement-route"
                  data-farm-mini-status-clickable="true"
                  data-farm-mini-placement-receipt-followup-route-hint="true"
                  data-farm-mini-placement-receipt-followup-route-hint-target={farmPlacementHudReceiptFollowupTarget || undefined}
                  data-farm-mini-placement-receipt-followup-route-hint-title={farmPlacementHudReceiptFollowupRouteTitle || undefined}
                  data-farm-mini-placement-receipt-followup-route-hint-count={farmPlacementHudReceiptFollowupCountLabel || undefined}
                  data-farm-mini-placement-receipt-followup-route-hint-resource={farmPlacementHudReceiptFollowupResourceLabel || undefined}
                  data-farm-mini-placement-receipt-followup-route-hint-receipt={farmPlacementRouteHintReceipt || undefined}
                  title={farmPlacementRouteHintReceipt || `${farmPlacementHudReceiptFollowupRouteTitle} · ${farmPlacementHudReceiptNextTitle}`}
                  aria-label={farmPlacementRouteHintReceipt || `查看路线：${farmPlacementHudReceiptFollowupRouteLabel}${farmPlacementHudReceiptFollowupCountLabel ? `，目标 ${farmPlacementHudReceiptFollowupCountLabel}` : ''}${farmPlacementHudReceiptFollowupResourceLabel ? `，预期 ${farmPlacementHudReceiptFollowupResourceLabel}` : ''}，${farmPlacementHudReceiptNextTitle}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmPlacementHudReceiptRouteHintAction();
                  }}
                >
                  <Sparkles size={10} />
                  <b>{farmPlacementRouteHintReceipt || farmPlacementHudReceiptFollowupRouteLabel}</b>
                  {farmPlacementHudReceiptFollowupCountLabel && (
                    <small data-farm-mini-placement-route-hint-count="true">{farmPlacementHudReceiptFollowupCountLabel}</small>
                  )}
                </button>
              )}
            </>
          )}
          {farmMiniBuildingEffectItems.length > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="building-yield-summary"
              data-farm-mini-status-clickable="true"
              data-farm-mini-building-yield-count={farmMiniBuildingEffectItems.length}
              data-farm-mini-building-yield-summary={farmMiniBuildingEffectSummaryLabel}
              data-farm-mini-building-yield-targets={farmMiniBuildingEffectTargetLabel}
              data-farm-mini-building-yield-primary-target={farmMiniBuildingEffectPrimaryTargetLabel || undefined}
              data-farm-mini-building-yield-primary-tone={farmMiniBuildingEffectPrimaryTargetTone || undefined}
              data-farm-mini-building-quest-route-target={farmBuildingEffectQuestPrimary?.routeTarget || undefined}
              data-farm-mini-building-quest-route-label={farmBuildingEffectQuestPrimary?.routeLabel || undefined}
              data-farm-mini-building-quest-route-title={farmBuildingEffectQuestPrimaryTitle || undefined}
              data-farm-mini-building-yield-opened={farmBuildingEffectOpened ? 'true' : undefined}
              data-farm-mini-building-yield-placement-receipt={farmPlacementHudReceiptKind === 'building' ? farmPlacementHudReceiptLabel : undefined}
              data-farm-mini-building-yield-placement-source={farmPlacementHudReceiptKind === 'building' ? farmPlacementHudReceiptSource || undefined : undefined}
              data-farm-mini-placement-followup-route={farmPlacementHudReceiptFollowupTarget === 'building-yield-summary' ? 'true' : undefined}
              data-farm-mini-placement-followup-route-count={farmPlacementHudReceiptFollowupTarget === 'building-yield-summary' ? farmPlacementHudReceiptFollowupCountLabel || undefined : undefined}
              data-farm-mini-placement-followup-route-resource={farmPlacementHudReceiptFollowupTarget === 'building-yield-summary' ? farmPlacementHudReceiptFollowupResourceLabel || undefined : undefined}
              title={`查看${farmMiniBuildingEffectTitleLabel}`}
              aria-label={`查看${farmMiniBuildingEffectTitleLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                if (farmPlacementHudReceiptKind === 'building') {
                  handleFarmPlacementHudReceiptAction();
                  return;
                }
                handleOpenFarmBuildingEffects();
              }}
            >
              <Sparkles size={11} />
              <b>建效{farmMiniBuildingEffectItems.length}</b>
              {farmPlacementHudReceiptKind === 'building' && (
                <small data-farm-mini-placement-receipt-text="true">{farmPlacementHudReceiptLabel}</small>
              )}
              <small data-farm-mini-building-yield-targets-text="true">目标{farmMiniBuildingEffectItems.length}</small>
              {farmMiniBuildingEffectPrimaryTargetLabel && (
                <small data-farm-mini-building-yield-primary-target-text="true">{farmMiniBuildingEffectPrimaryTargetLabel}</small>
              )}
            </button>
          )}
          {farmBuildingEffectQuestPrimary && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-building-quest-route-hint"
              data-farm-mini-status-item="building-quest-route"
              data-farm-mini-building-quest-route-hint="true"
              data-farm-mini-building-quest-route-target={farmBuildingEffectQuestPrimary.routeTarget}
              data-farm-mini-building-quest-route-label={farmBuildingEffectQuestPrimary.routeLabel}
              data-farm-mini-building-quest-route-receipt={farmBuildingEffectQuestRouteReceipt || undefined}
              title={farmBuildingEffectQuestPrimaryTitle}
              aria-label={farmBuildingEffectQuestPrimaryTitle}
              onClick={(event) => {
                event.stopPropagation();
                handleFarmBuildingEffectQuestRouteHintAction(farmBuildingEffectQuestPrimary);
              }}
            >
              <Sparkles size={10} />
              <b>{farmBuildingEffectQuestRouteReceipt || `地图找${farmBuildingEffectQuestPrimary.routeLabel}`}</b>
              {farmBuildingEffectQuestPrimary.countLabel && (
                <small data-farm-mini-building-quest-route-count="true">{farmBuildingEffectQuestPrimary.countLabel}</small>
              )}
            </button>
          )}
          {farmMiniBuildingEffectItems.map((item) => {
            const MiniBuildingIcon = item.icon;
            return (
              <span
                key={item.id}
                data-farm-mini-status-item={`building-${item.id}`}
                data-farm-mini-building-effect={item.id}
                data-farm-mini-building-effect-support={item.supportTone}
                data-farm-mini-building-effect-yield={item.yieldLabel}
                data-farm-mini-building-effect-next={item.nextTargetLabel}
                data-farm-mini-building-effect-next-tone={item.supportTone}
                title={`${item.title} · ${item.yieldLabel} · 目标 ${item.nextTargetLabel}`}
                aria-label={`${item.title} · ${item.yieldLabel} · 目标 ${item.nextTargetLabel}`}
              >
                <MiniBuildingIcon size={11} />
                <b>{item.label}</b>
                <em data-farm-mini-building-effect-yield-text="true">{item.yieldLabel}</em>
                <i data-farm-mini-building-effect-next-text="true">{item.nextTargetLabel}</i>
              </span>
            );
          })}
          {animalCount > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="animal"
              data-farm-mini-status-clickable="true"
              data-farm-mini-animal-mood-summary={farmAnimalMoodSummaryLabel || undefined}
              data-farm-mini-animal-mood-preview={farmAnimalMoodPreviewLabel || undefined}
              data-farm-mini-animal-mood-tone={farmAnimalMoodTone || undefined}
              data-farm-mini-animal-opened={farmAnimalProductOpened ? 'true' : undefined}
              title={`查看动物 ${animalCount} · 心情 ${farmAnimalMoodSummaryLabel || '暂无'}`}
              aria-label={`查看动物 ${animalCount}，心情 ${farmAnimalMoodSummaryLabel || '暂无'}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmAnimals();
              }}
            >
              <PawPrint size={11} />
              <b>畜{animalCount}</b>
              {farmAnimalMoodPreviewLabel && (
                <small data-farm-mini-animal-mood-preview-text="true">{farmAnimalMoodPreviewLabel}</small>
              )}
            </button>
          )}
          {totalAnimalProducts > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="animal-product"
              data-farm-mini-status-clickable="true"
              data-farm-mini-animal-product-summary={animalProductSummary}
              data-farm-mini-animal-product-preview={farmMiniAnimalProductPreviewLabel || undefined}
              data-farm-mini-animal-product-opened={farmAnimalProductOpened ? 'true' : undefined}
              title={`查看动物产物 ${totalAnimalProducts} · ${animalProductSummary || '待收集'}`}
              aria-label={`查看动物产物 ${totalAnimalProducts}，${animalProductSummary || '待收集'}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmAnimals();
              }}
            >
              <Package size={11} />
              <b>产{totalAnimalProducts}</b>
              {farmMiniAnimalProductPreviewLabel && (
                <small data-farm-mini-animal-product-preview-text="true">{farmMiniAnimalProductPreviewLabel}</small>
              )}
            </button>
          )}
          {farmAnimalProductReceiptCount > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="animal-product-receipt"
              data-farm-mini-status-clickable="true"
              data-farm-mini-animal-product-receipt={farmAnimalProductReceiptSummary}
              data-farm-mini-animal-product-receipt-count={farmAnimalProductReceiptCount}
              data-farm-mini-animal-product-receipt-preview={farmMiniAnimalProductReceiptPreviewLabel || undefined}
              data-farm-mini-animal-product-receipt-opened={farmAnimalProductOpened ? 'true' : undefined}
              title={`查看今日动物产出 ${farmAnimalProductReceiptCount} · ${farmAnimalProductReceiptSummary || '暂无'}`}
              aria-label={`查看今日动物产出 ${farmAnimalProductReceiptCount}，${farmAnimalProductReceiptSummary || '暂无'}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmAnimals();
              }}
            >
              <Sparkles size={11} />
              <b>今{farmAnimalProductReceiptCount}</b>
              {farmMiniAnimalProductReceiptPreviewLabel && (
                <small data-farm-mini-animal-product-receipt-preview-text="true">{farmMiniAnimalProductReceiptPreviewLabel}</small>
              )}
            </button>
          )}
          {farmAnimalNextProductCount > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="animal-next-product"
              data-farm-mini-status-clickable="true"
              data-farm-mini-animal-next-products={farmAnimalNextProductSummary}
              data-farm-mini-animal-next-products-count={farmAnimalNextProductCount}
              data-farm-mini-animal-next-products-preview={farmMiniAnimalNextProductPreviewLabel || undefined}
              data-farm-mini-animal-next-products-opened={farmAnimalProductOpened ? 'true' : undefined}
              title={`查看明早动物产出 ${farmAnimalNextProductCount} · ${farmAnimalNextProductSummary || '暂无'}`}
              aria-label={`查看明早动物产出 ${farmAnimalNextProductCount}，${farmAnimalNextProductSummary || '暂无'}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmAnimals();
              }}
            >
              <CalendarDays size={11} />
              <b>明{farmAnimalNextProductCount}</b>
              {farmMiniAnimalNextProductPreviewLabel && (
                <small data-farm-mini-animal-next-products-preview-text="true">{farmMiniAnimalNextProductPreviewLabel}</small>
              )}
            </button>
          )}
          {farmActivityDigest.todayTotal > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="activity"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-opened={farmActivitySectionOpened ? 'true' : undefined}
              data-farm-mini-activity-tone={farmActivityDigest.tone}
              data-farm-mini-activity-action-linked={farmMiniQuickActionBusy ? 'true' : undefined}
              data-farm-mini-activity-action-result={farmMiniQuickActionFeedback?.label || undefined}
              data-farm-mini-activity-followup-receipt={farmActivityRewardStreakActionReceiptEchoLabel || undefined}
              title={farmActivityRewardStreakActionReceiptEchoLabel ? `${farmActivityRewardStreakActionReceiptEchoLabel} · 今日成果 ${farmActivityDigest.todayTotal}/${farmActivityDigest.target} · ${farmActivityDigest.badgeLabel}` : farmActivitySectionOpened ? `已定位今日成果 ${farmActivityDigest.todayTotal}/${farmActivityDigest.target} · ${farmActivityDigest.badgeLabel}` : farmMiniQuickActionBusy ? `刚刚计入：${farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel} · 今日成果 ${farmActivityDigest.todayTotal}/${farmActivityDigest.target} · ${farmActivityDigest.badgeLabel}` : `查看今日成果 ${farmActivityDigest.todayTotal}/${farmActivityDigest.target} · ${farmActivityDigest.badgeLabel}`}
              aria-label={farmActivityRewardStreakActionReceiptEchoLabel ? `${farmActivityRewardStreakActionReceiptEchoLabel}，今日农活 ${farmActivityDigest.todayTotal}/${farmActivityDigest.target}` : farmActivitySectionOpened ? `已展开牧场面板并定位今日成果，今日农活 ${farmActivityDigest.todayTotal}/${farmActivityDigest.target}` : `展开牧场面板查看今日成果，今日农活 ${farmActivityDigest.todayTotal}/${farmActivityDigest.target}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmActivity('section');
              }}
            >
              <Sparkles size={11} />
              <b>活{farmActivityDigest.todayTotal}</b>
            </button>
          )}
          {farmActivityDigest.rewardStreakLabel && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-activity-streak"
              data-farm-mini-status-item="activity-streak"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-streak-opened={farmActivityStreakOpened ? 'true' : undefined}
              data-farm-mini-activity-reward-streak={farmActivityDigest.rewardStreak}
              data-farm-mini-activity-reward-streak-tier={farmActivityDigest.rewardStreakTier || undefined}
              title={farmActivityStreakOpened ? `已定位今日连击 ${farmActivityDigest.rewardStreakLabel}` : farmMiniActivityStreakTitle}
              aria-label={farmActivityStreakOpened ? `已展开牧场面板并定位今日连击，${farmActivityDigest.rewardStreakLabel}` : `展开牧场面板查看今日连击，${farmActivityDigest.rewardStreakLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmActivity('streak');
              }}
            >
              <Sparkles size={10} />
              <b>{farmActivityDigest.rewardStreakLabel}</b>
            </button>
          )}
          {farmActivityDigest.rewardStreakMilestoneLabel && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-activity-streak-milestone"
              data-farm-mini-status-item="activity-streak-milestone"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-streak-milestone-opened={farmActivityMilestoneOpened ? 'true' : undefined}
              data-farm-mini-activity-reward-streak-tier={farmActivityDigest.rewardStreakTier || undefined}
              title={farmActivityMilestoneOpened ? `已定位连击里程碑 ${farmActivityDigest.rewardStreakMilestoneLabel}` : `查看连击里程碑：${farmActivityDigest.rewardStreakMilestoneLabel}`}
              aria-label={farmActivityMilestoneOpened ? `已展开牧场面板并定位连击里程碑，${farmActivityDigest.rewardStreakMilestoneLabel}` : `展开牧场面板查看连击里程碑，${farmActivityDigest.rewardStreakMilestoneLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmActivity('milestone');
              }}
            >
              <Sparkles size={10} />
              <b>{farmActivityDigest.rewardStreakMilestoneLabel}</b>
            </button>
          )}
          {farmActivityDigest.rewardStreakMilestonePercent !== undefined && farmActivityDigest.rewardStreakMilestoneProgressLabel && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-streak-meter"
              data-farm-mini-status-item="activity-streak-meter"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-streak-meter-opened={farmActivityFocusTarget === 'streak-meter' ? 'true' : undefined}
              data-farm-mini-activity-reward-streak-tier={farmActivityDigest.rewardStreakTier || undefined}
              data-farm-mini-activity-reward-streak-progress={farmActivityDigest.rewardStreakMilestoneProgressLabel}
              data-farm-mini-activity-reward-streak-complete={farmActivityDigest.rewardStreakMilestonePercent === 100 ? 'true' : undefined}
              title={farmActivityFocusTarget === 'streak-meter' ? `已定位连击进度 ${farmActivityDigest.rewardStreakMilestoneProgressLabel} · ${farmActivityDigest.rewardStreakMilestoneLabel || '保持正反馈'}` : `查看连击进度：${farmActivityDigest.rewardStreakMilestoneProgressLabel} · ${farmActivityDigest.rewardStreakMilestoneLabel || '保持正反馈'}`}
              aria-label={farmActivityFocusTarget === 'streak-meter' ? `已展开牧场面板并定位连击进度，${farmActivityDigest.rewardStreakMilestoneProgressLabel}` : `展开牧场面板查看连击进度，${farmActivityDigest.rewardStreakMilestoneProgressLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmActivity('streak-meter');
              }}
            >
              <i style={{ width: `${farmActivityDigest.rewardStreakMilestonePercent}%` }} />
              <b>{farmActivityDigest.rewardStreakMilestoneProgressLabel}</b>
              {farmActivityDigest.rewardStreakMilestonePercent === 100 && (
                <strong data-farm-mini-activity-reward-streak-complete="true">已点亮</strong>
              )}
            </button>
          )}
          {farmActivityDigest.rewardStreakMilestoneCompletionLabel && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-activity-streak-completion"
              data-farm-mini-status-item="activity-streak-completion"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-streak-completion-opened={farmActivityFocusTarget === 'completion' ? 'true' : undefined}
              data-farm-mini-activity-reward-streak-tier={farmActivityDigest.rewardStreakTier || undefined}
              title={farmActivityFocusTarget === 'completion' ? `已定位连击完成：${farmActivityDigest.rewardStreakMilestoneCompletionLabel}` : `查看连击完成：${farmActivityDigest.rewardStreakMilestoneCompletionLabel}`}
              aria-label={farmActivityFocusTarget === 'completion' ? `已展开牧场面板并定位连击完成，${farmActivityDigest.rewardStreakMilestoneCompletionLabel}` : `展开牧场面板查看连击完成，${farmActivityDigest.rewardStreakMilestoneCompletionLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmActivity('completion');
              }}
            >
              <Sparkles size={10} />
              <b>奖励已亮</b>
            </button>
          )}
          {farmActivityDigest.rewardStreakMilestoneRewardItems?.length && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-activity-streak-reward"
              data-farm-mini-status-item="activity-streak-reward"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-reward-opened={farmRewardDetailOpened ? 'true' : undefined}
              data-farm-mini-activity-reward-streak-tier={farmActivityDigest.rewardStreakTier || undefined}
              data-farm-mini-activity-reward-streak-items={farmActivityDigest.rewardStreakMilestoneRewardItems.join(' ')}
              data-farm-mini-reward-pocket-target={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('activity-streak-reward') ? 'true' : undefined}
              data-farm-mini-reward-pocket-target-label={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('activity-streak-reward') ? farmActivityChestClaimNextReceiptRewardPocketTargetsLabel : undefined}
              data-farm-mini-reward-pocket-target-opened={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('activity-streak-reward') && farmRewardDetailOpened ? 'true' : undefined}
              title={`${farmRewardDetailOpened ? '已展开奖励印章' : '展开查看连击奖励印章'}：${farmActivityDigest.rewardStreakMilestoneRewardItems.join('、')}`}
              aria-label={`${farmRewardDetailOpened ? '已展开牧场面板并定位连击奖励印章' : '展开牧场面板查看连击奖励印章'}：${farmActivityDigest.rewardStreakMilestoneRewardItems.join('、')}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmRewardDetail();
              }}
            >
              <Sparkles size={10} />
              <b>{farmRewardDetailOpened ? '已展开' : farmMiniActivityRewardStampLabel}</b>
            </button>
          )}
          {farmActivityDigest.rewardStreakChestLabel && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-activity-streak-chest"
              data-farm-mini-status-item="activity-streak-chest"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-streak-chest-opened={farmActivityFocusTarget === 'chest' ? 'true' : undefined}
              data-farm-mini-activity-streak-chest-state={farmActivityDigest.rewardStreakChestState || undefined}
              data-farm-mini-activity-streak-chest-tier={farmActivityDigest.rewardStreakChestTier || undefined}
              data-farm-mini-activity-streak-chest-progress={farmActivityDigest.rewardStreakChestProgressLabel || undefined}
              data-farm-mini-activity-streak-chest-remaining={farmActivityDigest.rewardStreakChestRemaining ?? undefined}
              data-farm-mini-activity-streak-chest-remaining-label={farmActivityDigest.rewardStreakChestRemainingLabel || undefined}
              data-farm-mini-activity-streak-chest-trail={farmActivityDigest.rewardStreakChestTrailLabel || undefined}
              data-farm-mini-activity-streak-chest-trail-reward={farmActivityDigest.rewardStreakChestTrailRewardLabel || undefined}
              data-farm-mini-activity-streak-chest-reward={farmActivityDigest.rewardStreakChestRewardLabel || undefined}
              data-farm-mini-activity-streak-chest-claimed={farmActivityChestClaimed ? 'true' : undefined}
              data-farm-mini-activity-streak-chest-cta={farmActivityDigest.rewardStreakChestCtaLabel || undefined}
              data-farm-mini-activity-streak-chest-claim={farmActivityDigest.rewardStreakChestClaimLabel || undefined}
              data-farm-mini-activity-streak-chest-next={farmActivityDigest.rewardStreakChestNextLabel || undefined}
              data-farm-mini-activity-streak-chest-items={farmActivityDigest.rewardStreakChestRewardItems?.join(' ') || undefined}
              data-farm-mini-activity-streak-chest-burst={farmActivityDigest.rewardStreakChestBurstLabel || undefined}
              data-farm-mini-activity-streak-chest-opened-summary={farmActivityDigest.rewardStreakChestOpenedSummaryLabel || undefined}
              data-farm-mini-activity-streak-chest-percent={farmActivityDigest.rewardStreakChestPercent ?? undefined}
              data-farm-mini-activity-streak-chest-meter={farmActivityDigest.rewardStreakChestMeterLabel || undefined}
              data-farm-mini-activity-streak-chest-active-stage={farmActivityDigest.rewardStreakChestActiveTrailLabel || undefined}
              data-farm-mini-activity-streak-chest-active-reward={farmActivityDigest.rewardStreakChestActiveRewardLabel || undefined}
              data-farm-mini-activity-streak-chest-charge={farmActivityDigest.rewardStreakChestChargeLabel || undefined}
              data-farm-mini-activity-streak-chest-charge-short={farmActivityDigest.rewardStreakChestChargeShortLabel || undefined}
              data-farm-mini-activity-streak-chest-claim-next-action={farmActivityChestClaimed && farmActivityRewardStreakGoal ? 'true' : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-kind={farmActivityChestClaimed ? farmActivityDigest.rewardStreakActionKind || undefined : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-route-target={farmActivityChestClaimed ? farmActivityRewardStreakActionRouteTarget || undefined : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-route-label={farmActivityChestClaimed ? farmActivityRewardStreakActionRouteLabel || undefined : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-resource-targets={farmActivityChestClaimed ? farmActivityRewardStreakActionResourceTargets.join(' ') || undefined : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-resource-preview={farmActivityChestClaimed ? farmActivityRewardStreakActionResourcePreview || undefined : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt={farmActivityChestClaimNextReceipt || undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-resource={farmActivityChestClaimNextReceipt && farmActivityRewardStreakActionResourcePreview ? farmActivityRewardStreakActionResourcePreview : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-next={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptNextLabel ? farmActivityChestClaimNextReceiptNextLabel : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-progress={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptProgressTitle ? farmActivityChestClaimNextReceiptProgressTitle : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-progress-state={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptProgressTitle ? farmActivityChestClaimNextReceiptProgressState : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-milestone={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptMilestoneTitle ? farmActivityChestClaimNextReceiptMilestoneTitle : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardTitle ? farmActivityChestClaimNextReceiptRewardTitle : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-items={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardItems.length ? farmActivityChestClaimNextReceiptRewardItems.join(' ') : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTitle ? farmActivityChestClaimNextReceiptRewardPocketTitle : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-targets={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.length ? farmActivityChestClaimNextReceiptRewardPocketTargets.join(' ') : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-targets-label={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargetsLabel ? farmActivityChestClaimNextReceiptRewardPocketTargetsLabel : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-collected={farmActivityChestClaimNextReceiptRewardPocketAnyTargetOpened ? 'true' : undefined}
              data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-followup={farmActivityChestClaimNextReceiptRewardPocketFollowupLabel || undefined}
              title={farmActivityChestClaimed
                ? farmActivityRewardStreakGoal
                  ? `下一轮继续：${farmActivityRewardStreakGoal.actionLabel}${farmActivityRewardStreakActionResourcePreview ? ` · ${farmActivityRewardStreakActionResourcePreview}` : ''} · 开箱已入袋：${farmActivityDigest.rewardStreakChestOpenedSummaryLabel || farmActivityDigest.rewardStreakChestClaimLabel || farmActivityDigest.rewardStreakChestRewardLabel || farmActivityDigest.rewardStreakChestLabel}`
                  : `开箱已入袋：${farmActivityDigest.rewardStreakChestOpenedSummaryLabel || farmActivityDigest.rewardStreakChestClaimLabel || farmActivityDigest.rewardStreakChestRewardLabel || farmActivityDigest.rewardStreakChestLabel}`
                : farmActivityDigest.rewardStreakChestState === 'ready'
                  ? `${farmActivityDigest.rewardStreakChestCtaLabel || '开宝箱'}：${farmActivityDigest.rewardStreakChestRewardLabel || farmActivityDigest.rewardStreakChestLabel}${farmActivityDigest.rewardStreakChestActiveHint ? ` · ${farmActivityDigest.rewardStreakChestActiveHint}` : ''}${farmActivityDigest.rewardStreakChestRemainingLabel ? ` · ${farmActivityDigest.rewardStreakChestRemainingLabel}` : ''}`
                  : farmActivityFocusTarget === 'chest'
                    ? `已定位连击宝箱：${farmActivityDigest.rewardStreakChestLabel}${farmActivityDigest.rewardStreakChestActiveHint ? ` · ${farmActivityDigest.rewardStreakChestActiveHint}` : ''}${farmActivityDigest.rewardStreakChestRemainingLabel ? ` · ${farmActivityDigest.rewardStreakChestRemainingLabel}` : ''}`
                    : `查看连击宝箱：${farmActivityDigest.rewardStreakChestLabel}${farmActivityDigest.rewardStreakChestActiveHint ? ` · ${farmActivityDigest.rewardStreakChestActiveHint}` : ''}${farmActivityDigest.rewardStreakChestRemainingLabel ? ` · ${farmActivityDigest.rewardStreakChestRemainingLabel}` : ''}`}
              aria-label={farmActivityChestClaimed
                ? farmActivityRewardStreakGoal
                  ? `开箱已入袋，继续今日成果连击，${farmActivityRewardStreakGoal.actionLabel}${farmActivityRewardStreakActionResourcePreview ? `，${farmActivityRewardStreakActionResourcePreview}` : ''}`
                  : `开箱已入袋，${farmActivityDigest.rewardStreakChestOpenedSummaryLabel || farmActivityDigest.rewardStreakChestClaimLabel || farmActivityDigest.rewardStreakChestRewardLabel || farmActivityDigest.rewardStreakChestLabel}`
                : farmActivityDigest.rewardStreakChestState === 'ready'
                  ? `开宝箱，${farmActivityDigest.rewardStreakChestRewardLabel || farmActivityDigest.rewardStreakChestLabel}${farmActivityDigest.rewardStreakChestRemainingLabel ? `，${farmActivityDigest.rewardStreakChestRemainingLabel}` : ''}`
                  : farmActivityFocusTarget === 'chest'
                    ? `已展开牧场面板并定位连击宝箱，${farmActivityDigest.rewardStreakChestLabel}${farmActivityDigest.rewardStreakChestActiveHint ? `，${farmActivityDigest.rewardStreakChestActiveHint}` : ''}${farmActivityDigest.rewardStreakChestRemainingLabel ? `，${farmActivityDigest.rewardStreakChestRemainingLabel}` : ''}`
                    : `展开牧场面板查看连击宝箱，${farmActivityDigest.rewardStreakChestLabel}${farmActivityDigest.rewardStreakChestActiveHint ? `，${farmActivityDigest.rewardStreakChestActiveHint}` : ''}${farmActivityDigest.rewardStreakChestRemainingLabel ? `，${farmActivityDigest.rewardStreakChestRemainingLabel}` : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                if (farmActivityChestClaimed && farmActivityRewardStreakGoal) {
                  handleFarmActivityChestClaimNextAction();
                  return;
                }
                handleFarmActivityChestAction();
              }}
            >
              <Package size={10} />
              <b>{farmActivityChestClaimed ? '已入袋' : farmMiniActivityStreakChestLabel}</b>
              {farmActivityChestClaimed && farmActivityDigest.rewardStreakChestBurstLabel ? (
                <small data-farm-mini-activity-streak-chest-burst="true">{farmActivityDigest.rewardStreakChestBurstLabel}</small>
              ) : farmActivityDigest.rewardStreakChestProgressLabel ? (
                <small>{farmActivityDigest.rewardStreakChestProgressLabel}</small>
              ) : null}
              {farmActivityDigest.rewardStreakChestRemainingLabel && (
                <i data-farm-mini-activity-streak-chest-remaining-label="true">
                  {farmActivityDigest.rewardStreakChestRemainingLabel}
                </i>
              )}
              {farmActivityDigest.rewardStreakChestTrailItems?.length && (
                <span
                  data-farm-mini-activity-streak-chest-trail="true"
                  data-farm-mini-activity-streak-chest-trail-continued={farmActivityChestClaimNextReceipt ? 'true' : undefined}
                  data-farm-mini-activity-streak-chest-trail-continued-label={farmActivityChestClaimNextReceipt || undefined}
                  data-farm-mini-activity-streak-chest-trail-pocketed={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTitle ? 'true' : undefined}
                  data-farm-mini-activity-streak-chest-trail-pocketed-label={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTitle ? farmActivityChestClaimNextReceiptRewardPocketTitle : undefined}
                  data-farm-mini-activity-streak-chest-trail-followup-receipt={farmActivityRewardStreakActionReceiptFollowupLabel ? 'true' : undefined}
                  data-farm-mini-activity-streak-chest-trail-followup-receipt-label={farmActivityRewardStreakActionReceiptFollowupLabel || undefined}
                  title={`${farmActivityDigest.rewardStreakChestTrailLabel}${farmActivityDigest.rewardStreakChestTrailRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestTrailRewardLabel}` : ''}${farmActivityChestClaimNextReceipt ? ` · ${farmActivityChestClaimNextReceipt}` : ''}${farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTitle ? ` · ${farmActivityChestClaimNextReceiptRewardPocketTitle}` : ''}${farmActivityRewardStreakActionReceiptFollowupLabel ? ` · ${farmActivityRewardStreakActionReceiptFollowupLabel}` : ''}`}
                  aria-hidden="true"
                >
                  {farmActivityDigest.rewardStreakChestTrailItems.map((item) => (
                    <i
                      key={item.tier}
                      data-farm-mini-activity-streak-chest-trail-item={item.tier}
                      data-farm-mini-activity-streak-chest-trail-state={item.state}
                      data-farm-mini-activity-streak-chest-trail-reward={item.shortRewardLabel}
                      title={`${item.label}：${item.progressLabel} · ${item.shortRewardLabel}`}
                    />
                  ))}
                </span>
              )}
              {farmActivityDigest.rewardStreakChestActiveRewardLabel && (
                <i
                  data-farm-mini-activity-streak-chest-active-reward="true"
                  title={`${farmActivityDigest.rewardStreakChestActiveTrailLabel || '当前阶段'} · ${farmActivityDigest.rewardStreakChestActiveHint || farmActivityDigest.rewardStreakChestActiveRewardLabel}`}
                >
                  {farmActivityDigest.rewardStreakChestActiveRewardLabel.replace('当前奖励：', '')}
                </i>
              )}
              {farmActivityChestClaimed && farmActivityRewardStreakGoal && (
                <i
                  data-farm-mini-activity-streak-chest-claim-next-action-label="true"
                  data-farm-mini-activity-streak-chest-claim-next-action-kind={farmActivityDigest.rewardStreakActionKind || undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-followup-target={farmActivityChestClaimNextReceiptRewardPocketAnyTargetOpened ? 'true' : undefined}
                  title={farmMiniQuickActionBusy
                    ? farmMiniQuickActionFeedback?.label || '续连击中'
                    : farmActivityChestClaimNextReceiptRewardPocketFollowupLabel
                      ? `收纳完成，${farmActivityChestClaimNextReceiptRewardPocketFollowupLabel}`
                      : `下一轮继续：${farmActivityRewardStreakGoal.actionLabel}`}
                  aria-hidden="true"
                >
                  {farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || '续连击中' : `续${farmActivityRewardStreakGoal.actionLabel}`}
                </i>
              )}
              {farmActivityChestClaimed && farmActivityRewardStreakActionRouteLabel && (
                <i
                  data-farm-mini-activity-streak-chest-claim-next-action-route="true"
                  data-farm-mini-activity-streak-chest-claim-next-action-route-target={farmActivityRewardStreakActionRouteTarget || undefined}
                  title={`下一轮路线：地图找${farmActivityRewardStreakActionRouteLabel}`}
                  aria-hidden="true"
                >
                  {farmActivityRewardStreakActionReceiptRouteReceipt || `图${farmActivityRewardStreakActionRouteLabel}`}
                </i>
              )}
              {farmActivityChestClaimed && farmActivityRewardStreakActionResourcePreview && (
                <i
                  data-farm-mini-activity-streak-chest-claim-next-action-resource="true"
                  data-farm-mini-activity-streak-chest-claim-next-action-resource-targets={farmActivityRewardStreakActionResourceTargets.join(' ') || undefined}
                  title={`续连击资源预期：${farmActivityRewardStreakActionResourcePreview}`}
                  aria-hidden="true"
                >
                  {farmActivityRewardStreakActionResourcePreview.replace('预期：', '')}
                </i>
              )}
              {farmActivityChestClaimNextReceipt && (
                <small
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt="true"
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-resource={farmActivityRewardStreakActionResourcePreview || undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-milestone={farmActivityChestClaimNextReceiptMilestoneTitle || undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward={farmActivityChestClaimNextReceiptRewardTitle || undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-items={farmActivityChestClaimNextReceiptRewardItems.join(' ') || undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket={farmActivityChestClaimNextReceiptRewardPocketTitle || undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-targets={farmActivityChestClaimNextReceiptRewardPocketTargets.join(' ') || undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-targets-label={farmActivityChestClaimNextReceiptRewardPocketTargetsLabel || undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-collected={farmActivityChestClaimNextReceiptRewardPocketAnyTargetOpened ? 'true' : undefined}
                  data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-followup={farmActivityChestClaimNextReceiptRewardPocketFollowupLabel || undefined}
                  role="status"
                  aria-live="polite"
                  title={`${farmActivityChestClaimNextReceipt}${farmActivityRewardStreakActionResourcePreview ? ` · ${farmActivityRewardStreakActionResourcePreview}` : ''}${farmActivityChestClaimNextReceiptProgressTitle ? ` · ${farmActivityChestClaimNextReceiptProgressTitle}` : ''}${farmActivityChestClaimNextReceiptMilestoneTitle ? ` · ${farmActivityChestClaimNextReceiptMilestoneTitle}` : ''}${farmActivityChestClaimNextReceiptRewardTitle ? ` · ${farmActivityChestClaimNextReceiptRewardTitle}` : ''}${farmActivityChestClaimNextReceiptRewardPocketTitle ? ` · ${farmActivityChestClaimNextReceiptRewardPocketTitle}` : ''}${farmActivityChestClaimNextReceiptRewardPocketFollowupLabel ? ` · 收纳后下一步：${farmActivityChestClaimNextReceiptRewardPocketFollowupLabel}` : ''}${farmActivityChestClaimNextReceiptNextLabel ? ` · ${farmActivityChestClaimNextReceiptNextLabel}` : ''}`}
                >
                  <Sparkles size={9} />
                  {farmActivityChestClaimNextReceipt}
                  {farmActivityChestClaimNextReceiptProgressTitle && (
                    <i
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-progress-label="true"
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-progress-state={farmActivityChestClaimNextReceiptProgressState}
                      title={farmActivityChestClaimNextReceiptProgressTitle}
                      aria-hidden="true"
                    >
                      {farmActivityChestClaimNextReceiptProgressLabel}
                    </i>
                  )}
                  {farmActivityChestClaimNextReceiptMilestoneTitle && (
                    <i
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-milestone-label="true"
                      title={farmActivityChestClaimNextReceiptMilestoneTitle}
                      aria-hidden="true"
                    >
                      {farmActivityChestClaimNextReceiptMilestoneLabel}
                    </i>
                  )}
                  {farmActivityChestClaimNextReceiptRewardLabel && (
                    <i
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-label="true"
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-items={farmActivityChestClaimNextReceiptRewardItems.join(' ') || undefined}
                      title={farmActivityChestClaimNextReceiptRewardTitle}
                      aria-hidden="true"
                    >
                      {farmActivityChestClaimNextReceiptRewardLabel}
                    </i>
                  )}
                  {farmActivityChestClaimNextReceiptRewardShortItems.length > 0 && (
                    <span
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-stamps="true"
                      aria-label={`本次点亮奖励印章：${farmActivityChestClaimNextReceiptRewardItems.join('、')}`}
                      title={farmActivityChestClaimNextReceiptRewardTitle}
                    >
                      {farmActivityChestClaimNextReceiptRewardShortItems.map((item, index) => (
                        <b
                          key={`${item}-${index}`}
                          data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-stamp={farmActivityChestClaimNextReceiptRewardItems[index]}
                          style={{ '--farm-mini-reward-stamp-index': index } as CSSProperties}
                        >
                          {item}
                        </b>
                      ))}
                    </span>
                  )}
                  {farmActivityChestClaimNextReceiptRewardPocketLabel && (
                    <i
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-label="true"
                      title={farmActivityChestClaimNextReceiptRewardPocketTitle}
                      aria-hidden="true"
                    >
                      {farmActivityChestClaimNextReceiptRewardPocketLabel}
                    </i>
                  )}
                  {farmActivityChestClaimNextReceiptRewardPocketTargetsShortLabel && (
                    <i
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-target-label="true"
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-targets={farmActivityChestClaimNextReceiptRewardPocketTargets.join(' ') || undefined}
                      title={farmActivityChestClaimNextReceiptRewardPocketTargetsLabel}
                      aria-hidden="true"
                    >
                      {farmActivityChestClaimNextReceiptRewardPocketTargetsShortLabel}
                    </i>
                  )}
                  {farmActivityChestClaimNextReceiptRewardPocketFollowupLabel && (
                    <i
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-reward-pocket-followup-label="true"
                      title={`收纳完成，下一步：${farmActivityChestClaimNextReceiptRewardPocketFollowupLabel}`}
                      aria-hidden="true"
                    >
                      {farmActivityChestClaimNextReceiptRewardPocketFollowupLabel}
                    </i>
                  )}
                  {farmActivityChestClaimNextReceiptNextLabel && (
                    <i
                      data-farm-mini-activity-streak-chest-claim-next-action-receipt-next-label="true"
                      title={`续连击下一段：${farmActivityChestClaimNextReceiptNextLabel}`}
                      aria-hidden="true"
                    >
                      {farmActivityChestClaimNextReceiptNextShortLabel}
                    </i>
                  )}
                  {farmActivityRewardStreakActionResourcePreview && (
                    <i data-farm-mini-activity-streak-chest-claim-next-action-receipt-resource-label="true">
                      {farmActivityRewardStreakActionResourcePreview.replace('预期：', '')}
                    </i>
                  )}
                </small>
              )}
            </button>
          )}
          {farmActivityChestClaimed && farmActivityRewardStreakActionRouteLabel && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-chest-route-hint"
              data-farm-mini-status-item="activity-chest-route"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-streak-chest-route-hint="true"
              data-farm-mini-activity-streak-chest-route-target={farmActivityRewardStreakActionRouteTarget || undefined}
              data-farm-mini-activity-streak-chest-route-label={farmActivityRewardStreakActionRouteLabel || undefined}
              data-farm-mini-activity-streak-chest-route-receipt={farmActivityRewardStreakActionReceiptRouteReceipt || undefined}
              title={farmActivityRewardStreakActionReceiptRouteReceipt || `地图找${farmActivityRewardStreakActionRouteLabel} · ${farmActivityRewardStreakActionReceiptNextTitle || farmActivityRewardStreakGoal?.actionLabel || '下一步'}`}
              aria-label={farmActivityRewardStreakActionReceiptRouteReceipt || `地图找${farmActivityRewardStreakActionRouteLabel}，不会执行下一步动作`}
              onClick={(event) => {
                event.stopPropagation();
                handleFarmActivityRewardStreakRouteHintAction();
              }}
            >
              <Sparkles size={10} />
              <b>{farmActivityRewardStreakActionReceiptRouteReceipt || `地图找${farmActivityRewardStreakActionRouteLabel}`}</b>
            </button>
          )}
          {farmMiniQuickActionActivityFeedbackLabel && (
            <span
              className="t8-farm-story-panel__mini-activity-feedback"
              data-farm-mini-status-item="activity-feedback"
              data-farm-mini-activity-feedback-result={farmMiniQuickActionFeedback?.label || undefined}
              title={`今日成果：${farmMiniQuickActionActivityFeedbackLabel}`}
              aria-hidden="true"
            >
              <Sparkles size={10} />
              <b>{farmMiniQuickActionActivityFeedbackLabel}</b>
            </span>
          )}
          {farmActivityDigest.rewardStreakActionLabel && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-activity-action"
              data-farm-mini-status-item="activity-action"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-streak-action-opened={farmActivityFocusTarget === 'action' ? 'true' : undefined}
              data-farm-mini-activity-streak-action={farmActivityDigest.rewardStreakActionKind}
              data-farm-mini-activity-streak-action-short-label={farmActivityDigest.rewardStreakActionShortLabel || undefined}
              data-farm-mini-activity-streak-action-fired={farmMiniQuickActionBusy ? 'true' : undefined}
              data-farm-mini-activity-streak-action-result={farmMiniQuickActionFeedback?.label || undefined}
              data-farm-mini-activity-streak-action-receipt={farmActivityRewardStreakActionReceipt || undefined}
              data-farm-mini-reward-pocket-followup-action={farmActivityChestClaimNextReceiptRewardPocketFollowupLabel ? 'true' : undefined}
              data-farm-mini-reward-pocket-followup-action-label={farmActivityChestClaimNextReceiptRewardPocketFollowupLabel || undefined}
              data-farm-mini-reward-pocket-followup-action-receipt={farmActivityRewardStreakActionReceiptFollowupLabel || undefined}
              title={farmActivityRewardStreakActionReceiptFollowupLabel
                ? `奖励已收纳，${farmActivityRewardStreakActionReceiptFollowupLabel}`
                : farmActivityChestClaimNextReceiptRewardPocketFollowupLabel
                ? `收纳后继续：${farmActivityChestClaimNextReceiptRewardPocketFollowupLabel}`
                : farmActivityRewardStreakGoal ? `执行连击建议：${farmActivityDigest.rewardStreakActionLabel}` : farmActivityFocusTarget === 'action' ? `已定位连击建议：${farmActivityDigest.rewardStreakActionLabel}` : `查看连击建议：${farmActivityDigest.rewardStreakActionLabel}`}
              aria-label={farmActivityRewardStreakActionReceiptFollowupLabel
                ? `奖励已收纳，${farmActivityRewardStreakActionReceiptFollowupLabel}`
                : farmActivityChestClaimNextReceiptRewardPocketFollowupLabel
                ? `奖励已收纳，下一步：${farmActivityChestClaimNextReceiptRewardPocketFollowupLabel}`
                : farmActivityRewardStreakGoal ? `执行连击建议，${farmActivityDigest.rewardStreakActionLabel}` : farmActivityFocusTarget === 'action' ? `已展开牧场面板并定位连击建议，${farmActivityDigest.rewardStreakActionLabel}` : `展开牧场面板查看连击建议，${farmActivityDigest.rewardStreakActionLabel}`}
              onClick={(event) => {
                event.stopPropagation();
                handleFarmActivityRewardStreakAction();
              }}
            >
              <Sparkles size={10} />
              <b>{farmMiniActivityStreakActionLabel}</b>
            </button>
          )}
          {farmActivityRewardStreakActionReceiptEchoLabel && farmActivityRewardStreakActionReceiptNextHint && (
            <button
              type="button"
              className="t8-farm-story-panel__mini-followup-action-card"
              data-farm-mini-status-item="followup-action-card"
              data-farm-mini-followup-action-card="true"
              data-farm-mini-followup-action-route-target={farmActivityRewardStreakActionReceiptRouteTarget || undefined}
              data-farm-mini-followup-action-route-label={farmActivityRewardStreakActionReceiptRouteLabel || undefined}
              data-farm-mini-followup-action-route-receipt={farmActivityRewardStreakActionReceiptRouteReceipt || undefined}
              data-farm-mini-followup-action-target={farmActivityRewardStreakActionReceiptNextTarget || undefined}
              data-farm-mini-followup-action-badge={farmActivityRewardStreakActionReceiptNextBadgeLabel || undefined}
              data-farm-mini-followup-action-count={farmActivityRewardStreakActionReceiptNextCountLabel || undefined}
              data-farm-mini-followup-action-resource-targets={farmActivityRewardStreakActionResourceTargets.join(' ') || undefined}
              data-farm-mini-followup-action-resource-preview={farmActivityRewardStreakActionResourcePreview || undefined}
              data-farm-mini-followup-action-canvas-hint={farmActivityRewardStreakActionReceiptCanvasHint || undefined}
              data-farm-mini-followup-action-canvas-tone={farmActivityRewardStreakActionReceiptCanvasTone || undefined}
              title={farmActivityRewardStreakActionReceiptNextTitle}
              aria-label={`接上后下一步：${farmActivityRewardStreakActionReceiptNextHint.replace('下一步：', '')}${farmActivityRewardStreakActionReceiptNextCountLabel ? `，目标 ${farmActivityRewardStreakActionReceiptNextCountLabel}` : ''}${farmActivityRewardStreakActionResourcePreview ? `，${farmActivityRewardStreakActionResourcePreview}` : ''}`}
              aria-live="polite"
              onClick={(event) => {
                event.stopPropagation();
                if (farmActivityRewardStreakActionReceiptCanvasHint) {
                  if (farmActivityRewardStreakActionReceiptRouteTarget) {
                    flashFarmActivityRewardStreakRouteHint('已指路');
                  }
                  onFollowupCanvasHint?.({
                    message: `已定位：${farmActivityRewardStreakActionReceiptCanvasHint}`,
                    tone: farmActivityRewardStreakActionReceiptCanvasTone,
                    routeTarget: farmActivityRewardStreakActionReceiptRouteTarget,
                    routeLabel: farmActivityRewardStreakActionReceiptRouteLabel,
                    routeTitle: farmActivityRewardStreakActionReceiptNextTitle,
                  });
                }
                handleOpenFarmActivity('action');
              }}
            >
              <Sparkles size={10} />
              <b>{farmActivityRewardStreakActionReceiptNextBadgeLabel || '下一步'}</b>
              {farmActivityRewardStreakActionReceiptRouteTarget && (
                <em
                  data-farm-mini-followup-action-route-hint="true"
                  data-farm-mini-followup-action-route-hint-target={farmActivityRewardStreakActionReceiptRouteTarget}
                  data-farm-mini-followup-action-route-hint-label={farmActivityRewardStreakActionReceiptRouteLabel || undefined}
                  title={farmActivityRewardStreakActionReceiptRouteLabel ? `地图找${farmActivityRewardStreakActionReceiptRouteLabel}` : '地图找目标'}
                  aria-hidden="true"
                >
                  {farmActivityRewardStreakActionReceiptRouteReceipt || '地图找目标'}
                </em>
              )}
              <span>{farmActivityRewardStreakActionReceiptNextHint.replace('下一步：', '')}</span>
              {farmActivityRewardStreakActionReceiptNextCountLabel && (
                <i data-farm-mini-followup-action-count="true">
                  {farmActivityRewardStreakActionReceiptNextCountLabel}
                </i>
              )}
              {farmActivityRewardStreakActionResourcePreview && (
                <small data-farm-mini-followup-action-resource="true">
                  {farmActivityRewardStreakActionResourcePreview.replace('预期：', '')}
                </small>
              )}
            </button>
          )}
          {farmActivityDigest.todayRewardTotal > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="activity-reward"
              data-farm-mini-status-clickable="true"
              data-farm-mini-activity-reward-digest-opened={farmActivityRewardDigestOpened ? 'true' : undefined}
              data-farm-mini-activity-tone={farmActivityDigest.tone}
              title={farmActivityRewardDigestOpened ? `已定位今日正反馈 ${farmActivityDigest.todayRewardTotal} · ${farmActivityDigest.badgeLabel}` : `查看今日正反馈 ${farmActivityDigest.todayRewardTotal} · ${farmActivityDigest.badgeLabel}`}
              aria-label={farmActivityRewardDigestOpened ? `已展开牧场面板并定位今日正反馈，正反馈 ${farmActivityDigest.todayRewardTotal}` : `展开牧场面板查看今日正反馈，正反馈 ${farmActivityDigest.todayRewardTotal}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmActivity('reward-digest');
              }}
            >
              <Sparkles size={11} />
              <b>奖{farmActivityDigest.todayRewardTotal}</b>
            </button>
          )}
          {primaryFarmFocus && (
            <span
              data-farm-mini-status-item="focus"
              data-farm-mini-focus-kind={primaryFarmFocus.kind}
              data-farm-mini-focus-ready={primaryFarmFocusReady ? 'true' : undefined}
              data-farm-mini-focus-complete={primaryFarmFocusComplete ? 'true' : undefined}
              data-farm-mini-focus-action-linked={farmMiniQuickActionBusy ? 'true' : undefined}
              data-farm-mini-focus-action-result={farmMiniQuickActionFeedback?.label || undefined}
              data-farm-mini-focus-progress-forecast={primaryFarmFocusProgressPreview ? 'true' : undefined}
              data-farm-mini-focus-progress-preview={primaryFarmFocusProgressPreview || undefined}
              data-farm-mini-focus-next-progress={primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
              data-farm-mini-focus-next-percent={primaryFarmFocus ? primaryFarmFocusNextPercent : undefined}
              title={farmMiniQuickActionBusy ? `刚刚推进：${farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel} · ${primaryFarmFocus.title}` : `小目标 ${primaryFarmFocus.progress}/${primaryFarmFocus.target} · ${primaryFarmFocusStatusLabel} · 预计推进：${primaryFarmFocusProgressPreview} · ${primaryFarmFocus.title} · ${primaryFarmFocus.actionLabel}`}
            >
              <Flag size={11} />
              <b>目{primaryFarmFocus.progress}/{primaryFarmFocus.target}</b>
            </span>
          )}
          {primaryFarmFocusActionLabel && (
            <button
              type="button"
              data-farm-mini-status-item="focus-action"
              data-farm-mini-focus-action-clickable="true"
              data-farm-mini-focus-action-fired={farmMiniQuickActionBusy ? 'true' : undefined}
              data-farm-mini-focus-action-busy={farmMiniQuickActionBusy ? 'true' : undefined}
              data-farm-mini-focus-action-result={farmMiniQuickActionFeedback?.label || undefined}
              data-farm-mini-focus-action-summary={farmMiniQuickActionSummaryLabel || undefined}
              data-farm-mini-focus-action-resource-targets={primaryFarmFocusActionResourceTargets.join(' ') || undefined}
              data-farm-mini-focus-action-resource-preview={primaryFarmFocusActionResourcePreview || undefined}
              data-farm-mini-focus-action-progress-preview={primaryFarmFocusProgressPreview || undefined}
              data-farm-mini-focus-action-next-progress={primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
              data-farm-mini-focus-action-target={primaryFarmFocus?.target ?? undefined}
              data-farm-mini-focus-kind={primaryFarmFocus?.kind}
              data-farm-mini-focus-ready={primaryFarmFocusReady ? 'true' : undefined}
              data-farm-mini-focus-complete={primaryFarmFocusComplete ? 'true' : undefined}
              disabled={farmMiniQuickActionBusy}
              aria-disabled={farmMiniQuickActionBusy ? 'true' : undefined}
              title={farmMiniFocusActionTitle}
              aria-label={farmMiniFocusActionAriaLabel}
              onClick={(event) => {
                event.stopPropagation();
                handleFarmMiniFocusAction();
              }}
            >
              {farmMiniQuickActionBusy ? <MiniQuickActionIcon size={11} /> : <Sparkles size={11} />}
              <b>{farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel : primaryFarmFocusActionLabel}</b>
              {primaryFarmFocusActionResourcePreview && (
                <small data-farm-mini-focus-action-resource="true">{primaryFarmFocusActionResourcePreview}</small>
              )}
              {primaryFarmFocusProgressPreview && (
                <small data-farm-mini-focus-action-progress="true">{primaryFarmFocusProgressPreview}</small>
              )}
            </button>
          )}
          {farmMiniQuickActionFeedback && (
            <>
              <span
                className="t8-farm-story-panel__mini-action-feedback"
                data-farm-mini-status-item="focus-action-feedback"
                data-farm-mini-focus-kind={farmMiniQuickActionFeedback.kind}
                data-farm-mini-focus-action-feedback-action={farmMiniQuickActionFeedback.actionKind}
                data-farm-mini-focus-action-feedback-tool={farmMiniQuickActionFeedback.tool}
                data-farm-mini-focus-action-summary={farmMiniQuickActionSummaryLabel || undefined}
                title={`刚刚执行：${farmMiniQuickActionSummaryLabel || farmMiniQuickActionFeedback.label}`}
                aria-hidden="true"
              >
                <MiniQuickActionIcon size={11} />
                <b>{farmMiniQuickActionFeedback.label}</b>
              </span>
              {farmMiniQuickActionSummaryLabel && (
                <button
                  type="button"
                  className="t8-farm-story-panel__mini-action-summary"
                  data-farm-mini-status-item="summary-feedback"
                  data-farm-mini-focus-action-summary={farmMiniQuickActionSummaryLabel}
                  title={`完整回执：${farmMiniQuickActionSummaryLabel} · 点击展开牧场面板`}
                  aria-label={`查看完整回执：${farmMiniQuickActionSummaryLabel}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                  }}
                >
                  <Sparkles size={10} />
                  <b>回执：{farmMiniQuickActionSummaryLabel}</b>
                </button>
              )}
              <span
                className="t8-farm-story-panel__mini-action-live"
                data-farm-mini-status-item="focus-action-live"
                data-farm-mini-focus-action-summary={farmMiniQuickActionSummaryLabel || undefined}
                role="status"
                aria-live="polite"
              >
                刚刚执行：{farmMiniQuickActionSummaryLabel || farmMiniQuickActionFeedback.label}
                {farmActivityRewardStreakActionReceiptEchoLabel && (
                  <small data-farm-mini-action-live-followup-receipt="true">
                    {farmActivityRewardStreakActionReceiptEchoLabel}
                  </small>
                )}
              </span>
            </>
          )}
          {primaryFarmFocus && (
            <span
              className="t8-farm-story-panel__mini-focus-meter"
              data-farm-mini-status-item="focus-meter"
              data-farm-mini-focus-kind={primaryFarmFocus.kind}
              data-farm-mini-focus-ready={primaryFarmFocusReady ? 'true' : undefined}
              data-farm-mini-focus-complete={primaryFarmFocusComplete ? 'true' : undefined}
              data-farm-mini-focus-action-linked={farmMiniQuickActionBusy ? 'true' : undefined}
              data-farm-mini-focus-action-result={farmMiniQuickActionFeedback?.label || undefined}
              data-farm-mini-focus-progress-forecast={primaryFarmFocusProgressPreview ? 'true' : undefined}
              data-farm-mini-focus-progress-preview={primaryFarmFocusProgressPreview || undefined}
              data-farm-mini-focus-next-progress={primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
              data-farm-mini-focus-next-percent={primaryFarmFocus ? primaryFarmFocusNextPercent : undefined}
              title={farmMiniQuickActionBusy ? `刚刚推进：${farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel} · 小目标进度 ${primaryFarmFocus.percent}%` : `小目标进度 ${primaryFarmFocus.percent}% · ${primaryFarmFocusStatusLabel} · ${primaryFarmFocusProgressPreview} · ${primaryFarmFocus.title}`}
              aria-hidden="true"
            >
              {primaryFarmFocusProgressPreview && (
                <i data-farm-mini-focus-progress-forecast-bar="true" style={{ width: `${primaryFarmFocusNextPercent}%` }} />
              )}
              <i data-farm-mini-focus-progress-current="true" style={{ width: `${primaryFarmFocus.percent}%` }} />
            </span>
          )}
          {farmActivityDigest.todayTotal > 0 && (
            <span
              className="t8-farm-story-panel__mini-activity-meter"
              data-farm-mini-status-item="activity-meter"
              data-farm-mini-activity-tone={farmActivityDigest.tone}
              data-farm-mini-activity-action-linked={farmMiniQuickActionBusy ? 'true' : undefined}
              data-farm-mini-activity-action-result={farmMiniQuickActionFeedback?.label || undefined}
              data-farm-mini-activity-followup-receipt={farmActivityRewardStreakActionReceiptEchoLabel || undefined}
              title={farmActivityRewardStreakActionReceiptEchoLabel ? `${farmActivityRewardStreakActionReceiptEchoLabel} · 今日成果进度 ${farmActivityDigest.percent}% · ${farmActivityDigest.badgeLabel}` : farmMiniQuickActionBusy ? `刚刚计入：${farmMiniQuickActionFeedback?.label || primaryFarmFocusActionLabel} · 今日成果进度 ${farmActivityDigest.percent}% · ${farmActivityDigest.badgeLabel}` : `今日成果进度 ${farmActivityDigest.percent}% · ${farmActivityDigest.badgeLabel}`}
              aria-hidden="true"
            >
              <i style={{ width: `${farmActivityDigest.percent}%` }} />
            </span>
          )}
          <button
            type="button"
            data-farm-mini-status-item="beauty"
            data-farm-mini-status-clickable="true"
            data-farm-mini-beauty-opened={farmBeautyDetailOpened ? 'true' : undefined}
            data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('beauty') ? 'true' : undefined}
            data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('beauty') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
            data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('beauty') ? farmMiniFocusActionBaseLabel || undefined : undefined}
            data-farm-mini-reward-pocket-target={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('beauty') ? 'true' : undefined}
            data-farm-mini-reward-pocket-target-label={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('beauty') ? farmActivityChestClaimNextReceiptRewardPocketTargetsLabel : undefined}
            data-farm-mini-reward-pocket-target-opened={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('beauty') && farmBeautyDetailOpened ? 'true' : undefined}
            data-farm-mini-beauty-placement-receipt={farmPlacementHudReceiptKind === 'decor' ? farmPlacementHudReceiptLabel : undefined}
            data-farm-mini-beauty-placement-source={farmPlacementHudReceiptKind === 'decor' ? farmPlacementHudReceiptSource || undefined : undefined}
            data-farm-mini-beauty-reward-route-target={farmBeautyRewardRouteTarget}
            data-farm-mini-beauty-reward-route-label={farmBeautyRewardRouteLabel}
            data-farm-mini-beauty-reward-route-reward={farmBeautyRewardRouteRewardLabel}
            data-farm-mini-beauty-reward-route-count={farmBeautyRewardRouteCountLabel}
            data-farm-mini-beauty-reward-route-receipt={farmBeautyRewardRouteReceipt || undefined}
            data-farm-mini-placement-followup-route={farmPlacementHudReceiptFollowupTarget === 'beauty' ? 'true' : undefined}
            data-farm-mini-placement-followup-route-count={farmPlacementHudReceiptFollowupTarget === 'beauty' ? farmPlacementHudReceiptFollowupCountLabel || undefined : undefined}
            data-farm-mini-placement-followup-route-resource={farmPlacementHudReceiptFollowupTarget === 'beauty' ? farmPlacementHudReceiptFollowupResourceLabel || undefined : undefined}
            title={farmBeautyDetailOpened ? `已定位漂亮度 ${farmBeautyScore.score}/100 · ${farmBeautyScore.title}` : primaryFarmFocusActionResourceTargets.includes('beauty') ? `查看漂亮度 ${farmBeautyScore.score}/100 · ${farmBeautyScore.title} · 预计影响：${farmMiniFocusActionBaseLabel} · ${primaryFarmFocusActionResourcePreview}` : `查看漂亮度 ${farmBeautyScore.score}/100 · ${farmBeautyScore.title}`}
            aria-label={farmBeautyDetailOpened ? `已定位漂亮度 ${farmBeautyScore.score}/100 · ${farmBeautyScore.title}` : `查看漂亮度 ${farmBeautyScore.score}/100 · ${farmBeautyScore.title}`}
            onClick={(event) => {
              event.stopPropagation();
              if (farmPlacementHudReceiptKind === 'decor') {
                handleFarmPlacementHudReceiptAction();
                return;
              }
              handleOpenFarmBeautyDetail();
            }}
          >
            <Sparkles size={11} />
            <b>美{farmBeautyScore.score}</b>
            {farmPlacementHudReceiptKind === 'decor' && (
              <small data-farm-mini-placement-receipt-text="true">{farmPlacementHudReceiptLabel}</small>
            )}
          </button>
          <button
            type="button"
            className="t8-farm-story-panel__mini-beauty-route-hint"
            data-farm-mini-status-item="beauty-route"
            data-farm-mini-status-clickable="true"
            data-farm-mini-beauty-reward-route-hint="true"
            data-farm-mini-beauty-reward-route-target={farmBeautyRewardRouteTarget}
            data-farm-mini-beauty-reward-route-label={farmBeautyRewardRouteLabel}
            data-farm-mini-beauty-reward-route-reward={farmBeautyRewardRouteRewardLabel}
            data-farm-mini-beauty-reward-route-count={farmBeautyRewardRouteCountLabel}
            data-farm-mini-beauty-reward-route-receipt={farmBeautyRewardRouteReceipt || undefined}
            title={farmBeautyRewardRouteTitle}
            aria-label={farmBeautyRewardRouteTitle}
            onClick={(event) => {
              event.stopPropagation();
              handleFarmBeautyRewardRouteHintAction();
            }}
          >
            <Sparkles size={10} />
            <b>{farmBeautyRewardRouteReceipt || `地图找${farmBeautyRewardRouteLabel}`}</b>
            <small data-farm-mini-beauty-reward-route-count-text="true">{farmBeautyRewardRouteCountLabel}</small>
          </button>
          <button
            type="button"
            data-farm-mini-status-item="mature"
            data-farm-mini-status-clickable="true"
            data-farm-monitor-group="alert"
            data-farm-mini-mature-opened={farmMatureJumpOpened ? 'true' : undefined}
            data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('mature') ? 'true' : undefined}
            data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('mature') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
            data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('mature') ? farmMiniFocusActionBaseLabel || undefined : undefined}
            disabled={matureCount === 0}
            aria-disabled={matureCount === 0}
            title={farmMatureJumpOpened ? `已定位成熟作物 ${matureCount}` : `跳转成熟作物 ${matureCount}`}
            aria-label={farmMatureJumpOpened ? `已定位成熟作物 ${matureCount}` : `跳转成熟作物 ${matureCount}`}
            onClick={(event) => {
              event.stopPropagation();
              handleFarmMiniMatureJump();
            }}
          >
            <Wheat size={11} />
            <b>成熟 {matureCount}</b>
          </button>
          {dryCount > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="dry"
              data-farm-mini-status-clickable="true"
              data-farm-monitor-group="alert"
              data-farm-mini-dry-water-opened={farmDryWaterOpened ? 'true' : undefined}
              title={farmDryWaterOpened ? `已切到水壶，处理缺水作物 ${dryCount}` : `切到水壶，处理缺水作物 ${dryCount}`}
              aria-label={farmDryWaterOpened ? `已切到水壶，处理缺水作物 ${dryCount}` : `切到水壶，处理缺水作物 ${dryCount}`}
              onClick={(event) => {
                event.stopPropagation();
                handleFarmMiniDryWaterAction();
              }}
            >
              <Droplets size={11} />
              <b>缺水 {dryCount}</b>
            </button>
          )}
          {scarecrowRiskCount > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="scarecrow-risk"
              data-farm-mini-status-clickable="true"
              data-farm-monitor-group="alert"
              data-farm-mini-scarecrow-risk-alert="true"
              data-farm-mini-scarecrow-risk-selected={farmScarecrowRiskSelected ? 'true' : undefined}
              data-farm-mini-placement-followup-route={farmPlacementHudReceiptFollowupTarget === 'scarecrow-risk' ? 'true' : undefined}
              data-farm-mini-placement-followup-route-count={farmPlacementHudReceiptFollowupTarget === 'scarecrow-risk' ? farmPlacementHudReceiptFollowupCountLabel || undefined : undefined}
              data-farm-mini-placement-followup-route-resource={farmPlacementHudReceiptFollowupTarget === 'scarecrow-risk' ? farmPlacementHudReceiptFollowupResourceLabel || undefined : undefined}
              aria-label={farmScarecrowRiskSelected ? `已选择稻草人建造，守护 ${scarecrowRiskCount} 块缺水作物` : `选择稻草人建造，守护 ${scarecrowRiskCount} 块缺水作物`}
              title={farmScarecrowRiskSelected ? `已选择稻草人，下一步放到缺水区旁守护 ${scarecrowRiskCount} 块作物` : `未被稻草人守护的缺水作物 ${scarecrowRiskCount}，建议补稻草人或优先浇水`}
              onClick={(event) => {
                event.stopPropagation();
                handleFarmMiniScarecrowRiskAction();
              }}
            >
              <Hammer size={11} />
              <b>守护 {scarecrowRiskCount}</b>
            </button>
          )}
          {witheredCount > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="withered"
              data-farm-mini-status-clickable="true"
              data-farm-monitor-group="alert"
              data-farm-mini-withered-shovel-opened={farmWitheredShovelOpened ? 'true' : undefined}
              data-farm-mini-resource-forecast={primaryFarmFocusActionResourceTargets.includes('withered') ? 'true' : undefined}
              data-farm-mini-resource-forecast-preview={primaryFarmFocusActionResourceTargets.includes('withered') ? primaryFarmFocusActionResourcePreview || undefined : undefined}
              data-farm-mini-resource-forecast-action={primaryFarmFocusActionResourceTargets.includes('withered') ? farmMiniFocusActionBaseLabel || undefined : undefined}
              title={farmWitheredShovelOpened ? `已切到铲子，清理枯萎作物 ${witheredCount}` : primaryFarmFocusActionResourceTargets.includes('withered') ? `切到铲子，清理枯萎作物 ${witheredCount} · 预计影响：${farmMiniFocusActionBaseLabel} · ${primaryFarmFocusActionResourcePreview}` : `切到铲子，清理枯萎作物 ${witheredCount}`}
              aria-label={farmWitheredShovelOpened ? `已切到铲子，清理枯萎作物 ${witheredCount}` : primaryFarmFocusActionResourceTargets.includes('withered') ? `切到铲子，清理枯萎作物 ${witheredCount} · 预计影响：${farmMiniFocusActionBaseLabel} · ${primaryFarmFocusActionResourcePreview}` : `切到铲子，清理枯萎作物 ${witheredCount}`}
              onClick={(event) => {
                event.stopPropagation();
                handleFarmMiniWitheredShovelAction();
              }}
            >
              <Shovel size={11} />
              <b>枯萎 {witheredCount}</b>
            </button>
          )}
          {readyOrderCount > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="ready-order"
              data-farm-mini-status-clickable="true"
              data-farm-monitor-group="alert"
              data-farm-mini-ready-order-opened={farmOrderLocateOpened ? 'true' : undefined}
              data-farm-mini-reward-pocket-target={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('ready-order') ? 'true' : undefined}
              data-farm-mini-reward-pocket-target-label={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('ready-order') ? farmActivityChestClaimNextReceiptRewardPocketTargetsLabel : undefined}
              data-farm-mini-reward-pocket-target-opened={farmActivityChestClaimNextReceipt && farmActivityChestClaimNextReceiptRewardPocketTargets.includes('ready-order') && farmOrderLocateOpened ? 'true' : undefined}
              data-farm-mini-placement-followup-route={farmPlacementHudReceiptFollowupTarget === 'ready-order' ? 'true' : undefined}
              data-farm-mini-placement-followup-route-count={farmPlacementHudReceiptFollowupTarget === 'ready-order' ? farmPlacementHudReceiptFollowupCountLabel || undefined : undefined}
              data-farm-mini-placement-followup-route-resource={farmPlacementHudReceiptFollowupTarget === 'ready-order' ? farmPlacementHudReceiptFollowupResourceLabel || undefined : undefined}
              title={`查看可交付订单 ${readyOrderCount}`}
              aria-label={`查看可交付订单 ${readyOrderCount}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmOrder();
              }}
            >
              <Package size={11} />
              <b>订单 {readyOrderCount}</b>
            </button>
          )}
          {readyNpcVisitCount > 0 && (
            <button
              type="button"
              data-farm-mini-status-item="ready-npc"
              data-farm-mini-status-clickable="true"
              data-farm-monitor-group="alert"
              data-farm-mini-ready-npc-opened={farmNpcVisitOpened ? 'true' : undefined}
              title={`查看可交付来访 ${readyNpcVisitCount}`}
              aria-label={`查看可交付来访 ${readyNpcVisitCount}`}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenFarmNpcVisit();
              }}
            >
              <UserRound size={11} />
              <b>来访 {readyNpcVisitCount}</b>
            </button>
          )}
          <button
            type="button"
            data-farm-mini-status-item="tool"
            data-farm-mini-status-clickable="true"
            data-farm-monitor-group="tool"
            data-farm-mini-tool-id={selectedTool}
            data-farm-mini-tool-flash={farmMiniToolFlash ? 'true' : undefined}
            data-farm-mini-tool-opened={farmToolDetailOpened ? 'true' : undefined}
            title={farmToolDetailOpened ? `已定位工具：${selectedToolOption.label}` : farmMiniToolFlash ? `刚切换工具：${selectedToolOption.label} · 点击查看工具栏` : `查看工具栏：${selectedToolOption.label}`}
            aria-label={farmToolDetailOpened ? `已定位工具：${selectedToolOption.label}` : `查看工具栏：${selectedToolOption.label}`}
            onClick={(event) => {
              event.stopPropagation();
              handleOpenFarmTools();
            }}
          >
            <SelectedToolIcon size={11} />
            <b>{selectedToolOption.label}</b>
          </button>
        </div>
      <div
        className="t8-farm-story-panel__quick-actions"
        data-farm-quick-actions="true"
        data-farm-quick-actions-layout="toolbar-ribbon"
        data-farm-quick-actions-mirror="top-monitor"
        data-farm-quick-actions-density="compact-readable"
        aria-label="牧场快捷工具"
      >
        <button
          type="button"
          className={`t8-farm-story-panel__quick-panel-toggle${panelOpen ? ' is-active' : ''}`}
          data-farm-quick-panel-toggle="true"
          data-farm-quick-panel-state={panelOpen ? 'open' : 'closed'}
          data-farm-quick-panel-priority={farmMonitorBriefTone}
          data-farm-quick-panel-priority-label={farmMonitorBriefPrimary}
          data-farm-quick-panel-priority-section={farmMonitorBriefSection}
          data-farm-quick-panel-priority-section-label={farmMonitorBriefSectionLabel}
          data-farm-quick-panel-priority-open={isFarmPanelSectionExpanded(farmMonitorBriefSection) ? 'true' : undefined}
          data-farm-quick-panel-auto-section={farmMonitorBriefSection}
          data-farm-quick-panel-auto-section-label={farmMonitorBriefSectionLabel}
          data-farm-quick-panel-auto-focus={panelOpen ? undefined : 'true'}
          aria-expanded={panelOpen}
          aria-pressed={panelOpen}
          aria-label={farmQuickPanelToggleTitle}
          title={farmQuickPanelToggleTitle}
          onClick={(event) => {
            event.stopPropagation();
            handleFarmQuickPanelToggle();
          }}
        >
          <Sprout size={13} />
          <span>控制台</span>
          <b data-farm-quick-panel-priority-chip="true">{farmMonitorBriefPrimary}</b>
          <em>{farmQuickPanelToggleBadge}</em>
        </button>
        {FARM_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = selectedTool === tool.id;
          const badge = buildFarmToolBadge(tool.id, {
            farmCanvas,
            matureCount,
            selectedBuildingId,
            selectedDecorId,
            selectedResourceDecorChoice,
            selectedResourceDecor,
          });
          const selectedDecorDefinition = FARM_DECOR_DEFINITIONS[selectedDecorId] || FARM_DECOR_DEFINITIONS[FARM_DEFAULT_DECOR_ID];
          const quickRoute = farmQuickToolRouteHint(tool.id, {
            farmCanvas,
            dryCount,
            matureCount,
            witheredCount,
            scarecrowRiskCount,
            selectedBuildingId,
            selectedBuildingLabel: selectedBuildingDefinition.label,
            selectedDecorId,
            selectedDecorLabel: selectedDecorDefinition.label,
            selectedResourceDecorChoice,
            selectedResourceDecor,
          });
          const quickAssist = farmQuickToolAssistHint(tool.id, {
            farmCanvas,
            routeActive: Boolean(quickRoute),
            matureCount,
            readyOrderCount,
            selectedBuildingId,
            selectedBuildingLabel: selectedBuildingDefinition.label,
            selectedDecorId,
            selectedDecorLabel: selectedDecorDefinition.label,
          });
          const unavailable = Boolean(badge?.empty);
          const routeSuffix = quickRoute ? `，地图找${quickRoute.routeLabel}` : '';
          const assistSuffix = quickAssist ? `，建议${quickAssist.label}` : '';
          return (
            <button
              key={`quick-${tool.id}`}
              type="button"
              className={`${active ? 'is-active' : ''}${badge ? ' has-badge' : ''}${quickRoute ? ' has-route' : ''}${quickAssist ? ' has-assist' : ''}${unavailable ? ' is-badge-empty is-unavailable' : ''}`.trim()}
              aria-label={`快捷工具：${tool.label}${badge ? `，${badge.title}` : ''}${routeSuffix}${assistSuffix}${unavailable ? '，当前条件不足，点击查看提示' : ''}`}
              aria-pressed={active}
              data-farm-quick-tool-id={tool.id}
              data-farm-quick-tool-label={tool.label}
              data-farm-quick-tool-summary={badge?.label || '可用'}
              data-farm-quick-tool-active={active ? 'true' : undefined}
              data-farm-quick-tool-badge={badge?.label}
              data-farm-quick-tool-badge-tone={badge?.tone}
              data-farm-quick-tool-route-target={quickRoute?.routeTarget}
              data-farm-quick-tool-route-label={quickRoute?.routeLabel}
              data-farm-quick-tool-route-receipt={farmQuickToolRouteReceipt === tool.id ? 'true' : undefined}
              data-farm-quick-tool-assist-label={quickAssist?.label}
              data-farm-quick-tool-assist-target={quickAssist?.routeTarget}
              data-farm-quick-tool-assist-receipt={farmQuickToolAssistReceipt === tool.id ? 'true' : undefined}
              data-farm-quick-tool-independent-action="true"
              title={`${badge ? `${tool.label} · ${badge.title}` : tool.label}${quickRoute ? ` · 地图找${quickRoute.routeLabel}` : ''}${quickAssist ? ` · ${quickAssist.title}` : ''}${unavailable ? ' · 条件不足，点击查看提示' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                handleFarmQuickToolAction(tool.id, quickRoute, quickAssist);
              }}
            >
              <Icon size={13} />
              <span>{tool.label}</span>
              {badge && <em data-farm-quick-tool-badge-tone={badge.tone}>{badge.label}</em>}
              {quickRoute && (
                <i data-farm-quick-tool-route-label="true">
                  {farmQuickToolRouteReceipt === tool.id ? '已指路' : `找${quickRoute.routeLabel}`}
                </i>
              )}
              {quickAssist && (
                <i data-farm-quick-tool-assist-label="true">
                  {farmQuickToolAssistReceipt === tool.id ? '已提示' : quickAssist.label}
                </i>
              )}
            </button>
          );
        })}
      </div>
      {panelOpen && (
        <section
          ref={farmPanelRef}
          className="t8-farm-story-panel__panel"
          data-canvas-floating-ui="farm-story-panel"
          data-farm-section-feedback-open={isFarmPanelSectionExpanded('feedback') ? 'true' : undefined}
          data-farm-section-season-open={isFarmPanelSectionExpanded('season') ? 'true' : undefined}
          data-farm-section-focus-open={isFarmPanelSectionExpanded('focus') ? 'true' : undefined}
          data-farm-section-beauty-open={isFarmPanelSectionExpanded('beauty') ? 'true' : undefined}
          data-farm-section-guide-open={isFarmPanelSectionExpanded('guide') ? 'true' : undefined}
          data-farm-section-tools-open={isFarmPanelSectionExpanded('tools') ? 'true' : undefined}
          data-farm-section-build-open={isFarmPanelSectionExpanded('build') ? 'true' : undefined}
          data-farm-section-building-open={isFarmPanelSectionExpanded('building') ? 'true' : undefined}
          data-farm-section-animals-open={isFarmPanelSectionExpanded('animals') ? 'true' : undefined}
          data-farm-section-visits-open={isFarmPanelSectionExpanded('visits') ? 'true' : undefined}
          data-farm-section-summary-open={isFarmPanelSectionExpanded('summary') ? 'true' : undefined}
          data-farm-section-activity-open={isFarmPanelSectionExpanded('activity') ? 'true' : undefined}
          data-farm-section-actions-open={isFarmPanelSectionExpanded('actions') ? 'true' : undefined}
          data-farm-panel-readable="large"
          data-farm-panel-layout="split-detail"
          data-farm-panel-active-section={activeFarmPanelSectionId || undefined}
          data-farm-panel-section-detail-label={activeFarmPanelSectionItem?.label || undefined}
          role="dialog"
          aria-modal="false"
          aria-label="牧场控制台"
        >
          <header className="t8-farm-story-panel__header">
            <div>
              <span>FARM STORY</span>
              <strong>牧场控制台</strong>
            </div>
            <div className="t8-farm-story-panel__header-actions">
              <em>操作</em>
              {devToolsEnabled && onGrantDevMaterials && (
                <button
                  type="button"
                  className="t8-farm-story-panel__dev-materials"
                  data-farm-dev-materials="9999"
                  data-farm-dev-only="true"
                  aria-label="开发环境测试：补齐牧场材料 9999"
                  title="开发环境测试：补齐金币、木材、石头、种子、库存和装饰"
                  onClick={(event) => {
                    event.stopPropagation();
                    onGrantDevMaterials();
                  }}
                >
                  <Package size={12} />
                  <span>DEV 9999</span>
                </button>
              )}
              <button
                type="button"
                className={`t8-farm-story-panel__sound${soundEnabled ? ' is-active' : ''}`}
                aria-label={soundEnabled ? '关闭牧场音效' : '开启牧场音效'}
                aria-pressed={soundEnabled}
                title={soundEnabled ? '关闭牧场音效' : '开启牧场音效'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSound?.(!soundEnabled);
                }}
              >
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
            </div>
          </header>
          {farmControlConsoleFocusReceipt && (
            <div
              className="t8-farm-story-panel__control-focus-receipt"
              data-farm-control-console-focus-receipt="true"
              data-farm-control-console-focus-receipt-id={farmControlConsoleFocusReceipt.id}
              data-farm-control-console-focus-receipt-tone={farmControlConsoleFocusReceipt.tone}
              data-farm-control-console-focus-receipt-section={farmControlConsoleFocusReceipt.section}
              data-farm-control-console-focus-receipt-action={farmControlConsoleFocusReceipt.actionKind}
              data-farm-control-console-focus-receipt-route-target={farmControlConsoleFocusReceipt.routeTarget}
              data-farm-control-console-focus-receipt-route-label={farmControlConsoleFocusReceipt.routeLabel}
              data-farm-control-console-focus-route-receipt={farmControlConsoleFocusRouteReceiptActive ? 'true' : undefined}
              data-farm-control-console-focus-action-receipt={farmControlConsoleFocusActionReceiptActive ? 'true' : undefined}
              role="status"
              aria-live="polite"
              title={farmControlConsoleFocusActionReceiptActive
                ? `当前优先已接上：${farmControlConsoleFocusReceipt.primary} · ${farmControlConsoleFocusReceipt.secondary}`
                : `牧场控制台已打开：${farmControlConsoleFocusReceipt.sectionLabel} · ${farmControlConsoleFocusReceipt.primary} · ${farmControlConsoleFocusReceipt.secondary}`}
            >
              <Sparkles size={13} />
              <span>
                <b>已打开 {farmControlConsoleFocusReceipt.sectionLabel}</b>
                <small>{farmControlConsoleFocusReceipt.primary} · {farmControlConsoleFocusReceipt.secondary}</small>
              </span>
              <button
                type="button"
                data-farm-control-console-focus-route-button="true"
                data-farm-control-console-focus-route-target={farmControlConsoleFocusReceipt.routeTarget}
                data-farm-control-console-focus-route-label={farmControlConsoleFocusReceipt.routeLabel}
                data-farm-control-console-focus-route-receipt={farmControlConsoleFocusRouteReceiptActive ? 'true' : undefined}
                data-farm-control-console-focus-action-receipt={farmControlConsoleFocusActionReceiptActive ? 'true' : undefined}
                disabled={farmControlConsoleFocusActionReceiptActive}
                title={farmControlConsoleFocusActionReceiptActive
                  ? `已接上：${farmControlConsoleFocusReceipt.primary}`
                  : farmControlConsoleFocusRouteReceiptActive
                  ? `已指路：${farmControlConsoleFocusReceipt.routeTitle || farmControlConsoleFocusReceipt.routeLabel || farmControlConsoleFocusReceipt.primary}`
                  : `只看路线：${farmControlConsoleFocusReceipt.routeTitle || farmControlConsoleFocusReceipt.routeLabel || farmControlConsoleFocusReceipt.primary}`}
                aria-label={farmControlConsoleFocusActionReceiptActive
                  ? `已接上：${farmControlConsoleFocusReceipt.primary}`
                  : farmControlConsoleFocusRouteReceiptActive
                  ? `已指路：${farmControlConsoleFocusReceipt.routeLabel || farmControlConsoleFocusReceipt.primary}`
                  : `只看路线：${farmControlConsoleFocusReceipt.routeLabel || farmControlConsoleFocusReceipt.primary}，不执行农活`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleFarmMonitorBriefRoute();
                  flashFarmControlConsoleFocusReceipt(farmControlConsoleFocusReceipt);
                }}
              >
                <Sparkles size={12} />
                {farmControlConsoleFocusActionReceiptActive ? '已接上' : farmControlConsoleFocusRouteReceiptActive ? '已指路' : farmControlConsoleFocusReceipt.routeLabel ? `看${farmControlConsoleFocusReceipt.routeLabel}` : '看路线'}
              </button>
            </div>
          )}
          <button
            type="button"
            className="t8-farm-story-panel__priority-card"
            data-farm-panel-priority-card="true"
            data-farm-panel-priority-tone={farmMonitorBriefTone}
            data-farm-panel-priority-section={farmMonitorBriefSection}
            data-farm-panel-priority-count={farmMonitorBriefCount}
            data-farm-panel-priority-progress={farmMonitorBriefProgressLabel}
            data-farm-panel-priority-receipt={farmPrioritySectionReceipt === farmMonitorBriefSection ? 'true' : undefined}
            data-farm-panel-priority-route-target={farmMonitorPriorityAction.routeTarget}
            data-farm-panel-priority-route-label={farmMonitorPriorityAction.routeLabel}
            data-farm-panel-priority-route-receipt={farmMonitorPriorityRouteReceiptActive ? 'true' : undefined}
            data-farm-panel-priority-action-receipt={farmMonitorPriorityActionReceiptActive ? 'true' : undefined}
            title={farmMonitorPriorityActionReceiptActive
              ? `当前优先已接上：${farmMonitorPriorityAction.label} · ${farmMonitorPriorityAction.detail}，展开${farmMonitorBriefSectionLabel}`
              : farmMonitorPriorityRouteReceiptActive
              ? `当前优先已指路：${farmMonitorBriefPrimary} · ${farmMonitorPriorityAction.routeTitle || farmMonitorBriefSecondary}，展开${farmMonitorBriefSectionLabel}`
              : `当前优先：${farmMonitorBriefPrimary} · ${farmMonitorBriefSecondary}，展开${farmMonitorBriefSectionLabel}`}
            aria-label={farmMonitorPriorityActionReceiptActive
              ? `当前优先已接上：${farmMonitorPriorityAction.label}，${farmMonitorPriorityAction.detail}，展开${farmMonitorBriefSectionLabel}`
              : farmMonitorPriorityRouteReceiptActive
              ? `当前优先已指路：${farmMonitorBriefPrimary}，${farmMonitorBriefSecondary}，展开${farmMonitorBriefSectionLabel}`
              : `当前优先：${farmMonitorBriefPrimary}，${farmMonitorBriefSecondary}，展开${farmMonitorBriefSectionLabel}`}
            onClick={(event) => {
              event.stopPropagation();
              setFarmPanelSectionOpen(farmMonitorBriefSection, true);
              flashFarmPrioritySection(farmMonitorBriefSection);
            }}
          >
            <Sparkles size={13} />
            <span>
              <small>当前优先</small>
              <b>{farmMonitorBriefPrimary}</b>
              <em>{farmMonitorBriefSecondary}</em>
            </span>
            <i data-farm-panel-priority-tone-chip="true">{farmMonitorBriefToneLabel}</i>
            <mark data-farm-panel-priority-progress-chip="true">
              {farmMonitorPriorityActionReceiptActive ? '已接上' : farmMonitorPriorityRouteReceiptActive ? '已指路' : farmMonitorBriefProgressLabel}
            </mark>
          </button>
          <button
            type="button"
            className="t8-farm-story-panel__priority-action"
            data-farm-panel-priority-action="true"
            data-farm-panel-priority-action-kind={farmMonitorPriorityAction.kind}
            data-farm-panel-priority-action-section={farmMonitorPriorityAction.section}
            data-farm-panel-priority-action-route-target={farmMonitorPriorityAction.routeTarget}
            data-farm-panel-priority-action-route-label={farmMonitorPriorityAction.routeLabel}
            data-farm-panel-priority-action-receipt={farmMonitorPriorityActionReceiptActive ? 'true' : undefined}
            data-farm-panel-priority-action-route-receipt={farmMonitorPriorityRouteReceiptActive ? 'true' : undefined}
            data-farm-panel-priority-action-route-ready={farmPriorityActionRouteReady ? 'true' : undefined}
            title={farmPriorityActionButtonTitle}
            aria-label={farmPriorityActionButtonAriaLabel}
            aria-disabled={farmMonitorPriorityActionReceiptActive ? 'true' : undefined}
            disabled={farmMonitorPriorityActionReceiptActive}
            onClick={(event) => {
              event.stopPropagation();
              if (farmMonitorPriorityActionReceiptActive) return;
              handleFarmMonitorPriorityAction();
            }}
          >
            <Sparkles size={13} />
            <span>
              <small>{farmPriorityActionLeadLabel}</small>
              <b>{farmMonitorPriorityAction.label}</b>
              <em>{farmMonitorPriorityAction.detail}</em>
            </span>
            <mark>{farmPriorityActionStatusLabel}</mark>
          </button>
          {farmPriorityComboReceipt && (
            <div
              className="t8-farm-story-panel__priority-combo"
              data-farm-panel-priority-combo="true"
              data-farm-panel-priority-combo-count={farmPriorityComboReceipt.count}
              data-farm-panel-priority-combo-source={farmPriorityComboReceipt.source}
              data-farm-panel-priority-combo-next-item={farmPriorityComboNextItem?.id}
              data-farm-panel-priority-combo-next-route={farmPriorityComboNextItem?.routeTarget}
              data-farm-panel-priority-combo-next-label={farmPriorityComboNextItem?.label}
              data-farm-panel-priority-combo-next-mode={farmPriorityComboNextMode}
              data-farm-panel-priority-combo-next-action-kind={farmPriorityComboNextItem?.kind}
              role="status"
              aria-live="polite"
              title={`${farmPriorityComboReceipt.comboLabel} x${farmPriorityComboReceipt.count}：刚刚接上 ${farmPriorityComboReceipt.actionLabel}，${farmPriorityComboReceipt.rewardLabel}${farmPriorityComboNextItem ? `，下一件 ${farmPriorityComboNextItem.label}` : ''}`}
            >
              <Sparkles size={12} />
              <span>
                <b>{farmPriorityComboReceipt.comboLabel} x{farmPriorityComboReceipt.count}</b>
                <small>{farmPriorityComboReceipt.actionLabel} · {farmPriorityComboReceipt.rewardLabel}</small>
                {farmPriorityComboNextItem && (
                  <i data-farm-panel-priority-combo-next-label="true">
                    {farmPriorityComboNextRouteReceipt
                      ? `已指路 ${farmPriorityComboNextItem.routeLabel || farmPriorityComboNextItem.label} · 可接上`
                      : `下一件 ${farmPriorityComboNextItem.label}`}
                  </i>
                )}
              </span>
              {farmPriorityComboNextItem ? (
                <button
                  type="button"
                  data-farm-panel-priority-combo-next="true"
                  data-farm-panel-priority-combo-next-mode={farmPriorityComboNextMode}
                  data-farm-panel-priority-combo-next-action-button={farmPriorityComboNextRouteReceipt ? 'true' : undefined}
                  data-farm-panel-priority-combo-next-route-button={farmPriorityComboNextItem.routeTarget ? 'true' : undefined}
                  title={farmPriorityComboNextRouteReceipt
                    ? `接上下一件：${farmPriorityComboNextItem.label} · 会执行该动作`
                    : `先看下一件：${farmPriorityComboNextItem.label} · 不执行动作`}
                  aria-label={farmPriorityComboNextRouteReceipt
                    ? `接上下一件：${farmPriorityComboNextItem.label}，会执行该动作`
                    : `先看下一件：${farmPriorityComboNextItem.label}，不执行动作`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (farmPriorityComboNextRouteReceipt) {
                      handleFarmPriorityQueueAction(farmPriorityComboNextItem);
                      return;
                    }
                    handleFarmPriorityQueueRoutePreview(farmPriorityComboNextItem);
                  }}
                >
                  {farmPriorityComboNextButtonLabel}
                </button>
              ) : (
                <mark data-farm-panel-priority-combo-next="true">继续接</mark>
              )}
            </div>
          )}
          {farmPriorityFlowReceipt && (
            <div
              className="t8-farm-story-panel__priority-flow-receipt"
              data-farm-panel-priority-flow-receipt="true"
              data-farm-panel-priority-flow-source={farmPriorityFlowReceipt.source}
              data-farm-panel-priority-flow-action={farmPriorityFlowReceipt.actionLabel}
              data-farm-panel-priority-flow-next={farmPriorityFlowReceipt.nextLabel || undefined}
              data-farm-panel-priority-flow-next-route={farmPriorityFlowReceipt.nextRouteTarget || undefined}
              data-farm-panel-priority-flow-next-section={farmPriorityFlowReceipt.nextSection || undefined}
              data-farm-panel-priority-flow-next-live={farmPriorityFlowNextLiveItem ? 'true' : undefined}
              data-farm-panel-priority-flow-next-stale={farmPriorityFlowNextStale ? 'true' : undefined}
              data-farm-panel-priority-flow-next-mode={farmPriorityFlowNextMode}
              data-farm-panel-priority-flow-next-route-receipt={farmPriorityFlowNextRouteReceipt ? 'true' : undefined}
              role="status"
              aria-live="polite"
              title={`刚接上：${farmPriorityFlowReceipt.label} · ${farmPriorityFlowReceipt.detailLabel}${farmPriorityFlowReceipt.nextLabel ? ` · 下一件 ${farmPriorityFlowReceipt.nextLabel}` : ''}`}
            >
              <Sparkles size={12} />
              <span>
                <b>刚接上 {farmPriorityFlowReceipt.actionLabel}</b>
                <small>{farmPriorityFlowReceipt.detailLabel}</small>
                <i data-farm-panel-priority-flow-meta="true">
                  {[farmPriorityFlowReceipt.impactLabel, farmPriorityFlowReceipt.reasonLabel].filter(Boolean).join(' · ') || farmPriorityFlowReceipt.label}
                </i>
              </span>
              {farmPriorityFlowReceipt.nextLabel ? (
                <button
                  type="button"
                  data-farm-panel-priority-flow-next-button="true"
                  data-farm-panel-priority-flow-next-mode={farmPriorityFlowNextMode}
                  data-farm-panel-priority-flow-next-live={farmPriorityFlowNextLiveItem ? 'true' : undefined}
                  data-farm-panel-priority-flow-next-stale={farmPriorityFlowNextStale ? 'true' : undefined}
                  data-farm-panel-priority-flow-next-route-button={farmPriorityFlowReceipt.nextRouteTarget ? 'true' : undefined}
                  data-farm-panel-priority-flow-next-route-receipt={farmPriorityFlowNextRouteReceipt ? 'true' : undefined}
                  data-farm-panel-priority-flow-next-action-button={farmPriorityFlowNextActionReady ? 'true' : undefined}
                  disabled={farmPriorityFlowNextStale}
                  title={farmPriorityFlowNextStale
                    ? `下一件已刷新：${farmPriorityFlowReceipt.nextLabel} · 不再执行旧快照`
                    : farmPriorityFlowNextActionReady
                      ? `接上下一件：${farmPriorityFlowReceipt.nextLabel} · 会执行该动作`
                      : `看下一件：${farmPriorityFlowReceipt.nextLabel} · 不执行动作`}
                  aria-label={farmPriorityFlowNextStale
                    ? `下一件已刷新：${farmPriorityFlowReceipt.nextLabel}，不再执行旧快照`
                    : farmPriorityFlowNextActionReady
                      ? `接上下一件：${farmPriorityFlowReceipt.nextLabel}，会执行该动作`
                      : `看下一件：${farmPriorityFlowReceipt.nextLabel}，不执行动作`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmPriorityFlowReceiptNextRoute();
                  }}
                >
                  {farmPriorityFlowNextButtonLabel}
                </button>
              ) : (
                <mark data-farm-panel-priority-flow-stable="true">节奏稳定</mark>
              )}
            </div>
          )}
          <div
            className="t8-farm-story-panel__priority-queue"
            data-farm-panel-priority-queue="true"
            data-farm-panel-priority-queue-count={farmPriorityQueueItems.length}
            data-farm-panel-priority-queue-empty={farmPriorityQueueItems.length === 0 ? 'true' : undefined}
            data-farm-panel-priority-queue-route-preview={farmPriorityQueueRoutePreviewItem?.id}
            data-farm-panel-priority-queue-route-receipt={farmPriorityQueueRouteReceipt || undefined}
            aria-label={farmPriorityQueueItems.length > 0 ? '顺手接下一件' : '顺手接下一件：暂无其他紧急事项'}
          >
            <header>
              <Sparkles size={12} />
              <span>
                <b>{farmPriorityQueueItems.length > 0 ? '顺手接下一件' : '节奏很稳'}</b>
                <small>{farmPriorityQueueItems.length > 0 ? '最多 3 条，点了才执行' : '先完成当前优先，后续会刷新'}</small>
              </span>
              <button
                type="button"
                data-farm-panel-priority-queue-route-button="true"
                disabled={!farmPriorityQueueRoutePreviewItem}
                aria-disabled={!farmPriorityQueueRoutePreviewItem ? 'true' : undefined}
                title={farmPriorityQueueRoutePreviewItem ? `先看路线：${farmPriorityQueueRoutePreviewItem.routeLabel || farmPriorityQueueRoutePreviewItem.label} · 不执行动作` : '暂无后续路线'}
                aria-label={farmPriorityQueueRoutePreviewItem ? `先看路线：${farmPriorityQueueRoutePreviewItem.routeLabel || farmPriorityQueueRoutePreviewItem.label}，不执行动作` : '暂无后续路线'}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!farmPriorityQueueRoutePreviewItem) return;
                  handleFarmPriorityQueueRoutePreview(farmPriorityQueueRoutePreviewItem);
                }}
              >
                {farmPriorityQueueRouteReceipt ? '已指路' : farmPriorityQueueRoutePreviewItem ? `看${farmPriorityQueueRoutePreviewItem.routeLabel || '路线'}` : '0条'}
              </button>
            </header>
            {farmPriorityQueueItems.length > 0 ? (
              farmPriorityQueueItems.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-farm-panel-priority-queue-item={item.id}
                  data-farm-panel-priority-queue-kind={item.kind}
                  data-farm-panel-priority-queue-section={item.section}
                  data-farm-panel-priority-queue-route-target={item.routeTarget}
                  data-farm-panel-priority-queue-route-label={item.routeLabel}
                  data-farm-panel-priority-queue-ready={farmPriorityQueueItems.some((current) => current.id === item.id) ? 'true' : undefined}
                  data-farm-panel-priority-queue-receipt={farmPriorityQueueReceipt === item.id ? 'true' : undefined}
                  data-farm-panel-priority-queue-impact-label={item.impactLabel}
                  data-farm-panel-priority-queue-reason-label={item.reasonLabel}
                  data-farm-panel-priority-queue-safety-label={item.safetyLabel}
                  title={`顺手接下一件：${item.label} · ${item.detail} · ${item.impactLabel} · ${item.reasonLabel} · ${item.safetyLabel}`}
                  aria-label={`顺手接下一件：${item.label}，${item.detail}，${item.impactLabel}，${item.reasonLabel}，${item.safetyLabel}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmPriorityQueueAction(item);
                  }}
                >
                  <Sparkles size={12} />
                  <span>
                    <b>{item.label}</b>
                    <em>{item.detail}</em>
                    <span
                      className="t8-farm-story-panel__priority-queue-meta"
                      data-farm-panel-priority-queue-meta="true"
                      aria-hidden="true"
                    >
                      <small data-farm-panel-priority-queue-impact="true">{item.impactLabel}</small>
                      <small data-farm-panel-priority-queue-reason="true">{item.reasonLabel}</small>
                      <i data-farm-panel-priority-queue-safety="true">{item.safetyLabel}</i>
                    </span>
                  </span>
                  <mark data-farm-panel-priority-queue-action-label="true">
                    {farmPriorityQueueReceipt === item.id ? '已接上' : item.actionLabel || item.routeLabel || '接上'}
                  </mark>
                </button>
              ))
            ) : (
              <p data-farm-panel-priority-queue-empty-note="true">
                <Sparkles size={12} />
                <span>
                  <b>暂无其他紧急事项</b>
                  <small>当前优先完成后，订单、来访、缺水和成熟会自动接入这里。</small>
                </span>
              </p>
            )}
          </div>
          <div
            className="t8-farm-story-panel__section-presets"
            data-farm-panel-section-presets="true"
            data-farm-panel-section-presets-open-count={farmPanelOpenSectionCount}
            data-farm-panel-section-presets-daily-count={farmPanelDailyOpenSectionCount}
            data-farm-panel-section-presets-priority={farmMonitorBriefSection}
            data-farm-panel-section-presets-receipt={farmPanelSectionPresetReceipt?.presetId || undefined}
            data-farm-panel-section-presets-receipt-count={farmPanelSectionPresetReceipt?.count}
            data-farm-panel-section-presets-receipt-target={farmPanelSectionPresetReceipt?.targetSection}
            aria-label="牧场栏目快捷展开"
          >
            <button
              type="button"
              data-farm-panel-section-preset="priority"
              data-farm-panel-section-preset-active={farmPanelPriorityPresetActive ? 'true' : undefined}
              data-farm-panel-section-preset-receipt={farmPanelSectionPresetReceipt?.presetId === 'priority' ? 'true' : undefined}
              data-farm-panel-section-preset-target={farmMonitorBriefSection}
              title={`只展开当前优先：${farmMonitorBriefSectionLabel} · ${farmMonitorBriefPrimary}`}
              aria-label={`只展开当前优先：${farmMonitorBriefSectionLabel}，${farmMonitorBriefPrimary}`}
              onClick={(event) => {
                event.stopPropagation();
                applyFarmPanelSectionPreset('priority');
              }}
            >
              <Sparkles size={13} />
              <span>优先</span>
              <small>{farmMonitorBriefSectionLabel}</small>
            </button>
            <button
              type="button"
              data-farm-panel-section-preset="daily"
              data-farm-panel-section-preset-active={farmPanelDailyPresetActive ? 'true' : undefined}
              data-farm-panel-section-preset-receipt={farmPanelSectionPresetReceipt?.presetId === 'daily' ? 'true' : undefined}
              data-farm-panel-section-preset-count={farmPanelDailyOpenSectionCount}
              title="只展开常用栏目：短反馈、今日目标、工具栏、最近农活"
              aria-label="只展开常用栏目：短反馈、今日目标、工具栏、最近农活"
              onClick={(event) => {
                event.stopPropagation();
                applyFarmPanelSectionPreset('daily');
              }}
            >
              <Grid2X2 size={13} />
              <span>常用</span>
              <small>{farmPanelDailyOpenSectionCount}/{FARM_PANEL_DAILY_SECTION_IDS.length}</small>
            </button>
            <button
              type="button"
              data-farm-panel-section-preset="close-all"
              data-farm-panel-section-preset-receipt={farmPanelSectionPresetReceipt?.presetId === 'close-all' ? 'true' : undefined}
              data-farm-panel-section-preset-disabled={farmPanelOpenSectionCount === 0 ? 'true' : undefined}
              disabled={farmPanelOpenSectionCount === 0}
              title={farmPanelOpenSectionCount > 0 ? `收起已展开栏目：${farmPanelOpenSectionCount}栏` : '当前没有展开栏目'}
              aria-label={farmPanelOpenSectionCount > 0 ? `收起已展开栏目：${farmPanelOpenSectionCount}栏` : '当前没有展开栏目'}
              onClick={(event) => {
                event.stopPropagation();
                applyFarmPanelSectionPreset('close-all');
              }}
            >
              <X size={13} />
              <span>全收</span>
              <small>{farmPanelOpenSectionCount}栏</small>
            </button>
            {farmPanelSectionPresetReceipt && (
              <p
                data-farm-panel-section-preset-receipt-card="true"
                data-farm-panel-section-preset-receipt-id={farmPanelSectionPresetReceipt.presetId}
                data-farm-panel-section-preset-receipt-count={farmPanelSectionPresetReceipt.count}
                data-farm-panel-section-preset-receipt-target={farmPanelSectionPresetReceipt.targetSection}
                role="status"
                aria-live="polite"
                title={`${farmPanelSectionPresetReceipt.label}：${farmPanelSectionPresetReceipt.detail}`}
              >
                <Sparkles size={12} />
                <span>
                  <b>{farmPanelSectionPresetReceipt.label}</b>
                  <small>{farmPanelSectionPresetReceipt.detail}</small>
                </span>
                <mark>{farmPanelSectionPresetReceipt.count > 0 ? `${farmPanelSectionPresetReceipt.count}栏` : '干净'}</mark>
              </p>
            )}
          </div>
          <div
            className="t8-farm-story-panel__section-switchboard"
            data-farm-panel-section-switchboard="true"
            data-farm-panel-section-layout="compact-list"
            aria-label="牧场控制台栏目"
          >
            {farmPanelSectionItems.map((item) => {
              const SectionIcon = item.icon;
              const expanded = isFarmPanelSectionExpanded(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  data-farm-panel-section-toggle={item.id}
                  data-farm-panel-section-open={expanded ? 'true' : undefined}
                  data-farm-panel-section-label={item.label}
                  data-farm-panel-section-summary={item.summary}
                  data-farm-panel-section-priority={farmMonitorBriefSection === item.id ? 'true' : undefined}
                  data-farm-panel-section-priority-receipt={farmPrioritySectionReceipt === item.id ? 'true' : undefined}
                  aria-expanded={expanded}
                  title={`${expanded ? '收起' : '展开'}${item.label}：${item.summary}`}
                  aria-label={`${expanded ? '收起' : '展开'}${item.label}，${item.summary}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFarmPanelSection(item.id);
                  }}
                >
                <SectionIcon size={13} />
                <span>{item.label}</span>
                <small>{item.summary}</small>
                <em aria-hidden="true" data-farm-panel-section-indicator="true" />
              </button>
            );
          })}
          </div>
          <div className="t8-farm-story-panel__stats" aria-label="牧场资源" aria-live="polite">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <span key={stat.label} title={stat.title || stat.label}>
                  <Icon size={13} />
                  <b>{stat.value}</b>
                  <small>{stat.label}</small>
                </span>
              );
            })}
          </div>
          <div
            className="t8-farm-story-panel__detail-rail"
            data-farm-panel-detail-rail="true"
            data-farm-panel-detail-rail-active={activeFarmPanelSectionId || undefined}
          >
          {activeFarmPanelSectionItem && (
            <div
              className="t8-farm-story-panel__section-detail-head"
              data-farm-panel-section-detail-head="true"
              data-farm-panel-section-detail={activeFarmPanelSectionItem.id}
              data-farm-panel-section-detail-label={activeFarmPanelSectionItem.label}
              role="heading"
              aria-level={3}
            >
              <span>
                <b>{activeFarmPanelSectionItem.label}</b>
                <small>{activeFarmPanelSectionItem.summary}</small>
              </span>
              <button
                type="button"
                data-farm-panel-section-detail-collapse="true"
                title={`折叠${activeFarmPanelSectionItem.label}`}
                aria-label={`折叠${activeFarmPanelSectionItem.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setFarmPanelSectionOpen(activeFarmPanelSectionItem.id, false);
                }}
              >
                <X size={13} />
                <span>折叠</span>
              </button>
            </div>
          )}
          {farmMiniQuickActionFeedback && panelOpen && farmMiniQuickActionSummaryLabel && (
            <div
              className="t8-farm-story-panel__summary-detail"
              data-farm-summary-detail="true"
              data-farm-mini-focus-action-summary={farmMiniQuickActionSummaryLabel}
              data-farm-summary-detail-action-feedback={farmSummaryDetailActionFeedback || undefined}
              data-farm-summary-detail-action-feedback-item-id={farmSummaryDetailActionFeedbackItemId || undefined}
              role="status"
              aria-live="polite"
              title={`刚刚执行：${farmMiniQuickActionSummaryLabel}`}
            >
              <Sparkles size={12} />
              <span>刚刚执行</span>
              <b>{farmMiniQuickActionSummaryLabel}</b>
              <div className="t8-farm-story-panel__summary-detail-chips" aria-label="刚刚执行拆分回执">
                {farmMiniQuickActionDetailItems.map((item) => {
                  const chipContent = (
                    <>
                      <small>{item.title}</small>
                      <em>{item.label}</em>
                      {item.actionResourcePreview && (
                        <i data-farm-summary-detail-chip-resource="true">{item.actionResourcePreview}</i>
                      )}
                    </>
                  );
                  if (item.action) {
                    const action = item.action;
                    const actionFeedbackActive = farmSummaryDetailActionFeedbackItemId === item.id && Boolean(farmSummaryDetailActionFeedback);
                    const actionChipContent = actionFeedbackActive ? (
                      <>
                        <small>已继续</small>
                        <em>{farmSummaryDetailActionFeedback}</em>
                      </>
                    ) : chipContent;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-farm-summary-detail-chip={item.id}
                        data-farm-summary-detail-chip-actionable="true"
                        data-farm-summary-detail-chip-action-kind={item.actionKind || undefined}
                        data-farm-summary-detail-chip-resource-targets={item.actionResourceTargets?.join(' ') || undefined}
                        data-farm-summary-detail-chip-resource-preview={item.actionResourcePreview || undefined}
                        data-farm-summary-detail-chip-active={actionFeedbackActive ? 'true' : undefined}
                        data-farm-summary-detail-chip-result={actionFeedbackActive ? farmSummaryDetailActionFeedback : undefined}
                        data-farm-summary-detail-chip-cooldown={actionFeedbackActive ? 'true' : undefined}
                        disabled={actionFeedbackActive}
                        aria-disabled={actionFeedbackActive ? 'true' : undefined}
                        title={actionFeedbackActive ? `刚刚继续：${farmSummaryDetailActionFeedback}` : `${item.title}：${item.label} · ${item.actionLabel || '执行'}`}
                        aria-label={actionFeedbackActive ? `刚刚继续：${farmSummaryDetailActionFeedback}` : `${item.actionLabel || '执行'}：${item.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (actionFeedbackActive) return;
                          handleFarmGoalAction(action);
                          flashFarmSummaryDetailAction(item.actionLabel || '继续小目标', item.id);
                        }}
                      >
                        {actionChipContent}
                      </button>
                    );
                  }
                  return (
                    <span key={item.id} data-farm-summary-detail-chip={item.id} title={`${item.title}：${item.label}`}>
                      {chipContent}
                    </span>
                  );
                })}
              </div>
              {farmSummaryDetailActionFeedback && (
                <span
                  className="t8-farm-story-panel__summary-detail-action-feedback"
                  data-farm-summary-detail-action-feedback-chip="true"
                  role="status"
                  aria-live="polite"
                  title={`刚刚继续：${farmSummaryDetailActionFeedback}`}
                >
                  <Sparkles size={10} />
                  <em>已继续</em>
                  <b>{farmSummaryDetailActionFeedback}</b>
                </span>
              )}
            </div>
          )}
          {farmLiveFeedbackItems.length > 0 && (
            <div
              ref={farmLiveFeedbackRef}
              className="t8-farm-story-panel__live-feedback"
              aria-label="牧场短反馈"
              aria-live="polite"
              aria-atomic="true"
              role="status"
              data-farm-live-feedback-count={farmLiveFeedbackItems.length}
              data-farm-live-feedback-completion-notice={farmLiveFeedbackCompletionNotice ? 'true' : undefined}
              data-farm-panel-priority-content={farmPrioritySectionReceipt === 'feedback' ? 'true' : undefined}
              tabIndex={-1}
            >
              <span className="t8-farm-story-panel__live-feedback-label">
                <Sparkles size={12} />
                短反馈
              </span>
              {farmLiveFeedbackCompletionNotice && (
                <div
                  className="t8-farm-story-panel__live-feedback-completion-notice"
                  role="status"
                  aria-live="polite"
                  aria-label={farmLiveFeedbackCompletionNotice.summaryLabel}
                  data-farm-live-feedback-completion-goal={farmLiveFeedbackCompletionNotice.goalId}
                  data-farm-live-feedback-completion-action={farmLiveFeedbackCompletionNotice.actionKind}
                  data-farm-live-feedback-completion-kind={farmLiveFeedbackCompletionNotice.goalKind}
                  data-farm-live-feedback-completion-resources={farmLiveFeedbackCompletionNotice.resourceTargets.join(' ') || undefined}
                  data-farm-live-feedback-completion-progress={farmLiveFeedbackCompletionNotice.progress}
                  data-farm-live-feedback-completion-target={farmLiveFeedbackCompletionNotice.target}
                  data-farm-live-feedback-completion-summary={farmLiveFeedbackCompletionNotice.summaryLabel}
                  title={farmLiveFeedbackCompletionNotice.summaryLabel}
                >
                  <FarmLiveFeedbackCompletionIcon icon={farmLiveFeedbackCompletionNotice.icon} />
                  <strong>目标完成</strong>
                  <b data-farm-live-feedback-completion-kind="true">{farmLiveFeedbackCompletionNotice.goalKindLabel}</b>
                  <span>{farmLiveFeedbackCompletionNotice.goalTitle}</span>
                  <em data-farm-live-feedback-completion-action-label="true">{farmLiveFeedbackCompletionNotice.actionLabel}</em>
                  <small data-farm-live-feedback-completion-progress="true">{farmLiveFeedbackCompletionNotice.progressLabel}</small>
                  {farmLiveFeedbackCompletionNotice.resourceLabel && (
                    <i data-farm-live-feedback-completion-resource="true">{farmLiveFeedbackCompletionNotice.resourceLabel}</i>
                  )}
                </div>
              )}
              <div className="t8-farm-story-panel__live-feedback-list">
                {farmLiveFeedbackItems.map((item) => {
                  const ItemIcon = item.icon;
                  const liveFeedbackResourceTargets = item.action ? farmActionResourceTargets(item.action) : [];
                  const liveFeedbackResourcePreview = item.action ? farmActionResourcePreviewLabel(liveFeedbackResourceTargets) : '';
                  const liveFeedbackFocusLinked = item.action ? farmFocusActionMatches(item.action, primaryFarmFocus?.action) : false;
                  const liveFeedbackProgressPreview = liveFeedbackFocusLinked ? primaryFarmFocusProgressPreview : '';
                  const liveFeedbackCompletesFocus = liveFeedbackFocusLinked && primaryFarmFocus
                    ? primaryFarmFocusNextProgress >= primaryFarmFocus.target && !primaryFarmFocusComplete
                    : false;
                  const liveFeedbackForecasts = [liveFeedbackResourcePreview, liveFeedbackProgressPreview].filter(Boolean).join('，');
                  const liveFeedbackActionDescription = liveFeedbackForecasts
                    ? `${item.actionLabel || '执行'}：${item.label}，${liveFeedbackForecasts}`
                    : `${item.actionLabel || '执行'}：${item.label}`;
                  const liveFeedbackActionActive = farmSummaryDetailActionFeedbackItemId === item.id && Boolean(farmSummaryDetailActionFeedback);
                  const liveFeedbackProgressResult = liveFeedbackActionActive && liveFeedbackFocusLinked
                    ? liveFeedbackProgressPreview.replace('预计：', '已推进 ')
                    : '';
                  const liveFeedbackCompletionResult = liveFeedbackActionActive && liveFeedbackCompletesFocus ? '已达成目标' : '';
                  const content = (
                    <>
                      <ItemIcon size={10} />
                      <span>{item.label}</span>
                      {item.rewardKindLabel && (
                        <small data-farm-live-reward-kind-label="true">{item.rewardKindLabel}</small>
                      )}
                      {item.action && <small>{item.actionLabel || '执行'}</small>}
                      {liveFeedbackResourcePreview && (
                        <em data-farm-feedback-action-resource="true">{liveFeedbackResourcePreview.replace('预期：', '')}</em>
                      )}
                      {liveFeedbackProgressPreview && (
                        <em data-farm-feedback-action-progress="true">{liveFeedbackProgressPreview.replace('预计：', '进度 ')}</em>
                      )}
                      {liveFeedbackCompletesFocus && (
                        <em data-farm-feedback-action-completes-focus="true">将完成</em>
                      )}
                    </>
                  );
                  const liveFeedbackContent = liveFeedbackActionActive ? (
                    <>
                      <Sparkles size={10} />
                      <span>{`已执行：${farmSummaryDetailActionFeedback}`}</span>
                      {liveFeedbackProgressResult && (
                        <em data-farm-feedback-action-progress-result="true">{liveFeedbackProgressResult}</em>
                      )}
                      {liveFeedbackCompletionResult && (
                        <em data-farm-feedback-action-completion-result="true">{liveFeedbackCompletionResult}</em>
                      )}
                    </>
                  ) : content;
                  return item.action ? (
                    <button
                      key={item.id}
                      type="button"
                      className="t8-farm-story-panel__live-feedback-item is-actionable"
                      data-farm-feedback-kind={item.kind}
                      data-farm-reward-kind={item.rewardKind || undefined}
                      data-farm-reward-kind-label={item.rewardKindLabel || undefined}
                      data-farm-feedback-action={item.action.kind}
                      data-farm-feedback-action-busy={liveFeedbackActionActive ? 'true' : undefined}
                      data-farm-feedback-action-result={liveFeedbackActionActive ? farmSummaryDetailActionFeedback : undefined}
                      data-farm-feedback-action-resource-targets={liveFeedbackResourceTargets.join(' ') || undefined}
                      data-farm-feedback-action-resource-preview={liveFeedbackResourcePreview || undefined}
                      data-farm-feedback-action-focus-linked={liveFeedbackFocusLinked ? 'true' : undefined}
                      data-farm-feedback-action-progress-preview={liveFeedbackProgressPreview || undefined}
                      data-farm-feedback-action-progress-result={liveFeedbackProgressResult || undefined}
                      data-farm-feedback-action-completes-focus={liveFeedbackCompletesFocus ? 'true' : undefined}
                      data-farm-feedback-action-completion-result={liveFeedbackCompletionResult || undefined}
                      data-farm-feedback-action-next-progress={liveFeedbackFocusLinked && primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
                      data-farm-feedback-action-target={liveFeedbackFocusLinked && primaryFarmFocus ? primaryFarmFocus.target : undefined}
                      disabled={liveFeedbackActionActive}
                      aria-disabled={liveFeedbackActionActive ? 'true' : undefined}
                      aria-label={liveFeedbackActionActive ? `刚刚执行：${farmSummaryDetailActionFeedback}` : liveFeedbackActionDescription}
                      title={liveFeedbackActionActive ? `刚刚执行：${farmSummaryDetailActionFeedback}` : liveFeedbackActionDescription}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFarmLiveFeedbackAction(item);
                      }}
                    >
                      {liveFeedbackContent}
                    </button>
                  ) : (
                    <span
                      key={item.id}
                      className="t8-farm-story-panel__live-feedback-item"
                      data-farm-feedback-kind={item.kind}
                      data-farm-reward-kind={item.rewardKind || undefined}
                      data-farm-reward-kind-label={item.rewardKindLabel || undefined}
                      title={item.rewardKindLabel ? `${item.rewardKindLabel}：${item.label}` : item.label}
                    >
                      {content}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {farmDailyRouteSteps.length > 0 && (
            <section
              className="t8-farm-story-panel__daily-route"
              data-farm-daily-route="true"
              data-farm-daily-route-count={farmDailyRouteSteps.length}
              data-farm-daily-route-summary={farmDailyRouteSummaryLabel || undefined}
              aria-label={`今日经营路线：${farmDailyRouteSummaryLabel}`}
              title={`今日经营路线：${farmDailyRouteSummaryLabel}`}
            >
              <div className="t8-farm-story-panel__daily-route-head">
                <span>
                  <Sparkles size={12} />
                  今日经营路线
                </span>
                <small>{farmDailyRouteSteps.length}步</small>
              </div>
              <div className="t8-farm-story-panel__daily-route-steps">
                {farmDailyRouteSteps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    className="t8-farm-story-panel__daily-route-step"
                    data-farm-daily-route-step={step.id}
                    data-farm-daily-route-target={step.routeTarget || undefined}
                    data-farm-daily-route-action={step.action.kind}
                    data-farm-daily-route-receipt={farmDailyRouteReceipt === step.id ? 'true' : undefined}
                    aria-label={`${step.stageLabel}：${step.title}，${step.detail}，执行 ${step.actionLabel}`}
                    title={step.routeTitle}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFarmDailyRouteStepAction(step);
                    }}
                  >
                    <em>{step.stageLabel}</em>
                    <span>
                      <b>{step.title}</b>
                      <small>{step.detail}</small>
                    </span>
                    <i>
                      {step.routeLabel}
                      {step.countLabel && <mark>{step.countLabel}</mark>}
                    </i>
                    {step.resourceLabel && (
                      <small data-farm-daily-route-resource="true">{step.resourceLabel}</small>
                    )}
                    {farmDailyRouteReceipt === step.id && (
                      <strong data-farm-daily-route-receipt-chip="true">已接上</strong>
                    )}
                  </button>
                ))}
              </div>
              {farmDailyRouteNextStep && (
                <button
                  type="button"
                  className="t8-farm-story-panel__daily-route-next"
                  data-farm-daily-route-next="true"
                  data-farm-daily-route-next-from={farmDailyRouteReceipt}
                  data-farm-daily-route-next-step={farmDailyRouteNextStep.id}
                  data-farm-daily-route-next-stage={farmDailyRouteNextStep.stageLabel}
                  data-farm-daily-route-next-target={farmDailyRouteNextStep.routeTarget || undefined}
                  title={farmDailyRouteNextTitle}
                  aria-label={farmDailyRouteNextTitle}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmDailyRouteStepAction(farmDailyRouteNextStep);
                  }}
                >
                  <Sparkles size={12} />
                  <span>
                    <b>接下一步</b>
                    <small>{farmDailyRouteNextStep.stageLabel} · {farmDailyRouteNextStep.title}</small>
                  </span>
                  <em>
                    {farmDailyRouteNextStep.routeLabel}
                    {farmDailyRouteNextStep.countLabel && <mark>{farmDailyRouteNextStep.countLabel}</mark>}
                  </em>
                </button>
              )}
              {farmDailyRouteCompleteReceipt && (
                <div
                  className="t8-farm-story-panel__daily-route-complete"
                  data-farm-daily-route-complete="true"
                  data-farm-daily-route-complete-count={farmDailyRouteSteps.length}
                  data-farm-daily-route-complete-summary={farmDailyRouteSummaryLabel || undefined}
                  role="status"
                  aria-live="polite"
                  title={farmDailyRouteCompleteTitle}
                  aria-label={farmDailyRouteCompleteTitle}
                >
                  <Sparkles size={12} />
                  <span>
                    <b>今日路线完成</b>
                    <small>{farmDailyRouteSummaryLabel || `${farmDailyRouteSteps.length}步`}</small>
                  </span>
                  <em>{farmDailyRouteSteps.length}步</em>
                </div>
              )}
              {farmDailyRouteCompleteReceipt && (
                <button
                  type="button"
                  className="t8-farm-story-panel__daily-route-wrapup"
                  data-farm-daily-route-wrapup="true"
                  data-farm-daily-route-wrapup-action="advance-day"
                  data-farm-daily-route-wrapup-target="day"
                  title={farmDailyRouteWrapupTitle}
                  aria-label={farmDailyRouteWrapupTitle}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmDailyRouteWrapupAction();
                  }}
                >
                  <CalendarDays size={12} />
                  <span>
                    <b>今日收尾</b>
                    <small>过一天查看明日总结</small>
                  </span>
                  <em>D{farmCanvas?.day || 1} {'->'} D{(farmCanvas?.day || 1) + 1}</em>
                </button>
              )}
            </section>
          )}
          <div
            ref={farmSeasonRef}
            className="t8-farm-story-panel__season"
            data-farm-season={currentSeason}
            data-farm-season-focus={farmSeasonDetailOpened ? 'true' : undefined}
            data-farm-season-pulse={farmSeasonDetailPulseId || undefined}
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'season' ? 'true' : undefined}
            tabIndex={-1}
            aria-label={`当前季节：${seasonDefinition.label}`}
          >
            <div className="t8-farm-story-panel__season-head">
              <span>
                <Sprout size={13} />
                {seasonDefinition.themeLabel}
              </span>
              <small data-farm-season-weather="true">天气 {farmWeatherShortLabel(currentWeather)}</small>
              <strong>{seasonProgress.dayInSeason}/{seasonProgress.daysTotal} 天</strong>
              {farmSeasonDetailOpened && (
                <em data-farm-season-located-feedback="true">已定位</em>
              )}
            </div>
            <p>{seasonDefinition.hint}</p>
            <div
              className="t8-farm-story-panel__season-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={seasonProgress.daysTotal}
              aria-valuenow={seasonProgress.dayInSeason}
              title={`下一季：${nextSeasonLabel}`}
            >
              <i style={{ width: `${seasonProgress.percent}%` }} />
            </div>
            <small>{seasonDefinition.cropHint} · 下一季：{nextSeasonLabel}</small>
          </div>
          {primaryFarmFocus && (
            <div
              ref={farmFocusRef}
              className={`t8-farm-story-panel__focus is-${primaryFarmFocus.kind}`}
              data-farm-focus-goal={primaryFarmFocus.id}
              data-farm-panel-priority-content={farmPrioritySectionReceipt === 'focus' ? 'true' : undefined}
              data-farm-focus-progress-preview={primaryFarmFocusProgressPreview || undefined}
              data-farm-focus-next-progress={primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
              data-farm-focus-next-percent={primaryFarmFocus ? primaryFarmFocusNextPercent : undefined}
              data-farm-focus-action-resource-targets={primaryFarmFocusActionResourceTargets.join(' ') || undefined}
              data-farm-focus-action-resource-preview={primaryFarmFocusActionResourcePreview || undefined}
              aria-label={`牧场今日小目标：${primaryFarmFocus.title}，${primaryFarmFocus.progress}/${primaryFarmFocus.target}，${primaryFarmFocusStatusLabel}，${primaryFarmFocusProgressPreview}，下一步 ${primaryFarmFocus.actionLabel}${primaryFarmFocusActionResourcePreview ? `，${primaryFarmFocusActionResourcePreview}` : ''}`}
              aria-live="polite"
              title={`今日小目标：${primaryFarmFocus.title} · ${primaryFarmFocusProgressPreview} · 下一步：${primaryFarmFocus.actionLabel}${primaryFarmFocusActionResourcePreview ? ` · ${primaryFarmFocusActionResourcePreview}` : ''}`}
            >
              <div className="t8-farm-story-panel__focus-head">
                <span>
                  <Sparkles size={13} />
                  今日小目标
                </span>
                <strong
                  data-farm-focus-head-progress-preview={primaryFarmFocusProgressPreview || undefined}
                  data-farm-focus-head-next-progress={primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
                  data-farm-focus-head-next-percent={primaryFarmFocus ? primaryFarmFocusNextPercent : undefined}
                  title={`小目标 ${primaryFarmFocus.progress}/${primaryFarmFocus.target} · ${primaryFarmFocusProgressPreview}`}
                >
                  {primaryFarmFocus.progress}/{primaryFarmFocus.target}
                  {primaryFarmFocusProgressPreview && (
                    <small data-farm-focus-head-progress-preview="true">{primaryFarmFocusProgressPreview}</small>
                  )}
                </strong>
              </div>
              <b>{primaryFarmFocus.title}</b>
              <p>{primaryFarmFocus.detail}</p>
              {primaryFarmFocusForecastItems.length > 0 && (
                <div
                  className="t8-farm-story-panel__focus-forecast"
                  data-farm-focus-forecast="true"
                  data-farm-focus-forecast-progress={primaryFarmFocusProgressPreview || undefined}
                  data-farm-focus-forecast-resource={primaryFarmFocusActionResourcePreview || undefined}
                  data-farm-focus-forecast-action={primaryFarmFocus.actionLabel}
                  aria-label={`小目标预期：${primaryFarmFocusForecastItems.map((item) => item.label).join('，')}`}
                >
                  {primaryFarmFocusForecastItems.map((item) => (
                    item.actionable ? (
                      <button
                        key={item.id}
                        type="button"
                        data-farm-focus-forecast-item="true"
                        data-farm-focus-forecast-tone={item.tone}
                        data-farm-focus-forecast-actionable="true"
                        data-farm-focus-forecast-busy={farmMiniQuickActionBusy ? 'true' : undefined}
                        disabled={farmMiniQuickActionBusy}
                        aria-label={`执行小目标摘要动作：${item.label}`}
                        title={`${item.label} · ${primaryFarmFocusProgressPreview}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleFarmFocusAction(primaryFarmFocus);
                        }}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <small
                        key={item.id}
                        data-farm-focus-forecast-item="true"
                        data-farm-focus-forecast-tone={item.tone}
                      >
                        {item.label}
                      </small>
                    )
                  ))}
                  {farmMiniQuickActionFeedback && (
                    <small
                      className="t8-farm-story-panel__focus-forecast-receipt"
                      data-farm-focus-forecast-receipt="true"
                      data-farm-focus-forecast-receipt-kind={farmMiniQuickActionFeedback.kind}
                      data-farm-focus-forecast-receipt-action={farmMiniQuickActionFeedback.actionKind}
                      role="status"
                      aria-live="polite"
                    >
                      <MiniQuickActionIcon size={10} aria-hidden="true" />
                      <span>已执行：{farmMiniQuickActionSummaryLabel || farmMiniQuickActionFeedback.label}</span>
                      {farmMiniQuickActionReceiptItems.map((item) => {
                        const receiptActionFeedbackActive = farmSummaryDetailActionFeedbackItemId === item.id && Boolean(farmSummaryDetailActionFeedback);
                        if (item.action) {
                          const action = item.action;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-farm-focus-forecast-receipt-chip={item.id}
                              data-farm-focus-forecast-receipt-chip-actionable="true"
                              data-farm-focus-forecast-receipt-chip-action-kind={item.actionKind || undefined}
                              data-farm-focus-forecast-receipt-chip-resource-targets={item.actionResourceTargets?.join(' ') || undefined}
                              data-farm-focus-forecast-receipt-chip-resource-preview={item.actionResourcePreview || undefined}
                              data-farm-focus-forecast-receipt-chip-active={receiptActionFeedbackActive ? 'true' : undefined}
                              data-farm-focus-forecast-receipt-chip-result={receiptActionFeedbackActive ? farmSummaryDetailActionFeedback : undefined}
                              data-farm-focus-forecast-receipt-chip-cooldown={receiptActionFeedbackActive ? 'true' : undefined}
                              title={receiptActionFeedbackActive ? `刚刚继续：${farmSummaryDetailActionFeedback}` : `继续：${item.actionLabel || item.label}`}
                              aria-label={receiptActionFeedbackActive ? `刚刚继续：${farmSummaryDetailActionFeedback}` : `继续小目标：${item.actionLabel || item.label}`}
                              disabled={receiptActionFeedbackActive}
                              aria-disabled={receiptActionFeedbackActive ? 'true' : undefined}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (receiptActionFeedbackActive) return;
                                handleFarmGoalAction(action);
                                flashFarmSummaryDetailAction(item.actionLabel || '继续小目标', item.id);
                              }}
                            >
                              <em>{receiptActionFeedbackActive ? `已继续：${farmSummaryDetailActionFeedback}` : `${item.title}：${item.label}`}</em>
                              {!receiptActionFeedbackActive && item.actionResourcePreview && (
                                <i data-farm-focus-forecast-receipt-chip-resource="true">{item.actionResourcePreview}</i>
                              )}
                            </button>
                          );
                        }
                        return (
                          <em
                            key={item.id}
                            data-farm-focus-forecast-receipt-chip={item.id}
                            title={`${item.title}：${item.label}`}
                            aria-hidden="true"
                          >
                            {item.title}：{item.label}
                          </em>
                        );
                      })}
                    </small>
                  )}
                </div>
              )}
              <div
                className="t8-farm-story-panel__focus-progress"
                data-farm-focus-progress-preview={primaryFarmFocusProgressPreview || undefined}
                data-farm-focus-next-progress={primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
                data-farm-focus-next-percent={primaryFarmFocus ? primaryFarmFocusNextPercent : undefined}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={primaryFarmFocus.target}
                aria-valuenow={primaryFarmFocus.progress}
                title={`小目标进度 ${primaryFarmFocus.percent}% · ${primaryFarmFocusProgressPreview}`}
              >
                {primaryFarmFocusProgressPreview && (
                  <i data-farm-focus-progress-forecast-bar="true" style={{ width: `${primaryFarmFocusNextPercent}%` }} />
                )}
                <i data-farm-focus-progress-current="true" style={{ width: `${primaryFarmFocus.percent}%` }} />
              </div>
              <div className="t8-farm-story-panel__focus-actions">
                <button
                  type="button"
                  className={primaryFarmFocus.ready ? 'is-ready' : ''}
                  data-farm-focus-action-resource-targets={primaryFarmFocusActionResourceTargets.join(' ') || undefined}
                  data-farm-focus-action-resource-preview={primaryFarmFocusActionResourcePreview || undefined}
                  data-farm-focus-action-progress-preview={primaryFarmFocusProgressPreview || undefined}
                  data-farm-focus-action-next-progress={primaryFarmFocus ? primaryFarmFocusNextProgress : undefined}
                  data-farm-focus-action-target={primaryFarmFocus.target}
                  aria-label={`执行牧场小目标：${primaryFarmFocus.title} · ${primaryFarmFocusProgressPreview}`}
                  title={`${primaryFarmFocus.actionLabel} · ${primaryFarmFocusProgressPreview}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmFocusAction(primaryFarmFocus);
                  }}
                >
                  <span>{primaryFarmFocus.actionLabel}</span>
                  {primaryFarmFocusActionResourcePreview && (
                    <small data-farm-focus-action-resource="true">{primaryFarmFocusActionResourcePreview}</small>
                  )}
                  {primaryFarmFocusProgressPreview && (
                    <small data-farm-focus-action-progress="true">{primaryFarmFocusProgressPreview}</small>
                  )}
                </button>
                {farmFocusGoals.length > 1 && (
                  <div className="t8-farm-story-panel__focus-next" aria-label="后续小目标">
                    {farmFocusGoals.slice(1).map((goal) => (
                      <span key={goal.id} data-farm-focus-next={goal.kind}>
                        {goal.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div
            ref={farmBeautyRef}
            className={`t8-farm-story-panel__beauty is-level-${farmBeautyScore.level}`}
            data-farm-beauty-focus={farmBeautyDetailOpened ? 'true' : undefined}
            data-farm-beauty-pulse={farmBeautyDetailPulseId || undefined}
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'beauty' ? 'true' : undefined}
            data-farm-beauty-reward-route-target={farmBeautyRewardRouteTarget}
            data-farm-beauty-reward-route-label={farmBeautyRewardRouteLabel}
            data-farm-beauty-reward-route-reward={farmBeautyRewardRouteRewardLabel}
            data-farm-beauty-reward-route-count={farmBeautyRewardRouteCountLabel}
            data-farm-beauty-reward-route-receipt={farmBeautyRewardRouteReceipt || undefined}
            tabIndex={-1}
            aria-label={`牧场漂亮度：${farmBeautyScore.score} 分`}
            aria-live="polite"
          >
            <div className="t8-farm-story-panel__beauty-head">
              <span>
                <ImageIcon size={13} />
                漂亮度
              </span>
              <strong>{farmBeautyScore.score}/100</strong>
              {farmBeautyDetailOpened && (
                <em data-farm-beauty-located-feedback="true">已定位</em>
              )}
            </div>
            <b>{farmBeautyScore.title}</b>
            <div
              className="t8-farm-story-panel__beauty-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={farmBeautyScore.score}
              title={farmBeautyScore.nextHint}
            >
              <i style={{ width: `${farmBeautyScore.score}%` }} />
            </div>
            <p>{farmBeautyScore.summary}</p>
            <small>{farmBeautyScore.nextHint}</small>
            <div className="t8-farm-story-panel__beauty-factors" aria-label="漂亮度来源">
              {farmBeautyScore.factors.slice(0, 4).map((factor) => (
                <span
                  key={factor.id}
                  className={factor.done ? 'is-done' : ''}
                  data-farm-beauty-factor={factor.id}
                  title={`${factor.label} ${factor.current}/${factor.target}`}
                >
                  {factor.label} {factor.current}/{factor.target}
                </span>
              ))}
            </div>
            <div
              className="t8-farm-story-panel__beauty-reward-route"
              data-farm-beauty-reward-route="true"
              data-farm-beauty-reward-route-target={farmBeautyRewardRouteTarget}
              data-farm-beauty-reward-route-label={farmBeautyRewardRouteLabel}
              data-farm-beauty-reward-route-reward={farmBeautyRewardRouteRewardLabel}
              data-farm-beauty-reward-route-count={farmBeautyRewardRouteCountLabel}
              data-farm-beauty-reward-route-receipt={farmBeautyRewardRouteReceipt || undefined}
              title={farmBeautyRewardRouteTitle}
              aria-label={farmBeautyRewardRouteTitle}
            >
              <span>
                <Sparkles size={10} />
                美化奖励路线
              </span>
              <b>{farmBeautyRewardRouteActionLabel}</b>
              <small data-farm-beauty-reward-route-count-text="true">{farmBeautyRewardRouteCountLabel}</small>
              <button
                type="button"
                data-farm-beauty-reward-route-hint="true"
                data-farm-beauty-reward-route-target={farmBeautyRewardRouteTarget}
                data-farm-beauty-reward-route-label={farmBeautyRewardRouteLabel}
                data-farm-beauty-reward-route-reward={farmBeautyRewardRouteRewardLabel}
                data-farm-beauty-reward-route-count={farmBeautyRewardRouteCountLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  handleFarmBeautyRewardRouteHintAction();
                }}
              >
                {farmBeautyRewardRouteReceipt || `地图找${farmBeautyRewardRouteLabel}`}
              </button>
            </div>
            <div className="t8-farm-story-panel__beauty-rewards" aria-label="漂亮度美化奖励">
              <div className="t8-farm-story-panel__beauty-rewards-head">
                <span>美化奖励</span>
                <strong>{unlockedBeautyRewardCount}/{farmBeautyRewards.length}</strong>
              </div>
              <div className="t8-farm-story-panel__beauty-reward-list">
                {farmBeautyRewards.map((reward) => (
                  <span
                    key={reward.id}
                    className={`t8-farm-story-panel__beauty-reward${reward.unlocked ? ' is-unlocked' : ''}`}
                    data-farm-beauty-reward={reward.id}
                    data-farm-beauty-reward-next={nextBeautyReward?.id === reward.id ? 'true' : undefined}
                    data-farm-beauty-reward-remaining={reward.unlocked ? undefined : reward.remainingScore}
                    title={reward.unlocked
                      ? `${reward.title} · ${reward.description}`
                      : `${reward.title} · ${reward.description} · 还差 ${reward.remainingScore} 分 · 地图找${farmBeautyRewardRouteLabel}`}
                  >
                    <b>{reward.badgeLabel}</b>
                    <em>{reward.unlocked ? '已解锁' : `${reward.threshold}分`}</em>
                    {!reward.unlocked && (
                      <small data-farm-beauty-reward-route-chip="true">差{reward.remainingScore}分</small>
                    )}
                  </span>
                ))}
              </div>
              <small className={`t8-farm-story-panel__beauty-next${nextBeautyReward ? '' : ' is-complete'}`}>
                {nextBeautyReward
                  ? `下一档：${nextBeautyReward.title}，还差 ${nextBeautyReward.remainingScore} 分。`
                  : '全部美化奖励已解锁，继续按自己的审美扩建。'}
              </small>
            </div>
          </div>
          {farmRewardBursts.length > 0 && (
            <div className="t8-farm-story-panel__reward-bursts" aria-label="牧场奖励反馈" aria-live="polite">
              {farmRewardBursts.map((burst) => {
                const BurstIcon = farmRewardBurstIcon(burst.kind);
                const rewardKindLabel = farmRewardKindLabel(burst.kind);
                return (
                  <span
                    key={burst.id}
                    className={`t8-farm-story-panel__reward-burst is-${burst.kind}`}
                    data-farm-reward-kind={burst.kind}
                    data-farm-reward-kind-label={rewardKindLabel}
                    aria-label={`${rewardKindLabel}：${burst.label}`}
                    title={`${rewardKindLabel}：${burst.label}`}
                  >
                    <BurstIcon size={10} aria-hidden="true" />
                    <small data-farm-reward-burst-kind-label="true">{rewardKindLabel}</small>
                    {burst.label}
                  </span>
                );
              })}
            </div>
          )}
          <div
            ref={farmTutorialRef}
            className="t8-farm-story-panel__tutorial"
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'guide' ? 'true' : undefined}
            tabIndex={-1}
            aria-label="新手路线"
            aria-live="polite"
          >
            <div className="t8-farm-story-panel__tutorial-head">
              <span>
                <Sprout size={13} />
                新手路线
              </span>
              <strong>{farmTutorialCompletedCount}/{farmTutorialSteps.length}</strong>
            </div>
            <div
              className="t8-farm-story-panel__tutorial-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={farmTutorialSteps.length}
              aria-valuenow={farmTutorialCompletedCount}
            >
              <i style={{ width: `${farmTutorialProgress}%` }} />
            </div>
            <ol>
              {farmTutorialSteps.map((step, index) => (
                <li
                  key={step.id}
                  className={`${step.done ? 'is-done' : ''}${farmTutorialActiveStep?.id === step.id ? ' is-active' : ''}`}
                  data-farm-tutorial-step={step.id}
                >
                  <span>{step.done ? '✓' : index + 1}</span>
                  <b>{step.label}</b>
                  <small>{step.current}/{step.target}</small>
                </li>
              ))}
            </ol>
            <p>
              {farmTutorialActiveStep
                ? farmTutorialActiveStep.hint
              : '新手路线完成，牧场进入自由经营。'}
            </p>
          </div>
          <div
            ref={farmLongGoalsRef}
            className="t8-farm-story-panel__long-goals"
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'guide' ? 'true' : undefined}
            tabIndex={-1}
            aria-label="牧场长期目标"
            aria-live="polite"
          >
            <div className="t8-farm-story-panel__long-goals-head">
              <span>
                <Package size={13} />
                牧场手账
              </span>
              <strong>{farmLongTermCompletedCount}/{farmLongTermGoals.length}</strong>
            </div>
            <ul>
              {farmLongTermGoals.map((goal) => {
                const Icon = farmLongTermGoalIcon(goal.id);
                const actionHint = farmLongGoalActionHints.get(goal.id);
                return (
                  <li
                    key={goal.id}
                    className={goal.done ? 'is-done' : ''}
                    data-farm-long-goal={goal.id}
                    data-farm-long-goal-action-label={actionHint?.label}
                    data-farm-long-goal-route-target={actionHint?.routeTarget}
                    data-farm-long-goal-route-label={actionHint?.routeLabel}
                    data-farm-long-goal-action-receipt={farmLongGoalActionReceiptId === goal.id ? 'true' : undefined}
                  >
                    <div className="t8-farm-story-panel__long-goal-row">
                      <span>
                        <Icon size={12} />
                        <b>{goal.title}</b>
                      </span>
                      <strong>{goal.current}/{goal.target}{goal.unit}</strong>
                    </div>
                    <div
                      className="t8-farm-story-panel__long-goal-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={goal.target}
                      aria-valuenow={goal.current}
                    >
                      <i style={{ width: `${goal.percent}%` }} />
                    </div>
                    <small>{goal.done ? '已贴上完成贴纸' : goal.hint}</small>
                    {actionHint && (
                      <button
                        type="button"
                        className="t8-farm-story-panel__long-goal-action"
                        data-farm-long-goal-action-kind={actionHint.action.kind}
                        data-farm-long-goal-action-route-target={actionHint.routeTarget}
                        data-farm-long-goal-action-route-label={actionHint.routeLabel}
                        data-farm-long-goal-action-active={farmLongGoalActionReceiptId === goal.id ? 'true' : undefined}
                        title={farmLongGoalActionReceiptId === goal.id ? `已接上：${actionHint.routeLabel}` : actionHint.title}
                        aria-label={farmLongGoalActionReceiptId === goal.id ? `手账路线已接上：${goal.title}，${actionHint.routeLabel}` : `${goal.title}下一步：${actionHint.label}，地图找${actionHint.routeLabel}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleFarmLongGoalAction(goal, actionHint);
                        }}
                      >
                        <Sparkles size={10} />
                        <span>{farmLongGoalActionReceiptId === goal.id ? '已接上' : actionHint.label}</span>
                        <em>{actionHint.routeLabel}</em>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div
            ref={farmToolsRef}
            className="t8-farm-story-panel__tools"
            data-farm-tools-focus={farmToolDetailOpened ? 'true' : undefined}
            data-farm-tools-pulse={farmToolDetailPulseId || undefined}
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'tools' ? 'true' : undefined}
            tabIndex={-1}
            aria-label={`牧场工具栏，当前工具：${selectedToolOption.label}`}
          >
            {farmToolDetailOpened && (
              <em
                className="t8-farm-story-panel__tools-located"
                data-farm-tools-located-feedback="true"
                aria-hidden="true"
              >
                工具栏已定位
              </em>
            )}
            {FARM_TOOLS.map((tool) => {
              const Icon = tool.icon;
              const active = selectedTool === tool.id;
              const badge = buildFarmToolBadge(tool.id, {
                farmCanvas,
                matureCount,
                selectedBuildingId,
                selectedDecorId,
                selectedResourceDecorChoice,
                selectedResourceDecor,
              });
              const unavailable = Boolean(badge?.empty);
              return (
                <button
                  key={tool.label}
                  type="button"
                  className={`${active ? 'is-active' : ''}${badge ? ' has-badge' : ''}${unavailable ? ' is-badge-empty is-unavailable' : ''}`.trim()}
                  aria-label={`牧场工具：${tool.label}${badge ? `，${badge.title}` : ''}${unavailable ? '，当前条件不足，点击查看提示' : ''}`}
                  aria-pressed={active}
                  data-farm-tool-id={tool.id}
                  data-farm-tool-badge={badge?.label}
                  data-farm-tool-badge-tone={badge?.tone}
                  data-farm-tool-badge-empty={badge?.empty ? 'true' : undefined}
                  data-farm-tool-unavailable={unavailable ? 'true' : undefined}
                  title={badge ? `${tool.label} · ${badge.title}${unavailable ? ' · 条件不足，点击查看提示' : ''}` : tool.label}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectTool?.(tool.id);
                  }}
                >
                  <span className="t8-farm-story-panel__tool-main">
                    <Icon size={14} />
                    <span>{tool.label}</span>
                  </span>
                  {badge && (
                    <em className="t8-farm-story-panel__tool-badge" data-farm-tool-badge-kind={tool.id} data-farm-tool-badge-tone={badge.tone}>
                      {badge.label}
                    </em>
                  )}
                </button>
              );
            })}
          </div>
          <div
            ref={farmPaletteRef}
            className="t8-farm-story-panel__palette"
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'build' ? 'true' : undefined}
            tabIndex={-1}
            aria-label="建造与装饰选择"
          >
            <div className="t8-farm-story-panel__palette-head">
              <Hammer size={13} />
              建造 / 装饰
            </div>
            <div className="t8-farm-story-panel__palette-group" data-farm-palette-kind="building">
              <span>建筑</span>
              <div>
                {farmBuildingOptions.map((building) => {
                  const shortage = formatFarmBuildShortage(building.cost, farmCanvas?.resources);
                  const shortageTargets = farmBuildShortageTargets(building.cost, farmCanvas?.resources);
                  const buildSize = `${building.widthCells}x${building.heightCells}`;
                  const buildCost = formatFarmBuildCost(building.cost);
                  const buildEffect = formatFarmBuildingEffectHint(building.id);
                  return (
                    <button
                      key={building.id}
                      type="button"
                      className={`${selectedBuildingId === building.id ? 'is-active' : ''}${shortage ? ' is-short' : ''}`.trim()}
                      aria-label={`选择建筑：${building.label}，${building.description}，${formatFarmBuildMeta(building, farmCanvas?.resources)}`}
                      aria-pressed={selectedBuildingId === building.id}
                      data-farm-palette-building={building.id}
                      data-farm-palette-size={buildSize}
                      data-farm-palette-shortage={shortage || undefined}
                      data-farm-palette-affordable={shortage ? 'false' : 'true'}
                      data-farm-palette-shortage-targets={shortageTargets.join(' ') || undefined}
                      title={`${building.label} · ${building.description} · ${formatFarmBuildMeta(building, farmCanvas?.resources)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectBuilding?.(building.id);
                      }}
                    >
                      <span className="t8-farm-story-panel__palette-card-head">
                        <b>{building.label}</b>
                        <small>{buildSize}</small>
                      </span>
                      <span className="t8-farm-story-panel__palette-tags" aria-hidden="true">
                        <i data-farm-palette-tag="cost">{buildCost}</i>
                        {shortageTargets.length > 0 && (
                          <i data-farm-palette-tag="shortage" data-farm-palette-shortage-chip-targets={shortageTargets.join(' ')}>
                            {`缺 ${shortageTargets.length}项`}
                          </i>
                        )}
                        <i data-farm-palette-tag="effect">{buildEffect}</i>
                      </span>
                      <em>{shortage ? `缺 ${shortage}` : building.description}</em>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="t8-farm-story-panel__palette-group" data-farm-palette-kind="decor">
              <span>装饰包</span>
              <div>
                {farmDecorOptions.map((decor) => {
                  const unlocked = isFarmDecorUnlocked(farmCanvas, decor.id);
                  const decorUnlockState = unlocked ? 'ready' : 'locked';
                  const decorCategory = formatFarmDecorCategory(decor.category);
                  const decorEffect = formatFarmDecorEffectHint(decor);
                  const decorStatus = unlocked ? decor.description : decor.unlockHint || '完成订单解锁';
                  const decorUnlockRoute = unlocked ? undefined : farmDecorUnlockRouteHint(decor, farmCanvas);
                  const decorUnlockRouteReceiptActive = farmDecorUnlockRouteReceipt === decor.id;
                  return (
                    <div
                      key={decor.id}
                      className="t8-farm-story-panel__palette-decor-card"
                      data-farm-palette-decor-card={decor.id}
                      data-farm-palette-decor-card-locked={!unlocked ? 'true' : undefined}
                    >
                      <button
                        type="button"
                        className={`${selectedDecorId === decor.id ? 'is-active' : ''}${unlocked ? '' : ' is-locked'}`.trim()}
                        aria-label={`选择装饰：${decor.label}，${unlocked ? decorCategory : '未解锁'}，${decorStatus}`}
                        aria-pressed={selectedDecorId === decor.id}
                        aria-disabled={!unlocked}
                        data-farm-palette-decor={decor.id}
                        data-farm-palette-decor-category={decor.category}
                        data-farm-palette-unlocked={unlocked ? 'true' : 'false'}
                        data-farm-palette-decor-state={decorUnlockState}
                        data-farm-palette-lock-reason={unlocked ? undefined : decorStatus}
                        data-farm-palette-unlock-route-target={decorUnlockRoute?.routeTarget}
                        title={`${decor.label} · ${unlocked ? decorCategory : '未解锁'} · ${decorStatus}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!unlocked) return;
                          onSelectDecor?.(decor.id);
                        }}
                      >
                        <span className="t8-farm-story-panel__palette-card-head">
                          <b>{decor.label}</b>
                          <small>{unlocked ? decorCategory : '未解锁'}</small>
                        </span>
                        <span className="t8-farm-story-panel__palette-tags" aria-hidden="true">
                          <i data-farm-palette-tag="shape">{decorCategory}</i>
                          <i data-farm-palette-tag={unlocked ? 'ready' : 'unlock'}>{unlocked ? '可布置' : '待解锁'}</i>
                          <i data-farm-palette-tag="effect">{decorEffect}</i>
                        </span>
                        <em>{decorStatus}</em>
                      </button>
                      {decorUnlockRoute && (
                        <button
                          type="button"
                          className="t8-farm-story-panel__palette-unlock-route"
                          data-farm-palette-unlock-route="true"
                          data-farm-palette-unlock-route-decor={decor.id}
                          data-farm-palette-unlock-route-target={decorUnlockRoute.routeTarget}
                          data-farm-palette-unlock-route-label={decorUnlockRoute.routeLabel}
                          data-farm-palette-unlock-route-source={decorUnlockRoute.sourceLabel}
                          data-farm-palette-unlock-route-receipt={decorUnlockRouteReceiptActive ? 'true' : undefined}
                          title={decorUnlockRouteReceiptActive ? `已指路：${decorUnlockRoute.routeLabel}` : decorUnlockRoute.title}
                          aria-label={decorUnlockRouteReceiptActive ? `装饰解锁已指路：${decor.label}，${decorUnlockRoute.routeLabel}` : `${decor.label}解锁路线：${decorUnlockRoute.label}，地图找${decorUnlockRoute.routeLabel}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFarmDecorUnlockRoute(decor, decorUnlockRoute);
                          }}
                        >
                          <Sparkles size={10} />
                          <span>{decorUnlockRouteReceiptActive ? '已指路' : decorUnlockRoute.label}</span>
                          <small>{decorUnlockRoute.routeLabel}</small>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="t8-farm-story-panel__resource-decor" data-farm-resource-decor>
              <div className="t8-farm-story-panel__resource-decor-head">
                <span>
                  <ImageIcon size={13} />
                  资源库装饰
                </span>
                <button
                  type="button"
                  aria-label="刷新资源库图片"
                  title="刷新资源库图片"
                  disabled={resourceDecorLoading}
                  aria-disabled={resourceDecorLoading}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRefreshResourceDecor?.();
                  }}
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="t8-farm-story-panel__resource-decor-types" aria-label="资源装饰形态">
                {FARM_RESOURCE_DECOR_CHOICES.map((choice) => {
                  const Icon = choice.icon;
                  const active = resourceDecorType === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={active ? 'is-active' : ''}
                      aria-label={`资源装饰形态：${choice.label}，${choice.hint}`}
                      aria-pressed={active}
                      title={`${choice.label} · ${choice.hint}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setResourceDecorType(choice.id);
                      }}
                    >
                      <Icon size={13} />
                      <b>{choice.label}</b>
                    </button>
                  );
                })}
              </div>
              <div className="t8-farm-story-panel__resource-decor-grid" aria-label={`资源库图片转${selectedResourceDecorChoice.label}`}>
                {visibleResourceDecorItems.map((item) => {
                  const previewUrl = item.thumbUrl || item.fileUrl;
                  const active = selectedResourceDecor?.resourceId === item.id && selectedResourceDecor.objectType === resourceDecorType;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={active ? 'is-active' : ''}
                      aria-label={`使用资源库图片：${item.title || item.id}，做成${selectedResourceDecorChoice.label}`}
                      aria-pressed={active}
                      title={`${item.title || item.id} · 做成${selectedResourceDecorChoice.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectResourceDecor?.(item.id, resourceDecorType);
                      }}
                    >
                      {previewUrl ? (
                        <img src={previewUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span>图</span>
                      )}
                      <small>{item.title || item.id}</small>
                    </button>
                  );
                })}
                {visibleResourceDecorItems.length === 0 && (
                  <div className="t8-farm-story-panel__resource-decor-empty">
                    {resourceDecorLoading ? '正在读取资源库图片...' : '资源库暂无图像，先上传图片再制作牧场装饰。'}
                  </div>
                )}
              </div>
            </div>
          </div>
          {farmBuildingEffectItems.length > 0 && (
            <div
              ref={farmBuildingEffectsRef}
              className="t8-farm-story-panel__building-effects"
              aria-label={`建筑效果，${farmBuildingEffectSummaryLabel}，${farmBuildingEffectSummaryYieldLabel}`}
              aria-live="polite"
              data-farm-building-effect-scroll-target="true"
              data-farm-building-effect-focus={farmBuildingEffectPulseId ? 'true' : undefined}
              data-farm-building-effect-pulse={farmBuildingEffectPulseId || undefined}
              data-farm-building-effect-count={farmBuildingEffectItems.length}
              data-farm-building-effect-summary={farmBuildingEffectSummaryLabel}
              data-farm-building-effect-summary-detail={farmBuildingEffectSummaryDetailLabel}
              data-farm-building-effect-summary-yields={farmBuildingEffectSummaryYieldLabel}
              data-farm-building-effect-summary-next={farmBuildingEffectSummaryNextLabel}
              data-farm-building-effect-summary-detail-tones={farmBuildingEffectSummaryDetailItems.map((item) => item.tone).join(' ')}
              data-farm-building-effect-quest-route-target={farmBuildingEffectQuestPrimary?.routeTarget || undefined}
              data-farm-building-effect-quest-route-label={farmBuildingEffectQuestPrimary?.routeLabel || undefined}
              data-farm-building-effect-quest-route-receipt={farmBuildingEffectQuestRouteReceipt || undefined}
              data-farm-panel-priority-content={farmPrioritySectionReceipt === 'building' ? 'true' : undefined}
              tabIndex={-1}
            >
              <div className="t8-farm-story-panel__building-effects-head">
                <Hammer size={13} />
                建筑效果
                <em data-farm-building-effect-summary="true">{farmBuildingEffectSummaryLabel}</em>
              </div>
              <small
                data-farm-building-effect-summary-detail="true"
                aria-label={`建筑支持收益：${farmBuildingEffectSummaryYieldLabel}`}
                title={farmBuildingEffectSummaryYieldLabel}
              >
                {farmBuildingEffectSummaryDetailItems.map((item) => (
                  <b
                    key={item.id}
                    data-farm-building-effect-summary-token={item.tone}
                    data-farm-building-effect-summary-token-yield={item.yieldLabel}
                    title={`${item.label}：${item.yieldLabel}`}
                    aria-label={`${item.label}：${item.yieldLabel}`}
                  >
                    <span>{item.label}</span>
                    <em data-farm-building-effect-summary-token-yield-text="true">{item.yieldLabel}</em>
                  </b>
                ))}
              </small>
              {farmBuildingEffectQuestPrimary && (
                <div
                  className="t8-farm-story-panel__building-effect-chain"
                  data-farm-building-effect-chain="true"
                  data-farm-building-effect-chain-route-target={farmBuildingEffectQuestPrimary.routeTarget}
                  data-farm-building-effect-chain-route-label={farmBuildingEffectQuestPrimary.routeLabel}
                  data-farm-building-effect-chain-action={farmBuildingEffectQuestPrimary.actionLabel}
                  data-farm-building-effect-chain-count={farmBuildingEffectQuestPrimary.countLabel || undefined}
                  data-farm-building-effect-chain-resource={farmBuildingEffectQuestPrimary.resourceLabel || undefined}
                  title={farmBuildingEffectQuestPrimaryTitle}
                  aria-label={farmBuildingEffectQuestPrimaryTitle}
                >
                  <span><Sparkles size={10} />建筑任务链</span>
                  <b>{farmBuildingEffectQuestPrimary.actionLabel}</b>
                  {farmBuildingEffectQuestPrimary.countLabel && (
                    <small data-farm-building-effect-chain-count="true">{farmBuildingEffectQuestPrimary.countLabel}</small>
                  )}
                  <button
                    type="button"
                    data-farm-building-effect-chain-route-hint="true"
                    data-farm-building-effect-chain-route-receipt={farmBuildingEffectQuestRouteReceipt || undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFarmBuildingEffectQuestRouteHintAction(farmBuildingEffectQuestPrimary);
                    }}
                  >
                    {farmBuildingEffectQuestRouteReceipt || `地图找${farmBuildingEffectQuestPrimary.routeLabel}`}
                  </button>
                </div>
              )}
              {farmBuildingEffectOpened && (
                <small
                  className="t8-farm-story-panel__building-effect-receipt"
                  data-farm-building-effect-receipt="true"
                  data-farm-building-effect-receipt-summary={farmBuildingEffectSummaryYieldLabel}
                  data-farm-building-effect-receipt-next={farmBuildingEffectSummaryNextLabel}
                  role="status"
                  aria-live="polite"
                  title={`建筑收益已生效：${farmBuildingEffectSummaryYieldLabel}，目标：${farmBuildingEffectSummaryNextLabel}`}
                  aria-label={`建筑收益已生效：${farmBuildingEffectSummaryYieldLabel}，目标：${farmBuildingEffectSummaryNextLabel}`}
                >
                  <Sparkles size={10} />
                  收益已生效
                  <b>{farmBuildingEffectSummaryLabel}</b>
                  {farmBuildingEffectSummaryDetailItems.map((item) => (
                    <em
                      key={item.id}
                      data-farm-building-effect-receipt-token={item.tone}
                      data-farm-building-effect-receipt-token-yield={item.yieldLabel}
                      data-farm-building-effect-receipt-token-next={item.nextTargetLabel}
                      title={`${item.label}：${item.yieldLabel}，目标：${item.nextTargetLabel}`}
                      aria-label={`${item.label}：${item.yieldLabel}，目标：${item.nextTargetLabel}`}
                    >
                      <span>{item.label}</span>
                      <b>{item.yieldLabel}</b>
                      <i
                        data-farm-building-effect-receipt-token-next="true"
                        data-farm-building-effect-receipt-token-next-tone={item.tone}
                      >{item.nextTargetLabel}</i>
                    </em>
                  ))}
                </small>
              )}
              <ul>
                {farmBuildingEffectItems.map((item) => {
                  const farmBuildingEffectQuestItem = farmBuildingEffectQuestItems.find((quest) => quest.id === item.id);
                  const farmBuildingEffectAccessibleLabel = `建筑效果：${item.label} · ${item.supportLabel} · ${item.value} · ${item.statusLabel} · ${item.actionHint} · ${item.yieldLabel} · ${item.yieldStampLabel}`;
                  return (
                    <li
                      key={item.id}
                      data-farm-building-effect={item.id}
                      data-farm-building-effect-support={item.supportTone}
                      data-farm-building-effect-support-label={item.supportLabel}
                      data-farm-building-effect-status-label={item.statusLabel}
                      data-farm-building-effect-action-hint={item.actionHint}
                      data-farm-building-effect-yield-label={item.yieldLabel}
                      data-farm-building-effect-yield-tone={item.yieldTone}
                      data-farm-building-effect-yield-stamp-label={item.yieldStampLabel}
                      data-farm-building-effect-receipt-active={farmBuildingEffectOpened ? 'true' : undefined}
                      data-farm-building-effect-chain-route-target={farmBuildingEffectQuestItem?.routeTarget || undefined}
                      data-farm-building-effect-chain-route-label={farmBuildingEffectQuestItem?.routeLabel || undefined}
                      data-farm-building-effect-chain-action={farmBuildingEffectQuestItem?.actionLabel || undefined}
                      data-farm-building-effect-chain-count={farmBuildingEffectQuestItem?.countLabel || undefined}
                      data-farm-building-effect-chain-resource={farmBuildingEffectQuestItem?.resourceLabel || undefined}
                      title={farmBuildingEffectAccessibleLabel}
                      aria-label={farmBuildingEffectAccessibleLabel}
                    >
                      <b>{item.label}</b>
                      <em data-farm-building-effect-support={item.supportTone}>{item.supportLabel}</em>
                      <span>{item.value}</span>
                      <strong data-farm-building-effect-status="true">{item.statusLabel}</strong>
                      <i data-farm-building-effect-hint="true">{item.actionHint}</i>
                      <small data-farm-building-effect-yield="true">{item.yieldLabel}</small>
                      {farmBuildingEffectQuestItem && (
                        <button
                          type="button"
                          data-farm-building-effect-row-route-hint="true"
                          data-farm-building-effect-row-route-target={farmBuildingEffectQuestItem.routeTarget}
                          data-farm-building-effect-row-route-label={farmBuildingEffectQuestItem.routeLabel}
                          title={farmBuildingEffectQuestItem.title}
                          aria-label={farmBuildingEffectQuestItem.title}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFarmBuildingEffectQuestRouteHintAction(farmBuildingEffectQuestItem);
                          }}
                        >
                          图{farmBuildingEffectQuestItem.routeLabel}
                        </button>
                      )}
                      <mark data-farm-building-effect-yield-stamp="true">{item.yieldStampLabel}</mark>
                      {farmBuildingEffectOpened && (
                        <mark
                          data-farm-building-effect-row-receipt="true"
                          data-farm-building-effect-row-receipt-tone={item.supportTone}
                          title={`${item.label}收益已入账：${item.yieldLabel}，下一步：${item.actionHint}，目标：${item.nextTargetLabel}`}
                          aria-label={`${item.label}收益已入账：${item.yieldLabel}，下一步：${item.actionHint}，目标：${item.nextTargetLabel}`}
                        >
                          <span>已入账</span>
                          <b data-farm-building-effect-row-receipt-yield="true">{item.yieldLabel}</b>
                          <i data-farm-building-effect-row-receipt-hint="true">{item.actionHint}</i>
                          <em
                            data-farm-building-effect-row-receipt-next="true"
                            data-farm-building-effect-row-receipt-next-tone={item.supportTone}
                          >{item.nextTargetLabel}</em>
                        </mark>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {visibleFarmAnimals.length > 0 && (
            <div
              ref={farmAnimalsRef}
              className="t8-farm-story-panel__animals"
              data-farm-animal-product-scroll-target="true"
              data-farm-animal-product-focus={farmAnimalProductPulseId ? 'true' : undefined}
              data-farm-animal-product-pulse={farmAnimalProductPulseId || undefined}
              data-farm-animal-mood-summary={farmAnimalMoodSummaryLabel || undefined}
              data-farm-animal-mood-tone={farmAnimalMoodTone || undefined}
              data-farm-animal-product-ready={totalAnimalProducts > 0 ? 'true' : undefined}
              data-farm-animal-next-products={farmAnimalNextProductSummary || undefined}
              data-farm-animal-next-products-count={farmAnimalNextProductCount || undefined}
              data-farm-animal-next-products-actionable={farmAnimalNextProductCount > 0 ? 'true' : undefined}
              data-farm-animal-product-receipt={farmAnimalProductReceiptSummary || undefined}
              data-farm-animal-product-receipt-count={farmAnimalProductReceiptCount || undefined}
              data-farm-panel-priority-content={farmPrioritySectionReceipt === 'animals' ? 'true' : undefined}
              tabIndex={-1}
              aria-label={`动物小屋，心情：${farmAnimalMoodSummaryLabel || '暂无'}，产物：${animalProductSummary}，明早：${farmAnimalNextProductSummary || '暂无'}`}
              aria-live="polite"
            >
              <div
                className="t8-farm-story-panel__animals-head"
                data-farm-animal-mood-tone={farmAnimalMoodTone || undefined}
                data-farm-animal-product-ready={totalAnimalProducts > 0 ? 'true' : undefined}
                data-farm-animal-next-products={farmAnimalNextProductSummary || undefined}
                data-farm-animal-next-products-actionable={farmAnimalNextProductCount > 0 ? 'true' : undefined}
                data-farm-animal-product-receipt={farmAnimalProductReceiptSummary || undefined}
              >
                <span>
                  <PawPrint size={13} />
                  动物小屋
                </span>
                <strong>{animalProductSummary}</strong>
                {farmAnimalMoodHintLabel && (
                  <em data-farm-animal-mood-hint="true">{farmAnimalMoodHintLabel}</em>
                )}
                {farmAnimalNextProductSummary && (
                  <i data-farm-animal-next-products="true">明早 {farmAnimalNextProductSummary}</i>
                )}
                {farmAnimalNextProductCount > 0 && (
                  <button
                    type="button"
                    data-farm-animal-next-products-action="true"
                    data-farm-animal-next-products-action-count={farmAnimalNextProductCount}
                    data-farm-animal-next-products-action-summary={farmAnimalNextProductSummary}
                    title={`推进到下一天，收取预计产出 ${farmAnimalNextProductSummary}`}
                    aria-label={`推进到下一天并收取动物预计产出，${farmAnimalNextProductSummary}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAdvanceDay?.();
                    }}
                  >
                    <CalendarDays size={10} />
                    <span>过天收取</span>
                    <em>明{farmAnimalNextProductCount}</em>
                  </button>
                )}
                {farmAnimalProductReceiptSummary && (
                  <small
                    data-farm-animal-product-receipt="true"
                    data-farm-animal-product-receipt-count={farmAnimalProductReceiptCount}
                    data-farm-animal-product-located={farmAnimalProductOpened ? 'true' : undefined}
                    role="status"
                    aria-live="polite"
                    title={`刚收取动物产出：${farmAnimalProductReceiptSummary}`}
                    aria-label={`刚收取动物产出，${farmAnimalProductReceiptSummary}`}
                  >
                    <Sparkles size={10} />
                    <span>刚收取</span>
                    {farmAnimalProductOpened && (
                      <em data-farm-animal-product-located-badge="true">已定位</em>
                    )}
                    <b>{farmAnimalProductReceiptSummary}</b>
                  </small>
                )}
              </div>
              <ul>
                {visibleFarmAnimals.map((animal) => {
                  const definition = FARM_ANIMAL_DEFINITIONS[animal.kind];
                  const animalNextProductReady = animal.placedDay <= farmAnimalProductionDay && animal.lastProducedDay !== farmAnimalProductionDay;
                  const animalProducedToday = animal.lastProducedDay === farmAnimalProductionDay && animal.productCount > 0;
                  return (
                    <li
                      key={animal.id}
                      data-farm-animal-kind={animal.kind}
                      data-farm-animal-mood={animal.mood}
                      data-farm-animal-product-ready={animal.productCount > 0 ? 'true' : undefined}
                      data-farm-animal-next-product-ready={animalNextProductReady ? 'true' : undefined}
                      data-farm-animal-produced-today={animalProducedToday ? 'true' : undefined}
                      title={`${definition.label} ${animal.name}：${farmAnimalMoodLabel(animal.mood)}，${definition.productLabel} x${animal.productCount}，今日${animalProducedToday ? ` +${definition.dailyAmount}` : ' 未新增'}，明早${animalNextProductReady ? ` +${definition.dailyAmount}` : ' 待休息'}`}
                      aria-label={`${definition.label} ${animal.name}：${farmAnimalMoodLabel(animal.mood)}，${definition.productLabel} x${animal.productCount}，今日${animalProducedToday ? ` +${definition.dailyAmount}` : ' 未新增'}，明早${animalNextProductReady ? ` +${definition.dailyAmount}` : ' 待休息'}`}
                    >
                      <span>{definition.label}</span>
                      <b>{animal.name}</b>
                      <small>
                        <em data-farm-animal-mood-chip="true">{farmAnimalMoodLabel(animal.mood)}</em>
                        <mark data-farm-animal-product-chip="true">{definition.productLabel} x{animal.productCount}</mark>
                        {animalProducedToday && (
                          <i data-farm-animal-today-product-chip="true">今日 +{definition.dailyAmount}</i>
                        )}
                        {animalNextProductReady && (
                          <i data-farm-animal-next-product-chip="true">明早 +{definition.dailyAmount}</i>
                        )}
                      </small>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {activeNpcVisit && (
            <div
              ref={farmNpcVisitRef}
              className={`t8-farm-story-panel__npc${npcVisitReady ? ' is-ready' : ''}${activeNpcVisit.completed ? ' is-complete' : ''}`}
              data-farm-npc-visitor={activeNpcVisit.visitorId}
              data-farm-npc-delivery-active={farmNpcDeliveryActive ? 'true' : undefined}
              data-farm-npc-delivery-reward={farmNpcDeliveryActive ? farmNpcDeliveryReceiptRewardLabel || undefined : undefined}
              data-farm-npc-bond-level={farmNpcBond?.levelLabel || undefined}
              data-farm-npc-bond-progress={farmNpcBond?.progressLabel || undefined}
              data-farm-npc-bond-next-reward={farmNpcBond?.nextRewardLabel || undefined}
              data-farm-npc-bond-after-delivery={farmNpcDeliveryActive && farmNpcBond ? farmNpcBond.afterDeliveryLabel : undefined}
              data-farm-npc-bond-milestone={farmNpcBondMilestone?.targetLabel || undefined}
              data-farm-npc-bond-milestone-reward={farmNpcBondMilestone?.rewardLabel || undefined}
              data-farm-npc-return-promise={farmNpcReturnPromise?.promiseLabel || undefined}
              data-farm-npc-return-promise-tone={farmNpcReturnPromise?.tone || undefined}
              data-farm-npc-return-promise-next={farmNpcReturnPromise?.nextVisitLabel || undefined}
              data-farm-npc-prep-status={farmNpcPrepHint?.statusLabel || undefined}
              data-farm-npc-prep-action={farmNpcPrepHint?.action || undefined}
              data-farm-npc-prep-tone={farmNpcPrepHint?.tone || undefined}
              data-farm-npc-delivery-next={farmNpcDeliveryActive ? farmNpcDeliveryReceiptNextLabel || undefined : undefined}
              data-farm-npc-delivery-route-target={farmNpcDeliveryActive ? farmNpcDeliveryReceiptRouteTarget || undefined : undefined}
              data-farm-npc-delivery-route-label={farmNpcDeliveryActive ? farmNpcDeliveryReceiptRouteLabel || undefined : undefined}
              data-farm-npc-focus={farmNpcVisitOpened ? 'true' : undefined}
              data-farm-npc-pulse={farmNpcVisitPulseId || undefined}
              data-farm-panel-priority-content={farmPrioritySectionReceipt === 'visits' ? 'true' : undefined}
              tabIndex={-1}
              aria-label={`村民来访委托：${activeNpcVisit.visitorName}，${activeNpcVisit.title}${farmNpcDeliveryReceiptTitle ? `，${farmNpcDeliveryReceiptTitle}` : ''}`}
              aria-live="polite"
            >
              <div className="t8-farm-story-panel__npc-head">
                <span>
                  <UserRound size={13} />
                  村民来访
                </span>
                <strong>{activeNpcVisit.visitorName}</strong>
              </div>
              <b>{activeNpcVisit.title}</b>
              <p>{activeNpcVisit.completed ? '今日委托已完成，村里的好感正在发芽。' : activeNpcVisit.message}</p>
              <div className="t8-farm-story-panel__npc-meta">
                <span>{formatFarmNpcRequirement(activeNpcVisit, farmCanvas)}</span>
                <small data-farm-npc-reward={formatFarmReward(activeNpcVisit.rewards)}>
                  奖励：{formatFarmReward(activeNpcVisit.rewards)}
                </small>
                {farmNpcDeliveryActive && (
                  <em data-farm-npc-delivery-feedback="true">交付中</em>
                )}
                {farmNpcVisitOpened && !farmNpcDeliveryActive && (
                  <em data-farm-npc-located-feedback="true">已定位</em>
                )}
              </div>
              {farmNpcPrepHint && (
                <div
                  className="t8-farm-story-panel__npc-prep-hint"
                  data-farm-npc-prep-hint="true"
                  data-farm-npc-prep-tone={farmNpcPrepHint.tone}
                  data-farm-npc-prep-action={farmNpcPrepHint.action}
                  title={farmNpcPrepHint.title}
                  aria-label={farmNpcPrepHint.title}
                >
                  <span>
                    <Package size={10} />
                    备货提示
                    <b>{farmNpcPrepHint.statusLabel}</b>
                  </span>
                  <small data-farm-npc-prep-story="true">{farmNpcPrepHint.storyLabel}</small>
                  <button
                    type="button"
                    data-farm-npc-prep-action-button="true"
                    data-farm-npc-prep-action={farmNpcPrepHint.action}
                    title={`${farmNpcPrepHint.actionLabel}：${farmNpcPrepHint.statusLabel}`}
                    aria-label={`${farmNpcPrepHint.actionLabel}，${farmNpcPrepHint.statusLabel}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFarmNpcPrepHintAction();
                    }}
                  >
                    <Sparkles size={10} />
                    {farmNpcPrepHint.actionLabel}
                  </button>
                </div>
              )}
              {farmNpcBond && (
                <div
                  className="t8-farm-story-panel__npc-bond"
                  data-farm-npc-bond="true"
                  data-farm-npc-bond-ready={npcVisitReady ? 'true' : undefined}
                  data-farm-npc-bond-level={farmNpcBond.levelLabel}
                  data-farm-npc-bond-progress={farmNpcBond.progressLabel}
                  data-farm-npc-bond-next-reward={farmNpcBond.nextRewardLabel}
                  title={farmNpcBond.title}
                  aria-label={farmNpcBond.title}
                >
                  <span>
                    <UserRound size={10} />
                    熟络
                    <b>{farmNpcBond.levelLabel}</b>
                  </span>
                  <div
                    className="t8-farm-story-panel__npc-bond-meter"
                    data-farm-npc-bond-meter="true"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={farmNpcBond.percent}
                  >
                    <span style={{ '--farm-npc-bond-progress': `${farmNpcBond.percent}%` } as CSSProperties} />
                  </div>
                  <small>
                    <em>{farmNpcBond.progressLabel}</em>
                    <i data-farm-npc-bond-next-reward="true">下一档 {farmNpcBond.nextRewardLabel}</i>
                    {farmNpcDeliveryActive && farmNpcBond.afterDeliveryLabel && (
                      <mark data-farm-npc-bond-after-delivery="true">{farmNpcBond.afterDeliveryLabel}</mark>
                    )}
                  </small>
                </div>
              )}
              {farmNpcBondMilestone && (
                <div
                  className="t8-farm-story-panel__npc-bond-milestone"
                  data-farm-npc-bond-milestone="true"
                  data-farm-npc-bond-milestone-target={farmNpcBondMilestone.targetLabel}
                  data-farm-npc-bond-milestone-reward={farmNpcBondMilestone.rewardLabel}
                  title={farmNpcBondMilestone.title}
                  aria-label={farmNpcBondMilestone.title}
                >
                  <span>
                    <Sparkles size={10} />
                    熟络礼物
                    <b>{farmNpcBondMilestone.rewardLabel}</b>
                  </span>
                  <small data-farm-npc-bond-milestone-story="true">{farmNpcBondMilestone.storyLabel}</small>
                  <em data-farm-npc-bond-milestone-target="true">{farmNpcBondMilestone.targetLabel}</em>
                </div>
              )}
              {farmNpcReturnPromise && (
                <div
                  className="t8-farm-story-panel__npc-return-promise"
                  data-farm-npc-return-promise="true"
                  data-farm-npc-return-promise-tone={farmNpcReturnPromise.tone}
                  data-farm-npc-return-promise-next={farmNpcReturnPromise.nextVisitLabel}
                  title={farmNpcReturnPromise.title}
                  aria-label={farmNpcReturnPromise.title}
                >
                  <span>
                    <CalendarDays size={10} />
                    下次来访
                    <b>{farmNpcReturnPromise.promiseLabel}</b>
                  </span>
                  <small data-farm-npc-return-promise-story="true">{farmNpcReturnPromise.storyLabel}</small>
                  <em data-farm-npc-return-promise-completed="true">{farmNpcReturnPromise.completedLabel}</em>
                </div>
              )}
              {farmNpcDeliveryActive && (
                <div
                  className="t8-farm-story-panel__npc-delivery-receipt"
                  data-farm-npc-delivery-receipt="true"
                  data-farm-npc-delivery-receipt-reward={farmNpcDeliveryReceiptRewardLabel || undefined}
                  data-farm-npc-delivery-receipt-next={farmNpcDeliveryReceiptNextLabel || undefined}
                  data-farm-npc-delivery-receipt-count={farmNpcDeliveryReceiptNextCountLabel || undefined}
                  data-farm-npc-delivery-receipt-route-target={farmNpcDeliveryReceiptRouteTarget || undefined}
                  data-farm-npc-delivery-receipt-route-label={farmNpcDeliveryReceiptRouteLabel || undefined}
                  title={farmNpcDeliveryReceiptTitle || undefined}
                  aria-label={farmNpcDeliveryReceiptTitle || undefined}
                >
                  <span>
                    <Sparkles size={11} />
                    谢礼入袋
                  </span>
                  {farmNpcDeliveryReceiptRewardLabel && (
                    <b>{farmNpcDeliveryReceiptRewardLabel}</b>
                  )}
                  {(farmNpcDeliveryReceiptNextLabel || farmNpcDeliveryReceiptNextCountLabel) && (
                    <small>
                      {farmNpcDeliveryReceiptNextLabel && (
                        <em data-farm-npc-delivery-receipt-next="true">下一步 {farmNpcDeliveryReceiptNextLabel}</em>
                      )}
                      {farmNpcDeliveryReceiptNextCountLabel && (
                        <i data-farm-npc-delivery-receipt-count="true">目标 {farmNpcDeliveryReceiptNextCountLabel}</i>
                      )}
                    </small>
                  )}
                  {farmNpcDeliveryReceiptRouteLabel && (
                    <button
                      type="button"
                      data-farm-npc-delivery-receipt-route-hint="true"
                      data-farm-npc-delivery-receipt-route-target={farmNpcDeliveryReceiptRouteTarget}
                      data-farm-npc-delivery-receipt-route-label={farmNpcDeliveryReceiptRouteLabel}
                      title={farmNpcDeliveryReceiptRouteTitle || `地图找${farmNpcDeliveryReceiptRouteLabel}`}
                      aria-label={farmNpcDeliveryReceiptRouteTitle || `地图找${farmNpcDeliveryReceiptRouteLabel}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFarmNpcDeliveryReceiptRouteHint();
                      }}
                    >
                      <Sparkles size={10} />
                      地图找{farmNpcDeliveryReceiptRouteLabel}
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                disabled={!npcVisitReady || farmNpcDeliveryActive}
                aria-disabled={!npcVisitReady || farmNpcDeliveryActive}
                data-farm-npc-delivery-active={farmNpcDeliveryActive ? 'true' : undefined}
                title={farmNpcDeliveryActive ? '来访委托交付中' : activeNpcVisit.completed ? '今日来访委托已完成' : npcVisitReady ? '交付村民来访委托' : '来访委托材料不足'}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!farmNpcDeliveryActive) {
                    flashFarmNpcDelivery(activeNpcVisit.id);
                    onCompleteNpcVisit?.(activeNpcVisit.id);
                  }
                }}
              >
                {farmNpcDeliveryActive ? '交付中' : activeNpcVisit.completed ? '已完成' : npcVisitReady ? '交付委托' : '材料不足'}
              </button>
            </div>
          )}
          {activeFestivalTask && (
            <div
              className={`t8-farm-story-panel__festival-task${activeFestivalTask.completed ? ' is-complete' : ''}`}
              data-farm-festival-task-ready-via-order={festivalTaskReadyViaOrder ? 'true' : undefined}
              data-farm-festival-task-next-progress={activeFestivalTask ? festivalTaskNextProgress : undefined}
              data-farm-festival-task-next-percent={activeFestivalTask ? festivalTaskNextPercent : undefined}
              data-farm-festival-task-completes-via-order={festivalTaskCompletesViaOrder ? 'true' : undefined}
              aria-label={`节庆委托：${activeFestivalTask.title}，${festivalTaskProgress}/${activeFestivalTask.target}${festivalTaskForecastLabel ? `，${festivalTaskForecastLabel}` : ''}${festivalTaskCompletionLabel ? `，${festivalTaskCompletionLabel}节庆委托` : ''}${festivalTaskRewardLabel ? `，奖励 ${festivalTaskRewardLabel}` : ''}`}
              aria-live="polite"
              title={festivalTaskForecastLabel ? `${festivalTaskForecastLabel}${festivalTaskCompletionLabel ? ` · ${festivalTaskCompletionLabel}` : ''} · 奖励：${festivalTaskRewardLabel}` : undefined}
            >
              <div className="t8-farm-story-panel__festival-task-head">
                <span>
                  <Flag size={13} />
                  节庆委托
                </span>
                {festivalTaskCompletionLabel && (
                  <em data-farm-festival-task-completion-badge="true">{festivalTaskCompletionLabel}</em>
                )}
                <strong>{festivalTaskProgress}/{activeFestivalTask.target}</strong>
              </div>
              <b>{activeFestivalTask.title}</b>
              <p>{activeFestivalTask.completed ? '已完成，村里的谢礼已经入袋。' : activeFestivalTask.description}</p>
              <div
                className="t8-farm-story-panel__festival-task-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={activeFestivalTask.target}
                aria-valuenow={festivalTaskProgress}
                aria-valuetext={festivalTaskForecastLabel || `${festivalTaskProgress}/${activeFestivalTask.target}`}
              >
                {festivalTaskReadyViaOrder && (
                  <em data-farm-festival-task-progress-forecast="true" style={{ width: `${festivalTaskNextPercent}%` }} />
                )}
                <i data-farm-festival-task-progress-current="true" style={{ width: `${festivalTaskPercent}%` }} />
              </div>
              {festivalTaskReadyViaOrder && (
                <div
                      className="t8-farm-story-panel__festival-task-forecast"
                      data-farm-festival-task-forecast="order"
                      data-farm-festival-task-forecast-tone={festivalTaskForecastTone || undefined}
                      data-farm-festival-task-reward={festivalTaskRewardLabel || undefined}
                      role="status"
                  aria-live="polite"
                  title={`${festivalTaskForecastLabel} · 奖励：${festivalTaskRewardLabel}`}
                >
                  <Package size={12} aria-hidden="true" />
                  <span>{festivalTaskForecastLabel}</span>
                  <strong>{festivalTaskRewardLabel}</strong>
                </div>
              )}
              <small>奖励：{festivalTaskRewardLabel}</small>
            </div>
          )}
          <div
            ref={farmOrderRef}
            className={`t8-farm-story-panel__quest${orderReady ? ' is-ready' : ''}${currentOrder?.completed ? ' is-complete' : ''}`}
            data-farm-order-focus={farmOrderLocateOpened ? 'true' : undefined}
            data-farm-order-pulse={farmOrderLocatePulseId || undefined}
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'visits' ? 'true' : undefined}
            tabIndex={-1}
            aria-label={`牧场订单：${currentOrder?.title || '新手订单'}`}
            aria-live="polite"
          >
            <div className="t8-farm-story-panel__quest-title">
              <Wheat size={14} />
              {currentOrder?.title || '新手订单'}
            </div>
            <ol>
              {currentOrder
                ? currentOrder.requirements.map((requirement, index) => {
                    const crop = FARM_CROP_DEFINITIONS[requirement.cropId];
                    const owned = farmCanvas?.inventory.crops[requirement.cropId] || 0;
                    return (
                      <li key={`${currentOrder.id}-${requirement.cropId}`} className={owned >= requirement.amount ? 'is-done' : 'is-current'}>
                        <span>{index + 1}</span>
                        {crop?.label || requirement.cropId} {owned}/{requirement.amount}
                      </li>
                    );
                  })
                : FARM_STEPS.map((step, index) => (
                    <li key={step} className={index === 0 ? 'is-current' : ''}>
                      <span>{index + 1}</span>
                      {step}
                    </li>
                  ))}
            </ol>
            {currentOrder && (
              <div
                className="t8-farm-story-panel__quest-reward"
                data-farm-order-reward={currentOrderRewardLabel || undefined}
                data-farm-order-festival-link={currentOrderFestivalLinkLabel || undefined}
                data-farm-order-festival-completes={currentOrderFestivalCompletes ? 'true' : undefined}
                data-farm-order-festival-reward={currentOrderFestivalRewardLabel || undefined}
                data-farm-order-stamp-active={farmOrderStampActive ? 'true' : undefined}
                data-farm-order-stamp-feedback-label={farmOrderStampFeedbackLabel || undefined}
                data-farm-order-located={farmOrderLocateOpened ? 'true' : undefined}
                role={farmOrderStampActive ? 'status' : undefined}
                aria-live="polite"
                aria-label={farmOrderRewardTitle}
                title={farmOrderRewardTitle}
              >
                <Package size={12} aria-hidden="true" />
                <span>{orderReady ? '可盖章奖励' : '订单奖励'}</span>
                <strong>{currentOrderRewardLabel}</strong>
                {currentOrderFestivalRewardLabel && (
                  <i data-farm-order-festival-reward="true">节庆奖励 {currentOrderFestivalRewardLabel}</i>
                )}
                {currentOrderFestivalLinkLabel && (
                  <em data-farm-order-festival-link="true">{currentOrderFestivalLinkLabel}</em>
                )}
                {farmOrderStampActive && (
                  <em data-farm-order-stamp-feedback="true" data-farm-order-stamp-festival-reward={currentOrderFestivalRewardLabel || undefined}>{farmOrderStampFeedbackLabel}</em>
                )}
                {farmOrderLocateOpened && !farmOrderStampActive && (
                  <em data-farm-order-located-feedback="true">已定位</em>
                )}
              </div>
            )}
            {farmOrderRewardPocketReceipt && (
              <div
                className="t8-farm-story-panel__order-reward-pocket"
                data-farm-order-reward-pocket="true"
                data-farm-order-reward-pocket-order={farmOrderRewardPocketReceipt.orderId}
                data-farm-order-reward-pocket-route-target={farmOrderRewardPocketReceipt.routeTarget || undefined}
                data-farm-order-reward-pocket-route-label={farmOrderRewardPocketReceipt.routeLabel || undefined}
                data-farm-order-reward-pocket-route-receipt={farmOrderRewardRouteReceipt === farmOrderRewardPocketReceipt.routeLabel ? 'true' : undefined}
                title={farmOrderRewardPocketReceipt.title || undefined}
                aria-label={farmOrderRewardPocketReceipt.title || undefined}
                role="status"
                aria-live="polite"
              >
                <span>
                  <Sparkles size={11} aria-hidden="true" />
                  奖励入袋
                </span>
                <b>{farmOrderRewardPocketReceipt.rewardLabel}</b>
                {farmOrderRewardPocketReceipt.festivalRewardLabel && (
                  <i data-farm-order-reward-pocket-festival="true">节庆 {farmOrderRewardPocketReceipt.festivalRewardLabel}</i>
                )}
                {(farmOrderRewardPocketReceipt.nextLabel || farmOrderRewardPocketReceipt.nextCountLabel) && (
                  <small>
                    {farmOrderRewardPocketReceipt.nextLabel && (
                      <em data-farm-order-reward-pocket-next="true">下一步 {farmOrderRewardPocketReceipt.nextLabel}</em>
                    )}
                    {farmOrderRewardPocketReceipt.nextCountLabel && (
                      <i data-farm-order-reward-pocket-count="true">目标 {farmOrderRewardPocketReceipt.nextCountLabel}</i>
                    )}
                  </small>
                )}
                {farmOrderRewardPocketReceipt.routeLabel && farmOrderRewardPocketReceipt.routeTarget && (
                  <button
                    type="button"
                    data-farm-order-reward-pocket-route-hint="true"
                    data-farm-order-reward-pocket-route-target={farmOrderRewardPocketReceipt.routeTarget}
                    data-farm-order-reward-pocket-route-label={farmOrderRewardPocketReceipt.routeLabel}
                    title={farmOrderRewardPocketReceipt.routeTitle || `地图找${farmOrderRewardPocketReceipt.routeLabel}`}
                    aria-label={farmOrderRewardPocketReceipt.routeTitle || `地图找${farmOrderRewardPocketReceipt.routeLabel}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFarmOrderRewardPocketRouteHint();
                    }}
                  >
                    {farmOrderRewardRouteReceipt === farmOrderRewardPocketReceipt.routeLabel ? '已指路' : <>地图找{farmOrderRewardPocketReceipt.routeLabel}</>}
                  </button>
                )}
                {farmOrderRewardPocketReceipt.action && farmOrderRewardPocketReceipt.nextActionLabel && (
                  <button
                    type="button"
                    data-farm-order-reward-pocket-next-action="true"
                    data-farm-order-reward-pocket-next-action-kind={farmOrderRewardPocketReceipt.action.kind}
                    data-farm-order-reward-pocket-next-action-target={farmOrderRewardPocketReceipt.routeTarget || undefined}
                    data-farm-order-reward-pocket-next-action-receipt={farmOrderRewardNextActionReceipt ? 'true' : undefined}
                    title={farmOrderRewardPocketReceipt.nextActionTitle || `接下一步：${farmOrderRewardPocketReceipt.nextActionLabel}`}
                    aria-label={farmOrderRewardPocketReceipt.nextActionTitle || `接下一步：${farmOrderRewardPocketReceipt.nextActionLabel}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFarmOrderRewardPocketNextAction();
                    }}
                  >
                    {farmOrderRewardNextActionReceipt ? '已接上' : farmOrderRewardPocketReceipt.nextActionLabel}
                  </button>
                )}
              </div>
            )}
            <p className="t8-farm-story-panel__feedback">{feedback || '点击工具后，在画布空白处开始经营。'}</p>
          </div>
          {showDailySummary && dailySummary && (
            <div
              ref={farmSummaryRef}
              className="t8-farm-story-panel__summary"
              data-farm-summary-id={dailySummary.id}
              data-farm-summary-focus={farmSummaryOpened ? 'true' : undefined}
              data-farm-summary-pulse={farmSummaryPulseId || undefined}
              data-farm-panel-priority-content={farmPrioritySectionReceipt === 'summary' ? 'true' : undefined}
              tabIndex={-1}
              aria-label={`每日总结：D${dailySummary.fromDay} 到 D${dailySummary.toDay}，${dailySummary.message}`}
              aria-live="polite"
              role="status"
            >
              <div className="t8-farm-story-panel__summary-head">
                <span>
                  <CalendarDays size={13} />
                  D{dailySummary.fromDay} {'->'} D{dailySummary.toDay}
                </span>
                <em>{farmWeatherLabel(dailySummary.weather)}</em>
                {farmSummaryOpened && (
                  <small
                    className="t8-farm-story-panel__summary-located"
                    data-farm-summary-located-feedback="true"
                    aria-hidden="true"
                  >
                    已定位总结
                  </small>
                )}
                <button
                  type="button"
                  aria-label="关闭每日总结"
                  title="关闭每日总结"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDismissedSummaryId(dailySummary.id);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
              <strong>{dailySummary.message}</strong>
              <div className="t8-farm-story-panel__summary-metrics">
                <span>收获 {dailySummary.harvestedCrops}</span>
                <span>成熟 {dailySummary.matureCrops}</span>
                <span>订单 {dailySummary.ordersCompleted}</span>
                {dailySummary.nextMatureCrops > 0 && <span>明日 {dailySummary.nextMatureCrops}</span>}
                {dailySummary.dryCrops > 0 && <span>缺水 {dailySummary.dryCrops}</span>}
                {dailySummary.witheredCrops > 0 && <span>枯萎 {dailySummary.witheredCrops}</span>}
                {dailySummary.readyOrders > 0 && <span>可交付 {dailySummary.readyOrders}</span>}
                {dailySummary.readyNpcVisits > 0 && <span>来访待交 {dailySummary.readyNpcVisits}</span>}
                {dailySummary.dailyWaterCapacity > 0 && <span>水井 {dailySummary.dailyWaterCapacity}</span>}
                {dailySummary.scarecrowProtectedCrops > 0 && <span data-farm-summary-metric="scarecrow-protected">守护 {dailySummary.scarecrowProtectedCrops}</span>}
                {dailySummary.rainWateredCrops > 0 && <span>雨水 {dailySummary.rainWateredCrops}</span>}
                {dailySummary.festivalBonusGold > 0 && <span>节庆 +{dailySummary.festivalBonusGold}</span>}
                {dailySummary.animalProductsProduced > 0 && <span>动物 {dailySummary.animalProductsProduced}</span>}
                {dailySummary.npcVisitsCompleted > 0 && <span>来访 {dailySummary.npcVisitsCompleted}</span>}
                {dailySummary.rareEventsFound > 0 && <span><Sparkles size={10} /> 惊喜 {dailySummary.rareEventsFound}</span>}
              </div>
              {farmDailyRouteWrapupReceipt && (
                <>
                  <div
                    className="t8-farm-story-panel__daily-route-wrapup-receipt"
                    data-farm-daily-route-wrapup-receipt="true"
                    data-farm-daily-route-wrapup-receipt-id={farmDailyRouteWrapupReceipt.id}
                    data-farm-daily-route-wrapup-receipt-summary={farmDailyRouteWrapupReceipt.summaryLabel}
                    data-farm-daily-route-wrapup-receipt-next-day={`D${farmDailyRouteWrapupReceipt.fromDay}->D${farmDailyRouteWrapupReceipt.toDay}`}
                    data-farm-daily-route-wrapup-receipt-morning-count={farmMorningBriefItems.length}
                    data-farm-daily-route-wrapup-receipt-route-count={farmTomorrowRouteSteps.length}
                    role="status"
                    aria-live="polite"
                    title={farmDailyRouteWrapupReceiptTitle}
                    aria-label={farmDailyRouteWrapupReceiptTitle}
                  >
                    <Sparkles size={13} />
                    <span>
                      <b>收尾已完成</b>
                      <small>{farmDailyRouteWrapupReceipt.summaryLabel}</small>
                    </span>
                    <em>
                      {farmMorningBriefItems.length > 0
                        ? `晨报 ${farmMorningBriefItems.length}`
                        : farmTomorrowRouteSteps.length > 0
                          ? `路线 ${farmTomorrowRouteSteps.length}`
                          : `D${farmDailyRouteWrapupReceipt.toDay}`}
                    </em>
                  </div>
                  {farmDailyRouteWrapupNextStep && (
                    <button
                      type="button"
                      className="t8-farm-story-panel__daily-route-wrapup-next"
                      data-farm-daily-route-wrapup-next="true"
                      data-farm-daily-route-wrapup-next-step={farmDailyRouteWrapupNextStep.id}
                      data-farm-daily-route-wrapup-next-stage={farmDailyRouteWrapupNextStep.stageLabel}
                      data-farm-daily-route-wrapup-next-target={farmDailyRouteWrapupNextStep.routeTarget || undefined}
                      data-farm-daily-route-wrapup-next-label={farmDailyRouteWrapupNextStep.routeLabel}
                      data-farm-daily-route-wrapup-next-receipt={farmTomorrowRouteReceipt === farmDailyRouteWrapupNextStep.id ? 'true' : undefined}
                      title={farmDailyRouteWrapupNextTitle}
                      aria-label={farmDailyRouteWrapupNextTitle}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFarmTomorrowRouteStepAction(farmDailyRouteWrapupNextStep);
                      }}
                    >
                      <Sprout size={12} />
                      <span>
                        <b>接明日开局</b>
                        <small>{farmDailyRouteWrapupNextStep.stageLabel} · {farmDailyRouteWrapupNextStep.title}</small>
                      </span>
                      <em>
                        {farmTomorrowRouteReceipt === farmDailyRouteWrapupNextStep.id
                          ? '已接上'
                          : farmDailyRouteWrapupNextStep.countLabel || farmDailyRouteWrapupNextStep.routeLabel}
                      </em>
                    </button>
                  )}
                </>
              )}
              {farmMorningKickstartItem && (
                <button
                  type="button"
                  className="t8-farm-story-panel__morning-kickstart"
                  data-farm-summary-morning-kickstart="true"
                  data-farm-summary-morning-kickstart-item={farmMorningKickstartItem.id}
                  data-farm-summary-morning-kickstart-tone={farmMorningKickstartItem.tone}
                  data-farm-summary-morning-kickstart-route-target={farmMorningKickstartItem.routeTarget || undefined}
                  data-farm-summary-morning-kickstart-route-label={farmMorningKickstartItem.routeLabel || undefined}
                  data-farm-summary-morning-kickstart-receipt={farmMorningBriefReceipt === farmMorningKickstartItem.id ? 'true' : undefined}
                  title={`晨间开局推荐：${farmMorningKickstartSummary}`}
                  aria-label={`晨间开局推荐：${farmMorningKickstartSummary}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmMorningBriefAction(farmMorningKickstartItem);
                  }}
                >
                  <FarmMorningKickstartIcon size={14} />
                  <span>
                    <small>推荐先做</small>
                    <b>{farmMorningKickstartItem.label}</b>
                    <em>{farmMorningKickstartItem.detail}</em>
                  </span>
                  <strong>
                    {farmMorningBriefReceipt === farmMorningKickstartItem.id
                      ? '已接上'
                      : farmMorningKickstartItem.rewardLabel || farmMorningKickstartItem.countLabel || '开始'}
                  </strong>
                </button>
              )}
              {farmMorningKickstartItem && farmMorningFollowupItem && farmMorningBriefReceipt === farmMorningKickstartItem.id && (
                <button
                  type="button"
                  className="t8-farm-story-panel__morning-followup"
                  data-farm-summary-morning-followup="true"
                  data-farm-summary-morning-followup-active="true"
                  data-farm-summary-morning-followup-item={farmMorningFollowupItem.id}
                  data-farm-summary-morning-followup-tone={farmMorningFollowupItem.tone}
                  data-farm-summary-morning-followup-route-target={farmMorningFollowupItem.routeTarget || undefined}
                  data-farm-summary-morning-followup-route-label={farmMorningFollowupItem.routeLabel || undefined}
                  title={`晨间二连：接着做 ${farmMorningFollowupSummary}`}
                  aria-label={`晨间二连：接着做 ${farmMorningFollowupSummary}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmMorningBriefAction(farmMorningFollowupItem);
                  }}
                >
                  <FarmMorningFollowupIcon size={12} />
                  <span>
                    <b>接着做</b>
                    <small>{farmMorningFollowupItem.label} · {farmMorningFollowupItem.detail}</small>
                  </span>
                  <em>{farmMorningFollowupItem.rewardLabel || farmMorningFollowupItem.countLabel || '继续'}</em>
                </button>
              )}
              {farmMorningKickstartItem && farmMorningFollowupItem && farmMorningComboReceipt && (
                <div
                  className="t8-farm-story-panel__morning-combo"
                  data-farm-summary-morning-combo="true"
                  data-farm-summary-morning-combo-summary={farmMorningComboSummary || undefined}
                  data-farm-summary-morning-combo-reward={farmMorningComboRewardLabel || undefined}
                  role="status"
                  aria-live="polite"
                  title={`晨报二连完成：${farmMorningComboSummary}`}
                  aria-label={`晨报二连完成：${farmMorningComboSummary}${farmMorningComboRewardLabel ? `，${farmMorningComboRewardLabel}` : ''}`}
                >
                  <Sparkles size={13} />
                  <span>
                    <b>晨报二连完成</b>
                    <small>{farmMorningComboSummary}</small>
                  </span>
                  {farmMorningComboRewardLabel && <em>{farmMorningComboRewardLabel}</em>}
                </div>
              )}
              {farmMorningComboRouteStep && (
                <button
                  type="button"
                  className="t8-farm-story-panel__morning-combo-route"
                  data-farm-summary-morning-combo-route="true"
                  data-farm-summary-morning-combo-route-stage={farmMorningComboRouteStep.stageLabel}
                  data-farm-summary-morning-combo-route-target={farmMorningComboRouteStep.routeTarget || undefined}
                  data-farm-summary-morning-combo-route-receipt={farmDailyRouteReceipt === farmMorningComboRouteStep.id ? 'true' : undefined}
                  title={farmMorningComboRouteTitle}
                  aria-label={farmMorningComboRouteTitle}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmDailyRouteStepAction(farmMorningComboRouteStep);
                  }}
                >
                  <Sparkles size={12} />
                  <span>
                    <b>{farmMorningComboRouteReceipt ? '已接今日路线' : '接今日路线'}</b>
                    <small>{farmMorningComboRouteStep.stageLabel} · {farmMorningComboRouteStep.title}</small>
                  </span>
                  {(farmMorningComboRouteStep.countLabel || farmMorningComboRouteStep.resourceLabel) && (
                    <em>{farmMorningComboRouteStep.countLabel || farmMorningComboRouteStep.resourceLabel}</em>
                  )}
                </button>
              )}
              {farmMorningBriefItems.length > 0 && (
                <div
                  className="t8-farm-story-panel__morning-brief"
                  data-farm-summary-morning-brief="true"
                  data-farm-summary-morning-brief-count={farmMorningBriefItems.length}
                  aria-label={`明日晨报：${farmMorningBriefItems.map((item) => `${item.label}${item.countLabel ? ` ${item.countLabel}` : ''}`).join('，')}`}
                >
                  <div className="t8-farm-story-panel__morning-brief-head">
                    <span>
                      <CloudSun size={12} />
                      明日晨报
                    </span>
                    <em>{farmMorningBriefItems.length} 条</em>
                  </div>
                  <div className="t8-farm-story-panel__morning-brief-items">
                    {farmMorningBriefItems.map((item) => {
                      const BriefIcon = item.icon;
                      const morningBriefActive = farmMorningBriefReceipt === item.id;
                      const morningBriefTitle = `明日晨报：${item.label}，${item.detail}${item.rewardLabel ? `，${item.rewardLabel}` : ''}`;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-farm-summary-morning-brief-item={item.id}
                          data-farm-summary-morning-brief-tone={item.tone}
                          data-farm-summary-morning-brief-route-target={item.routeTarget || undefined}
                          data-farm-summary-morning-brief-route-label={item.routeLabel || undefined}
                          data-farm-summary-morning-brief-receipt={farmMorningBriefReceipt === item.id ? 'true' : undefined}
                          title={morningBriefTitle}
                          aria-label={morningBriefTitle}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFarmMorningBriefAction(item);
                          }}
                        >
                          <BriefIcon size={12} />
                          <span>
                            <b>{item.label}</b>
                            <small>{item.detail}</small>
                          </span>
                          <em>{morningBriefActive ? '已接上' : item.countLabel}</em>
                          {item.rewardLabel && <strong>{item.rewardLabel}</strong>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {farmTomorrowRouteSteps.length > 0 && (
                <div
                  className="t8-farm-story-panel__tomorrow-route"
                  data-farm-summary-tomorrow-route="true"
                  data-farm-summary-tomorrow-route-count={farmTomorrowRouteSteps.length}
                  data-farm-summary-tomorrow-route-summary={farmTomorrowRouteSummaryLabel || undefined}
                  aria-label={`明日待办路线：${farmTomorrowRouteSummaryLabel || '暂无待办'}`}
                >
                  <div className="t8-farm-story-panel__tomorrow-route-head">
                    <span>
                      <Sparkles size={12} />
                      明日待办
                    </span>
                    <em>{farmTomorrowRouteSteps.length} 步</em>
                  </div>
                  <div className="t8-farm-story-panel__tomorrow-route-steps">
                    {farmTomorrowRouteSteps.map((step) => {
                      const tomorrowRouteActive = farmTomorrowRouteReceipt === step.id;
                      const tomorrowRouteTitle = `明日待办：${step.stageLabel} ${step.title}，${step.routeTitle}`;
                      return (
                        <button
                          key={step.id}
                          type="button"
                          data-farm-summary-tomorrow-route-step={step.id}
                          data-farm-summary-tomorrow-route-target={step.routeTarget || undefined}
                          data-farm-summary-tomorrow-route-label={step.routeLabel}
                          data-farm-summary-tomorrow-route-receipt={farmTomorrowRouteReceipt === step.id ? 'true' : undefined}
                          title={tomorrowRouteTitle}
                          aria-label={tomorrowRouteTitle}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFarmTomorrowRouteStepAction(step);
                          }}
                        >
                          <span>{step.stageLabel}</span>
                          <b>{step.title}</b>
                          <small>{tomorrowRouteActive ? '已接上' : step.routeLabel}</small>
                          {step.countLabel && <em>{step.countLabel}</em>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {farmSummaryActions.length > 0 && (
                <div className="t8-farm-story-panel__summary-actions" aria-label="每日总结快捷行动">
                  {farmSummaryActions.map((action) => {
                    const ActionIcon = action.icon;
                    const summaryActionResourceTargets = farmActionResourceTargets(action.action);
                    const summaryActionResourcePreview = farmActionResourcePreviewLabel(summaryActionResourceTargets);
                    const summaryActionResourceLabel = summaryActionResourcePreview.replace('预期：', '');
                    const summaryActionRouteTarget = farmRouteTargetForFocusAction(action.action);
                    const summaryActionRouteLabel = farmRouteLabelForTarget(summaryActionRouteTarget);
                    const summaryActionRouteCountLabel = summaryActionRouteTarget
                      ? farmSummaryActionReceiptNextCountLabel(action, {
                          dryCount,
                          witheredCount,
                          matureCount,
                          scarecrowRiskCount,
                          readyOrderCount,
                          readyNpcVisitCount,
                        })
                      : '';
                    const summaryActionRouteTitle = summaryActionRouteLabel
                      ? `自动定位最近${summaryActionRouteLabel}${summaryActionRouteCountLabel ? ` · ${summaryActionRouteCountLabel}` : ''}`
                      : '';
                    const summaryActionFeedbackActive = farmSummaryDetailActionFeedbackItemId === action.id && Boolean(farmSummaryDetailActionFeedback);
                    const summaryActionFeedbackLabel = farmSummaryActionFeedbackLabel(action);
                    const summaryActionFeedbackTitle = summaryActionFeedbackActive
                      ? `刚刚执行：${farmSummaryDetailActionFeedback}${summaryActionResourceLabel ? ` · ${summaryActionResourceLabel}` : ''}`
                      : summaryActionRouteTitle
                        ? `${action.title}；${summaryActionRouteTitle}`
                        : action.title;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        data-farm-summary-action={action.action.kind}
                        data-farm-summary-action-tone={action.tone}
                        data-farm-summary-action-resource-targets={summaryActionResourceTargets.join(' ') || undefined}
                        data-farm-summary-action-resource-preview={summaryActionResourcePreview || undefined}
                        data-farm-summary-action-resource-label={summaryActionResourceLabel || undefined}
                        data-farm-summary-action-route-target={summaryActionRouteTarget || undefined}
                        data-farm-summary-action-route-label={summaryActionRouteLabel || undefined}
                        data-farm-summary-action-route-count={summaryActionRouteCountLabel || undefined}
                        data-farm-summary-action-feedback={summaryActionFeedbackActive ? 'true' : undefined}
                        data-farm-summary-action-result={summaryActionFeedbackActive ? farmSummaryDetailActionFeedback : undefined}
                        data-farm-summary-action-cooldown={summaryActionFeedbackActive ? 'true' : undefined}
                        disabled={summaryActionFeedbackActive}
                        aria-disabled={summaryActionFeedbackActive ? 'true' : undefined}
                        title={summaryActionFeedbackTitle}
                        aria-label={summaryActionFeedbackTitle}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (summaryActionFeedbackActive) return;
                          handleFarmGoalAction(action.action);
                          flashFarmSummaryDetailAction(summaryActionFeedbackLabel, action.id);
                          if (summaryActionRouteTarget) {
                            onFollowupCanvasHint?.({
                              message: `每日总结路线：${summaryActionRouteLabel}${summaryActionRouteCountLabel ? ` · ${summaryActionRouteCountLabel}` : ''}`,
                              tone: farmFocusActionCanvasTone(farmFocusActionNextTarget(action.action)),
                              routeTarget: summaryActionRouteTarget,
                              routeLabel: summaryActionRouteLabel,
                              routeTitle: summaryActionRouteTitle,
                            });
                          }
                        }}
                      >
                        {summaryActionFeedbackActive ? (
                          <>
                            <Sparkles size={10} />
                            <span>{farmSummaryDetailActionFeedback}</span>
                            {summaryActionResourceLabel && (
                              <em
                                data-farm-summary-action-resource="true"
                                data-farm-summary-action-resource-feedback="true"
                              >
                                {summaryActionResourceLabel}
                              </em>
                            )}
                            <strong data-farm-summary-action-feedback-stamp="true">已执行</strong>
                          </>
                        ) : (
                          <>
                            <ActionIcon size={10} />
                            {action.label}
                            {summaryActionResourcePreview && (
                              <em data-farm-summary-action-resource="true">{summaryActionResourcePreview.replace('预期：', '')}</em>
                            )}
                            {summaryActionRouteLabel && (
                              <strong data-farm-summary-action-route="true">
                                图{summaryActionRouteLabel}
                              </strong>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {farmSummaryActionReceipt && (
                <div
                  className="t8-farm-story-panel__summary-action-receipt"
                  data-farm-summary-action-receipt="true"
                  data-farm-summary-action-receipt-item-id={farmSummaryDetailActionFeedbackItemId}
                  data-farm-summary-action-receipt-tone={farmSummaryActionReceipt.tone}
                  data-farm-summary-action-receipt-targets={farmSummaryActionReceiptResourceTargets.join(' ') || undefined}
                  data-farm-summary-action-receipt-resource-label={farmSummaryActionReceiptResourceLabel || undefined}
                  data-farm-summary-action-receipt-next={farmSummaryActionReceiptNextHintText || undefined}
                  data-farm-summary-action-receipt-next-badge-label={farmSummaryActionReceiptNextBadgeText || undefined}
                  data-farm-summary-action-receipt-next-count-label={farmSummaryActionReceiptNextCountText || undefined}
                  role="status"
                  aria-live="polite"
                  title={farmSummaryActionReceiptAccessibleTitle}
                  aria-label={farmSummaryActionReceiptAccessibleTitle}
                >
                  <Sparkles size={11} />
                  <span>刚执行</span>
                  <strong>{farmSummaryDetailActionFeedback}</strong>
                  {farmSummaryActionReceiptResourceLabel && (
                    <em data-farm-summary-action-receipt-resource="true">
                      {farmSummaryActionReceiptResourceLabel}
                    </em>
                  )}
                  <b data-farm-summary-action-receipt-stamp="true">已执行</b>
                  {farmSummaryActionReceiptNextHintText && (
                    <small
                      data-farm-summary-action-receipt-next-hint="true"
                      data-farm-summary-action-receipt-next-targets={farmSummaryActionReceiptResourceTargets.join(' ') || undefined}
                      data-farm-summary-action-receipt-next-count-label={farmSummaryActionReceiptNextCountText || undefined}
                    >
                      {farmSummaryActionReceiptNextBadgeText && (
                        <b data-farm-summary-action-receipt-next-badge="true">
                          {farmSummaryActionReceiptNextBadgeText}
                        </b>
                      )}
                      {farmSummaryActionReceiptNextCountText && (
                        <em data-farm-summary-action-receipt-next-count="true">
                          {farmSummaryActionReceiptNextCountText}
                        </em>
                      )}
                      <span>{farmSummaryActionReceiptNextHintText}</span>
                    </small>
                  )}
                </div>
              )}
              <ul>
                {dailySummary.highlights.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <div
            ref={farmActivityRef}
            className="t8-farm-story-panel__log t8-farm-story-panel__activity"
            aria-live="polite"
            aria-label={`最近农活：${farmActivityFeed.summary}，今日成果 ${farmActivityDigest.todayTotal}/${farmActivityDigest.target}，${farmActivityDigest.badgeLabel}`}
            role="status"
            data-farm-activity-count={farmActivityFeed.todayTotal}
            data-farm-activity-rewards={farmActivityFeed.todayRewardTotal}
            data-farm-activity-focus={farmActivityDetailOpened ? 'true' : undefined}
            data-farm-activity-pulse={farmActivityDetailPulseId || undefined}
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'activity' ? 'true' : undefined}
            tabIndex={-1}
          >
            <div className="t8-farm-story-panel__log-title t8-farm-story-panel__activity-head">
              <Package size={13} />
              <span>最近农活</span>
              <em>{farmActivityFeed.summary}</em>
              {farmActivityDetailOpened && (
                <small
                  className="t8-farm-story-panel__activity-located"
                  key={farmActivityDetailPulseId || 'activity-located'}
                  data-farm-activity-located-feedback="true"
                  data-farm-activity-located-target={farmActivityFocusTarget || 'section'}
                  data-farm-activity-located-label={farmActivityLocatedLabel}
                  data-farm-activity-located-pulse={farmActivityDetailPulseId || undefined}
                  title={`最近农活已定位：${farmActivityLocatedLabel}`}
                  aria-hidden="true"
                >
                  <Sparkles size={9} />
                  {farmActivityLocatedLabel}
                </small>
              )}
            </div>
                <div
                  ref={farmActivityRewardDigestRef}
                  className={`t8-farm-story-panel__activity-digest is-${farmActivityDigest.tone}`}
                  data-farm-activity-digest={farmActivityDigest.tone}
                  data-farm-activity-percent={farmActivityDigest.percent}
                  data-farm-activity-target={farmActivityDigest.target}
                  data-farm-activity-digest-rewards={farmActivityDigest.todayRewardTotal}
                  data-farm-activity-reward-digest-focus={farmActivityFocusTarget === 'reward-digest' ? 'true' : undefined}
                  data-farm-activity-reward-digest-pulse={farmActivityFocusTarget === 'reward-digest' ? farmActivityDetailPulseId || undefined : undefined}
                  data-farm-activity-reward-streak={farmActivityDigest.rewardStreak || undefined}
                  data-farm-activity-reward-streak-hint={farmActivityDigest.rewardStreakHint || undefined}
                  data-farm-activity-reward-streak-tier={farmActivityDigest.rewardStreakTier || undefined}
                  data-farm-activity-reward-streak-milestone={farmActivityDigest.rewardStreakMilestoneLabel || undefined}
                  data-farm-activity-reward-streak-target={farmActivityDigest.rewardStreakMilestoneTarget || undefined}
                  data-farm-activity-reward-streak-percent={farmActivityDigest.rewardStreakMilestonePercent ?? undefined}
                  data-farm-activity-reward-streak-progress={farmActivityDigest.rewardStreakMilestoneProgressLabel || undefined}
                  data-farm-activity-reward-streak-complete={farmActivityDigest.rewardStreakMilestonePercent === 100 ? 'true' : undefined}
                  data-farm-activity-reward-streak-completion={farmActivityDigest.rewardStreakMilestoneCompletionLabel || undefined}
                  data-farm-activity-reward-streak-reward={farmActivityDigest.rewardStreakMilestoneRewardLabel || undefined}
                  data-farm-activity-reward-streak-items={farmActivityDigest.rewardStreakMilestoneRewardItems?.join(' ') || undefined}
                  data-farm-activity-reward-streak-chest-state={farmActivityDigest.rewardStreakChestState || undefined}
                  data-farm-activity-reward-streak-chest-tier={farmActivityDigest.rewardStreakChestTier || undefined}
                  data-farm-activity-reward-streak-chest-progress={farmActivityDigest.rewardStreakChestProgressLabel || undefined}
                  data-farm-activity-reward-streak-chest-reward={farmActivityDigest.rewardStreakChestRewardLabel || undefined}
                  data-farm-activity-reward-streak-chest-cta={farmActivityDigest.rewardStreakChestCtaLabel || undefined}
                  data-farm-activity-reward-streak-chest-claim={farmActivityDigest.rewardStreakChestClaimLabel || undefined}
                  data-farm-activity-reward-streak-chest-next={farmActivityDigest.rewardStreakChestNextLabel || undefined}
                  data-farm-activity-reward-streak-chest-remaining={farmActivityDigest.rewardStreakChestRemaining ?? undefined}
                  data-farm-activity-reward-streak-chest-remaining-label={farmActivityDigest.rewardStreakChestRemainingLabel || undefined}
                  data-farm-activity-reward-streak-chest-trail={farmActivityDigest.rewardStreakChestTrailLabel || undefined}
                  data-farm-activity-reward-streak-chest-items={farmActivityDigest.rewardStreakChestRewardItems?.join(' ') || undefined}
                  data-farm-activity-reward-streak-chest-burst={farmActivityDigest.rewardStreakChestBurstLabel || undefined}
                  data-farm-activity-reward-streak-chest-opened-summary={farmActivityDigest.rewardStreakChestOpenedSummaryLabel || undefined}
                  data-farm-activity-reward-streak-chest-percent={farmActivityDigest.rewardStreakChestPercent ?? undefined}
                  data-farm-activity-reward-streak-chest-meter={farmActivityDigest.rewardStreakChestMeterLabel || undefined}
                  data-farm-activity-reward-streak-chest-charge={farmActivityDigest.rewardStreakChestChargeLabel || undefined}
                  data-farm-activity-reward-streak-chest-charge-hint={farmActivityDigest.rewardStreakChestChargeHint || undefined}
                  data-farm-activity-reward-streak-action={farmActivityDigest.rewardStreakActionKind || undefined}
                  title={farmActivityFocusTarget === 'reward-digest' ? `已定位今日成果：${farmActivityDigest.badgeLabel}` : `今日成果：${farmActivityDigest.badgeLabel}`}
                  tabIndex={-1}
                >
                  <div className="t8-farm-story-panel__activity-digest-head">
                    <span>今日成果</span>
                    <strong>{farmActivityDigest.badgeLabel}</strong>
                    {farmActivityFocusTarget === 'reward-digest' && (
                      <small
                            key={farmActivityDetailPulseId || 'reward-digest-located'}
                            data-farm-activity-reward-digest-located="true"
                            data-farm-activity-reward-digest-located-label="已定位奖励"
                            data-farm-activity-reward-digest-located-pulse={farmActivityFocusTarget === 'reward-digest' ? farmActivityDetailPulseId || undefined : undefined}
                            title="今日成果已定位：已定位奖励"
                            aria-hidden="true"
                          >
                        <Sparkles size={9} />
                        已定位奖励
                      </small>
                    )}
                    {farmActivityDigest.rewardStreakLabel && (
                      <em
                        ref={farmActivityStreakRef}
                        data-farm-activity-reward-streak="true"
                        data-farm-activity-reward-streak-focus={farmActivityFocusTarget === 'streak' ? 'true' : undefined}
                        data-farm-activity-reward-streak-pulse={farmActivityFocusTarget === 'streak' ? farmActivityDetailPulseId || undefined : undefined}
                        title={farmActivityFocusTarget === 'streak' ? `已定位今日连击：${farmActivityDigest.rewardStreakLabel}` : `今日连击：${farmActivityDigest.rewardStreakLabel}`}
                        tabIndex={-1}
                      >
                        {farmActivityDigest.rewardStreakLabel}
                      </em>
                    )}
                    {farmActivityFocusTarget === 'streak' && (
                      <small
                            key={farmActivityDetailPulseId || 'reward-streak-located'}
                            data-farm-activity-reward-streak-located="true"
                            data-farm-activity-reward-streak-located-label="已定位连击"
                            data-farm-activity-reward-streak-located-pulse={farmActivityFocusTarget === 'streak' ? farmActivityDetailPulseId || undefined : undefined}
                            title="今日成果已定位：已定位连击"
                            aria-hidden="true"
                          >
                        <Sparkles size={9} />
                        已定位连击
                      </small>
                    )}
                  </div>
              <p>{farmActivityDigest.headline}</p>
              {farmActivityDigest.rewardStreakHint && (
                <small data-farm-activity-reward-streak-hint="true">{farmActivityDigest.rewardStreakHint}</small>
              )}
              {farmActivityDigest.rewardStreakMilestoneLabel && (
                <small
                  ref={farmActivityMilestoneRef}
                  data-farm-activity-reward-streak-milestone="true"
                  data-farm-activity-reward-streak-milestone-focus={farmActivityFocusTarget === 'milestone' ? 'true' : undefined}
                  data-farm-activity-reward-streak-milestone-pulse={farmActivityFocusTarget === 'milestone' ? farmActivityDetailPulseId || undefined : undefined}
                  title={farmActivityFocusTarget === 'milestone' ? `已定位连击里程碑：${farmActivityDigest.rewardStreakMilestoneLabel}` : farmActivityDigest.rewardStreakMilestoneLabel}
                  tabIndex={-1}
                >
                  {farmActivityDigest.rewardStreakMilestoneLabel}
                </small>
              )}
              {farmActivityFocusTarget === 'milestone' && (
                  <small
                    key={farmActivityDetailPulseId || 'reward-streak-milestone-located'}
                    data-farm-activity-reward-streak-milestone-located="true"
                    data-farm-activity-reward-streak-milestone-located-label="已定位里程碑"
                    data-farm-activity-reward-streak-milestone-located-pulse={farmActivityFocusTarget === 'milestone' ? farmActivityDetailPulseId || undefined : undefined}
                    title="今日成果已定位：已定位里程碑"
                    aria-hidden="true"
                  >
                  <Sparkles size={9} />
                  已定位里程碑
                </small>
              )}
              {farmActivityDigest.rewardStreakMilestonePercent !== undefined && farmActivityDigest.rewardStreakMilestoneProgressLabel && (
                <div
                  className="t8-farm-story-panel__activity-streak-meter"
                  ref={farmActivityStreakMeterRef}
                  data-farm-activity-reward-streak-meter="true"
                  data-farm-activity-reward-streak-tier={farmActivityDigest.rewardStreakTier || undefined}
                  data-farm-activity-reward-streak-complete={farmActivityDigest.rewardStreakMilestonePercent === 100 ? 'true' : undefined}
                  data-farm-activity-reward-streak-meter-focus={farmActivityFocusTarget === 'streak-meter' ? 'true' : undefined}
                  data-farm-activity-reward-streak-meter-pulse={farmActivityFocusTarget === 'streak-meter' ? farmActivityDetailPulseId || undefined : undefined}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={farmActivityDigest.rewardStreakMilestoneTarget || 1}
                  aria-valuenow={Math.min(farmActivityDigest.rewardStreak, farmActivityDigest.rewardStreakMilestoneTarget || farmActivityDigest.rewardStreak)}
                  aria-valuetext={farmActivityDigest.rewardStreakMilestoneProgressLabel}
                  title={`今日连击里程碑：${farmActivityDigest.rewardStreakMilestoneProgressLabel} · ${farmActivityDigest.rewardStreakMilestoneLabel || '保持正反馈'}`}
                  tabIndex={-1}
                >
                  <i style={{ width: `${farmActivityDigest.rewardStreakMilestonePercent}%` }} />
                  <span>{farmActivityDigest.rewardStreakMilestoneProgressLabel}</span>
                  {farmActivityFocusTarget === 'streak-meter' && (
                      <em
                        key={farmActivityDetailPulseId || 'reward-streak-meter-located'}
                        data-farm-activity-reward-streak-meter-located="true"
                        data-farm-activity-reward-streak-meter-located-label="已定位进度"
                        data-farm-activity-reward-streak-meter-located-pulse={farmActivityFocusTarget === 'streak-meter' ? farmActivityDetailPulseId || undefined : undefined}
                        title="今日成果已定位：已定位进度"
                      >
                      <Sparkles size={9} />
                      已定位进度
                    </em>
                  )}
                  {farmActivityDigest.rewardStreakMilestonePercent === 100 && (
                    <strong data-farm-activity-reward-streak-complete="true">已点亮</strong>
                  )}
                </div>
              )}
              {farmActivityDigest.rewardStreakMilestoneCompletionLabel && (
                    <small
                      ref={farmActivityCompletionRef}
                      data-farm-activity-reward-streak-completion="true"
                      data-farm-activity-reward-streak-completion-focus={farmActivityFocusTarget === 'completion' ? 'true' : undefined}
                      data-farm-activity-reward-streak-completion-pulse={farmActivityFocusTarget === 'completion' ? farmActivityDetailPulseId || undefined : undefined}
                      title={farmActivityFocusTarget === 'completion' ? `已定位完成：${farmActivityDigest.rewardStreakMilestoneCompletionLabel}` : farmActivityDigest.rewardStreakMilestoneCompletionLabel}
                      tabIndex={-1}
                    >
                      <span>{farmActivityDigest.rewardStreakMilestoneCompletionLabel}</span>
                      {farmActivityFocusTarget === 'completion' && (
                            <em
                              key={farmActivityDetailPulseId || 'reward-streak-completion-located'}
                              data-farm-activity-reward-streak-completion-located="true"
                              data-farm-activity-reward-streak-completion-located-label="已定位完成"
                              data-farm-activity-reward-streak-completion-located-pulse={farmActivityFocusTarget === 'completion' ? farmActivityDetailPulseId || undefined : undefined}
                              title="今日成果已定位：已定位完成"
                            >
                          <Sparkles size={9} />
                          已定位完成
                        </em>
                      )}
                </small>
              )}
              {farmActivityDigest.rewardStreakChestLabel && (
                <small
                  className="t8-farm-story-panel__activity-streak-chest"
                  ref={farmActivityChestRef}
                  data-farm-activity-reward-streak-chest="true"
                  data-farm-activity-reward-streak-chest-state={farmActivityDigest.rewardStreakChestState || undefined}
                  data-farm-activity-reward-streak-chest-tier={farmActivityDigest.rewardStreakChestTier || undefined}
                  data-farm-activity-reward-streak-chest-progress={farmActivityDigest.rewardStreakChestProgressLabel || undefined}
                  data-farm-activity-reward-streak-chest-reward={farmActivityDigest.rewardStreakChestRewardLabel || undefined}
                  data-farm-activity-reward-streak-chest-cta={farmActivityDigest.rewardStreakChestCtaLabel || undefined}
                  data-farm-activity-reward-streak-chest-claim={farmActivityDigest.rewardStreakChestClaimLabel || undefined}
                  data-farm-activity-reward-streak-chest-next={farmActivityDigest.rewardStreakChestNextLabel || undefined}
                  data-farm-activity-reward-streak-chest-remaining={farmActivityDigest.rewardStreakChestRemaining ?? undefined}
                  data-farm-activity-reward-streak-chest-remaining-label={farmActivityDigest.rewardStreakChestRemainingLabel || undefined}
                  data-farm-activity-reward-streak-chest-trail={farmActivityDigest.rewardStreakChestTrailLabel || undefined}
                  data-farm-activity-reward-streak-chest-trail-reward={farmActivityDigest.rewardStreakChestTrailRewardLabel || undefined}
                  data-farm-activity-reward-streak-chest-active-stage={farmActivityDigest.rewardStreakChestActiveTrailLabel || undefined}
                  data-farm-activity-reward-streak-chest-active-reward={farmActivityDigest.rewardStreakChestActiveRewardLabel || undefined}
                  data-farm-activity-reward-streak-chest-active-hint={farmActivityDigest.rewardStreakChestActiveHint || undefined}
                  data-farm-activity-reward-streak-chest-next-reward={farmActivityDigest.rewardStreakChestNextRewardLabel || undefined}
                  data-farm-activity-reward-streak-chest-items={farmActivityDigest.rewardStreakChestRewardItems?.join(' ') || undefined}
                  data-farm-activity-reward-streak-chest-burst={farmActivityDigest.rewardStreakChestBurstLabel || undefined}
                  data-farm-activity-reward-streak-chest-opened-summary={farmActivityDigest.rewardStreakChestOpenedSummaryLabel || undefined}
                  data-farm-activity-reward-streak-chest-percent={farmActivityDigest.rewardStreakChestPercent ?? undefined}
                  data-farm-activity-reward-streak-chest-meter={farmActivityDigest.rewardStreakChestMeterLabel || undefined}
                  data-farm-activity-reward-streak-chest-charge={farmActivityDigest.rewardStreakChestChargeLabel || undefined}
                  data-farm-activity-reward-streak-chest-charge-hint={farmActivityDigest.rewardStreakChestChargeHint || undefined}
                  data-farm-activity-reward-streak-chest-charge-receipt={farmActivityChestChargeReceipt || undefined}
                  data-farm-activity-reward-streak-chest-claimed={farmActivityChestClaimed ? 'true' : undefined}
                  data-farm-activity-reward-streak-chest-focus={farmActivityFocusTarget === 'chest' ? 'true' : undefined}
                  data-farm-activity-reward-streak-chest-pulse={farmActivityFocusTarget === 'chest' ? farmActivityDetailPulseId || undefined : undefined}
                  title={`${farmActivityDigest.rewardStreakChestLabel}${farmActivityDigest.rewardStreakChestRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestRewardLabel}` : ''}${farmActivityDigest.rewardStreakChestActiveHint ? ` · ${farmActivityDigest.rewardStreakChestActiveHint}` : ''}${farmActivityDigest.rewardStreakChestRemainingLabel ? ` · ${farmActivityDigest.rewardStreakChestRemainingLabel}` : ''}${farmActivityChestChargeReceipt ? ` · ${farmActivityChestChargeReceipt}` : ''}${farmActivityChestClaimed && farmActivityDigest.rewardStreakChestOpenedSummaryLabel ? ` · ${farmActivityDigest.rewardStreakChestOpenedSummaryLabel}` : ''}${farmActivityDigest.rewardStreakChestNextRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestNextRewardLabel}` : ''}${farmActivityDigest.rewardStreakChestNextLabel ? ` · ${farmActivityDigest.rewardStreakChestNextLabel}` : ''}`}
                  tabIndex={-1}
                >
                  <Package size={10} />
                  <span>{farmActivityDigest.rewardStreakChestLabel}</span>
                  {farmActivityDigest.rewardStreakChestProgressLabel && (
                    <em>{farmActivityDigest.rewardStreakChestProgressLabel}</em>
                  )}
                  {farmActivityDigest.rewardStreakChestRewardLabel && (
                    <b>{farmActivityDigest.rewardStreakChestRewardLabel}</b>
                  )}
                  {farmActivityDigest.rewardStreakChestPercent !== undefined && farmActivityDigest.rewardStreakChestProgressLabel && (
                    <span
                      className="t8-farm-story-panel__activity-streak-chest-meter"
                      data-farm-activity-reward-streak-chest-meter="true"
                      data-farm-activity-reward-streak-chest-meter-label={farmActivityDigest.rewardStreakChestMeterLabel || undefined}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={farmActivityDigest.rewardStreakChestPercent}
                      aria-valuetext={farmActivityDigest.rewardStreakChestMeterLabel || farmActivityDigest.rewardStreakChestProgressLabel}
                      title={farmActivityDigest.rewardStreakChestMeterLabel || farmActivityDigest.rewardStreakChestProgressLabel}
                    >
                      <i style={{ width: `${farmActivityDigest.rewardStreakChestPercent}%` }} />
                      <b>{farmActivityDigest.rewardStreakChestProgressLabel}</b>
                    </span>
                  )}
                  {farmActivityDigest.rewardStreakChestRemainingLabel && (
                    <strong
                      data-farm-activity-reward-streak-chest-remaining-label="true"
                      data-farm-activity-reward-streak-chest-remaining={farmActivityDigest.rewardStreakChestRemaining ?? undefined}
                      title={`宝箱目标：${farmActivityDigest.rewardStreakChestRemainingLabel}`}
                    >
                      <Sparkles size={9} />
                      {farmActivityDigest.rewardStreakChestRemainingLabel}
                    </strong>
                  )}
                  {farmActivityDigest.rewardStreakChestTrailItems?.length && (
                    <span
                      className="t8-farm-story-panel__activity-streak-chest-trail"
                      data-farm-activity-reward-streak-chest-trail="true"
                      data-farm-activity-reward-streak-chest-trail-reward={farmActivityDigest.rewardStreakChestTrailRewardLabel || undefined}
                      role="list"
                      aria-label={`${farmActivityDigest.rewardStreakChestTrailLabel}${farmActivityDigest.rewardStreakChestTrailRewardLabel ? `，${farmActivityDigest.rewardStreakChestTrailRewardLabel}` : ''}`}
                      title={`${farmActivityDigest.rewardStreakChestTrailLabel}${farmActivityDigest.rewardStreakChestTrailRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestTrailRewardLabel}` : ''}`}
                    >
                      {farmActivityDigest.rewardStreakChestTrailItems.map((item) => (
                        <i
                          key={item.tier}
                          role="listitem"
                          data-farm-activity-reward-streak-chest-trail-item={item.tier}
                          data-farm-activity-reward-streak-chest-trail-state={item.state}
                          data-farm-activity-reward-streak-chest-trail-reward={item.shortRewardLabel}
                          title={`${item.label}：${item.progressLabel} · ${item.rewardLabel}`}
                        >
                          <b>{item.label}</b>
                          <em>{item.progressLabel}</em>
                          <small data-farm-activity-reward-streak-chest-trail-reward-label="true">
                            {item.shortRewardLabel}
                          </small>
                        </i>
                      ))}
                    </span>
                  )}
                  {farmActivityDigest.rewardStreakChestActiveHint && (
                    <span
                      className="t8-farm-story-panel__activity-streak-chest-active"
                      data-farm-activity-reward-streak-chest-active="true"
                      data-farm-activity-reward-streak-chest-active-stage={farmActivityDigest.rewardStreakChestActiveTrailLabel || undefined}
                      data-farm-activity-reward-streak-chest-active-reward={farmActivityDigest.rewardStreakChestActiveRewardLabel || undefined}
                      data-farm-activity-reward-streak-chest-next-reward={farmActivityDigest.rewardStreakChestNextRewardLabel || undefined}
                      title={`${farmActivityDigest.rewardStreakChestActiveTrailLabel || '当前阶段'} · ${farmActivityDigest.rewardStreakChestActiveHint}${farmActivityDigest.rewardStreakChestNextRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestNextRewardLabel}` : ''}`}
                    >
                      <Sparkles size={9} />
                      <span>{farmActivityDigest.rewardStreakChestActiveHint}</span>
                      {farmActivityDigest.rewardStreakChestActiveRewardLabel && (
                        <b data-farm-activity-reward-streak-chest-active-reward-label="true">
                          {farmActivityDigest.rewardStreakChestActiveRewardLabel}
                        </b>
                      )}
                      {farmActivityDigest.rewardStreakChestNextRewardLabel && (
                        <em data-farm-activity-reward-streak-chest-next-reward-label="true">
                          {farmActivityDigest.rewardStreakChestNextRewardLabel}
                        </em>
                      )}
                    </span>
                  )}
                  {farmActivityDigest.rewardStreakChestState === 'warming' && farmActivityDigest.rewardStreakChestChargeLabel && (
                    <button
                      type="button"
                      data-farm-activity-reward-streak-chest-charge-cta="true"
                      data-farm-activity-reward-streak-chest-charge-reward={farmActivityDigest.rewardStreakChestActiveRewardLabel || undefined}
                      data-farm-activity-reward-streak-chest-charge-next={farmActivityDigest.rewardStreakChestNextRewardLabel || undefined}
                      disabled={!farmActivityRewardStreakGoal || farmMiniQuickActionBusy}
                      aria-disabled={!farmActivityRewardStreakGoal || farmMiniQuickActionBusy ? 'true' : undefined}
                      title={farmMiniQuickActionBusy
                        ? farmMiniQuickActionFeedback?.label || '蓄能中'
                        : `${farmActivityDigest.rewardStreakChestChargeHint || '给宝箱蓄能'}${farmActivityDigest.rewardStreakChestActiveRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestActiveRewardLabel.replace('当前奖励：', '冲 ')}` : ''}${farmActivityDigest.rewardStreakChestNextRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestNextRewardLabel}` : ''}`}
                      aria-label={farmMiniQuickActionBusy
                        ? farmMiniQuickActionFeedback?.label || '蓄能中'
                        : `${farmActivityDigest.rewardStreakChestChargeHint || '给宝箱蓄能'}${farmActivityDigest.rewardStreakChestActiveRewardLabel ? `，${farmActivityDigest.rewardStreakChestActiveRewardLabel.replace('当前奖励：', '冲 ')}` : ''}${farmActivityDigest.rewardStreakChestNextRewardLabel ? `，${farmActivityDigest.rewardStreakChestNextRewardLabel}` : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFarmActivityChestChargeAction();
                      }}
                    >
                      <Sparkles size={9} />
                      <span>{farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || '蓄能中' : farmActivityDigest.rewardStreakChestChargeLabel}</span>
                      {farmActivityDigest.rewardStreakChestActiveRewardLabel && (
                        <small data-farm-activity-reward-streak-chest-charge-reward-label="true">
                          {farmActivityDigest.rewardStreakChestActiveRewardLabel.replace('当前奖励：', '冲 ')}
                        </small>
                      )}
                    </button>
                  )}
                  {farmActivityChestChargeReceipt && (
                    <strong
                      data-farm-activity-reward-streak-chest-charge-receipt="true"
                      data-farm-activity-reward-streak-chest-charge-receipt-reward={farmActivityDigest.rewardStreakChestActiveRewardLabel || undefined}
                      data-farm-activity-reward-streak-chest-charge-receipt-next={farmActivityDigest.rewardStreakChestNextRewardLabel || undefined}
                      role="status"
                      aria-live="polite"
                      title={`${farmActivityChestChargeReceipt}${farmActivityDigest.rewardStreakChestMeterLabel ? ` · ${farmActivityDigest.rewardStreakChestMeterLabel}` : ''}${farmActivityDigest.rewardStreakChestActiveRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestActiveRewardLabel.replace('当前奖励：', '冲 ')}` : ''}${farmActivityDigest.rewardStreakChestNextRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestNextRewardLabel}` : ''}`}
                    >
                      <Sparkles size={9} />
                      <span>{farmActivityChestChargeReceipt}</span>
                      {farmActivityDigest.rewardStreakChestMeterLabel && (
                        <small data-farm-activity-reward-streak-chest-charge-receipt-progress="true">
                          {farmActivityDigest.rewardStreakChestMeterLabel}
                        </small>
                      )}
                      {farmActivityDigest.rewardStreakChestRemainingLabel && (
                        <small data-farm-activity-reward-streak-chest-charge-receipt-remaining="true">
                          {farmActivityDigest.rewardStreakChestRemainingLabel}
                        </small>
                      )}
                      {farmActivityDigest.rewardStreakChestActiveRewardLabel && (
                        <small data-farm-activity-reward-streak-chest-charge-receipt-reward-label="true">
                          {farmActivityDigest.rewardStreakChestActiveRewardLabel.replace('当前奖励：', '冲 ')}
                        </small>
                      )}
                      {farmActivityDigest.rewardStreakChestNextRewardLabel && (
                        <small data-farm-activity-reward-streak-chest-charge-receipt-next-label="true">
                          {farmActivityDigest.rewardStreakChestNextRewardLabel.replace('下一段：', '下段 ').replace('下一轮：', '下轮 ')}
                        </small>
                      )}
                      {farmActivityChestChargeReceipt && farmActivityRewardStreakGoal && (
                        <button
                          type="button"
                          data-farm-activity-reward-streak-chest-charge-receipt-next-action="true"
                          data-farm-activity-reward-streak-chest-charge-receipt-next-action-kind={farmActivityDigest.rewardStreakActionKind || undefined}
                          disabled={farmMiniQuickActionBusy}
                          aria-disabled={farmMiniQuickActionBusy ? 'true' : undefined}
                          title={farmMiniQuickActionBusy
                            ? farmMiniQuickActionFeedback?.label || '稍后继续'
                            : `继续蓄能：${farmActivityRewardStreakGoal.actionLabel}${farmActivityDigest.rewardStreakChestNextRewardLabel ? ` · ${farmActivityDigest.rewardStreakChestNextRewardLabel}` : ''}`}
                          aria-label={farmMiniQuickActionBusy
                            ? farmMiniQuickActionFeedback?.label || '稍后继续'
                            : `继续宝箱蓄能，${farmActivityRewardStreakGoal.actionLabel}${farmActivityDigest.rewardStreakChestNextRewardLabel ? `，${farmActivityDigest.rewardStreakChestNextRewardLabel}` : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFarmActivityChestChargeAction();
                          }}
                        >
                          <Sparkles size={8} />
                          {farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || '稍后继续' : `继续${farmActivityRewardStreakGoal.actionLabel}`}
                        </button>
                      )}
                    </strong>
                  )}
                  {farmActivityDigest.rewardStreakChestState === 'ready' && (
                    <button
                      type="button"
                      data-farm-activity-reward-streak-chest-cta="true"
                      disabled={farmActivityChestClaimed}
                      aria-disabled={farmActivityChestClaimed ? 'true' : undefined}
                      title={farmActivityChestClaimed ? '开箱已入袋' : farmActivityDigest.rewardStreakChestClaimLabel || '开宝箱领取奖励'}
                      aria-label={farmActivityChestClaimed ? '开箱已入袋' : farmActivityDigest.rewardStreakChestClaimLabel || '开宝箱领取奖励'}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFarmActivityChestAction();
                      }}
                    >
                      <Sparkles size={9} />
                      {farmActivityChestClaimed ? '已入袋' : farmActivityDigest.rewardStreakChestCtaLabel || '开宝箱'}
                    </button>
                  )}
                  {farmActivityFocusTarget === 'chest' && (
                    <i
                      key={farmActivityDetailPulseId || 'reward-streak-chest-located'}
                      data-farm-activity-reward-streak-chest-located="true"
                      data-farm-activity-reward-streak-chest-located-label="已定位宝箱"
                      data-farm-activity-reward-streak-chest-located-pulse={farmActivityFocusTarget === 'chest' ? farmActivityDetailPulseId || undefined : undefined}
                      title="今日成果已定位：已定位宝箱"
                    >
                      <Sparkles size={9} />
                      已定位宝箱
                    </i>
                  )}
                  {farmActivityChestClaimed && farmActivityDigest.rewardStreakChestClaimLabel && (
                    <strong
                      data-farm-activity-reward-streak-chest-claim-receipt="true"
                      role="status"
                      aria-live="polite"
                    >
                      {farmActivityDigest.rewardStreakChestClaimLabel}
                    </strong>
                  )}
                  {farmActivityChestClaimed && farmActivityDigest.rewardStreakChestRewardItems?.length && (
                    <span
                      data-farm-activity-reward-streak-chest-reward-items="true"
                      title={farmActivityDigest.rewardStreakChestOpenedSummaryLabel}
                      aria-label={farmActivityDigest.rewardStreakChestOpenedSummaryLabel}
                    >
                      {farmActivityDigest.rewardStreakChestRewardItems.map((item) => (
                        <b key={item} data-farm-activity-reward-streak-chest-reward-item={item}>{item}</b>
                      ))}
                    </span>
                  )}
                  {farmActivityChestClaimed && farmActivityRewardStreakGoal && (
                    <button
                      type="button"
                      data-farm-activity-reward-streak-chest-claim-next-action="true"
                      data-farm-activity-reward-streak-chest-claim-next-action-kind={farmActivityDigest.rewardStreakActionKind || undefined}
                      disabled={farmMiniQuickActionBusy}
                      aria-disabled={farmMiniQuickActionBusy ? 'true' : undefined}
                      title={farmMiniQuickActionBusy
                        ? farmMiniQuickActionFeedback?.label || '继续中'
                        : `下一轮继续：${farmActivityRewardStreakGoal.actionLabel}${farmActivityDigest.rewardStreakChestNextLabel ? ` · ${farmActivityDigest.rewardStreakChestNextLabel}` : ''}`}
                      aria-label={farmMiniQuickActionBusy
                        ? farmMiniQuickActionFeedback?.label || '继续中'
                        : `下一轮继续连击，${farmActivityRewardStreakGoal.actionLabel}${farmActivityDigest.rewardStreakChestNextLabel ? `，${farmActivityDigest.rewardStreakChestNextLabel}` : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFarmActivityRewardStreakAction();
                      }}
                    >
                      <Sparkles size={8} />
                      {farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || '继续中' : `下一轮继续${farmActivityRewardStreakGoal.actionLabel}`}
                    </button>
                  )}
                  {farmActivityChestClaimed && farmActivityRewardStreakActionRouteLabel && (
                    <button
                      type="button"
                      data-farm-activity-reward-streak-chest-route-hint="true"
                      data-farm-activity-reward-streak-chest-route-target={farmActivityRewardStreakActionRouteTarget || undefined}
                      data-farm-activity-reward-streak-chest-route-label={farmActivityRewardStreakActionRouteLabel || undefined}
                      data-farm-activity-reward-streak-chest-route-receipt={farmActivityRewardStreakActionReceiptRouteReceipt || undefined}
                      title={farmActivityRewardStreakActionReceiptRouteReceipt || `地图找${farmActivityRewardStreakActionRouteLabel} · ${farmActivityRewardStreakActionReceiptNextTitle || farmActivityRewardStreakGoal?.actionLabel || '下一步'}`}
                      aria-label={farmActivityRewardStreakActionReceiptRouteReceipt || `地图找${farmActivityRewardStreakActionRouteLabel}，不会执行下一步动作`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFarmActivityRewardStreakRouteHintAction();
                      }}
                    >
                      <Sparkles size={8} />
                      {farmActivityRewardStreakActionReceiptRouteReceipt || `地图找${farmActivityRewardStreakActionRouteLabel}`}
                    </button>
                  )}
                  {farmActivityDigest.rewardStreakChestNextLabel && (
                    <small data-farm-activity-reward-streak-chest-next-label="true">
                      {farmActivityDigest.rewardStreakChestNextLabel}
                    </small>
                  )}
                </small>
              )}
              {farmActivityDigest.rewardStreakMilestoneRewardLabel && (
                <small data-farm-activity-reward-streak-reward="true">{farmActivityDigest.rewardStreakMilestoneRewardLabel}</small>
              )}
              {farmActivityDigest.rewardStreakMilestoneRewardItems?.length && (
                <span
                  ref={farmRewardItemsRef}
                  className="t8-farm-story-panel__activity-streak-reward-items"
                  data-farm-activity-reward-streak-items="true"
                  data-farm-activity-reward-streak-scroll-target="true"
                  data-farm-activity-reward-streak-items-focus={farmRewardDetailPulseId ? 'true' : undefined}
                  data-farm-activity-reward-streak-items-pulse={farmRewardDetailPulseId || undefined}
                  data-farm-activity-reward-streak-items-claimed={farmRewardDetailOpened ? 'true' : undefined}
                  tabIndex={-1}
                  title={`连击奖励印章：${farmActivityDigest.rewardStreakMilestoneRewardItems.join('、')}`}
                  aria-label={`连击奖励印章：${farmActivityDigest.rewardStreakMilestoneRewardItems.join('、')}`}
                  role="status"
                  aria-live="polite"
                >
                  {farmActivityDigest.rewardStreakMilestoneRewardItems.map((item) => (
                    <b key={item}>{item}</b>
                  ))}
                  {farmRewardDetailOpened && (
                    <small
                      className="t8-farm-story-panel__activity-streak-reward-claim"
                      data-farm-activity-reward-streak-claim="true"
                    >
                      奖励已入袋
                    </small>
                  )}
                </span>
              )}
              {farmActivityDigest.rewardStreakActionLabel && (
                <small
                  ref={farmActivityActionRef}
                  data-farm-activity-reward-streak-action="true"
                  data-farm-activity-reward-streak-action-focus={farmActivityFocusTarget === 'action' ? 'true' : undefined}
                  data-farm-activity-reward-streak-action-pulse={farmActivityFocusTarget === 'action' ? farmActivityDetailPulseId || undefined : undefined}
                  tabIndex={-1}
                >
                  {farmActivityDigest.rewardStreakActionLabel}
                </small>
              )}
              {farmActivityRewardStreakGoal && (
                <button
                  type="button"
                  data-farm-activity-reward-streak-action-cta="true"
                  data-farm-activity-reward-streak-action-cta-kind={farmActivityDigest.rewardStreakActionKind || undefined}
                  disabled={farmMiniQuickActionBusy}
                  aria-disabled={farmMiniQuickActionBusy ? 'true' : undefined}
                  title={farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || '已执行建议' : `执行连击建议：${farmActivityRewardStreakGoal.actionLabel}`}
                  aria-label={farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || '已执行建议' : `执行连击建议：${farmActivityRewardStreakGoal.actionLabel}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFarmActivityRewardStreakAction();
                  }}
                >
                  <Sparkles size={10} />
                  <b>{farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || '已执行建议' : farmActivityRewardStreakGoal.actionLabel}</b>
                </button>
              )}
              {farmActivityRewardStreakActionReceipt && (
                <em
                  className="t8-farm-story-panel__activity-action-receipt"
                  data-farm-activity-reward-streak-action-receipt="true"
                  data-farm-activity-reward-streak-action-receipt-kind={farmActivityDigest.rewardStreakActionKind || undefined}
                  data-farm-activity-reward-streak-action-receipt-followup={farmActivityRewardStreakActionReceiptFollowupLabel || undefined}
                  role="status"
                  aria-live="polite"
                  title={farmActivityRewardStreakActionReceiptFollowupLabel ? `${farmActivityRewardStreakActionReceipt} · ${farmActivityRewardStreakActionReceiptFollowupLabel}` : farmActivityRewardStreakActionReceipt}
                >
                  <Sparkles size={9} />
                  建议已执行
                  <b>{farmActivityRewardStreakActionReceipt}</b>
                  {farmActivityRewardStreakActionReceiptFollowupLabel && (
                    <small
                      data-farm-activity-reward-streak-action-receipt-followup-label="true"
                      title={`收纳后续行动：${farmActivityRewardStreakActionReceiptFollowup}`}
                      aria-hidden="true"
                    >
                      {farmActivityRewardStreakActionReceiptFollowupLabel}
                    </small>
                  )}
                  <small data-farm-activity-reward-streak-action-receipt-next="true">
                    {farmActivityDigest.rewardStreakMilestoneProgressLabel || farmActivityDigest.rewardStreakMilestoneLabel || '继续连击'}
                  </small>
                </em>
              )}
              <div
                className="t8-farm-story-panel__activity-meter"
                data-farm-activity-followup-receipt={farmActivityRewardStreakActionReceiptEchoLabel || undefined}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={farmActivityDigest.target}
                aria-valuenow={Math.min(farmActivityDigest.todayTotal, farmActivityDigest.target)}
                title={farmActivityRewardStreakActionReceiptEchoLabel ? `${farmActivityRewardStreakActionReceiptEchoLabel} · ${farmActivityDigest.percent}%` : `${farmActivityDigest.percent}%`}
              >
                <i style={{ width: `${farmActivityDigest.percent}%` }} />
              </div>
              <div className="t8-farm-story-panel__activity-digest-foot">
                <small>{farmActivityDigest.nextHint}</small>
                {farmActivityDigest.chips.length > 0 && (
                  <span className="t8-farm-story-panel__activity-chips">
                    {farmActivityDigest.chips.map((chip) => (
                      <b key={chip.id} data-farm-activity-chip={chip.id} data-farm-activity-tone={chip.tone}>
                        {chip.label} x{chip.count}
                      </b>
                    ))}
                  </span>
                )}
              </div>
            </div>
            {farmActivityFeed.items.length > 0 ? (
              <ul>
                {farmActivityFeed.items.map((item) => (
                  <li
                    key={item.id}
                    data-farm-event-kind={item.kind}
                    data-farm-activity-kind={item.kind}
                    data-farm-activity-tone={item.tone}
                  >
                    <span className="t8-farm-story-panel__activity-tag">{item.tagLabel}</span>
                    <div className="t8-farm-story-panel__activity-copy">
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                      {item.rewardLabel && <em data-farm-activity-reward-label="true">{item.rewardLabel}</em>}
                    </div>
                    {item.amountLabel && <b>{item.amountLabel}</b>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="t8-farm-story-panel__activity-empty" data-farm-activity-empty="true">
                <span>{farmActivityFeed.emptyHint}</span>
                {primaryFarmFocus && (
                  <strong
                    data-farm-activity-empty-focus="true"
                    data-farm-activity-empty-focus-kind={primaryFarmFocus.kind}
                    data-farm-activity-empty-focus-kind-label={farmFocusGoalKindLabel(primaryFarmFocus.kind)}
                    data-farm-activity-empty-focus-label={primaryFarmFocus.title}
                    data-farm-activity-empty-focus-status={primaryFarmFocusStatusLabel}
                    data-farm-activity-empty-focus-ready={primaryFarmFocusReady ? 'true' : undefined}
                    data-farm-activity-empty-focus-complete={primaryFarmFocusComplete ? 'true' : undefined}
                    data-farm-activity-empty-focus-action-linked={farmMiniQuickActionBusy ? 'true' : undefined}
                    data-farm-activity-empty-focus-action-result={farmMiniQuickActionFeedback?.label || undefined}
                    data-farm-activity-empty-focus-progress={`${primaryFarmFocus.progress}/${primaryFarmFocus.target}`}
                    title={`当前小目标：${primaryFarmFocus.title} · ${primaryFarmFocus.progress}/${primaryFarmFocus.target} · ${primaryFarmFocusStatusLabel}`}
                    aria-label={`当前小目标：${primaryFarmFocus.title}，${primaryFarmFocus.progress}/${primaryFarmFocus.target}，${primaryFarmFocusStatusLabel}`}
                  >
                    <Flag size={10} />
                    <span>{primaryFarmFocus.title}</span>
                    <i data-farm-activity-empty-focus-kind-chip="true">{farmFocusGoalKindLabel(primaryFarmFocus.kind)}</i>
                    <small>{primaryFarmFocus.progress}/{primaryFarmFocus.target}</small>
                    <em data-farm-activity-empty-focus-status-chip="true">{primaryFarmFocusStatusLabel}</em>
                  </strong>
                )}
                {primaryFarmFocus && primaryFarmFocusForecastItems.length > 0 && (
                  <div
                    className="t8-farm-story-panel__activity-empty-forecast"
                    data-farm-activity-empty-forecast="true"
                    data-farm-activity-empty-forecast-count={primaryFarmFocusForecastItems.length}
                    data-farm-activity-empty-forecast-linked={farmMiniQuickActionBusy ? 'true' : undefined}
                    data-farm-activity-empty-forecast-result={farmMiniQuickActionFeedback?.label || undefined}
                    data-farm-activity-empty-forecast-busy-label={farmActivityEmptyForecastBusyLabel || undefined}
                    data-farm-activity-empty-forecast-busy-meta={farmActivityEmptyForecastBusyMetaLabel || undefined}
                    data-farm-activity-empty-forecast-busy-progress-state={farmActivityEmptyForecastBusyMetaLabel ? farmActivityEmptyForecastReceiptProgressState : undefined}
                    data-farm-activity-empty-forecast-busy-progress-label={farmActivityEmptyForecastBusyMetaLabel ? farmActivityEmptyForecastReceiptProgressStateLabel || undefined : undefined}
                    title={farmActivityEmptyForecastTitle}
                    aria-label={farmActivityEmptyForecastAriaLabel}
                  >
                    {primaryFarmFocusForecastItems.map((item) => (
                      item.actionable ? (
                        <button
                          key={item.id}
                          type="button"
                          data-farm-activity-empty-forecast-item={item.id}
                          data-farm-activity-empty-forecast-tone={item.tone}
                          data-farm-activity-empty-forecast-actionable="true"
                          data-farm-activity-empty-forecast-busy={farmMiniQuickActionBusy ? 'true' : undefined}
                          data-farm-activity-empty-forecast-busy-label={farmMiniQuickActionBusy ? farmMiniQuickActionFeedback?.label || item.label : undefined}
                          data-farm-activity-empty-forecast-action-progress-state={primaryFarmFocusProgressPreview ? farmActivityEmptyForecastReceiptProgressState : undefined}
                          data-farm-activity-empty-forecast-action-progress-label={primaryFarmFocusProgressPreview ? farmActivityEmptyForecastReceiptProgressStateLabel || undefined : undefined}
                          disabled={farmMiniQuickActionBusy}
                          aria-label={farmMiniQuickActionBusy
                            ? `正在执行最近农活预期动作：${farmMiniQuickActionFeedback?.label || item.label}${farmActivityEmptyForecastActionProgressAriaSuffix}`
                            : `执行最近农活预期动作：${item.label}${farmActivityEmptyForecastActionProgressAriaSuffix}`}
                          title={farmMiniQuickActionBusy
                            ? `正在执行：${farmMiniQuickActionFeedback?.label || item.label}${farmActivityEmptyForecastActionProgressTitleSuffix}`
                            : `${item.label}${farmActivityEmptyForecastActionProgressTitleSuffix}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleFarmFocusAction(primaryFarmFocus);
                          }}
                        >
                          {item.label}
                          {primaryFarmFocusProgressPreview && (
                            <i
                              data-farm-activity-empty-forecast-action-progress-value="true"
                              data-farm-activity-empty-forecast-action-progress-value-label={farmActivityEmptyForecastReceiptProgressStateLabel || undefined}
                              data-farm-activity-empty-forecast-action-progress-value-title={farmActivityEmptyForecastActionProgressValueTitle || undefined}
                              title={farmActivityEmptyForecastActionProgressValueTitle}
                              aria-hidden="true"
                            >
                              {primaryFarmFocusProgressPreview}
                            </i>
                          )}
                        </button>
                      ) : (
                        <small
                          key={item.id}
                          data-farm-activity-empty-forecast-item={item.id}
                          data-farm-activity-empty-forecast-tone={item.tone}
                          title={`小目标预期：${item.label}`}
                        >
                          {item.label}
                        </small>
                      )
                    ))}
                      {farmMiniQuickActionBusy && (
                        <em
                          data-farm-activity-empty-forecast-receipt="true"
                          data-farm-activity-empty-forecast-receipt-label={farmActivityEmptyForecastReceiptLabel}
                          role="status"
                          aria-live="polite"
                          title={farmActivityEmptyForecastReceiptTitle}
                          aria-label={farmActivityEmptyForecastReceiptTitle}
                        >
                          预期已确认
                          <b data-farm-activity-empty-forecast-receipt-result="true">{farmActivityEmptyForecastReceiptLabel}</b>
                          {farmActivityEmptyForecastReceiptDetails.length > 0 && (
                            <span data-farm-activity-empty-forecast-receipt-chips="true" aria-hidden="true">
                              {farmMiniQuickActionResourceFeedbackLabel && (
                                <small data-farm-activity-empty-forecast-receipt-chip="resource">资源 {farmMiniQuickActionResourceFeedbackLabel}</small>
                              )}
                              {farmMiniQuickActionActivityFeedbackLabel && (
                                <small data-farm-activity-empty-forecast-receipt-chip="activity">今日 {farmMiniQuickActionActivityFeedbackLabel}</small>
                              )}
                              {farmActivityEmptyForecastReceiptNextAccessibleTypeLabel && (
                                <small
                                  data-farm-activity-empty-forecast-receipt-chip="next-type"
                                  data-farm-activity-empty-forecast-receipt-next-type-target={farmActivityEmptyForecastReceiptNextTarget}
                                  data-farm-activity-empty-forecast-receipt-next-type-label={farmActivityEmptyForecastReceiptNextTargetLabel || undefined}
                                  data-farm-activity-empty-forecast-receipt-next-type-title={farmActivityEmptyForecastReceiptNextTypeTitle || undefined}
                                  title={farmActivityEmptyForecastReceiptNextTypeTitle}
                                >
                                  {farmActivityEmptyForecastReceiptNextAccessibleTypeLabel}
                                  {farmActivityEmptyForecastReceiptNextCountLabel && (
                                    <i
                                      data-farm-activity-empty-forecast-receipt-next-type-count="true"
                                      data-farm-activity-empty-forecast-receipt-next-type-count-target={farmActivityEmptyForecastReceiptNextTarget}
                                      data-farm-activity-empty-forecast-receipt-next-type-count-target-label={farmActivityEmptyForecastReceiptNextTargetLabel || undefined}
                                      data-farm-activity-empty-forecast-receipt-next-type-count-label={farmActivityEmptyForecastReceiptNextCountLabel}
                                      data-farm-activity-empty-forecast-receipt-next-type-count-next={farmActivityEmptyForecastReceiptNextHint || undefined}
                                      data-farm-activity-empty-forecast-receipt-next-type-count-title={farmActivityEmptyForecastReceiptNextTypeCountTitle || undefined}
                                      title={farmActivityEmptyForecastReceiptNextTypeCountTitle}
                                    >
                                      {farmActivityEmptyForecastReceiptNextCountLabel}
                                    </i>
                                  )}
                                </small>
                              )}
                              {primaryFarmFocusProgressPreview && (
                                <small
                                  data-farm-activity-empty-forecast-receipt-chip="progress"
                                  data-farm-activity-empty-forecast-receipt-progress-state={farmActivityEmptyForecastReceiptProgressState}
                                  data-farm-activity-empty-forecast-receipt-progress-state-label={farmActivityEmptyForecastReceiptProgressStateLabel || undefined}
                                >
                                  {farmActivityEmptyForecastReceiptProgressStateLabel && (
                                    <i data-farm-activity-empty-forecast-receipt-progress-state-label="true">
                                      {farmActivityEmptyForecastReceiptProgressStateLabel}
                                    </i>
                                  )}
                                  <span data-farm-activity-empty-forecast-receipt-progress-value="true">进度 {primaryFarmFocusProgressPreview}</span>
                                </small>
                              )}
                            </span>
                          )}
                          {farmActivityEmptyForecastReceiptNextHint && (
                            <small
                              data-farm-activity-empty-forecast-receipt-next="true"
                              data-farm-activity-empty-forecast-receipt-next-target={farmActivityEmptyForecastReceiptNextTarget}
                              title={farmActivityEmptyForecastReceiptNextAccessibleHint}
                              aria-hidden="true"
                            >
                              {farmActivityEmptyForecastReceiptNextBadgeLabel && (
                                <i
                                  data-farm-activity-empty-forecast-receipt-next-badge="true"
                                  data-farm-activity-empty-forecast-receipt-next-badge-target={farmActivityEmptyForecastReceiptNextTarget}
                                  data-farm-activity-empty-forecast-receipt-next-badge-label={farmActivityEmptyForecastReceiptNextBadgeLabel}
                                  title={farmActivityEmptyForecastReceiptNextBadgeTitle}
                                >
                                  {farmActivityEmptyForecastReceiptNextBadgeLabel}
                                </i>
                              )}
                              {farmActivityEmptyForecastReceiptNextCountLabel && (
                                <i
                                  data-farm-activity-empty-forecast-receipt-next-count="true"
                                  data-farm-activity-empty-forecast-receipt-next-count-target={farmActivityEmptyForecastReceiptNextTarget}
                                  data-farm-activity-empty-forecast-receipt-next-count-label={farmActivityEmptyForecastReceiptNextCountLabel}
                                  title={farmActivityEmptyForecastReceiptNextCountTitle}
                                >
                                  {farmActivityEmptyForecastReceiptNextCountLabel}
                                </i>
                              )}
                                  <span
                                    data-farm-activity-empty-forecast-receipt-next-copy="true"
                                    data-farm-activity-empty-forecast-receipt-next-copy-target={farmActivityEmptyForecastReceiptNextTarget}
                                    data-farm-activity-empty-forecast-receipt-next-copy-target-label={farmActivityEmptyForecastReceiptNextTargetLabel || undefined}
                                    data-farm-activity-empty-forecast-receipt-next-copy-label={farmActivityEmptyForecastReceiptNextHint}
                                    title={farmActivityEmptyForecastReceiptNextCopyTitle}
                                  >
                                {farmActivityEmptyForecastReceiptNextHint}
                              </span>
                            </small>
                          )}
                        </em>
                      )}
                  </div>
                )}
                {primaryFarmFocus && (
                  <button
                    type="button"
                    data-farm-activity-empty-action="true"
                    data-farm-activity-empty-action-kind={primaryFarmFocus.action.kind}
                    data-farm-activity-empty-action-label={primaryFarmFocus.actionLabel}
                    data-farm-activity-empty-action-fired={farmMiniQuickActionBusy ? 'true' : undefined}
                    data-farm-activity-empty-action-busy={farmMiniQuickActionBusy ? 'true' : undefined}
                    data-farm-activity-empty-action-result={farmMiniQuickActionFeedback?.label || undefined}
                    data-farm-activity-empty-action-resource-targets={primaryFarmFocusActionResourceTargets.join(' ') || undefined}
                    data-farm-activity-empty-action-resource-preview={primaryFarmFocusActionResourcePreview || undefined}
                    data-farm-activity-empty-action-progress-preview={primaryFarmFocusProgressPreview || undefined}
                    disabled={farmMiniQuickActionBusy}
                    aria-disabled={farmMiniQuickActionBusy ? 'true' : undefined}
                    title={`没有农活记录，先执行：${primaryFarmFocus.actionLabel}${primaryFarmFocusActionResourcePreview ? ` · ${primaryFarmFocusActionResourcePreview}` : ''}`}
                    aria-label={`没有农活记录，先执行今日小目标：${primaryFarmFocus.actionLabel}${primaryFarmFocusActionResourcePreview ? `，${primaryFarmFocusActionResourcePreview}` : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFarmFocusAction(primaryFarmFocus);
                    }}
                  >
                    {farmMiniQuickActionBusy ? <MiniQuickActionIcon size={10} /> : <Sparkles size={10} />}
                    <b>{farmMiniQuickActionBusy ? `已执行：${farmMiniQuickActionFeedback?.label || primaryFarmFocus.actionLabel}` : `先做：${primaryFarmFocus.actionLabel}`}</b>
                    {primaryFarmFocusActionResourcePreview && (
                      <small data-farm-activity-empty-action-resource="true">{primaryFarmFocusActionResourcePreview}</small>
                    )}
                    {primaryFarmFocusProgressPreview && (
                      <small data-farm-activity-empty-action-progress="true">{primaryFarmFocusProgressPreview}</small>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
          <div
            ref={farmActionsRef}
            className="t8-farm-story-panel__footer"
            data-farm-panel-priority-content={farmPrioritySectionReceipt === 'actions' ? 'true' : undefined}
            tabIndex={-1}
          >
            <button
              type="button"
              disabled={matureCount === 0}
              aria-disabled={matureCount === 0}
              title={matureCount > 0 ? '跳转到下一个成熟作物' : '当前没有成熟作物'}
              onClick={(event) => {
                event.stopPropagation();
                onJumpToMature?.();
              }}
            >
              成熟 {matureCount}
            </button>
            <button
              type="button"
              title={editing ? '退出牧场编辑' : '进入牧场编辑'}
              aria-pressed={editing}
              onClick={(event) => {
                event.stopPropagation();
                onToggleEditing?.(!editing);
              }}
            >
              {editing ? '退出编辑' : '进入编辑'}
            </button>
            <button
              type="button"
              title="推进到下一天"
              onClick={(event) => {
                event.stopPropagation();
                onAdvanceDay?.();
              }}
            >
              过一天
            </button>
            <button
              type="button"
              disabled={!orderReady || farmOrderStampActive}
              aria-disabled={!orderReady || farmOrderStampActive}
              data-farm-order-stamp-active={farmOrderStampActive ? 'true' : undefined}
              data-farm-order-button-festival-link={currentOrderFestivalLinkLabel || undefined}
              data-farm-order-button-festival-completes={currentOrderFestivalCompletes ? 'true' : undefined}
              data-farm-order-button-festival-reward={currentOrderFestivalRewardLabel || undefined}
              title={farmOrderSubmitTitle}
              onClick={(event) => {
                event.stopPropagation();
                if (currentOrder && !farmOrderStampActive) {
                  handleFarmCompleteCurrentOrder();
                }
              }}
            >
              {farmOrderSubmitLabel}
            </button>
          </div>
          </div>
        </section>
      )}
    </div>
  );
}

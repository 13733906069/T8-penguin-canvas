import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useReactFlow, ViewportPortal } from '@xyflow/react';
import type { FarmCanvasObject, FarmCanvasState, FarmCropId, FarmCropStage, FarmTool } from '../types/canvas';
import {
  FARM_BUILDING_DEFINITIONS,
  FARM_CROP_DEFINITIONS,
  FARM_DEFAULT_DECOR_ID,
  FARM_DECOR_DEFINITIONS,
  FARM_SCARECROW_RADIUS_CELLS,
  FARM_VIEWPORT_RENDER_MARGIN,
  farmToolActionGridKey,
  farmToolSupportsContinuousAction,
  getFarmObjectsInViewport,
  isFarmPlotNeedingScarecrowProtection,
  previewFarmPlacement,
  snapFarmPoint,
  type FarmPlacementPreview,
  type FarmToolAction,
} from '../utils/farmCanvas';

interface FarmCanvasLayerProps {
  farmCanvas: FarmCanvasState;
  editing: boolean;
  visualStyle: string;
  resourceDecorItems?: FarmCanvasResourceDecorItem[];
  viewportMoving?: boolean;
  nodeDragging?: boolean;
  feedbacks?: FarmCanvasFloatingFeedback[];
  highlightedObjectId?: string | null;
  onAction: (action: FarmToolAction) => void;
  onCancelContinuousAction?: (reason: 'escape' | 'contextmenu' | 'blur') => void;
  onFinishContinuousAction?: () => void;
}

interface FarmCanvasResourceDecorItem {
  id: string;
  title?: string;
  fileUrl?: string;
  thumbUrl?: string;
}

export interface FarmCanvasFloatingFeedback {
  id: string;
  x: number;
  y: number;
  message: string;
  tone: 'success' | 'water' | 'reward' | 'build' | 'warning';
  placement?: 'above' | 'below';
}

interface FarmContinuousActionSession {
  pointerId: number;
  tool: FarmTool;
  seenGridKeys: Set<string>;
}

type FarmCanvasConnectionKind = 'path' | 'fence';
type FarmToolGhostTool = Exclude<FarmTool, 'select' | 'build' | 'decor'>;
type FarmToolGhostStatus = 'ready' | 'target' | 'blocked' | 'invalid';

interface FarmCanvasObjectConnection {
  kind: FarmCanvasConnectionKind;
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

interface FarmToolGhostPreview {
  tool: FarmToolGhostTool;
  x: number;
  y: number;
  width: number;
  height: number;
  status: FarmToolGhostStatus;
  label: string;
  detail: string;
  targetStatus?: string;
  objectId?: string;
  cropId?: FarmCropId;
}

const FARM_CANVAS_EXCLUSION_SELECTOR = [
  '.react-flow__node',
  '.react-flow__handle',
  '.react-flow__edge',
  '.react-flow__controls',
  '.react-flow__minimap',
  'input',
  'textarea',
  'select',
  'button',
  '[contenteditable="true"]',
  '[data-canvas-floating-ui]',
  '[data-creative-desk-action]',
  '.t8-context-menu',
  '.t8-toolbar',
  '.t8-control-rail',
].join(',');

function getObjectLabel(object: FarmCanvasObject) {
  if (object.kind === 'plot') {
    if (!object.crop) return '已开垦土地';
    const crop = FARM_CROP_DEFINITIONS[object.crop.cropId];
    return crop ? `${crop.label} · ${farmCropStageLabel(object.crop.stage)}` : '作物地块';
  }
  if (object.kind === 'building') return FARM_BUILDING_DEFINITIONS[object.buildingId || '']?.label || object.buildingId || '建筑';
  if (object.kind === 'decor') return FARM_DECOR_DEFINITIONS[object.decorId || '']?.label || object.decorId || '装饰';
  if (object.kind === 'path') return '道路';
  return '障碍物';
}

function farmCropStageLabel(stage?: FarmCropStage) {
  if (stage === 'seed') return '种子';
  if (stage === 'sprout') return '发芽';
  if (stage === 'growing') return '成长中';
  if (stage === 'flowering') return '开花';
  if (stage === 'mature') return '成熟';
  if (stage === 'withered') return '枯萎';
  return '空地';
}

function farmObjectStatusKey(object: FarmCanvasObject, hasResourceImage = false) {
  if (object.kind === 'plot') {
    if (!object.crop) return 'empty-plot';
    if (object.crop.stage === 'mature') return 'mature';
    if (object.crop.stage === 'withered') return 'withered';
    return object.crop.wateredToday ? 'watered' : 'dry';
  }
  if (object.kind === 'building') return 'building-active';
  if (object.kind === 'decor' && object.resourceId && !hasResourceImage) return 'resource-missing';
  if (object.kind === 'decor') return 'decor-active';
  if (object.kind === 'path') return 'path-active';
  return 'neutral';
}

function farmObjectStatusLabel(object: FarmCanvasObject, resourceDecor?: FarmCanvasResourceDecorItem, hasResourceImage = false) {
  if (object.kind === 'plot') {
    if (!object.crop) return '可播种';
    if (object.crop.stage === 'mature') return '可收获';
    if (object.crop.stage === 'withered') return '可铲除';
    return object.crop.wateredToday ? '今日已浇水' : '待浇水';
  }
  if (object.kind === 'building') {
    const building = FARM_BUILDING_DEFINITIONS[object.buildingId || ''];
    return building?.description || '功能已启用';
  }
  if (object.kind === 'decor' && object.resourceId) {
    if (!hasResourceImage) return '资源待刷新';
    return resourceDecor?.title ? `资源装饰 · ${resourceDecor.title}` : '资源装饰已展示';
  }
  if (object.kind === 'decor') {
    const decor = FARM_DECOR_DEFINITIONS[object.decorId || ''];
    return decor?.description || '装饰已生效';
  }
  if (object.kind === 'path') return '路线已铺好';
  return '可清理';
}

function farmObjectPlacementReceiptLabel(object: FarmCanvasObject, highlightedObjectId?: string | null) {
  if (highlightedObjectId !== object.id) return '';
  if (object.kind === 'building') return '落成';
  if (object.kind === 'decor') return '布置';
  return '';
}

function cssImageUrl(value: string) {
  return `url("${value.replace(/\\/g, '/').replace(/"/g, '%22')}")`;
}

function farmObjectConnectionKind(object: FarmCanvasObject): FarmCanvasConnectionKind | null {
  if (object.kind === 'path') return 'path';
  if (object.kind !== 'decor') return null;
  const definition = FARM_DECOR_DEFINITIONS[object.decorId || ''];
  if (object.objectType === 'tile' || definition?.category === 'path') return 'path';
  if (definition?.category === 'fence') return 'fence';
  return null;
}

function farmObjectCellKeys(object: FarmCanvasObject, gridSize: number) {
  const keys: string[] = [];
  const width = Math.max(1, Math.round(object.widthCells || 1));
  const height = Math.max(1, Math.round(object.heightCells || 1));
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      keys.push(`${object.x + x * gridSize}:${object.y + y * gridSize}`);
    }
  }
  return keys;
}

function buildFarmObjectConnectionMap(objects: FarmCanvasObject[], gridSize: number) {
  const cellKinds = new Map<string, Set<FarmCanvasConnectionKind>>();
  objects.forEach((object) => {
    const kind = farmObjectConnectionKind(object);
    if (!kind) return;
    farmObjectCellKeys(object, gridSize).forEach((key) => {
      const kinds = cellKinds.get(key) || new Set<FarmCanvasConnectionKind>();
      kinds.add(kind);
      cellKinds.set(key, kinds);
    });
  });
  return cellKinds;
}

function farmCellHasConnection(
  cellKinds: Map<string, Set<FarmCanvasConnectionKind>>,
  kind: FarmCanvasConnectionKind,
  x: number,
  y: number,
) {
  return Boolean(cellKinds.get(`${x}:${y}`)?.has(kind));
}

function farmObjectConnection(
  object: FarmCanvasObject,
  cellKinds: Map<string, Set<FarmCanvasConnectionKind>>,
  gridSize: number,
): FarmCanvasObjectConnection | null {
  const kind = farmObjectConnectionKind(object);
  if (!kind) return null;
  const width = Math.max(1, Math.round(object.widthCells || 1));
  const height = Math.max(1, Math.round(object.heightCells || 1));
  let north = false;
  let east = false;
  let south = false;
  let west = false;
  for (let x = 0; x < width; x += 1) {
    north ||= farmCellHasConnection(cellKinds, kind, object.x + x * gridSize, object.y - gridSize);
    south ||= farmCellHasConnection(cellKinds, kind, object.x + x * gridSize, object.y + height * gridSize);
  }
  for (let y = 0; y < height; y += 1) {
    west ||= farmCellHasConnection(cellKinds, kind, object.x - gridSize, object.y + y * gridSize);
    east ||= farmCellHasConnection(cellKinds, kind, object.x + width * gridSize, object.y + y * gridSize);
  }
  return { kind, north, east, south, west };
}

function objectConnectionClassName(connection: FarmCanvasObjectConnection | null) {
  if (!connection) return '';
  return [
    ` is-connect-${connection.kind}`,
    connection.north ? ' is-connect-n' : '',
    connection.east ? ' is-connect-e' : '',
    connection.south ? ' is-connect-s' : '',
    connection.west ? ' is-connect-w' : '',
  ].join('');
}

function farmPlacementStatusLabel(status: FarmPlacementPreview['status']) {
  if (status === 'ready') return '可放置';
  if (status === 'blocked') return '有阻挡';
  if (status === 'insufficient-resources') return '资源不足';
  return '不可用';
}

function farmPlacementStatusIcon(status: FarmPlacementPreview['status']) {
  if (status === 'ready') return '可';
  if (status === 'blocked') return '挡';
  if (status === 'insufficient-resources') return '缺';
  return '!';
}

function farmPlacementShowsScarecrowCoverage(preview: FarmPlacementPreview) {
  return preview.kind === 'building' && preview.buildingId === 'scarecrow';
}

function farmPlacementInlineStyle(preview: FarmPlacementPreview, gridSize: number) {
  const style: CSSProperties & { '--farm-scarecrow-range-size'?: string } = {
    left: preview.x,
    top: preview.y,
    width: preview.width,
    height: preview.height,
  };
  if (farmPlacementShowsScarecrowCoverage(preview)) {
    style['--farm-scarecrow-range-size'] = `${FARM_SCARECROW_RADIUS_CELLS * gridSize * 2}px`;
  }
  return style;
}

function isFarmToolGhostTool(tool: FarmTool): tool is FarmToolGhostTool {
  return tool !== 'select' && tool !== 'build' && tool !== 'decor';
}

function farmToolGhostLabel(tool: FarmToolGhostTool) {
  if (tool === 'hoe') return '锄地预览';
  if (tool === 'seed') return '播种预览';
  if (tool === 'water') return '浇水预览';
  if (tool === 'harvest') return '收获预览';
  if (tool === 'shovel') return '铲除预览';
  if (tool === 'delete') return '拆除预览';
  return '移动预览';
}

function farmToolGhostIcon(tool: FarmToolGhostTool) {
  if (tool === 'hoe') return '锄';
  if (tool === 'seed') return '种';
  if (tool === 'water') return '水';
  if (tool === 'harvest') return '收';
  if (tool === 'shovel') return '铲';
  if (tool === 'delete') return '拆';
  return '移';
}

function farmToolGhostRect(object: FarmCanvasObject, gridSize: number) {
  return {
    x: object.x,
    y: object.y,
    width: Math.max(1, object.widthCells || 1) * gridSize,
    height: Math.max(1, object.heightCells || 1) * gridSize,
  };
}

function farmToolGhostRectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function findFarmToolGhostTarget(objects: FarmCanvasObject[], x: number, y: number, gridSize: number) {
  return objects.find((object) => {
    const rect = farmToolGhostRect(object, gridSize);
    return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
  });
}

function findFarmToolGhostAreaBlocker(
  objects: FarmCanvasObject[],
  candidate: { x: number; y: number; width: number; height: number },
  gridSize: number,
  ignoreId?: string,
) {
  return objects.find((object) => {
    if (object.id === ignoreId || object.kind === 'path') return false;
    return farmToolGhostRectsOverlap(candidate, farmToolGhostRect(object, gridSize));
  });
}

function cropLabel(cropId?: FarmCropId) {
  return cropId ? (FARM_CROP_DEFINITIONS[cropId]?.label || cropId) : '作物';
}

function buildFarmToolGhostPreview(
  farmCanvas: FarmCanvasState,
  tool: FarmToolGhostTool,
  x: number,
  y: number,
): FarmToolGhostPreview {
  const gridSize = farmCanvas.gridSize || 64;
  const point = snapFarmPoint({ x, y }, gridSize);
  const target = findFarmToolGhostTarget(farmCanvas.objects, point.x, point.y, gridSize);
  const targetStatus = target ? farmObjectStatusKey(target) : undefined;
  const selectedObject = farmCanvas.selectedObjectId
    ? farmCanvas.objects.find((object) => object.id === farmCanvas.selectedObjectId)
    : undefined;
  const previewObject = tool === 'shovel' || tool === 'delete' || (tool === 'move' && !selectedObject)
    ? target
    : undefined;
  const widthCells = tool === 'move' && selectedObject
    ? Math.max(1, selectedObject.widthCells || 1)
    : Math.max(1, previewObject?.widthCells || 1);
  const heightCells = tool === 'move' && selectedObject
    ? Math.max(1, selectedObject.heightCells || 1)
    : Math.max(1, previewObject?.heightCells || 1);
  const base: FarmToolGhostPreview = {
    tool,
    x: previewObject ? previewObject.x : point.x,
    y: previewObject ? previewObject.y : point.y,
    width: widthCells * gridSize,
    height: heightCells * gridSize,
    status: 'invalid',
    label: farmToolGhostLabel(tool),
    detail: '选择一个牧场落点',
    targetStatus,
    objectId: target?.id,
    cropId: target?.crop?.cropId,
  };

  if (tool === 'hoe') {
    if (!target) return { ...base, status: 'ready', detail: '可开垦这格土地' };
    if (target.kind === 'plot') return { ...base, status: 'target', detail: '这里已经开垦过' };
    return { ...base, status: 'blocked', detail: `${getObjectLabel(target)} 挡住了这格` };
  }

  if (tool === 'seed') {
    const cropId: FarmCropId = 'turnip';
    const seedCount = farmCanvas.resources.seeds[cropId] || 0;
    const detailSuffix = `${cropLabel(cropId)} · 剩余 ${seedCount}`;
    if (!target || target.kind !== 'plot') return { ...base, status: 'invalid', detail: '需要先开垦土地', cropId };
    if (target.crop) return { ...base, status: 'target', detail: `已有 ${cropLabel(target.crop.cropId)}，不能重复播种`, cropId };
    if (seedCount <= 0) return { ...base, status: 'invalid', detail: `${cropLabel(cropId)}种子不足`, cropId };
    return { ...base, status: 'ready', detail: `可播种 ${detailSuffix}`, cropId };
  }

  if (tool === 'water') {
    if (!target || target.kind !== 'plot' || !target.crop) {
      return { ...base, status: 'invalid', detail: '这里没有可浇水作物' };
    }
    if (target.crop.stage === 'withered') return { ...base, status: 'target', detail: '枯萎作物需要铲除' };
    if (target.crop.wateredToday) return { ...base, status: 'target', detail: '今日已浇水' };
    if (farmCanvas.resources.water <= 0) return { ...base, status: 'invalid', detail: '水量不足' };
    return { ...base, status: 'ready', detail: `可浇水 · 水量 ${farmCanvas.resources.water}` };
  }

  if (tool === 'harvest') {
    if (!target || target.kind !== 'plot' || !target.crop) return { ...base, status: 'invalid', detail: '这里没有可收获作物' };
    if (target.crop.stage !== 'mature') return { ...base, status: 'target', detail: `${cropLabel(target.crop.cropId)}还没成熟` };
    return { ...base, status: 'ready', detail: `可收获 ${cropLabel(target.crop.cropId)}` };
  }

  if (tool === 'shovel' || tool === 'delete') {
    if (!target) return { ...base, status: 'invalid', detail: '这里没有可清理物件' };
    return { ...base, status: 'ready', detail: `${tool === 'delete' ? '可拆除' : '可铲除'} ${getObjectLabel(target)}` };
  }

  if (tool === 'move') {
    if (!selectedObject) {
      if (!target) return { ...base, status: 'invalid', detail: '先点一个牧场物件' };
      return { ...base, status: 'target', detail: `点击选中 ${getObjectLabel(target)}` };
    }
    const candidate = { x: point.x, y: point.y, width: widthCells * gridSize, height: heightCells * gridSize };
    const blocker = findFarmToolGhostAreaBlocker(farmCanvas.objects, candidate, gridSize, selectedObject.id);
    if (blocker) {
      return {
        ...base,
        status: 'blocked',
        detail: `目标被 ${getObjectLabel(blocker)} 占用`,
        objectId: blocker.id,
        targetStatus: farmObjectStatusKey(blocker),
      };
    }
    return { ...base, status: 'ready', detail: `移动 ${getObjectLabel(selectedObject)} 到这里`, objectId: selectedObject.id };
  }

  return base;
}

function objectClassName(
  object: FarmCanvasObject,
  selectedObjectId?: string,
  hasResourceImage = false,
  highlightedObjectId?: string | null,
  connection?: FarmCanvasObjectConnection | null,
) {
  const stage = object.crop?.stage ? ` is-stage-${object.crop.stage}` : '';
  const watered = object.crop?.wateredToday ? ' is-watered' : '';
  const selected = selectedObjectId === object.id ? ' is-selected' : '';
  const highlighted = highlightedObjectId === object.id ? ' is-jump-highlight' : '';
  const type = object.kind === 'building' && object.buildingId
    ? ` is-building-${object.buildingId}`
    : object.kind === 'decor' && object.decorId
      ? ` is-decor-${object.decorId}`
      : '';
  const resourceDecor = object.kind === 'decor' && object.resourceId
    ? ` is-resource-decor is-resource-${object.objectType || 'sign'}${hasResourceImage ? '' : ' is-resource-missing'}`
    : '';
  const connectionClass = objectConnectionClassName(connection || null);
  return `t8-farm-canvas-object is-${object.kind}${type}${resourceDecor}${stage}${watered}${selected}${highlighted}${connectionClass}`;
}

export default function FarmCanvasLayer(props: FarmCanvasLayerProps) {
  if (props.visualStyle !== 'farm-story') return null;
  return <FarmCanvasLayerRuntime {...props} />;
}

function FarmCanvasLayerRuntime({
  farmCanvas,
  editing,
  visualStyle,
  resourceDecorItems = [],
  viewportMoving,
  nodeDragging,
  feedbacks = [],
  highlightedObjectId = null,
  onAction,
  onCancelContinuousAction,
  onFinishContinuousAction,
}: FarmCanvasLayerProps) {
  const { getViewport, screenToFlowPosition } = useReactFlow();
  const activeTool: FarmTool = farmCanvas.selectedTool || 'select';
  const [farmPlacementPreview, setFarmPlacementPreview] = useState<FarmPlacementPreview | null>(null);
  const [farmToolGhostPreview, setFarmToolGhostPreview] = useState<FarmToolGhostPreview | null>(null);
  const farmContinuousActionRef = useRef<FarmContinuousActionSession | null>(null);

  const resourceDecorById = useMemo(() => {
    const map = new Map<string, FarmCanvasResourceDecorItem>();
    resourceDecorItems.forEach((item) => {
      if (item.id) map.set(item.id, item);
    });
    return map;
  }, [resourceDecorItems]);

  const farmViewportBounds = useMemo(() => {
    const viewport = getViewport();
    const flowEl = typeof document !== 'undefined'
      ? document.querySelector('.react-flow') as HTMLElement | null
      : null;
    const rect = flowEl?.getBoundingClientRect();
    const zoom = viewport.zoom || 1;
    return {
      x: -viewport.x / zoom,
      y: -viewport.y / zoom,
      width: (rect?.width || 1400) / zoom,
      height: (rect?.height || 900) / zoom,
    };
  }, [getViewport, viewportMoving, nodeDragging]);

  const visibleObjects = useMemo(() => getFarmObjectsInViewport(farmCanvas, farmViewportBounds), [farmCanvas, farmViewportBounds]);

  const farmObjectConnectionMap = useMemo(
    () => buildFarmObjectConnectionMap(visibleObjects, farmCanvas.gridSize || 64),
    [farmCanvas.gridSize, visibleObjects],
  );

  const farmScarecrowRenderMargin = FARM_VIEWPORT_RENDER_MARGIN + FARM_SCARECROW_RADIUS_CELLS * (farmCanvas.gridSize || 64);

  const scarecrowObjects = useMemo(
    () => getFarmObjectsInViewport(farmCanvas, farmViewportBounds, farmScarecrowRenderMargin)
      .filter((object) => object.kind === 'building' && object.buildingId === 'scarecrow'),
    [farmCanvas, farmScarecrowRenderMargin, farmViewportBounds],
  );

  const canPreviewPlacement = editing
    && visualStyle === 'farm-story'
    && !viewportMoving
    && !nodeDragging
    && (activeTool === 'build' || activeTool === 'decor');
  const canPreviewFarmTool = editing
    && visualStyle === 'farm-story'
    && !viewportMoving
    && !nodeDragging
    && activeTool !== 'select';

  const buildFarmToolAction = useCallback((x: number, y: number, screenX?: number, screenY?: number): FarmToolAction => ({
    tool: activeTool,
    x,
    y,
    screenX,
    screenY,
    cropId: activeTool === 'seed' ? 'turnip' : undefined,
    buildingId: activeTool === 'build' ? (farmCanvas.selectedBuildingId || 'hut') : undefined,
    decorId: activeTool === 'decor' ? (farmCanvas.selectedDecorId || FARM_DEFAULT_DECOR_ID) : undefined,
    resourceId: activeTool === 'decor' ? farmCanvas.selectedResourceDecor?.resourceId : undefined,
    skinId: activeTool === 'decor' ? farmCanvas.selectedResourceDecor?.skinId : undefined,
    objectType: activeTool === 'decor' ? farmCanvas.selectedResourceDecor?.objectType : undefined,
  }), [activeTool, farmCanvas.selectedBuildingId, farmCanvas.selectedDecorId, farmCanvas.selectedResourceDecor]);

  const dispatchFarmToolAction = useCallback((event: PointerEvent, session?: FarmContinuousActionSession) => {
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const action = buildFarmToolAction(point.x, point.y, event.clientX, event.clientY);
    if (session) {
      const gridKey = farmToolActionGridKey(action, farmCanvas.gridSize);
      if (session.seenGridKeys.has(gridKey)) return false;
      session.seenGridKeys.add(gridKey);
    }
    onAction(action);
    return true;
  }, [buildFarmToolAction, farmCanvas.gridSize, onAction, screenToFlowPosition]);

  useEffect(() => {
    if (!canPreviewFarmTool) {
      setFarmPlacementPreview(null);
      setFarmToolGhostPreview(null);
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(FARM_CANVAS_EXCLUSION_SELECTOR)) {
        setFarmPlacementPreview(null);
        setFarmToolGhostPreview(null);
        return;
      }
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (canPreviewPlacement && (activeTool === 'build' || activeTool === 'decor')) {
        setFarmToolGhostPreview(null);
        setFarmPlacementPreview(previewFarmPlacement(farmCanvas, {
          tool: activeTool,
          x: point.x,
          y: point.y,
          buildingId: activeTool === 'build' ? (farmCanvas.selectedBuildingId || 'hut') : undefined,
          decorId: activeTool === 'decor' ? (farmCanvas.selectedDecorId || FARM_DEFAULT_DECOR_ID) : undefined,
          objectType: activeTool === 'decor' ? farmCanvas.selectedResourceDecor?.objectType : undefined,
        }));
        return;
      }
      setFarmPlacementPreview(null);
      setFarmToolGhostPreview(isFarmToolGhostTool(activeTool)
        ? buildFarmToolGhostPreview(farmCanvas, activeTool, point.x, point.y)
        : null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      setFarmPlacementPreview(null);
      setFarmToolGhostPreview(null);
      onAction({ tool: 'select', x: 0, y: 0 });
    };
    const handleWindowBlur = () => {
      setFarmPlacementPreview(null);
      setFarmToolGhostPreview(null);
    };

    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [activeTool, canPreviewFarmTool, canPreviewPlacement, farmCanvas, onAction, screenToFlowPosition]);

  useEffect(() => {
    if (!editing || visualStyle !== 'farm-story') return undefined;
    if (activeTool === 'select') return undefined;

    const cancelFarmContinuousAction = (reason: 'escape' | 'contextmenu' | 'blur') => {
      if (!farmContinuousActionRef.current) return false;
      farmContinuousActionRef.current = null;
      setFarmPlacementPreview(null);
      setFarmToolGhostPreview(null);
      onCancelContinuousAction?.(reason);
      return true;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2 && cancelFarmContinuousAction('contextmenu')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }
      if (event.button !== 0) return;
      if ('isPrimary' in event && event.isPrimary === false) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(FARM_CANVAS_EXCLUSION_SELECTOR)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const supportsContinuousAction = farmToolSupportsContinuousAction(activeTool);
      const session = supportsContinuousAction
        ? {
            pointerId: event.pointerId,
            tool: activeTool,
            seenGridKeys: new Set<string>(),
          }
        : null;
      farmContinuousActionRef.current = session;
      dispatchFarmToolAction(event, session || undefined);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const session = farmContinuousActionRef.current;
      if (!session || session.tool !== activeTool || session.pointerId !== event.pointerId) return;
      if ('isPrimary' in event && event.isPrimary === false) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(FARM_CANVAS_EXCLUSION_SELECTOR)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      dispatchFarmToolAction(event, session);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const session = farmContinuousActionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      farmContinuousActionRef.current = null;
      onFinishContinuousAction?.();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!cancelFarmContinuousAction('escape')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (!cancelFarmContinuousAction('contextmenu')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    const handleWindowBlur = () => {
      cancelFarmContinuousAction('blur');
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', handlePointerEnd, true);
    document.addEventListener('pointercancel', handlePointerEnd, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      farmContinuousActionRef.current = null;
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', handlePointerEnd, true);
      document.removeEventListener('pointercancel', handlePointerEnd, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [activeTool, dispatchFarmToolAction, editing, onCancelContinuousAction, onFinishContinuousAction, visualStyle]);

  return (
    <ViewportPortal>
      <div
        className={`t8-farm-canvas-layer${editing ? ' is-editing' : ''}${viewportMoving || nodeDragging ? ' is-muted' : ''}`}
        aria-hidden={!editing}
        data-farm-object-count={farmCanvas.objects.length}
        data-farm-visible-object-count={visibleObjects.length}
        data-farm-connection-object-count={visibleObjects.length}
        data-farm-scarecrow-object-count={scarecrowObjects.length}
        data-farm-virtualized={visibleObjects.length < farmCanvas.objects.length ? 'true' : undefined}
        data-farm-render-margin={FARM_VIEWPORT_RENDER_MARGIN}
        data-farm-scarecrow-render-margin={farmScarecrowRenderMargin}
        data-farm-season={farmCanvas.season}
        data-farm-weather={farmCanvas.weather}
      >
        {farmToolGhostPreview && (
          <div
            className={`t8-farm-canvas-tool-ghost is-${farmToolGhostPreview.tool} is-${farmToolGhostPreview.status}`}
            aria-hidden="true"
            data-farm-tool-preview-tool={farmToolGhostPreview.tool}
            data-farm-tool-preview-status={farmToolGhostPreview.status}
            data-farm-tool-preview-can-act={farmToolGhostPreview.status === 'ready' ? 'true' : 'false'}
            data-farm-tool-preview-target-status={farmToolGhostPreview.targetStatus || undefined}
            data-farm-tool-preview-object-id={farmToolGhostPreview.objectId || undefined}
            data-farm-tool-preview-crop-id={farmToolGhostPreview.cropId || undefined}
            style={{
              left: farmToolGhostPreview.x,
              top: farmToolGhostPreview.y,
              width: farmToolGhostPreview.width,
              height: farmToolGhostPreview.height,
            }}
            title={`${farmToolGhostPreview.label} · ${farmToolGhostPreview.detail}`}
          >
            <span className="t8-farm-canvas-tool-ghost__cell" aria-hidden="true" />
            <b className="t8-farm-canvas-tool-ghost__icon" aria-hidden="true">{farmToolGhostIcon(farmToolGhostPreview.tool)}</b>
            <span className="t8-farm-canvas-tool-ghost__copy">
              <b>{farmToolGhostPreview.label}</b>
              <small>{farmToolGhostPreview.detail}</small>
            </span>
          </div>
        )}
        {farmPlacementPreview && (
          <div
            className={`t8-farm-canvas-placement is-${farmPlacementPreview.status} is-${farmPlacementPreview.kind}${farmPlacementPreview.canPlace ? ' can-place' : ' cannot-place'}${farmPlacementPreview.missingResources ? ' has-shortage' : ''}`}
            aria-hidden="true"
            data-farm-placement-status={farmPlacementPreview.status}
            data-farm-placement-kind={farmPlacementPreview.kind}
            data-farm-placement-can-place={farmPlacementPreview.canPlace ? 'true' : 'false'}
            data-farm-placement-reason={farmPlacementPreview.reason || undefined}
            data-farm-placement-effect-preview={farmPlacementPreview.effectPreview || undefined}
            data-farm-placement-missing-gold={farmPlacementPreview.missingResources?.gold ? String(farmPlacementPreview.missingResources.gold) : undefined}
            data-farm-placement-missing-wood={farmPlacementPreview.missingResources?.wood ? String(farmPlacementPreview.missingResources.wood) : undefined}
            data-farm-placement-missing-stone={farmPlacementPreview.missingResources?.stone ? String(farmPlacementPreview.missingResources.stone) : undefined}
            data-farm-placement-scarecrow-coverage={farmPlacementShowsScarecrowCoverage(farmPlacementPreview) ? 'true' : undefined}
            data-farm-placement-scarecrow-radius-cells={farmPlacementShowsScarecrowCoverage(farmPlacementPreview) ? FARM_SCARECROW_RADIUS_CELLS : undefined}
            style={farmPlacementInlineStyle(farmPlacementPreview, farmCanvas.gridSize)}
            title={`${farmPlacementStatusLabel(farmPlacementPreview.status)} · ${farmPlacementPreview.feedback}`}
          >
            {farmPlacementShowsScarecrowCoverage(farmPlacementPreview) ? <span className="t8-farm-canvas-placement__scarecrow-range" aria-hidden="true" /> : null}
            <span className="t8-farm-canvas-placement__footprint" aria-hidden="true" />
            <b className="t8-farm-canvas-placement__icon" aria-hidden="true">{farmPlacementStatusIcon(farmPlacementPreview.status)}</b>
            <span className="t8-farm-canvas-placement__content">
              <span className="t8-farm-canvas-placement__title">{farmPlacementPreview.label}</span>
              <small>{farmPlacementStatusLabel(farmPlacementPreview.status)} · {farmPlacementPreview.feedback}</small>
              {farmPlacementPreview.effectPreview && (
                <em className="t8-farm-canvas-placement__effect" data-farm-placement-effect-preview-chip="true">
                  {farmPlacementPreview.effectPreview}
                </em>
              )}
            </span>
            <span className="t8-farm-canvas-placement__size" aria-hidden="true">
              {farmPlacementPreview.widthCells}x{farmPlacementPreview.heightCells}
            </span>
          </div>
        )}
        {visibleObjects.map((object) => {
          const connection = farmObjectConnection(object, farmObjectConnectionMap, farmCanvas.gridSize || 64);
          const resourceDecor = object.resourceId ? resourceDecorById.get(object.resourceId) : undefined;
          const resourceImageUrl = resourceDecor?.thumbUrl || resourceDecor?.fileUrl;
          const objectLabel = getObjectLabel(object);
          const protectedByScarecrow = isFarmPlotNeedingScarecrowProtection(object, farmCanvas, scarecrowObjects);
          const scarecrowCoverageSource = object.kind === 'building' && object.buildingId === 'scarecrow';
          const objectStatus = protectedByScarecrow ? '稻草人守护' : farmObjectStatusLabel(object, resourceDecor, Boolean(resourceImageUrl));
          const objectStatusKey = protectedByScarecrow ? 'protected' : farmObjectStatusKey(object, Boolean(resourceImageUrl));
          const placementReceiptLabel = farmObjectPlacementReceiptLabel(object, highlightedObjectId);
          const objectStyle: CSSProperties & { '--farm-resource-image'?: string; '--farm-scarecrow-range-size'?: string } = {
            left: object.x,
            top: object.y,
            width: object.widthCells * farmCanvas.gridSize,
            height: object.heightCells * farmCanvas.gridSize,
          };
          if (resourceImageUrl) objectStyle['--farm-resource-image'] = cssImageUrl(resourceImageUrl);
          if (scarecrowCoverageSource) objectStyle['--farm-scarecrow-range-size'] = `${FARM_SCARECROW_RADIUS_CELLS * farmCanvas.gridSize * 2}px`;
          return (
            <div
              key={object.id}
              className={objectClassName(object, farmCanvas.selectedObjectId, Boolean(resourceImageUrl), highlightedObjectId, connection)}
              title={resourceDecor?.title ? `${objectLabel} · ${resourceDecor.title}` : `${objectLabel} · ${objectStatus}`}
              data-farm-object-type={object.buildingId || object.decorId || object.kind}
              data-farm-object-label={objectLabel}
              data-farm-object-status={objectStatusKey}
              data-farm-object-status-label={objectStatus}
              data-farm-object-protected={protectedByScarecrow ? 'scarecrow' : undefined}
              data-farm-scarecrow-coverage={scarecrowCoverageSource ? 'true' : undefined}
              data-farm-scarecrow-radius-cells={scarecrowCoverageSource ? FARM_SCARECROW_RADIUS_CELLS : undefined}
              data-farm-crop-stage={object.crop?.stage || undefined}
              data-farm-crop-watered={object.crop ? (object.crop.wateredToday ? 'true' : 'false') : undefined}
              data-farm-connect-kind={connection?.kind || undefined}
              data-farm-connect-n={connection?.north ? 'true' : undefined}
              data-farm-connect-e={connection?.east ? 'true' : undefined}
              data-farm-connect-s={connection?.south ? 'true' : undefined}
              data-farm-connect-w={connection?.west ? 'true' : undefined}
              data-farm-resource-id={object.resourceId || undefined}
              data-farm-object-placement-receipt={placementReceiptLabel || undefined}
              data-farm-object-highlighted={highlightedObjectId === object.id ? 'true' : undefined}
              style={objectStyle}
            >
              {scarecrowCoverageSource ? <span className="t8-farm-canvas-object__scarecrow-range" aria-hidden="true" /> : null}
              <span className="t8-farm-canvas-object__soil" aria-hidden="true" />
              {object.crop ? <span className="t8-farm-canvas-object__crop" aria-hidden="true" /> : null}
              {object.kind === 'building' ? <span className="t8-farm-canvas-object__building" aria-hidden="true" /> : null}
              {object.kind === 'decor' && object.resourceId ? <span className="t8-farm-canvas-object__resource" aria-hidden="true" /> : null}
              {object.kind === 'decor' ? <span className="t8-farm-canvas-object__decor" aria-hidden="true" /> : null}
              {placementReceiptLabel ? (
                <span
                  className="t8-farm-canvas-object__placement-receipt"
                  data-farm-object-placement-receipt-label="true"
                  aria-hidden="true"
                >
                  {placementReceiptLabel}
                </span>
              ) : null}
              <span className="t8-farm-canvas-object__badge" aria-hidden="true">
                <b>{objectLabel}</b>
                <small>{objectStatus}</small>
              </span>
            </div>
          );
        })}
        {feedbacks.slice(0, 8).map((feedback) => (
          <div
            key={feedback.id}
            className={`t8-farm-canvas-feedback is-${feedback.tone}`}
            aria-hidden="true"
            data-farm-feedback-id={feedback.id}
            data-farm-feedback-tone={feedback.tone}
            data-farm-feedback-placement={feedback.placement || 'above'}
            style={{
              left: feedback.x,
              top: feedback.y,
            }}
          >
            {feedback.message}
          </div>
        ))}
      </div>
    </ViewportPortal>
  );
}

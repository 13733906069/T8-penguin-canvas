import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/nodes/DrawingBoardNode.tsx', 'utf8');

test('drawing board shape tools ignore non-primary mouse buttons', () => {
  assert.match(source, /if \(event\.button !== 0\) \{[\s\S]*actionRef\.current = null[\s\S]*cutoutDragRef\.current = null[\s\S]*return;\s*\}/);
});

test('drawing board renders rotated shapes and removes click-sized shape ghosts', () => {
  assert.match(source, /function isDegenerateShapeElement\(el: BoardElement\)/);
  assert.match(source, /action\.type === 'shape' && el\.id === action\.id && isDegenerateShapeElement\(el\)/);
  assert.match(source, /ctx\.translate\(center\.x, center\.y\);[\s\S]*ctx\.rotate\(\(rotation \* Math\.PI\) \/ 180\);[\s\S]*drawArrowHead\(ctx, start, end, el\.size\)/);
});

test('drawing board exposes common annotation shapes and solid fill mode', () => {
  assert.match(source, /type BoardTool = 'select' \| 'pen' \| 'eraser' \| 'text' \| 'line' \| 'arrow' \| 'rect' \| 'round-rect' \| 'circle' \| 'diamond' \| 'cutout-lasso' \| 'cutout-pen'/);
  assert.match(source, /type BoardFillMode = 'stroke' \| 'fill'/);
  assert.match(source, /kind: 'line' \| 'arrow' \| 'rect' \| 'round-rect' \| 'circle' \| 'diamond'/);
  assert.match(source, /fillMode\?: BoardFillMode/);
  assert.match(source, /const \[boardFillMode, setBoardFillMode\] = useState<BoardFillMode>/);
  assert.match(source, /toolButton\('line', <Minus size=\{13\} \/>\)/);
  assert.match(source, /toolButton\('round-rect', <PanelTop size=\{13\} \/>\)/);
  assert.match(source, /toolButton\('diamond', <Diamond size=\{13\} \/>\)/);
  assert.match(source, /aria-label="画板图形填充模式"/);
  assert.match(source, /update\(\{ boardFillMode: next \}\)/);
});

test('drawing board shape renderer supports filled shapes and endpoint-correct arrows', () => {
  assert.match(source, /function drawBoardRoundedRectPath\(/);
  assert.match(source, /function drawBoardDiamondPath\(/);
  assert.match(source, /function arrowLineEndBeforeHead\(/);
  assert.match(source, /const lineEnd = arrowLineEndBeforeHead\(start, end, el\.size\)/);
  assert.match(source, /if \(el\.fillMode === 'fill'\) \{[\s\S]*ctx\.fillStyle = el\.color;[\s\S]*ctx\.fill\(\);[\s\S]*\} else \{[\s\S]*ctx\.strokeStyle = el\.color;[\s\S]*ctx\.stroke\(\);[\s\S]*\}/);
});

test('drawing board shape drag uses local shift-drag aspect lock', () => {
  assert.match(source, /function boardShapeDragSize\(start: Point, end: Point, kind: ShapeElement\['kind'\], lockAspect: boolean\)/);
  assert.match(source, /const dragSize = boardShapeDragSize\(\{ x: el\.x, y: el\.y \}, pos, el\.kind, event\.shiftKey\)/);
  assert.match(source, /return \{ \.\.\.el, w: dragSize\.w, h: dragSize\.h \} as ShapeElement/);
});

test('drawing board owns undo redo while focused without stealing text input undo', () => {
  assert.match(source, /const historyRef = useRef<BoardLayer\[\]\[\]>\(\[\]\)/);
  assert.match(source, /function isUndoShortcutEvent/);
  assert.match(source, /function isRedoShortcutEvent/);
  assert.match(source, /!isEditableEventTarget\(event\.target\)[\s\S]*undoBoardHistory\(\)/);
});

test('drawing board exposes selected text editing controls', () => {
  assert.match(source, /const selectedTextElement = selectedElement\?\.element\.kind === 'text' \? selectedElement\.element : null/);
  assert.match(source, /<Type size=\{12\} \/> 选中文字/);
  assert.match(source, /onChange=\{\(e\) => updateSelectedTextElement\(\{ text: e\.target\.value \}\)\}/);
  assert.match(source, /const \[selectedTextEditorOpen, setSelectedTextEditorOpen\] = useState\(false\)/);
  assert.match(source, /title="放大编辑文字"/);
  assert.match(source, /const renderSelectedTextEditor = \(\) => \{/);
  assert.match(source, /className="t8-input nodrag nowheel min-h-0 flex-1 resize-none/);
});

test('drawing board tool shortcuts stay scoped to board editing', () => {
  assert.match(source, /const TOOL_SHORTCUTS: Array<\{ tool: BoardTool; shortcut: string; key: string; shiftKey\?: boolean \}> = \[/);
  assert.match(source, /\{ tool: 'select', shortcut: 'S', key: 's' \}/);
  assert.match(source, /\{ tool: 'text', shortcut: 'T', key: 't' \}/);
  assert.match(source, /\{ tool: 'eraser', shortcut: 'E', key: 'e' \}/);
  assert.match(source, /\{ tool: 'pen', shortcut: 'B', key: 'b' \}/);
  assert.match(source, /\{ tool: 'arrow', shortcut: 'A', key: 'a' \}/);
  assert.match(source, /\{ tool: 'cutout-pen', shortcut: 'P', key: 'p' \}/);
  assert.match(source, /\{ tool: 'cutout-lasso', shortcut: 'L', key: 'l' \}/);
  assert.match(source, /\{ tool: 'circle', shortcut: 'R', key: 'r' \}/);
  assert.match(source, /\{ tool: 'rect', shortcut: 'Shift\+S', key: 's', shiftKey: true \}/);
  assert.match(source, /function toolFromShortcutEvent/);
  assert.match(source, /if \(event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey\) return null/);
  assert.match(source, /!isEditableEventTarget\(event\.target\)[\s\S]*toolFromShortcutEvent\(event\)[\s\S]*applyTool\(shortcutTool\)/);
  assert.match(source, /if \(!selected \|\| selectedTextEditorOpen\) return/);
});

test('drawing board exposes in-node shortcut help and hover shortcut hints', () => {
  assert.match(source, /const \[shortcutHelpOpen, setShortcutHelpOpen\] = useState\(false\)/);
  assert.match(source, /const renderShortcutHelp = \(\) => \(/);
  assert.match(source, /仅在画板被选中，且焦点不在输入框、文字编辑框或下拉框时生效/);
  assert.match(source, /title="画板快捷键"/);
  assert.match(source, /<HelpCircle size=\{14\} \/>/);
  assert.match(source, /title=\{`\$\{TOOL_LABEL\[value\]\}\$\{shortcut \? ` \(\$\{shortcut\}\)` : ''\}`\}/);
});

test('drawing board keeps free size inputs editable and exposes original pixel size action', () => {
  assert.match(source, /const \[boardWDraft, setBoardWDraft\] = useState/);
  assert.match(source, /const \[boardHDraft, setBoardHDraft\] = useState/);
  assert.match(source, /const commitBoardDimension = useCallback/);
  assert.match(source, /onBlur=\{\(e\) => commitBoardDimension\('w', e\.currentTarget\.value\)\}/);
  assert.match(source, /onBlur=\{\(e\) => commitBoardDimension\('h', e\.currentTarget\.value\)\}/);
  assert.match(source, /const applyOriginalPixelSize = useCallback/);
  assert.match(source, /originalPixelImagePlacement\(naturalW, naturalH\)/);
  assert.match(source, /> 保持原图像素尺寸/);
});

test('drawing board body fills the actual themed node frame height', () => {
  assert.match(source, /data-drawing-board-node="true"/);
  assert.match(source, /className=\{`t8-node relative flex flex-col transition-all/);
  assert.match(source, /data-drawing-board-body="true"/);
  assert.match(source, /style=\{\{ flex: '1 1 0%', minHeight: 0 \}\}/);
  assert.doesNotMatch(source, /style=\{\{ height: NODE_H - 58 \}\}/);
});

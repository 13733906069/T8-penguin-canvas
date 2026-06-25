import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/nodes/ImageEditModal.tsx', 'utf8');

test('image edit brush tools expose custom labels, filled shapes, and common annotation shapes', () => {
  assert.match(source, /type BrushTool = 'free' \| 'line' \| 'arrow' \| 'rect' \| 'round-rect' \| 'ellipse' \| 'diamond' \| 'label' \| 'text'/);
  assert.match(source, /type BrushFillMode = 'stroke' \| 'fill'/);
  assert.match(source, /const IMAGE_EDIT_BRUSH_TOOLS: Array<\{ id: BrushTool; label: string; title: string; icon: 'brush' \| 'line' \| 'arrow' \| 'rect' \| 'roundRect' \| 'ellipse' \| 'diamond' \| 'label' \| 'text' \}> = \[/);
  assert.match(source, /\{ id: 'line', label: '直线', title: '直线标注', icon: 'line' \}/);
  assert.match(source, /\{ id: 'arrow', label: '箭头', title: '箭头标注', icon: 'arrow' \}/);
  assert.match(source, /\{ id: 'round-rect', label: '圆角矩形', title: '圆角矩形', icon: 'roundRect' \}/);
  assert.match(source, /\{ id: 'diamond', label: '菱形', title: '菱形标注', icon: 'diamond' \}/);
  assert.match(source, /\{ id: 'text', label: '文字', title: '文字标注：使用下方文本框内容，点击图片放置', icon: 'text' \}/);
  assert.match(source, /const \[brushFillMode, setBrushFillMode\] = useState<BrushFillMode>\('stroke'\)/);
  assert.match(source, /aria-label="图形填充模式"/);
  assert.match(source, /aria-label="当前标号数字"/);
  assert.match(source, /setLabelCounter\(clampLabelCounter\(Number\(e\.target\.value\)\)\)/);
  assert.match(source, /重置1/);
});

test('image edit renderer draws filled and outline variants for shape annotations', () => {
  assert.match(source, /function drawRoundedRectPath\([\s\S]*radius: number/);
  assert.match(source, /drawDiamondPath\(ctx, x, y, w, h\)/);
  assert.match(source, /drawLineArrowHead\(ctx, start, end, s\.size\)/);
  assert.match(source, /renderBrushShapePath\(ctx, s, W, H\)/);
  assert.match(source, /if \(s\.fillMode === 'fill'\) \{[\s\S]*ctx\.fillStyle = s\.color;[\s\S]*ctx\.fill\(\);[\s\S]*\} else \{[\s\S]*ctx\.strokeStyle = s\.color;[\s\S]*ctx\.stroke\(\);[\s\S]*\}/);
});

test('image edit arrow keeps the filled triangle at the visual endpoint', () => {
  assert.match(source, /function arrowLineEndBeforeHead\(/);
  assert.match(source, /const lineEnd = s\.kind === 'brush-arrow' \? arrowLineEndBeforeHead\(start, end, s\.size\) : end/);
  assert.match(source, /ctx\.lineTo\(lineEnd\.x, lineEnd\.y\);[\s\S]*ctx\.stroke\(\);[\s\S]*drawLineArrowHead\(ctx, start, end, s\.size\)/);
});

test('image edit brush shapes use local shift-drag aspect lock', () => {
  assert.match(source, /function brushRectFromDrag\(start: Pt, end: Pt, lockAspect: boolean, naturalSize: \{ w: number; h: number \} \| null\)/);
  assert.match(source, /const sidePx = Math\.min\(\s*Math\.max\(Math\.abs\(dx\) \* naturalSize\.w, Math\.abs\(dy\) \* naturalSize\.h\),\s*maxX \* naturalSize\.w,\s*maxY \* naturalSize\.h,\s*\)/);
  assert.match(source, /x: start\.x \+ signX \* \(sidePx \/ naturalSize\.w\)/);
  assert.match(source, /y: start\.y \+ signY \* \(sidePx \/ naturalSize\.h\)/);
  assert.match(source, /const brushRect = brushRectFromDrag\(ctx\.startPt, pt, e\.shiftKey, naturalSize\)/);
  assert.match(source, /rect: brushRect/);
});

test('image edit annotation text comes from the instruction field and remains transformable on the board', () => {
  assert.match(source, /const AUTO_ANNOTATION_TEXT_ID = 'annotation-instruction-text'/);
  assert.match(source, /\| \{ kind: 'brush-text'; id: string; color: string; size: number; pos: Pt; text: string; rotation: number; scale: number \}/);
  assert.match(source, /const annotationTextValue = annotationInstruction\.trim\(\)/);
  assert.match(source, /kind: 'brush-text'[\s\S]*id: AUTO_ANNOTATION_TEXT_ID[\s\S]*text: annotationTextValue/);
  assert.match(source, /annotationTextDragRef[\s\S]*op: 'move' \| 'scale' \| 'rotate'/);
  assert.match(source, /function startAnnotationTextTransform\(/);
  assert.match(source, /function moveAnnotationTextTransform\(/);
  assert.match(source, /function renderAnnotationTextOverlay\(/);
  assert.match(source, /placeholder="输入文字后会自动添加到画板，可拖动、缩放、旋转"/);
});

test('image edit text annotation draft can be confirmed and reset for the next label', () => {
  assert.match(source, /const hasAnnotationTextDraft = brushStrokes\.some\(\(stroke\) => stroke\.kind === 'brush-text' && stroke\.id === AUTO_ANNOTATION_TEXT_ID\)/);
  assert.match(source, /function confirmAnnotationTextDraft\(\)/);
  assert.match(source, /const lockedText: DrawStroke = \{[\s\S]*\.\.\.draft,[\s\S]*id: `manual-text-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 6\)\}`/);
  assert.match(source, /setAnnotationInstruction\(''\)/);
  assert.match(source, /setSelectedAnnotationTextId\(lockedText\.id\)/);
  assert.match(source, /onClick=\{confirmAnnotationTextDraft\}/);
  assert.match(source, /disabled=\{busy \|\| !hasAnnotationTextDraft\}/);
  assert.match(source, /<Check size=\{14\} \/> 确定文字/);
});

test('image edit exports brush text with image-relative size instead of tiny preview pixels', () => {
  assert.match(source, /const TEXT_ANNOTATION_EXPORT_BASE_PX = 720/);
  assert.match(source, /function brushTextExportFontPx\(s: Extract<DrawStroke, \{ kind: 'brush-text' \}>, W: number, H: number\)/);
  assert.match(source, /const exportScale = clamp\(Math\.max\(W, H\) \/ TEXT_ANNOTATION_EXPORT_BASE_PX, 1, 10\)/);
  assert.match(source, /return Math\.max\(18, s\.size \* 1\.35 \* s\.scale \* exportScale\)/);
  assert.match(source, /const fontPx = brushTextExportFontPx\(s, W, H\)/);
  assert.doesNotMatch(source, /const fontPx = Math\.max\(14, s\.size \* 1\.35 \* s\.scale\)/);
});

test('image edit brush toolbar also exposes a manual text tool', () => {
  assert.match(source, /type BrushTool = 'free' \| 'line' \| 'arrow' \| 'rect' \| 'round-rect' \| 'ellipse' \| 'diamond' \| 'label' \| 'text'/);
  assert.match(source, /icon: 'brush' \| 'line' \| 'arrow' \| 'rect' \| 'roundRect' \| 'ellipse' \| 'diamond' \| 'label' \| 'text'/);
  assert.match(source, /\{ id: 'text', label: '文字', title: '文字标注：使用下方文本框内容，点击图片放置', icon: 'text' \}/);
  assert.match(source, /if \(icon === 'text'\) return <TypeIcon size=\{13\} \/>/);
  assert.match(source, /else if \(brushTool === 'text'\) \{[\s\S]*kind: 'brush-text'[\s\S]*id: `manual-text-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 6\)\}`/);
});

test('annotation edit submits the default visual-markup instruction instead of requiring manual text', () => {
  assert.match(source, /const ANNOTATION_EDIT_DEFAULT_INSTRUCTION = '按照图像标注的内容进行改图'/);
  assert.match(source, /const annotationTextCount = brushStrokes\.filter\(\(stroke\) => stroke\.kind === 'brush-label' \|\| stroke\.kind === 'brush-text'\)\.length/);
  assert.match(source, /const instruction = ANNOTATION_EDIT_DEFAULT_INSTRUCTION/);
  assert.doesNotMatch(source, /请补充改图说明/);
});

test('image edit modal owns undo redo shortcuts before the canvas global history', () => {
  assert.match(source, /function isImageEditEditableEventTarget\(target: EventTarget \| null\)/);
  assert.match(source, /function stopImageEditShortcutEvent\(event: KeyboardEvent\)/);
  assert.match(source, /event\.stopImmediatePropagation\?\.\(\)/);
  assert.match(source, /document\.addEventListener\('keydown', onKey, true\)/);
  assert.match(source, /document\.removeEventListener\('keydown', onKey, true\)/);
  assert.match(source, /if \(mode === 'compose'\) return;[\s\S]*stopImageEditShortcutEvent\(e\);[\s\S]*if \(mode === 'mask' \|\| mode === 'brush'\) undo\(\);/);
  assert.match(source, /if \(mode === 'compose'\) return;[\s\S]*stopImageEditShortcutEvent\(e\);[\s\S]*if \(mode === 'mask' \|\| mode === 'brush'\) redo\(\);/);
  assert.match(source, /stopImageEditShortcutEvent\(e\);\s*composeUndo\(\);/);
  assert.match(source, /stopImageEditShortcutEvent\(e\);\s*composeRedo\(\);/);
});

test('image edit brush mode can send clean source plus annotated image for AI annotation editing', () => {
  assert.match(source, /\| \{ type: 'annotation-edit'; instruction: string; strokeCount: number; annotationTextCount: number; annotationShapeCount: number \}/);
  assert.match(source, /const \[annotationInstruction, setAnnotationInstruction\] = useState\(''\)/);
  assert.match(source, /async function applyAnnotationEdit\(\)/);
  assert.match(source, /const originUrl = await fetchAndUpload\(workingSrcUrl, 'annotation-source'\)/);
  assert.match(source, /const annotatedUrl = await uploadDataUrl\(dataUrl, 'annotation-markup'\)/);
  assert.match(source, /onProduce\(\[originUrl, annotatedUrl\], \{[\s\S]*type: 'annotation-edit'/);
  assert.match(source, /标注改图/);
});

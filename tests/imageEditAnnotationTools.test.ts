import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/nodes/ImageEditModal.tsx', 'utf8');

test('image edit brush tools expose custom labels, filled shapes, and common annotation shapes', () => {
  assert.match(source, /type BrushTool = 'free' \| 'line' \| 'arrow' \| 'rect' \| 'round-rect' \| 'ellipse' \| 'diamond' \| 'label'/);
  assert.match(source, /type BrushFillMode = 'stroke' \| 'fill'/);
  assert.match(source, /const IMAGE_EDIT_BRUSH_TOOLS: Array<\{ id: BrushTool; label: string; title: string; icon: 'brush' \| 'line' \| 'arrow' \| 'rect' \| 'roundRect' \| 'ellipse' \| 'diamond' \| 'label' \}> = \[/);
  assert.match(source, /\{ id: 'line', label: '直线', title: '直线标注', icon: 'line' \}/);
  assert.match(source, /\{ id: 'arrow', label: '箭头', title: '箭头标注', icon: 'arrow' \}/);
  assert.match(source, /\{ id: 'round-rect', label: '圆角矩形', title: '圆角矩形', icon: 'roundRect' \}/);
  assert.match(source, /\{ id: 'diamond', label: '菱形', title: '菱形标注', icon: 'diamond' \}/);
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

test('image edit brush mode can send clean source plus annotated image for AI annotation editing', () => {
  assert.match(source, /\| \{ type: 'annotation-edit'; instruction: string; strokeCount: number; annotationTextCount: number; annotationShapeCount: number \}/);
  assert.match(source, /const \[annotationInstruction, setAnnotationInstruction\] = useState\(''\)/);
  assert.match(source, /async function applyAnnotationEdit\(\)/);
  assert.match(source, /const originUrl = await fetchAndUpload\(workingSrcUrl, 'annotation-source'\)/);
  assert.match(source, /const annotatedUrl = await uploadDataUrl\(dataUrl, 'annotation-markup'\)/);
  assert.match(source, /onProduce\(\[originUrl, annotatedUrl\], \{[\s\S]*type: 'annotation-edit'/);
  assert.match(source, /标注改图/);
});

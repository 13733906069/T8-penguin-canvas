import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawingBoard = readFileSync('src/components/nodes/DrawingBoardNode.tsx', 'utf8');
const imageEdit = readFileSync('src/components/nodes/ImageEditModal.tsx', 'utf8');

test('drawing board runs RH cutout on the selected image and replaces the same element', () => {
  assert.match(drawingBoard, /import \{ runRhImageCutout \} from '\.\.\/\.\.\/services\/rhToolboxCapabilities'/);
  assert.match(drawingBoard, /const \[rhCutoutRunning, setRhCutoutRunning\] = useState\(false\)/);
  assert.match(drawingBoard, /const applyRhCutoutToSelectedImage = useCallback\(async \(\) => \{/);
  assert.match(drawingBoard, /const result = await runRhImageCutout\(source\.url,/);
  assert.match(drawingBoard, /el\.id === source\.id && el\.kind === 'image'[\s\S]*url: result\.outputUrl[\s\S]*name: `\$\{source\.name \|\| '图片'\} RH抠图`/);
  assert.match(drawingBoard, /setSelectedElementId\(source\.id\)/);
  assert.match(drawingBoard, /title=\{selectedCutoutSource \? '调用 RH工具箱自动抠图并替换选中图片' : '请先选中一张图片'\}/);
});

test('image edit modal runs RH cutout for the current image or selected compose layer', () => {
  assert.match(imageEdit, /import \{ runRhImageCutout \} from '\.\.\/\.\.\/services\/rhToolboxCapabilities'/);
  assert.match(imageEdit, /const \[workingSrcUrl, setWorkingSrcUrl\] = useState\(srcUrl\)/);
  assert.match(imageEdit, /const selectedComposeImageLayer = useMemo\(\(\) => \{/);
  assert.match(imageEdit, /async function applyRhCutoutToCurrentImage\(\) \{/);
  assert.match(imageEdit, /const sourceUrl = selectedComposeImageLayer\?\.src \|\| workingSrcUrl/);
  assert.match(imageEdit, /const result = await runRhImageCutout\(sourceUrl,/);
  assert.match(imageEdit, /updateLayer\(selectedComposeImageLayer\.id, \{[\s\S]*src: result\.outputUrl[\s\S]*name: `\$\{selectedComposeImageLayer\.name \|\| '图层'\} RH抠图`/);
  assert.match(imageEdit, /setWorkingSrcUrl\(result\.outputUrl\)/);
  assert.match(imageEdit, /<Scissors size=\{13\} \/> RH抠图/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('upload and output material nodes expose per-material delete actions', () => {
  const upload = read('../src/components/nodes/UploadNode.tsx');
  const output = read('../src/components/nodes/OutputNode.tsx');

  assert.match(upload, /Trash2/);
  assert.match(output, /Trash2/);
  assert.match(upload, /createUploadMediaRemovalData/);
  assert.match(output, /createOutputMediaRemovalData/);
  assert.match(output, /isMaterialUrlHidden/);
  assert.match(upload, /handleRemoveUploadItem/);
  assert.match(output, /handleRemoveOutputMaterial/);
  assert.match(upload, /删除素材/);
  assert.match(output, /删除素材/);
  assert.match(upload, /group-hover\/upload-image/);
  assert.match(output, /group-hover\/output-image-card/);
  assert.match(output, /t8-output-image-action-stack/);
  assert.match(output, /t8-output-image-action-stack--compact/);
  assert.match(output, /t8-output-image-action-stack--above/);
  assert.match(output, /t8-output-image-media--grid/);
  assert.match(output, /grid grid-cols-2 gap-1\.5/);
  assert.match(output, /t8-material-action-button/);
  assert.match(output, /iconSize=\{collected\.images\.length >= 2 \? 10 : 14\}/);

  const css = read('../src/styles/index.css');
  assert.match(css, /\.t8-output-image-media--grid\s*\{[\s\S]*height:\s*auto\s*!important/);
  assert.match(css, /\.t8-output-image-media--grid\s*\{[\s\S]*object-fit:\s*contain\s*!important/);
  assert.match(css, /\.t8-output-image-action-stack--compact\s*\{[\s\S]*flex-direction:\s*row\s*!important/);
  assert.match(css, /\.t8-output-image-action-stack--above\s*\{[\s\S]*position:\s*relative\s*!important/);
  assert.match(css, /\.t8-output-image-action-stack--compact\s+\.t8-material-action-button\s*\{[\s\S]*width:\s*22px\s*!important/);
  assert.match(css, /\.t8-output-image-action-stack--compact\s+\.t8-material-action-button\s*\{[\s\S]*height:\s*22px\s*!important/);
  assert.match(css, /\.t8-output-image-action-stack--compact\s+\.t8-material-action-button\s*\{[\s\S]*min-height:\s*22px\s*!important/);
});

test('image material context menu can copy the actual image to clipboard', () => {
  const contextMenu = read('../src/components/MaterialContextMenu.tsx');
  const clipboardUtil = read('../src/utils/imageClipboard.ts');

  assert.match(contextMenu, /copyImageUrlToClipboard/);
  assert.match(contextMenu, /复制图片到剪切板/);
  assert.match(contextMenu, /图片已复制到剪切板/);
  assert.match(contextMenu, /menu\.kind === 'image'/);

  assert.match(clipboardUtil, /export async function copyImageUrlToClipboard/);
  assert.match(clipboardUtil, /navigator\.clipboard\.write/);
  assert.match(clipboardUtil, /ClipboardItem/);
  assert.match(clipboardUtil, /image\/png/);
  assert.match(clipboardUtil, /canvas\.toBlob/);
});

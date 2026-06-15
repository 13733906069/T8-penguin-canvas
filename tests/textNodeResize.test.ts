import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

test('resized text nodes keep long prompts inside a scrollable editor', () => {
  const textNode = read('../src/components/nodes/TextNode.tsx');
  const mentionInput = read('../src/components/nodes/MentionPromptInput.tsx');

  assert.match(textNode, /fillHeight=\{!!size\.h\}/);
  assert.match(textNode, /size\.h \? 'flex-1 min-h-0 overflow-hidden'/);
  assert.match(textNode, /size\.h \? 'min-h-0 flex-1' : 'h-24'/);
  assert.doesNotMatch(textNode, /min-h-\[72px\]/);

  assert.match(mentionInput, /fillHeight\?: boolean/);
  assert.match(mentionInput, /const fillLayout = fillHeight \|\| !expandable/);
  assert.match(mentionInput, /height: fillLayout \? '100%' : style\?\.height/);
  assert.match(mentionInput, /minHeight: fillLayout \? 0 : \(style\?\.minHeight \?\? 56\)/);
});

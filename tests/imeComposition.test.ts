import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompositionLeakSnapshot,
  createPlainInputRunSnapshot,
  stripCompositionLeak,
} from '../src/utils/imeComposition.ts';

test('IME cleanup removes the full leaked pinyin run before committed Chinese text', () => {
  const plain = createPlainInputRunSnapshot({
    text: 'zhiqian',
    caret: 'zhiqian'.length,
    data: 'n',
    now: 1000,
  });

  assert.equal(plain?.data, 'zhiqian');
  const leak = createCompositionLeakSnapshot(plain, 1120);
  assert.deepEqual(leak, { start: 0, end: 'zhiqian'.length, data: 'zhiqian' });

  const fixed = stripCompositionLeak('zhiqian之前的对比图', [], leak);

  assert.equal(fixed.changed, true);
  assert.equal(fixed.text, '之前的对比图');
  assert.equal(fixed.caretDelta, -'zhiqian'.length);
});

test('IME cleanup removes WeChat pinyin leaked while composing after clearing an editor', () => {
  const plain = createPlainInputRunSnapshot({
    text: "jjian'hu",
    caret: "jjian'hu".length,
    data: 'u',
    now: 1000,
  });

  assert.equal(plain?.data, "jjian'hu");
  const leak = createCompositionLeakSnapshot(plain, 1040);
  assert.deepEqual(leak, { start: 0, end: "jjian'hu".length, data: "jjian'hu" });

  const fixed = stripCompositionLeak("jjian'hu看护", [], leak);

  assert.equal(fixed.changed, true);
  assert.equal(fixed.text, '看护');
  assert.equal(fixed.caretDelta, -"jjian'hu".length);
});

test('IME cleanup shifts mention ranges after removing leaked pinyin', () => {
  const text = 'abc zhiqian之前 @image1 ';
  const expectedText = 'abc 之前 @image1 ';
  const leak = { start: text.indexOf('zhiqian'), end: text.indexOf('zhiqian') + 'zhiqian'.length, data: 'zhiqian' };
  const mentionStart = text.indexOf('@image1');
  const expectedMentionStart = expectedText.indexOf('@image1');
  const mention = {
    id: 'm1',
    token: '@image1',
    start: mentionStart,
    end: mentionStart + '@image1'.length,
  };

  const fixed = stripCompositionLeak(text, [mention], leak);

  assert.equal(fixed.text, expectedText);
  assert.deepEqual(fixed.mentions, [
    { ...mention, start: expectedMentionStart, end: expectedMentionStart + '@image1'.length },
  ]);
});

test('IME cleanup does not remove intentional uppercase English before Chinese text', () => {
  const plain = createPlainInputRunSnapshot({
    text: 'AI',
    caret: 2,
    data: 'I',
    now: 1000,
  });

  assert.equal(createCompositionLeakSnapshot(plain, 1100), null);
});

test('IME cleanup only removes a leak when committed text follows it', () => {
  const leak = { start: 0, end: 'zhiqian'.length, data: 'zhiqian' };
  const fixed = stripCompositionLeak('zhiqian reference image', [], leak);

  assert.equal(fixed.changed, false);
  assert.equal(fixed.text, 'zhiqian reference image');
});

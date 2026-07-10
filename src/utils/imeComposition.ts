export interface TextRange {
  start: number;
  end: number;
}

export interface PlainInputRunSnapshot {
  text: string;
  caret: number;
  data: string;
  start: number;
  end: number;
  at: number;
}

export interface CompositionLeakSnapshot {
  start: number;
  end: number;
  data: string;
}

const PINYIN_LEAK_RUN = /[A-Za-z](?:[A-Za-z']{0,46}[A-Za-z])?$/;
const LOWER_PINYIN_LEAK = /^[a-z]+(?:'[a-z]+)*$/;

export function isImeCompositionInput(event: Event | null | undefined) {
  const native = event as (InputEvent & { isComposing?: boolean }) | null | undefined;
  return !!native?.isComposing || /Composition/i.test(String(native?.inputType || ''));
}

export function isImeKeyboardEvent(event: KeyboardEvent | null | undefined) {
  const native = event as (KeyboardEvent & { isComposing?: boolean; keyCode?: number; which?: number }) | null | undefined;
  return !!native?.isComposing || native?.key === 'Process' || native?.keyCode === 229 || native?.which === 229;
}

export function createPlainInputRunSnapshot({
  text,
  caret,
  data,
  now,
}: {
  text: string;
  caret: number;
  data: string;
  now: number;
}): PlainInputRunSnapshot | null {
  if (!/^[A-Za-z]$/.test(data) || caret <= 0) return null;
  const insertedStart = caret - data.length;
  if (insertedStart < 0 || text.slice(insertedStart, caret) !== data) return null;
  const match = text.slice(0, caret).match(PINYIN_LEAK_RUN);
  if (!match) return null;
  const run = match[0];
  return {
    text,
    caret,
    data: run,
    start: caret - run.length,
    end: caret,
    at: now,
  };
}

export function createCompositionLeakSnapshot(
  plain: PlainInputRunSnapshot | null,
  now: number,
  maxAgeMs = 650,
): CompositionLeakSnapshot | null {
  if (!plain || now - plain.at > maxAgeMs) return null;
  if (plain.data.length > 48 || !LOWER_PINYIN_LEAK.test(plain.data)) return null;
  if (plain.text.slice(plain.start, plain.end) !== plain.data) return null;
  return { start: plain.start, end: plain.end, data: plain.data };
}

export function stripCompositionLeak<TMention extends TextRange>(
  text: string,
  mentions: TMention[],
  leak: CompositionLeakSnapshot | null,
): { text: string; mentions: TMention[]; caretDelta: number; changed: boolean } {
  if (!leak || !leak.data) return { text, mentions, caretDelta: 0, changed: false };
  const start = Math.max(0, Math.min(text.length, leak.start));
  const end = Math.max(start, Math.min(text.length, leak.end));
  if (text.slice(start, end) !== leak.data) return { text, mentions, caretDelta: 0, changed: false };
  const following = text.slice(end, end + 4);
  if (!/[\u3400-\u9fff\uf900-\ufaff]/.test(following)) return { text, mentions, caretDelta: 0, changed: false };

  const removed = end - start;
  const nextText = `${text.slice(0, start)}${text.slice(end)}`;
  const nextMentions = mentions
    .filter((mention) => mention.end <= start || mention.start >= end)
    .map((mention) => {
      if (mention.start >= end) {
        return { ...mention, start: mention.start - removed, end: mention.end - removed };
      }
      return mention;
    });
  return { text: nextText, mentions: nextMentions, caretDelta: -removed, changed: true };
}

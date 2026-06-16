export interface UpstreamMaterialBucketItem {
  id: string;
  kind: string;
  url: string;
  sourceNodeId: string;
}

export interface UpstreamMaterialBucketShape {
  texts: UpstreamMaterialBucketItem[];
  images: UpstreamMaterialBucketItem[];
  videos: UpstreamMaterialBucketItem[];
  audios: UpstreamMaterialBucketItem[];
}

const TEXT_FIELD_MARKER = '::text-field:';

function normalizedTextFieldEchoKey(item: UpstreamMaterialBucketItem): string {
  return `${item.sourceNodeId}::${String(item.url || '').trim()}`;
}

export function dedupeUpstreamMaterialBuckets<T extends UpstreamMaterialBucketShape>(buckets: T): T {
  const seenTextFieldEchoes = new Set<string>();
  let changed = false;
  const texts = buckets.texts.filter((item) => {
    if (item.kind !== 'text' || !item.id.includes(TEXT_FIELD_MARKER)) return true;
    const key = normalizedTextFieldEchoKey(item);
    if (!key.endsWith('::')) {
      if (seenTextFieldEchoes.has(key)) {
        changed = true;
        return false;
      }
      seenTextFieldEchoes.add(key);
    }
    return true;
  });

  return changed ? ({ ...buckets, texts } as T) : buckets;
}

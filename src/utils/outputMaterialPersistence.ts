export const OUTPUT_MATERIAL_PERSISTENCE_STORAGE_KEY = 't8-output-material-persistence-enabled';

type OutputMaterialPersistenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): OutputMaterialPersistenceStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export function readOutputMaterialPersistenceSetting(
  storage: OutputMaterialPersistenceStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(OUTPUT_MATERIAL_PERSISTENCE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOutputMaterialPersistenceSetting(
  enabled: boolean,
  storage: OutputMaterialPersistenceStorage | undefined = browserStorage(),
): void {
  if (!storage) return;
  try {
    if (enabled) storage.setItem(OUTPUT_MATERIAL_PERSISTENCE_STORAGE_KEY, '1');
    else storage.removeItem(OUTPUT_MATERIAL_PERSISTENCE_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in privacy modes; the in-memory state still works.
  }
}

export type PersistentOutputSnapshotItem = {
  kind: 'text' | 'image' | 'video' | 'audio';
  url: string;
};

export function buildPersistentOutputSnapshotData(item: PersistentOutputSnapshotItem): Record<string, any> {
  const value = item.url.trim();
  if (!value) return {};
  if (item.kind === 'text') {
    return {
      outputMaterialPersisted: true,
      outputText: value,
      directOutputText: value,
      textSegments: [value],
      directTextSegments: [value],
    };
  }
  if (item.kind === 'image') {
    return {
      outputMaterialPersisted: true,
      imageUrl: value,
      imageUrls: [value],
      directImageUrl: value,
      directImageUrls: [value],
    };
  }
  if (item.kind === 'video') {
    return {
      outputMaterialPersisted: true,
      videoUrl: value,
      videoUrls: [value],
      directVideoUrl: value,
      directVideoUrls: [value],
    };
  }
  return {
    outputMaterialPersisted: true,
    audioUrl: value,
    audioUrls: [value],
    directAudioUrl: value,
    directAudioUrls: [value],
  };
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.some(hasText);
}

export function hasPersistentOutputMaterialPayload(data: any): boolean {
  if (!data) return false;
  return (
    hasText(data.directOutputText) ||
    hasItems(data.directTextSegments) ||
    hasText(data.directImageUrl) ||
    hasItems(data.directImageUrls) ||
    hasText(data.directVideoUrl) ||
    hasItems(data.directVideoUrls) ||
    hasText(data.directAudioUrl) ||
    hasItems(data.directAudioUrls)
  );
}

export function shouldPreserveAutoOutputMaterialNode(node: any, enabled: boolean): boolean {
  if (!enabled || !node) return false;
  if (node.type !== 'output') return false;
  if (typeof node.id !== 'string' || !node.id.startsWith('output-auto-')) return false;
  return hasPersistentOutputMaterialPayload(node.data);
}

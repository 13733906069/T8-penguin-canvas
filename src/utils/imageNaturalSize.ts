export interface ImageNaturalSize {
  width: number;
  height: number;
}

export function readImageNaturalSize(source: string | File, timeoutMs = 4000): Promise<ImageNaturalSize | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  const isFile = typeof File !== 'undefined' && source instanceof File;
  const canUseObjectUrl = isFile && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  const src = canUseObjectUrl ? URL.createObjectURL(source) : String(source || '');
  if (!src) return Promise.resolve(null);

  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      if (canUseObjectUrl) URL.revokeObjectURL(src);
    };
    const finish = (size: ImageNaturalSize | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(size);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    image.onload = () => {
      const width = Math.round(Number(image.naturalWidth || image.width) || 0);
      const height = Math.round(Number(image.naturalHeight || image.height) || 0);
      finish(width > 0 && height > 0 ? { width, height } : null);
    };
    image.onerror = () => finish(null);
    image.decoding = 'async';
    image.src = src;
  });
}

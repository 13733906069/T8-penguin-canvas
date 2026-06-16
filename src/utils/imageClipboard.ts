function clipboardItemCtor(): typeof ClipboardItem | null {
  return typeof ClipboardItem === 'undefined' ? null : ClipboardItem;
}

function inferImageTypeFromUrl(url: string): string {
  const clean = url.split('?')[0]?.split('#')[0] || '';
  const ext = clean.split('.').pop()?.toLowerCase() || '';
  if (ext === 'jpg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext) return `image/${ext}`;
  return '';
}

async function fetchImageBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`读取图片失败 HTTP ${response.status}`);
  }
  return response.blob();
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('图片转为 PNG 失败'));
    }, 'image/png');
  });
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片解码失败'));
    };
    image.src = objectUrl;
  });
}

async function convertImageBlobToPng(blob: Blob): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前环境无法创建图片画布');

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvasToPngBlob(canvas);
    } catch {
      // 部分浏览器对 SVG / 特殊 WebP 的 createImageBitmap 支持不完整，继续走 img 兜底。
    }
  }

  const image = await loadImageElement(blob);
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  if (!canvas.width || !canvas.height) throw new Error('图片尺寸无效，无法复制');
  ctx.drawImage(image, 0, 0);
  return canvasToPngBlob(canvas);
}

async function normalizeClipboardImageBlob(blob: Blob, url: string): Promise<Blob> {
  const type = (blob.type || inferImageTypeFromUrl(url)).toLowerCase();
  if (!type.startsWith('image/')) {
    throw new Error('该素材不是可复制的图片');
  }
  if (type === 'image/png') return blob;
  return convertImageBlobToPng(blob);
}

export async function copyImageUrlToClipboard(url: string): Promise<void> {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) throw new Error('缺少图片地址，无法复制');

  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
  const ClipboardItemClass = clipboardItemCtor();
  if (!clipboard?.write || !ClipboardItemClass) {
    throw new Error('当前浏览器不支持复制图片到剪切板');
  }

  const sourceBlob = await fetchImageBlob(cleanUrl);
  const imageBlob = await normalizeClipboardImageBlob(sourceBlob, cleanUrl);
  const mime = imageBlob.type || 'image/png';
  await navigator.clipboard.write([
    new ClipboardItemClass({
      [mime]: imageBlob,
    }),
  ]);
}

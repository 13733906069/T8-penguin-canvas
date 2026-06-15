export interface NormalizedCropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropResizeHandle = 'tl' | 'tr' | 'bl' | 'br';

const MIN_CROP_FRACTION = 0.02;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function normalizedAspect(pixelAspect: number, imageW: number, imageH: number): number | null {
  if (!Number.isFinite(pixelAspect) || pixelAspect <= 0 || imageW <= 0 || imageH <= 0) return null;
  return pixelAspect * (imageH / imageW);
}

function clampCropBox(box: NormalizedCropBox): NormalizedCropBox {
  const w = clamp(box.w, MIN_CROP_FRACTION, 1);
  const h = clamp(box.h, MIN_CROP_FRACTION, 1);
  return {
    x: clamp(box.x, 0, 1 - w),
    y: clamp(box.y, 0, 1 - h),
    w,
    h,
  };
}

export function fitCropBoxToAspect(
  box: NormalizedCropBox,
  imageW: number,
  imageH: number,
  pixelAspect: number,
): NormalizedCropBox {
  const ratio = normalizedAspect(pixelAspect, imageW, imageH);
  if (!ratio) return clampCropBox(box);

  let w = clamp(box.w, MIN_CROP_FRACTION, 1);
  let h = clamp(box.h, MIN_CROP_FRACTION, 1);
  const centerX = clamp(box.x + box.w / 2, 0, 1);
  const centerY = clamp(box.y + box.h / 2, 0, 1);

  if (w / h > ratio) {
    w = h * ratio;
  } else {
    h = w / ratio;
  }

  if (w > 1) {
    w = 1;
    h = w / ratio;
  }
  if (h > 1) {
    h = 1;
    w = h * ratio;
  }
  if (w < MIN_CROP_FRACTION) {
    w = MIN_CROP_FRACTION;
    h = Math.min(1, w / ratio);
  }
  if (h < MIN_CROP_FRACTION) {
    h = MIN_CROP_FRACTION;
    w = Math.min(1, h * ratio);
  }

  return {
    x: clamp(centerX - w / 2, 0, 1 - w),
    y: clamp(centerY - h / 2, 0, 1 - h),
    w,
    h,
  };
}

export function createMaxCropBoxForAspect(
  imageW: number,
  imageH: number,
  pixelAspect: number,
): NormalizedCropBox {
  const ratio = normalizedAspect(pixelAspect, imageW, imageH);
  if (!ratio) return { x: 0, y: 0, w: 1, h: 1 };

  let w = 1;
  let h = w / ratio;
  if (h > 1) {
    h = 1;
    w = h * ratio;
  }

  return {
    x: (1 - w) / 2,
    y: (1 - h) / 2,
    w,
    h,
  };
}

export function resizeCropBoxWithAspect(
  start: NormalizedCropBox,
  dx: number,
  dy: number,
  handle: CropResizeHandle,
  imageW: number,
  imageH: number,
  pixelAspect: number,
): NormalizedCropBox {
  const ratio = normalizedAspect(pixelAspect, imageW, imageH);
  if (!ratio) return clampCropBox(start);

  const anchor =
    handle === 'br'
      ? { x: start.x, y: start.y, dirX: 1, dirY: 1 }
      : handle === 'tr'
      ? { x: start.x, y: start.y + start.h, dirX: 1, dirY: -1 }
      : handle === 'bl'
      ? { x: start.x + start.w, y: start.y, dirX: -1, dirY: 1 }
      : { x: start.x + start.w, y: start.y + start.h, dirX: -1, dirY: -1 };

  const pointerX =
    handle === 'br' || handle === 'tr' ? start.x + start.w + dx : start.x + dx;
  const pointerY =
    handle === 'br' || handle === 'bl' ? start.y + start.h + dy : start.y + dy;
  const maxW = anchor.dirX > 0 ? 1 - anchor.x : anchor.x;
  const maxH = anchor.dirY > 0 ? 1 - anchor.y : anchor.y;
  const rawW = clamp(Math.abs(pointerX - anchor.x), MIN_CROP_FRACTION, Math.max(MIN_CROP_FRACTION, maxW));
  const rawH = clamp(Math.abs(pointerY - anchor.y), MIN_CROP_FRACTION, Math.max(MIN_CROP_FRACTION, maxH));

  let w: number;
  let h: number;
  if (rawW / rawH > ratio) {
    h = rawH;
    w = h * ratio;
  } else {
    w = rawW;
    h = w / ratio;
  }

  if (w > maxW) {
    w = maxW;
    h = w / ratio;
  }
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  w = clamp(w, MIN_CROP_FRACTION, Math.max(MIN_CROP_FRACTION, maxW));
  h = clamp(h, MIN_CROP_FRACTION, Math.max(MIN_CROP_FRACTION, maxH));

  return {
    x: anchor.dirX > 0 ? anchor.x : anchor.x - w,
    y: anchor.dirY > 0 ? anchor.y : anchor.y - h,
    w,
    h,
  };
}

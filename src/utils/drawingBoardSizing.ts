export const MIN_BOARD_DIMENSION = 16;
export const MAX_BOARD_DIMENSION = 8192;

export interface ImageFitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function finitePositive(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function clampBoardDimension(value: number, fallback: number, min = MIN_BOARD_DIMENSION, max = MAX_BOARD_DIMENSION): number {
  const safeFallback = finitePositive(fallback) ?? min;
  const safeValue = finitePositive(value) ?? safeFallback;
  return Math.round(Math.min(max, Math.max(min, safeValue)));
}

export function fitImageToBoard(naturalW: number, naturalH: number, boardW: number, boardH: number, index: number): ImageFitRect {
  const safeBoardW = clampBoardDimension(boardW, 960);
  const safeBoardH = clampBoardDimension(boardH, 540);
  const srcW = Math.max(1, finitePositive(naturalW) ?? safeBoardW);
  const srcH = Math.max(1, finitePositive(naturalH) ?? safeBoardH);
  const maxW = Math.max(80, safeBoardW * 0.78);
  const maxH = Math.max(80, safeBoardH * 0.78);
  const scale = Math.min(maxW / srcW, maxH / srcH);
  const w = Math.max(24, srcW * scale);
  const h = Math.max(24, srcH * scale);
  const offset = Math.min(54, index * 18);
  return {
    x: Math.min(Math.max(0, safeBoardW - w), Math.max(0, (safeBoardW - w) / 2 + offset)),
    y: Math.min(Math.max(0, safeBoardH - h), Math.max(0, (safeBoardH - h) / 2 + offset)),
    w,
    h,
  };
}

export function originalPixelImagePlacement(naturalW: number, naturalH: number): { boardW: number; boardH: number; rect: ImageFitRect } {
  const boardW = clampBoardDimension(naturalW, 960);
  const boardH = clampBoardDimension(naturalH, 540);
  return {
    boardW,
    boardH,
    rect: {
      x: 0,
      y: 0,
      w: boardW,
      h: boardH,
    },
  };
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, RotateCcw, X, ZoomIn } from 'lucide-react';
import { useThemeStore } from '../stores/theme';

/**
 * ImageFullscreenModal - 全屏查看大图
 *
 * 支持：滚轮缩放、点击拖拽平移、90° 旋转、重置；Esc 关闭。
 * 从 OutputNode 抽离，供 OutputNode / GuomanLoopOutputCollectorNode 等复用。
 */
export default function ImageFullscreenModal({ url, onClose }: { url: string; onClose: () => void }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0); // 仅支持 0/90/180/270
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const reset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // 键盘快捷键：Esc 关闭 / +/- 缩放 / R 旋转 / 0 重置
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') setScale((s) => Math.min(s * 1.25, 8));
      else if (e.key === '-' || e.key === '_') setScale((s) => Math.max(s / 1.25, 0.1));
      else if (e.key === 'r' || e.key === 'R') setRotation((r) => (r + 90) % 360);
      else if (e.key === '0') reset();
    };
    document.addEventListener('keydown', onKey);
    // 锁住 body 滚动，避免后面背景跟随滚动
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleWheel: React.WheelEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 1 / 1.15 : 1.15;
    setScale((s) => Math.max(0.1, Math.min(s * delta, 8)));
  };

  const onImgMouseDown: React.MouseEventHandler = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };
  const onImgMouseMove: React.MouseEventHandler = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    setPosition({
      x: dragStartRef.current.posX + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.posY + (e.clientY - dragStartRef.current.y),
    });
  };
  const onImgMouseUp: React.MouseEventHandler = (e) => {
    e.stopPropagation();
    setIsDragging(false);
  };

  const toolBtn: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 8,
    border: 'none',
    background: 'rgba(255,255,255,.10)',
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: isDark ? 'rgba(0,0,0,.96)' : 'rgba(20,20,22,.96)',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'zoom-out',
      }}
    >
      {/* 左上：缩放比例 + 旋转角度信息 */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 16, left: 16,
          color: '#fff', fontSize: 12, fontWeight: 600,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,.10)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {Math.round(scale * 100)}% · {rotation}°
      </div>

      {/* 右上：关闭按钮 (z-index 10 抬到图片之上；用 onPointerDown 而非 onClick 避免 xyflow 事件拦截) */}
      <button
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          ...toolBtn, position: 'absolute', top: 12, right: 12, width: 40, height: 40,
          zIndex: 10,
        }}
        title="关闭 (Esc)"
      >
        <X size={18} />
      </button>

      {/* 底部：工具栏（缩放/旋转/重置）z-index 10 抬到图片之上 */}
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 16, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', gap: 6, padding: 6, borderRadius: 10,
          background: 'rgba(255,255,255,.10)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
        }}
      >
        <button onClick={() => setScale((s) => Math.max(s / 1.25, 0.1))} style={toolBtn} title="缩小 (-)">
          <Minus size={16} />
        </button>
        <button onClick={() => setScale(1)} style={toolBtn} title="重置缩放">
          <span style={{ fontSize: 11, fontWeight: 700 }}>1×</span>
        </button>
        <button onClick={() => setScale((s) => Math.min(s * 1.25, 8))} style={toolBtn} title="放大 (+)">
          <ZoomIn size={16} />
        </button>
        <div style={{ width: 1, background: 'rgba(255,255,255,.18)', margin: '4px 2px' }} />
        <button onClick={() => setRotation((r) => (r + 270) % 360)} style={toolBtn} title="逆时针旋转">
          <RotateCcw size={16} />
        </button>
        <button onClick={() => setRotation((r) => (r + 90) % 360)} style={toolBtn} title="顺时针旋转 (R)">
          <span style={{ fontSize: 14, fontWeight: 700 }}>↻</span>
        </button>
        <div style={{ width: 1, background: 'rgba(255,255,255,.18)', margin: '4px 2px' }} />
        <button onClick={reset} style={toolBtn} title="全部重置 (0)">
          <span style={{ fontSize: 11, fontWeight: 700 }}>重置</span>
        </button>
      </div>

      {/* 中央：图片（旋转 + 缩放 + 平移通过 CSS transform 组合） */}
      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          onMouseDown={onImgMouseDown}
          onMouseMove={onImgMouseMove}
          onMouseUp={onImgMouseUp}
          onMouseLeave={onImgMouseUp}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '90vw', maxHeight: '90vh',
            userSelect: 'none',
            // @ts-expect-error WebkitUserDrag 是 webkit 私有属性，TypeScript CSS 类型未包含
            WebkitUserDrag: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform .12s ease-out',
          }}
        />
      </div>
    </div>,
    document.body,
  );
}

/**
 * PhotoLightbox
 *
 * Full-screen overlay for a single photo with:
 *  - Scroll-wheel zoom (desktop)
 *  - Pinch-to-zoom (mobile)
 *  - Click-and-drag pan when zoomed
 *  - Double-tap / double-click to reset zoom
 *  - Escape key to close
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_STEP = 0.3;

export function PhotoLightbox({ src, alt = "Photo", onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pinch state
  const lastPinchDist = useRef<number | null>(null);

  const clampOffset = useCallback((ox: number, oy: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x: ox, y: oy };
    const { width, height } = el.getBoundingClientRect();
    const maxX = Math.max(0, (width * s - width) / 2);
    const maxY = Math.max(0, (height * s - height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    };
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── Wheel zoom ──────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev - e.deltaY * 0.001 * ZOOM_STEP * 10));
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // ── Mouse drag ──────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, [scale]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => clampOffset(prev.x + dx, prev.y + dy, scale));
  }, [scale, clampOffset]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Double-click reset ───────────────────────────────────────────────────────
  const handleDoubleClick = useCallback(() => {
    resetZoom();
  }, [resetZoom]);

  // ── Touch events (pinch + drag) ─────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      // Double-tap detection
      const now = Date.now();
      if (now - lastTap.current < 300) {
        resetZoom();
      }
      lastTap.current = now;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [resetZoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastPinchDist.current !== null) {
        const delta = dist - lastPinchDist.current;
        setScale((prev) => {
          const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta * 0.01));
          if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
          return next;
        });
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && scale > 1) {
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setOffset((prev) => clampOffset(prev.x + dx, prev.y + dy, scale));
    }
  }, [scale, clampOffset]);

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      {/* Zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-white/10 rounded-full px-4 py-2">
        <button
          onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(1)))}
          className="text-white hover:text-white/70 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <span className="text-white text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(1)))}
          className="text-white hover:text-white/70 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: scale > 1 ? (isDragging.current ? "grabbing" : "grab") : "zoom-in" }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isDragging.current ? "none" : "transform 0.1s ease-out",
            maxWidth: "100vw",
            maxHeight: "100vh",
            objectFit: "contain",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

/**
 * InlineZoomPhoto
 *
 * Renders a photo inside a fixed-size container with:
 *  - Scroll-wheel zoom (desktop) — uses native non-passive listener so preventDefault works
 *  - Pinch-to-zoom (mobile)
 *  - Click-and-drag pan when zoomed in
 *  - Double-click / double-tap to reset
 *
 * The container clips overflow so the rest of the page is unaffected.
 */
import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;

export function InlineZoomPhoto({ src, alt = "", className = "" }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const lastTap = useRef(0);
  // Keep a ref to scale so the native wheel handler can read the latest value
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const clamp = useCallback((ox: number, oy: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x: ox, y: oy };
    const { width, height } = el.getBoundingClientRect();
    const maxX = Math.max(0, (width * (s - 1)) / 2);
    const maxY = Math.max(0, (height * (s - 1)) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    };
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // ── Wheel — native non-passive so preventDefault() actually works ─────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev - e.deltaY * 0.005));
        if (next <= MIN_SCALE) { setOffset({ x: 0, y: 0 }); return MIN_SCALE; }
        return next;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ── Mouse drag ───────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => clamp(prev.x + dx, prev.y + dy, scaleRef.current));
  }, [clamp]);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  // ── Double-click reset ───────────────────────────────────────────────────────
  const onDoubleClick = useCallback(() => reset(), [reset]);

  // ── Touch ────────────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) reset();
      lastTap.current = now;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [reset]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastPinchDist.current !== null) {
        const delta = dist - lastPinchDist.current;
        setScale((prev) => {
          const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta * 0.012));
          if (next <= MIN_SCALE) { setOffset({ x: 0, y: 0 }); return MIN_SCALE; }
          return next;
        });
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && scaleRef.current > 1) {
      const dx = e.touches[0].clientX - lastMouse.current.x;
      const dy = e.touches[0].clientY - lastMouse.current.y;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setOffset((prev) => clamp(prev.x + dx, prev.y + dy, scaleRef.current));
    }
  }, [clamp]);

  const onTouchEnd = useCallback(() => { lastPinchDist.current = null; }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden relative ${className}`}
      style={{ cursor: scale > 1 ? (isDragging.current ? "grabbing" : "grab") : "zoom-in", touchAction: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={onDoubleClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="w-full h-full object-cover select-none pointer-events-none"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: isDragging.current ? "none" : "transform 0.08s ease-out",
        }}
      />
      {scale > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); reset(); }}
          className="absolute top-1.5 right-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded hover:bg-black/80 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}

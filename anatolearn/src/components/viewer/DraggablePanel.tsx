import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface DraggablePanelProps {
  children: ReactNode;
  boundaryRef: RefObject<HTMLDivElement | null>;
  controlsRef: RefObject<OrbitControls | null>;
  initialPosition: { x: number; y: number };
  className?: string;
}

export default function DraggablePanel({
  children,
  boundaryRef,
  controlsRef,
  initialPosition,
  className = '',
}: DraggablePanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(initialPosition);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const clampPosition = (x: number, y: number) => {
    const boundary = boundaryRef.current;
    const panel = panelRef.current;
    if (!boundary || !panel) return { x, y };

    const padding = 12;
    const maxX = Math.max(padding, boundary.clientWidth - panel.offsetWidth - padding);
    const maxY = Math.max(padding, boundary.clientHeight - panel.offsetHeight - padding);

    return {
      x: Math.min(Math.max(padding, x), maxX),
      y: Math.min(Math.max(padding, y), maxY),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a')) return;

    const boundaryRect = boundaryRef.current?.getBoundingClientRect();
    if (!boundaryRect) return;

    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: event.clientX - boundaryRect.left - position.x,
      y: event.clientY - boundaryRect.top - position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (controlsRef.current) controlsRef.current.enabled = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const boundaryRect = boundaryRef.current?.getBoundingClientRect();
    if (!boundaryRect) return;

    event.preventDefault();
    event.stopPropagation();
    setPosition(
      clampPosition(
        event.clientX - boundaryRect.left - dragOffsetRef.current.x,
        event.clientY - boundaryRect.top - dragOffsetRef.current.y,
      ),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (controlsRef.current) controlsRef.current.enabled = true;
  };

  useEffect(() => {
    setPosition((current) => clampPosition(current.x, current.y));
    const handleResize = () =>
      setPosition((current) => clampPosition(current.x, current.y));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={panelRef}
      className={`absolute z-30 touch-none select-none ${className}`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

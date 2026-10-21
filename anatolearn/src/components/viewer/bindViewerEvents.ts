interface ViewerEventHandlers {
  click: (event: MouseEvent) => void;
  pointerDown: (event: PointerEvent) => void;
  pointerMove: (event: PointerEvent) => void;
  pointerUp: (event: PointerEvent) => void;
  pointerCancel: () => void;
  hover: (event: PointerEvent) => void;
  resize: () => void;
}

// A DOM-only subscription boundary; receives no scene resources.
export function bindViewerEvents(canvas: HTMLCanvasElement, handlers: ViewerEventHandlers, resizeTarget: Window = window) {
  let start: { x: number; y: number } | null = null;
  let dragged = false;
  const click = (event: MouseEvent) => { if (!dragged) handlers.click(event); };
  const down = (event: PointerEvent) => {
    dragged = start !== null;
    start = { x: event.clientX, y: event.clientY };
    handlers.pointerDown(event);
  };
  const move = (event: PointerEvent) => {
    if (start && Math.hypot(event.clientX-start.x,event.clientY-start.y) > 5) dragged = true;
    handlers.pointerMove(event);
    if (!start || !dragged) handlers.hover(event);
  };
  const up = (event: PointerEvent) => { start = null; handlers.pointerUp(event); };
  const cancel = () => { start = null; dragged = true; handlers.pointerCancel(); };
  const lostCapture = () => { if (start) cancel(); else handlers.pointerCancel(); };
  canvas.addEventListener('click', click);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', lostCapture);
  resizeTarget.addEventListener('blur', cancel);
  resizeTarget.addEventListener('resize', handlers.resize);
  return () => {
    canvas.removeEventListener('click', click);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('lostpointercapture', lostCapture);
    resizeTarget.removeEventListener('blur', cancel);
    resizeTarget.removeEventListener('resize', handlers.resize);
  };
}

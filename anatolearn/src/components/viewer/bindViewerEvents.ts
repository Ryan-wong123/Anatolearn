interface ViewerEventHandlers {
  click: (event: MouseEvent) => void;
  pointerDown: (event: PointerEvent) => void;
  pointerMove: (event: PointerEvent) => void;
  pointerUp: () => void;
  hover: (event: PointerEvent) => void;
  resize: () => void;
}

// A DOM-only subscription boundary; receives no scene resources.
export function bindViewerEvents(canvas: HTMLCanvasElement, handlers: ViewerEventHandlers, resizeTarget: Window = window) {
  canvas.addEventListener('click', handlers.click);
  canvas.addEventListener('pointerdown', handlers.pointerDown);
  canvas.addEventListener('pointermove', handlers.pointerMove);
  canvas.addEventListener('pointerup', handlers.pointerUp);
  canvas.addEventListener('pointerleave', handlers.pointerUp);
  canvas.addEventListener('pointermove', handlers.hover);
  resizeTarget.addEventListener('resize', handlers.resize);
  return () => {
    canvas.removeEventListener('click', handlers.click);
    canvas.removeEventListener('pointerdown', handlers.pointerDown);
    canvas.removeEventListener('pointermove', handlers.pointerMove);
    canvas.removeEventListener('pointerup', handlers.pointerUp);
    canvas.removeEventListener('pointerleave', handlers.pointerUp);
    canvas.removeEventListener('pointermove', handlers.hover);
    resizeTarget.removeEventListener('resize', handlers.resize);
  };
}

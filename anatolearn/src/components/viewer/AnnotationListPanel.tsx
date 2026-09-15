import type { RefObject } from 'react';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import DraggablePanel from './DraggablePanel';
import type { Annotation } from './types';

interface AnnotationListPanelProps {
  boundaryRef: RefObject<HTMLDivElement | null>;
  controlsRef: RefObject<OrbitControls | null>;
  annotations: Annotation[];
  selectedAnnotation: Annotation | null;
  open: boolean;
  modelTitle: string;
  onToggleOpen: () => void;
  onSelect: (annotation: Annotation) => void;
  onHover: (annotation: Annotation) => void;
  onHoverEnd: () => void;
}

export default function AnnotationListPanel({
  boundaryRef,
  controlsRef,
  annotations,
  selectedAnnotation,
  open,
  modelTitle,
  onToggleOpen,
  onSelect,
  onHover,
  onHoverEnd,
}: AnnotationListPanelProps) {
  return (
    <DraggablePanel
      boundaryRef={boundaryRef}
      controlsRef={controlsRef}
      initialPosition={{ x: 9999, y: 88 }}
      className="w-80 max-w-[calc(100%-3rem)]"
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm">
        <div className="flex cursor-move items-center justify-between gap-3 px-4 py-3">
          <div>
            <span className="font-display font-semibold text-slate-900">
              {modelTitle} ({annotations.length})
            </span>
            <span className="ml-2 text-xs text-slate-400">Drag</span>
          </div>
          <button
            type="button"
            onClick={onToggleOpen}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-lg leading-none text-slate-600 hover:bg-slate-50"
            aria-label={open ? 'Collapse annotations' : 'Expand annotations'}
          >
            {open ? '−' : '+'}
          </button>
        </div>

        {open && (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto border-t border-slate-100 p-3">
            {annotations.length === 0 ? (
              <p className="px-1 py-2 text-sm text-slate-400">No annotations yet.</p>
            ) : (
              annotations.map((annotation, index) => (
                <button
                  key={annotation.id ?? `${annotation.label}-${index}`}
                  onClick={() => onSelect(annotation)}
                  onMouseEnter={() => onHover(annotation)}
                  onMouseLeave={onHoverEnd}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selectedAnnotation === annotation
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-slate-300"
                      style={{
                        backgroundColor: annotation.color ?? '#2563eb',
                      }}
                    />

                    <span>
                      {index + 1}. {annotation.label}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </DraggablePanel>
  );
}

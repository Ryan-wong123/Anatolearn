import type { RefObject } from 'react';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import DraggablePanel from './DraggablePanel';
import type { Annotation } from './types';

interface AnnotationDetailsPanelProps {
  boundaryRef: RefObject<HTMLDivElement | null>;
  controlsRef: RefObject<OrbitControls | null>;
  annotation: Annotation;
  role: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function annotationTypeLabel(annotation: Annotation) {
  if (annotation.kind === 'projectedRegion') return 'Projected Region';
  if (annotation.kind === 'projectedDraw') return 'Projected Highlight';
  if (annotation.kind === 'region') return 'Legacy Filled Region';
  if (annotation.kind === 'draw') return 'Legacy Highlight';
  return 'Point Annotation';
}

export default function AnnotationDetailsPanel({
  boundaryRef,
  controlsRef,
  annotation,
  role,
  onEdit,
  onDelete,
  onClose,
}: AnnotationDetailsPanelProps) {
  return (
    <DraggablePanel
      boundaryRef={boundaryRef}
      controlsRef={controlsRef}
      initialPosition={{ x: 9999, y: 390 }}
      className="w-80 max-w-[calc(100%-3rem)]"
    >
      <div className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
        <div className="mb-3 flex cursor-move items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-display font-semibold text-slate-900">{annotation.label}</h2>
            <p className="mt-1 text-xs uppercase tracking-wider text-slate-400">
              {annotationTypeLabel(annotation)}
            </p>
          </div>
          <span className="text-xs text-slate-400">Drag</span>
        </div>

        <p className="max-h-40 overflow-y-auto text-sm text-slate-600">
          {annotation.description || 'No description.'}
        </p>

        <div className="mt-4 flex gap-2">
          {role === 'teacher' && (
            <>
              <button onClick={onEdit} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                Edit
              </button>
              <button onClick={onDelete} className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                Delete
              </button>
            </>
          )}
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
}

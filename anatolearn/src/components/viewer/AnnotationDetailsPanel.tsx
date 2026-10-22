import type { RefObject } from 'react';
import { useAppContext } from '../../context/AppContextState';
import DraggablePanel from './DraggablePanel';
import type { Annotation, LinkedVideo } from './types';

interface AnnotationDetailsPanelProps {
  boundaryRef: RefObject<HTMLDivElement | null>;
  onDragStateChange: (dragging: boolean) => void;
  annotation: Annotation;
  busy: boolean;
  linkedVideo?: LinkedVideo | null;
  onPlayVideo?: (video: LinkedVideo) => void;
  onEdit: () => void;
  onReposition: () => void;
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
  onDragStateChange,
  annotation, busy,
  linkedVideo,
  onPlayVideo,
  onEdit,
  onReposition,
  onDelete,
  onClose,
}: AnnotationDetailsPanelProps) {
  const { role } = useAppContext();
  return (
    <DraggablePanel
      boundaryRef={boundaryRef}
      onDragStateChange={onDragStateChange}
      initialPosition={{ x: 9999, y: 390 }}
      className="w-80 max-w-[calc(100%-3rem)]"
    >
      <div className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mb-3 flex cursor-move items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100">{annotation.label}</h2>
            <p className="mt-1 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {annotationTypeLabel(annotation)}
            </p>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">Drag</span>
        </div>

        <p className="max-h-40 overflow-y-auto text-sm text-slate-600 dark:text-slate-400">
          {annotation.description || 'No description.'}
        </p>

        {linkedVideo && onPlayVideo && (
          <button
            onClick={() => onPlayVideo(linkedVideo)}
            className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.8A1.5 1.5 0 004 4.12v11.76a1.5 1.5 0 002.3 1.32l9.6-5.88a1.5 1.5 0 000-2.64L6.3 2.8z" />
            </svg>
            Watch: {linkedVideo.title}
          </button>
        )}

        <div className="mt-4 flex gap-2">
          {role === 'teacher' && (
            <>
              <button disabled={busy} onClick={onReposition} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Move</button>
              <button disabled={busy} onClick={onEdit} className="text-slate-900 dark:text-slate-100 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                Edit
              </button>
              <button disabled={busy} onClick={onDelete} className="flex-1 rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40">
                Delete
              </button>
            </>
          )}
          <button onClick={onClose} className="text-slate-900 dark:text-slate-100 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            Close
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
}

import { useAppContext } from '../../context/AppContextState';

interface ViewerToolbarProps {
  addMode: boolean;
  drawMode: boolean;
  regionMode: boolean;
  annotationsVisible: boolean;
  hasNeutralView: boolean;
  darkBackground: boolean;
  onToggleBackground: () => void;
  onToggleAdd: () => void;
  onToggleDraw: () => void;
  onToggleRegion: () => void;
  onToggleAnnotations: () => void;
  onSaveNeutralView: () => void;
  onReturnToNeutralView: () => void;
}

export default function ViewerToolbar({
  addMode,
  drawMode,
  regionMode,
  annotationsVisible,
  hasNeutralView,
  darkBackground,
  onToggleBackground,
  onToggleAdd,
  onToggleDraw,
  onToggleRegion,
  onToggleAnnotations,
  onSaveNeutralView,
  onReturnToNeutralView,
}: ViewerToolbarProps) {
  const { role } = useAppContext();
  return (
    <div
      className="absolute left-4 md:left-auto right-4 top-4 z-20 flex max-h-40 overflow-y-auto max-w-[calc(100%-2rem)] flex-wrap items-center justify-end gap-2"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {role === 'teacher' && (
        <>
          <button
            onClick={onToggleAdd}
            className={`rounded-lg px-3 py-2 text-xs md:text-sm font-medium shadow-sm transition-colors ${
              addMode
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {addMode ? 'Cancel Annotation' : 'Add Annotation'}
          </button>

          <button
            onClick={onToggleDraw}
            className={`rounded-lg px-3 py-2 text-xs md:text-sm font-medium shadow-sm transition-colors ${
              drawMode
                ? 'bg-yellow-300 text-slate-900 dark:text-slate-100 hover:bg-yellow-400'
                : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {drawMode ? 'Cancel Highlight' : 'Draw Highlight'}
          </button>

          <button
            onClick={onToggleRegion}
            className={`rounded-lg px-3 py-2 text-xs md:text-sm font-medium shadow-sm transition-colors ${
              regionMode
                ? 'bg-cyan-300 text-slate-900 dark:text-slate-100 hover:bg-cyan-400'
                : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {regionMode ? 'Cancel Region' : 'Region Fill'}
          </button>
          <button
            onClick={onSaveNeutralView}
            className="text-slate-900 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {hasNeutralView
              ? 'Update Neutral View'
              : 'Set Neutral View'}
          </button>
        </>
      )}
      <button
        onClick={onReturnToNeutralView}
        disabled={false}
        className="rounded-lg border px-3 py-2 text-xs md:text-sm font-medium shadow-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        Return to Neutral View
      </button>
      <button
        onClick={onToggleAnnotations}
        className="text-slate-900 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        {annotationsVisible ? 'Hide Annotations' : 'Show Annotations'}
      </button>
      <button
        onClick={onToggleBackground}
        className="text-slate-900 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs md:text-sm font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        {darkBackground ? 'Light Background' : 'Dark Background'}
      </button>
    </div>
  );
}

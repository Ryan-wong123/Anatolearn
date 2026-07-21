interface ViewerToolbarProps {
  role: string;
  addMode: boolean;
  drawMode: boolean;
  regionMode: boolean;
  annotationsVisible: boolean;
  onToggleAdd: () => void;
  onToggleDraw: () => void;
  onToggleRegion: () => void;
  onToggleAnnotations: () => void;
}

export default function ViewerToolbar({
  role,
  addMode,
  drawMode,
  regionMode,
  annotationsVisible,
  onToggleAdd,
  onToggleDraw,
  onToggleRegion,
  onToggleAnnotations,
}: ViewerToolbarProps) {
  return (
    <div
      className="absolute right-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-end gap-2"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {role === 'teacher' && (
        <>
          <button
            onClick={onToggleAdd}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              addMode
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {addMode ? 'Cancel Annotation' : 'Add Annotation'}
          </button>

          <button
            onClick={onToggleDraw}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              drawMode
                ? 'bg-yellow-300 text-slate-900 hover:bg-yellow-400'
                : 'border border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            {drawMode ? 'Cancel Highlight' : 'Draw Highlight'}
          </button>

          <button
            onClick={onToggleRegion}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              regionMode
                ? 'bg-cyan-300 text-slate-900 hover:bg-cyan-400'
                : 'border border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            {regionMode ? 'Cancel Region' : 'Region Fill'}
          </button>
        </>
      )}

      <button
        onClick={onToggleAnnotations}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
      >
        {annotationsVisible ? 'Hide Annotations' : 'Show Annotations'}
      </button>
    </div>
  );
}

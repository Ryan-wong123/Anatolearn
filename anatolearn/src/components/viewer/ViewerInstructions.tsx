interface ViewerInstructionsProps {
  modeText: string;
  drawMode: boolean;
  regionMode: boolean;
}

export default function ViewerInstructions({
  modeText,
  drawMode,
  regionMode,
}: ViewerInstructionsProps) {
  return (
    <div className="absolute left-4 top-4 z-20 max-w-[240px] rounded-xl border border-slate-200 bg-white/90 p-3 text-sm text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400">
      <p>Left Mouse: Rotate</p>
      <p>Right Mouse: Pan</p>
      <p>Scroll: Zoom</p>
      <p className="mt-2 font-semibold text-slate-900 dark:text-slate-100">Mode: {modeText}</p>
      {drawMode && (
        <p className="mt-1 text-yellow-700 dark:text-yellow-400">Drag directly over the visible model surface.</p>
      )}
      {regionMode && (
        <p className="mt-1 text-cyan-700 dark:text-cyan-400">Draw a closed boundary over one visible surface.</p>
      )}
    </div>
  );
}

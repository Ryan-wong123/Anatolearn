export default function RegionGeneratingOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/50 backdrop-blur-[1px] dark:bg-slate-950/50">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-cyan-500" />
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">Projecting filled region...</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Creating a smooth surface mask</p>
          </div>
        </div>
      </div>
    </div>
  );
}

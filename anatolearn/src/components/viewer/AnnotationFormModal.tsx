import Dialog from '../Dialog';
interface AnnotationFormModalProps {
  isSaving: boolean;
  title: string;
  label: string;
  description: string;
  color: string;
  opacity: number;
  showColorPicker: boolean;
  showOpacitySlider: boolean;
  onLabelChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onOpacityChange: (value: number) => void;
  onCancel: () => void;
  onSave: () => void;
}

export default function AnnotationFormModal({
  isSaving,
  title,
  label,
  description,
  color,
  opacity,
  showColorPicker,
  showOpacitySlider,
  onLabelChange,
  onDescriptionChange,
  onColorChange,
  onOpacityChange,
  onCancel,
  onSave,
}: AnnotationFormModalProps) {
  return (
    <Dialog onClose={() => { if (!isSaving) onCancel(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div aria-busy={isSaving} className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Label
          </label>
          <input
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder="e.g. Masseter muscle"
            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Short explanation"
            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 h-28 w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {showColorPicker && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Fill colour
            </label>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(event) => onColorChange(event.target.value)}
                className="text-slate-900 dark:text-slate-100 h-10 w-14 cursor-pointer rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1"
              />

              <span className="text-sm text-slate-600 dark:text-slate-400">
                {color.toUpperCase()}
              </span>
            </div>
          </div>
        )}
        {showOpacitySlider && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Opacity
              </label>

              <span className="text-sm text-slate-600 dark:text-slate-400">
                {Math.round(opacity * 100)}%
              </span>
            </div>

            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(event) =>
                onOpacityChange(Number(event.target.value))
              }
              className="w-full cursor-pointer"
            />
          </div>
        )}
        <div className="mt-6 flex items-center justify-between">
          <button disabled={isSaving} onClick={onCancel} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-wait">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-wait"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

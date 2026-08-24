interface AnnotationFormModalProps {
  title: string;
  label: string;
  description: string;
  color: string;
  showColorPicker: boolean;
  onLabelChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export default function AnnotationFormModal({
  title,
  label,
  description,
  color,
  showColorPicker,
  onLabelChange,
  onDescriptionChange,
  onColorChange,
  onCancel,
  onSave,
}: AnnotationFormModalProps) {
  const isValid = label.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Label
          </label>
          <input
            aria-label="Label"
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder="e.g. Masseter muscle"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Description
          </label>
          <textarea
            aria-label="Description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Short explanation"
            className="h-28 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {showColorPicker && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Fill colour
            </label>

            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(event) => onColorChange(event.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-slate-200 bg-white p-1"
              />

              <span className="text-sm text-slate-600">
                {color.toUpperCase()}
              </span>
            </div>
          </div>
        )}
        <div className="mt-6 flex items-center justify-between">
          <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!isValid}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

import { X } from 'lucide-react';

interface UploadProgressProps {
  fraction: number;
  fileName?: string;
  onCancel: () => void;
}

// Progress bar with a cancel button for large uploads. The server may still be validating and scanning at 100%.
export default function UploadProgress({ fraction, fileName, onCancel }: UploadProgressProps) {
  const percent = Math.min(100, Math.round(fraction * 100));
  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/40">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm text-slate-800 dark:text-slate-200">
        <span className="min-w-0 truncate">{percent < 100 ? `Uploading${fileName ? ` ${fileName}` : ''}… ${percent}%` : 'Upload complete. Checking the file…'}</span>
        <button type="button" onClick={onCancel} className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
          <X className="h-3 w-3" aria-hidden="true" />Cancel
        </button>
      </div>
      <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-slate-700">
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-150" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

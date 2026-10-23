import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}

// Numbered pager with first/last, ellipses and an "x-y of n" summary. Renders nothing when everything fits on one page.
export default function Pagination({ page, pageSize, total, onPageChange, label = 'Pagination' }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const numbers = new Set([1, pages, page - 1, page, page + 1]);
  const visible = [...numbers].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const button = 'min-w-9 h-9 px-2 rounded-lg border text-sm font-medium focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <nav aria-label={label} className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">Showing {first}–{last} of {total}</p>
      <ul className="flex items-center gap-1">
        <li>
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}
            className={`${button} border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800`}><ChevronLeft className="mx-auto h-4 w-4" /></button>
        </li>
        {visible.map((n, index) => (
          <li key={n} className="flex items-center gap-1">
            {index > 0 && n - visible[index - 1] > 1 && <span aria-hidden="true" className="px-1 text-slate-500">…</span>}
            <button type="button" aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPageChange(n)}
              className={`${button} ${n === page ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'}`}>{n}</button>
          </li>
        ))}
        <li>
          <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}
            className={`${button} border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800`}><ChevronRight className="mx-auto h-4 w-4" /></button>
        </li>
      </ul>
    </nav>
  );
}

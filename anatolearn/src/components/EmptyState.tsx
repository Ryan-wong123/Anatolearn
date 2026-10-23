import type { ReactNode } from 'react';

// Friendly "nothing here" panel with an optional call to action.
export default function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-600 dark:bg-slate-900">
      {icon && <div className="mb-3 text-slate-500 dark:text-slate-400" aria-hidden="true">{icon}</div>}
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {children && <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

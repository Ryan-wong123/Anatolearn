import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  to?: string;
  hint?: string;
}

const base = 'flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900';

export default function StatCard({ label, value, icon, to, hint }: StatCardProps) {
  const content = (
    <>
      <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm text-slate-600 dark:text-slate-400">{label}</span>
        <span className="block font-display text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
        {hint && <span className="block text-xs text-slate-600 dark:text-slate-400">{hint}</span>}
      </span>
    </>
  );
  return to
    ? <Link to={to} className={`${base} transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500`}>{content}</Link>
    : <div className={base}>{content}</div>;
}

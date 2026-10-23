import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useAppContext } from '../context/AppContextState';

export interface Crumb { label: string; to?: string }

// The last crumb is the current page. Always starts from Dashboard so users can climb back out of deep pages.
// Administrators have no dashboard: their home is the Users page, so it needs no trail of its own.
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const { user } = useAppContext();
  const admin = user?.role === 'admin';
  if (admin && items.length === 1 && items[0].label === 'Users') return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-slate-600 dark:text-slate-400">
        <li className="flex items-center gap-1">
          <Link to={admin ? '/admin/users' : '/dashboard'} className="inline-flex items-center gap-1 rounded hover:text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-400"><Home className="h-3.5 w-3.5" aria-hidden="true" />{admin ? 'Users' : 'Dashboard'}</Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {item.to && index < items.length - 1
              ? <Link to={item.to} className="rounded hover:text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-400">{item.label}</Link>
              : <span aria-current="page" className="max-w-[16rem] truncate font-medium text-slate-900 dark:text-slate-100">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

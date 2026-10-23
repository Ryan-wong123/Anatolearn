import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAppContext } from '../../context/AppContextState';

export const LEGAL_LAST_UPDATED = '2026-10-23';

// Standalone shell for the public Privacy and Terms pages (they are readable before signing in).
export default function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useAppContext();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to={user ? '/dashboard' : '/login'} className="flex items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"><GraduationCap className="h-5 w-5 text-white" aria-hidden="true" /></span>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">AnatoLearn</span>
          </Link>
          <nav aria-label="Legal" className="flex gap-4 text-sm">
            <Link to="/privacy" className="rounded text-blue-700 underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400">Privacy notice</Link>
            <Link to="/terms" className="rounded text-blue-700 underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400">Terms of use</Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display">{title}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Last updated: <time dateTime={LEGAL_LAST_UPDATED}>{LEGAL_LAST_UPDATED}</time></p>
        <div className="mt-8 space-y-8 text-slate-800 dark:text-slate-200 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100 [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:space-y-1">
          {children}
        </div>
        <p className="mt-10 text-sm text-slate-600 dark:text-slate-400">
          <Link to={user ? '/dashboard' : '/login'} className="text-blue-700 underline dark:text-blue-400">{user ? 'Back to AnatoLearn' : 'Back to sign in'}</Link>
        </p>
      </main>
    </div>
  );
}

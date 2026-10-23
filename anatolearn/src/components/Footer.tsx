import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-sm text-slate-600 dark:text-slate-400 sm:flex-row sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} AnatoLearn</p>
        <nav aria-label="Legal" className="flex gap-4">
          <Link to="/privacy" className="rounded hover:text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-400">Privacy notice</Link>
          <Link to="/terms" className="rounded hover:text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-400">Terms of use</Link>
        </nav>
      </div>
    </footer>
  );
}

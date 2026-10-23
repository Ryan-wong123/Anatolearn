import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface State { failed: boolean }

// Last line of defence: a rendering bug shows a recoverable page instead of a blank screen.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Unhandled UI error', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Something went wrong</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">The page hit an unexpected problem. Your work on the server is safe. Reload to try again.</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Reload page</button>
          <a href="/dashboard" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Go to dashboard</a>
        </div>
      </main>
    );
  }
}

import { useEffect, useRef } from 'react';

interface RequestStateProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  label: string;
}

export default function RequestState({ loading, error, onRetry, label }: RequestStateProps) {
  const root = useRef<HTMLDivElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const focusAfterRetry = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!loading && focusAfterRetry.current) {
      (error ? retry.current : focusAfterRetry.current)?.focus();
      focusAfterRetry.current = null;
    }
  }, [loading,error]);
  if (!loading && !error) return null;
  return <div ref={root} className="my-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
    {loading ? <p role="status">Loading {label}…</p> : <>
      <p role="alert">Could not load {label}. {error}</p>
      <button ref={retry} type="button" onClick={()=>{focusAfterRetry.current=root.current?.closest<HTMLElement>('[role="dialog"]') ?? root.current?.closest('main') ?? null;onRetry();}} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Try again</button>
    </>}
  </div>;
}

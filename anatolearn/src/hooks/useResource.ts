import { useCallback, useEffect, useState } from 'react';
import type { SetStateAction } from 'react';

// Page-local async data: stale responses cannot overwrite a new programme/filter or retry.
export function useResource<T>(load: () => Promise<T>, initial: T, scope = '') {
  const [empty] = useState(() => initial);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: empty, error: null as string | null, loading: true, load, scope, revision });
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setState({ data: empty, error: null, loading: true, load, scope, revision });
      return load();
    }).then((data) => {
      if (active && data !== undefined) setState({ data, error: null, loading: false, load, scope, revision });
    }).catch((error: unknown) => {
      if (active) setState({ data: empty, error: error instanceof Error ? error.message : 'Could not load content. Please try again.', loading: false, load, scope, revision });
    });
    return () => { active = false; };
  }, [load, scope, revision, empty]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const setData = useCallback((value: SetStateAction<T>) => setState((current) => ({
    ...current, data: typeof value === 'function' ? (value as (previous: T) => T)(current.data) : value,
  })), []);
  const current = state.load === load && state.scope === scope && state.revision === revision;
  return {
    data: current && !state.loading && !state.error ? state.data : empty,
    setData, reload,
    loading: !current || state.loading,
    error: current ? state.error : null,
  };
}

import { useCallback, useState } from 'react';

// Current page for a list whose filters are described by `key`. Changing the key (search, filters, programme, role)
// falls back to page 1 without an effect, so a request for a stale page is never issued.
export function usePageState(key: string): [number, (page: number) => void] {
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  const setPage = useCallback((next: number) => setState({ key, page: Math.max(1, next) }), [key]);
  return [page, setPage];
}

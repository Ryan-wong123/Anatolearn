import { useCallback, useState } from 'react';
import { api, type FavoriteType } from '../../api/api';
import { useAppContext } from '../../context/AppContextState';
import { useToast } from '../../context/ToastContextState';
import { useResource } from '../../hooks/useResource';

// Students only: the ids of one content type the student has favourited, plus a toggle that updates them optimistically after the API call.
export function useFavorites(type: FavoriteType, listKey: 'videos' | 'quizzes' | 'models' | 'resources') {
  const { role, program } = useAppContext();
  const { toast } = useToast();
  const [pending, setPending] = useState<number | null>(null);
  const fetchIds = useCallback(async () => {
    if (role !== 'student') return new Set<number>();
    const data: Record<string, { id: number }[]> = await api.getFavorites();
    return new Set((data[listKey] ?? []).map((item) => item.id));
  }, [role, listKey]);
  const { data: ids, setData, loading, error, reload } = useResource<Set<number>>(fetchIds, new Set(), program);

  const toggle = async (id: number) => {
    const isFavorite = ids.has(id);
    setPending(id);
    try {
      if (isFavorite) await api.removeFavorite(type, id); else await api.addFavorite(type, id);
      setData((previous) => {
        const next = new Set(previous);
        if (isFavorite) next.delete(id); else next.add(id);
        return next;
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update favourite.', 'error');
    } finally {
      setPending(null);
    }
  };
  return { enabled: role === 'student', ids, loading, error, reload, pending, toggle };
}

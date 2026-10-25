import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../api/api';
import { useToast } from '../context/ToastContextState';

export interface OwnedItem { id: number; can_manage?: boolean; owner_name?: string | null }

// Shown to teachers under content they cannot change ("By Dr Lee, view only") or that nobody owns yet (with a Claim button).
// Renders nothing for your own content, and for students (who never receive these fields).
export default function OwnerNote({ kind, item, onChanged, className = '' }: {
  kind: 'models' | 'videos' | 'quizzes' | 'resources' | 'announcements'; item: OwnedItem; onChanged: () => void; className?: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (item.can_manage === undefined) return null;

  if (!item.can_manage) {
    return (
      <p className={`mt-2 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
        <Lock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        <span>By {item.owner_name ?? 'another teacher'}. View only: only they can change it.</span>
      </p>
    );
  }
  if (item.owner_name !== null) return null;

  async function claim(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy(true);
    try { await api.claimContent(kind, item.id); toast('You now own this. Other teachers can no longer change it.'); onChanged(); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not claim this', 'error'); }
    finally { setBusy(false); }
  }
  return (
    <p className={`mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
      <span>No owner yet, so any teacher can change it.</span>
      <button type="button" onClick={claim} disabled={busy} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
        {busy ? 'Claiming…' : 'Claim'}
      </button>
    </p>
  );
}

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import RequestState from '../components/RequestState';
import Modal from '../components/account/Modal';
import { markAnnouncementsSeen } from '../components/announcementsSeen';
import { errorBox, inputClass, labelClass, primaryButton, secondaryButton } from '../components/account/styles';
import { formatDateTime, toLocalInput } from '../components/account/time';
import { useResource } from '../hooks/useResource';
import { useAppContext } from '../context/AppContextState';
import { useConfirm } from '../context/ConfirmContextState';
import { useToast } from '../context/ToastContextState';
import { api } from '../api/api';
import type { Announcement } from '../types/portal';

type Programme = { id: number; name: string };
const smallButton = 'inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

function AnnouncementDialog({ existing, programmes, onClose, onSaved }: { existing: Announcement | null; programmes: Programme[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [programId, setProgramId] = useState(existing?.program_id == null ? '' : String(existing.program_id));
  const [expires, setExpires] = useState(toLocalInput(existing?.expires_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) { setError('A title is required'); return; }
    if (!body.trim()) { setError('A message is required'); return; }
    if (body.length > 5000) { setError('The message must be 5000 characters or fewer'); return; }
    if (expires && Number.isNaN(new Date(expires).getTime())) { setError('The expiry date is not valid'); return; }
    const payload = { title: title.trim(), body: body.trim(), program_id: programId ? Number(programId) : null, expires_at: expires ? new Date(expires).toISOString() : null };
    setBusy(true);
    try {
      if (existing) await api.updateAnnouncement(existing.id, payload); else await api.createAnnouncement(payload);
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the announcement'); setBusy(false); }
  }

  return (
    <Modal title={existing ? 'Edit announcement' : 'New announcement'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="announcement-title" className={labelClass}>Title</label>
          <input id="announcement-title" required maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="announcement-body" className={labelClass}>Message</label>
          <textarea id="announcement-body" required rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
          <p className="mt-1 text-right text-xs text-slate-600 dark:text-slate-400">{body.length}/5000</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="announcement-programme" className={labelClass}>Audience</label>
            <select id="announcement-programme" value={programId} onChange={(e) => setProgramId(e.target.value)} className={inputClass}>
              <option value="">All programmes</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="announcement-expiry" className={labelClass}>Hide after (optional)</label>
            <input id="announcement-expiry" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} className={inputClass} />
          </div>
        </div>
        {error && <p role="alert" className={errorBox}>{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Publish'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Announcements() {
  const { role } = useAppContext();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const isTeacher = role === 'teacher';
  const { data, loading, error, reload } = useResource<Announcement[]>(api.getAnnouncements, []);
  const { data: programmes } = useResource<Programme[]>(api.getPrograms, []);
  const [editing, setEditing] = useState<Announcement | null | 'new'>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => { markAnnouncementsSeen(); }, []);

  const programmeName = (id: number | null) => (id === null ? 'All programmes' : programmes.find((p) => p.id === id)?.name ?? 'One programme');

  async function remove(item: Announcement) {
    if (!(await confirm({ title: 'Delete this announcement?', message: `“${item.title}” will be removed for everyone.`, confirmLabel: 'Delete', danger: true }))) return;
    try { await api.deleteAnnouncement(item.id); toast('Announcement deleted'); reload(); }
    catch (err) { toast(err instanceof Error ? err.message : 'Could not delete the announcement', 'error'); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Announcements' }]} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">Announcements</h1>
        {isTeacher && <button type="button" onClick={() => setEditing('new')} className={primaryButton}><Plus className="h-4 w-4" aria-hidden="true" />New announcement</button>}
      </div>

      <RequestState loading={loading} error={error} onRetry={reload} label="announcements" />
      {!loading && !error && data.length === 0 && (
        <EmptyState icon={<Megaphone className="h-10 w-10" />} title="No announcements">
          {isTeacher ? 'Post an announcement to tell students about changes, deadlines or new content.' : 'There is nothing new right now. Check back later.'}
        </EmptyState>
      )}
      <ul className="space-y-4">
        {data.map((item) => {
          const expired = item.expires_at !== null && new Date(item.expires_at).getTime() < now;
          return (
            <li key={item.id}>
              <article aria-labelledby={`announcement-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <h2 id={`announcement-${item.id}`} className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">{item.title}</h2>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-200">{programmeName(item.program_id)}</span>
                </header>
                {/* React escapes text; whitespace-pre-wrap keeps the author's line breaks without ever parsing HTML. */}
                <p className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">{item.body}</p>
                <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <p>
                    {item.author ? `Posted by ${item.author} · ` : ''}<time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
                    {item.expires_at && <> · {expired ? 'Expired' : 'Visible until'} <time dateTime={item.expires_at}>{formatDateTime(item.expires_at)}</time></>}
                  </p>
                  {isTeacher && item.can_manage !== false && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(item)} aria-label={`Edit ${item.title}`} className={smallButton}><Pencil className="h-3 w-3" aria-hidden="true" />Edit</button>
                      <button type="button" onClick={() => remove(item)} aria-label={`Delete ${item.title}`} className={`${smallButton} !text-red-700 dark:!text-red-300`}><Trash2 className="h-3 w-3" aria-hidden="true" />Delete</button>
                    </div>
                  )}
                </footer>
              </article>
            </li>
          );
        })}
      </ul>

      {editing && <AnnouncementDialog existing={editing === 'new' ? null : editing} programmes={programmes} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); toast('Announcement saved'); reload(); }} />}
    </div>
  );
}

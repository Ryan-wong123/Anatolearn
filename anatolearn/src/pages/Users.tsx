import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { KeyRound, Lock, Pencil, Plus, Power, Trash2, Unlock } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import RequestState from '../components/RequestState';
import Modal from '../components/account/Modal';
import TemporaryPasswordDialog from '../components/account/TemporaryPasswordDialog';
import { cardClass, errorBox, inputClass, labelClass, passwordProblem, primaryButton, secondaryButton } from '../components/account/styles';
import { formatDateTime, relativeTime } from '../components/account/time';
import { useResource } from '../hooks/useResource';
import { useAppContext } from '../context/AppContextState';
import { useConfirm } from '../context/ConfirmContextState';
import { useToast } from '../context/ToastContextState';
import { api } from '../api/api';
import type { AuditEntry, Paged, UserSummary } from '../types/portal';

type Programme = { id: number; name: string };
type Tab = 'accounts' | 'audit';

const USERS_PAGE_SIZE = 25;
const AUDIT_PAGE_SIZE = 50;
const EMPTY_USERS: Paged<UserSummary> = { items: [], total: 0 };
const EMPTY_AUDIT: Paged<AuditEntry> = { items: [], total: 0 };
const selectClass = `${inputClass} sm:w-auto`;
const smallButton = 'inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function StatusBadge({ user }: { user: UserSummary }) {
  const [label, color] = !user.is_active ? ['Disabled', 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100']
    : user.is_locked ? ['Locked', 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200']
    : ['Active', 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200'];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}

function CreateDialog({ programmes, onClose, onCreated }: { programmes: Programme[]; onClose: () => void; onCreated: (user: UserSummary, temporaryPassword?: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [programId, setProgramId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return; }
    if (password) { const problem = passwordProblem(password); if (problem) { setError(problem); return; } }
    setBusy(true);
    try {
      const result = await api.createUser({ name: name.trim(), email: email.trim(), role, program_id: programId ? Number(programId) : null, ...(password ? { password } : {}) });
      onCreated(result.user, result.temporary_password);
    } catch (err) { setError(errorMessage(err, 'Could not create the account')); setBusy(false); }
  }

  return (
    <Modal title="Create account" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="new-user-name" className={labelClass}>Name</label>
          <input id="new-user-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-user-email" className={labelClass}>Email</label>
          <input id="new-user-email" type="email" autoComplete="off" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-user-role" className={labelClass}>Role</label>
            <select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as 'student' | 'teacher')} className={inputClass}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          <div>
            <label htmlFor="new-user-programme" className={labelClass}>Programme</label>
            <select id="new-user-programme" value={programId} onChange={(e) => setProgramId(e.target.value)} className={inputClass}>
              <option value="">None</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="new-user-password" className={labelClass}>Password (optional)</label>
          <input id="new-user-password" type="password" autoComplete="new-password" aria-describedby="new-user-password-note" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          <p id="new-user-password-note" className="mt-1 text-xs text-slate-600 dark:text-slate-400">Leave empty to generate a temporary password that you can share once.</p>
        </div>
        {error && <p role="alert" className={errorBox}>{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Creating…' : 'Create account'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({ user, programmes, isSelf, onClose, onSaved }: { user: UserSummary; programmes: Programme[]; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [programId, setProgramId] = useState(user.program_id === null ? '' : String(user.program_id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setBusy(true); setError(null);
    try {
      await api.updateUser(user.id, { name: name.trim(), role, program_id: programId ? Number(programId) : null });
      onSaved();
    } catch (err) { setError(errorMessage(err, 'Could not save changes')); setBusy(false); }
  }

  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="edit-user-name" className={labelClass}>Name</label>
          <input id="edit-user-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-user-role" className={labelClass}>Role</label>
            <select id="edit-user-role" value={role} disabled={isSelf} aria-describedby={isSelf ? 'edit-user-self' : undefined} onChange={(e) => setRole(e.target.value as 'student' | 'teacher')} className={inputClass}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
            {isSelf && <p id="edit-user-self" className="mt-1 text-xs text-slate-600 dark:text-slate-400">You cannot change your own role.</p>}
          </div>
          <div>
            <label htmlFor="edit-user-programme" className={labelClass}>Programme</label>
            <select id="edit-user-programme" value={programId} onChange={(e) => setProgramId(e.target.value)} className={inputClass}>
              <option value="">None</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">Email: {user.email}. Changing someone's role signs them out of all devices.</p>
        {error && <p role="alert" className={errorBox}>{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AccountsTab({ programmes }: { programmes: Programme[] }) {
  const { user: me } = useAppContext();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [shown, setShown] = useState<{ account: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => api.getUsers({ page, pageSize: USERS_PAGE_SIZE, q, role: roleFilter, status: statusFilter }), [page, q, roleFilter, statusFilter]);
  const { data, loading, error, reload } = useResource<Paged<UserSummary>>(load, EMPTY_USERS, `${page}|${q}|${roleFilter}|${statusFilter}`);
  const programmeName = (id: number | null) => (id === null ? '—' : programmes.find((p) => p.id === id)?.name ?? `#${id}`);

  async function run(user: UserSummary, action: () => Promise<unknown>, success: string) {
    setBusyId(user.id);
    try { await action(); toast(success); reload(); }
    catch (err) { toast(errorMessage(err, 'That action could not be completed'), 'error'); }
    finally { setBusyId(null); }
  }

  async function toggleActive(user: UserSummary) {
    if (user.is_active && !(await confirm({ title: `Disable ${user.name}?`, message: 'They will be signed out everywhere and unable to sign in until you enable the account again.', confirmLabel: 'Disable account', danger: true }))) return;
    await run(user, () => api.updateUser(user.id, { is_active: !user.is_active }), user.is_active ? 'Account disabled' : 'Account enabled');
  }

  async function resetPassword(user: UserSummary) {
    if (!(await confirm({ title: `Reset password for ${user.name}?`, message: 'A new temporary password is generated and they are signed out everywhere. The old password stops working immediately.', confirmLabel: 'Reset password', danger: true }))) return;
    setBusyId(user.id);
    try {
      const result = await api.resetUserPassword(user.id);
      if (result.temporary_password) setShown({ account: user.name, password: result.temporary_password });
      reload();
    } catch (err) { toast(errorMessage(err, 'Could not reset the password'), 'error'); }
    finally { setBusyId(null); }
  }

  async function remove(user: UserSummary) {
    if (!(await confirm({ title: `Delete ${user.name}?`, message: 'The account, favourites and activity are permanently removed. Past quiz attempts are kept without a name.', confirmLabel: 'Delete account', danger: true }))) return;
    await run(user, () => api.deleteUser(user.id), 'Account deleted');
  }

  function changeFilter(update: () => void) { update(); setPage(1); }

  return (
    <div role="tabpanel" id="panel-accounts" aria-labelledby="tab-accounts" tabIndex={0} className="focus:outline-none">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="sm:min-w-64 sm:flex-1">
          <label htmlFor="user-search" className={labelClass}>Search accounts</label>
          <input id="user-search" type="search" placeholder="Name or email" value={search} onChange={(e) => changeFilter(() => setSearch(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label htmlFor="user-role-filter" className={labelClass}>Role</label>
          <select id="user-role-filter" value={roleFilter} onChange={(e) => changeFilter(() => setRoleFilter(e.target.value))} className={selectClass}>
            <option value="">All roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
          </select>
        </div>
        <div>
          <label htmlFor="user-status-filter" className={labelClass}>Status</label>
          <select id="user-status-filter" value={statusFilter} onChange={(e) => changeFilter(() => setStatusFilter(e.target.value))} className={selectClass}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="locked">Locked</option>
          </select>
        </div>
        <button type="button" onClick={() => setCreating(true)} className={primaryButton}><Plus className="h-4 w-4" aria-hidden="true" />Create account</button>
      </div>

      <RequestState loading={loading} error={error} onRetry={reload} label="accounts" />
      {!loading && !error && data.items.length === 0 && (
        <EmptyState title="No accounts found">{q || roleFilter || statusFilter ? 'Try different filters or clear the search.' : 'Create the first account to get started.'}</EmptyState>
      )}
      {data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">User accounts, page {page}</caption>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Programme</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Last sign-in</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 dark:divide-slate-700 dark:text-slate-200">
              {data.items.map((user) => {
                const isSelf = user.id === me?.id;
                const busy = busyId === user.id;
                return (
                  <tr key={user.id}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {user.name}{isSelf && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-900 dark:bg-blue-900/40 dark:text-blue-200">You</span>}
                      <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">{user.email}</span>
                    </th>
                    <td className="px-4 py-3 capitalize">{user.role}</td>
                    <td className="px-4 py-3">{programmeName(user.program_id)}</td>
                    <td className="px-4 py-3"><StatusBadge user={user} /></td>
                    <td className="px-4 py-3" title={formatDateTime(user.last_login_at)}>{user.last_login_at ? relativeTime(user.last_login_at) : 'Never'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" disabled={busy} onClick={() => setEditing(user)} aria-label={`Edit ${user.name}`} className={smallButton}><Pencil className="h-3 w-3" aria-hidden="true" />Edit</button>
                        {user.is_locked && <button type="button" disabled={busy} onClick={() => run(user, () => api.updateUser(user.id, { unlock: true }), 'Account unlocked')} aria-label={`Unlock ${user.name}`} className={smallButton}><Unlock className="h-3 w-3" aria-hidden="true" />Unlock</button>}
                        <button type="button" disabled={busy || isSelf} title={isSelf ? 'You cannot disable your own account' : undefined} onClick={() => toggleActive(user)} aria-label={`${user.is_active ? 'Disable' : 'Enable'} ${user.name}`} className={smallButton}>
                          {user.is_active ? <Lock className="h-3 w-3" aria-hidden="true" /> : <Power className="h-3 w-3" aria-hidden="true" />}{user.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" disabled={busy} onClick={() => resetPassword(user)} aria-label={`Reset password for ${user.name}`} className={smallButton}><KeyRound className="h-3 w-3" aria-hidden="true" />Reset password</button>
                        <button type="button" disabled={busy || isSelf} title={isSelf ? 'Use your profile page to delete your own account' : undefined} onClick={() => remove(user)} aria-label={`Delete ${user.name}`} className={`${smallButton} !text-red-700 dark:!text-red-300`}><Trash2 className="h-3 w-3" aria-hidden="true" />Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={USERS_PAGE_SIZE} total={data.total} onPageChange={setPage} label="Accounts pagination" />

      {creating && <CreateDialog programmes={programmes} onClose={() => setCreating(false)} onCreated={(user, temporary) => {
        setCreating(false); reload(); toast('Account created');
        if (temporary) setShown({ account: user.name, password: temporary });
      }} />}
      {editing && <EditDialog user={editing} programmes={programmes} isSelf={editing.id === me?.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); toast('Account updated'); }} />}
      {shown && <TemporaryPasswordDialog account={shown.account} password={shown.password} onClose={() => setShown(null)} />}
    </div>
  );
}

function AuditTab() {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const action = useDebounced(filter.trim());
  const load = useCallback(() => api.getAuditLog({ page, pageSize: AUDIT_PAGE_SIZE, action }), [page, action]);
  const { data, loading, error, reload } = useResource<Paged<AuditEntry>>(load, EMPTY_AUDIT, `${page}|${action}`);

  return (
    <div role="tabpanel" id="panel-audit" aria-labelledby="tab-audit" tabIndex={0} className="focus:outline-none">
      <div className="mb-4 max-w-md">
        <label htmlFor="audit-filter" className={labelClass}>Filter by action</label>
        <input id="audit-filter" type="search" placeholder="e.g. auth. or POST /quizzes" aria-describedby="audit-filter-note" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className={inputClass} />
        <p id="audit-filter-note" className="mt-1 text-xs text-slate-600 dark:text-slate-400">Matches the start of the action name. Examples: auth., user., profile., PATCH, DELETE.</p>
      </div>
      <RequestState loading={loading} error={error} onRetry={reload} label="the audit log" />
      {!loading && !error && data.items.length === 0 && <EmptyState title="No matching entries">Nothing has been recorded for this filter yet.</EmptyState>}
      {data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Audit log, page {page}</caption>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-4 py-3">When</th>
                <th scope="col" className="px-4 py-3">Who</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Target</th>
                <th scope="col" className="px-4 py-3">IP address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 dark:divide-slate-700 dark:text-slate-200">
              {data.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <time dateTime={entry.created_at} title={formatDateTime(entry.created_at)}>{relativeTime(entry.created_at)}</time>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{formatDateTime(entry.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">{entry.actor_name ?? <span className="text-slate-600 dark:text-slate-400">Unknown</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-3">{entry.target_type ? `${entry.target_type}${entry.target_id ? ` #${entry.target_id}` : ''}` : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={AUDIT_PAGE_SIZE} total={data.total} onPageChange={setPage} label="Audit log pagination" />
    </div>
  );
}

export default function Users() {
  const [tab, setTab] = useState<Tab>('accounts');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ accounts: null, audit: null });
  const { data: programmes } = useResource<Programme[]>(api.getPrograms, []);
  const tabs: { id: Tab; label: string }[] = [{ id: 'accounts', label: 'Accounts' }, { id: 'audit', label: 'Audit log' }];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((t) => t.id === tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Users' }]} />
      <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">Users</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">Create and manage accounts, unlock people who were locked out, and review what teachers and the system have changed.</p>
      <div className={`${cardClass} !p-4 sm:!p-6`}>
        <div role="tablist" aria-label="User administration" className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {tabs.map((t) => (
            <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)} onKeyDown={onKeyDown}
              className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-blue-500 ${tab === t.id ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'accounts' ? <AccountsTab programmes={programmes} /> : <AuditTab />}
      </div>
    </div>
  );
}

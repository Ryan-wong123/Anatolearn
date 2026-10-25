import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Moon, Sun, Trash2 } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import RequestState from '../components/RequestState';
import Modal from '../components/account/Modal';
import MfaCard from '../components/account/MfaCard';
import { cardClass, dangerButton, errorBox, inputClass, labelClass, passwordProblem, passwordRules, primaryButton, secondaryButton, successBox } from '../components/account/styles';
import { formatDate, formatDateTime } from '../components/account/time';
import { useResource } from '../hooks/useResource';
import { useAppContext } from '../context/AppContextState';
import { useToast } from '../context/ToastContextState';
import { api } from '../api/api';
import type { Profile as ProfileRecord } from '../types/portal';

type Programme = { id: number; name: string };

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function DetailsCard({ profile, programmes, onSaved }: { profile: ProfileRecord; programmes: Programme[]; onSaved: (next: ProfileRecord) => void }) {
  const { updateUser } = useAppContext();
  const [name, setName] = useState(profile.name);
  const [programId, setProgramId] = useState(profile.program_id === null ? '' : String(profile.program_id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isTeacher = profile.role === 'teacher';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null); setSaved(false);
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const next = await api.updateProfile({ name: name.trim(), ...(isTeacher ? { program_id: programId ? Number(programId) : null } : {}) });
      updateUser({ name: next.name, program_id: next.program_id });
      onSaved(next);
      setSaved(true);
    } catch (err) { setError(message(err, 'Could not save your profile')); }
    finally { setSaving(false); }
  }

  return (
    <section aria-labelledby="details-heading" className={cardClass}>
      <h2 id="details-heading" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Account details</h2>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="profile-name" className={labelClass}>Name</label>
          <input id="profile-name" autoComplete="name" required maxLength={255} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} className={inputClass} />
        </div>
        <div>
          <label htmlFor="profile-email" className={labelClass}>Email</label>
          <input id="profile-email" readOnly value={profile.email} aria-describedby="email-note" className={`${inputClass} bg-slate-50 dark:bg-slate-800`} />
          <p id="email-note" className="mt-1 text-xs text-slate-600 dark:text-slate-400">Your email is your sign-in name and cannot be changed here. Ask an administrator if it needs correcting.</p>
        </div>
        <div>
          <label htmlFor="profile-role" className={labelClass}>Role</label>
          <input id="profile-role" readOnly value={profile.role === 'admin' ? 'Administrator' : isTeacher ? 'Teacher' : 'Student'} className={`${inputClass} bg-slate-50 dark:bg-slate-800`} />
        </div>
        {profile.role !== 'admin' && <div>
          <label htmlFor="profile-programme" className={labelClass}>Programme</label>
          {isTeacher ? (
            <select id="profile-programme" value={programId} onChange={(e) => { setProgramId(e.target.value); setSaved(false); }} className={inputClass}>
              <option value="">All programmes</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <>
              <input id="profile-programme" readOnly value={profile.program_name ?? 'Not assigned'} aria-describedby="programme-note" className={`${inputClass} bg-slate-50 dark:bg-slate-800`} />
              <p id="programme-note" className="mt-1 text-xs text-slate-600 dark:text-slate-400">Your programme decides which learning content you can see. An administrator can change it.</p>
            </>
          )}
        </div>}
        <dl className="grid grid-cols-1 gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
          <div><dt className="font-medium">Last sign-in</dt><dd>{formatDateTime(profile.last_login_at)}</dd></div>
          <div><dt className="font-medium">Member since</dt><dd>{formatDate(profile.created_at)}</dd></div>
        </dl>
        {error && <p role="alert" className={errorBox}>{error}</p>}
        {saved && <p role="status" className={successBox}>Profile saved.</p>}
        <button type="submit" disabled={saving} className={primaryButton}>{saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </section>
  );
}

function PasswordCard({ role }: { role: ProfileRecord['role'] }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null); setDone(null);
    const problem = passwordProblem(next, role);
    if (problem) { setError(problem); return; }
    if (next !== confirm) { setError('New passwords do not match'); return; }
    if (next === current) { setError('Choose a password different from your current one'); return; }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setDone('Password updated. Any other devices where you were signed in have been signed out.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) { setError(message(err, 'Could not change your password')); }
    finally { setSaving(false); }
  }

  return (
    <section aria-labelledby="password-heading" className={cardClass}>
      <h2 id="password-heading" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Change password</h2>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="current-password" className={labelClass}>Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-password" className={labelClass}>New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required aria-describedby="new-password-rules" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
          <p id="new-password-rules" className="mt-1 text-xs text-slate-600 dark:text-slate-400">{passwordRules(role)}</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className={labelClass}>Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className={errorBox}>{error}</p>}
        {done && <p role="status" className={successBox}>{done}</p>}
        <button type="submit" disabled={saving || !current || !next || !confirm} className={primaryButton}>{saving ? 'Updating…' : 'Update password'}</button>
      </form>
    </section>
  );
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { logout } = useAppContext();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) { setError('Enter your password to confirm'); return; }
    setBusy(true); setError(null);
    try {
      await api.deleteMyAccount(password);
    } catch (err) {
      setError(message(err, 'Could not delete your account'));
      setBusy(false);
      return;
    }
    // The server already revoked the session and cleared the cookies; this just resets local state.
    try { await logout(); } catch { sessionStorage.removeItem('anatolearn_user'); }
    navigate('/login', { replace: true });
  }

  return (
    <Modal title="Delete your account?" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          This permanently removes your account, favourites and activity history. Your past quiz attempts are kept without your name so teachers' statistics stay accurate. This cannot be undone.
        </p>
        <div>
          <label htmlFor="delete-password" className={labelClass}>Confirm with your password</label>
          <input id="delete-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className={errorBox}>{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
          <button type="submit" disabled={busy} className={dangerButton}>{busy ? 'Deleting…' : 'Delete my account'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Profile() {
  const { theme, toggleTheme } = useAppContext();
  const { toast } = useToast();
  const profileState = useResource<ProfileRecord | null>(api.getProfile, null);
  const programmesState = useResource<Programme[]>(api.getPrograms, []);
  const [override, setOverride] = useState<ProfileRecord | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const profile = override ?? profileState.data;

  async function exportData() {
    setExporting(true);
    try { await api.exportMyData(); toast('Your data export has been downloaded'); }
    catch (err) { toast(message(err, 'Could not export your data'), 'error'); }
    finally { setExporting(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Profile' }]} />
      <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">My profile</h1>
      <RequestState loading={profileState.loading} error={profileState.error} onRetry={profileState.reload} label="your profile" />
      {profile && (
        <div className="space-y-6">
          <DetailsCard key={profile.id} profile={profile} programmes={programmesState.data} onSaved={setOverride} />

          <section aria-labelledby="appearance-heading" className={cardClass}>
            <h2 id="appearance-heading" className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Appearance</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Choose a light or dark theme. Your choice is remembered on this device.</p>
            <button type="button" onClick={toggleTheme} aria-pressed={theme === 'dark'} className={secondaryButton}>
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            </button>
          </section>

          <PasswordCard role={profile.role} />

          {profile.role !== 'student' && <MfaCard profile={profile} onChanged={(patch) => setOverride({ ...profile, ...patch })} />}

          <section aria-labelledby="privacy-heading" className={cardClass}>
            <h2 id="privacy-heading" className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Your data</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Download a copy of your account details, quiz attempts and answers, favourites, activity and model downloads as a JSON file.</p>
            <button type="button" onClick={exportData} disabled={exporting} className={secondaryButton}>
              <Download className="h-4 w-4" aria-hidden="true" />{exporting ? 'Preparing…' : 'Download my data'}
            </button>
          </section>

          <section aria-labelledby="danger-heading" className="rounded-xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-800 dark:bg-slate-900">
            <h2 id="danger-heading" className="mb-2 text-lg font-semibold text-red-700 dark:text-red-400 font-display">Delete account</h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Permanently delete your account and personal data. You will be signed out on all devices.</p>
            <button type="button" onClick={() => setDeleting(true)} className={dangerButton}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete my account…</button>
          </section>
        </div>
      )}
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </div>
  );
}

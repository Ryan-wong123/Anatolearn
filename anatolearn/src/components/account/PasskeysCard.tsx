import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { KeyRound, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { cardClass, dangerButton, errorBox, inputClass, labelClass, primaryButton, secondaryButton, successBox } from './styles';
import { useAppContext } from '../../context/AppContextState';
import { useResource } from '../../hooks/useResource';
import { api } from '../../api/api';
import type { Passkey, Profile } from '../../types/portal';

const NONE: { passkeys: Passkey[] } = { passkeys: [] };
const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
const when = (value: string | null) => (value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'never');

export default function PasskeysCard({ profile, onChanged }: { profile: Profile; onChanged: (patch: Partial<Profile>) => void }) {
  const { updateUser } = useAppContext();
  const load = useCallback(() => api.getPasskeys(), []);
  const { data, reload } = useResource<{ passkeys: Passkey[] }>(load, NONE);
  const passkeys = data.passkeys;
  const [dialog, setDialog] = useState<{ kind: 'add' } | { kind: 'remove'; passkey: Passkey } | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const supported = browserSupportsWebAuthn();

  function close() { setDialog(null); setPassword(''); setName(''); setError(null); setBusy(false); }

  async function add(event: FormEvent) {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      const options = await api.passkeyRegistrationOptions(password);
      const response = await startRegistration({ optionsJSON: options });
      await api.registerPasskey(name.trim() || 'Passkey', response);
      onChanged({ passkey_count: profile.passkey_count + 1, mfa_enabled: true });
      updateUser({ mfa_setup_required: false });
      close(); reload();
      setNotice('Passkey added. Other devices were signed out.');
    } catch (err) {
      const cancelled = err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError');
      setError(cancelled ? 'The passkey prompt was cancelled or timed out.' : err instanceof Error && err.name === 'InvalidStateError' ? 'This device already has a passkey for your account.' : message(err, 'Could not add the passkey'));
      setBusy(false);
    }
  }

  async function remove(event: FormEvent) {
    event.preventDefault();
    if (dialog?.kind !== 'remove') return;
    setError(null); setBusy(true);
    try {
      await api.removePasskey(dialog.passkey.id, password);
      const left = profile.passkey_count - 1;
      onChanged({ passkey_count: left, mfa_enabled: profile.totp_enabled || left > 0 });
      close(); reload();
      setNotice('Passkey removed.');
    } catch (err) { setError(message(err, 'Could not remove the passkey')); setBusy(false); }
  }

  return (
    <section aria-labelledby="passkeys-heading" className={cardClass}>
      <h2 id="passkeys-heading" className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
        <KeyRound className="h-5 w-5" aria-hidden="true" />Passkeys
      </h2>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        A passkey uses your device's fingerprint, face or screen lock (or a security key) as your second step after the password. It only works on this site, so a fake sign-in page cannot capture it.
      </p>
      {notice && <p role="status" className={`${successBox} mb-4`}>{notice}</p>}
      {passkeys.length > 0 && (
        <ul className="mb-4 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700" data-testid="passkey-list">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{passkey.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Added {when(passkey.created_at)} · last used {when(passkey.last_used_at)}{passkey.backed_up ? ' · synced' : ''}</p>
              </div>
              <button type="button" onClick={() => { setNotice(null); setDialog({ kind: 'remove', passkey }); }} aria-label={`Remove passkey ${passkey.name}`} className={secondaryButton}><Trash2 className="h-4 w-4" aria-hidden="true" />Remove</button>
            </li>
          ))}
        </ul>
      )}
      {supported
        ? <button type="button" onClick={() => { setNotice(null); setDialog({ kind: 'add' }); }} className={primaryButton}>Add a passkey…</button>
        : <p className="text-sm text-slate-600 dark:text-slate-400">This browser does not support passkeys.</p>}

      {dialog?.kind === 'add' && (
        <Modal title="Add a passkey" onClose={close}>
          <form onSubmit={add} className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">Confirm your password, then follow your browser's prompt.</p>
            <div>
              <label htmlFor="passkey-name" className={labelClass}>Name (so you can tell them apart)</label>
              <input id="passkey-name" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Work laptop" className={inputClass} />
            </div>
            <div>
              <label htmlFor="passkey-password" className={labelClass}>Password</label>
              <input id="passkey-password" type="password" autoComplete="current-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            {error && <p role="alert" className={errorBox}>{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={close} className={secondaryButton}>Cancel</button>
              <button type="submit" disabled={busy || !password} className={primaryButton}>{busy ? 'Waiting for your device…' : 'Continue'}</button>
            </div>
          </form>
        </Modal>
      )}
      {dialog?.kind === 'remove' && (
        <Modal title={`Remove ${dialog.passkey.name}?`} onClose={close}>
          <form onSubmit={remove} className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              You will be signed out on other devices.{profile.mfa_required && profile.passkey_count <= 1 && !profile.totp_enabled ? ' Your role requires two-factor authentication, so add an authenticator app or another passkey first.' : ''}
            </p>
            <div>
              <label htmlFor="passkey-remove-password" className={labelClass}>Password</label>
              <input id="passkey-remove-password" type="password" autoComplete="current-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            {error && <p role="alert" className={errorBox}>{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={close} className={secondaryButton}>Cancel</button>
              <button type="submit" disabled={busy || !password} className={dangerButton}>{busy ? 'Working…' : 'Remove'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

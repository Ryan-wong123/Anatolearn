import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import { cardClass, dangerButton, errorBox, inputClass, labelClass, primaryButton, secondaryButton, successBox } from './styles';
import { useAppContext } from '../../context/AppContextState';
import { api } from '../../api/api';
import type { Profile } from '../../types/portal';

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const text = codes.join('\n');
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied('yes'); } catch { setCopied('no'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`AnatoLearn recovery codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'anatolearn-recovery-codes.txt' });
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div>
      <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">
        Save these recovery codes somewhere safe, such as a password manager. Each one works <strong>once</strong> if you lose your phone. They are shown only now.
      </p>
      <ul className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" data-testid="recovery-codes">
        {codes.map((code) => <li key={code} className="select-all">{code}</li>)}
      </ul>
      <p role="status" className="min-h-5 text-sm text-slate-700 dark:text-slate-300">
        {copied === 'yes' && 'Copied to clipboard.'}{copied === 'no' && 'Could not copy automatically. Select the codes and copy them manually.'}
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={copy} className={secondaryButton}><Copy className="h-4 w-4" aria-hidden="true" />Copy</button>
        <button type="button" onClick={download} className={secondaryButton}><Download className="h-4 w-4" aria-hidden="true" />Download</button>
        <button type="button" onClick={onDone} className={primaryButton}>I have saved them</button>
      </div>
    </div>
  );
}

// Asks for the password and a current code before a sensitive change.
function ConfirmDialog({ title, intro, action, submitLabel, danger, onClose, onDone }: {
  title: string; intro: string; submitLabel: string; danger?: boolean;
  action: (password: string, code: string) => Promise<unknown>; onClose: () => void; onDone: (result: unknown) => void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null); setBusy(true);
    try { onDone(await action(password, code.trim())); }
    catch (err) { setError(message(err, 'Could not complete this change')); setBusy(false); }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">{intro}</p>
        <div>
          <label htmlFor="mfa-confirm-password" className={labelClass}>Password</label>
          <input id="mfa-confirm-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="mfa-confirm-code" className={labelClass}>Authentication or recovery code</label>
          <input id="mfa-confirm-code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={32} value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className={errorBox}>{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
          <button type="submit" disabled={busy || !password || !code.trim()} className={danger ? dangerButton : primaryButton}>{busy ? 'Working…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

type Step = { name: 'idle' } | { name: 'password' } | { name: 'scan'; secret: string; uri: string } | { name: 'codes'; codes: string[] };

export default function MfaCard({ profile, onChanged }: { profile: Profile; onChanged: (patch: Partial<Profile>) => void }) {
  const { updateUser } = useAppContext();
  const [step, setStep] = useState<Step>({ name: 'idle' });
  const [dialog, setDialog] = useState<'disable' | 'regenerate' | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const uri = step.name === 'scan' ? step.uri : null;

  useEffect(() => {
    let cancelled = false;
    if (!uri) return;
    QRCode.toDataURL(uri, { margin: 1, width: 192 }).then((url) => { if (!cancelled) setQr(url); }).catch(() => { if (!cancelled) setQr(null); });
    return () => { cancelled = true; setQr(null); };
  }, [uri]);

  async function start(event: FormEvent) {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      const result = await api.mfaSetup(password);
      setPassword(''); setCode('');
      setStep({ name: 'scan', secret: result.secret, uri: result.otpauth_uri });
    } catch (err) { setError(message(err, 'Could not start setup')); }
    finally { setBusy(false); }
  }

  async function enable(event: FormEvent) {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      const result = await api.mfaEnable(code.trim());
      setCode('');
      setStep({ name: 'codes', codes: result.recovery_codes });
      onChanged({ mfa_enabled: true, mfa_recovery_codes_left: result.recovery_codes.length });
      updateUser({ mfa_setup_required: false });
    } catch (err) { setError(message(err, 'Could not turn on two-factor authentication')); }
    finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="mfa-heading" className={cardClass}>
      <h2 id="mfa-heading" className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />Two-factor authentication
      </h2>

      {profile.mfa_required && !profile.mfa_enabled && step.name !== 'codes' && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          Your role requires two-factor authentication. Set it up below to keep using AnatoLearn.
        </p>
      )}
      {notice && <p role="status" className={`${successBox} mb-4`}>{notice}</p>}

      {step.name === 'codes' ? (
        <RecoveryCodes codes={step.codes} onDone={() => { setStep({ name: 'idle' }); setNotice('Two-factor authentication is on. Other devices were signed out.'); }} />
      ) : step.name === 'scan' ? (
        <form onSubmit={enable} className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">Scan this QR code with an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code it shows.</p>
          <div className="flex flex-wrap items-center gap-4">
            {qr && <img src={qr} alt="QR code for your authenticator app" width={192} height={192} className="rounded-lg border border-slate-200 bg-white p-1" />}
            <div className="min-w-0 text-sm text-slate-700 dark:text-slate-300">
              <p>Can't scan? Enter this key manually (time-based, 6 digits):</p>
              <p className="my-1 select-all break-all font-mono text-base text-slate-900 dark:text-slate-100" data-testid="mfa-secret">{step.secret.match(/.{1,4}/g)?.join(' ')}</p>
            </div>
          </div>
          <div>
            <label htmlFor="mfa-enable-code" className={labelClass}>6-digit code</label>
            <input id="mfa-enable-code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          {error && <p role="alert" className={errorBox}>{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={busy || code.trim().length < 6} className={primaryButton}>{busy ? 'Checking…' : 'Turn on'}</button>
            <button type="button" onClick={() => { setStep({ name: 'idle' }); setError(null); setCode(''); }} className={secondaryButton}>Cancel</button>
          </div>
        </form>
      ) : step.name === 'password' ? (
        <form onSubmit={start} className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">Confirm your password to begin.</p>
          <div>
            <label htmlFor="mfa-setup-password" className={labelClass}>Password</label>
            <input id="mfa-setup-password" type="password" autoComplete="current-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          {error && <p role="alert" className={errorBox}>{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={busy || !password} className={primaryButton}>{busy ? 'Working…' : 'Continue'}</button>
            <button type="button" onClick={() => { setStep({ name: 'idle' }); setError(null); setPassword(''); }} className={secondaryButton}>Cancel</button>
          </div>
        </form>
      ) : profile.mfa_enabled ? (
        <>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Two-factor authentication is <strong className="text-green-800 dark:text-green-300">on</strong>. You have {profile.mfa_recovery_codes_left} unused recovery code{profile.mfa_recovery_codes_left === 1 ? '' : 's'}.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setDialog('regenerate')} className={secondaryButton}>New recovery codes…</button>
            {!profile.mfa_required && <button type="button" onClick={() => setDialog('disable')} className={dangerButton}>Turn off…</button>}
          </div>
          {profile.mfa_required && <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">Your role requires two-factor authentication, so it cannot be turned off. If you lose your device, an administrator can reset it.</p>}
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Protect your account with a code from an authenticator app in addition to your password.</p>
          <button type="button" onClick={() => { setNotice(null); setStep({ name: 'password' }); }} className={primaryButton}>Set up…</button>
        </>
      )}

      {dialog === 'disable' && (
        <ConfirmDialog title="Turn off two-factor authentication?" intro="Your account will be protected by your password alone, and you will be signed out on other devices." submitLabel="Turn off" danger
          action={api.mfaDisable} onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); onChanged({ mfa_enabled: false, mfa_recovery_codes_left: 0 }); setNotice('Two-factor authentication is off.'); }} />
      )}
      {dialog === 'regenerate' && (
        <ConfirmDialog title="Get new recovery codes?" intro="Your existing recovery codes stop working as soon as new ones are created." submitLabel="Create new codes"
          action={api.mfaRecoveryCodes} onClose={() => setDialog(null)}
          onDone={(result) => { setDialog(null); const { recovery_codes } = result as { recovery_codes: string[] }; onChanged({ mfa_recovery_codes_left: recovery_codes.length }); setStep({ name: 'codes', codes: recovery_codes }); }} />
      )}
    </section>
  );
}

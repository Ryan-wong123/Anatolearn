import { useState } from 'react';
import Modal from './Modal';
import { primaryButton, secondaryButton } from './styles';

// Shown once after the server generates a password. It is never stored client-side beyond this dialog.
export default function TemporaryPasswordDialog({ account, password, onClose }: { account: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(password); setCopied('yes'); } catch { setCopied('no'); }
  }
  return (
    <Modal title="Temporary password" onClose={onClose}>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        A temporary password was generated for <strong>{account}</strong>. It is shown only once. Share it securely (not by group chat), and ask the person to change it from their Profile page after signing in.
      </p>
      <p className="my-4 select-all break-all rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 font-mono text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" data-testid="temporary-password">{password}</p>
      <p role="status" className="min-h-5 text-sm text-slate-700 dark:text-slate-300">
        {copied === 'yes' && 'Copied to clipboard.'}{copied === 'no' && 'Could not copy automatically. Select the password and copy it manually.'}
      </p>
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={copy} className={secondaryButton}>Copy password</button>
        <button type="button" onClick={onClose} className={primaryButton}>I have saved it</button>
      </div>
    </Modal>
  );
}

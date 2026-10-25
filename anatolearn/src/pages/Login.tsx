import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useAppContext } from '../context/AppContextState';
import { ApiError, api } from '../api/api';
import type { LoginResult } from '../api/api';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAppContext();
  const [sessionExpired] = useState(() => sessionStorage.getItem('anatolearn_session_expired') === '1');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once the password is accepted for an account that has two-factor authentication.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [methods, setMethods] = useState<('totp' | 'passkey')[]>([]);

  function finish(result: LoginResult) {
    if (!result.user) throw new Error('Could not sign in. Please try again.');
    login({ ...result.user, mfa_setup_required: result.mfa_setup_required });
    const from = (location.state as { from?: string } | null)?.from;
    navigate(result.mfa_setup_required ? '/profile' : from && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard', { replace: true });
  }

  async function handlePasskey() {
    if (!mfaToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const options = await api.passkeySignInOptions(mfaToken);
      finish(await api.passkeySignInVerify(mfaToken, await startAuthentication({ optionsJSON: options })));
    } catch (error) {
      const cancelled = error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError');
      setError(cancelled ? 'The passkey prompt was cancelled or timed out. Try again.' : error instanceof Error ? error.message : 'Could not use the passkey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      finish(await api.verifyMfa(mfaToken, code.trim()));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not verify the code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await api.login(email, password);
      if (result.mfa_required && result.mfa_token) { setMfaToken(result.mfa_token); setMethods(result.methods ?? ['totp']); setCode(''); return; }
      finish(result);
    } catch (error) {
      // Deliberately generic — matches the backend's own generic message,
      // and doesn't reveal whether the email or the password was wrong.
      setError(error instanceof ApiError && error.status === 401 ? 'Invalid email or password' : error instanceof Error ? error.message : 'Could not sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main aria-label="Sign in" className="min-h-screen bg-slate-50 dark:bg-slate-800 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display text-center">
            AnatoLearn
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">
            {mfaToken ? 'Two-step verification' : 'Sign in to continue'}
          </p>
        </div>

        {sessionExpired && !error && (
          <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            Your session has ended. Please sign in again to continue.
          </p>
        )}

        {mfaToken ? (
          <form onSubmit={handleVerify} className="space-y-4">
            {methods.includes('passkey') && (
              <>
                <button type="button" onClick={handlePasskey} disabled={isSubmitting} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Waiting for your passkey…' : 'Use a passkey'}
                </button>
                {methods.includes('totp') && <p className="text-center text-xs text-slate-600 dark:text-slate-400">or enter a code instead</p>}
              </>
            )}
            {methods.includes('totp') && <div>
              <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Authentication code</label>
              <input
                id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={32}
                aria-describedby="mfa-code-help" value={code} onChange={(e) => setCode(e.target.value)}
                className="text-slate-900 dark:text-slate-100 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 tracking-widest focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                placeholder="123456"
              />
              <p id="mfa-code-help" className="mt-1 text-xs text-slate-600 dark:text-slate-400">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
            </div>}
            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">{error}</p>
            )}
            {methods.includes('totp') && (
              <button type="submit" disabled={isSubmitting || !code.trim()} className={methods.includes('passkey') ? 'w-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed' : 'w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'}>
                {isSubmitting ? 'Verifying…' : 'Verify'}
              </button>
            )}
            <button type="button" onClick={() => { setMfaToken(null); setMethods([]); setCode(''); setPassword(''); setError(null); }} className="w-full text-sm text-slate-600 dark:text-slate-400 underline hover:text-blue-700 dark:hover:text-blue-400">
              Back to sign in
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              autoComplete="username" id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-slate-900 dark:text-slate-100 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              autoComplete="current-password" id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-slate-900 dark:text-slate-100 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        )}

        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
            Register
          </Link>
        </p>
        <p className="mt-3 flex justify-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <Link to="/privacy" className="underline hover:text-blue-700 dark:hover:text-blue-400">Privacy notice</Link>
          <Link to="/terms" className="underline hover:text-blue-700 dark:hover:text-blue-400">Terms of use</Link>
        </p>
      </div>
    </main>
  );
}

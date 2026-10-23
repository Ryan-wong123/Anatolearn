import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAppContext } from '../context/AppContextState';
import { ApiError, api } from '../api/api';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAppContext();
  const [sessionExpired] = useState(() => sessionStorage.getItem('anatolearn_session_expired') === '1');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { user } = await api.login(email, password);
      login(user);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard', { replace: true });
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
            Sign in to continue
          </p>
        </div>

        {sessionExpired && !error && (
          <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            Your session has ended. Please sign in again to continue.
          </p>
        )}

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

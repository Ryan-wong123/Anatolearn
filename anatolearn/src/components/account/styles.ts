// Shared Tailwind class strings so account pages match the existing forms (Login/Register).
export const inputClass = 'text-slate-900 dark:text-slate-100 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors disabled:opacity-60';
export const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors';
export const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors';
export const dangerButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors';
export const cardClass = 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900';
export const errorBox = 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300';
export const successBox = 'rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300';

const isStaff = (role?: string) => role === 'teacher' || role === 'admin';
const minLength = (role?: string) => (isStaff(role) ? 12 : 8);

// The hint shown next to every new-password field. The server also rejects common passwords and ones containing the
// person's name or email, so it is the authority; these checks just catch the obvious cases without a round trip.
export const passwordRules = (role?: string) =>
  `Use at least ${minLength(role)} characters${isStaff(role) ? ' (teachers and administrators)' : ''}, including one uppercase letter and one number. Avoid common passwords and your name or email; three or four unrelated words work well.`;

// Mirrors the server: 8+ characters (12 for staff), max 72 bytes, an uppercase letter and a number.
export function passwordProblem(password: string, role?: string): string | null {
  if (password.length < minLength(role)) return `Password must be at least ${minLength(role)} characters${isStaff(role) ? ' for teachers and administrators' : ''}`;
  if (new TextEncoder().encode(password).length > 72) return 'Password must be 72 bytes or fewer';
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain at least one uppercase letter and one number';
  return null;
}

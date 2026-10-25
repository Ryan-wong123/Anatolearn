import { AppContext } from './AppContextState';
import type { AuthUser, Theme, Role, Program } from './AppContextState';
import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/api';

const USER_STORAGE_KEY = 'anatolearn_user';
const THEME_STORAGE_KEY = 'anatolearn_theme';

function loadStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function loadStoredTheme(): Theme {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === 'dark' || raw === 'light') return raw;
  // Fall back to the user's OS-level preference on first visit.
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const storedUser = loadStoredUser();

  const [role, setRole] = useState<Role>(storedUser?.role ?? 'student');
  const [program, updateProgram] = useState<Program>(() => sessionStorage.getItem('anatolearn_program') || 'Physiotherapy');
  const setProgram = useCallback((value: string) => { sessionStorage.setItem('anatolearn_program', value); updateProgram(value); }, []);
  const [user, setUser] = useState<AuthUser | null>(storedUser);
  const [theme, setTheme] = useState<Theme>(loadStoredTheme);

  const isDevMode = import.meta.env.DEV;
  useEffect(() => {
    const expire = () => { sessionStorage.setItem('anatolearn_session_expired', '1'); setUser(null); setRole('student'); };
    const needsMfa = () => setUser((current) => current && { ...current, mfa_setup_required: true });
    window.addEventListener('anatolearn-session-expired',expire);
    window.addEventListener('anatolearn-mfa-required',needsMfa);
    return () => { window.removeEventListener('anatolearn-session-expired',expire); window.removeEventListener('anatolearn-mfa-required',needsMfa); };
  }, []);

  // A remembered user is only trusted once the cookie session is confirmed (it may have expired or been revoked).
  useEffect(() => {
    if (!storedUser) return;
    api.getProfile().then((profile) => {
      const fresh = { id: profile.id, name: profile.name, email: profile.email, role: profile.role, program_id: profile.program_id, mfa_setup_required: profile.mfa_required && !profile.mfa_enabled };
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
      setUser(fresh);
      setRole(fresh.role);
    }).catch(() => { /* 401 already signs the user out; network errors keep the page usable */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  function login(newUser: AuthUser) {
    sessionStorage.removeItem('anatolearn_session_expired');
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
    setRole(newUser.role);
  }

  function updateUser(patch: Partial<AuthUser>) {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function logout() {
    await api.logout();
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem('anatolearn_program');
    setUser(null);
    setRole('student');
  }

  return (
    <AppContext.Provider
      value={{ role, setRole, program, setProgram, user, login, updateUser, logout, isDevMode, theme, toggleTheme }}
    >
      {children}
    </AppContext.Provider>
  );
}

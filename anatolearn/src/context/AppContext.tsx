import { AppContext } from './AppContextState';
import type { AuthUser, Theme, Role, Program } from './AppContextState';
import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, TOKEN_STORAGE_KEY } from '../api/api';

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
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState<AuthUser | null>(storedUser);
  const [theme, setTheme] = useState<Theme>(loadStoredTheme);

  const isDevMode = import.meta.env.DEV;
  useEffect(() => {
    const expire = () => { setToken(null); setUser(null); setRole('student'); };
    window.addEventListener('anatolearn-session-expired',expire);
    return () => window.removeEventListener('anatolearn-session-expired',expire);
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

  function login(newToken: string, newUser: AuthUser) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setRole(newUser.role);
  }

  async function logout() {
    await api.logout();
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setRole('student');
  }

  return (
    <AppContext.Provider
      value={{ role, setRole, program, setProgram, token, user, login, logout, isDevMode, theme, toggleTheme }}
    >
      {children}
    </AppContext.Provider>
  );
}

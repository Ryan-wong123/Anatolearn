import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TOKEN_STORAGE_KEY } from '../api/api';

type Role = 'student' | 'teacher';
type Program = string;
type Theme = 'light' | 'dark';

// What the backend's /api/auth/login and /api/auth/register return as `user`.
interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  program_id: number | null;
}

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

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;
  program: Program;
  setProgram: (program: Program) => void;
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  // True only in `npm run dev` (Vite's built-in dev flag) — false in a
  // production build. The Student|Teacher nav toggle checks this so it
  // cannot appear (or do anything) outside of local development.
  isDevMode: boolean;
  theme: Theme;
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const storedUser = loadStoredUser();

  const [role, setRole] = useState<Role>(storedUser?.role ?? 'student');
  const [program, setProgram] = useState<Program>('Physiotherapy');
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState<AuthUser | null>(storedUser);
  const [theme, setTheme] = useState<Theme>(loadStoredTheme);

  const isDevMode = import.meta.env.DEV;

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

  function logout() {
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

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}

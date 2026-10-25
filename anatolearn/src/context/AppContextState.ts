import { createContext, useContext } from 'react';
type Role = 'student' | 'teacher' | 'admin';
type Program = string;
type Theme = 'light' | 'dark';

// What the backend's /api/auth/login returns as `user`. The session itself is an httpOnly cookie the page cannot read.
interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  program_id: number | null;
  // Staff must enrol in two-factor authentication before they can use the rest of the app.
  mfa_setup_required?: boolean;
}

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;
  program: Program;
  setProgram: (program: Program) => void;
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
  // True only in `npm run dev` (Vite's built-in dev flag) — false in a
  // production build. The Student|Teacher nav toggle checks this so it
  // cannot appear (or do anything) outside of local development.
  isDevMode: boolean;
  theme: Theme;
  toggleTheme: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}

export type { Role, Program, Theme, AuthUser };

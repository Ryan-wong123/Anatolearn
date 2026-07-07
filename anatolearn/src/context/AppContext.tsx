import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type Role = 'student' | 'teacher';
type Program = string;

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;
  program: Program;
  setProgram: (program: Program) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('student');
  const [program, setProgram] = useState<Program>('Physiotherapy');

  return (
    <AppContext.Provider value={{ role, setRole, program, setProgram }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
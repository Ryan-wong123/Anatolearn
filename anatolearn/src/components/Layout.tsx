import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  GraduationCap, Box, Video, BookOpen, Library, UserCircle2, LogOut, Sun, Moon, Menu, X,
} from 'lucide-react';
import { useAppContext } from '../context/AppContextState';
import { api } from '../api/api';

const navItems = [
  { label: 'Dashboard', icon: GraduationCap, path: '/dashboard' },
  { label: '3D Viewer', icon: Box, path: '/3dviewer' },
  { label: 'Videos', icon: Video, path: '/videos' },
  { label: 'Quizzes', icon: BookOpen, path: '/quizzes' },
  { label: 'Library', icon: Library, path: '/library' },
];

type Program = {
  id: number;
  name: string;
  description: string | null;
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole, program, setProgram, user, logout, isDevMode, theme, toggleTheme } = useAppContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    api.getPrograms()
      .then(setPrograms)
      .catch((err) => console.error('Failed to load programs:', err));
  }, []);

  // Once we know both the logged-in user's program_id and the full programs
  // list, sync the nav dropdown to match their actual account — it starts on
  // a hardcoded default otherwise.
  useEffect(() => {
    if (!user?.program_id || programs.length === 0) return;
    const match = programs.find((p) => p.id === user.program_id);
    if (match) setProgram(match.name);
  }, [user, programs, setProgram]);

  async function handleLogout() {
    try { await logout(); navigate('/login'); } catch { setLogoutError('Could not sign out. Please try again.'); }
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800 min-h-screen flex flex-col">
      <nav className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-6">
            <button aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="hidden lg:inline font-bold text-xl text-slate-900 dark:text-slate-100 tracking-tight font-display">
                AnatoLearn
              </span>
            </Link>

            <div className="hidden md:flex space-x-1">
              {navItems.map(({ label, icon: Icon, path }) => {
                const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden lg:inline text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Program
            </span>

            <select
              aria-label="Selected programme"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="text-slate-900 dark:text-slate-100 max-w-[120px] lg:max-w-none pl-2 pr-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 focus:outline-none"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Dev-only: lets you preview both role views without logging in
                and out. Gated on Vite's built-in DEV flag, so this cannot
                render (or do anything) in a production build — role there
                comes only from the logged-in account. */}
            {isDevMode && (
              <div className="hidden xl:flex items-center gap-2">
                <button
                  onClick={() => setRole('student')}
                  className={`text-sm transition-colors ${
                    role === 'student' ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                  title="Dev mode only — real role comes from your account"
                >
                  Student
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  onClick={() => setRole('teacher')}
                  className={`text-sm transition-colors ${
                    role === 'teacher' ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                  title="Dev mode only — real role comes from your account"
                >
                  Teacher
                </button>
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2">
              {user && (
                <span className="hidden sm:block text-sm text-slate-600 dark:text-slate-400 max-w-[140px] truncate">
                  {user.name}
                </span>
              )}
              <span className="hidden sm:inline p-1" aria-hidden="true">
                <UserCircle2 className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Log out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        {menuOpen && <div className="absolute top-16 inset-x-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-3 md:hidden shadow-lg">
          {navItems.map(({path,label,icon:Icon}) => <Link key={path} to={path} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 p-3 rounded-lg text-slate-900 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500"><Icon className="w-4 h-4" />{label}</Link>)}
        </div>}
      </nav>
      {logoutError && <p role="alert" className="p-3 text-red-600">{logoutError}</p>}

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

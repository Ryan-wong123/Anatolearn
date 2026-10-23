import RequestState from './RequestState';
import { useResource } from '../hooks/useResource';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  GraduationCap, Box, Video, BookOpen, Library, UserCircle2, LogOut, Sun, Moon, Menu, X, Search, Bell, Users,
} from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';
import Footer from './Footer';
import { ANNOUNCEMENTS_SEEN_EVENT, ANNOUNCEMENTS_SEEN_KEY } from './announcementsSeen';
import { useAppContext } from '../context/AppContextState';
import { api } from '../api/api';

const navItems = [
  { label: 'Dashboard', icon: GraduationCap, path: '/dashboard' },
  { label: '3D Viewer', icon: Box, path: '/3dviewer' },
  { label: 'Videos', icon: Video, path: '/videos' },
  { label: 'Quizzes', icon: BookOpen, path: '/quizzes' },
  { label: 'Library', icon: Library, path: '/library' },
];

const teacherNavItems = [{ label: 'Users', icon: Users, path: '/admin/users' }];

type Program = {
  id: number;
  name: string;
  description: string | null;
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole, program, setProgram, user, logout, isDevMode, theme, toggleTheme } = useAppContext();

  const navigationToggle = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const lastPath = useRef(location.pathname);
  useEffect(()=>{
    const changed=lastPath.current!==location.pathname;lastPath.current=location.pathname;
    if (!changed) return;
    const frame=requestAnimationFrame(()=>main.current?.focus());
    return ()=>cancelAnimationFrame(frame);
  },[location.pathname]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const {data:programs, loading:programsLoading, error:programsError, reload:reloadPrograms} = useResource<Program[]>(api.getPrograms, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const items = role === 'teacher' ? [...navItems, ...teacherNavItems] : navItems;

  useEffect(() => {
    let active = true;
    const refresh = () => api.getAnnouncements().then((list) => {
      if (!active) return;
      let seen = 0;
      try { seen = Date.parse(localStorage.getItem(ANNOUNCEMENTS_SEEN_KEY) || '') || 0; } catch { /* storage unavailable */ }
      setUnreadAnnouncements(list.filter((item) => Date.parse(item.created_at) > seen).length);
    }).catch(() => { /* the bell is a convenience; failures stay silent */ });
    void refresh();
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener(ANNOUNCEMENTS_SEEN_EVENT, refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener(ANNOUNCEMENTS_SEEN_EVENT, refresh); };
  }, []);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const term = searchTerm.trim();
    if (term.length >= 2) { navigate(`/search?q=${encodeURIComponent(term)}`); setMenuOpen(false); }
  }



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
      <a href="#main-content" tabIndex={0} className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3 focus:text-blue-700">Skip to content</a>
      <nav aria-label="Main navigation" className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-6">
            <button ref={navigationToggle} aria-controls="mobile-navigation" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="xl:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/dashboard" aria-label="AnatoLearn dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="hidden min-[1900px]:inline font-bold text-xl text-slate-900 dark:text-slate-100 tracking-tight font-display">
                AnatoLearn
              </span>
            </Link>

            <div className="hidden xl:flex space-x-1">
              {items.map(({ label, icon: Icon, path }) => {
                const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
                return (
                  <Link
                    key={path}
                    aria-current={isActive ? 'page' : undefined}
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

          <div className="flex items-center gap-2 sm:gap-3">
            <form role="search" onSubmit={handleSearch} className="relative hidden min-[1800px]:block">
              <label htmlFor="global-search" className="sr-only">Search models, videos, quizzes and library</label>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input id="global-search" type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search…"
                className="w-28 rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm text-slate-900 placeholder-slate-500 focus:w-44 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 transition-[width]" />
            </form>
            <Link to="/search" aria-label="Search" className="hidden rounded-lg p-1.5 sm:block text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-700 min-[1800px]:hidden">
              <Search className="h-5 w-5" />
            </Link>
            <span className="hidden min-[1800px]:inline text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Program
            </span>

            <select
              disabled={programsLoading || Boolean(programsError)}
              aria-label="Selected programme"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="text-slate-900 dark:text-slate-100 max-w-[120px] lg:max-w-none pl-2 pr-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 focus:outline-none"
            >
              {programsLoading && <option>Loading programmes…</option>}
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
              <div className="hidden min-[2000px]:flex items-center gap-2">
                <button
                  onClick={() => setRole('student')}
                  className={`text-sm transition-colors ${
                    role === 'student' ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="Dev mode only — real role comes from your account"
                >
                  Student
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button
                  onClick={() => setRole('teacher')}
                  className={`text-sm transition-colors ${
                    role === 'teacher' ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="Dev mode only — real role comes from your account"
                >
                  Teacher
                </button>
              </div>
            )}

            <Link to="/announcements" aria-label={unreadAnnouncements ? `Announcements, ${unreadAnnouncements} new` : 'Announcements'} title="Announcements"
              className="relative hidden rounded-lg p-1.5 sm:block text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-700">
              <Bell className="h-5 w-5" />
              {unreadAnnouncements > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unreadAnnouncements > 9 ? '9+' : unreadAnnouncements}</span>}
            </Link>

            <button
              onClick={toggleTheme}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2">
              <Link to="/profile" aria-label={user ? `${user.name}, my profile` : 'My profile'} title="My profile" className="hidden items-center gap-2 rounded-lg p-1 sm:flex hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700">
                {user && (
                  <span className="hidden min-[1800px]:block text-sm text-slate-600 dark:text-slate-400 max-w-[140px] truncate">
                    {user.name}
                  </span>
                )}
                <UserCircle2 className="w-8 h-8 text-slate-600 dark:text-slate-400" aria-hidden="true" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Log out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div hidden={!menuOpen} onKeyDown={(event)=>{if(event.key==='Escape'){setMenuOpen(false);navigationToggle.current?.focus();}}} id="mobile-navigation" className="absolute top-16 inset-x-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-3 xl:hidden shadow-lg">
          <form role="search" onSubmit={handleSearch} className="mb-2 flex gap-2 p-1">
            <label htmlFor="mobile-search" className="sr-only">Search</label>
            <input id="mobile-search" type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search models, videos, quizzes…"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
            <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Search</button>
          </form>
          {[...items, { path: '/announcements', label: unreadAnnouncements ? `Announcements (${unreadAnnouncements} new)` : 'Announcements', icon: Bell }, { path: '/profile', label: 'My profile', icon: UserCircle2 }].map(({path,label,icon:Icon}) => <Link aria-current={location.pathname === path || location.pathname.startsWith(path+'/') ? 'page' : undefined} key={path} to={path} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 p-3 rounded-lg text-slate-900 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500"><Icon className="w-4 h-4" />{label}</Link>)}
        </div>
      </nav>
      {logoutError && <p role="alert" className="p-3 text-red-600">{logoutError}</p>}

      <RequestState loading={false} error={programsError} onRetry={reloadPrograms} label="programmes" />
      <main ref={main} id="main-content" tabIndex={-1} className="flex-1">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<p role="status" className="p-6 text-slate-600 dark:text-slate-300">Loading…</p>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

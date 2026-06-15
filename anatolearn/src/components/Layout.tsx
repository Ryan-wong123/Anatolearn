import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  GraduationCap, Box, Video, BookOpen, Library, UserCircle2,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const navItems = [
  { label: 'Dashboard', icon: GraduationCap, path: '/dashboard' },
  { label: '3D Viewer', icon: Box, path: '/3dviewer' },
  { label: 'Videos', icon: Video, path: '/videos' },
  { label: 'Quizzes', icon: BookOpen, path: '/quizzes' },
  { label: 'Library', icon: Library, path: '/library' },
];

const programs = [
  { value: 'PT', label: 'Physiotherapy' },
  { value: 'OT', label: 'Occupational Therapy' },
  { value: 'Radiography', label: 'Radiography' },
  { value: 'Nursing', label: 'Nursing' },
];

export default function Layout() {
  const location = useLocation();
  const { role, setRole, program, setProgram } = useAppContext();

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">

      {/* Top Navigation Bar */}
      <nav className="h-16 bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">

          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight font-display">
                AnatoLearn
              </span>
            </Link>

            <div className="hidden md:flex space-x-1">
              {navItems.map(({ label, icon: Icon, path }) => {
                const isActive = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Program + Role + Avatar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Program
            </span>
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value as 'PT' | 'OT' | 'Radiography' | 'Nursing')}
              className="pl-3 pr-8 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              {programs.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRole('student')}
                className={`text-sm transition-colors ${
                  role === 'student' ? 'font-semibold text-slate-900' : 'text-slate-400'
                }`}
              >
                Student
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setRole('teacher')}
                className={`text-sm transition-colors ${
                  role === 'teacher' ? 'font-semibold text-slate-900' : 'text-slate-400'
                }`}
              >
                Teacher
              </button>
            </div>

            <button className="p-1">
              <UserCircle2 className="w-8 h-8 text-slate-400" />
            </button>
          </div>

        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
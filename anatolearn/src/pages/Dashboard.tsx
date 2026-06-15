import { Clock, Trophy, Activity, Box, Video, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const studentStats = [
  { label: 'Study Time', value: '12.5h', icon: Clock, iconColor: 'text-blue-500' },
  { label: 'Quiz Average', value: '85%', icon: Trophy, iconColor: 'text-yellow-500' },
  { label: 'Models Explored', value: '24', icon: Activity, iconColor: 'text-green-500' },
];

const teacherStats = [
  { label: 'Models Uploaded', value: '12', icon: Box, iconColor: 'text-blue-500' },
  { label: 'Videos Linked', value: '45', icon: Video, iconColor: 'text-purple-500' },
  { label: 'Student Engagement', value: 'High', icon: Activity, iconColor: 'text-green-500' },
];

const learningCards = [
  {
    title: 'Muscular System',
    subtitle: 'Resume 3D exploration',
    path: '/3dviewer',
    gradient: 'from-blue-50 to-indigo-100',
    icon: Box,
    iconColor: 'text-blue-500',
  },
  {
    title: 'Cardiovascular Basics',
    subtitle: 'Next video in playlist',
    path: '/videos',
    gradient: 'from-purple-50 to-pink-100',
    icon: Video,
    iconColor: 'text-purple-500',
  },
  {
    title: 'Respiratory Quiz',
    subtitle: 'Due in 2 days',
    path: '/quizzes',
    gradient: 'from-green-50 to-emerald-100',
    icon: BookOpen,
    iconColor: 'text-green-500',
  },
];

const quickActions = [
  { label: 'Upload New Model', path: '/library' },
  { label: 'Manage Labels', path: '/3dviewer' },
  { label: 'Add Educational Video', path: '/videos' },
  { label: 'Create Quiz', path: '/quizzes' },
];

export default function Dashboard() {
  const { role, program } = useAppContext();
  const stats = role === 'teacher' ? teacherStats : studentStats;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 font-display">
          {role === 'teacher' ? 'Welcome back, Instructor' : 'Welcome back, Student'}
        </h1>
        <p className="mt-1 text-slate-500 text-sm">{program} Program Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, iconColor }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <Icon className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900 font-display">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Student: Continue Learning */}
      {role === 'student' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 font-display mb-4">
            Continue Learning
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {learningCards.map(({ title, subtitle, path, gradient, icon: Icon, iconColor }) => (
              <Link
                key={title}
                to={path}
                className="group block bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className={`h-32 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <Icon className={`w-12 h-12 ${iconColor} group-hover:scale-110 transition-transform`} />
                </div>
                <div className="p-4">
                  <p className="text-base font-semibold text-slate-900 font-display">{title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Teacher: Quick Actions */}
      {role === 'teacher' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 font-display mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map(({ label, path }) => (
              <Link
                key={label}
                to={path}
                className="flex items-center justify-center px-4 py-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
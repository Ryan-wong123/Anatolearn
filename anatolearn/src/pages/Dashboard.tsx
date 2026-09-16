import { useEffect, useState } from 'react';
import { Trophy, Activity, Box, Video, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';

const quickActions = [
  { label: 'Upload New Model', path: '/3dviewer' },
  { label: 'Manage Annotations', path: '/3dviewer' },
  { label: 'Add Educational Video', path: '/videos' },
  { label: 'Create Quiz', path: '/quizzes' },
];

interface AttemptSummary {
  id: number;
  quiz_id: number;
  quiz_title: string;
  score: number | null;
  status: string;
  attempted_at: string;
}

export default function Dashboard() {
  const { role, program, user } = useAppContext();

  const [modelCount, setModelCount] = useState<number | null>(null);
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const [quizCount, setQuizCount] = useState<number | null>(null);

  // Student stats
  const [quizzesTaken, setQuizzesTaken] = useState<number>(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<AttemptSummary[]>([]);

  useEffect(() => {
    if (role === 'teacher') {
      api.getModels()
        .then((models) => setModelCount(models.length))
        .catch((err) => console.error('Failed to load model count:', err));

      api.getVideos()
        .then((videos) => setVideoCount(videos.length))
        .catch((err) => console.error('Failed to load video count:', err));

      api.getQuizzes()
        .then((quizzes) => setQuizCount(quizzes.length))
        .catch((err) => console.error('Failed to load quiz count:', err));
    }

    if (role === 'student') {
      api.getMyAttempts()
        .then((attempts: AttemptSummary[]) => {
          setQuizzesTaken(attempts.length);
          setRecentAttempts(attempts.slice(0, 3));

          const graded = attempts.filter((a) => a.status === 'graded' && a.score != null);
          if (graded.length > 0) {
            const total = graded.reduce((sum, a) => sum + (a.score ?? 0), 0);
            setAvgScore(Math.round(total / graded.length));
          }
        })
        .catch((err) => console.error('Failed to load attempts:', err));
    }
  }, [role]);

  const teacherStats = [
    { label: 'Models Uploaded', value: modelCount === null ? '—' : String(modelCount), icon: Box, iconColor: 'text-blue-500 dark:text-blue-400' },
    { label: 'Videos Uploaded', value: videoCount === null ? '—' : String(videoCount), icon: Video, iconColor: 'text-purple-500 dark:text-purple-400' },
    { label: 'Quizzes Created', value: quizCount === null ? '—' : String(quizCount), icon: Activity, iconColor: 'text-green-500 dark:text-green-400' },
  ];

  const studentStats = [
    { label: 'Quizzes Taken', value: String(quizzesTaken), icon: BookOpen, iconColor: 'text-blue-500 dark:text-blue-400' },
    { label: 'Average Score', value: avgScore !== null ? `${avgScore}%` : '—', icon: Trophy, iconColor: 'text-yellow-500' },
  ];

  const stats = role === 'teacher' ? teacherStats : studentStats;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">{program} Program Overview</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, iconColor }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-4">
            <Icon className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {role === 'student' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
            Recent Activity
          </h2>
          {recentAttempts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
              <p className="text-sm text-slate-400 dark:text-slate-500">No quiz attempts yet. Head to the Quizzes page to get started.</p>
              <Link to="/quizzes" className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
                Browse Quizzes →
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{attempt.quiz_title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {new Date(attempt.attempted_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  {attempt.status === 'graded' ? (
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {attempt.score}%
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                      Pending Review
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link to="/3dviewer" className="flex items-center justify-center px-4 py-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Explore 3D Models
            </Link>
            <Link to="/videos" className="flex items-center justify-center px-4 py-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Watch Videos
            </Link>
            <Link to="/quizzes" className="flex items-center justify-center px-4 py-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Take a Quiz
            </Link>
          </div>
        </div>
      )}

      {role === 'teacher' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map(({ label, path }) => (
              <Link
                key={label}
                to={path}
                className="flex items-center justify-center px-4 py-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
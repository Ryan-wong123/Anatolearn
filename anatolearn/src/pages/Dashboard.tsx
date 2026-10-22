import RequestState from '../components/RequestState';
import { useResource } from '../hooks/useResource';
import { useCallback } from 'react';
import { Trophy, Activity, Box, Video, BookOpen, Heart, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContextState';
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

interface FavoriteVideo {
  id: number;
  title: string;
  thumbnail_path: string | null;
}

interface FavoriteQuiz {
  id: number;
  title: string;
  category: string | null;
}

export default function Dashboard() {
  const { role, program, user } = useAppContext();

  const fetchDashboard = useCallback(async () => {
    if (role === 'teacher') {
      const [models,videos,quizzes] = await Promise.all([api.getModels(),api.getVideos(),api.getQuizzes()]);
      return { modelCount:models.length, videoCount:videos.length, quizCount:quizzes.length,
        attempts:[] as AttemptSummary[], favoriteVideos:[] as FavoriteVideo[], favoriteQuizzes:[] as FavoriteQuiz[] };
    }
    const [attempts,favorites]: [AttemptSummary[],{videos:FavoriteVideo[];quizzes:FavoriteQuiz[]}] = await Promise.all([api.getMyAttempts(),api.getFavorites()]);
    return { modelCount:null, videoCount:null, quizCount:null, attempts, favoriteVideos:favorites.videos, favoriteQuizzes:favorites.quizzes };
  }, [role]);
  const { data, loading, error:loadError, reload } = useResource(fetchDashboard, {
    modelCount:null, videoCount:null, quizCount:null, attempts:[] as AttemptSummary[], favoriteVideos:[] as FavoriteVideo[], favoriteQuizzes:[] as FavoriteQuiz[],
  }, program);
  const {modelCount,videoCount,quizCount,favoriteVideos,favoriteQuizzes} = data;
  const quizzesTaken = data.attempts.length;
  const graded = data.attempts.filter((attempt) => attempt.status === 'graded' && attempt.score != null);
  const avgScore = graded.length ? Math.round(graded.reduce((sum,attempt) => sum+(attempt.score ?? 0),0)/graded.length) : null;

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

      <RequestState loading={loading} error={loadError} onRetry={reload} label="dashboard" />
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, iconColor }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-4">
            <Icon className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">{loading || loadError ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {role === 'student' && !loading && !loadError && (
        <div className="mt-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
              Favourites
            </h2>
            {favoriteVideos.length === 0 && favoriteQuizzes.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No favourites yet. Tap the heart icon on a video or quiz to save it here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {favoriteVideos.map((video) => (
                  <Link
                    key={`video-${video.id}`}
                    to={`/videos/${video.id}`}
                    className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {video.thumbnail_path ? (
                        <img src={video.thumbnail_path} alt={video.title} className="w-full h-full object-cover" />
                      ) : (
                        <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{video.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Video</p>
                    </div>
                    <Heart className="w-4 h-4 fill-red-500 text-red-500 flex-shrink-0 ml-auto" />
                  </Link>
                ))}

                {favoriteQuizzes.map((quiz) => (
                  <Link
                    key={`quiz-${quiz.id}`}
                    to="/quizzes"
                    className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{quiz.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Quiz{quiz.category ? ` · ${quiz.category}` : ''}</p>
                    </div>
                    <Heart className="w-4 h-4 fill-red-500 text-red-500 flex-shrink-0 ml-auto" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

import { useEffect, useState } from 'react';
import { Trophy, Activity, Box, Video, BookOpen, Heart, Play } from 'lucide-react';
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

  const [modelCount, setModelCount] = useState<number | null>(null);
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const [quizCount, setQuizCount] = useState<number | null>(null);

  // Student stats
  const [quizzesTaken, setQuizzesTaken] = useState<number>(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);

  const [favoriteVideos, setFavoriteVideos] = useState<FavoriteVideo[]>([]);
  const [favoriteQuizzes, setFavoriteQuizzes] = useState<FavoriteQuiz[]>([]);

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

          const graded = attempts.filter((a) => a.status === 'graded' && a.score != null);
          if (graded.length > 0) {
            const total = graded.reduce((sum, a) => sum + (a.score ?? 0), 0);
            setAvgScore(Math.round(total / graded.length));
          }
        })
        .catch((err) => console.error('Failed to load attempts:', err));

      api.getFavorites()
        .then((data: { videos: FavoriteVideo[]; quizzes: FavoriteQuiz[] }) => {
          setFavoriteVideos(data.videos);
          setFavoriteQuizzes(data.quizzes);
        })
        .catch((err) => console.error('Failed to load favorites:', err));
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
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
              Favourites
            </h2>
            {favoriteVideos.length === 0 && favoriteQuizzes.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
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
                      <p className="text-xs text-slate-400 dark:text-slate-500">Video</p>
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
                      <p className="text-xs text-slate-400 dark:text-slate-500">Quiz{quiz.category ? ` · ${quiz.category}` : ''}</p>
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
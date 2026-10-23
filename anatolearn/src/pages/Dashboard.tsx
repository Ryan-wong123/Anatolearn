import RequestState from '../components/RequestState';
import EmptyState from '../components/EmptyState';
import BarList from '../components/dashboard/BarList';
import Sparkline from '../components/dashboard/Sparkline';
import StatCard from '../components/dashboard/StatCard';
import { useResource } from '../hooks/useResource';
import { useCallback } from 'react';
import {
  Trophy, Activity, Box, Video, BookOpen, Heart, Play, Library, Megaphone, ClipboardCheck, Users, Eye, FileText, Compass, EyeOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContextState';
import { api } from '../api/api';
import type { Announcement, RecentItem, StudentDashboard, TeacherDashboard } from '../types/portal';

interface FavoriteVideo { id: number; title: string; thumbnail_path: string | null }
interface FavoriteQuiz { id: number; title: string; category: string | null }

const cardClass = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700';
const tileLink = `flex items-center justify-center px-4 py-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500`;
const dateFormat: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

const recentTarget: Record<RecentItem['item_type'], { path: (id: number) => string; label: string; icon: typeof Box }> = {
  model: { path: (id) => `/3dviewer/${id}`, label: '3D model', icon: Box },
  video: { path: (id) => `/videos/${id}`, label: 'Video', icon: Video },
  quiz: { path: () => '/quizzes', label: 'Quiz', icon: BookOpen },
  resource: { path: () => '/library', label: 'Library', icon: FileText },
};

function SectionTitle({ children, action }: { children: string; action?: { to: string; label: string } }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">{children}</h2>
      {action && <Link to={action.to} className="rounded text-sm font-medium text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400">{action.label}</Link>}
    </div>
  );
}

function AnnouncementStrip({ items }: { items: Announcement[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="dash-news" className="mt-6">
      <SectionTitle action={{ to: '/announcements', label: 'All announcements' }}>Announcements</SectionTitle>
      <h3 id="dash-news" className="sr-only">Latest announcements</h3>
      <ul className="space-y-2">
        {items.slice(0, 3).map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
            <Megaphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{item.body}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{new Date(item.created_at).toLocaleDateString(undefined, dateFormat)}{item.author ? ` · ${item.author}` : ''}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudentView({ data, favoriteVideos, favoriteQuizzes }: { data: StudentDashboard; favoriteVideos: FavoriteVideo[]; favoriteQuizzes: FavoriteQuiz[] }) {
  const { summary, quizzes, categories, recent, counts } = data;
  const isNew = summary.attempts === 0 && recent.length === 0;
  const focus = categories.slice(0, 6).map((item) => ({ label: item.category, value: item.accuracy, detail: `${item.answered} answered` }));
  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label="Quizzes Taken" value={String(summary.attempts)} icon={<BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />} to="/quizzes" hint={summary.quizzes_taken ? `${summary.quizzes_taken} different quiz${summary.quizzes_taken === 1 ? '' : 'zes'}` : undefined} />
        <StatCard label="Average Score" value={summary.average_score != null ? `${summary.average_score}%` : '—'} icon={<Trophy className="h-6 w-6 text-yellow-600" />} />
        <StatCard label="Best Score" value={summary.best_score != null ? `${summary.best_score}%` : '—'} icon={<Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />} />
      </div>

      <AnnouncementStrip items={data.announcements} />

      {isNew && (
        <div className="mt-8">
          <EmptyState icon={<Compass className="h-10 w-10" />} title="Welcome! Let's get you started"
            action={<Link to="/3dviewer" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Explore 3D models</Link>}>
            Your recent activity, quiz progress and focus areas will appear here once you explore models, watch videos or take a quiz.
          </EmptyState>
        </div>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="dash-recent" className="mt-8">
          <h2 id="dash-recent" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Continue where you left off</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((item) => {
              const target = recentTarget[item.item_type];
              const Icon = target.icon;
              return (
                <li key={`${item.item_type}-${item.id}`}>
                  <Link to={target.path(item.id)} className={`${cardClass} flex items-center gap-3 p-3 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500`}>
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"><Icon className="h-5 w-5 text-blue-700 dark:text-blue-400" aria-hidden="true" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</span>
                      <span className="block text-xs text-slate-600 dark:text-slate-400">{target.label} · {new Date(item.last_viewed_at).toLocaleDateString(undefined, dateFormat)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="dash-explore" className="mt-8">
        <h2 id="dash-explore" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Available for you</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Link to="/3dviewer" className={tileLink}><Box className="mr-2 h-4 w-4" aria-hidden="true" />{counts.models} 3D {counts.models === 1 ? 'model' : 'models'}</Link>
          <Link to="/videos" className={tileLink}><Video className="mr-2 h-4 w-4" aria-hidden="true" />{counts.videos} {counts.videos === 1 ? 'video' : 'videos'}</Link>
          <Link to="/quizzes" className={tileLink}><BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />{counts.quizzes} {counts.quizzes === 1 ? 'quiz' : 'quizzes'}</Link>
          <Link to="/library" className={tileLink}><Library className="mr-2 h-4 w-4" aria-hidden="true" />{counts.resources} library {counts.resources === 1 ? 'item' : 'items'}</Link>
        </div>
      </section>

      {quizzes.length > 0 && (
        <section aria-labelledby="dash-progress" className="mt-8">
          <h2 id="dash-progress" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Quiz progress</h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {quizzes.slice(0, 6).map((quiz) => (
              <li key={quiz.quiz_id} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{quiz.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{quiz.attempts} attempt{quiz.attempts === 1 ? '' : 's'}{quiz.category ? ` · ${quiz.category}` : ''}</p>
                  </div>
                  <Sparkline values={quiz.recent_scores} label={`${quiz.title} score trend`} />
                </div>
                <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <div className="flex gap-1"><dt className="text-slate-600 dark:text-slate-400">Best</dt><dd className="font-semibold text-slate-900 dark:text-slate-100">{quiz.best_score != null ? `${quiz.best_score}%` : '—'}</dd></div>
                  <div className="flex gap-1"><dt className="text-slate-600 dark:text-slate-400">Latest</dt><dd className="font-semibold text-slate-900 dark:text-slate-100">{quiz.latest_score != null ? `${quiz.latest_score}%` : '—'}</dd></div>
                  {quiz.pending_review > 0 && <div><dd className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">{quiz.pending_review} pending review</dd></div>}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}

      {focus.length > 0 && (
        <section aria-labelledby="dash-focus" className="mt-8">
          <h2 id="dash-focus" className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Focus areas</h2>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Topics where your answers are least accurate come first.</p>
          <div className={`${cardClass} p-5`}><BarList items={focus} ariaLabel="Accuracy by topic" /></div>
        </section>
      )}

      <section aria-labelledby="dash-fav" className="mt-8">
        <h2 id="dash-fav" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Favourites</h2>
        {favoriteVideos.length === 0 && favoriteQuizzes.length === 0 ? (
          <div className={`${cardClass} p-6 text-center`}>
            <p className="text-sm text-slate-600 dark:text-slate-400">No favourites yet. Tap the heart icon on a video or quiz to save it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {favoriteVideos.map((video) => (
              <Link key={`video-${video.id}`} to={`/videos/${video.id}`} className={`${cardClass} flex items-center gap-3 p-3 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500`}>
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {video.thumbnail_path ? <img src={video.thumbnail_path} alt="" className="h-full w-full object-cover" /> : <Play className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{video.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Video</p>
                </div>
                <Heart className="ml-auto h-4 w-4 flex-shrink-0 fill-red-500 text-red-500" aria-hidden="true" />
              </Link>
            ))}
            {favoriteQuizzes.map((quiz) => (
              <Link key={`quiz-${quiz.id}`} to="/quizzes" className={`${cardClass} flex items-center gap-3 p-3 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500`}>
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"><BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /></div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{quiz.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Quiz{quiz.category ? ` · ${quiz.category}` : ''}</p>
                </div>
                <Heart className="ml-auto h-4 w-4 flex-shrink-0 fill-red-500 text-red-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function TeacherView({ data }: { data: TeacherDashboard }) {
  const { totals, pending_review, recent_attempts, quiz_performance } = data;
  const performance = quiz_performance.filter((quiz) => quiz.average_score != null)
    .map((quiz) => ({ label: quiz.title, value: quiz.average_score ?? 0, detail: `${quiz.attempts} attempt${quiz.attempts === 1 ? '' : 's'}` }));
  const quickActions = [
    { label: 'Upload a model', path: '/3dviewer', icon: Box },
    { label: 'Add a video', path: '/videos', icon: Video },
    { label: 'Create a quiz', path: '/quizzes', icon: BookOpen },
    { label: 'Manage users', path: '/admin/users', icon: Users },
    { label: 'Post an announcement', path: '/announcements', icon: Megaphone },
  ];
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Models" value={String(totals.models)} icon={<Box className="h-6 w-6 text-blue-600 dark:text-blue-400" />} to="/3dviewer" />
        <StatCard label="Videos" value={String(totals.videos)} icon={<Video className="h-6 w-6 text-purple-600 dark:text-purple-400" />} to="/videos" />
        <StatCard label="Quizzes" value={String(totals.quizzes)} icon={<Activity className="h-6 w-6 text-green-600 dark:text-green-400" />} to="/quizzes" />
        <StatCard label="Library items" value={String(totals.resources)} icon={<Library className="h-6 w-6 text-slate-600 dark:text-slate-300" />} to="/library" />
        <StatCard label="Students" value={String(totals.students)} icon={<Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />} to="/admin/users" hint={`${totals.teachers} teacher${totals.teachers === 1 ? '' : 's'}`} />
        <StatCard label="Attempts this week" value={String(totals.attempts_this_week)} icon={<Eye className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />} />
        <StatCard label="Awaiting grading" value={String(pending_review)} icon={<ClipboardCheck className="h-6 w-6 text-amber-600" />} to="/quizzes" hint={pending_review ? 'Open Quizzes → View Results' : 'All caught up'} />
        <StatCard label="Unpublished items" value={String(totals.unpublished)} icon={<EyeOff className="h-6 w-6 text-slate-600 dark:text-slate-300" />} hint={totals.unpublished ? 'Hidden from students' : undefined} />
      </div>

      <AnnouncementStrip items={data.announcements} />

      <section aria-labelledby="dash-actions" className="mt-8">
        <h2 id="dash-actions" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Quick actions</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {quickActions.map(({ label, path, icon: Icon }) => (
            <Link key={label} to={path} className={tileLink}><Icon className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />{label}</Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-labelledby="dash-attempts">
          <h2 id="dash-attempts" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Recent quiz attempts</h2>
          {recent_attempts.length === 0 ? (
            <EmptyState title="No attempts yet">Student quiz attempts will show up here as soon as they come in.</EmptyState>
          ) : (
            <div tabIndex={0} role="region" aria-label="Recent quiz attempts table, scrolls sideways on small screens" className={`${cardClass} overflow-x-auto focus-visible:ring-2 focus-visible:ring-blue-500`}>
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Ten most recent quiz attempts</caption>
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-400">
                  <tr><th scope="col" className="px-4 py-2">Student</th><th scope="col" className="px-4 py-2">Quiz</th><th scope="col" className="px-4 py-2">Date</th><th scope="col" className="px-4 py-2 text-right">Result</th></tr>
                </thead>
                <tbody>
                  {recent_attempts.map((attempt) => (
                    <tr key={attempt.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                      <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{attempt.student_name ?? 'Former student'}</td>
                      <td className="max-w-[12rem] truncate px-4 py-2 text-slate-700 dark:text-slate-300">{attempt.quiz_title}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-700 dark:text-slate-300">{new Date(attempt.attempted_at).toLocaleDateString(undefined, dateFormat)}</td>
                      <td className="px-4 py-2 text-right">
                        {attempt.status === 'graded' && attempt.score != null
                          ? <span className="font-semibold text-slate-900 dark:text-slate-100">{attempt.score}%</span>
                          : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">Pending review</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="dash-performance">
          <h2 id="dash-performance" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">Quiz performance</h2>
          {performance.length === 0 ? (
            <EmptyState title="No scores yet">Average scores per quiz appear after students complete graded attempts.</EmptyState>
          ) : (
            <div className={`${cardClass} p-5`}><BarList items={performance} ariaLabel="Average score per quiz" /></div>
          )}
        </section>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { role, program, user } = useAppContext();

  const fetchDashboard = useCallback(() => api.getDashboard(), []);
  const dashboard = useResource<StudentDashboard | TeacherDashboard | null>(fetchDashboard, null, `${program}-${role}`);
  const fetchFavorites = useCallback(async (): Promise<{ videos: FavoriteVideo[]; quizzes: FavoriteQuiz[] }> =>
    role === 'student' ? api.getFavorites() : { videos: [], quizzes: [] }, [role]);
  const favorites = useResource(fetchFavorites, { videos: [] as FavoriteVideo[], quizzes: [] as FavoriteQuiz[] }, `${program}-${role}`);
  const { data, loading, error, reload } = dashboard;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400 text-sm">{program} Program Overview</p>
      </div>

      <RequestState loading={loading} error={error} onRetry={reload} label="dashboard" />
      {role === 'student' && <RequestState loading={false} error={favorites.error} onRetry={favorites.reload} label="favourites" />}
      {!loading && !error && data?.role === 'student' && role === 'student' && (
        <StudentView data={data} favoriteVideos={favorites.data.videos} favoriteQuizzes={favorites.data.quizzes} />
      )}
      {!loading && !error && data?.role === 'teacher' && role === 'teacher' && <TeacherView data={data} />}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, BookOpen, Box, Eye, PlayCircle, RotateCcw, Trophy, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { useAppContext } from '../context/AppContext';

interface AttemptSummary {
  id: number;
  quiz_title: string;
  score: number | null;
  status: 'graded' | 'pending_review';
  attempted_at: string;
}

interface LearningItem {
  title: string;
  description: string | null;
  path: string;
  type: 'quiz' | 'model' | 'video';
}

interface DashboardSummary {
  progress: {
    quizzes_completed: number;
    average_quiz_score: number | null;
    videos_watched: number | null;
    models_explored: number | null;
  };
  recent_attempts: AttemptSummary[];
  continue_learning: LearningItem | null;
  featured: (LearningItem & { id: number; thumbnail_path: string | null }) | null;
}

const QUICK_ACTIONS: Array<{ label: string; description: string; path: string; icon: LucideIcon }> = [
  { label: '3D Models', description: 'Browse interactive anatomy models', path: '/3dviewer', icon: Box },
  { label: 'Videos', description: 'Watch anatomy explainers', path: '/videos', icon: Video },
  { label: 'Quizzes', description: 'Test your understanding', path: '/quizzes', icon: BookOpen },
  { label: 'Annotation Viewer', description: 'Explore labelled model structures', path: '/3dviewer', icon: Eye },
];

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5" aria-label={`Loading ${label}`}>
      <div className="h-4 w-24 rounded bg-slate-200" />
      <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
    </div>
  );
}

export default function Dashboard() {
  const { role, program, user } = useAppContext();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSummary(await api.getDashboardSummary() as DashboardSummary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your learning summary.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    api.getDashboardSummary()
      .then((result) => { if (isCurrent) setSummary(result as DashboardSummary); })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Unable to load your learning summary.');
      })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, []);

  const primaryPath = summary?.continue_learning?.path ?? '/3dviewer';
  const progressCards = summary ? [
    { label: 'Quizzes Completed', value: String(summary.progress.quizzes_completed), icon: BookOpen, color: 'text-blue-500' },
    { label: 'Average Quiz Score', value: summary.progress.average_quiz_score === null ? 'No scores yet' : `${summary.progress.average_quiz_score}%`, icon: Trophy, color: 'text-amber-500' },
    { label: 'Videos Watched', value: summary.progress.videos_watched === null ? 'Not tracked' : String(summary.progress.videos_watched), icon: PlayCircle, color: 'text-purple-500' },
    { label: 'Models Explored', value: summary.progress.models_explored === null ? 'Not tracked' : String(summary.progress.models_explored), icon: Activity, color: 'text-emerald-500' },
  ] : [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-sm font-medium text-blue-100">{role === 'teacher' ? 'Teacher' : 'Student'} · {program}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
          <p className="mt-2 max-w-2xl text-sm text-blue-100">Pick up where you left off or choose a new anatomy activity.</p>
        </div>
        <Link to={primaryPath} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600">
          {summary?.continue_learning ? 'Resume learning' : 'Start exploring'} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {error && <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
        <p className="font-medium text-red-800">We could not load your dashboard activity.</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <button type="button" onClick={() => void loadSummary()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"><RotateCcw className="h-4 w-4" /> Retry</button>
      </section>}

      <section className="mt-8" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="mb-4 font-display text-lg font-semibold text-slate-900">Your progress</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading && [1, 2, 3, 4].map((item) => <LoadingCard key={item} label="progress" />)}
          {!isLoading && !error && progressCards.map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5"><Icon className={`h-6 w-6 shrink-0 ${color}`} /><div><p className="text-sm text-slate-500">{label}</p><p className="font-display text-xl font-bold text-slate-900">{value}</p></div></div>)}
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="continue-heading">
          <h2 id="continue-heading" className="mb-4 font-display text-lg font-semibold text-slate-900">Continue learning</h2>
          {isLoading ? <LoadingCard label="continue learning" /> : !error && summary?.continue_learning ? <Link to={summary.continue_learning.path} className="group flex min-h-40 items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-100 p-6 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{summary.continue_learning.type}</p><h3 className="mt-2 font-display text-xl font-semibold text-slate-900">{summary.continue_learning.title}</h3><p className="mt-1 text-sm text-slate-600">{summary.continue_learning.description}</p></div><ArrowRight className="h-6 w-6 shrink-0 text-blue-600 transition group-hover:translate-x-1" /></Link> : !error ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6"><p className="font-medium text-slate-900">Your next activity is waiting.</p><p className="mt-1 text-sm text-slate-500">Explore an interactive model or start your first quiz.</p><div className="mt-4 flex flex-wrap gap-3"><Link to="/3dviewer" className="text-sm font-semibold text-blue-600 hover:text-blue-800">Explore a model →</Link><Link to="/quizzes" className="text-sm font-semibold text-blue-600 hover:text-blue-800">Start a quiz →</Link></div></div> : null}
        </section>

        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="mb-4 font-display text-lg font-semibold text-slate-900">Featured content</h2>
          {isLoading ? <LoadingCard label="featured content" /> : !error && summary?.featured ? <Link to={summary.featured.path} className="group block min-h-40 rounded-xl border border-slate-200 bg-white p-6 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">{summary.featured.type === 'model' ? <Box className="h-8 w-8 text-blue-500" /> : <Video className="h-8 w-8 text-purple-500" />}<h3 className="mt-4 font-display font-semibold text-slate-900">{summary.featured.title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-500">{summary.featured.description || `Open this featured ${summary.featured.type}.`}</p></Link> : !error ? <div className="min-h-40 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No featured content is available yet. <Link to="/videos" className="font-semibold text-blue-600 hover:text-blue-800">Browse available videos</Link>.</div> : null}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="mb-4 font-display text-lg font-semibold text-slate-900">Quick actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{QUICK_ACTIONS.map(({ label, description, path, icon: Icon }) => <Link key={label} to={path} className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><Icon className="h-6 w-6 text-blue-500" /><p className="mt-3 font-semibold text-slate-900">{label}</p><p className="mt-1 text-sm text-slate-500">{description}</p></Link>)}</div>
      </section>

      <section className="mt-8" aria-labelledby="attempts-heading">
        <div className="mb-4 flex items-center justify-between"><h2 id="attempts-heading" className="font-display text-lg font-semibold text-slate-900">Recent quiz attempts</h2><Link to="/quizzes" className="text-sm font-semibold text-blue-600 hover:text-blue-800">View quizzes</Link></div>
        {isLoading ? <LoadingCard label="recent quiz attempts" /> : !error && summary?.recent_attempts.length ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{summary.recent_attempts.map((attempt) => <div key={attempt.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-slate-900">{attempt.quiz_title}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(attempt.attempted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p></div>{attempt.status === 'graded' && attempt.score !== null ? <span className="font-semibold text-slate-900">{attempt.score}%</span> : <span className="w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Pending review</span>}</div>)}</div> : !error ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center"><p className="font-medium text-slate-900">No quiz attempts yet.</p><p className="mt-1 text-sm text-slate-500">Complete a quiz to see scores and recent activity here.</p><Link to="/quizzes" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Start a quiz</Link></div> : null}
      </section>
    </main>
  );
}

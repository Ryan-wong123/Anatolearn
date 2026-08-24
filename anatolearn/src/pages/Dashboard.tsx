import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenCheck, Box, CirclePlay, ClipboardCheck, Eye, RotateCcw, Sparkles, Trophy, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import type { DashboardSummary } from '../api/api';
import { useAppContext } from '../context/AppContext';

const QUICK_ACTIONS: Array<{ label: string; description: string; path: string; icon: LucideIcon }> = [
  { label: 'Explore 3D models', description: 'Inspect anatomy from every angle.', path: '/3dviewer', icon: Box },
  { label: 'Watch videos', description: 'Review bite-sized anatomy lessons.', path: '/videos', icon: Video },
  { label: 'Take a quiz', description: 'Check your understanding.', path: '/quizzes', icon: ClipboardCheck },
  { label: 'Annotation viewer', description: 'Open labelled interactive models.', path: '/3dviewer', icon: Eye },
];

const EMPTY_SUMMARY: DashboardSummary = {
  progress: { quizzes_completed: 0, average_quiz_score: null, videos_watched: null, models_explored: null },
  recent_attempts: [], featured: null,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function Dashboard() {
  const { role, program, user } = useAppContext();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary() {
    setIsLoading(true); setError(null);
    try { setSummary(await api.getDashboardSummary()); }
    catch (loadError) {
      console.error('Failed to load dashboard summary:', loadError);
      setError('We could not load your learning progress. Your learning links are still available below.');
    } finally { setIsLoading(false); }
  }

  useEffect(() => {
    let isCurrent = true;
    api.getDashboardSummary()
      .then((result) => { if (isCurrent) setSummary(result); })
      .catch((loadError: unknown) => {
        console.error('Failed to load dashboard summary:', loadError);
        if (isCurrent) setError('We could not load your learning progress. Your learning links are still available below.');
      })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, []);

  const featuredPath = summary.featured
    ? summary.featured.type === 'model' ? `/3dviewer/${summary.featured.id}` : `/videos/${summary.featured.id}`
    : '/3dviewer';
  const continuePath = summary.recent_attempts.length ? '/quizzes' : featuredPath;
  const continueLabel = summary.recent_attempts.length ? 'Continue with quizzes' : 'Start exploring';
  const progress: Array<{ label: string; value: string; detail: string; icon: LucideIcon }> = [
    { label: 'Quizzes completed', value: role === 'student' ? String(summary.progress.quizzes_completed) : '—', detail: role === 'student' ? 'Your submitted attempts' : 'Student-only activity', icon: BookOpenCheck },
    { label: 'Average quiz score', value: summary.progress.average_quiz_score === null ? '—' : `${summary.progress.average_quiz_score}%`, detail: summary.progress.average_quiz_score === null ? 'Complete a graded quiz' : 'Across graded attempts', icon: Trophy },
    { label: 'Videos watched', value: summary.progress.videos_watched === null ? '—' : String(summary.progress.videos_watched), detail: 'Tracking not yet available', icon: CirclePlay },
    { label: 'Models explored', value: summary.progress.models_explored === null ? '—' : String(summary.progress.models_explored), detail: 'Tracking not yet available', icon: Box },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-2xl bg-slate-900 px-6 py-7 text-white sm:flex sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-sm font-medium text-blue-300">{program} learning home</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
          <p className="mt-2 text-sm text-slate-300">Signed in as {role === 'teacher' ? 'Teacher' : 'Student'}. Pick up where you left off or choose a new activity.</p>
        </div>
        <Link to={continuePath} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-semibold transition-colors hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:mt-0">
          {continueLabel}<ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {error && <div role="alert" className="mt-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button type="button" onClick={() => void loadSummary()} className="inline-flex items-center gap-2 font-semibold hover:text-red-950 focus:outline-none focus:ring-2 focus:ring-red-400"><RotateCcw className="h-4 w-4" />Retry</button></div>}

      <section className="mt-8" aria-labelledby="progress-heading" aria-busy={isLoading}>
        <h2 id="progress-heading" className="font-display text-xl font-semibold text-slate-900">Your progress</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {progress.map(({ label, value, detail, icon: Icon }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-600">{label}</p><Icon className="h-5 w-5 text-blue-500" /></div>{isLoading ? <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200" aria-label={`Loading ${label}`} /> : <p className="mt-3 font-display text-3xl font-bold text-slate-900">{error ? '—' : value}</p>}<p className="mt-1 text-xs text-slate-500">{error ? 'Progress unavailable' : detail}</p></div>)}
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2" aria-labelledby="continue-heading">
          <div className="flex h-full flex-col justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-blue-600">Continue learning</p><h2 id="continue-heading" className="mt-1 font-display text-xl font-semibold text-slate-900">{summary.recent_attempts.length ? 'Build on your latest quiz' : 'Choose your first learning activity'}</h2><p className="mt-2 max-w-xl text-sm text-slate-600">{summary.recent_attempts.length ? `Review your recent ${summary.recent_attempts[0].quiz_title} attempt, then try another assessment.` : 'Explore an interactive model, watch a short lesson, or start a quiz to begin building your progress.'}</p></div><Link to={continuePath} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400">{continueLabel}<ArrowRight className="h-4 w-4" /></Link></div>
        </section>
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-6" aria-labelledby="featured-heading" aria-busy={isLoading}>
          <Sparkles className="h-6 w-6 text-blue-600" /><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-700">Featured content</p>
          {isLoading ? <div className="mt-2 space-y-2"><div className="h-6 w-3/4 animate-pulse rounded bg-blue-100" /><div className="h-4 w-full animate-pulse rounded bg-blue-100" /></div> : error ? <><h2 id="featured-heading" className="mt-1 font-display text-lg font-semibold text-slate-900">Featured content unavailable</h2><p className="mt-2 text-sm text-slate-600">Retry the dashboard request, or browse the model gallery directly.</p><Link to="/3dviewer" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900">Browse models</Link></> : summary.featured ? <><h2 id="featured-heading" className="mt-1 font-display text-lg font-semibold text-slate-900">{summary.featured.title}</h2><p className="mt-2 line-clamp-2 text-sm text-slate-600">{summary.featured.description || `Open this featured ${summary.featured.type} to learn more.`}</p><Link to={featuredPath} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400">Open {summary.featured.type}<ArrowRight className="h-4 w-4" /></Link></> : <><h2 id="featured-heading" className="mt-1 font-display text-lg font-semibold text-slate-900">Explore the model library</h2><p className="mt-2 text-sm text-slate-600">No featured content is published yet. Browse the library when new models become available.</p><Link to="/3dviewer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">Browse models<ArrowRight className="h-4 w-4" /></Link></>}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="quick-actions-heading"><h2 id="quick-actions-heading" className="font-display text-xl font-semibold text-slate-900">Quick actions</h2><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{QUICK_ACTIONS.map(({ label, description, path, icon: Icon }) => <Link key={label} to={path} className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"><Icon className="h-6 w-6 text-blue-500" /><h3 className="mt-4 text-sm font-semibold text-slate-900 group-hover:text-blue-700">{label}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></Link>)}</div></section>

      <section className="mt-8" aria-labelledby="recent-heading" aria-busy={isLoading}>
        <div className="flex items-center justify-between"><h2 id="recent-heading" className="font-display text-xl font-semibold text-slate-900">Recent quiz attempts</h2>{role === 'student' && <Link to="/quizzes" className="text-sm font-semibold text-blue-600 hover:text-blue-800">View quizzes</Link>}</div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {isLoading ? <div className="space-y-3 p-5" aria-label="Loading recent quiz attempts">{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-slate-100" />)}</div> : error ? <div className="p-6 text-center text-sm text-slate-600">Recent attempts are unavailable. Retry the dashboard request above.</div> : role !== 'student' ? <div className="p-6 text-center"><p className="text-sm text-slate-600">Quiz attempts are student learning activity. Use the Quizzes page to manage assessments.</p><Link to="/quizzes" className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-800">Manage quizzes</Link></div> : summary.recent_attempts.length === 0 ? <div className="p-6 text-center"><p className="text-sm font-medium text-slate-700">No quiz attempts yet.</p><p className="mt-1 text-sm text-slate-500">Take your first quiz to see scores and review activity here.</p><Link to="/quizzes" className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-800">Start your first quiz</Link></div> : <ul className="divide-y divide-slate-100">{summary.recent_attempts.map((attempt) => <li key={attempt.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-900">{attempt.quiz_title}</p><p className="mt-1 text-xs text-slate-500">{formatDate(attempt.attempted_at)}</p></div>{attempt.status === 'graded' ? <span className="text-sm font-semibold text-slate-900">{attempt.score}%</span> : <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Pending review</span>}</li>)}</ul>}
        </div>
      </section>
    </main>
  );
}

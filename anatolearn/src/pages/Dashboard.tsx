import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BookOpenCheck, Box, CirclePlay, ClipboardCheck, Eye, RotateCcw, Sparkles, Trophy, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';
import type { DashboardSummary } from '../api/api';

interface QuickAction { label: string; description: string; path: string; icon: LucideIcon }

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Explore 3D models', description: 'Study anatomy from every angle', path: '/3dviewer', icon: Box },
  { label: 'Watch videos', description: 'Review bite-sized explanations', path: '/videos', icon: Video },
  { label: 'Take a quiz', description: 'Check your understanding', path: '/quizzes', icon: ClipboardCheck },
  { label: 'Annotation viewer', description: 'Inspect labelled structures', path: '/3dviewer', icon: Eye },
];

function LoadingCard() {
  return <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" aria-label="Loading" />;
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
      <p>We could not load this section.</p>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 font-semibold text-red-700 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
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
      setSummary(await api.getDashboardSummary());
    } catch (loadError) {
      setSummary(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    api.getDashboardSummary()
      .then((data) => { if (isCurrent) setSummary(data); })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data');
      })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, []);

  const latestAttempt = summary?.recent_attempts[0];
  const featured = summary?.featured_content;
  const featuredPath = featured?.type === 'model' ? `/3dviewer/${featured.id}` : featured ? `/videos/${featured.id}` : '/quizzes';
  const primaryPath = latestAttempt ? '/quizzes' : featuredPath;
  const primaryLabel = latestAttempt ? 'Continue quiz practice' : featured ? `Open featured ${featured.type}` : 'Start a quiz';
  const progressCards = [
    { label: 'Quizzes completed', value: summary ? String(summary.progress.quizzes_completed) : '0', detail: summary?.progress.quizzes_completed ? 'Attempts submitted' : 'Take your first quiz', icon: BookOpenCheck, path: '/quizzes' },
    { label: 'Average quiz score', value: summary?.progress.average_quiz_score == null ? '—' : `${summary.progress.average_quiz_score}%`, detail: summary?.progress.average_quiz_score == null ? 'No graded attempts yet' : 'Across graded attempts', icon: Trophy, path: '/quizzes' },
    { label: 'Videos watched', value: summary?.progress.videos_watched == null ? '—' : String(summary.progress.videos_watched), detail: summary?.progress.videos_watched == null ? 'Tracking not available yet' : 'Videos completed', icon: CirclePlay, path: '/videos' },
    { label: 'Models explored', value: summary?.progress.models_explored == null ? '—' : String(summary.progress.models_explored), detail: summary?.progress.models_explored == null ? 'Tracking not available yet' : 'Models opened', icon: Box, path: '/3dviewer' },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-5 rounded-2xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-sm font-medium text-blue-200">{role === 'teacher' ? 'Teacher' : 'Student'} · {program}</p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">Pick up your anatomy learning, review your progress, or choose a new activity.</p>
        </div>
        <Link to={primaryPath} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-900">
          {primaryLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="mt-8" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="font-display text-xl font-semibold text-slate-900">Your progress</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? Array.from({ length: 4 }, (_, index) => <LoadingCard key={index} />) : error ? (
            <div className="sm:col-span-2 lg:col-span-4"><SectionError onRetry={loadSummary} /></div>
          ) : progressCards.map(({ label, value, detail, icon: Icon, path }) => (
            <Link key={label} to={path} className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-display text-2xl font-bold text-slate-900">{value}</p></div><Icon className="h-6 w-6 text-blue-500" /></div>
              <p className="mt-3 text-xs text-slate-500 group-hover:text-blue-700">{detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="continue-heading">
          <h2 id="continue-heading" className="font-display text-xl font-semibold text-slate-900">Continue learning</h2>
          <div className="mt-4">
            {isLoading ? <LoadingCard /> : error ? <SectionError onRetry={loadSummary} /> : latestAttempt ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Latest quiz activity</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-slate-900">{latestAttempt.quiz_title}</h3>
                <p className="mt-2 text-sm text-slate-500">{latestAttempt.status === 'graded' ? `Last score: ${latestAttempt.score}%` : 'Submitted and awaiting teacher review'}</p>
                <Link to="/quizzes" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500">Keep practising <ArrowRight className="h-4 w-4" /></Link>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
                <h3 className="font-semibold text-slate-900">Start your learning journey</h3>
                <p className="mt-2 text-sm text-slate-500">You have no recent activity. Try a quiz or explore an interactive model.</p>
                <div className="mt-4 flex flex-wrap gap-3"><Link to="/quizzes" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">Start a quiz</Link><Link to="/3dviewer" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Explore a model</Link></div>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="font-display text-xl font-semibold text-slate-900">Featured content</h2>
          <div className="mt-4">
            {isLoading ? <LoadingCard /> : error ? <SectionError onRetry={loadSummary} /> : featured ? (
              <Link to={featuredPath} className="group block rounded-xl border border-slate-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <Sparkles className="h-6 w-6 text-purple-500" /><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-purple-600">Featured {featured.type}</p><h3 className="mt-1 font-display text-lg font-semibold text-slate-900">{featured.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{featured.description || `Open this ${featured.type} to continue learning.`}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 group-hover:text-blue-800">Open {featured.type} <ArrowRight className="h-4 w-4" /></span>
              </Link>
            ) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No featured models or videos are available yet. <Link to="/videos" className="font-semibold text-blue-600 hover:text-blue-800">Browse other content</Link>.</div>}
          </div>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="font-display text-xl font-semibold text-slate-900">Quick actions</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map(({ label, description, path, icon: Icon }) => <Link key={label} to={path} className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><Icon className="h-6 w-6 text-blue-500" /><h3 className="mt-3 font-semibold text-slate-900">{label}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></Link>)}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="attempts-heading">
        <div className="flex items-center justify-between gap-4"><h2 id="attempts-heading" className="font-display text-xl font-semibold text-slate-900">Recent quiz attempts</h2><Link to="/quizzes" className="text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500">View quizzes</Link></div>
        <div className="mt-4">
          {isLoading ? <LoadingCard /> : error ? <SectionError onRetry={loadSummary} /> : summary && summary.recent_attempts.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {summary.recent_attempts.map((attempt) => <div key={attempt.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{attempt.quiz_title}</p><p className="mt-1 text-xs text-slate-500">{new Date(attempt.attempted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p></div>{attempt.status === 'graded' ? <span className="text-sm font-semibold text-slate-900">{attempt.score}%</span> : <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Pending review</span>}</div>)}
            </div>
          ) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center"><p className="text-sm text-slate-500">No quiz attempts yet.</p><Link to="/quizzes" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500">Take your first quiz <ArrowRight className="h-4 w-4" /></Link></div>}
        </div>
      </section>
      {error && <p className="sr-only">Dashboard request failed: {error}</p>}
    </main>
  );
}

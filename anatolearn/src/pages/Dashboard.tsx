import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, BookOpenCheck, Box, CirclePlay, ClipboardCheck, MousePointer2, PlayCircle, RotateCcw, Sparkles, Trophy, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';

interface AttemptSummary {
  id: number;
  quiz_id: number;
  quiz_title: string;
  score: number | null;
  status: 'graded' | 'pending_review';
  attempted_at: string;
}

interface LearningLink {
  title: string;
  description: string;
  path: string;
  action_label: string;
}

interface FeaturedContent {
  id: number;
  title: string;
  description: string | null;
  content_type: 'model' | 'video';
  path: string;
}

interface DashboardSummary {
  progress: {
    quizzes_completed: number | null;
    average_quiz_score: number | null;
    videos_watched: number | null;
    models_explored: number | null;
  };
  recent_attempts: AttemptSummary[];
  continue_learning: LearningLink | null;
  featured: FeaturedContent | null;
}

interface ProgressCard {
  label: string;
  value: number | null;
  suffix?: string;
  icon: LucideIcon;
  iconClass: string;
}

const QUICK_ACTIONS = [
  { label: 'Explore 3D models', description: 'Inspect anatomy in an interactive viewer.', path: '/3dviewer', icon: Box },
  { label: 'Watch videos', description: 'Learn with concise visual explanations.', path: '/videos', icon: Video },
  { label: 'Take a quiz', description: 'Check your knowledge and review results.', path: '/quizzes', icon: ClipboardCheck },
  { label: 'Open annotation viewer', description: 'Choose a model and explore its labels.', path: '/3dviewer', icon: MousePointer2 },
];

function SectionState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">{message}</div>;
}

export default function Dashboard() {
  const { role, program, user } = useAppContext();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.getDashboardSummary() as DashboardSummary);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
      setError('We could not load your learning summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.getDashboardSummary()
      .then((data) => { if (active) setSummary(data as DashboardSummary); })
      .catch((err: unknown) => {
        console.error('Failed to load dashboard summary:', err);
        if (active) setError('We could not load your learning summary. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const progressCards: ProgressCard[] = [
    { label: 'Quizzes completed', value: summary?.progress.quizzes_completed ?? null, icon: BookOpenCheck, iconClass: 'bg-blue-50 text-blue-600' },
    { label: 'Average quiz score', value: summary?.progress.average_quiz_score ?? null, suffix: '%', icon: Trophy, iconClass: 'bg-amber-50 text-amber-600' },
    { label: 'Videos watched', value: summary?.progress.videos_watched ?? null, icon: CirclePlay, iconClass: 'bg-violet-50 text-violet-600' },
    { label: 'Models explored', value: summary?.progress.models_explored ?? null, icon: Box, iconClass: 'bg-emerald-50 text-emerald-600' },
  ];
  const primaryPath = summary?.continue_learning?.path ?? '/quizzes';
  const primaryLabel = summary?.continue_learning?.action_label ?? 'Start learning';

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-2xl bg-slate-900 px-6 py-7 text-white shadow-sm sm:px-8 sm:py-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <BadgeCheck className="h-4 w-4 text-blue-300" />
              <span className="capitalize">{role}</span><span aria-hidden="true">•</span><span>{program} programme</span>
            </div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Continue your anatomy learning, review your progress, or choose a new activity.</p>
          </div>
          <Link to={primaryPath} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-slate-900">
            <PlayCircle className="h-5 w-5" />{loading ? 'Loading activity…' : primaryLabel}
          </Link>
        </div>
      </section>

      {error && <div role="alert" className="mt-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button type="button" onClick={() => void loadSummary()} className="inline-flex items-center gap-2 font-semibold hover:text-red-950 focus:outline-none focus:ring-2 focus:ring-red-500"><RotateCcw className="h-4 w-4" />Try again</button></div>}

      <section className="mt-8" aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="font-display text-xl font-semibold text-slate-900">Your progress</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {progressCards.map(({ label, value, suffix = '', icon: Icon, iconClass }) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`inline-flex rounded-lg p-2.5 ${iconClass}`}><Icon className="h-5 w-5" /></div><p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
            {loading ? <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200" aria-label={`Loading ${label}`} /> : error ? <p className="mt-2 text-sm font-medium text-red-600">Unavailable</p> : value === null ? <p className="mt-2 text-sm font-medium text-slate-500">Not tracked yet</p> : <p className="mt-1 font-display text-3xl font-bold text-slate-900">{value}{suffix}</p>}
          </article>)}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-5" aria-label="Learning recommendations">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
          <div className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-blue-600" /><h2 className="font-display text-xl font-semibold text-slate-900">Continue learning</h2></div>
          <div className="mt-5">{loading ? <SectionState message="Loading your latest activity…" /> : error ? <SectionState message="Your latest activity is temporarily unavailable." /> : summary?.continue_learning ? <div><h3 className="text-lg font-semibold text-slate-900">{summary.continue_learning.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{summary.continue_learning.description}</p><Link to={summary.continue_learning.path} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500">{summary.continue_learning.action_label}<ArrowRight className="h-4 w-4" /></Link></div> : <div className="rounded-xl bg-blue-50 p-5"><p className="text-sm text-slate-700">You have no recent activity. Start with a quiz or explore an anatomy model.</p><div className="mt-4 flex flex-wrap gap-3"><Link to="/quizzes" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Start a quiz →</Link><Link to="/3dviewer" className="text-sm font-semibold text-blue-700 hover:text-blue-900">Explore a model →</Link></div></div>}</div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" /><h2 className="font-display text-xl font-semibold text-slate-900">Featured content</h2></div>
          <div className="mt-5">{loading ? <SectionState message="Loading featured content…" /> : error ? <SectionState message="Featured content is temporarily unavailable." /> : summary?.featured ? <div><span className="text-xs font-semibold uppercase tracking-wide text-violet-600">Featured {summary.featured.content_type}</span><h3 className="mt-2 text-lg font-semibold text-slate-900">{summary.featured.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{summary.featured.description || 'Explore this anatomy learning resource.'}</p><Link to={summary.featured.path} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500">Open content<ArrowRight className="h-4 w-4" /></Link></div> : <SectionState message="No featured models or videos are available yet. Check back after new content is published." />}</div>
        </article>
      </section>

      <section className="mt-8" aria-labelledby="actions-heading"><h2 id="actions-heading" className="font-display text-xl font-semibold text-slate-900">Quick actions</h2><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{QUICK_ACTIONS.map(({ label, description, path, icon: Icon }) => <Link key={label} to={path} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"><Icon className="h-6 w-6 text-blue-600" /><h3 className="mt-4 font-semibold text-slate-900 group-hover:text-blue-700">{label}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></Link>)}</div></section>

      <section className="mt-8" aria-labelledby="attempts-heading"><h2 id="attempts-heading" className="font-display text-xl font-semibold text-slate-900">Recent quiz attempts</h2><div className="mt-4">
        {loading ? <SectionState message="Loading recent quiz attempts…" /> : error ? <SectionState message="Recent quiz attempts are temporarily unavailable." /> : summary?.recent_attempts.length ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><ul className="divide-y divide-slate-100">{summary.recent_attempts.map((attempt) => <li key={attempt.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-slate-900">{attempt.quiz_title}</p><p className="mt-1 text-xs text-slate-500">{new Date(attempt.attempted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p></div>{attempt.status === 'graded' ? <span className="font-semibold text-slate-900">{attempt.score ?? '—'}%</span> : <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Pending review</span>}</li>)}</ul><Link to="/quizzes" className="flex min-h-11 items-center justify-center gap-2 border-t border-slate-200 px-4 text-sm font-semibold text-blue-600 hover:bg-slate-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">View quizzes<ArrowRight className="h-4 w-4" /></Link></div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><p className="text-sm text-slate-600">{role === 'student' ? 'No quiz attempts yet. Take a quiz to begin building your progress history.' : 'Quiz attempt history is linked to student accounts.'}</p><Link to={role === 'student' ? '/quizzes' : '/3dviewer'} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800">{role === 'student' ? 'Start a quiz' : 'Explore learning content'}<ArrowRight className="h-4 w-4" /></Link></div>}
      </div></section>
    </main>
  );
}

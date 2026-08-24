import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, BookOpenCheck, Box, CirclePlay, ClipboardCheck, MousePointer2, Trophy, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/api';
import { useAppContext } from '../context/AppContext';

interface AttemptSummary { id: number; quiz_id: number; quiz_title: string; score: number | null; status: 'graded' | 'pending_review'; attempted_at: string }
interface LearningContent { id: number; title: string; description?: string | null }
type LoadState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: T };

const QUICK_ACTIONS: Array<{ label: string; description: string; path: string; icon: LucideIcon }> = [
  { label: 'Explore 3D models', description: 'Browse interactive anatomy models.', path: '/3dviewer', icon: Box },
  { label: 'Watch videos', description: 'Review bite-sized anatomy lessons.', path: '/videos', icon: Video },
  { label: 'Take a quiz', description: 'Check your knowledge and view results.', path: '/quizzes', icon: ClipboardCheck },
  { label: 'Annotation viewer', description: 'Open a model to inspect its labels.', path: '/3dviewer', icon: MousePointer2 },
];

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function LoadingCard({ label }: { label: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5" role="status"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /><div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" /><span className="sr-only">Loading {label}</span></div>;
}

export default function Dashboard() {
  const { role, program, user } = useAppContext();
  const [attempts, setAttempts] = useState<LoadState<AttemptSummary[]>>({ status: 'loading' });
  const [models, setModels] = useState<LoadState<LearningContent[]>>({ status: 'loading' });
  const [videos, setVideos] = useState<LoadState<LearningContent[]>>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    api.getDashboardModels(role === 'student')
      .then((data: LearningContent[]) => active && setModels({ status: 'success', data }))
      .catch((error: unknown) => active && setModels({ status: 'error', message: message(error, 'Models could not be loaded.') }));
    api.getDashboardVideos(role === 'student')
      .then((data: LearningContent[]) => active && setVideos({ status: 'success', data }))
      .catch((error: unknown) => active && setVideos({ status: 'error', message: message(error, 'Videos could not be loaded.') }));
    if (role === 'student') {
      api.getDashboardAttempts()
        .then((data: AttemptSummary[]) => active && setAttempts({ status: 'success', data }))
        .catch((error: unknown) => active && setAttempts({ status: 'error', message: message(error, 'Quiz activity could not be loaded.') }));
    }
    return () => { active = false; };
  }, [role]);

  const graded = useMemo(() => attempts.status === 'success' ? attempts.data.filter((item) => item.status === 'graded' && item.score !== null) : [], [attempts]);
  const average = graded.length ? Math.round(graded.reduce((sum, item) => sum + (item.score ?? 0), 0) / graded.length) : null;
  const featuredModel = models.status === 'success' ? models.data[0] : undefined;
  const featuredVideo = videos.status === 'success' ? videos.data[0] : undefined;
  const featured = featuredModel
    ? { ...featuredModel, kind: '3D model', path: `/3dviewer/${featuredModel.id}`, icon: Box }
    : featuredVideo ? { ...featuredVideo, kind: 'video', path: `/videos/${featuredVideo.id}`, icon: CirclePlay } : null;
  const latest = attempts.status === 'success' ? attempts.data[0] : undefined;
  const continueItem = latest
    ? { title: latest.quiz_title, detail: latest.status === 'graded' ? `Latest score: ${latest.score}%` : 'Your submission is awaiting review.', path: '/quizzes', action: 'View quiz activity' }
    : featured ? { title: featured.title, detail: `Start with this featured ${featured.kind}.`, path: featured.path, action: `Open ${featured.kind}` } : null;
  const progress = [
    { label: 'Quizzes completed', value: role === 'teacher' ? 'N/A' : attempts.status === 'success' ? String(graded.length) : null, icon: BookOpenCheck, note: role === 'teacher' ? 'Student learning metric' : 'Graded attempts' },
    { label: 'Average quiz score', value: role === 'teacher' ? 'N/A' : attempts.status === 'success' ? (average === null ? '—' : `${average}%`) : null, icon: Trophy, note: average === null ? 'No graded scores yet' : 'Across graded attempts' },
    { label: 'Videos watched', value: '—', icon: CirclePlay, note: 'Watch tracking is not available' },
    { label: 'Models explored', value: '—', icon: Box, note: 'Exploration tracking is not available' },
  ];
  const contentLoading = models.status === 'loading' || videos.status === 'loading';
  const contentError = models.status === 'error' || videos.status === 'error';

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <section className="flex flex-col gap-5 rounded-2xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div><p className="text-sm font-medium text-blue-200">{program} learning home</p><h1 className="mt-1 font-display text-3xl font-bold">Welcome back{user?.name ? `, ${user.name}` : ''}</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><BadgeCheck className="h-4 w-4" />Signed in as {role === 'teacher' ? 'Teacher' : 'Student'}</p></div>
      {contentLoading || (role === 'student' && attempts.status === 'loading') ? <span className="rounded-lg bg-white/10 px-5 py-3 text-sm" role="status">Finding your latest activity…</span> : <Link to={continueItem?.path ?? '/quizzes'} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-semibold transition-colors hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200">{continueItem ? 'Resume learning' : 'Browse activities'} <ArrowRight className="h-4 w-4" /></Link>}
    </section>

    <section className="mt-8" aria-labelledby="progress-heading"><h2 id="progress-heading" className="font-display text-xl font-semibold text-slate-900">Your progress</h2>
      {attempts.status === 'error' && role === 'student' && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{attempts.message}</p>}
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">{progress.map(({ label, value, icon: Icon, note }, index) => role === 'student' && attempts.status === 'loading' && index < 2 ? <LoadingCard key={label} label={label} /> : <div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><Icon className="h-5 w-5 text-blue-500" /></div><p className="mt-2 font-display text-2xl font-bold text-slate-900">{value ?? '—'}</p><p className="mt-1 text-xs text-slate-400">{note}</p></div>)}</div>
    </section>

    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2" aria-labelledby="continue-heading"><h2 id="continue-heading" className="font-display text-xl font-semibold text-slate-900">Continue learning</h2>
        {contentLoading || (role === 'student' && attempts.status === 'loading') ? <p className="mt-4 text-sm text-slate-500" role="status">Loading your next activity…</p> : continueItem ? <div className="mt-4 flex flex-col gap-4 rounded-xl bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{continueItem.title}</p><p className="mt-1 text-sm text-slate-600">{continueItem.detail}</p></div><Link to={continueItem.path} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500">{continueItem.action} <ArrowRight className="h-4 w-4" /></Link></div> : contentError ? <div className="mt-4"><p className="text-sm text-red-700" role="alert">We could not load an activity right now.</p><Link to="/quizzes" className="mt-3 inline-flex text-sm font-semibold text-blue-700">Browse quizzes instead</Link></div> : <div className="mt-4"><p className="text-sm text-slate-500">No learning activity is available yet.</p><div className="mt-3 flex flex-wrap gap-4"><Link to="/quizzes" className="text-sm font-semibold text-blue-700">Start a quiz</Link><Link to="/3dviewer" className="text-sm font-semibold text-blue-700">Explore a model</Link><Link to="/videos" className="text-sm font-semibold text-blue-700">View videos</Link></div></div>}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="featured-heading"><h2 id="featured-heading" className="font-display text-xl font-semibold text-slate-900">Featured content</h2>
        {contentLoading ? <p className="mt-4 text-sm text-slate-500" role="status">Loading featured content…</p> : featured ? <div className="mt-4"><featured.icon className="h-10 w-10 text-blue-500" /><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-blue-600">Featured {featured.kind}</p><h3 className="mt-1 font-semibold text-slate-900">{featured.title}</h3><p className="mt-2 line-clamp-3 text-sm text-slate-500">{featured.description || `Open this ${featured.kind} to continue learning.`}</p><Link to={featured.path} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">View {featured.kind} <ArrowRight className="h-4 w-4" /></Link></div> : contentError ? <p className="mt-4 text-sm text-red-700" role="alert">Featured content could not be loaded.</p> : <div className="mt-4"><p className="text-sm text-slate-500">No featured model or video is available.</p><Link to="/3dviewer" className="mt-3 inline-flex text-sm font-semibold text-blue-700">Browse the model library</Link></div>}
      </section>
    </div>

    <section className="mt-8" aria-labelledby="actions-heading"><h2 id="actions-heading" className="font-display text-xl font-semibold text-slate-900">Quick actions</h2><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{QUICK_ACTIONS.map(({ label, description, path, icon: Icon }) => <Link key={label} to={path} className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"><Icon className="h-6 w-6 text-blue-500" /><p className="mt-3 font-semibold text-slate-900 group-hover:text-blue-700">{label}</p><p className="mt-1 text-sm text-slate-500">{description}</p></Link>)}</div></section>

    <section className="mt-8" aria-labelledby="attempts-heading"><div className="flex items-center justify-between"><h2 id="attempts-heading" className="font-display text-xl font-semibold text-slate-900">Recent quiz attempts</h2><Link to="/quizzes" className="text-sm font-semibold text-blue-700">View quizzes</Link></div>
      {role === 'teacher' ? <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Quiz attempts are student learning records. Open Quizzes to review submissions requiring teacher action.</p><Link to="/quizzes" className="mt-3 inline-flex text-sm font-semibold text-blue-700">Review quiz submissions</Link></div> : attempts.status === 'loading' ? <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">Loading recent attempts…</div> : attempts.status === 'error' ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-6"><p className="text-sm text-red-700" role="alert">{attempts.message}</p><Link to="/quizzes" className="mt-3 inline-flex text-sm font-semibold text-blue-700">Open quizzes</Link></div> : attempts.data.length === 0 ? <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">You have not attempted a quiz yet.</p><Link to="/quizzes" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Start your first quiz <ArrowRight className="h-4 w-4" /></Link></div> : <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">{attempts.data.slice(0, 4).map((attempt) => <div key={attempt.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{attempt.quiz_title}</p><p className="mt-1 text-xs text-slate-400">{new Date(attempt.attempted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p></div>{attempt.status === 'graded' ? <span className="text-sm font-bold text-slate-900">{attempt.score}%</span> : <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Pending review</span>}</div>)}</div>}
    </section>
  </main>;
}

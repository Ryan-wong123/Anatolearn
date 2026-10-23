import { Fragment, useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Box, FileText, Search as SearchIcon, Tag, Video } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import EmptyState from '../components/EmptyState';
import RequestState from '../components/RequestState';
import { inputClass, primaryButton } from '../components/account/styles';
import { useResource } from '../hooks/useResource';
import { api } from '../api/api';
import type { SearchHit, SearchResults } from '../types/portal';

const MIN_LENGTH = 2;
const EMPTY: SearchResults = { query: '', models: [], videos: [], quizzes: [], resources: [], annotations: [] };

// Splits text around case-insensitive matches so matches can be wrapped in <mark> without ever injecting HTML.
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const parts: { value: string; match: boolean }[] = [];
  let cursor = 0;
  for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, cursor)) {
    if (index > cursor) parts.push({ value: text.slice(cursor, index), match: false });
    parts.push({ value: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }
  if (cursor < text.length) parts.push({ value: text.slice(cursor), match: false });
  return <>{parts.map((part, i) => part.match
    ? <mark key={i} className="rounded bg-yellow-200 px-0.5 text-slate-900 dark:bg-yellow-300">{part.value}</mark>
    : <Fragment key={i}>{part.value}</Fragment>)}</>;
}

function Group({ title, icon, hits, term, href, extra }: {
  title: string; icon: ReactNode; hits: SearchHit[]; term: string; href: (hit: SearchHit) => string; extra?: (hit: SearchHit) => string | null;
}) {
  if (hits.length === 0) return null;
  const headingId = `search-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 id={headingId} className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
        <span aria-hidden="true" className="text-blue-600 dark:text-blue-400">{icon}</span>{title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{hits.length}</span>
      </h2>
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {hits.map((hit) => (
          <li key={hit.id}>
            <Link to={href(hit)} className="block rounded-md py-3 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800">
              <span className="font-medium text-blue-700 dark:text-blue-400"><Highlight text={hit.title} term={term} /></span>
              {extra?.(hit) && <span className="block text-xs text-slate-600 dark:text-slate-400">{extra(hit)}</span>}
              {hit.description && <span className="mt-0.5 block line-clamp-2 text-sm text-slate-700 dark:text-slate-300"><Highlight text={hit.description} term={term} /></span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const urlTerm = (params.get('q') ?? '').trim();
  const [input, setInput] = useState(urlTerm);
  const [syncedTerm, setSyncedTerm] = useState(urlTerm);
  // Keep the box in step when the header search navigates here with a new term (adjusting state while rendering).
  if (syncedTerm !== urlTerm) { setSyncedTerm(urlTerm); setInput(urlTerm); }

  // Debounce typing into the URL so each keystroke does not hit the server.
  useEffect(() => {
    const next = input.trim();
    if (next === urlTerm) return;
    const timer = window.setTimeout(() => setParams(next ? { q: next } : {}, { replace: true }), 350);
    return () => window.clearTimeout(timer);
  }, [input, urlTerm, setParams]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setParams(input.trim() ? { q: input.trim() } : {}, { replace: true });
  }

  const ready = urlTerm.length >= MIN_LENGTH;
  // useResource reloads whenever the loader identity changes, so it must be stable between renders.
  const loadResults = useCallback(() => (ready ? api.search(urlTerm) : Promise.resolve(EMPTY)), [ready, urlTerm]);
  const { data, loading, error, reload } = useResource<SearchResults>(loadResults, EMPTY, urlTerm);
  const total = data.models.length + data.videos.length + data.quizzes.length + data.resources.length + data.annotations.length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Search' }]} />
      <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">Search</h1>
      <form role="search" onSubmit={submit} className="mb-6 flex gap-2">
        <label htmlFor="search-page-input" className="sr-only">Search models, videos, quizzes and library</label>
        <input id="search-page-input" type="search" autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search models, videos, quizzes, library and labelled parts" className={inputClass} />
        <button type="submit" className={primaryButton}><SearchIcon className="h-4 w-4" aria-hidden="true" />Search</button>
      </form>

      {!ready && (
        <p role="status" className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Type at least {MIN_LENGTH} characters to search.
        </p>
      )}
      {ready && <RequestState loading={loading} error={error} onRetry={reload} label="search results" />}
      {ready && !loading && !error && total === 0 && (
        <EmptyState icon={<SearchIcon className="h-10 w-10" />} title={`No results for “${urlTerm}”`}>Check the spelling or try a shorter, more general word such as a body part or system.</EmptyState>
      )}
      {ready && !loading && !error && total > 0 && (
        <>
          <p role="status" className="mb-4 text-sm text-slate-700 dark:text-slate-300">{total} {total === 1 ? 'result' : 'results'} for “{urlTerm}”</p>
          <div className="space-y-6">
            <Group title="3D models" icon={<Box className="h-5 w-5" />} hits={data.models} term={urlTerm} href={(hit) => `/3dviewer/${hit.id}`}
              extra={(hit) => [hit.body_system, hit.body_part].filter((v): v is string => typeof v === 'string' && v.length > 0).join(' · ') || null} />
            <Group title="Labelled parts" icon={<Tag className="h-5 w-5" />} hits={data.annotations} term={urlTerm} href={(hit) => `/3dviewer/${(hit as SearchResults['annotations'][number]).model_id}`}
              extra={(hit) => `In model: ${(hit as SearchResults['annotations'][number]).model_title}`} />
            <Group title="Videos" icon={<Video className="h-5 w-5" />} hits={data.videos} term={urlTerm} href={(hit) => `/videos/${hit.id}`} />
            <Group title="Quizzes" icon={<BookOpen className="h-5 w-5" />} hits={data.quizzes} term={urlTerm} href={() => '/quizzes'}
              extra={(hit) => (typeof hit.category === 'string' && hit.category ? hit.category : null)} />
            <Group title="Library" icon={<FileText className="h-5 w-5" />} hits={data.resources} term={urlTerm} href={() => '/library'}
              extra={(hit) => (typeof hit.resource_type === 'string' ? hit.resource_type : null)} />
          </div>
        </>
      )}
    </div>
  );
}

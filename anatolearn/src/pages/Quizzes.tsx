import RequestState from '../components/RequestState';
import { useResource } from '../hooks/useResource';
import Dialog from '../components/Dialog';
import QuestionBank from '../components/QuestionBank';
import ContentSettings from '../components/ContentSettings';
import OwnerNote from '../components/OwnerNote';
import Pagination from '../components/Pagination';
import BarList from '../components/dashboard/BarList';
import Sparkline from '../components/dashboard/Sparkline';
import type { StudentStats } from '../types/portal';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Clock, BookOpen, Search, Heart, RotateCcw, ArrowLeft, ChevronLeft, ChevronRight, X, Check, Sun, Moon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContextState';
import { useToast } from '../context/ToastContextState';
import { api } from '../api/api';
import ThreeDQuestion, { type Student3DConfig } from '../components/quiz/ThreeDQuestion';
import ThreeDQuestionEditor, { type Teacher3DConfig } from '../components/quiz/ThreeDQuestionEditor';
import type { RegionReview } from '../components/quiz/regionFeedback';

interface Quiz {
  id: number;
  can_manage?: boolean;
  owner_name?: string | null;
  program_id: number | null;
  time_limit_seconds?: number | null;
  title: string;
  description: string | null;
  type: 'MCQ' | 'Practical' | 'Mixed';
  category: string | null;
  is_published: boolean;
  created_at: string;
}

type QuestionFormat = 'mcq' | 'open_ended' | 'region_identification' | 'annotation_matching';
const is3D = (f:QuestionFormat): f is 'region_identification' | 'annotation_matching' => f==='region_identification'||f==='annotation_matching';
interface QuizQuestion {
  id: number;
  quiz_id: number;
  question: string;
  format: QuestionFormat;
  student_config?: Student3DConfig;
  question_config?: Teacher3DConfig | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
}

interface CreatedQuizQuestion {
  id: number;
  quiz_id: number;
  question: string;
  format: QuestionFormat;
  student_config?: Student3DConfig;
  question_config?: Teacher3DConfig | null;
  category?: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: 'A' | 'B' | 'C' | 'D' | null;
  model_answer: string | null;
}

interface SubmitFeedbackItem {
  question_id: number;
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
  format?: QuestionFormat;
  score?: number | null;
  details?: {iou?:number;coverage?:number;precision?:number;matched?:number;total?:number}|null;
  region_review?: RegionReview | null;
}

interface SubmitResult {
  status: 'graded' | 'pending_review';
  score: number | null;
  total: number;
  correct: number | null;
  incorrect: number | null;
  mcq_count: number;
  open_ended_count: number;
  feedback: SubmitFeedbackItem[];
}

interface QuizAttemptSummary {
  id: number;
  quiz_id: number;
  quiz_title: string;
  score: number | null;
  status: 'graded' | 'pending_review';
  attempted_at: string;
}

interface TeacherAttempt { id:number; student_id:number; student_name?:string; status:string; score:number|null; attempted_at:string; }
interface AttemptAnswer { id:number; question_id:number; question:string; format:QuestionFormat; model_answer:string|null; correct_option:string|null; selected_option:string|null; answer_text:string|null; teacher_score:number|null; is_correct:boolean|null; answer_json?: {points?:{x:number;y:number;z:number}[]}|null; region_review?:RegionReview|null; }
interface OpenEndedResult { question_id:number; question:string; answer_text:string|null; teacher_score:number|null; }

const optionLetters = ['A', 'B', 'C', 'D'] as const;
const QUIZ_PAGE_SIZE = 12;
const HISTORY_PAGE_SIZE = 10;
type HistorySort = 'newest' | 'oldest' | 'highest';
const clientNow = () => Date.now();

type SavedAnswers = Record<number, string>;
interface QuizSessionData {
  session_id: string; expires_at: string | null; server_now: string; session_expires_at: string;
  questions: QuizQuestion[]; draft_answers?: SavedAnswers; draft_revision?: number; resumed?: boolean;
}
interface CachedQuizDraft { sessionId: string; answers: SavedAnswers; revision: number; currentQuestion: number; updatedAt: number; }
const cacheKey = (userId: number, quizId: number) => `anatolearn-quiz-draft-v1:${userId}:${quizId}`;
function readCachedQuizDraft(userId: number, quizId: number, sessionId: string): CachedQuizDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey(userId, quizId)) || 'null') as CachedQuizDraft | null;
    if (!value || value.sessionId !== sessionId || typeof value.answers !== 'object' ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || !Number.isFinite(value.updatedAt) ||
      Date.now() - value.updatedAt > 48 * 3600 * 1000) return null;
    return value;
  } catch { return null; }
}


const quizTypeBadgeClasses: Record<Quiz['type'], string> = {
  MCQ: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  Practical: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400',
  Mixed: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
};

function deriveQuizType(questions: CreatedQuizQuestion[]): 'MCQ' | 'Practical' | 'Mixed' {
  const hasMcq = questions.some((q) => q.format === 'mcq');
  const hasOpenEnded = questions.some((q) => q.format !== 'mcq');

  if (hasMcq && hasOpenEnded) return 'Mixed';
  if (hasOpenEnded) return 'Practical';
  return 'MCQ';
}

export default function Quizzes() {
  const { toast } = useToast();
  const { role, program, theme, toggleTheme, user } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const quizRoute = /^\/quizzes\/(\d+)\/(take|review)(?:\/(\d+))?\/?$/.exec(location.pathname);
  const isQuizPage = Boolean(quizRoute);
  const authorRoute = /^\/quizzes\/(?:create|(\d+)\/edit)\/?$/.exec(location.pathname);
  const isAuthorPage = Boolean(authorRoute);
  const authorQuizId = authorRoute?.[1] ? Number(authorRoute[1]) : null;
  const isDedicatedPage = isQuizPage || isAuthorPage;
  const routeHydration = useRef<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);


  const [quizSearchTerm, setQuizSearchTerm] = useState('');
  const [quizPage, setQuizPage] = useState(1);
  const [historyQuizId, setHistoryQuizId] = useState('all');
  const [historyStatus, setHistoryStatus] = useState<'all' | 'graded' | 'pending_review'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState<HistorySort>('newest');
  const [historyPage, setHistoryPage] = useState(1);
  const [sessionId, setSessionId] = useState('');
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'offline' | 'conflict'>('saved');
  const draftSessionRef = useRef('');
  const draftRevisionRef = useRef(0);
  const draftAckRef = useRef(0);
  const draftSnapshotRef = useRef('{}');
  const draftAnswersRef = useRef<SavedAnswers>({});
  const draftQuestionRef = useRef(0);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKeyRef = useRef<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [reviewRegionId, setReviewRegionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSubmissionReview, setShowSubmissionReview] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [authorPageError, setAuthorPageError] = useState<string | null>(null);
  const authorHydrationRef = useRef<string | null>(null);

  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDescription, setNewQuizDescription] = useState('');
  const [newQuizCategory, setNewQuizCategory] = useState('');
  const [createdQuiz, setCreatedQuiz] = useState<Quiz | null>(null);
  const [createdQuestions, setCreatedQuestions] = useState<CreatedQuizQuestion[]>([]);
  const draftQuestionId = useRef(-1);
  const [bankOnSaveIds, setBankOnSaveIds] = useState<number[]>([]);
  const [savingEditor, setSavingEditor] = useState(false);
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptionA, setNewOptionA] = useState('');
  const [newOptionB, setNewOptionB] = useState('');
  const [newOptionC, setNewOptionC] = useState('');
  const [newOptionD, setNewOptionD] = useState('');
  const [newCorrectOption, setNewCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [createQuizError, setCreateQuizError] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  // Distinguish existing-quiz editing from creating a new quiz so that
  // exiting the editor never deletes an existing quiz.
  const [isEditMode, setIsEditMode] = useState(false);
  const [newQuestionFormat, setNewQuestionFormat] = useState<QuestionFormat>('mcq');
  const [new3DConfig, setNew3DConfig] = useState<Teacher3DConfig|null>(null);
  const [newModelAnswer, setNewModelAnswer] = useState('');

  const [showResultsQuiz, setShowResultsQuiz] = useState<Quiz | null>(null);
  const [pendingAttempts, setPendingAttempts] = useState<TeacherAttempt[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [attemptAnswers, setAttemptAnswers] = useState<AttemptAnswer[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<number, string>>({});
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingAnswerId, setGradingAnswerId] = useState<number | null>(null);
  const [openEndedResults, setOpenEndedResults] = useState<OpenEndedResult[]>([]);

  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editQuizTitle, setEditQuizTitle] = useState('');
  const [editQuizDescription, setEditQuizDescription] = useState('');
  const [editQuizCategory, setEditQuizCategory] = useState('');
  const [editQuizError, setEditQuizError] = useState<string | null>(null);

  // Task 8.8 — real quiz attempt history, keyed to the logged-in student's
  // account rather than the old same-browser sessionStorage stopgap.


  // Students only — which quiz ids are currently favorited.


  const fetchQuizzes = useCallback(() => api.getQuizzes(role === 'student'), [role]);
  const { data: quizzes, setData: setQuizzes, reload: loadQuizzes, loading, error: loadError } = useResource<Quiz[]>(fetchQuizzes, [], program);

  const fetchHistory = useCallback(() => role === 'student' ? api.getMyAttempts() : Promise.resolve([]), [role]);
  const history = useResource<QuizAttemptSummary[]>(fetchHistory, [], program);
  const {data:attemptHistory} = history;
  const fetchStats = useCallback(() => role === 'student' ? api.getMyStats() : Promise.resolve(null), [role]);
  const stats = useResource<StudentStats | null>(fetchStats, null, program);
  const fetchFavorites = useCallback(async () => {
    if (role !== 'student') return new Set<number>();
    const data: {quizzes:{id:number}[]} = await api.getFavorites();
    return new Set(data.quizzes.map((quiz) => quiz.id));
  }, [role]);
  const favorites = useResource<Set<number>>(fetchFavorites, new Set(), program);
  const {data:favoritedQuizIds,setData:setFavoritedQuizIds} = favorites;

  // Allow professors to reopen an editor URL after refresh. Question changes
  // are saved by the existing API; the current unsaved form is not persisted.
  useEffect(() => {
    if (!isAuthorPage || role !== 'teacher') return;
    if (/^\/quizzes\/create\/?$/.test(location.pathname)) {
      setShowCreateQuiz(true);
      return;
    }
    const id = authorQuizId;
    if (!id || loading || (showCreateQuiz && createdQuiz?.id === id) || authorHydrationRef.current === location.pathname) return;
    const quiz = quizzes.find((item) => item.id === id);
    if (!quiz || quiz.can_manage === false) {
      setShowCreateQuiz(false);
      setCreatedQuiz(null);
      setCreatedQuestions([]);
      setAuthorPageError('Quiz not found, or you do not have permission to edit it.');
      return;
    }
    let cancelled = false;
    authorHydrationRef.current = location.pathname;
    void api.getQuizQuestions(id).then((loaded: CreatedQuizQuestion[]) => {
      if (cancelled) return;
      setCreatedQuiz(quiz);
      setCreatedQuestions(loaded);
      setIsEditMode(true);
      setShowCreateQuiz(true);
      setAuthorPageError(null);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setAuthorPageError(err instanceof Error ? err.message : 'Could not load quiz questions.');
      authorHydrationRef.current = null;
    });
    return () => {
      cancelled = true;
      if (authorHydrationRef.current === location.pathname) authorHydrationRef.current = null;
    };
  }, [isAuthorPage, role, location.pathname, loading, quizzes, showCreateQuiz, createdQuiz, authorQuizId]);

  // Browser refresh/close cannot preserve unsaved quiz-editor drafts.
  useEffect(() => {
    if (!isAuthorPage || !showCreateQuiz) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isAuthorPage, showCreateQuiz]);

  // Navigating away with the browser Back button should not leave the next
  // "Create quiz" action pointing at a previously edited quiz.
  useEffect(() => {
    if (role !== 'teacher' || location.pathname !== '/quizzes') return;
    setShowCreateQuiz(false);
    setCreatedQuiz(null);
    setCreatedQuestions([]);
    setEditingQuiz(null);
    setIsEditMode(false);
    setEditingQuestionId(null);
    authorHydrationRef.current = null;
  }, [location.pathname, role]);

  const toggleFavorite = async (quiz: Quiz) => {
    const isFavorited = favoritedQuizIds.has(quiz.id);
    try {
      if (isFavorited) {
        await api.removeFavorite('quiz', quiz.id);
        setFavoritedQuizIds((prev) => {
          const next = new Set(prev);
          next.delete(quiz.id);
          return next;
        });
      } else {
        await api.addFavorite('quiz', quiz.id);
        setFavoritedQuizIds((prev) => new Set(prev).add(quiz.id));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update favourite.', 'error');
    }
  };


  // The local copy is written synchronously on every change. The database
  // autosave is debounced; on reconnect or refresh the most recent revision wins.
  const saveLocalDraft = (answers: SavedAnswers, revision: number, index = draftQuestionRef.current) => {
    if (!draftKeyRef.current || !draftSessionRef.current) return;
    try {
      localStorage.setItem(draftKeyRef.current, JSON.stringify({
        sessionId: draftSessionRef.current, answers, revision, currentQuestion: index, updatedAt: Date.now(),
      } satisfies CachedQuizDraft));
    } catch { /* Server autosave remains available when browser storage is disabled/full. */ }
  };

  const flushDraft = (id: string, answers: SavedAnswers, revision: number, keepalive = false) => {
    if (!id || !revision) return;
    void api.saveQuizDraft(id, answers, revision, keepalive).then((response) => {
      if (draftSessionRef.current !== id) return;
      if (response.saved || response.revision === revision) {
        draftAckRef.current = Math.max(draftAckRef.current, response.revision);
        if (draftAckRef.current >= draftRevisionRef.current) setDraftStatus('saved');
      } else if (response.revision >= draftRevisionRef.current) {
        setDraftStatus('conflict'); // another tab/device saved a different answer at the same/newer revision
      }
    }).catch(() => {
      if (draftSessionRef.current === id) setDraftStatus('offline');
    });
  };

  const activateQuizSession = (quiz: Quiz, session: QuizSessionData) => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    const remoteRevision = Number(session.draft_revision ?? 0);
    const remoteAnswers = session.draft_answers || {};
    const cached = user ? readCachedQuizDraft(user.id, quiz.id, session.session_id) : null;
    // Only use the browser backup when it is newer than PostgreSQL.
    const restoreLocal = cached !== null && cached.revision > remoteRevision;
    const restoredAnswers = restoreLocal ? cached.answers : remoteAnswers;
    draftSessionRef.current = session.session_id;
    draftRevisionRef.current = Math.max(remoteRevision, cached?.revision ?? 0);
    draftAckRef.current = remoteRevision;
    draftAnswersRef.current = restoredAnswers;
    draftSnapshotRef.current = JSON.stringify(remoteAnswers);
    draftKeyRef.current = user ? cacheKey(user.id, quiz.id) : null;
    draftQuestionRef.current = cached ? Math.min(Math.max(0, cached.currentQuestion || 0), session.questions.length - 1) : 0;
    setDraftStatus(restoreLocal ? 'saving' : 'saved');
    setSessionId(session.session_id);
    setExpiresAt(session.expires_at);
    setClockOffset(Date.parse(session.server_now) - clientNow());
    setRemaining(null);
    setReviewRegionId(null);
    setShowSubmissionReview(false);
    setShowExitConfirm(false);
    setActiveQuiz(quiz);
    setQuestions(session.questions);
    setCurrentQuestion(draftQuestionRef.current);
    setSelectedAnswers(restoredAnswers);
    setSubmitResult(null);
    setSubmitError(null);
    setOpenEndedResults([]);
  };

  const handleStartQuiz = async (quiz: Quiz) => {
    try {
      setRouteError(null);
      const session: QuizSessionData = await api.startQuiz(quiz.id);
      activateQuizSession(quiz, session);
      navigate(`/quizzes/${quiz.id}/take`);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : 'Could not start quiz');
      setSubmitError(err instanceof Error ? err.message : 'Could not start quiz');
    }
  };

  const handleResumeQuiz = async (quiz: Quiz) => {
    try {
      setRouteError(null);
      const session: QuizSessionData = await api.resumeQuiz(quiz.id);
      activateQuizSession(quiz, session);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : 'Could not resume quiz');
    }
  };

  async function reviewAttempt(summary: QuizAttemptSummary) {
    try {
      const attempt = await api.getAttempt(summary.id);
      const answers: (AttemptAnswer & {option_a:string|null;option_b:string|null;option_c:string|null;option_d:string|null})[] = await api.getAttemptAnswers(summary.id);
      setQuestions(answers.map((a)=>({id:a.question_id,quiz_id:summary.quiz_id,question:a.question,format:a.format,option_a:a.option_a,option_b:a.option_b,option_c:a.option_c,option_d:a.option_d,
        student_config: a.region_review ? {model_id:a.region_review.model_id} : undefined})));
      setSelectedAnswers(Object.fromEntries(answers.filter(a => a.format==='region_identification' && a.answer_json).map(a => [a.question_id, JSON.stringify(a.answer_json)])));
      setReviewRegionId(null);
      setShowSubmissionReview(false);
      setCurrentQuestion(0);
      setActiveQuiz(quizzes.find((q)=>q.id===summary.quiz_id) || {id:summary.quiz_id,program_id:null,title:summary.quiz_title,description:null,type:'Mixed',category:null,is_published:false,created_at:''});
      const feedback = answers.filter((a)=>a.format==='mcq'||is3D(a.format)).map((a)=>({question_id:a.question_id,format:a.format,selected_option:a.selected_option||'',correct_option:a.correct_option||'',is_correct:a.is_correct===true,score:is3D(a.format)?a.teacher_score:null,
        details:a.region_review?.details||null,region_review:a.region_review||null}));
      setSubmitResult({status:attempt.status,score:attempt.score,total:attempt.total_questions,correct:attempt.correct_count,incorrect:attempt.status==='graded'?attempt.total_questions-attempt.correct_count:null,mcq_count:answers.filter(a=>a.format==='mcq').length,open_ended_count:answers.filter(a=>a.format==='open_ended').length,feedback});
      setOpenEndedResults(answers.filter((a)=>a.format==='open_ended'));
      setExpiresAt(null);setSessionId('');setSubmitError(null);setRouteError(null);
      navigate(`/quizzes/${summary.quiz_id}/review/${summary.id}`);
    } catch { setRouteError('Could not load this attempt.'); setSubmitError('Could not load this attempt.'); }
  }

  const handleSelectAnswer = (questionId: number, value: string) => {
    setSelectedAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      draftAnswersRef.current = next;
      saveLocalDraft(next, draftRevisionRef.current + 1);
      return next;
    });
    setSubmitError(null);
  };

  const handleNext = () => {
    setSubmitError(null);
    setCurrentQuestion((prev) => Math.min(prev + 1, questions.length - 1));
  };

  // Local backup is immediate; only PostgreSQL writes are debounced. This
  // includes JSON-encoded 3D region points and annotation matching answers.
  useEffect(() => {
    if (!sessionId || !activeQuiz || submitResult || submitting || draftSessionRef.current !== sessionId) return;
    const snapshot = JSON.stringify(selectedAnswers);
    if (snapshot === draftSnapshotRef.current) return;
    draftSnapshotRef.current = snapshot;
    draftAnswersRef.current = selectedAnswers;
    const revision = ++draftRevisionRef.current;
    saveLocalDraft(selectedAnswers, revision);
    setDraftStatus('saving');
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => flushDraft(sessionId, selectedAnswers, revision), 650);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [selectedAnswers, sessionId, activeQuiz, submitResult, submitting]);

  // Remember the last question even when switching between questions doesn't
  // change an answer; reopening the same tab returns to that question.
  useEffect(() => {
    draftQuestionRef.current = currentQuestion;
    if (sessionId && draftSessionRef.current === sessionId && !submitResult) {
      saveLocalDraft(draftAnswersRef.current, draftRevisionRef.current, currentQuestion);
    }
  }, [currentQuestion, sessionId, submitResult]);

  useEffect(() => {
    if (!sessionId || submitResult) return;
    const flushPending = () => {
      if (draftAckRef.current < draftRevisionRef.current)
        flushDraft(sessionId, draftAnswersRef.current, draftRevisionRef.current, true);
    };
    const retry = setInterval(flushPending, 15000);
    window.addEventListener('online', flushPending);
    window.addEventListener('pagehide', flushPending);
    return () => { clearInterval(retry); window.removeEventListener('online', flushPending); window.removeEventListener('pagehide', flushPending); };
  }, [sessionId, submitResult]);

  const isQuestionAnswered = (question: QuizQuestion) => {
    const response = selectedAnswers[question.id]?.trim() || '';
    if (!response) return false;
    if (question.format === 'mcq' || question.format === 'open_ended') return true;
    try {
      const answer = JSON.parse(response) as { points?: unknown[]; matches?: Record<string, string> };
      if (question.format === 'region_identification') return (answer.points?.length ?? 0) >= 3;
      const markerIds = question.student_config?.marker_ids || [];
      return markerIds.length > 0 && markerIds.every((id) => Boolean(answer.matches?.[String(id)]));
    } catch { return false; }
  };

  const handleSubmit = async (allowIncomplete = false) => {
    if (!activeQuiz) return;
    if (!allowIncomplete) {
      const firstMissing = questions.findIndex((question) => !isQuestionAnswered(question));
      if (firstMissing >= 0) {
        setCurrentQuestion(firstMissing);
        setSubmitError('Please answer every question before submitting. You can use the question navigator to return to unanswered questions.');
        return;
      }
    }

    const answers = questions.map((q) => {
      if (q.format === 'mcq') {
        return { question_id: q.id, selected_option: selectedAnswers[q.id] };
      }
      if (is3D(q.format)) {
        let answer_json:unknown = null;try{answer_json=JSON.parse(selectedAnswers[q.id]||'null');}catch{/* incomplete selection */}
        return {question_id:q.id,answer_json};
      }
      return { question_id: q.id, answer_text: selectedAnswers[q.id] };
    });

    try {
      setSubmitting(true);
      setSubmitError(null);
      const result = await api.submitQuiz(activeQuiz.id, answers, sessionId);
      setSubmitResult(result);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (draftKeyRef.current) localStorage.removeItem(draftKeyRef.current);
      draftSessionRef.current = '';
      draftKeyRef.current = null;
      setDraftStatus('saved');
      setShowSubmissionReview(false);
      setReviewRegionId(null);
      sessionStorage.setItem(`quiz-attempt-${activeQuiz.id}`, String(result.attempt.id));
      // A stable review URL means refresh shows the completed attempt, not a new quiz.
      navigate(`/quizzes/${activeQuiz.id}/review/${result.attempt.id}`, { replace: true });

      // Task 8.8: refresh real history right away so the new attempt shows
      // up without needing a full page reload.
      history.reload();
      stats.reload();

      const openEnded = questions
        .filter((q) => q.format === 'open_ended')
        .map((q) => ({
          question_id: q.id,
          question: q.question,
          answer_text: selectedAnswers[q.id] || '',
          teacher_score: null,
        }));
      setOpenEndedResults(openEnded);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => { submitRef.current = () => { if (!submitting && !submitResult) void handleSubmit(true); }; });
  useEffect(() => {
    if (!expiresAt || !activeQuiz || submitResult) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt)-(Date.now()+clockOffset))/1000));
      setRemaining(seconds);
      if (seconds === 0) { clearInterval(timer); submitRef.current(); }
    };
    const timer = setInterval(tick,1000);
    return () => clearInterval(timer);
  }, [expiresAt, activeQuiz, submitResult, clockOffset]);


  const handleRetry = async () => {
    if (!activeQuiz) return;
    const session: QuizSessionData = await api.startQuiz(activeQuiz.id);
    if (draftKeyRef.current) localStorage.removeItem(draftKeyRef.current);
    activateQuizSession(activeQuiz, session);
    sessionStorage.removeItem(`quiz-attempt-${activeQuiz.id}`);
    navigate(`/quizzes/${activeQuiz.id}/take`, { replace: true });
  };

  const handleBackToList = () => {
    // Keep the old route marked as handled until /quizzes has rendered.
    // Otherwise clearing activeQuiz can trigger route hydration again while
    // React Router is still transitioning away from /review/:attemptId.
    routeHydration.current = location.pathname;
    if (sessionId && !submitResult) void api.cancelQuizSession(sessionId).catch(() => {});
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (draftKeyRef.current) localStorage.removeItem(draftKeyRef.current);
    draftSessionRef.current = '';
    draftKeyRef.current = null;
    setExpiresAt(null);
    setSessionId('');
    setRemaining(null);
    setRouteError(null);
    setActiveQuiz(null);
    setShowSubmissionReview(false);
    setShowExitConfirm(false);
    setReviewRegionId(null);
    setQuestions([]);
    setSubmitResult(null);
    setSubmitError(null);
    setOpenEndedResults([]);
    navigate('/quizzes');
  };

  // Opening a bookmark or refreshing a quiz URL starts its page rather than
  // dropping the student back at the quiz listing. Route transitions keep
  // this component mounted, retaining answers across question navigation.
  useEffect(() => {
    const match = /^\/quizzes\/(\d+)\/(take|review)(?:\/(\d+))?\/?$/.exec(location.pathname);
    if (!match || activeQuiz || role !== 'student' || routeHydration.current === location.pathname) return;
    const quizId = Number(match[1]);
    if (match[2] === 'take') {
      if (loading) return;
      routeHydration.current = location.pathname;
      const quiz = quizzes.find((entry) => entry.id === quizId);
      if (quiz) void handleResumeQuiz(quiz);
      else setRouteError('This quiz is unavailable. Return to the quiz list and try again.');
    } else {
      if (history.loading) return;
      routeHydration.current = location.pathname;
      const attemptId = Number(match[3]);
      const summary = attemptHistory.find((entry) => entry.id === attemptId && entry.quiz_id === quizId);
      if (summary) void reviewAttempt(summary);
      else setRouteError('This attempt was not found in your history.');
    }
  }, [location.pathname, role, activeQuiz, loading, quizzes, history.loading, attemptHistory]);

  // Browser Back within /quizzes/* must clear the in-memory attempt as well.
  useEffect(() => {
    if (location.pathname !== '/quizzes') return;
    // Once the list route is active, a future deep link can hydrate normally.
    routeHydration.current = null;
    if (!activeQuiz) return;
    // Browser Back is not an explicit discard: the server session stays resumable.
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (sessionId && !submitResult && draftAckRef.current < draftRevisionRef.current)
      flushDraft(sessionId, draftAnswersRef.current, draftRevisionRef.current, true);
    draftSessionRef.current = '';
    draftKeyRef.current = null;
    routeHydration.current = null;
    setActiveQuiz(null);
    setSessionId('');
    setExpiresAt(null);
    setRemaining(null);
    setQuestions([]);
    setSubmitResult(null);
    setReviewRegionId(null);
  }, [location.pathname, activeQuiz, sessionId, submitResult]);

  // No quiz or question data is persisted until Finish editing. This lets
  // professors genuinely discard a new quiz or edits to an existing one.
  const handleCreateQuiz = () => {
    if (!newQuizTitle.trim()) {
      setCreateQuizError('Title is required.');
      return;
    }
    setCreatedQuiz({ id: -1, title: newQuizTitle.trim(), description: newQuizDescription || null,
      category: newQuizCategory || null, type: 'MCQ', program_id: null,
      is_published: false, created_at: '' });
    setCreatedQuestions([]);
    setIsEditMode(false);
    setBankOnSaveIds([]);
    setCreateQuizError(null);
  };

  const clearQuizEditor = () => {
    setShowCreateQuiz(false);
    setCreatedQuiz(null);
    setCreatedQuestions([]);
    setBankOnSaveIds([]);
    setNewQuizTitle('');
    setNewQuizDescription('');
    setNewQuizCategory('');
    setNewQuestionText('');
    setNewOptionA('');
    setNewOptionB('');
    setNewOptionC('');
    setNewOptionD('');
    setNewCorrectOption('A');
    setEditingQuestionId(null);
    setCreateQuizError(null);
    setNewModelAnswer('');
    setNewQuestionFormat('mcq');
    setNew3DConfig(null);
    setEditingQuiz(null);
    setIsEditMode(false);
    authorHydrationRef.current = null;
  };

  const handleCancelCreateQuiz = () => {
    if (savingEditor) return;
    if (!window.confirm('Exit without saving? All changes made in this editor session will be discarded.')) return;
    clearQuizEditor();
    navigate('/quizzes');
  };

  const hasUnsavedQuestionForm = () => editingQuestionId !== null ||
    !!newQuestionText.trim() || !!newOptionA.trim() || !!newOptionB.trim() ||
    !!newOptionC.trim() || !!newOptionD.trim() || !!newModelAnswer.trim() || !!new3DConfig;

  const handleFinishCreateQuiz = async () => {
    if (!createdQuiz || savingEditor) return;
    if (editingQuiz && (editQuizTitle !== createdQuiz.title ||
      editQuizDescription !== (createdQuiz.description || '') ||
      editQuizCategory !== (createdQuiz.category || ''))) {
      setCreateQuizError('There are unfinished quiz detail changes. Click Save details or Cancel before finishing.');
      return;
    }
    if (hasUnsavedQuestionForm()) {
      setCreateQuizError('There is an unfinished question in the editor. Click Add Question / Save Changes, or clear it before finishing.');
      document.getElementById('quiz-builder-question-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!createdQuestions.length) {
      setCreateQuizError('Add at least one question before finishing.');
      return;
    }
    try {
      setSavingEditor(true);
      setCreateQuizError(null);
      const saved: { quiz: Quiz; questions: CreatedQuizQuestion[] } = await api.commitQuizEditor(
        isEditMode ? createdQuiz.id : null, {
          title: createdQuiz.title,
          description: createdQuiz.description || undefined,
          category: createdQuiz.category || undefined,
          questions: createdQuestions.map(q => ({
            ...(q.id > 0 ? {id:q.id} : {}),
            question:q.question,format:q.format,category:q.category || null,
            option_a:q.option_a, option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,
            correct_option:q.correct_option,model_answer:q.model_answer,question_config:q.question_config || null,
          })),
        }
      );
      const toBank = createdQuestions.flatMap((q, index) => bankOnSaveIds.includes(q.id) ? [index] : []);
      let bankFailure = false;
      for (const index of toBank) {
        try { await api.bankQuestion(saved.questions[index].id, saved.quiz.category || ''); }
        catch { bankFailure = true; }
      }
      clearQuizEditor();
      navigate('/quizzes');
      await loadQuizzes();
      toast(bankFailure ? 'Quiz saved, but some question-bank copies could not be saved.' : 'Quiz saved successfully.', bankFailure ? 'error' : 'success');
    } catch (err) {
      setCreateQuizError(err instanceof Error ? err.message : 'Could not save the quiz. No changes were committed.');
    } finally {
      setSavingEditor(false);
    }
  };

  const handleDeleteCreatedQuestion = (id: number) => {
    setCreatedQuestions((prev) => prev.filter((q) => q.id !== id));
    setBankOnSaveIds(prev => prev.filter(item => item !== id));
    if (editingQuestionId === id) {
      setEditingQuestionId(null);
      setNewQuestionText('');
      setNewOptionA(''); setNewOptionB(''); setNewOptionC(''); setNewOptionD('');
      setNewCorrectOption('A'); setNewModelAnswer(''); setNewQuestionFormat('mcq'); setNew3DConfig(null);
    }
  };

  const stageBankQuestion = (q: {question:string;format:'mcq'|'open_ended';category:string|null;option_a:string|null;option_b:string|null;option_c:string|null;option_d:string|null;correct_option:string|null;model_answer:string|null}) => {
    const id = draftQuestionId.current--;
    setCreatedQuestions(prev => [...prev, {id,quiz_id:createdQuiz?.id ?? -1,question:q.question,format:q.format,
      option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,
      category:q.category,
      correct_option:q.correct_option as CreatedQuizQuestion['correct_option'],model_answer:q.model_answer,
      question_config:null}]);
    setCreateQuizError(null);
  };

  const handleDeleteQuiz = async (quiz: Quiz) => {
    if (deletingQuizId !== null) return;
    if (!window.confirm(`Permanently delete “${quiz.title}”? This action cannot be undone. Quizzes with student attempts cannot be deleted.`)) return;
    try {
      setDeletingQuizId(quiz.id);
      await api.deleteQuiz(quiz.id);
      setQuizzes(prev => prev.filter(q => q.id !== quiz.id));
      if (createdQuiz?.id === quiz.id) { clearQuizEditor(); navigate('/quizzes'); }
      toast('Quiz deleted.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete the quiz.', 'error');
    } finally {
      setDeletingQuizId(null);
    }
  };

  const handleEditCreatedQuestion = (q: CreatedQuizQuestion) => {
    setEditingQuestionId(q.id);
    setNewQuestionText(q.question);
    setNewQuestionFormat(q.format);
    setNew3DConfig(q.question_config||null);

    if (q.format === 'mcq') {
      setNewOptionA(q.option_a || '');
      setNewOptionB(q.option_b || '');
      setNewOptionC(q.option_c || '');
      setNewOptionD(q.option_d || '');
      setNewCorrectOption(q.correct_option || 'A');
      setNewModelAnswer('');
    } else if (q.format === 'open_ended') {
      setNewModelAnswer(q.model_answer || '');
      setNewOptionA('');
      setNewOptionB('');
      setNewOptionC('');
      setNewOptionD('');
      setNewCorrectOption('A');
    }
  };

  const handleSaveQuestion = async () => {
    if (!createdQuiz) return;

    if (!newQuestionText.trim()) {
      setCreateQuizError('Question text is required.');
      return;
    }

    if (newQuestionFormat === 'mcq') {
      if (!newOptionA.trim() || !newOptionB.trim() || !newOptionC.trim() || !newOptionD.trim()) {
        setCreateQuizError('All 4 options are required for MCQ questions.');
        return;
      }
    } else if (newQuestionFormat === 'open_ended') {
      if (!newModelAnswer.trim()) {
        setCreateQuizError('A model answer is required for open-ended questions.');return;
      }
    } else {
      const custom = new3DConfig?.source === 'custom';
      const hasRegion = custom ? !!new3DConfig?.custom_region?.projectedMask &&
        (new3DConfig.custom_region.points.length >= 3) : !!new3DConfig?.reference_annotation_id;
      const customMarkers = new3DConfig?.custom_markers || [];
      const names = customMarkers.map(m => (m.label || '').trim().toLowerCase());
      const targetCount = new3DConfig?.target_count;
      const hasMatching = custom ? customMarkers.length >= 2 && customMarkers.length <= 12 &&
        (targetCount === undefined || customMarkers.length === targetCount) &&
        (targetCount === undefined || customMarkers.every(m => !!m.region?.projectedMask)) &&
        names.every(Boolean) && new Set(names).size === names.length :
        (new3DConfig?.annotation_ids?.length || 0) >= 2;
      if (!new3DConfig?.model_id || (newQuestionFormat==='region_identification' && !hasRegion) ||
        (newQuestionFormat==='annotation_matching' && !hasMatching)) {
        setCreateQuizError(custom
          ? 'Draw and name every structure in the matching question (2–12), or draw the reference region.'
          : 'Select a model and the required reference annotation(s).');return;
      }
    }

    const payload = newQuestionFormat === 'mcq' ? {
        question:newQuestionText,format:'mcq' as const,
        option_a:newOptionA,option_b:newOptionB,option_c:newOptionC,option_d:newOptionD,correct_option:newCorrectOption,
      } : newQuestionFormat === 'open_ended' ? {
        question:newQuestionText,format:'open_ended' as const,model_answer:newModelAnswer,
      } : {
        question:newQuestionText,format:newQuestionFormat,question_config:new3DConfig!,
      };

    setCreateQuizError(null);
    const draft: CreatedQuizQuestion = {
      id: editingQuestionId ?? draftQuestionId.current--,
      quiz_id: createdQuiz.id,
      question: payload.question,
      format: payload.format,
      category: editingQuestionId !== null ? createdQuestions.find(q => q.id === editingQuestionId)?.category || null : null,
      option_a: 'option_a' in payload ? payload.option_a : null,
      option_b: 'option_b' in payload ? payload.option_b : null,
      option_c: 'option_c' in payload ? payload.option_c : null,
      option_d: 'option_d' in payload ? payload.option_d : null,
      correct_option: 'correct_option' in payload ? payload.correct_option : null,
      model_answer: 'model_answer' in payload ? payload.model_answer : null,
      question_config: 'question_config' in payload ? payload.question_config : null,
    };
    setCreatedQuestions(prev => editingQuestionId !== null
      ? prev.map(q => q.id === editingQuestionId ? draft : q)
      : [...prev, draft]);
    setEditingQuestionId(null);
    setNewQuestionText('');
    setNewOptionA(''); setNewOptionB(''); setNewOptionC(''); setNewOptionD('');
    setNewCorrectOption('A'); setNewModelAnswer(''); setNewQuestionFormat('mcq'); setNew3DConfig(null);
  };

  const handleToggleQuizPublish = async (quiz: Quiz) => {
    try {
      const updated = await api.publishQuiz(quiz.id, !quiz.is_published);
      setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    } catch (err) {
      console.error('Failed to update quiz publish state:', err);
      toast(err instanceof Error ? err.message : 'Could not change quiz publication.', 'error');
    }
  };

  const handleOpenResults = async (quiz: Quiz) => {
    setShowResultsQuiz(quiz);
    setSelectedAttemptId(null);
    setAttemptAnswers([]);
    setGradingError(null);
    setPendingAttempts([]);
    setLoadingPending(true);
    try {
      const attempts = await api.getAllAttempts(quiz.id);
      setPendingAttempts(attempts);
    } catch (err) {
      console.error('Failed to load pending attempts:', err);
      setGradingError(err instanceof Error ? err.message : 'Failed to load pending attempts.');
    } finally {
      setLoadingPending(false);
    }
  };

  const handleCloseResults = () => {
    setShowResultsQuiz(null);
    setPendingAttempts([]);
    setSelectedAttemptId(null);
    setAttemptAnswers([]);
    setGradeInputs({});
    setGradingError(null);
  };

  const openEditQuizQuestions = async (quiz: Quiz, showDetails = false) => {
    try {
      setAuthorPageError(null);
      const fetched: CreatedQuizQuestion[] = await api.getQuizQuestions(quiz.id);
      setCreatedQuiz(quiz);
      setCreatedQuestions(fetched);
      setIsEditMode(true);
      setShowCreateQuiz(true);
      setBankOnSaveIds([]);
      setCreateQuizError(null);
      setEditingQuestionId(null);
      setNewQuestionText('');
      setNewQuestionFormat('mcq');
      setNewOptionA(''); setNewOptionB(''); setNewOptionC(''); setNewOptionD('');
      setNewModelAnswer(''); setNewCorrectOption('A');
      setNew3DConfig(null);
      setEditingQuiz(showDetails ? quiz : null);
      setEditQuizTitle(quiz.title);
      setEditQuizDescription(quiz.description || '');
      setEditQuizCategory(quiz.category || '');
      setEditQuizError(null);
      navigate(`/quizzes/${quiz.id}/edit`);
    } catch (err) {
      setAuthorPageError(err instanceof Error ? err.message : 'Failed to load questions for this quiz.');
      toast(err instanceof Error ? err.message : 'Failed to load quiz editor.', 'error');
    }
  };

  const openEditQuiz = (quiz: Quiz) => {
    void openEditQuizQuestions(quiz, true);
  };

  const startEditingQuizDetails = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setEditQuizTitle(quiz.title);
    setEditQuizDescription(quiz.description || '');
    setEditQuizCategory(quiz.category || '');
    setEditQuizError(null);
  };

  const closeEditQuiz = () => {
    setEditingQuiz(null);
    setEditQuizTitle('');
    setEditQuizDescription('');
    setEditQuizCategory('');
    setEditQuizError(null);
  };

  const handleSaveQuizEdit = () => {
    if (!editingQuiz) return;
    if (!editQuizTitle.trim()) { setEditQuizError('Title is required.'); return; }
    setCreatedQuiz(prev => prev ? { ...prev, title:editQuizTitle.trim(),
      description:editQuizDescription || null, category:editQuizCategory || null } : prev);
    closeEditQuiz();
  };

  const handleSelectAttempt = async (attemptId: number) => {
    setSelectedAttemptId(attemptId);
    setGradingError(null);
    try {
      const answers = await api.getAttemptAnswers(attemptId);
      setAttemptAnswers(answers);
      const initialInputs: Record<number, string> = {};
      answers.forEach((a: AttemptAnswer) => {
        if (a.format === 'open_ended') {
          initialInputs[a.id] = a.teacher_score !== null ? String(a.teacher_score) : '';
        }
      });
      setGradeInputs(initialInputs);
    } catch (err) {
      console.error('Failed to load attempt answers:', err);
      setGradingError(err instanceof Error ? err.message : 'Failed to load this attempt\'s answers.');
    }
  };

  const handleGradeAnswer = async (answerId: number) => {
    const raw = gradeInputs[answerId];
    const score = Number(raw);

    if (raw === undefined || raw === '' || Number.isNaN(score) || score < 0 || score > 100) {
      setGradingError('Enter a score between 0 and 100.');
      return;
    }

    try {
      setGradingError(null);
      setGradingAnswerId(answerId);
      const updated = await api.gradeAttemptAnswer(answerId, score);
      setAttemptAnswers((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));

      const stillPending = attemptAnswers.some(
        (a) => a.format === 'open_ended' && a.id !== answerId && a.teacher_score === null
      );

      if (!stillPending && showResultsQuiz) {
        const attempts = await api.getAllAttempts(showResultsQuiz.id);
        setPendingAttempts(attempts);
        setSelectedAttemptId(null);
        setAttemptAnswers([]);
      }
    } catch (err) {
      console.error('Failed to grade answer:', err);
      setGradingError(err instanceof Error ? err.message : 'Failed to save grade. Please try again.');
    } finally {
      setGradingAnswerId(null);
    }
  };

  const current = questions[currentQuestion];
  const answeredCount = questions.filter(isQuestionAnswered).length;
  const feedbackByQuestionId = new Map(
    (submitResult?.feedback ?? []).map((f) => [f.question_id, f])
  );
  const derivedTypePreview = deriveQuizType(createdQuestions);

  const filteredQuizzes = quizzes.filter((quiz) => {
    const term = quizSearchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      quiz.title.toLowerCase().includes(term) ||
      (quiz.category || '').toLowerCase().includes(term) ||
      (quiz.description || '').toLowerCase().includes(term)
    );
  });

  const quizPages = Math.max(1, Math.ceil(filteredQuizzes.length / QUIZ_PAGE_SIZE));
  const currentQuizPage = Math.min(quizPage, quizPages);
  const pagedQuizzes = filteredQuizzes.length > QUIZ_PAGE_SIZE
    ? filteredQuizzes.slice((currentQuizPage - 1) * QUIZ_PAGE_SIZE, currentQuizPage * QUIZ_PAGE_SIZE)
    : filteredQuizzes;

  const availableQuizzes = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const historyQuizOptions = [...new Map(attemptHistory.map((attempt) => [attempt.quiz_id, attempt.quiz_title])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const historyTerm = historySearch.trim().toLowerCase();
  const visibleHistory = attemptHistory
    .filter((attempt) => (historyQuizId === 'all' || String(attempt.quiz_id) === historyQuizId)
      && (historyStatus === 'all' || attempt.status === historyStatus)
      && (!historyTerm || attempt.quiz_title.toLowerCase().includes(historyTerm)))
    .sort((a, b) => historySort === 'highest' ? (b.score ?? -1) - (a.score ?? -1) || Date.parse(b.attempted_at) - Date.parse(a.attempted_at)
      : historySort === 'oldest' ? Date.parse(a.attempted_at) - Date.parse(b.attempted_at)
      : Date.parse(b.attempted_at) - Date.parse(a.attempted_at));
  const historyPages = Math.max(1, Math.ceil(visibleHistory.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyPages);
  const pagedHistory = visibleHistory.slice((currentHistoryPage - 1) * HISTORY_PAGE_SIZE, currentHistoryPage * HISTORY_PAGE_SIZE);
  const filtersActive = historyQuizId !== 'all' || historyStatus !== 'all' || historyTerm !== '';
  const focusItems = (stats.data?.categories ?? []).map((item) => ({ label: item.category, value: item.accuracy, detail: `${item.answered} answered` }));
  const filterControl = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

  return (
    <div className={`${isDedicatedPage ? "max-w-[1880px]" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`}>
      {!isDedicatedPage && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Self-Assessment
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Test your knowledge with MCQ and practical quizzes.
          </p>
        </div>

        {role === 'teacher' && (
          <button
            onClick={() => {
              setCreatedQuiz(null);
              setCreatedQuestions([]);
              setBankOnSaveIds([]);
              setNewQuizTitle('');
              setNewQuizDescription('');
              setNewQuizCategory('');
              setNewQuestionText('');
              setNewOptionA(''); setNewOptionB(''); setNewOptionC(''); setNewOptionD('');
              setNewModelAnswer(''); setNew3DConfig(null); setNewQuestionFormat('mcq');
              setEditingQuiz(null);
              setShowCreateQuiz(true);
              setIsEditMode(false);
              setAuthorPageError(null);
              setCreateQuizError(null);
              navigate('/quizzes/create');
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            + Create Quiz
          </button>
        )}
      </div>

      {role === 'student' && <RequestState loading={false} error={favorites.error} onRetry={favorites.reload} label="quiz favourites" />}
      <RequestState loading={loading} error={loadError} onRetry={loadQuizzes} label="quizzes" />
      {submitError && !activeQuiz && <p role="alert" className="mt-4 text-red-600">{submitError}</p>}
      <div className="mt-4 relative">
        <Search className="w-4 h-4 text-slate-600 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={quizSearchTerm}
          onChange={(e) => { setQuizSearchTerm(e.target.value); setQuizPage(1); }}
          aria-label="Search quizzes"
          placeholder="Search quizzes by title, category, or description..."
          className="bg-white dark:bg-slate-900 w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-300"
        />
      </div>

      <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {!loading && !loadError && filteredQuizzes.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-600 dark:text-slate-400 text-center">
            {quizSearchTerm ? 'No quizzes match your search.' : 'No quizzes available yet.'}
          </p>
        )}
        {pagedQuizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <BookOpen className="w-5 h-5 flex-shrink-0 text-blue-400 dark:text-blue-300" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{quiz.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {quiz.description || 'No description provided.'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${quizTypeBadgeClasses[quiz.type]}`}>
                {quiz.type}
              </span>

              {role === 'student' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(quiz)}
                    disabled={favorites.loading || Boolean(favorites.error)}
                      title={favoritedQuizIds.has(quiz.id) ? 'Remove from favourites' : 'Save to favourites'}
                    className="p-1"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        favoritedQuizIds.has(quiz.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => handleStartQuiz(quiz)}
                    className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    Start Quiz
                  </button>
                </div>
              )}

              <ContentSettings kind="quizzes" id={quiz.id} programId={quiz.program_id} timer={quiz.time_limit_seconds} canManage={quiz.can_manage} onSaved={() => api.getQuizzes().then(setQuizzes)} />
              <OwnerNote kind="quizzes" item={quiz} onChanged={() => api.getQuizzes().then(setQuizzes)} />
              {role === 'teacher' && quiz.can_manage !== false && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEditQuiz(quiz)}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={() => openEditQuizQuestions(quiz)}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Edit Questions
                  </button>
                  <button
                    onClick={() => handleToggleQuizPublish(quiz)}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {quiz.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleOpenResults(quiz)}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    View Results
                  </button>
                  <button
                    type="button"
                    disabled={deletingQuizId === quiz.id}
                    onClick={() => { void handleDeleteQuiz(quiz); }}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 disabled:opacity-50 transition-colors"
                  >
                    Delete Quiz
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

      </div>
      <Pagination page={currentQuizPage} pageSize={QUIZ_PAGE_SIZE} total={filteredQuizzes.length} onPageChange={setQuizPage} label="Quiz list pages" />

      {role === 'student' && (
        <section aria-labelledby="quiz-focus-heading" className="mt-8">
          <h2 id="quiz-focus-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-1">
            Where to focus
          </h2>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Topics where your answers are least accurate come first.</p>
          <RequestState loading={stats.loading} error={stats.error} onRetry={stats.reload} label="your learning statistics" />
          {!stats.loading && !stats.error && stats.data && (
            focusItems.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 py-8 text-center text-sm text-slate-600 dark:text-slate-400">
                Complete a graded quiz to see which topics need more practice.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <BarList items={focusItems.slice(0, 8)} ariaLabel="Accuracy by topic" />
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Your quizzes</h3>
                  <ul className="space-y-3">
                    {stats.data.quizzes.slice(0, 6).map((quiz) => (
                      <li key={quiz.quiz_id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{quiz.title}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Best {quiz.best_score != null ? `${quiz.best_score}%` : '—'} · Latest {quiz.latest_score != null ? `${quiz.latest_score}%` : '—'} · {quiz.attempts} attempt{quiz.attempts === 1 ? '' : 's'}
                          </p>
                        </div>
                        <Sparkline values={quiz.recent_scores} label={`${quiz.title} score trend`} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          )}
        </section>
      )}

      {role === 'student' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-3">
            My Quiz History
          </h2>
          {attemptHistory.length > 0 && (
            <div role="search" aria-label="Filter quiz history" className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="search" value={historySearch} onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                aria-label="Search history by quiz title" placeholder="Search by quiz title…" className={`${filterControl} placeholder:text-slate-500 dark:placeholder:text-slate-400`} />
              <select aria-label="Filter by quiz" value={historyQuizId} onChange={(e) => { setHistoryQuizId(e.target.value); setHistoryPage(1); }} className={filterControl}>
                <option value="all">All quizzes</option>
                {historyQuizOptions.map(([id, title]) => <option key={id} value={String(id)}>{title}</option>)}
              </select>
              <select aria-label="Filter by status" value={historyStatus} onChange={(e) => { setHistoryStatus(e.target.value as typeof historyStatus); setHistoryPage(1); }} className={filterControl}>
                <option value="all">Any status</option>
                <option value="graded">Graded</option>
                <option value="pending_review">Pending review</option>
              </select>
              <select aria-label="Sort attempts" value={historySort} onChange={(e) => { setHistorySort(e.target.value as HistorySort); setHistoryPage(1); }} className={filterControl}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest">Highest score</option>
              </select>
            </div>
          )}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <RequestState loading={history.loading} error={history.error} onRetry={history.reload} label="quiz history" />
            {!history.loading && !history.error && attemptHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
                No quiz attempts yet.
              </div>
            ) : !history.loading && !history.error && visibleHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
                No attempts match these filters.{filtersActive && <> <button type="button" onClick={() => { setHistoryQuizId('all'); setHistoryStatus('all'); setHistorySearch(''); setHistoryPage(1); }} className="text-blue-700 dark:text-blue-400 underline">Clear filters</button></>}
              </div>
            ) : (
              pagedHistory.map((attempt) => (
                <div
                  key={attempt.id}
                  className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{attempt.quiz_title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {new Date(attempt.attempted_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => { void reviewAttempt(attempt); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Review answers</button>
                    {availableQuizzes.has(attempt.quiz_id) && (
                      <button type="button" onClick={() => { void handleStartQuiz(availableQuizzes.get(attempt.quiz_id)!); }}
                        aria-label={`Retake ${attempt.quiz_title}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />Retake
                      </button>
                    )}
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
              ))
            )}
          </div>
          <Pagination page={currentHistoryPage} pageSize={HISTORY_PAGE_SIZE} total={visibleHistory.length} onPageChange={setHistoryPage} label="Quiz history pages" />
        </div>
      )}

      </>}

      {isQuizPage && (
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">AnatoLearn · Quiz attempt</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">{activeQuiz?.title || 'Quiz'}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {activeQuiz && !submitResult && (
              <>
                {sessionId && (
                  <span role="status" aria-live="polite" className={`text-xs font-medium ${draftStatus === 'offline' || draftStatus === 'conflict' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {draftStatus === 'saved' ? 'Answers saved' : draftStatus === 'saving' ? 'Saving…' :
                      draftStatus === 'conflict' ? 'Draft changed in another tab — refresh to review' : 'Unable to sync — saved in this browser'}
                  </span>
                )}
                {remaining !== null && (
                  <span className={`flex items-center gap-2 text-sm font-semibold ${remaining <= 60 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`} role="timer">
                    <Clock className="h-4 w-4" /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} remaining
                  </span>
                )}
                <button type="button" onClick={() => setShowExitConfirm(true)} aria-label="Exit quiz attempt" title="Exit attempt"
                  className="rounded-lg p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <X className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </header>
      )}
      {isQuizPage && !activeQuiz && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-8" role="status">
          {routeError || submitError || (role !== 'student' ? 'Only students can take quizzes.' : 'Loading quiz…')}
          {(routeError || submitError) && <div className="mt-5"><button type="button" onClick={() => navigate('/quizzes')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Return to quiz list</button></div>}
        </div>
      )}

      {isQuizPage && activeQuiz && !submitResult && current && (
        <section aria-label="Quiz questions" className="grid grid-cols-1 lg:grid-cols-[140px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)] gap-5 lg:gap-8 items-start">
          <aside className="lg:sticky lg:top-6 min-w-0" aria-label="Question navigation">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Question pages</h2>
            <div className="flex lg:flex-col flex-wrap lg:flex-nowrap gap-2 lg:max-h-[75vh] lg:overflow-y-auto pr-1">
              {questions.map((question, index) => {
                const answered = isQuestionAnswered(question);
                const selected = !showSubmissionReview && index === currentQuestion;
                return (
                  <button type="button" key={question.id}
                    onClick={() => { setCurrentQuestion(index); setShowSubmissionReview(false); setSubmitError(null); }}
                    aria-current={selected ? 'step' : undefined}
                    aria-label={`Question ${index + 1}, ${answered ? 'answered' : 'unanswered'}`}
                    className={`flex min-w-[68px] lg:w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${selected
                      ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-600'}`}>
                    <span className="font-semibold">{index + 1}</span>
                    {answered ? <Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" /> : <span className="font-semibold text-slate-400 dark:text-slate-500" aria-hidden="true">--</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">✓ Answered · -- Unanswered</p>
            <button type="button" onClick={() => { setShowSubmissionReview(true); setSubmitError(null); }}
              className="mt-4 text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline">Submission review</button>
          </aside>

          <div className={is3D(current.format) && current.student_config && !showSubmissionReview ? "min-w-0 w-full" : "min-w-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full p-4 sm:p-5"}>
            {showSubmissionReview ? (
              <div className="max-w-3xl py-2" aria-label="Quiz submission confirmation">
                {answeredCount < questions.length && (
                  <div className="mb-6" role="alert">
                    <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Warnings</h2>
                    <p className="text-sm text-red-700 dark:text-red-300">You have {questions.length - answeredCount} unanswered question{questions.length - answeredCount === 1 ? '' : 's'}.</p>
                    <ul className="mt-3 space-y-2 list-disc list-inside">
                      {questions.map((question, index) => !isQuestionAnswered(question) ? (
                        <li key={question.id}>
                          <button type="button" onClick={() => { setCurrentQuestion(index); setShowSubmissionReview(false); }}
                            className="text-sm text-blue-700 dark:text-blue-400 hover:underline">Question {index + 1}</button>
                        </li>
                      ) : null)}
                    </ul>
                  </div>
                )}
                <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">Quiz Submission Confirmation</h2>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">You are about to submit your quiz.</p>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">Once submitted, you cannot return to edit this attempt.</p>
                <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">{answeredCount} of {questions.length} questions answered.</p>
                {submitError && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{submitError}</p>}
                <div className="mt-7 border-t border-slate-200 dark:border-slate-700 pt-5 flex flex-wrap gap-3">
                  <button type="button" disabled={submitting} onClick={() => { void handleSubmit(true); }}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {submitting ? 'Submitting…' : 'Submit Quiz'}
                  </button>
                  <button type="button" onClick={() => setShowSubmissionReview(false)} disabled={submitting}
                    className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">Back to Questions</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setCurrentQuestion((prev) => Math.max(0, prev - 1)); setSubmitError(null); }}
                      disabled={currentQuestion === 0}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 px-4 py-2 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </button>
                    <button type="button" onClick={currentQuestion === questions.length - 1 ? () => setShowSubmissionReview(true) : handleNext}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700">
                      {currentQuestion === questions.length - 1 ? 'Review' : 'Next'} <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Page {currentQuestion + 1} of {questions.length}</p>
                </div>
                {!is3D(current.format) && <div className="mb-6">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Question {currentQuestion + 1}</p>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 font-display">{current.question}</h2>
                </div>}
                {current.format === 'mcq' ? (
                  <div role="radiogroup" aria-label={current.question} className="space-y-2.5 mb-8 max-w-4xl">
                    {optionLetters.map((letter) => {
                      const optionText = current[`option_${letter.toLowerCase()}` as keyof QuizQuestion] as string;
                      return (
                        <label key={letter} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${selectedAnswers[current.id] === letter
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                          <input type="radio" name={`question-${current.id}`} checked={selectedAnswers[current.id] === letter}
                            onChange={() => handleSelectAnswer(current.id, letter)} className="accent-blue-600" />
                          <span className="text-sm text-slate-800 dark:text-slate-200">{optionText}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : is3D(current.format) && current.student_config ? (
                  <div className="mb-6 min-w-0">
                    <ThreeDQuestion key={current.id} format={current.format} config={current.student_config}
                      value={selectedAnswers[current.id] || ''} onChange={v => handleSelectAnswer(current.id, v)}
                      workspace questionLabel={`Question ${currentQuestion + 1}`} questionText={current.question}
                      viewerClassName="h-[72vh] min-h-[540px] max-h-[920px] w-full" />
                  </div>
                ) : (
                  <div className="mb-8">
                    <textarea value={selectedAnswers[current.id] || ''} onChange={(e) => handleSelectAnswer(current.id, e.target.value)} rows={7}
                      className="text-slate-900 dark:text-slate-100 w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                      aria-label="Your answer" placeholder="Type your answer here..." />
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">This answer will be reviewed by your teacher.</p>
                  </div>
                )}
                {submitError && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-4">{submitError}</p>}

                <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button type="button" onClick={() => { setShowSubmissionReview(true); setSubmitError(null); }}
                    className="rounded-lg bg-slate-100 dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">Submit Quiz</button>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{answeredCount} of {questions.length} questions answered</span>
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {isQuizPage && showExitConfirm && activeQuiz && !submitResult && (
        <Dialog onClose={() => setShowExitConfirm(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Exit this quiz?</h2>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Your answers have not been submitted. Exiting will end this attempt without a grade.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowExitConfirm(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100">Continue quiz</button>
              <button type="button" onClick={handleBackToList} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Exit without submitting</button>
            </div>
          </div>
        </Dialog>
      )}
      {isQuizPage && activeQuiz && submitResult && (
        <section aria-label="Quiz results" className="w-full max-w-5xl mx-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full p-5 sm:p-8">
            {submitError && <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{submitError}</p>}
            {reviewRegionId !== null ? (() => {
              const reviewQuestion = questions.find(q => q.id === reviewRegionId);
              const review = feedbackByQuestionId.get(reviewRegionId)?.region_review;
              if (!reviewQuestion || !review || reviewQuestion.format !== 'region_identification') return null;
              return <div className="space-y-4">
                <button type="button" onClick={() => setReviewRegionId(null)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Back to results</button>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Region review: {reviewQuestion.question}</h2>
                <ThreeDQuestion key={`review-${reviewRegionId}`} format="region_identification"
                  config={{model_id:review.model_id}} value={selectedAnswers[reviewRegionId]||''}
                  onChange={() => {}} disabled review={review} viewerClassName="h-[54vh] min-h-[360px] max-h-[680px] w-full"/>
                <p className="text-sm text-slate-500 dark:text-slate-400">IoU {review.details?.iou ?? 0}% · Coverage {review.details?.coverage ?? 0}% · Precision {review.details?.precision ?? 0}%</p>
              </div>;
            })() : <>
            {submitResult.status === 'pending_review' ? (
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-8 h-8 text-amber-500 dark:text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
                  Submitted — Pending Review
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  This quiz includes open-ended questions that need to be reviewed by your teacher before a final score is available.
                </p>
              </div>
            ) : (
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-display">
                  You scored {submitResult.score}%
                </h2>
                {/* <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {submitResult.mcq_count > 0 && (
                    <>{submitResult.correct} of {submitResult.mcq_count} multiple-choice correct</>
                  )}
                  {submitResult.mcq_count > 0 && submitResult.open_ended_count > 0 && ' · '}
                  {submitResult.open_ended_count > 0 && (
                    <>{submitResult.open_ended_count} open-ended answer{submitResult.open_ended_count > 1 ? 's' : ''} reviewed by teacher</>
                  )}
                </p> */}
              </div>
            )}

            {(submitResult.status === 'graded' || openEndedResults.length > 0) && (
              <div className="space-y-3 mb-6">
                {questions.map((question, index) => {
                  const fb = feedbackByQuestionId.get(question.id);
                  const openResult = openEndedResults.find((result) => result.question_id === question.id);
                  if (question.format === 'mcq') {
                    const isCorrect = fb?.is_correct ?? false;
                    const correctLetter = fb?.correct_option;
                    const correctText = correctLetter
                      ? (question[`option_${correctLetter.toLowerCase()}` as keyof QuizQuestion] as string)
                      : '';
                    return (
                      <div key={question.id} className={`px-4 py-3 rounded-lg border ${isCorrect
                        ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'}`}>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Q{index + 1}. {question.question}</p>
                        <p className={`text-xs mt-1 ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {isCorrect ? '✓ Correct' : correctLetter
                            ? `✗ Incorrect — Correct answer: ${correctText}`
                            : '✗ Incorrect — the correct answer will be shown once your teacher has finished marking this attempt'}
                        </p>
                      </div>
                    );
                  }
                  if (is3D(question.format)) {
                    return (
                      <div key={question.id} className="px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Q{index + 1}. {question.question}</p>
                        <p className="text-sm mt-1 text-blue-700 dark:text-blue-300">
                          {question.format === 'region_identification' ? 'Region overlap' : 'Structure matching'}: {fb?.score ?? 0}%
                        </p>
                        {question.format === 'region_identification' && fb?.region_review && (
                          <button type="button" onClick={() => setReviewRegionId(question.id)}
                            className="mt-3 inline-flex items-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2">
                            Review your shading on the 3D model
                          </button>
                        )}
                        {fb?.details && (
                          <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">
                            {question.format === 'region_identification'
                              ? `IoU ${fb.details.iou}% · Coverage ${fb.details.coverage}% · Precision ${fb.details.precision}%`
                              : `${fb.details.matched} of ${fb.details.total} matched`}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={question.id} className={`px-4 py-3 rounded-lg border ${openResult?.teacher_score != null
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'}`}>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Q{index + 1}. {question.question}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">Your answer: {openResult?.answer_text || 'No answer provided.'}</p>
                      <p className={`text-xs mt-1 font-medium ${openResult?.teacher_score != null ? 'text-slate-700 dark:text-slate-300' : 'text-amber-700 dark:text-amber-400'}`}>
                        {openResult?.teacher_score != null ? `Graded: ${openResult.teacher_score}/100` : 'Awaiting teacher review'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={handleBackToList}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Back to Quizzes
              </button>
              {submitResult.status === 'graded' && (
                <button
                  onClick={() => { void handleRetry().catch(() => setSubmitError('Could not start a new attempt.')); }}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
            </>}
          </div>
        </section>
      )}

      {isAuthorPage && role === 'teacher' && (
        <section aria-label="Quiz builder" className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">AnatoLearn · Quiz builder</p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 font-display">
                {createdQuiz ? createdQuiz.title : 'Create a new quiz'}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {createdQuiz ? 'Manage questions, reference answers and quiz details.' : 'Enter quiz information, then add your questions.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button type="button" onClick={() => { void handleCancelCreateQuiz(); }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                Exit without saving
              </button>
            </div>
          </header>
          {authorPageError && <p role="alert" className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">{authorPageError}</p>}
          {!showCreateQuiz && !authorPageError && <p className="text-sm text-slate-600 dark:text-slate-300">Loading quiz editor…</p>}
          {showCreateQuiz && !createdQuiz && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">Step 1 of 2</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">Quiz information</h2>
                </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="quizzes-field-1" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input id="quizzes-field-1"
                  type="text"
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="e.g. Muscular System Basics"
                />
              </div>

              <div>
                <label htmlFor="quizzes-field-2" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea id="quizzes-field-2"
                  rows={3}
                  value={newQuizDescription}
                  onChange={(e) => setNewQuizDescription(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label htmlFor="quizzes-field-3" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Category
                </label>
                <input id="quizzes-field-3"
                  type="text"
                  value={newQuizCategory}
                  onChange={(e) => setNewQuizCategory(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="e.g. Muscular, Cardiovascular, Respiratory"
                />
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Quiz type (MCQ / Practical / Mixed) is set automatically based on the question formats you add next.
              </p>
            </div>


                {createQuizError && (
                  <p role="alert" className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{createQuizError}</p>
                )}
                <div className="flex flex-wrap justify-between items-center gap-3 border-t border-slate-200 dark:border-slate-700 pt-5">
                  <button type="button" onClick={() => { void handleCancelCreateQuiz(); }} className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:underline">Cancel</button>
                  <button type="button" onClick={() => { void handleCreateQuiz(); }} className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">Next: Add Questions</button>
                </div>
              </section>
              <aside className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 text-sm text-slate-600 dark:text-slate-300 space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">How the quiz builder works</h3>
                <p>Enter the title and optional details, then choose the questions students will answer.</p>
                <p>Supports multiple-choice, open-ended, 3D region identification and 3D annotation matching questions.</p>
                <p>Nothing is saved to the quiz database until you click Finish editing. Exit without saving discards this draft.</p>
              </aside>
            </div>
          )}
          {showCreateQuiz && createdQuiz && (
            <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5 xl:gap-7 items-start">
              <aside className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">Step 2 of 2</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">Questions ({createdQuestions.length})</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isEditMode ? 'Editing an existing quiz' : 'Creating a new quiz'}</p>
                </div>
                <button type="button" onClick={() => startEditingQuizDetails(createdQuiz!)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Edit quiz details
                </button>
                <p className="text-xs text-slate-600 dark:text-slate-400">Type: <span className="font-semibold">{derivedTypePreview}</span></p>
                {createdQuestions.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-5 text-center text-sm text-slate-500 dark:text-slate-400">No questions yet. Add your first question on the right.</p>}
            {createdQuestions.length > 0 && (
              <div className="space-y-2">
                {createdQuestions.map((q, index) => (
                  <div
                    key={q.id}
                    className="px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-800 dark:text-slate-200">
                        Q{index + 1}. {q.question}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {q.format === 'mcq' ? (
                          <>MCQ — Correct: {q.correct_option}</>
                        ) : (
                          <>{q.format === 'open_ended' ? 'Open Ended' : q.format === 'region_identification' ? '3D Region Identification' : '3D Annotation Matching'}</>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {!is3D(q.format) && <button type="button" onClick={() => setBankOnSaveIds(prev => prev.includes(q.id) ? prev.filter(id => id !== q.id) : [...prev, q.id])} className="text-xs text-blue-600 hover:underline">{bankOnSaveIds.includes(q.id) ? '✓ Add to bank on save' : 'Add to bank on save'}</button>}
                      <button
                        onClick={() => { handleEditCreatedQuestion(q); document.getElementById('quiz-builder-question-editor')?.scrollIntoView({behavior:'smooth',block:'start'}); }}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCreatedQuestion(q.id)}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}


                <QuestionBank quizId={createdQuiz.id} onStageImport={stageBankQuestion} onImported={() => {}} />
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex flex-col gap-3">
                  <button type="button" onClick={() => { void handleFinishCreateQuiz(); }} disabled={createdQuestions.length === 0 || savingEditor}
                    className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    {savingEditor ? 'Saving quiz…' : 'Finish editing'}
                  </button>
                  <button type="button" onClick={handleCancelCreateQuiz} disabled={savingEditor} className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:underline disabled:opacity-50">Exit without saving</button>
                  {isEditMode && <button type="button" disabled={deletingQuizId === createdQuiz.id || savingEditor}
                    onClick={() => { void handleDeleteQuiz(createdQuiz); }}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">Delete Quiz</button>}
                </div>
              </aside>
              <div className="min-w-0 space-y-5">
                {editingQuiz && (
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-7 space-y-4" aria-label="Edit quiz details">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Quiz details</h2>
                      <button type="button" onClick={closeEditQuiz} className="text-sm text-slate-600 dark:text-slate-400 hover:underline">Close details</button>
                    </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="quizzes-field-6" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input id="quizzes-field-6"
                  type="text"
                  value={editQuizTitle}
                  onChange={(e) => setEditQuizTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="quizzes-field-7" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea id="quizzes-field-7"
                  value={editQuizDescription}
                  onChange={(e) => setEditQuizDescription(e.target.value)}
                  rows={3}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                />
              </div>

              <div>
                <label htmlFor="quizzes-field-8" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Category
                </label>
                <input id="quizzes-field-8"
                  type="text"
                  value={editQuizCategory}
                  onChange={(e) => setEditQuizCategory(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
              </div>
            </div>


                    {editQuizError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{editQuizError}</p>}
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={closeEditQuiz} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:underline">Cancel</button>
                      <button type="button" onClick={() => { void handleSaveQuizEdit(); }} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Save details</button>
                    </div>
                  </section>
                )}
                <section id="quiz-builder-question-editor" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-7 space-y-5" aria-label="Question editor">
                  <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{editingQuestionId !== null ? 'Edit question' : 'Add a question'}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Select the question format and set its correct answer or 3D grading reference. Add Question and Save Changes stage the question locally. Finish editing commits all changes.</p>
                  </div>

            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Question Format
                </p>
                <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    aria-pressed={newQuestionFormat === 'mcq'}
                    onClick={() => setNewQuestionFormat('mcq')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${newQuestionFormat === 'mcq'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                  >
                    MCQ
                  </button>
                  <button
                    type="button"
                    aria-pressed={newQuestionFormat === 'open_ended'}
                    onClick={() => setNewQuestionFormat('open_ended')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${newQuestionFormat === 'open_ended'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                  >
                    Open Ended
                  </button>
                  {([['region_identification','3D Region'],['annotation_matching','3D Matching']] as const).map(([format,title])=>(
                    <button key={format} type="button" aria-pressed={newQuestionFormat===format} onClick={()=>{setNewQuestionFormat(format);setNew3DConfig(null);}}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${newQuestionFormat===format?'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-400':'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                      {title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="quizzes-field-4" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Question
                </label>
                <textarea id="quizzes-field-4"
                  rows={3}
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="e.g. Which muscle flexes the elbow?"
                />
              </div>

              {newQuestionFormat === 'mcq' ? (
                <>
                  {([
                    ['A', newOptionA, setNewOptionA],
                    ['B', newOptionB, setNewOptionB],
                    ['C', newOptionC, setNewOptionC],
                    ['D', newOptionD, setNewOptionD],
                  ] as const).map(([letter, value, setter]) => (
                    <div key={letter} className="flex items-center gap-2">
                      <input
                        aria-label={`Correct option ${letter}`}
                        type="radio"
                        name="new-correct-option"
                        checked={newCorrectOption === letter}
                        onChange={() => setNewCorrectOption(letter)}
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 accent-blue-600 flex-shrink-0"
                      />
                      <input
                        aria-label={`Option ${letter} text`}
                        type="text"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="text-slate-900 dark:text-slate-100 flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                        placeholder={`Option ${letter}`}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Select the radio button next to the correct answer.
                  </p>
                </>
              ) : newQuestionFormat === 'open_ended' ? (
                <div>
                  <label htmlFor="quizzes-field-5" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Model Answer
                  </label>
                  <textarea id="quizzes-field-5"
                    value={newModelAnswer}
                    onChange={(e) => setNewModelAnswer(e.target.value)}
                    rows={3}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                    placeholder="Reference answer used to guide manual grading — students won't see this before submitting."
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Open-ended answers require manual review before a score is shown to the student.
                  </p>
                </div>
              ) : (
                <ThreeDQuestionEditor format={newQuestionFormat} config={new3DConfig} onChange={setNew3DConfig}/>
              )}

              {createQuizError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                  {createQuizError}
                </p>
              )}

              <button
                onClick={handleSaveQuestion}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors px-5 py-3 w-full sm:w-auto"
              >
                {editingQuestionId !== null ? 'Save Changes' : '+ Add Question'}
              </button>
            </div>


                  {editingQuestionId !== null && (
                    <button type="button" className="text-sm text-slate-600 dark:text-slate-300 hover:underline" onClick={() => {
                      setEditingQuestionId(null); setNewQuestionText(''); setNewQuestionFormat('mcq'); setNew3DConfig(null);
                      setNewModelAnswer(''); setNewOptionA(''); setNewOptionB(''); setNewOptionC(''); setNewOptionD(''); setNewCorrectOption('A'); setCreateQuizError(null);
                    }}>Cancel question editing</button>
                  )}
                </section>
              </div>
            </div>
          )}
        </section>
      )}
      {isAuthorPage && role !== 'teacher' && (
        <div role="alert" className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-slate-900 dark:text-slate-100">
          Only teachers can create or edit quizzes.
        </div>
      )}
      {!isDedicatedPage && <>
      {showResultsQuiz && (
        <Dialog onClose={handleCloseResults} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            {selectedAttemptId === null ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-1">
                  Student Results
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Quiz: <span className="font-medium text-slate-700 dark:text-slate-300">{showResultsQuiz.title}</span>
                </p>

                <RequestState loading={loadingPending} error={gradingError} onRetry={()=>void handleOpenResults(showResultsQuiz)} label="quiz results" />

                {!loadingPending && !gradingError && pendingAttempts.length === 0 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 py-6 text-center">
                    No students have submitted this quiz yet.
                  </p>
                )}

                {!loadingPending && pendingAttempts.length > 0 && (
                  <div className="space-y-2">
                    {pendingAttempts.map((attempt) => (
                      <button
                        key={attempt.id}
                        onClick={() => handleSelectAttempt(attempt.id)}
                        className="text-slate-900 dark:text-slate-100 w-full text-left px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                      >
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {attempt.student_name || `Student ${attempt.student_id}`} — {attempt.score == null ? attempt.status : `${attempt.score}%`} — Attempt #{attempt.id}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {new Date(attempt.attempted_at).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}



                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleCloseResults}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedAttemptId(null)}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-4"
                >
                  ← Back to pending attempts
                </button>

                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
                  Grade Attempt #{selectedAttemptId}
                </h2>

                <div className="space-y-4">
                  {attemptAnswers.map((answer, index) => (
                    <div key={answer.id} className="px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                        Q{index + 1}. {answer.question}
                      </p>

                      {answer.format === 'mcq' ? (
                        <div className="text-xs">
                          <p className="text-slate-500 dark:text-slate-400">
                            Student selected: <span className="font-medium">{answer.selected_option || 'No answer'}</span>
                            {' — '}Correct answer: <span className="font-medium">{answer.correct_option}</span>
                          </p>
                          <p className={`mt-1 font-medium ${answer.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {answer.is_correct ? '✓ Correct (auto-graded)' : '✗ Incorrect (auto-graded)'}
                          </p>
                        </div>
                      ) : is3D(answer.format) ? (
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          Auto-graded {answer.format==='region_identification'?'region identification':'annotation matching'}: {answer.teacher_score??0}/100
                          <span className="ml-2">{answer.is_correct?'✓ Correct':'Not fully correct'}</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Student Answer
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                              {answer.answer_text || 'No answer provided.'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Model Answer
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                              {answer.model_answer}
                            </p>
                          </div>

                          {answer.teacher_score !== null ? (
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                              Graded: {answer.teacher_score}/100
                            </p>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={gradeInputs[answer.id] ?? ''}
                                onChange={(e) =>
                                  setGradeInputs((prev) => ({ ...prev, [answer.id]: e.target.value }))
                                }
                                className="text-slate-900 dark:text-slate-100 w-24 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                                aria-label={`Score for ${answer.question}`}
                                placeholder="0-100"
                              />
                              <button
                                onClick={() => handleGradeAnswer(answer.id)}
                                disabled={gradingAnswerId === answer.id}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {gradingAnswerId === answer.id ? 'Saving...' : 'Save Grade'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {gradingError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mt-4">
                    {gradingError}
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleCloseResults}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog>
      )}
      </>}
    </div>
  );
}

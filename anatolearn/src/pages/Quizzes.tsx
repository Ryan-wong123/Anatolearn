import RequestState from '../components/RequestState';
import { useResource } from '../hooks/useResource';
import Dialog from '../components/Dialog';
import QuestionBank from '../components/QuestionBank';
import ContentSettings from '../components/ContentSettings';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Clock, BookOpen, Search, Heart } from 'lucide-react';
import { useAppContext } from '../context/AppContextState';
import { useToast } from '../context/ToastContextState';
import { api } from '../api/api';

interface Quiz {
  id: number;
  program_id: number | null;
  time_limit_seconds?: number | null;
  title: string;
  description: string | null;
  type: 'MCQ' | 'Practical' | 'Mixed';
  category: string | null;
  is_published: boolean;
  created_at: string;
}

interface QuizQuestion {
  id: number;
  quiz_id: number;
  question: string;
  format: 'mcq' | 'open_ended';
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
}

interface CreatedQuizQuestion {
  id: number;
  quiz_id: number;
  question: string;
  format: 'mcq' | 'open_ended';
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
interface AttemptAnswer { id:number; question_id:number; question:string; format:'mcq'|'open_ended'; model_answer:string|null; correct_option:string|null; selected_option:string|null; answer_text:string|null; teacher_score:number|null; is_correct:boolean|null; }
interface OpenEndedResult { question_id:number; question:string; answer_text:string|null; teacher_score:number|null; }

const optionLetters = ['A', 'B', 'C', 'D'] as const;

const quizTypeBadgeClasses: Record<Quiz['type'], string> = {
  MCQ: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  Practical: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400',
  Mixed: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
};

function deriveQuizType(questions: CreatedQuizQuestion[]): 'MCQ' | 'Practical' | 'Mixed' {
  const hasMcq = questions.some((q) => q.format === 'mcq');
  const hasOpenEnded = questions.some((q) => q.format === 'open_ended');

  if (hasMcq && hasOpenEnded) return 'Mixed';
  if (hasOpenEnded) return 'Practical';
  return 'MCQ';
}

export default function Quizzes() {
  const { toast } = useToast();
  const { role, program } = useAppContext();


  const [quizSearchTerm, setQuizSearchTerm] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [clockOffset, setClockOffset] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);

  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDescription, setNewQuizDescription] = useState('');
  const [newQuizCategory, setNewQuizCategory] = useState('');
  const [createdQuiz, setCreatedQuiz] = useState<Quiz | null>(null);
  const [createdQuestions, setCreatedQuestions] = useState<CreatedQuizQuestion[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptionA, setNewOptionA] = useState('');
  const [newOptionB, setNewOptionB] = useState('');
  const [newOptionC, setNewOptionC] = useState('');
  const [newOptionD, setNewOptionD] = useState('');
  const [newCorrectOption, setNewCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [createQuizError, setCreateQuizError] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  // True when the question-editor modal was opened via "Edit Questions" on
  // an existing quiz, rather than the create-new-quiz flow. Reuses the same
  // modal/state, but changes what Finish/Cancel do (see handleFinishCreateQuiz
  // and handleCancelCreateQuiz).
  const [isEditMode, setIsEditMode] = useState(false);
  const [newQuestionFormat, setNewQuestionFormat] = useState<'mcq' | 'open_ended'>('mcq');
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
  const fetchFavorites = useCallback(async () => {
    if (role !== 'student') return new Set<number>();
    const data: {quizzes:{id:number}[]} = await api.getFavorites();
    return new Set(data.quizzes.map((quiz) => quiz.id));
  }, [role]);
  const favorites = useResource<Set<number>>(fetchFavorites, new Set(), program);
  const {data:favoritedQuizIds,setData:setFavoritedQuizIds} = favorites;

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


  const handleStartQuiz = async (quiz: Quiz) => {
    try {
      const session = await api.startQuiz(quiz.id);
      setSessionId(session.session_id);
      setExpiresAt(session.expires_at); setClockOffset(Date.parse(session.server_now)-Date.now());
      const loadedQuestions = session.questions;


      setActiveQuiz(quiz);
      setQuestions(loadedQuestions);
      setCurrentQuestion(0);
      setSelectedAnswers({});
      setSubmitResult(null);
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not start quiz');
    }
  };

  async function reviewAttempt(summary: QuizAttemptSummary) {
    try {
      const attempt = await api.getAttempt(summary.id);
      const answers: (AttemptAnswer & {option_a:string|null;option_b:string|null;option_c:string|null;option_d:string|null})[] = await api.getAttemptAnswers(summary.id);
      setQuestions(answers.map((a)=>({id:a.question_id,quiz_id:summary.quiz_id,question:a.question,format:a.format,option_a:a.option_a,option_b:a.option_b,option_c:a.option_c,option_d:a.option_d})));
      setActiveQuiz(quizzes.find((q)=>q.id===summary.quiz_id) || {id:summary.quiz_id,program_id:null,title:summary.quiz_title,description:null,type:'Mixed',category:null,is_published:false,created_at:''});
      const feedback = answers.filter((a)=>a.format==='mcq').map((a)=>({question_id:a.question_id,selected_option:a.selected_option||'',correct_option:a.correct_option||'',is_correct:a.is_correct===true}));
      setSubmitResult({status:attempt.status,score:attempt.score,total:attempt.total_questions,correct:attempt.correct_count,incorrect:attempt.status==='graded'?attempt.total_questions-attempt.correct_count:null,mcq_count:feedback.length,open_ended_count:answers.length-feedback.length,feedback});
      setOpenEndedResults(answers.filter((a)=>a.format==='open_ended'));
      setExpiresAt(null);setSessionId('');setSubmitError(null);
    } catch { setSubmitError('Could not load this attempt.'); }
  }

  const handleSelectAnswer = (questionId: number, value: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    setCurrentQuestion((prev) => prev + 1);
  };

  const handleSubmit = async () => {
    if (!activeQuiz) return;

    const answers = questions.map((q) => {
      if (q.format === 'mcq') {
        return { question_id: q.id, selected_option: selectedAnswers[q.id] };
      }
      return { question_id: q.id, answer_text: selectedAnswers[q.id] };
    });

    try {
      setSubmitting(true);
      setSubmitError(null);
      const result = await api.submitQuiz(activeQuiz.id, answers, sessionId);
      setSubmitResult(result);
      sessionStorage.setItem(`quiz-attempt-${activeQuiz.id}`, String(result.attempt.id));

      // Task 8.8: refresh real history right away so the new attempt shows
      // up without needing a full page reload.
      history.reload();

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

  useEffect(() => { submitRef.current = () => { if (!submitting && !submitResult) void handleSubmit(); }; });
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

  useEffect(() => {
    if (!sessionId || submitResult) return;
    const cancel = () => { void api.cancelQuizSession(sessionId).catch(() => {}); };
    window.addEventListener('pagehide',cancel);
    return () => { window.removeEventListener('pagehide',cancel); cancel(); };
  }, [sessionId, submitResult]);

  const handleRetry = async () => {
    if (activeQuiz) { const session = await api.startQuiz(activeQuiz.id); setSessionId(session.session_id); setExpiresAt(session.expires_at); setClockOffset(Date.parse(session.server_now)-Date.now()); }
    if (activeQuiz) {
      sessionStorage.removeItem(`quiz-attempt-${activeQuiz.id}`);
    }
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setSubmitResult(null);
    setSubmitError(null);
    setOpenEndedResults([]);
  };

  const handleBackToList = () => {
    if (sessionId && !submitResult) void api.cancelQuizSession(sessionId).catch(() => {});
    setExpiresAt(null);
    setActiveQuiz(null);
    setQuestions([]);
    setSubmitResult(null);
    setSubmitError(null);
    setOpenEndedResults([]);
  };

  const handleCreateQuiz = async () => {
    if (!newQuizTitle.trim()) {
      setCreateQuizError('Title is required.');
      return;
    }

    try {
      setCreateQuizError(null);
      const quiz = await api.createQuiz({
        title: newQuizTitle,
        description: newQuizDescription || undefined,
        type: 'MCQ',
        category: newQuizCategory || undefined,
      });
      setCreatedQuiz(quiz);
    } catch (err) {
      console.error('Failed to create quiz:', err);
      setCreateQuizError(err instanceof Error ? err.message : 'Failed to create quiz. Please try again.');
    }
  };

  const handleCancelCreateQuiz = async () => {
    // Only delete an abandoned quiz when this was the create-new-quiz flow.
    // An existing quiz being edited must never be deleted on cancel, even
    // if the teacher removed every question before backing out.
    if (!isEditMode && createdQuiz && createdQuestions.length === 0) {
      try {
        await api.deleteQuiz(createdQuiz.id);
      } catch (err) {
        console.error('Failed to delete abandoned quiz:', err);
        setCreateQuizError(err instanceof Error ? err.message : 'Could not discard this draft. Please try again.');
        return;
      }
    }

    setShowCreateQuiz(false);
    setCreatedQuiz(null);
    setCreatedQuestions([]);
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
    setIsEditMode(false);
  };

  const handleFinishCreateQuiz = async () => {
    if (createdQuiz) {
      try {
        const derivedType = deriveQuizType(createdQuestions);
        await api.updateQuizType(createdQuiz.id, derivedType);
        setQuizzes((prev) =>
          isEditMode
            // This quiz is already in the list — update its type in place
            // instead of appending a duplicate entry.
            ? prev.map((q) => (q.id === createdQuiz.id ? { ...q, type: derivedType } : q))
            : [...prev, { ...createdQuiz, type: derivedType }]
        );
      } catch (err) {
        console.error('Failed to finalize quiz:', err);
        setCreateQuizError(err instanceof Error ? err.message : 'Could not finish saving this quiz. Please try again.');
        return;
      }
    }

    setShowCreateQuiz(false);
    setCreatedQuiz(null);
    setCreatedQuestions([]);
    setNewQuizTitle('');
    setNewQuizDescription('');
    setNewQuizCategory('');
    setEditingQuestionId(null);
    setCreateQuizError(null);
    setNewModelAnswer('');
    setNewQuestionFormat('mcq');
    setIsEditMode(false);
  };

  const handleDeleteCreatedQuestion = async (id: number) => {
    try {
      await api.deleteQuizQuestion(id);
      setCreatedQuestions((prev) => prev.filter((q) => q.id !== id));
      if (editingQuestionId === id) {
        setEditingQuestionId(null);
        setNewQuestionText('');
        setNewOptionA('');
        setNewOptionB('');
        setNewOptionC('');
        setNewOptionD('');
        setNewCorrectOption('A');
        setNewModelAnswer('');
        setNewQuestionFormat('mcq');
      }
    } catch (err) {
      console.error('Failed to delete question:', err);
      setCreateQuizError(err instanceof Error ? err.message : 'Failed to delete question. Please try again.');
    }
  };

  const handleEditCreatedQuestion = (q: CreatedQuizQuestion) => {
    setEditingQuestionId(q.id);
    setNewQuestionText(q.question);
    setNewQuestionFormat(q.format);

    if (q.format === 'mcq') {
      setNewOptionA(q.option_a || '');
      setNewOptionB(q.option_b || '');
      setNewOptionC(q.option_c || '');
      setNewOptionD(q.option_d || '');
      setNewCorrectOption(q.correct_option || 'A');
      setNewModelAnswer('');
    } else {
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
    } else {
      if (!newModelAnswer.trim()) {
        setCreateQuizError('A model answer is required for open-ended questions.');
        return;
      }
    }

    const payload = newQuestionFormat === 'mcq'
      ? {
        question: newQuestionText,
        format: 'mcq' as const,
        option_a: newOptionA,
        option_b: newOptionB,
        option_c: newOptionC,
        option_d: newOptionD,
        correct_option: newCorrectOption,
      }
      : {
        question: newQuestionText,
        format: 'open_ended' as const,
        model_answer: newModelAnswer,
      };

    try {
      setCreateQuizError(null);

      if (editingQuestionId !== null) {
        const updated = await api.updateQuizQuestion(editingQuestionId, payload);
        setCreatedQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
        setEditingQuestionId(null);
      } else {
        const question = await api.createQuizQuestion(createdQuiz.id, payload);
        setCreatedQuestions((prev) => [...prev, question]);
      }

      setNewQuestionText('');
      setNewOptionA('');
      setNewOptionB('');
      setNewOptionC('');
      setNewOptionD('');
      setNewCorrectOption('A');
      setNewModelAnswer('');
      setNewQuestionFormat('mcq');
    } catch (err) {
      console.error('Failed to save question:', err);
      setCreateQuizError(err instanceof Error ? err.message : 'Failed to save question. Please try again.');
    }
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

  const openEditQuizQuestions = async (quiz: Quiz) => {
    try {
      const fetched: CreatedQuizQuestion[] = await api.getQuizQuestions(quiz.id);
      setCreatedQuiz(quiz);
      setCreatedQuestions(fetched);
      setIsEditMode(true);
      setShowCreateQuiz(true);
      setCreateQuizError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not start quiz');
      setCreateQuizError(err instanceof Error ? err.message : 'Failed to load questions for this quiz. Please try again.');
    }
  };

  const openEditQuiz = (quiz: Quiz) => {
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

  const handleSaveQuizEdit = async () => {
    if (!editingQuiz) return;

    if (!editQuizTitle.trim()) {
      setEditQuizError('Title is required.');
      return;
    }

    try {
      const updated = await api.updateQuiz(editingQuiz.id, {
        title: editQuizTitle,
        description: editQuizDescription || undefined,
        category: editQuizCategory || undefined,
      });
      setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      closeEditQuiz();
    } catch (err) {
      console.error('Failed to update quiz:', err);
      setEditQuizError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    }
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
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
            onClick={() => setShowCreateQuiz(true)}
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
          onChange={(e) => setQuizSearchTerm(e.target.value)}
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
        {filteredQuizzes.map((quiz) => (
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

              <ContentSettings kind="quizzes" id={quiz.id} programId={quiz.program_id} timer={quiz.time_limit_seconds} onSaved={() => api.getQuizzes().then(setQuizzes)} />
              {role === 'teacher' && (
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
                </div>
              )}
            </div>
          </div>
        ))}

      </div>

      {role === 'student' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-3">
            My Quiz History
          </h2>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <RequestState loading={history.loading} error={history.error} onRetry={history.reload} label="quiz history" />
            {!history.loading && !history.error && attemptHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
                No quiz attempts yet.
              </div>
            ) : (
              attemptHistory.map((attempt) => (
                <div
                  key={attempt.id}
                  className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-b-0"
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
                  <button onClick={() => { void reviewAttempt(attempt); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Review answers</button>
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
        </div>
      )}

      {activeQuiz && !submitResult && current && (
        <Dialog onClose={handleBackToList} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-xl p-6">
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Question {currentQuestion + 1} of {questions.length}
                {remaining !== null && <span className="ml-3 text-amber-600" role="timer">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')} remaining</span>}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
                {current.question}
              </h2>
            </div>

            {current.format === 'mcq' ? (
              <div role="radiogroup" aria-label={current.question} className="space-y-3 mb-8">
                {optionLetters.map((letter) => {
                  const optionText = current[`option_${letter.toLowerCase()}` as keyof QuizQuestion] as string;

                  return (
                    <label
                      key={letter}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${selectedAnswers[current.id] === letter
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                      <input
                        type="radio"
                        name={`question-${current.id}`}
                        checked={selectedAnswers[current.id] === letter}
                        onChange={() => handleSelectAnswer(current.id, letter)}
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 accent-blue-600"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{optionText}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="mb-8">
                <textarea
                  value={selectedAnswers[current.id] || ''}
                  onChange={(e) => handleSelectAnswer(current.id, e.target.value)}
                  rows={5}
                  className="text-slate-900 dark:text-slate-100 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                  aria-label="Your answer"
                  placeholder="Type your answer here..."
                />
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  This is an open-ended question. Your answer will be manually reviewed by your teacher.
                </p>
              </div>
            )}

            {submitError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mb-4">
                {submitError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={handleBackToList}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>

              {currentQuestion < questions.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!selectedAnswers[current.id]?.trim()}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!selectedAnswers[current.id]?.trim() || submitting}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {activeQuiz && submitResult && (
        <Dialog onClose={handleBackToList} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-xl p-6">
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
                {questions
                  .filter((q) => q.format === 'mcq')
                  .map((question, index) => {
                    const fb = feedbackByQuestionId.get(question.id);
                    const isCorrect = fb?.is_correct ?? false;
                    const correctLetter = fb?.correct_option;
                    const correctText = correctLetter
                      ? (question[`option_${correctLetter.toLowerCase()}` as keyof QuizQuestion] as string)
                      : '';

                    return (
                      <div
                        key={question.id}
                        className={`px-4 py-3 rounded-lg border ${isCorrect
                          ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
                          }`}
                      >
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          Q{index + 1}. {question.question}
                        </p>
                        <p
                          className={`text-xs mt-1 ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                            }`}
                        >
                          {isCorrect
                            ? '✓ Correct'
                            : `✗ Incorrect — Correct answer: ${correctText}`}
                        </p>
                      </div>
                    );
                  })}

                {openEndedResults.map((result, index) => (
                  <div
                    key={result.question_id}
                    className={`px-4 py-3 rounded-lg border ${result.teacher_score !== null
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                      }`}
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Q{questions.filter((q) => q.format === 'mcq').length + index + 1}. {result.question}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                      Your answer: {result.answer_text || 'No answer provided.'}
                    </p>
                    <p className={`text-xs mt-1 font-medium ${result.teacher_score !== null ? 'text-slate-700 dark:text-slate-300' : 'text-amber-700 dark:text-amber-400'}`}>
                      {result.teacher_score !== null
                        ? `Graded: ${result.teacher_score}/100`
                        : 'Awaiting teacher review'}
                    </p>
                  </div>
                ))}
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
          </div>
        </Dialog>
      )}

      {showCreateQuiz && !createdQuiz && (
        <Dialog onClose={handleCancelCreateQuiz} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
              Create Quiz
            </h2>

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
                <input id="quizzes-field-2"
                  type="text"
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
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mt-4">
                {createQuizError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleCancelCreateQuiz}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateQuiz}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Next: Add Questions
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {showCreateQuiz && createdQuiz && (
        <Dialog onClose={handleCancelCreateQuiz} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-1">
              {isEditMode ? 'Edit Questions' : 'Add Questions'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Quiz: <span className="font-medium text-slate-700 dark:text-slate-300">{createdQuiz.title}</span>
            </p>
            <QuestionBank quizId={createdQuiz.id} onImported={() => { void api.getQuizQuestions(createdQuiz.id).then(setCreatedQuestions).catch(()=>setCreateQuizError('The bank action was saved, but the questions could not reload. Close and reopen this editor.')); }} />
            {createdQuestions.length > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Current type (auto-detected):{' '}
                <span className={`px-2 py-0.5 rounded-full font-medium ${quizTypeBadgeClasses[derivedTypePreview]}`}>
                  {derivedTypePreview}
                </span>
              </p>
            )}

            {createdQuestions.length > 0 && (
              <div className="space-y-2 mb-6">
                {createdQuestions.map((q, index) => (
                  <div
                    key={q.id}
                    className="px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Q{index + 1}. {q.question}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {q.format === 'mcq' ? (
                          <>MCQ — Correct: {q.correct_option}</>
                        ) : (
                          <>Open Ended</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button onClick={() => { void api.bankQuestion(q.id,createdQuiz.category || '').catch((e: Error) => setCreateQuizError(e.message)); }} className="text-xs text-blue-600 hover:underline">Save to bank</button>
                      <button
                        onClick={() => handleEditCreatedQuestion(q)}
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

            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Question Format
                </p>
                <div className="mt-1 flex gap-2">
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
                </div>
              </div>

              <div>
                <label htmlFor="quizzes-field-4" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Question
                </label>
                <input id="quizzes-field-4"
                  type="text"
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
              ) : (
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
              )}

              {createQuizError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
                  {createQuizError}
                </p>
              )}

              <button
                onClick={handleSaveQuestion}
                className="w-full border border-slate-200 dark:border-slate-700 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors px-4 py-2"
              >
                {editingQuestionId !== null ? 'Save Changes' : '+ Add Question'}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleCancelCreateQuiz}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFinishCreateQuiz}
                disabled={createdQuestions.length === 0}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Done
              </button>
            </div>
          </div>
        </Dialog>
      )}
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
      {editingQuiz && (
        <Dialog onClose={closeEditQuiz} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
              Edit Quiz
            </h2>

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

            {editQuizError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mt-4">
                {editQuizError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEditQuiz}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuizEdit}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

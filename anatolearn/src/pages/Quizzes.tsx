import { useEffect, useState } from 'react';
import { Clock, BookOpen } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';

interface Quiz {
  id: number;
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

const optionLetters = ['A', 'B', 'C', 'D'] as const;

const quizTypeBadgeClasses: Record<Quiz['type'], string> = {
  MCQ: 'bg-purple-100 text-purple-700',
  Practical: 'bg-indigo-100 text-indigo-700',
  Mixed: 'bg-blue-100 text-blue-700',
};

function deriveQuizType(questions: CreatedQuizQuestion[]): 'MCQ' | 'Practical' | 'Mixed' {
  const hasMcq = questions.some((q) => q.format === 'mcq');
  const hasOpenEnded = questions.some((q) => q.format === 'open_ended');

  if (hasMcq && hasOpenEnded) return 'Mixed';
  if (hasOpenEnded) return 'Practical';
  return 'MCQ';
}

export default function Quizzes() {
  const { role } = useAppContext();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [quizLoadError, setQuizLoadError] = useState(false);
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
  const [newQuestionFormat, setNewQuestionFormat] = useState<'mcq' | 'open_ended'>('mcq');
  const [newModelAnswer, setNewModelAnswer] = useState('');

  const [showResultsQuiz, setShowResultsQuiz] = useState<Quiz | null>(null);
  const [pendingAttempts, setPendingAttempts] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [attemptAnswers, setAttemptAnswers] = useState<any[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<number, string>>({});
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingAnswerId, setGradingAnswerId] = useState<number | null>(null);
  const [openEndedResults, setOpenEndedResults] = useState<any[]>([]);

  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editQuizTitle, setEditQuizTitle] = useState('');
  const [editQuizDescription, setEditQuizDescription] = useState('');
  const [editQuizCategory, setEditQuizCategory] = useState('');
  const [editQuizError, setEditQuizError] = useState<string | null>(null);

  // Task 8.8 — real quiz attempt history, keyed to the logged-in student's
  // account rather than the old same-browser sessionStorage stopgap.
  const [attemptHistory, setAttemptHistory] = useState<QuizAttemptSummary[]>([]);

  useEffect(() => {
    setLoadingQuizzes(true);
    setQuizLoadError(false);
    api.getQuizzes(role === 'student')
      .then(setQuizzes)
      .catch((err) => {
        console.error('Failed to load quizzes:', err);
        setQuizLoadError(true);
      })
      .finally(() => setLoadingQuizzes(false));
  }, [role]);

  useEffect(() => {
    if (role !== 'student') return;
    api.getMyAttempts()
      .then(setAttemptHistory)
      .catch((err) => console.error('Failed to load attempt history:', err));
  }, [role]);

  const handleStartQuiz = async (quiz: Quiz) => {
    try {
      const storedAttemptId = sessionStorage.getItem(`quiz-attempt-${quiz.id}`);

      if (storedAttemptId) {
        const attempt = await api.getAttempt(Number(storedAttemptId));
        const answers = await api.getAttemptAnswers(Number(storedAttemptId));
        const loadedQuestions = await api.getQuizQuestions(quiz.id);

        setActiveQuiz(quiz);
        setQuestions(loadedQuestions);
        setCurrentQuestion(0);
        setSelectedAnswers({});
        setSubmitError(null);

        const feedback = answers
          .filter((a: any) => a.format === 'mcq')
          .map((a: any) => ({
            question_id: a.question_id,
            selected_option: a.selected_option,
            correct_option: a.correct_option,
            is_correct: a.is_correct,
          }));

        const openEnded = answers
          .filter((a: any) => a.format === 'open_ended')
          .map((a: any) => ({
            question_id: a.question_id,
            question: a.question,
            answer_text: a.answer_text,
            teacher_score: a.teacher_score,
          }));
        setOpenEndedResults(openEnded);

        setSubmitResult({
          status: attempt.status,
          score: attempt.score,
          total: attempt.total_questions,
          correct: attempt.correct_count,
          incorrect: attempt.status === 'graded' ? attempt.total_questions - attempt.correct_count : null,
          mcq_count: feedback.length,
          open_ended_count: attempt.total_questions - feedback.length,
          feedback,
        });
        return;
      }

      const loadedQuestions = await api.getQuizQuestions(quiz.id);

      setActiveQuiz(quiz);
      setQuestions(loadedQuestions);
      setCurrentQuestion(0);
      setSelectedAnswers({});
      setSubmitResult(null);
      setSubmitError(null);
    } catch (err) {
      console.error('Failed to load quiz questions:', err);
    }
  };

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
      const result = await api.submitQuiz(activeQuiz.id, answers);
      setSubmitResult(result);
      sessionStorage.setItem(`quiz-attempt-${activeQuiz.id}`, String(result.attempt.id));

      // Task 8.8: refresh real history right away so the new attempt shows
      // up without needing a full page reload.
      api.getMyAttempts().then(setAttemptHistory).catch(() => {});

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
      setSubmitError('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
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
      setCreateQuizError('Failed to create quiz. Please try again.');
    }
  };

  const handleCancelCreateQuiz = async () => {
    if (createdQuiz && createdQuestions.length === 0) {
      try {
        await api.deleteQuiz(createdQuiz.id);
      } catch (err) {
        console.error('Failed to delete abandoned quiz:', err);
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
  };

  const handleFinishCreateQuiz = async () => {
    if (createdQuiz) {
      try {
        const derivedType = deriveQuizType(createdQuestions);
        await api.updateQuizType(createdQuiz.id, derivedType);
        setQuizzes((prev) => [...prev, { ...createdQuiz, type: derivedType }]);
      } catch (err) {
        console.error('Failed to finalize quiz:', err);
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
      setCreateQuizError('Failed to delete question. Please try again.');
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
      setCreateQuizError('Failed to save question. Please try again.');
    }
  };

  const handleToggleQuizPublish = async (quiz: Quiz) => {
    try {
      const updated = await api.publishQuiz(quiz.id, !quiz.is_published);
      setQuizzes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    } catch (err) {
      console.error('Failed to update quiz publish state:', err);
    }
  };

  const handleOpenResults = async (quiz: Quiz) => {
    setShowResultsQuiz(quiz);
    setSelectedAttemptId(null);
    setAttemptAnswers([]);
    setGradingError(null);
    setLoadingPending(true);
    try {
      const attempts = await api.getPendingAttempts(quiz.id);
      setPendingAttempts(attempts);
    } catch (err) {
      console.error('Failed to load pending attempts:', err);
      setGradingError('Failed to load pending attempts.');
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
      setEditQuizError('Failed to save changes. Please try again.');
    }
  };

  const handleSelectAttempt = async (attemptId: number) => {
    setSelectedAttemptId(attemptId);
    setGradingError(null);
    try {
      const answers = await api.getAttemptAnswers(attemptId);
      setAttemptAnswers(answers);
      const initialInputs: Record<number, string> = {};
      answers.forEach((a: any) => {
        if (a.format === 'open_ended') {
          initialInputs[a.id] = a.teacher_score !== null ? String(a.teacher_score) : '';
        }
      });
      setGradeInputs(initialInputs);
    } catch (err) {
      console.error('Failed to load attempt answers:', err);
      setGradingError('Failed to load this attempt\'s answers.');
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
        const attempts = await api.getPendingAttempts(showResultsQuiz.id);
        setPendingAttempts(attempts);
        setSelectedAttemptId(null);
        setAttemptAnswers([]);
      }
    } catch (err) {
      console.error('Failed to grade answer:', err);
      setGradingError('Failed to save grade. Please try again.');
    } finally {
      setGradingAnswerId(null);
    }
  };

  const current = questions[currentQuestion];
  const feedbackByQuestionId = new Map(
    (submitResult?.feedback ?? []).map((f) => [f.question_id, f])
  );
  const derivedTypePreview = deriveQuizType(createdQuestions);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            Self-Assessment
          </h1>
          <p className="mt-1 text-sm text-slate-500">
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

      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loadingQuizzes && (
          <div className="py-12 text-center text-sm text-slate-400">Loading quizzes...</div>
        )}

        {!loadingQuizzes && quizLoadError && (
          <div role="alert" className="py-12 text-center text-sm text-red-600">Failed to load quizzes. Please try again.</div>
        )}

        {!loadingQuizzes && !quizLoadError && quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="px-5 py-4 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
          >
            <BookOpen className="w-5 h-5 flex-shrink-0 text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-600">{quiz.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {quiz.description || 'No description provided.'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${quizTypeBadgeClasses[quiz.type]}`}>
                {quiz.type}
              </span>

              {role === 'student' && (
                <button
                  onClick={() => handleStartQuiz(quiz)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Start Quiz
                </button>
              )}

              {role === 'teacher' && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEditQuiz(quiz)}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleQuizPublish(quiz)}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {quiz.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleOpenResults(quiz)}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    View Results
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {!loadingQuizzes && !quizLoadError && quizzes.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            No quizzes found.
          </div>
        )}
      </div>

      {role === 'student' && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 font-display mb-3">
            My Quiz History
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {attemptHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No quiz attempts yet.
              </div>
            ) : (
              attemptHistory.map((attempt) => (
                <div
                  key={attempt.id}
                  className="px-5 py-3 flex items-center justify-between border-b border-slate-100 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{attempt.quiz_title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(attempt.attempted_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  {attempt.status === 'graded' ? (
                    <span className="text-sm font-semibold text-slate-900">
                      {attempt.score}%
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
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
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl p-6">
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Question {currentQuestion + 1} of {questions.length}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 font-display">
                {current.question}
              </h2>
            </div>

            {current.format === 'mcq' ? (
              <div className="space-y-3 mb-8">
                {optionLetters.map((letter) => {
                  const optionText = current[`option_${letter.toLowerCase()}` as keyof QuizQuestion] as string;

                  return (
                    <label
                      key={letter}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${selectedAnswers[current.id] === letter
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <input
                        type="radio"
                        name={`question-${current.id}`}
                        checked={selectedAnswers[current.id] === letter}
                        onChange={() => handleSelectAnswer(current.id, letter)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-slate-700">{optionText}</span>
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  placeholder="Type your answer here..."
                />
                <p className="text-xs text-slate-400 mt-2">
                  This is an open-ended question. Your answer will be manually reviewed by your teacher.
                </p>
              </div>
            )}

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
                {submitError}
              </p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToList}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
        </div>
      )}

      {activeQuiz && submitResult && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl p-6">
            {submitResult.status === 'pending_review' ? (
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 font-display">
                  Submitted — Pending Review
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  This quiz includes open-ended questions that need to be reviewed by your teacher before a final score is available.
                </p>
              </div>
            ) : (
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 font-display">
                  You scored {submitResult.score}%
                </h2>
                {/* <p className="text-sm text-slate-500 mt-1">
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
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                          }`}
                      >
                        <p className="text-sm font-medium text-slate-800">
                          Q{index + 1}. {question.question}
                        </p>
                        <p
                          className={`text-xs mt-1 ${isCorrect ? 'text-green-700' : 'text-red-700'
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
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-amber-50 border-amber-200'
                      }`}
                  >
                    <p className="text-sm font-medium text-slate-800">
                      Q{questions.filter((q) => q.format === 'mcq').length + index + 1}. {result.question}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                      Your answer: {result.answer_text || 'No answer provided.'}
                    </p>
                    <p className={`text-xs mt-1 font-medium ${result.teacher_score !== null ? 'text-slate-700' : 'text-amber-700'}`}>
                      {result.teacher_score !== null
                        ? `Graded: ${result.teacher_score}/100`
                        : 'Awaiting teacher review'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToList}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Back to Quizzes
              </button>
              {submitResult.status === 'graded' && (
                <button
                  onClick={handleRetry}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateQuiz && !createdQuiz && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 font-display mb-4">
              Create Quiz
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g. Muscular System Basics"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Description
                </label>
                <input
                  type="text"
                  value={newQuizDescription}
                  onChange={(e) => setNewQuizDescription(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Category
                </label>
                <input
                  type="text"
                  value={newQuizCategory}
                  onChange={(e) => setNewQuizCategory(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g. Muscular, Cardiovascular, Respiratory"
                />
              </div>

              <p className="text-xs text-slate-400">
                Quiz type (MCQ / Practical / Mixed) is set automatically based on the question formats you add next.
              </p>
            </div>

            {createQuizError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-4">
                {createQuizError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleCancelCreateQuiz}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
        </div>
      )}

      {showCreateQuiz && createdQuiz && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 font-display mb-1">
              Add Questions
            </h2>
            <p className="text-sm text-slate-500 mb-1">
              Quiz: <span className="font-medium text-slate-700">{createdQuiz.title}</span>
            </p>
            {createdQuestions.length > 0 && (
              <p className="text-xs text-slate-400 mb-4">
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
                    className="px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Q{index + 1}. {q.question}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {q.format === 'mcq' ? (
                          <>MCQ — Correct: {q.correct_option}</>
                        ) : (
                          <>Open Ended</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => handleEditCreatedQuestion(q)}
                        className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCreatedQuestion(q.id)}
                        className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Question Format
                </label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewQuestionFormat('mcq')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${newQuestionFormat === 'mcq'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    MCQ
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewQuestionFormat('open_ended')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${newQuestionFormat === 'open_ended'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    Open Ended
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Question
                </label>
                <input
                  type="text"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                        type="radio"
                        name="new-correct-option"
                        checked={newCorrectOption === letter}
                        onChange={() => setNewCorrectOption(letter)}
                        className="accent-blue-600 flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder={`Option ${letter}`}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-slate-400">
                    Select the radio button next to the correct answer.
                  </p>
                </>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Model Answer
                  </label>
                  <textarea
                    value={newModelAnswer}
                    onChange={(e) => setNewModelAnswer(e.target.value)}
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                    placeholder="Reference answer used to guide manual grading — students won't see this before submitting."
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Open-ended answers require manual review before a score is shown to the student.
                  </p>
                </div>
              )}

              {createQuizError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {createQuizError}
                </p>
              )}

              <button
                onClick={handleSaveQuestion}
                className="w-full border border-slate-200 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors px-4 py-2"
              >
                {editingQuestionId !== null ? 'Save Changes' : '+ Add Question'}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleCancelCreateQuiz}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
        </div>
      )}
      {showResultsQuiz && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            {selectedAttemptId === null ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900 font-display mb-1">
                  Pending Reviews
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                  Quiz: <span className="font-medium text-slate-700">{showResultsQuiz.title}</span>
                </p>

                {loadingPending && (
                  <p className="text-sm text-slate-400 py-6 text-center">Loading...</p>
                )}

                {!loadingPending && pendingAttempts.length === 0 && (
                  <p className="text-sm text-slate-400 py-6 text-center">
                    No attempts are currently pending review for this quiz.
                  </p>
                )}

                {!loadingPending && pendingAttempts.length > 0 && (
                  <div className="space-y-2">
                    {pendingAttempts.map((attempt) => (
                      <button
                        key={attempt.id}
                        onClick={() => handleSelectAttempt(attempt.id)}
                        className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-between"
                      >
                        <span className="text-sm text-slate-700">
                          Attempt #{attempt.id}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(attempt.attempted_at).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {gradingError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-4">
                    {gradingError}
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleCloseResults}
                    className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedAttemptId(null)}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
                >
                  ← Back to pending attempts
                </button>

                <h2 className="text-lg font-semibold text-slate-900 font-display mb-4">
                  Grade Attempt #{selectedAttemptId}
                </h2>

                <div className="space-y-4">
                  {attemptAnswers.map((answer, index) => (
                    <div key={answer.id} className="px-4 py-3 rounded-lg border border-slate-200">
                      <p className="text-sm font-medium text-slate-800 mb-2">
                        Q{index + 1}. {answer.question}
                      </p>

                      {answer.format === 'mcq' ? (
                        <div className="text-xs">
                          <p className="text-slate-500">
                            Student selected: <span className="font-medium">{answer.selected_option || 'No answer'}</span>
                            {' — '}Correct answer: <span className="font-medium">{answer.correct_option}</span>
                          </p>
                          <p className={`mt-1 font-medium ${answer.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                            {answer.is_correct ? '✓ Correct (auto-graded)' : '✗ Incorrect (auto-graded)'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Student Answer
                            </p>
                            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                              {answer.answer_text || 'No answer provided.'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Model Answer
                            </p>
                            <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">
                              {answer.model_answer}
                            </p>
                          </div>

                          {answer.teacher_score !== null ? (
                            <p className="text-sm font-medium text-green-700">
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
                                className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-4">
                    {gradingError}
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleCloseResults}
                    className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {editingQuiz && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 font-display mb-4">
              Edit Quiz
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={editQuizTitle}
                  onChange={(e) => setEditQuizTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={editQuizDescription}
                  onChange={(e) => setEditQuizDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Category
                </label>
                <input
                  type="text"
                  value={editQuizCategory}
                  onChange={(e) => setEditQuizCategory(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {editQuizError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-4">
                {editQuizError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEditQuiz}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
        </div>
      )}
    </div>
  );
}

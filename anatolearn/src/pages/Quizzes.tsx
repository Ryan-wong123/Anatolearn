import { useEffect, useState } from 'react';
import { CheckCircle, Clock, BookOpen } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api } from '../api/api';

interface Quiz {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
}

interface QuizQuestion {
  id: number;
  quiz_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
}

const optionLetters = ['A', 'B', 'C', 'D'] as const;

export default function Quizzes() {
  const { role } = useAppContext();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);

  useEffect(() => {
    api.getQuizzes()
      .then(setQuizzes)
      .catch((err) => console.error('Failed to load quizzes:', err));
  }, []);

  const handleStartQuiz = async (quiz: Quiz) => {
    try {
      const loadedQuestions = await api.getQuizQuestions(quiz.id);

      setActiveQuiz(quiz);
      setQuestions(loadedQuestions);
      setCurrentQuestion(0);
      setSelectedAnswers({});
      setQuizSubmitted(false);
    } catch (err) {
      console.error('Failed to load quiz questions:', err);
    }
  };

  const handleSelectAnswer = (questionId: number, option: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleNext = () => {
    setCurrentQuestion((prev) => prev + 1);
  };

  const handleSubmit = () => {
    setQuizSubmitted(true);
  };

  const handleRetry = () => {
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setQuizSubmitted(false);
  };

  const handleBackToList = () => {
    setActiveQuiz(null);
    setQuestions([]);
    setQuizSubmitted(false);
  };

  const current = questions[currentQuestion];

  const score =
    questions.length === 0
      ? 0
      : Math.round(
          (questions.filter((q) => selectedAnswers[q.id] === q.correct_option).length /
            questions.length) *
            100
        );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            Self-Assessment
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Test your knowledge with MCQ practice quizzes.
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
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="px-5 py-4 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
          >
            <Clock className="w-5 h-5 flex-shrink-0 text-amber-400" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-600">{quiz.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {quiz.description || 'No description provided.'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                MCQ
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
                  <button className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                    Edit
                  </button>
                  <button className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                    View Results
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {quizzes.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            No quizzes found.
          </div>
        )}
      </div>

      {activeQuiz && !quizSubmitted && current && (
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

            <div className="space-y-3 mb-8">
              {optionLetters.map((letter) => {
                const optionText = current[`option_${letter.toLowerCase()}` as keyof QuizQuestion] as string;

                return (
                  <label
                    key={letter}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAnswers[current.id] === letter
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
                  disabled={selectedAnswers[current.id] === undefined}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={selectedAnswers[current.id] === undefined}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeQuiz && quizSubmitted && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 font-display">
                You scored {score}%
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {
                  questions.filter((q) => selectedAnswers[q.id] === q.correct_option)
                    .length
                }{' '}
                correct out of {questions.length} questions
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {questions.map((question, index) => {
                const selected = selectedAnswers[question.id];
                const isCorrect = selected === question.correct_option;
                const correctText =
                  question[
                    `option_${question.correct_option.toLowerCase()}` as keyof QuizQuestion
                  ];

                return (
                  <div
                    key={question.id}
                    className={`px-4 py-3 rounded-lg border ${
                      isCorrect
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-800">
                      Q{index + 1}. {question.question}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isCorrect ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {isCorrect
                        ? '✓ Correct'
                        : `✗ Incorrect — Correct answer: ${correctText}`}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToList}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Back to Quizzes
              </button>
              <button
                onClick={handleRetry}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateQuiz && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 font-display mb-3">
              Create Quiz
            </h2>
            <p className="text-sm text-slate-500">
              Quiz creation is not wired to the backend yet.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCreateQuiz(false)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
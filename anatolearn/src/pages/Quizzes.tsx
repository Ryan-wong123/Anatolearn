import { useState } from 'react';
import { CheckCircle, Clock, BookOpen } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

type QuizStatus = 'completed' | 'pending';
type QuizType = 'MCQ' | 'Practical' | 'Mixed';

interface Quiz {
  id: string;
  title: string;
  questions: number;
  minutes: number;
  type: QuizType;
  status: QuizStatus;
  score?: number;
}

const mockQuizzes: Quiz[] = [
  {
    id: 'q1',
    title: 'Muscular System Basics',
    questions: 15,
    minutes: 20,
    type: 'MCQ',
    status: 'completed',
    score: 85,
  },
  {
    id: 'q2',
    title: 'Cardiovascular Anatomy Practical',
    questions: 5,
    minutes: 30,
    type: 'Practical',
    status: 'pending',
  },
  {
    id: 'q3',
    title: 'Respiratory System Review',
    questions: 20,
    minutes: 45,
    type: 'Mixed',
    status: 'pending',
  },
];

const mockQuestions = [
  {
    id: 'ques1',
    text: 'Which muscle is responsible for flexing the elbow?',
    options: ['Triceps Brachii', 'Biceps Brachii', 'Deltoid', 'Pectoralis Major'],
    correct: 1,
  },
  {
    id: 'ques2',
    text: 'What is the primary function of the diaphragm?',
    options: ['Pump blood', 'Breathing', 'Digest food', 'Support the spine'],
    correct: 1,
  },
  {
    id: 'ques3',
    text: 'Which chamber of the heart pumps blood to the body?',
    options: ['Left atrium', 'Right atrium', 'Right ventricle', 'Left ventricle'],
    correct: 3,
  },
];

const typeBadgeStyles: Record<QuizType, string> = {
  MCQ: 'bg-purple-100 text-purple-700',
  Practical: 'bg-indigo-100 text-indigo-700',
  Mixed: 'bg-blue-100 text-blue-700',
};

export default function Quizzes() {
  const { role } = useAppContext();
  const [quizzes] = useState<Quiz[]>(mockQuizzes);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);

  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setQuizSubmitted(false);
  };

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
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
    setQuizSubmitted(false);
  };
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    description: '',
    type: 'MCQ' as QuizType,
    category: 'Musculoskeletal',
   });
  
  const [newQuestions, setNewQuestions] = useState([
    { text: '', options: ['', '', '', ''], correct: 0, questionType: 'MCQ' as 'MCQ' | 'Practical' },
  ]);

  const handleAddQuestion = () => {
    setNewQuestions((prev) => [
      ...prev,
      { text: '', options: ['', '', '', ''], correct: 0, questionType: 'MCQ' as 'MCQ' | 'Practical' },
    ]);
  };

  const handleQuestionChange = (index: number, text: string) => {
    setNewQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, text } : q))
    );
  };

  const handleOptionChange = (qIndex: number, oIndex: number, value: string) => {
    setNewQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) }
          : q
      )
    );
  };

  const handleCorrectChange = (qIndex: number, correct: number) => {
    setNewQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, correct } : q))
    );
  };

  const handleQuestionTypeChange = (qIndex: number, questionType: 'MCQ' | 'Practical') => {
    setNewQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, questionType } : q))
    );
  };

  const handleSaveQuiz = () => {
    // TODO: replace with POST /api/quizzes when backend is ready
    console.log('Quiz to save:', { ...newQuiz, questions: newQuestions });
    setShowCreateQuiz(false);
    setNewQuiz({ title: '', description: '', type: 'MCQ' as QuizType, category: 'Musculoskeletal' });    setNewQuestions([{ text: '', options: ['', '', '', ''], correct: 0 }]);
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

    {/* Page Header */}
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

      {/* Quiz List */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="px-5 py-4 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {/* Status Icon */}
            {quiz.status === 'completed' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-500" />
            ) : (
              <Clock className="w-5 h-5 flex-shrink-0 text-amber-400" />
            )}

            {/* Title + Meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-600">{quiz.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {quiz.questions} questions &nbsp;•&nbsp; {quiz.minutes} mins
              </p>
            </div>

            {/* Right Side: Badge + Action */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeStyles[quiz.type]}`}>
                {quiz.type}
              </span>

              {role === 'student' && (
                quiz.status === 'completed' ? (
                  <span className="text-sm font-semibold text-slate-900">
                    Score: {quiz.score}%
                  </span>
                ) : (
                <button
                    onClick={() => handleStartQuiz(quiz)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Start Quiz
                  </button>
                )
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
      </div>

    {/* Quiz Attempt View */}
      {activeQuiz && !quizSubmitted && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl p-6">

            {/* Quiz Header */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Question {currentQuestion + 1} of {mockQuestions.length}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 font-display">
                {mockQuestions[currentQuestion].text}
              </h2>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-8">
              {mockQuestions[currentQuestion].options.map((option, index) => (
                <label
                  key={index}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAnswers[mockQuestions[currentQuestion].id] === index
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={mockQuestions[currentQuestion].id}
                    checked={selectedAnswers[mockQuestions[currentQuestion].id] === index}
                    onChange={() => handleSelectAnswer(mockQuestions[currentQuestion].id, index)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{option}</span>
                </label>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToList}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>

              {currentQuestion < mockQuestions.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={selectedAnswers[mockQuestions[currentQuestion].id] === undefined}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={selectedAnswers[mockQuestions[currentQuestion].id] === undefined}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    {/* Quiz Results View */}
        {activeQuiz && quizSubmitted && (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl p-6">

                {/* Score Header */}
                <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 font-display">
                    You scored{' '}
                    {Math.round(
                    (mockQuestions.filter(
                        (q) => selectedAnswers[q.id] === q.correct
                    ).length /
                        mockQuestions.length) *
                        100
                    )}%
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    {mockQuestions.filter((q) => selectedAnswers[q.id] === q.correct).length} correct out of {mockQuestions.length} questions
                </p>
                </div>

                {/* Per-Question Feedback */}
                <div className="space-y-3 mb-6">
                {mockQuestions.map((question, index) => {
                    const isCorrect = selectedAnswers[question.id] === question.correct;
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
                        Q{index + 1}. {question.text}
                        </p>
                        <p className={`text-xs mt-1 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                        {isCorrect ? '✓ Correct' : `✗ Incorrect — Correct answer: ${question.options[question.correct]}`}
                        </p>
                    </div>
                    );
                })}
                </div>

                {/* Actions */}
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
        {/* Teacher: Create Quiz Modal */}
      {showCreateQuiz && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <h2 className="text-lg font-semibold text-slate-900 font-display mb-4">
              Create New Quiz
            </h2>

            {/* Quiz Title */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Quiz Title
              </label>
              <input
                type="text"
                value={newQuiz.title}
                onChange={(e) => setNewQuiz((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Muscular System Basics"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Quiz Description */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Description
              </label>
              <input
                type="text"
                value={newQuiz.description}
                onChange={(e) => setNewQuiz((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this quiz"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

                {/* Quiz Type */}
                <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Quiz Type
                </label>
                <select
                    value={newQuiz.type}
                    onChange={(e) => setNewQuiz((prev) => ({ ...prev, type: e.target.value as QuizType }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="MCQ">MCQ (Theory)</option>
                    <option value="Practical">Practical (Open-ended)</option>
                    <option value="Mixed">Mixed</option>
                </select>
                </div>

                {/* Body System Category */}
                <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Body System Category
                </label>
                <select
                    value={newQuiz.category}
                    onChange={(e) => setNewQuiz((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="Musculoskeletal">Musculoskeletal</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Respiratory">Respiratory</option>
                    <option value="Digestive">Digestive</option>
                    <option value="Nervous">Nervous</option>
                    <option value="Endocrine">Endocrine</option>
                </select>
                </div>

            {/* Questions */}
            <div className="space-y-6 mb-6">
              {newQuestions.map((question, qIndex) => (
                <div key={qIndex} className="border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Question {qIndex + 1}
                  </p>

                  {/* Question Text */}
                  <input
                    type="text"
                    value={question.text}
                    onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                    placeholder="Enter question text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 mb-3"
                  />

                  {/* Per-question type toggle — only shown for Mixed quizzes */}
                  {newQuiz.type === 'Mixed' && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-slate-500">Question type:</span>
                      <button
                        onClick={() => handleQuestionTypeChange(qIndex, 'MCQ')}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          question.questionType === 'MCQ'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        MCQ
                      </button>
                      <button
                        onClick={() => handleQuestionTypeChange(qIndex, 'Practical')}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          question.questionType === 'Practical'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        Open-ended
                      </button>
                    </div>
                  )}

                  {/* Options — MCQ */}
                  {(newQuiz.type === 'MCQ' || (newQuiz.type === 'Mixed' && question.questionType === 'MCQ')) && (
                    <div className="space-y-2">
                      {question.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            checked={question.correct === oIndex}
                            onChange={() => handleCorrectChange(qIndex, oIndex)}
                            className="accent-blue-600 flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          {question.correct === oIndex && (
                            <span className="text-xs text-green-600 font-medium flex-shrink-0">
                              Correct
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Open-ended answer — Practical */}
                  {(newQuiz.type === 'Practical' || (newQuiz.type === 'Mixed' && question.questionType === 'Practical')) && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Students will type their answer. Enter the model answer below.
                      </p>
                      <textarea
                        value={question.options[0]}
                        onChange={(e) => handleOptionChange(qIndex, 0, e.target.value)}
                        placeholder="Enter model answer for this question"
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Question Button */}
            <button
              onClick={handleAddQuestion}
              className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors mb-6"
            >
              + Add Another Question
            </button>

            {/* Modal Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowCreateQuiz(false)}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuiz}
                disabled={!newQuiz.title}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Quiz
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
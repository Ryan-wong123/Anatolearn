const controller = require('./assessments.controller');
const { authenticate } = require('../../access');
const { manage } = require('../../middleware/ownership');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.post('/api/quiz-sessions/:id/cancel', authenticate, controller.cancelSession);
    app.put('/api/quiz-sessions/:id/draft', authenticate, controller.saveDraft);
    app.post('/api/quizzes/:id/start', authenticate, controller.startQuiz);
    app.get('/api/quizzes/:id/active', authenticate, controller.resumeQuiz);
    app.post('/api/quizzes/:id/submit', authenticate, controller.submitQuiz);
    app.patch('/api/attempt-answers/:id/grade', authenticate, requireTeacher, manage('answer'), controller.gradeAnswer);
};

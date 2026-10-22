const controller = require('./assessments.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.post('/api/quiz-sessions/:id/cancel', authenticate, controller.cancelSession);
    app.post('/api/quizzes/:id/start', authenticate, controller.startQuiz);
    app.post('/api/quizzes/:id/submit', authenticate, controller.submitQuiz);
    app.patch('/api/attempt-answers/:id/grade', authenticate, requireTeacher, controller.gradeAnswer);
};

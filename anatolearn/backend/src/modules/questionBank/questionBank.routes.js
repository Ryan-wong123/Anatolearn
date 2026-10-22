const controller = require('./questionBank.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.get('/api/question-bank', authenticate, requireTeacher, controller.listQuestions);
    app.post('/api/question-bank/from-question/:id', authenticate, requireTeacher, controller.saveFromQuiz);
    app.put('/api/question-bank/:id', authenticate, requireTeacher, controller.updateQuestion);
    app.delete('/api/question-bank/:id', authenticate, requireTeacher, controller.deleteQuestion);
    app.post('/api/quizzes/:id/bank-questions/:bankId', authenticate, requireTeacher, controller.importIntoQuiz);
};

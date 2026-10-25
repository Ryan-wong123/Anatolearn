const controller = require('./questionBank.controller');
const { authenticate } = require('../../access');
const { manage } = require('../../middleware/ownership');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.get('/api/question-bank', authenticate, requireTeacher, controller.listQuestions);
    app.post('/api/question-bank/from-question/:id', authenticate, requireTeacher, manage('question'), controller.saveFromQuiz);
    app.put('/api/question-bank/:id', authenticate, requireTeacher, manage('bank'), controller.updateQuestion);
    app.delete('/api/question-bank/:id', authenticate, requireTeacher, manage('bank'), controller.deleteQuestion);
    app.post('/api/quizzes/:id/bank-questions/:bankId', authenticate, requireTeacher, manage('quizzes'), manage('bank', 'bankId'), controller.importIntoQuiz);
};

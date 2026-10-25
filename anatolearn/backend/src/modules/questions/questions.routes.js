const controller = require('./questions.controller');
const { authenticate } = require('../../access');
const { manage } = require('../../middleware/ownership');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.post('/api/quizzes/:id/questions', authenticate, requireTeacher, manage('quizzes'), controller.createQuestion);
    app.put('/api/questions/:id', authenticate, requireTeacher, manage('question'), controller.updateQuestion);
    app.delete('/api/questions/:id', authenticate, requireTeacher, manage('question'), controller.deleteQuestion);
};

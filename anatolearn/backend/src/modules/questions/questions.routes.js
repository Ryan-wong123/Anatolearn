const controller = require('./questions.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.post('/api/quizzes/:id/questions', authenticate, requireTeacher, controller.createQuestion);
    app.put('/api/questions/:id', authenticate, requireTeacher, controller.updateQuestion);
    app.delete('/api/questions/:id', authenticate, requireTeacher, controller.deleteQuestion);
};

const controller = require('./ownership.controller');
const { authenticate } = require('../../access');
const { requireTeacher, requireAdmin } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    // kind: models, videos, quizzes, resources, question-bank or announcements
    app.post('/api/:kind/:id/claim', authenticate, requireTeacher, controller.claim);
    app.post('/api/users/:id/transfer-content', authenticate, requireAdmin, controller.transferContent);
    app.post('/api/content/assign-unclaimed', authenticate, requireAdmin, controller.assignUnclaimed);
};

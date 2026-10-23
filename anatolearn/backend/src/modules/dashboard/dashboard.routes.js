const controller = require('./dashboard.controller');
const { authenticate } = require('../../access');
const { requireStudent, requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.get('/api/dashboard', authenticate, controller.getDashboard);
    app.get('/api/students/me/stats', authenticate, requireStudent, controller.getMyStats);
    app.get('/api/teacher/overview', authenticate, requireTeacher, controller.getTeacherOverview);
};

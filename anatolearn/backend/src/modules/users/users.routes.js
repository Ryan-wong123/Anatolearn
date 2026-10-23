const controller = require('./users.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.get('/api/users', authenticate, requireTeacher, controller.listUsers);
    app.post('/api/users', authenticate, requireTeacher, controller.createUser);
    app.patch('/api/users/:id', authenticate, requireTeacher, controller.updateUser);
    app.post('/api/users/:id/reset-password', authenticate, requireTeacher, controller.resetPassword);
    app.delete('/api/users/:id', authenticate, requireTeacher, controller.deleteUser);
    app.get('/api/audit-log', authenticate, requireTeacher, controller.listAuditLog);
};

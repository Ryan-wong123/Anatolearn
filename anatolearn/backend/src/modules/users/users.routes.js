const controller = require('./users.controller');
const { authenticate } = require('../../access');
const { requireAdmin } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.get('/api/users', authenticate, requireAdmin, controller.listUsers);
    app.post('/api/users', authenticate, requireAdmin, controller.createUser);
    app.patch('/api/users/:id', authenticate, requireAdmin, controller.updateUser);
    app.post('/api/users/:id/reset-password', authenticate, requireAdmin, controller.resetPassword);
    app.post('/api/users/:id/reset-mfa', authenticate, requireAdmin, controller.resetMfa);
    app.delete('/api/users/:id', authenticate, requireAdmin, controller.deleteUser);
    app.get('/api/audit-log', authenticate, requireAdmin, controller.listAuditLog);
};

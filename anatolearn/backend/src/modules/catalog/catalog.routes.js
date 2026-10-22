const controller = require('./catalog.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.patch('/api/:kind/:id/program', authenticate, requireTeacher, controller.assignProgram);
};

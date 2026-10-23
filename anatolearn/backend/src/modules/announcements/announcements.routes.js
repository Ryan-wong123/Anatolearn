const controller = require('./announcements.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.get('/api/announcements', authenticate, controller.listAnnouncements);
    app.post('/api/announcements', authenticate, requireTeacher, controller.createAnnouncement);
    app.put('/api/announcements/:id', authenticate, requireTeacher, controller.updateAnnouncement);
    app.delete('/api/announcements/:id', authenticate, requireTeacher, controller.deleteAnnouncement);
};

const controller = require('./annotations.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.get("/api/models/:id/annotations", authenticate, controller.listForModel);
    app.get("/api/models/:id/annotations/export", authenticate, requireTeacher, controller.exportAnnotations);
    app.post("/api/models/:id/annotations", authenticate, requireTeacher, controller.createAnnotation);
    app.delete("/api/annotations/:id", authenticate, requireTeacher, controller.deleteAnnotation);
    app.put("/api/annotations/:id", authenticate, requireTeacher, controller.updateAnnotation);
    app.get("/api/annotations", authenticate, requireTeacher, controller.listAll);
};

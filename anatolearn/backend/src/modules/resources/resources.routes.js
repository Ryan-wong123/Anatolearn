const controller = require('./resources.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
const { uploadResource, cleanupFailedUpload } = require('../../middleware/uploads');
module.exports = function registerRoutes(app) {
    app.get("/api/resources", authenticate, controller.listResources);
    app.post("/api/resources/upload", authenticate, requireTeacher, uploadResource.single("file"), cleanupFailedUpload, controller.uploadResource);
    app.delete("/api/resources/:id", authenticate, requireTeacher, controller.deleteResource);
    app.put("/api/resources/:id", authenticate, requireTeacher, controller.updateResource);
    app.patch("/api/resources/:id/publish", authenticate, requireTeacher, controller.setPublication);
};

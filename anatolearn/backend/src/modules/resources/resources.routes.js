const controller = require('./resources.controller');
const { authenticate } = require('../../access');
const { manage } = require('../../middleware/ownership');
const { requireTeacher } = require('../../middleware/roles');
const { uploadResource, cleanupFailedUpload } = require('../../middleware/uploads');
const { enforceQuota } = require('../../quota');
module.exports = function registerRoutes(app) {
    app.get("/api/resources", authenticate, controller.listResources);
    app.post("/api/resources/upload", authenticate, requireTeacher, enforceQuota, uploadResource.single("file"), cleanupFailedUpload, controller.uploadResource);
    app.delete("/api/resources/:id", authenticate, requireTeacher, manage('resources'), controller.deleteResource);
    app.put("/api/resources/:id", authenticate, requireTeacher, manage('resources'), controller.updateResource);
    app.patch("/api/resources/:id/publish", authenticate, requireTeacher, manage('resources'), controller.setPublication);
};

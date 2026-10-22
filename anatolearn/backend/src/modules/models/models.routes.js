const controller = require('./models.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
const { uploadModel, cleanupFailedUpload } = require('../../middleware/uploads');
module.exports = function registerRoutes(app) {
    app.patch('/api/models/:id/download-permission', authenticate, requireTeacher, controller.setDownloadPermission);
    app.get("/api/models", authenticate, controller.listModels);
    app.get("/api/models/:id", authenticate, controller.getModel);
    app.post("/api/models/upload", authenticate, requireTeacher, uploadModel.single("model"), cleanupFailedUpload, controller.uploadModel);
    app.delete("/api/models/:id", authenticate, requireTeacher, controller.deleteModel);
    app.patch("/api/models/:id/publish", authenticate, requireTeacher, controller.setPublication);
    app.patch("/api/models/:id/neutral-view", authenticate, requireTeacher, controller.saveNeutralView);
    app.put("/api/models/:id", authenticate, requireTeacher, controller.updateModel);
    app.get("/api/models/:id/download", authenticate, controller.downloadModel);
    app.patch("/api/models/:id/thumbnail", authenticate, requireTeacher, controller.saveThumbnail);
};

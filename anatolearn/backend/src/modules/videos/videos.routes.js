const controller = require('./videos.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
const { uploadVideoAndCaptions, cleanupFailedUpload } = require('../../middleware/uploads');
module.exports = function registerRoutes(app) {
    app.get("/api/videos", authenticate, controller.listVideos);
    app.get("/api/videos/:id", authenticate, controller.getVideo);
    app.post("/api/videos/upload", authenticate, requireTeacher, uploadVideoAndCaptions, cleanupFailedUpload, controller.uploadVideo);
    app.post('/api/videos/:id/captions', authenticate, requireTeacher, uploadVideoAndCaptions, cleanupFailedUpload, controller.replaceCaptions);
    app.delete('/api/videos/:id/captions', authenticate, requireTeacher, controller.removeCaptions);
    app.delete("/api/videos/:id", authenticate, requireTeacher, controller.deleteVideo);
    app.patch("/api/videos/:id/publish", authenticate, requireTeacher, controller.setPublication);
    app.put("/api/videos/:id", authenticate, requireTeacher, controller.updateVideo);
};

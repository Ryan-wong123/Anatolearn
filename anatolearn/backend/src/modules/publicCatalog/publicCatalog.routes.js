const controller = require('./publicCatalog.controller');
module.exports = function registerRoutes(app) {
    app.get("/api/health", controller.health);
    app.get("/api/programs", controller.listPrograms);
};

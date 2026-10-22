const controller = require('./favorites.controller');
const { authenticate } = require('../../access');
const { requireStudent } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.get("/api/favorites", authenticate, requireStudent, controller.listFavorites);
    app.post("/api/favorites", authenticate, requireStudent, controller.addFavorite);
    app.delete("/api/favorites/:item_type/:item_id", authenticate, requireStudent, controller.removeFavorite);
};

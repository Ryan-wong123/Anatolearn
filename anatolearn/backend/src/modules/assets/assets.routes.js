const controller = require('./assets.controller');
const { authenticate } = require('../../access');
module.exports = function registerRoutes(app) {
    app.get(['/models/*', '/videos/*', '/resources/*', '/thumbnails/*', '/captions/*'], authenticate, controller.getTeachingAsset);
};

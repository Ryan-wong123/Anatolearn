const controller = require('./search.controller');
const { authenticate } = require('../../access');
module.exports = function registerRoutes(app) {
    app.get('/api/search', authenticate, controller.search);
};

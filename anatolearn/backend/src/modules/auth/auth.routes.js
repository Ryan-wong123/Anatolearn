const controller = require('./auth.controller');
module.exports = function registerRoutes(app) {
    app.post("/api/auth/register", controller.register);
    app.post("/api/auth/login", controller.login);
    app.post('/api/auth/mfa/verify', controller.verifyMfa);
    app.post('/api/auth/logout', controller.logout);
};

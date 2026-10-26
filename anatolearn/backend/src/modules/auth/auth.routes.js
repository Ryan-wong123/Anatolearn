const controller = require('./auth.controller');
const passkeys = require('../passkeys/passkeys.controller');
module.exports = function registerRoutes(app) {
    app.post("/api/auth/register", controller.register);
    app.post("/api/auth/login", controller.login);
    app.post('/api/auth/mfa/verify', controller.verifyMfa);
    // The passkey second factor is public like the code check: it is gated by the short-lived challenge token from login.
    app.post('/api/auth/mfa/passkey/options', passkeys.signInOptions);
    app.post('/api/auth/mfa/passkey/verify', passkeys.signInVerify);
    app.post('/api/auth/logout', controller.logout);
};

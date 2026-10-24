const controller = require('./profile.controller');
const { authenticate } = require('../../access');
module.exports = function registerRoutes(app) {
    app.get('/api/profile', authenticate, controller.getProfile);
    app.put('/api/profile', authenticate, controller.updateProfile);
    app.put('/api/profile/password', authenticate, controller.changePassword);
    app.get('/api/profile/export', authenticate, controller.exportData);
    app.post('/api/profile/mfa/setup', authenticate, controller.setupMfa);
    app.post('/api/profile/mfa/enable', authenticate, controller.enableMfa);
    app.post('/api/profile/mfa/disable', authenticate, controller.disableMfa);
    app.post('/api/profile/mfa/recovery-codes', authenticate, controller.regenerateRecoveryCodes);
    app.delete('/api/profile', authenticate, controller.deleteAccount);
};

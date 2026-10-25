const controller = require('./passkeys.controller');
const { authenticate } = require('../../access');
module.exports = function registerRoutes(app) {
    app.get('/api/profile/passkeys', authenticate, controller.list);
    app.post('/api/profile/passkeys/options', authenticate, controller.registrationOptions);
    app.post('/api/profile/passkeys', authenticate, controller.register);
    app.delete('/api/profile/passkeys/:id', authenticate, controller.remove);
};

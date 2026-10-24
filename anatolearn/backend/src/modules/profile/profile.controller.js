const service = require('./profile.service');
const { controller } = require('../../http/controller');
module.exports = {
    getProfile: controller(service.getProfile),
    updateProfile: controller(service.updateProfile),
    changePassword: controller(service.changePassword),
    exportData: controller(service.exportData),
    deleteAccount: controller(service.deleteAccount),
    setupMfa: controller(service.setupMfa),
    enableMfa: controller(service.enableMfa),
    disableMfa: controller(service.disableMfa),
    regenerateRecoveryCodes: controller(service.regenerateRecoveryCodes),
};

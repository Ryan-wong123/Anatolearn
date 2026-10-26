const service = require('./passkeys.service');
const { controller } = require('../../http/controller');
module.exports = {
    list: controller(service.list),
    registrationOptions: controller(service.registrationOptions),
    register: controller(service.register),
    remove: controller(service.remove),
    signInOptions: controller(service.signInOptions),
    signInVerify: controller(service.signInVerify),
};

const service = require('./auth.service');
const { controller } = require('../../http/controller');
module.exports = {
    register: controller(service.register),
    login: controller(service.login),
    logout: controller(service.logout),
    verifyMfa: controller(service.verifyMfa),
};

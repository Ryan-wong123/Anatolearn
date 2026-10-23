const service = require('./users.service');
const { controller } = require('../../http/controller');
module.exports = {
    listUsers: controller(service.listUsers),
    createUser: controller(service.createUser),
    updateUser: controller(service.updateUser),
    resetPassword: controller(service.resetPassword),
    deleteUser: controller(service.deleteUser),
    listAuditLog: controller(service.listAuditLog),
};

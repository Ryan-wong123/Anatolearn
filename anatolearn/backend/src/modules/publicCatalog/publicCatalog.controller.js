const service = require('./publicCatalog.service');
const { controller } = require('../../http/controller');
module.exports = {
    health: controller(service.health),
    listPrograms: controller(service.listPrograms),
};

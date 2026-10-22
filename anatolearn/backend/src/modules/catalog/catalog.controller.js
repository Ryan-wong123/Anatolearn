const service = require('./catalog.service');
const { controller } = require('../../http/controller');
module.exports = {
    assignProgram: controller(service.assignProgram),
};

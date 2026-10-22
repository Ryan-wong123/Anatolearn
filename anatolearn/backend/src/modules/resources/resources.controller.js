const service = require('./resources.service');
const { controller } = require('../../http/controller');
module.exports = {
    listResources: controller(service.listResources),
    uploadResource: controller(service.uploadResource),
    deleteResource: controller(service.deleteResource),
    updateResource: controller(service.updateResource),
    setPublication: controller(service.setPublication),
};

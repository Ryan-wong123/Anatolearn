const service = require('./annotations.service');
const { controller } = require('../../http/controller');
module.exports = {
    listForModel: controller(service.listForModel),
    exportAnnotations: controller(service.exportAnnotations),
    createAnnotation: controller(service.createAnnotation),
    deleteAnnotation: controller(service.deleteAnnotation),
    updateAnnotation: controller(service.updateAnnotation),
    listAll: controller(service.listAll),
};

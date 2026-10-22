const service = require('./models.service');
const { controller } = require('../../http/controller');
module.exports = {
    setDownloadPermission: controller(service.setDownloadPermission),
    listModels: controller(service.listModels),
    getModel: controller(service.getModel),
    uploadModel: controller(service.uploadModel),
    deleteModel: controller(service.deleteModel),
    setPublication: controller(service.setPublication),
    saveNeutralView: controller(service.saveNeutralView),
    updateModel: controller(service.updateModel),
    downloadModel: controller(service.downloadModel),
    saveThumbnail: controller(service.saveThumbnail),
};

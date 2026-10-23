const service = require('./videos.service');
const { controller } = require('../../http/controller');
module.exports = {
    listVideos: controller(service.listVideos),
    getVideo: controller(service.getVideo),
    saveProgress: controller(service.saveProgress),
    uploadVideo: controller(service.uploadVideo),
    replaceCaptions: controller(service.replaceCaptions),
    removeCaptions: controller(service.removeCaptions),
    deleteVideo: controller(service.deleteVideo),
    setPublication: controller(service.setPublication),
    updateVideo: controller(service.updateVideo),
};

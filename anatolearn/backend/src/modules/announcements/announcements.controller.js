const service = require('./announcements.service');
const { controller } = require('../../http/controller');
module.exports = {
    listAnnouncements: controller(service.listAnnouncements),
    createAnnouncement: controller(service.createAnnouncement),
    updateAnnouncement: controller(service.updateAnnouncement),
    deleteAnnouncement: controller(service.deleteAnnouncement),
};

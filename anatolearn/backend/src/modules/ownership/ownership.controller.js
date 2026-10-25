const service = require('./ownership.service');
const { controller } = require('../../http/controller');
module.exports = {
    claim: controller(service.claim),
    transferContent: controller(service.transferContent),
    assignUnclaimed: controller(service.assignUnclaimed),
};

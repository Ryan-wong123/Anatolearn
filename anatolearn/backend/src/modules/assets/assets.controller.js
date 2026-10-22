const service = require('./assets.service');
const { controller } = require('../../http/controller');
module.exports = {
    getTeachingAsset: controller(service.getTeachingAsset),
};

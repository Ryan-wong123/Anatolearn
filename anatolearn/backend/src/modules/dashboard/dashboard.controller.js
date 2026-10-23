const service = require('./dashboard.service');
const { controller } = require('../../http/controller');
module.exports = {
    getDashboard: controller(service.getDashboard),
    getMyStats: controller(service.getMyStats),
    getTeacherOverview: controller(service.getTeacherOverview),
};

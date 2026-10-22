const service = require('./questions.service');
const { controller } = require('../../http/controller');
module.exports = {
    createQuestion: controller(service.createQuestion),
    updateQuestion: controller(service.updateQuestion),
    deleteQuestion: controller(service.deleteQuestion),
};

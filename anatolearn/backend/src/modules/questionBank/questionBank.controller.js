const service = require('./questionBank.service');
const { controller } = require('../../http/controller');
module.exports = {
    listQuestions: controller(service.listQuestions),
    saveFromQuiz: controller(service.saveFromQuiz),
    updateQuestion: controller(service.updateQuestion),
    deleteQuestion: controller(service.deleteQuestion),
    importIntoQuiz: controller(service.importIntoQuiz),
};

const service = require('./assessments.service');
const { controller } = require('../../http/controller');
module.exports = {
    cancelSession: controller(service.cancelSession),
    startQuiz: controller(service.startQuiz),
    submitQuiz: controller(service.submitQuiz),
    gradeAnswer: controller(service.gradeAnswer),
};

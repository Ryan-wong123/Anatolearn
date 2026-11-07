const service = require('./assessments.service');
const { controller } = require('../../http/controller');
module.exports = {
    cancelSession: controller(service.cancelSession),
    saveDraft: controller(service.saveDraft),
    startQuiz: controller(service.startQuiz),
    resumeQuiz: controller(service.resumeQuiz),
    submitQuiz: controller(service.submitQuiz),
    gradeAnswer: controller(service.gradeAnswer),
};

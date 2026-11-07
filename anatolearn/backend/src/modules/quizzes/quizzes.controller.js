const service = require('./quizzes.service');
const editorService = require('./editor.service');
const { controller } = require('../../http/controller');
module.exports = {
    setTimer: controller(service.setTimer),
    listQuizzes: controller(service.listQuizzes),
    listQuestions: controller(service.listQuestions),
    createQuiz: controller(service.createQuiz),
    commitQuizEditor: controller(editorService.commitQuizEditor),
    updateQuiz: controller(service.updateQuiz),
    deleteQuiz: controller(service.deleteQuiz),
    setType: controller(service.setType),
    setPublication: controller(service.setPublication),
    listAttempts: controller(service.listAttempts),
    listPendingAttempts: controller(service.listPendingAttempts),
    listMyAttempts: controller(service.listMyAttempts),
    getAttemptAnswers: controller(service.getAttemptAnswers),
    getAttempt: controller(service.getAttempt),
};

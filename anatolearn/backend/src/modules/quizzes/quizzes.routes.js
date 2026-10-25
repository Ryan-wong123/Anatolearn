const controller = require('./quizzes.controller');
const { authenticate } = require('../../access');
const { manage } = require('../../middleware/ownership');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.patch('/api/quizzes/:id/timer', authenticate, requireTeacher, manage('quizzes'), controller.setTimer);
    app.get("/api/quizzes", authenticate, controller.listQuizzes);
    app.get("/api/quizzes/:id/questions", authenticate, controller.listQuestions);
    app.post("/api/quizzes", authenticate, requireTeacher, controller.createQuiz);
    app.put("/api/quizzes/:id", authenticate, requireTeacher, manage('quizzes'), controller.updateQuiz);
    app.delete("/api/quizzes/:id", authenticate, requireTeacher, manage('quizzes'), controller.deleteQuiz);
    app.patch("/api/quizzes/:id/type", authenticate, requireTeacher, manage('quizzes'), controller.setType);
    app.patch("/api/quizzes/:id/publish", authenticate, requireTeacher, manage('quizzes'), controller.setPublication);
    app.get('/api/quizzes/:id/attempts', authenticate, requireTeacher, manage('quizzes'), controller.listAttempts);
    app.get("/api/quizzes/:id/attempts/pending", authenticate, requireTeacher, manage('quizzes'), controller.listPendingAttempts);
    app.get("/api/students/me/attempts", authenticate, controller.listMyAttempts);
    app.get("/api/attempts/:id/answers", authenticate, controller.getAttemptAnswers);
    app.get("/api/attempts/:id", authenticate, controller.getAttempt);
};

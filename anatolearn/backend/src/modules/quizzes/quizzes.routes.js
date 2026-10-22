const controller = require('./quizzes.controller');
const { authenticate } = require('../../access');
const { requireTeacher } = require('../../middleware/roles');
module.exports = function registerRoutes(app) {
    app.patch('/api/quizzes/:id/timer', authenticate, requireTeacher, controller.setTimer);
    app.get("/api/quizzes", authenticate, controller.listQuizzes);
    app.get("/api/quizzes/:id/questions", authenticate, controller.listQuestions);
    app.post("/api/quizzes", authenticate, requireTeacher, controller.createQuiz);
    app.put("/api/quizzes/:id", authenticate, requireTeacher, controller.updateQuiz);
    app.delete("/api/quizzes/:id", authenticate, requireTeacher, controller.deleteQuiz);
    app.patch("/api/quizzes/:id/type", authenticate, requireTeacher, controller.setType);
    app.patch("/api/quizzes/:id/publish", authenticate, requireTeacher, controller.setPublication);
    app.get('/api/quizzes/:id/attempts', authenticate, requireTeacher, controller.listAttempts);
    app.get("/api/quizzes/:id/attempts/pending", authenticate, requireTeacher, controller.listPendingAttempts);
    app.get("/api/students/me/attempts", authenticate, controller.listMyAttempts);
    app.get("/api/attempts/:id/answers", authenticate, controller.getAttemptAnswers);
    app.get("/api/attempts/:id", authenticate, controller.getAttempt);
};

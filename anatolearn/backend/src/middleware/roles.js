function requireTeacher(req, res, next) {
    if (!req.user || req.user.role !== "teacher") {
        return res.status(403).json({ message: "Teacher access required" });
    }
    next();
}
function requireStudent(req, res, next) {
    if (!req.user || req.user.role !== "student") {
        return res.status(403).json({ message: "Student access required" });
    }
    next();
}
module.exports = { requireTeacher, requireStudent };

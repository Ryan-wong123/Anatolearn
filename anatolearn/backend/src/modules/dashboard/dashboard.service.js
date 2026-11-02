const cache = require('../../cache');
const repository = require('./dashboard.repository');
const announcements = require('../announcements/announcements.repository');
const { visibleRows } = require('../catalog/catalog.service');
const meta = () => ({ headers: { 'Cache-Control': 'no-store' }, cookies: [] });

async function loadStudentStats(userId) {
    const [summary, progress, weak] = await Promise.all([
        repository.attemptSummary([userId]), repository.quizProgress([userId]), repository.weakAreas([userId]),
    ]);
    return { summary: summary.rows[0], quizzes: progress.rows, categories: weak.rows };
}
function studentStats(userId) {
    return cache.remember('stats', ['student', userId], 30, () => loadStudentStats(userId));
}
function teacherOverview(userId) {
    return cache.remember('stats', ['teacher', userId], 30, () => repository.teacherOverview([userId]));
}
async function getMyStats(input) {
    return { ...meta(), status: 200, kind: 'json', body: await studentStats(input.user.id) };
}
async function getDashboard(input) {
    if (input.user.role === 'admin') return { ...meta(), status: 200, kind: 'json', body: { role: 'admin' } };
    if (input.user.role === 'teacher') {
        return { ...meta(), status: 200, kind: 'json', body: { role: 'teacher', ...(await teacherOverview(input.user.id)),
            announcements: (await announcements.listAll()).rows.slice(0, 5) } };
    }
    const [recent, counts, news, stats] = await Promise.all([
        repository.recentActivity([input.user.id]), repository.counts([input.user.program_id]),
        announcements.listForStudent([input.user.program_id]), studentStats(input.user.id),
    ]);
    const visible = (await visibleRows({ ...input, headers: {} }, recent.rows)).slice(0, 6).map(({ is_published, program_id, ...rest }) => rest);
    return { ...meta(), status: 200, kind: 'json', body: { role: 'student', recent: visible, counts: counts.rows[0], announcements: news.rows.slice(0, 5), ...stats } };
}
async function getTeacherOverview(input) {
    return { ...meta(), status: 200, kind: 'json', body: await teacherOverview(input.user.id) };
}
module.exports = { getDashboard, getMyStats, getTeacherOverview };

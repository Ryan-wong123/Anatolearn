const pool = require('../../db');
async function recentActivity(parameters) {
    return pool.query(`SELECT * FROM (
        SELECT 'model' AS item_type, m.id, m.title, a.last_viewed_at, m.is_published, m.program_id FROM user_activity a JOIN models m ON m.id = a.item_id WHERE a.user_id = $1 AND a.item_type = 'model'
        UNION ALL SELECT 'video', v.id, v.title, a.last_viewed_at, v.is_published, v.program_id FROM user_activity a JOIN videos v ON v.id = a.item_id WHERE a.user_id = $1 AND a.item_type = 'video'
        UNION ALL SELECT 'quiz', q.id, q.title, a.last_viewed_at, q.is_published, q.program_id FROM user_activity a JOIN quizzes q ON q.id = a.item_id WHERE a.user_id = $1 AND a.item_type = 'quiz'
        UNION ALL SELECT 'resource', r.id, r.title, a.last_viewed_at, r.is_published, r.program_id FROM user_activity a JOIN resources r ON r.id = a.item_id WHERE a.user_id = $1 AND a.item_type = 'resource'
      ) recent ORDER BY last_viewed_at DESC LIMIT 12`, parameters);
}
async function quizProgress(parameters) {
    return pool.query(`SELECT q.id AS quiz_id, q.title, q.category, COUNT(*)::int AS attempts,
        MAX(t.score) AS best_score,
        (ARRAY_AGG(t.score ORDER BY t.attempted_at DESC) FILTER (WHERE t.score IS NOT NULL))[1] AS latest_score,
        COALESCE((ARRAY_AGG(t.score ORDER BY t.attempted_at) FILTER (WHERE t.score IS NOT NULL))[GREATEST(1, COUNT(t.score)::int - 9):], '{}') AS recent_scores,
        MAX(t.attempted_at) AS last_attempted_at,
        COUNT(*) FILTER (WHERE t.status = 'pending_review')::int AS pending_review
      FROM quiz_attempts t JOIN quizzes q ON q.id = t.quiz_id WHERE t.student_id = $1 GROUP BY q.id ORDER BY MAX(t.attempted_at) DESC`, parameters);
}
async function weakAreas(parameters) {
    return pool.query(`SELECT COALESCE(NULLIF(qq.category, ''), NULLIF(q.category, ''), 'General') AS category, COUNT(*)::int AS answered,
        ROUND(100 * AVG(CASE WHEN a.teacher_score IS NOT NULL THEN a.teacher_score / 100.0 WHEN a.is_correct THEN 1.0 ELSE 0.0 END))::int AS accuracy
      FROM quiz_attempt_answers a JOIN quiz_attempts t ON t.id = a.attempt_id JOIN quiz_questions qq ON qq.id = a.question_id JOIN quizzes q ON q.id = t.quiz_id
      WHERE t.student_id = $1 AND (a.teacher_score IS NOT NULL OR a.is_correct IS NOT NULL) GROUP BY 1 ORDER BY accuracy ASC, answered DESC`, parameters);
}
async function attemptSummary(parameters) {
    return pool.query(`SELECT COUNT(*)::int AS attempts, COUNT(DISTINCT quiz_id)::int AS quizzes_taken, ROUND(AVG(score))::int AS average_score, MAX(score) AS best_score
      FROM quiz_attempts WHERE student_id = $1 AND score IS NOT NULL`, parameters);
}
async function counts(parameters) {
    return pool.query(`SELECT (SELECT count(*)::int FROM models WHERE is_published AND (program_id IS NULL OR program_id = $1)) AS models,
      (SELECT count(*)::int FROM videos WHERE is_published AND (program_id IS NULL OR program_id = $1)) AS videos,
      (SELECT count(*)::int FROM quizzes WHERE is_published AND (program_id IS NULL OR program_id = $1)) AS quizzes,
      (SELECT count(*)::int FROM resources WHERE is_published AND (program_id IS NULL OR program_id = $1)) AS resources`, parameters);
}
async function teacherOverview() {
    const [totals, pending, recent, byQuiz] = await Promise.all([
        pool.query(`SELECT (SELECT count(*)::int FROM users WHERE role = 'student' AND is_active) AS students,
          (SELECT count(*)::int FROM users WHERE role = 'teacher' AND is_active) AS teachers,
          (SELECT count(*)::int FROM models) AS models, (SELECT count(*)::int FROM videos) AS videos,
          (SELECT count(*)::int FROM quizzes) AS quizzes, (SELECT count(*)::int FROM resources) AS resources,
          (SELECT count(*)::int FROM models WHERE NOT is_published) + (SELECT count(*)::int FROM videos WHERE NOT is_published)
            + (SELECT count(*)::int FROM quizzes WHERE NOT is_published) + (SELECT count(*)::int FROM resources WHERE NOT is_published) AS unpublished,
          (SELECT count(*)::int FROM quiz_attempts WHERE attempted_at > NOW() - INTERVAL '7 days') AS attempts_this_week`),
        pool.query("SELECT count(*)::int AS n FROM quiz_attempts WHERE status = 'pending_review'"),
        pool.query(`SELECT t.id, t.score, t.status, t.attempted_at, q.title AS quiz_title, q.id AS quiz_id, u.name AS student_name FROM quiz_attempts t
          JOIN quizzes q ON q.id = t.quiz_id LEFT JOIN users u ON u.id = t.student_id ORDER BY t.attempted_at DESC LIMIT 10`),
        pool.query(`SELECT q.id AS quiz_id, q.title, COUNT(t.id)::int AS attempts, ROUND(AVG(t.score))::int AS average_score FROM quizzes q
          JOIN quiz_attempts t ON t.quiz_id = q.id GROUP BY q.id ORDER BY COUNT(t.id) DESC LIMIT 8`),
    ]);
    return { totals: totals.rows[0], pending_review: pending.rows[0].n, recent_attempts: recent.rows, quiz_performance: byQuiz.rows };
}
module.exports = { recentActivity, quizProgress, weakAreas, attemptSummary, counts, teacherOverview };

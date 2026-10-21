const { randomUUID } = require('crypto');
const { canRead } = require('./access');
const { SESSION_LIFETIME_HOURS } = require('./maintenance');

function validateAnswers(questions, answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) return false;
  const ids = new Set();
  return answers.every((answer) => {
    const question = questions.find((item) => item.id === answer.question_id);
    if (!question || ids.has(answer.question_id)) return false;
    ids.add(answer.question_id);
    return question.format === 'mcq'
      ? answer.selected_option == null || ['A','B','C','D'].includes(answer.selected_option)
      : answer.answer_text == null || (typeof answer.answer_text === 'string' && answer.answer_text.length <= 20000);
  });
}

function registerAssessments(app, pool, authenticate, requireTeacher) {
  app.post('/api/quiz-sessions/:id/cancel', authenticate, async (req,res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.sendStatus(400);
    await pool.query('UPDATE quiz_sessions SET submitted_at=NOW() WHERE id=$1 AND student_id=$2 AND submitted_at IS NULL',[req.params.id,req.user.id]);
    res.json({message:'Session closed'});
  });
  app.post('/api/quizzes/:id/start', authenticate, async (req, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const quiz = (await client.query('SELECT * FROM quizzes WHERE id=$1 FOR SHARE', [req.params.id])).rows[0];
      if (!quiz || !canRead(req.user, quiz)) { await client.query('ROLLBACK'); return res.sendStatus(404); }
      const questions = (await client.query('SELECT * FROM quiz_questions WHERE quiz_id=$1 ORDER BY id', [quiz.id])).rows;
      if (!questions.length) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'This quiz has no questions' }); }
      const id = randomUUID();
      const result = await client.query(`INSERT INTO quiz_sessions (id,quiz_id,student_id,expires_at,questions,session_expires_at)
        VALUES ($1,$2,$3,CASE WHEN $4::int IS NULL THEN NULL ELSE NOW()+$4*INTERVAL '1 second' END,$5,NOW()+GREATEST($6::int*3600,COALESCE($4,0)+10)*INTERVAL '1 second') RETURNING *, NOW() AS server_now`,
        [id, quiz.id, req.user.id, quiz.time_limit_seconds, JSON.stringify(questions), SESSION_LIFETIME_HOURS]);
      await client.query('COMMIT');
      res.json({ session_id: id, expires_at: result.rows[0].expires_at, server_now: result.rows[0].server_now, session_expires_at: result.rows[0].session_expires_at,
        questions: questions.map(({ correct_option, model_answer, ...question }) => question) });
    } catch(error) { await client.query('ROLLBACK');throw error; }
    finally { client.release(); }
  });

  app.post('/api/quizzes/:id/submit', authenticate, async (req, res) => {
    if (req.user.role !== 'student') return res.sendStatus(403);
    if (typeof req.body.session_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(req.body.session_id))
      return res.status(400).json({ message: 'Start the quiz before submitting' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const session = (await client.query('SELECT *, NOW() AS server_now FROM quiz_sessions WHERE id=$1 AND quiz_id=$2 AND student_id=$3 FOR UPDATE',
        [req.body.session_id, req.params.id, req.user.id])).rows[0];
      if (!session || session.submitted_at) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Quiz session is unavailable or already submitted' });
      }
      // A short transport grace allows the automatic timeout submission to arrive.
      if (new Date(session.server_now) >= new Date(session.session_expires_at) || (session.expires_at && new Date(session.server_now) > new Date(session.expires_at).getTime() + 10000)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Quiz time limit has expired. Start a new attempt.' });
      }
      const questions = session.questions;
      if (!validateAnswers(questions, req.body.answers)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Submit each session question exactly once with a valid answer' });
      }
      const answers = req.body.answers.map((answer) => {
        const question = questions.find((item) => item.id === answer.question_id);
        return { ...answer, is_correct: question.format === 'mcq' ? question.correct_option === answer.selected_option : null };
      });
      const openCount = questions.filter((q) => q.format === 'open_ended').length;
      const correct = answers.filter((a) => a.is_correct).length;
      const status = openCount ? 'pending_review' : 'graded';
      const score = openCount ? null : Math.round(correct / questions.length * 100);
      const attempt = (await client.query(`INSERT INTO quiz_attempts(quiz_id,student_id,score,total_questions,correct_count,status)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [req.params.id, req.user.id, score, questions.length, openCount ? null : correct, status])).rows[0];
      for (const answer of answers) await client.query(`INSERT INTO quiz_attempt_answers(attempt_id,question_id,selected_option,answer_text,is_correct)
        VALUES($1,$2,$3,$4,$5)`, [attempt.id, answer.question_id, answer.selected_option || null, answer.answer_text || null, answer.is_correct]);
      await client.query('UPDATE quiz_sessions SET submitted_at=NOW() WHERE id=$1', [session.id]);
      await client.query('COMMIT');
      res.json({ attempt, status, score, total: questions.length, correct: openCount ? null : correct,
        incorrect: openCount ? null : questions.length-correct, mcq_count: questions.length-openCount, open_ended_count: openCount,
        feedback: answers.filter((a) => a.is_correct !== null).map((a) => ({ ...a,
          correct_option: questions.find((q) => q.id === a.question_id).correct_option })) });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });

  app.patch('/api/attempt-answers/:id/grade', authenticate, requireTeacher, async (req, res) => {
    const score = req.body.teacher_score;
    if (!Number.isFinite(score) || score < 0 || score > 100) return res.status(400).json({ message: 'Score must be 0–100' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const answer = (await client.query(`SELECT a.*,q.format FROM quiz_attempt_answers a JOIN quiz_questions q ON q.id=a.question_id WHERE a.id=$1`, [req.params.id])).rows[0];
      if (!answer || answer.format !== 'open_ended') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Only open-ended answers can be manually graded' });
      }
      await client.query('SELECT id FROM quiz_attempts WHERE id=$1 FOR UPDATE', [answer.attempt_id]);
      const updated = (await client.query('UPDATE quiz_attempt_answers SET teacher_score=$1,is_correct=$2 WHERE id=$3 RETURNING *', [score, score>=50, answer.id])).rows[0];
      const answers = (await client.query(`SELECT a.*,q.format FROM quiz_attempt_answers a JOIN quiz_questions q ON q.id=a.question_id WHERE a.attempt_id=$1`, [answer.attempt_id])).rows;
      if (answers.every((a) => a.format === 'mcq' || a.teacher_score != null)) {
        const finalScore = Math.round(answers.reduce((sum,a) => sum+(a.format === 'mcq' ? (a.is_correct ? 100 : 0) : a.teacher_score),0)/answers.length);
        await client.query("UPDATE quiz_attempts SET score=$1,status='graded',correct_count=$2 WHERE id=$3", [finalScore,answers.filter((a)=>a.format==='mcq'&&a.is_correct).length,answer.attempt_id]);
      }
      await client.query('COMMIT');
      res.json(updated);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
}

module.exports = { registerAssessments, validateAnswers };

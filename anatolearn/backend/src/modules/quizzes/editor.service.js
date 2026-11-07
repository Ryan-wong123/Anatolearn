// Quiz builder commits all changes in one transaction. Until this endpoint is
// called, the professor's edits exist only in their browser.
const pool = require('../../db');
const { validQuestion } = require('../questions/question.validation');
const { validate3DReferences } = require('../questions/questions.service');
const questionsRepo = require('../questions/questions.repository');
const { isDeepStrictEqual } = require('node:util');

const failure = (status, message) => ({ status, kind: 'json', headers: {}, cookies: [], body: { message } });
const success = (status, body) => ({ status, kind: 'json', headers: {}, cookies: [], body });

function questionValues(q) {
  return [q.question.trim(), q.format, q.category || null,
    q.format === 'mcq' ? q.option_a : null,
    q.format === 'mcq' ? q.option_b : null,
    q.format === 'mcq' ? q.option_c : null,
    q.format === 'mcq' ? q.option_d : null,
    q.format === 'mcq' ? q.correct_option : null,
    q.format === 'open_ended' ? q.model_answer : null,
    q.format === 'region_identification' || q.format === 'annotation_matching' ? q.question_config : null];
}
function sameQuestion(a, b) {
  return Number(a.id) === Number(b.id) && isDeepStrictEqual(questionValues(a), questionValues(b));
}
function deriveType(questions) {
  const mcq = questions.some(q => q.format === 'mcq');
  const other = questions.some(q => q.format !== 'mcq');
  return mcq && other ? 'Mixed' : other ? 'Practical' : 'MCQ';
}
async function commitQuizEditor(input) {
  const id = input.params.id ? Number(input.params.id) : null;
  const { title, description, category, questions } = input.body || {};
  if (typeof title !== 'string' || !title.trim() || title.length > 255)
    return failure(400, 'Enter a quiz title (maximum 255 characters).');
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 100)
    return failure(400, 'Add between 1 and 100 questions before finishing.');
  if (typeof description !== 'undefined' && description !== null && typeof description !== 'string')
    return failure(400, 'Invalid quiz description.');
  if (typeof category !== 'undefined' && category !== null && typeof category !== 'string')
    return failure(400, 'Invalid quiz category.');
  const existingIds = new Set();
  for (const q of questions) {
    if (!q || typeof q !== 'object' || !validQuestion(q))
      return failure(400, 'One or more questions are incomplete.');
    if (q.id != null && Number(q.id) > 0) {
      if (!id || !Number.isSafeInteger(q.id) || existingIds.has(q.id))
        return failure(400, 'Invalid or duplicate question ID.');
      existingIds.add(q.id);
    }
    const referenceError = await validate3DReferences(q);
    if (referenceError) return failure(400, referenceError);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let quizId = id;
    let previous = [];
    let preserveExistingQuestions = false;
    if (id) {
      const { rows } = await client.query('SELECT * FROM quizzes WHERE id=$1 FOR UPDATE', [id]);
      if (!rows.length) { await client.query('ROLLBACK'); return failure(404, 'Quiz not found.'); }
      previous = (await client.query('SELECT * FROM quiz_questions WHERE quiz_id=$1 ORDER BY id', [id])).rows;
      if ([...existingIds].some(qId => !previous.some(q => Number(q.id) === qId))) {
        await client.query('ROLLBACK');
        return failure(409, 'The quiz questions changed in another session. Reload the editor.');
      }
      const unchanged = previous.length === questions.length && previous.every(old =>
        questions.some(q => q.id === old.id && sameQuestion(q, old)));
      const used = (await questionsRepo.findQuizUsage([id], client)).rows.length > 0;
      if (used && !unchanged) {
        await client.query('ROLLBACK');
        return failure(409, 'This quiz already has attempts or active sessions. You can edit its details, but not its questions.');
      }
      preserveExistingQuestions = used && unchanged;
    } else {
      const { rows } = await client.query(`INSERT INTO quizzes
        (title, description, type, category, program_id, is_published, owner_id)
        VALUES ($1,$2,$3,$4,$5,false,$6) RETURNING id`,
        [title.trim(), description || null, deriveType(questions), category || null, null, input.user.id]);
      quizId = rows[0].id;
    }

    const saved = [];
    for (const q of questions) {
      if (preserveExistingQuestions) {
        saved.push(previous.find(row => Number(row.id) === Number(q.id)));
        continue;
      }
      const values = questionValues(q);
      let row;
      if (id && Number(q.id) > 0) {
        row = (await client.query(`UPDATE quiz_questions SET
          question=$1,format=$2,category=$3,option_a=$4,option_b=$5,option_c=$6,
          option_d=$7,correct_option=$8,model_answer=$9,question_config=$10
          WHERE id=$11 AND quiz_id=$12 RETURNING *`, [...values,q.id,quizId])).rows[0];
      } else {
        row = (await client.query(`INSERT INTO quiz_questions
          (question,format,category,option_a,option_b,option_c,option_d,correct_option,model_answer,question_config,quiz_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [...values,quizId])).rows[0];
      }
      saved.push(row);
    }
    if (id && !preserveExistingQuestions) {
      const remainingIds = [...existingIds];
      if (remainingIds.length) await client.query(
        'DELETE FROM quiz_questions WHERE quiz_id=$1 AND NOT (id = ANY($2::int[]))', [quizId, remainingIds]);
      else await client.query('DELETE FROM quiz_questions WHERE quiz_id=$1', [quizId]);
    }
    const quiz = (await client.query(`UPDATE quizzes SET title=$1,description=$2,category=$3,type=$4
      WHERE id=$5 RETURNING *`, [title.trim(),description || null,category || null,deriveType(questions),quizId])).rows[0];
    await client.query('COMMIT');
    return success(id ? 200 : 201, { quiz, questions: saved });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Could not commit quiz editor:', error);
    return failure(500, 'Could not save the quiz. No changes were committed.');
  } finally {
    client.release();
  }
}
module.exports = { commitQuizEditor, questionValues, deriveType, sameQuestion };

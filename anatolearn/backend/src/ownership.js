// Who may see and change teaching content.
//
//   read    students: published, in their programme (access.js canRead).
//           teachers: anything published, plus their own drafts and unclaimed content. Other teachers' drafts are invisible.
//   manage  only the owner (owner_id = the teacher) or, for unclaimed content (owner_id IS NULL), any teacher.
//           Managing covers editing, deleting, publishing, adding questions or annotations, grading, and seeing the
//           attempts and answer keys of a quiz.
//
// The route-level middleware in middleware/ownership.js applies these rules; keep every teacher write route behind it.
const pool = require('./db');

// column: the owner column of the table; sql: how to load, for a given id, the row whose owner decides access.
// published: SQL for "is this visible to every teacher?" (question-bank entries and announcements are always visible to teachers).
const OWNED = {
  models: { table: 'models', column: 'owner_id', published: 'is_published' },
  videos: { table: 'videos', column: 'owner_id', published: 'is_published' },
  quizzes: { table: 'quizzes', column: 'owner_id', published: 'is_published' },
  resources: { table: 'resources', column: 'owner_id', published: 'is_published' },
  'question-bank': { table: 'question_bank', column: 'owner_id', published: 'TRUE' },
  announcements: { table: 'announcements', column: 'created_by', published: 'TRUE' },
};
const CONTENT_KINDS = ['models', 'videos', 'quizzes', 'resources'];

const isUnclaimed = (row, column = 'owner_id') => row[column] === null;
const isOwner = (user, row, column = 'owner_id') => row[column] === user.id;

// Strict `=== null`: a row loaded without its owner column is never treated as unclaimed, so a forgotten column fails closed.
function canManage(user, row, column = 'owner_id') {
  return user?.role === 'teacher' && Boolean(row) && (isUnclaimed(row, column) || isOwner(user, row, column));
}

// Adds can_manage (and the owner's name, for display) to rows shown to teachers. Students get rows untouched.
async function annotate(user, rows, column = 'owner_id') {
  if (user?.role !== 'teacher') return rows;
  const ids = [...new Set(rows.map((row) => row[column]).filter((id) => Number.isInteger(id)))];
  const names = ids.length ? new Map((await pool.query('SELECT id, name FROM users WHERE id = ANY($1::int[])', [ids])).rows.map((row) => [row.id, row.name])) : new Map();
  return rows.map((row) => ({ ...row, can_manage: canManage(user, row, column), owner_name: row[column] === null ? null : names.get(row[column]) ?? null }));
}

// SQL that loads, by the id in $1, the row that decides access. It always exposes owner_id and is_published, so the same
// canRead / canManage checks work whatever the route is about.
const RESOLVERS = {
  models: 'SELECT * FROM models WHERE id = $1',
  videos: 'SELECT * FROM videos WHERE id = $1',
  quizzes: 'SELECT * FROM quizzes WHERE id = $1',
  resources: 'SELECT * FROM resources WHERE id = $1',
  bank: 'SELECT *, TRUE AS is_published FROM question_bank WHERE id = $1',
  announcements: 'SELECT *, created_by AS owner_id, TRUE AS is_published FROM announcements WHERE id = $1',
  question: 'SELECT q.* FROM quizzes q JOIN quiz_questions qq ON qq.quiz_id = q.id WHERE qq.id = $1',
  annotation: 'SELECT m.* FROM models m JOIN annotations a ON a.model_id = m.id WHERE a.id = $1',
  answer: 'SELECT q.* FROM quizzes q JOIN quiz_attempts t ON t.quiz_id = q.id JOIN quiz_attempt_answers a ON a.attempt_id = t.id WHERE a.id = $1',
  attempt: 'SELECT q.* FROM quizzes q JOIN quiz_attempts t ON t.quiz_id = q.id WHERE t.id = $1',
};
async function resolve(what, id) {
  if (!RESOLVERS[what]) throw new Error(`Unknown ownership target: ${what}`);
  if (!/^\d+$/.test(String(id)) || String(id).length > 9) return null;
  return (await pool.query(RESOLVERS[what], [Number(id)])).rows[0] ?? null;
}

module.exports = { OWNED, CONTENT_KINDS, RESOLVERS, canManage, annotate, resolve, isUnclaimed, isOwner };

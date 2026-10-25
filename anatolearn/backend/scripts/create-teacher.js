// Usage: node scripts/create-teacher.js "Full Name" email@example.com [programId]
// Password is read from TEACHER_PASSWORD so it never appears in shell history or process lists.
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const { passwordProblem } = require('../src/passwords');

(async () => {
  const [name, email, programId] = process.argv.slice(2);
  const password = process.env.TEACHER_PASSWORD;
  if (!name || !email || !password)
    throw new Error('Usage: TEACHER_PASSWORD=... node scripts/create-teacher.js "Name" email [programId]');
  const problem = passwordProblem(password, { role: 'teacher', email, name });
  if (problem) throw new Error(problem);
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, program_id) VALUES ($1, $2, $3, 'teacher', $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'teacher'
     RETURNING id, email`, [name, email.trim().toLowerCase(), hash, programId ? Number(programId) : null]);
  console.log('Teacher ready:', result.rows[0]);
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());

// Usage: ADMIN_PASSWORD=... node scripts/create-admin.js "Full Name" email@example.com
// Creates an administrator, or promotes the account with that email. The password is read from ADMIN_PASSWORD so it never
// appears in shell history or process lists. If the account already exists and ADMIN_PASSWORD is unset, only its role changes.
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const { passwordProblem } = require('../src/passwords');

(async () => {
  const [name, email] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD;
  if (!email) throw new Error('Usage: ADMIN_PASSWORD=... node scripts/create-admin.js "Name" email');
  const problem = password && passwordProblem(password, { role: 'admin', email, name });
  if (problem) throw new Error(problem);
  const normalized = email.trim().toLowerCase();
  const existing = (await pool.query('SELECT id FROM users WHERE email = $1', [normalized])).rows[0];
  if (existing) {
    const result = await pool.query(
      `UPDATE users SET role = 'admin', is_active = true,
         password_hash = COALESCE($2, password_hash), password_changed_at = CASE WHEN $2 IS NULL THEN password_changed_at ELSE NOW() END
       WHERE id = $1 RETURNING id, email, role`, [existing.id, password ? await bcrypt.hash(password, 12) : null]);
    await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [existing.id]);
    console.log('Administrator ready (existing account promoted; its sessions were signed out):', result.rows[0]);
    return;
  }
  if (!name || !password) throw new Error('A new administrator needs a name and ADMIN_PASSWORD');
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, password_changed_at) VALUES ($1, $2, $3, 'admin', NOW()) RETURNING id, email, role`,
    [name.trim(), normalized, await bcrypt.hash(password, 12)]);
  console.log('Administrator ready:', result.rows[0]);
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

// The specs create their own accounts straight in the database (the backend's own pool and hashing), so no seeded data is needed.
const backend = createRequire(fileURLToPath(new URL('../../backend/', import.meta.url)));
export const pool = backend('./src/db.js');
export const mfa = backend('./src/mfa.js');
const bcrypt = backend('bcryptjs');

export const PASSWORD = 'Maple9Window';
export const newStamp = (prefix) => `${prefix}${Date.now().toString(36)}`;

export async function createUser(stamp, role, label) {
  const email = `${stamp}-${label}@example.test`.toLowerCase();
  const name = `${label} ${stamp}`;
  const id = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id',
    [name, email, await bcrypt.hash(PASSWORD, 4), role])).rows[0].id;
  return { id, email, name };
}

export async function cleanup(stamp) {
  await pool.query('DELETE FROM audit_log WHERE actor_name LIKE $1', [`%${stamp}`]);
  await pool.query('DELETE FROM models WHERE title LIKE $1', [`%${stamp}`]);
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${stamp}-%`]);
}

export async function signIn(page, user, landing = /\/(dashboard|library|admin\/users|profile)$/) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(landing);
}

export async function signOutLocally(page) {
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }));
  await page.context().clearCookies();
  await page.evaluate(() => sessionStorage.clear());
}

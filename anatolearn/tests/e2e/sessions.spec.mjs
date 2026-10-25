import { test, expect } from '@playwright/test';
import { cleanup, createUser, newStamp, pool, signIn } from './helpers.mjs';

const stamp = newStamp('ses');
let student;
test.beforeAll(async () => { student = await createUser(stamp, 'student', 'student'); });
test.afterAll(async () => { await cleanup(stamp); });

test('idle sessions end, and "sign out everywhere" ends this one too', async ({ page }) => {
  await signIn(page, student);
  await page.goto('/profile');
  await expect(page.getByRole('region', { name: 'Signed-in devices' })).toBeVisible();

  // Age the session past the student idle limit, then act in the page.
  await pool.query("UPDATE auth_sessions SET last_seen_at = NOW() - INTERVAL '9 hours' WHERE user_id = $1", [student.id]);
  await page.goto('/library');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Your session has ended')).toBeVisible();

  await signIn(page, student);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign out on all devices…' }).click();
  await page.getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('five wrong passwords on the change-password form lock the account', async ({ page }) => {
  await signIn(page, student);
  await page.goto('/profile');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByLabel('Current password').fill('Wrong-password-1');
    await page.getByLabel('New password', { exact: true }).fill('Violet7Harbour');
    await page.getByLabel('Confirm new password').fill('Violet7Harbour');
    await page.getByRole('button', { name: /Change password|Update password/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Current password is incorrect' })).toBeVisible();
  }
  await page.getByLabel('Current password').fill('Maple9Window');
  await page.getByRole('button', { name: /Change password|Update password/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: /Too many incorrect attempts. Try again in \d+ minutes?/ })).toBeVisible();
});

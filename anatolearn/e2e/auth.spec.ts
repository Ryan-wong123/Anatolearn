import { expect, test } from '@playwright/test';

test('unauthenticated users are redirected and can log in', async ({ page }) => {
  await page.route('http://localhost:5000/api/**', route => route.fulfill({ json: [] }));
  await page.route('http://localhost:5000/api/auth/login', route => route.fulfill({ json: { token: 'e2e-token', user: { id: 1, name: 'Test Student', email: 'student@example.test', role: 'student', program_id: 1 } } }));
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel(/email/i).fill('student@example.test');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

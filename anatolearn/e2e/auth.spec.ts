import { expect, test } from '@playwright/test';

test('authentication and protected access', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);

  await page.route('**/api/auth/login', (route) => route.fulfill({ json: { token: 'e2e-token', user: { id: 10, name: 'E2E Student', email: 'student@example.test', role: 'student', program_id: 1 } } }));
  await page.getByLabel(/email/i).fill('student@example.test');
  await page.getByLabel(/password/i).fill('TestPass123!');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

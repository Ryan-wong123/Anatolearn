import { expect, test } from '@playwright/test';

test('protected routes redirect anonymous users to login', async ({ page }) => {
  await page.goto('/quizzes');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'AnatoLearn' })).toBeVisible();
});

test('registration is reachable from login', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

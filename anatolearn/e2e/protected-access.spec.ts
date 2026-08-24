import { expect, test } from '@playwright/test';

test('protected pages redirect anonymous visitors', async ({ page }) => {
  await page.goto('/quizzes');
  await expect(page).toHaveURL(/\/login$/);
});


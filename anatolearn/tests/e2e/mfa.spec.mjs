import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cleanup, createUser, mfa, newStamp, pool, signIn, signOutLocally } from './helpers.mjs';

const stamp = newStamp('mfa');
let teacher;
test.beforeAll(async () => { teacher = await createUser(stamp, 'teacher', 'teacher'); });
test.afterAll(async () => { await cleanup(stamp); });

test('authenticator app: enrol, see recovery codes, then sign in with a code and with a recovery code', async ({ page }) => {
  await signIn(page, teacher);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Set up…' }).click();
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Password is incorrect' })).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill('Maple9Window');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByAltText('QR code for your authenticator app')).toBeVisible();
  const secret = (await page.getByTestId('mfa-secret').innerText()).replace(/\s/g, '');

  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'not valid' })).toBeVisible();

  await page.getByLabel('6-digit code').fill(mfa.codeFor(secret, mfa.currentStep()));
  await page.getByRole('button', { name: 'Turn on' }).click();
  // allInnerTexts() does not wait, so wait for the list to render first or a slow response reads zero codes.
  const recoveryCodes = page.getByTestId('recovery-codes').locator('li');
  await expect(recoveryCodes).toHaveCount(10);
  const codes = await recoveryCodes.allInnerTexts();
  await page.getByRole('button', { name: 'I have saved them' }).click();
  await expect(page.getByText(/You have 10 unused recovery codes/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // Next sign-in asks for the second step; a wrong code is refused, a recovery code works once.
  await signOutLocally(page);
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(teacher.email);
  await page.getByLabel('Password', { exact: true }).fill('Maple9Window');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Authentication code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid or expired verification code' })).toBeVisible();
  await page.getByLabel('Authentication code').fill(codes[0]);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

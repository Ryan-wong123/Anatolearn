import { test, expect } from '@playwright/test';
import { cleanup, createUser, newStamp, pool, signIn, signOutLocally } from './helpers.mjs';

const stamp = newStamp('pk');
let teacher, second;
test.beforeAll(async () => { teacher = await createUser(stamp, 'teacher', 'teacher'); second = await createUser(stamp, 'teacher', 'second'); });
test.afterAll(async () => { await cleanup(stamp); });

// Chromium's virtual authenticator stands in for a real device, so the browser's WebAuthn API runs for real.
async function addVirtualAuthenticator(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  return { client, authenticatorId };
}
async function addPasskey(page, name) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Add a passkey…' }).click();
  await page.getByLabel('Name (so you can tell them apart)').fill(name);
  await page.getByLabel('Password', { exact: true }).fill('Maple9Window');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('passkey-list')).toContainText(name);
}
async function startSignIn(page, user) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('Maple9Window');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('passkey: a wrong password stops registration; once added it signs in, then it can be removed', async ({ page }) => {
  const { client, authenticatorId } = await addVirtualAuthenticator(page);
  await signIn(page, teacher);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Add a passkey…' }).click();
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Password is incorrect' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await addPasskey(page, 'Test laptop');
  await expect(page.getByText('Passkey added.')).toBeVisible();
  expect((await client.send('WebAuthn.getCredentials', { authenticatorId })).credentials).toHaveLength(1);

  // The next sign-in offers the passkey as the second step (this account has no authenticator app, so no code box).
  await signOutLocally(page);
  await startSignIn(page, teacher);
  await expect(page.getByLabel('Authentication code')).toHaveCount(0);
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await pool.query('SELECT last_used_at FROM passkeys WHERE user_id=$1', [teacher.id])).rows[0].last_used_at).not.toBeNull();

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Remove passkey Test laptop' }).click();
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /Current password is incorrect|Password is incorrect/ })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('Maple9Window');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('Passkey removed.')).toBeVisible();
  await expect(page.getByTestId('passkey-list')).toHaveCount(0);

  // With no second factor left the account signs in with the password alone.
  await signOutLocally(page);
  await signIn(page, teacher, /\/dashboard$/);
});

test('passkey: a device that does not hold the credential cannot finish signing in', async ({ page }) => {
  const { client, authenticatorId } = await addVirtualAuthenticator(page);
  await signIn(page, second);
  await addPasskey(page, 'Lost phone');
  await signOutLocally(page);
  await client.send('WebAuthn.clearCredentials', { authenticatorId });
  await startSignIn(page, second);
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

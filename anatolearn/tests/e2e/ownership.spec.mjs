import { test, expect } from '@playwright/test';
import { cleanup, createUser, newStamp, pool, signIn } from './helpers.mjs';

const stamp = newStamp('own');
let alice, bob, admin, others;
test.beforeAll(async () => {
  [alice, bob, admin] = [await createUser(stamp, 'teacher', 'Alice'), await createUser(stamp, 'teacher', 'Bob'), await createUser(stamp, 'admin', 'Root')];
  const model = async (title, owner, published) => (await pool.query('INSERT INTO models(title,file_path,is_published,program_id,owner_id) VALUES($1,$2,$3,1,$4) RETURNING id',
    [`${title} ${stamp}`, `/models/${stamp}-missing.obj`, published, owner])).rows[0].id;
  others = { theirs: await model('Alices model', alice.id, true), draft: await model('Alices draft', alice.id, false), unclaimed: await model('Unclaimed model', null, true) };
});
test.afterAll(async () => { await cleanup(stamp); });

test('a teacher sees others\' published content read-only, never their drafts, and can claim unowned content', async ({ page }) => {
  await signIn(page, bob);
  await page.goto('/3dviewer');
  await expect(page.getByText(`Alices model ${stamp}`).first()).toBeVisible();
  await expect(page.getByText(`Alices draft ${stamp}`)).toHaveCount(0);
  await expect(page.getByText(/By Alice .* View only/).first()).toBeVisible();
  await expect(page.getByText('No owner yet, so any teacher can change it.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Claim' }).first().click();
  await expect(page.getByText('You now own this').first()).toBeVisible();
  await expect.poll(async () => (await pool.query('SELECT owner_id FROM models WHERE id=$1', [others.unclaimed])).rows[0].owner_id).toBe(bob.id);
});

test('an administrator can move a teacher\'s content to another teacher', async ({ page }) => {
  await signIn(page, admin, /\/admin\/users$/);
  await page.locator('#user-search').fill(`Alice ${stamp}`);
  await page.getByRole('button', { name: `Transfer content of Alice ${stamp}` }).click();
  await page.getByLabel('New owner').selectOption({ label: `Bob ${stamp} (${bob.email})` });
  await page.getByRole('button', { name: 'Move content' }).click();
  await expect(page.getByText(/Moved \d+ items? to Bob/).first()).toBeVisible();
  expect((await pool.query('SELECT owner_id FROM models WHERE id=$1', [others.theirs])).rows[0].owner_id).toBe(bob.id);
});

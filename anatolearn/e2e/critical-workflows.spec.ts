import { expect, test, type Page } from '@playwright/test';

const token = `x.${Buffer.from(JSON.stringify({ id: 1, name: 'Test Student', role: 'student', program_id: 1 })).toString('base64url')}.x`;

async function mockApi(page: Page) {
  await page.route('http://localhost:5000/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/programs')) return route.fulfill({ json: [{ id: 1, name: 'Physiotherapy', description: null }] });
    if (path.endsWith('/auth/register')) return route.fulfill({ status: 201, json: { id: 1 } });
    if (path.endsWith('/auth/login')) return route.fulfill({ json: { token, user: { id: 1, name: 'Test Student', email: 'student@example.test', role: 'student', program_id: 1 } } });
    if (path.endsWith('/quizzes?published=true') || path.endsWith('/quizzes')) return route.fulfill({ json: [{ id: 1, title: 'Bone Quiz', description: 'Fixture', type: 'MCQ', category: 'Bones', is_published: true, created_at: '' }] });
    if (path.endsWith('/students/me/attempts')) return route.fulfill({ json: [] });
    if (path.endsWith('/quizzes/1/questions')) return route.fulfill({ json: [{ id: 1, quiz_id: 1, question: 'Largest bone?', format: 'mcq', option_a: 'Femur', option_b: 'Tibia', option_c: 'Ulna', option_d: 'Radius' }] });
    if (path.endsWith('/quizzes/1/submit')) return route.fulfill({ json: { attempt: { id: 1 }, status: 'graded', score: 100, total: 1, correct: 1, incorrect: 0, mcq_count: 1, open_ended_count: 0, feedback: [{ question_id: 1, selected_option: 'A', correct_option: 'A', is_correct: true }] } });
    if (path.endsWith('/models')) return route.fulfill({ json: [] });
    if (path.endsWith('/videos')) return route.fulfill({ json: [] });
    if (path.endsWith('/resources')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { message: 'Fixture route missing' } });
  });
}

test.beforeEach(async ({ page }) => mockApi(page));

test('registration, login, and protected-page access', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByLabel('Full name').fill('Test Student');
  await page.getByLabel('Email').fill('student@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Password1');
  await page.getByLabel('Confirm password').fill('Password1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Email').fill('student@example.test');
  await page.getByLabel('Password').fill('Password1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('student completes a deterministic quiz', async ({ page }) => {
  await page.addInitScript((value) => sessionStorage.setItem('anatolearn_token', value), token);
  await page.goto('/quizzes');
  await page.getByRole('button', { name: 'Start Quiz' }).click();
  await page.getByLabel(/Femur/).check();
  await page.getByRole('button', { name: /Submit/ }).click();
  await expect(page.getByText(/100%/)).toBeVisible();
});

test('authenticated model, video, and annotation entry points remain navigable', async ({ page }) => {
  await page.addInitScript((value) => sessionStorage.setItem('anatolearn_token', value), token);
  await page.goto('/3dviewer');
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto('/videos');
  await expect(page).not.toHaveURL(/\/login$/);
});

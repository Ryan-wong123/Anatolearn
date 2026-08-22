import { expect, test, type Page } from '@playwright/test';

const user = { id: 10, name: 'Test Student', email: 'student@example.test', role: 'student', program_id: 1 };

async function mockApi(page: Page) {
  await page.route('http://localhost:5000/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/auth/login') {
      return route.fulfill({ json: { token: 'e2e-token', user } });
    }
    if (path === '/api/quizzes') return route.fulfill({ json: [{ id: 4, title: 'Heart Quiz', description: 'Critical workflow', type: 'MCQ', category: 'Cardiac', is_published: true }] });
    if (path === '/api/quizzes/4/questions') return route.fulfill({ json: [{ id: 8, quiz_id: 4, question: 'Systemic pump?', format: 'mcq', option_a: 'RA', option_b: 'RV', option_c: 'LA', option_d: 'LV' }] });
    if (path === '/api/quizzes/4/submit') return route.fulfill({ json: { attempt: { id: 1 }, status: 'graded', score: 100, total: 1, correct: 1, incorrect: 0, mcq_count: 1, open_ended_count: 0, feedback: [{ question_id: 8, selected_option: 'D', correct_option: 'D', is_correct: true }] } });
    if (path === '/api/models') return route.fulfill({ json: [{ id: 2, title: 'Heart Model', description: 'Anatomy', file_path: '/models/anatomy/heart.glb', thumbnail_path: null, is_published: true, body_system: 'Cardiac', body_part: 'Heart' }] });
    if (path === '/api/videos') return route.fulfill({ json: [{ id: 3, title: 'Heart Animation', description: 'Flow', video_path: '/videos/heart.mp4', thumbnail_path: null, is_published: true }] });
    if (path === '/api/videos/3') return route.fulfill({ json: { id: 3, title: 'Heart Animation', description: 'Flow', video_path: '/videos/heart.mp4', thumbnail_path: null, created_at: '2026-01-01' } });
    if (path === '/api/students/me/attempts' || path === '/api/resources') return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill('Anatomy123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.beforeEach(async ({ page }) => mockApi(page));

test('authentication protects private pages and permits login', async ({ page }) => {
  await page.goto('/quizzes');
  await expect(page).toHaveURL(/login/);
  await login(page);
  await expect(page.getByRole('heading', { name: 'Welcome back, Test Student' })).toBeVisible();
});

test('student completes a quiz', async ({ page }) => {
  await login(page);
  await page.goto('/quizzes');
  await page.getByRole('button', { name: 'Start Quiz' }).click();
  await page.getByText('LV', { exact: true }).click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/100%/)).toBeVisible();
});

test('student browses a model and follows video navigation', async ({ page }) => {
  await login(page);
  await page.goto('/3dviewer');
  await expect(page.getByText('Heart Model')).toBeVisible();
  await page.goto('/videos');
  await page.getByText('Heart Animation').click();
  await expect(page).toHaveURL(/videos\/3/);
  await expect(page.getByRole('heading', { name: 'Heart Animation' })).toBeVisible();
});

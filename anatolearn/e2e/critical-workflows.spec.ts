import { expect, test } from '@playwright/test';

const user = { id: 7, name: 'Fixture Student', email: 'student@example.test', role: 'student', program_id: 1 };

async function authenticate(page: import('@playwright/test').Page) {
  await page.addInitScript(({ fixtureUser }) => {
    sessionStorage.setItem('anatolearn_token', 'e2e-token');
    sessionStorage.setItem('anatolearn_user', JSON.stringify(fixtureUser));
  }, { fixtureUser: user });
}

async function mockApi(page: import('@playwright/test').Page) {
  await page.route('http://localhost:5000/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const bodies: Record<string, unknown> = {
      '/api/models': [{ id: 1, title: 'Fixture Heart', description: 'Model fixture', file_path: '/heart.glb', thumbnail_path: null, is_published: true, body_system: 'Cardiovascular', body_part: 'Heart' }],
      '/api/models/1': { id: 1, title: 'Fixture Heart', description: 'Model fixture', file_path: '/heart.glb', thumbnail_path: null, is_published: true },
      '/api/videos': [{ id: 2, title: 'Heart Video', description: 'Video fixture', video_path: '/heart.mp4', thumbnail_path: null, is_published: true, annotation_id: 9 }],
      '/api/videos/2': { id: 2, title: 'Heart Video', description: 'Video fixture', video_path: '/heart.mp4', thumbnail_path: null, is_published: true, annotation_id: 9, linked_model_id: 1 },
      '/api/quizzes': [{ id: 3, title: 'Heart Quiz', description: 'Quiz fixture', type: 'MCQ', category: 'Heart', is_published: true, created_at: '' }],
      '/api/students/me/attempts': [],
      '/api/quizzes/3/questions': [{ id: 4, quiz_id: 3, question: 'Which organ pumps blood?', format: 'mcq', option_a: 'Heart', option_b: 'Lung', option_c: 'Liver', option_d: 'Kidney' }],
    };
    if (path === '/api/quizzes/3/submit') return route.fulfill({ json: { attempt: { id: 5 }, status: 'graded', score: 100, total: 1, correct: 1, incorrect: 0, mcq_count: 1, open_ended_count: 0, feedback: [{ question_id: 4, selected_option: 'A', correct_option: 'A', is_correct: true }] } });
    return route.fulfill({ json: bodies[path] ?? [] });
  });
}

test('protected access redirects to login', async ({ page }) => {
  await page.goto('/quizzes');
  await expect(page).toHaveURL(/\/login$/);
});

test('student completes a quiz', async ({ page }) => {
  await authenticate(page); await mockApi(page); await page.goto('/quizzes');
  await page.getByRole('button', { name: 'Start Quiz' }).click();
  await page.getByText('Heart', { exact: true }).click();
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/100%/)).toBeVisible();
});

test('model download workflow exposes a download action', async ({ page }) => {
  await authenticate(page); await mockApi(page); await page.goto('/3dviewer');
  await expect(page.getByText('Fixture Heart')).toBeVisible();
  await expect(page.getByRole('button', { name: /download/i })).toBeVisible();
});

test('video opens its linked annotation', async ({ page }) => {
  await authenticate(page); await mockApi(page); await page.goto('/videos/2');
  await page.getByRole('button', { name: 'View linked annotation' }).click();
  await expect(page).toHaveURL(/\/3dviewer\/1\?annotation=9$/);
});

test('annotation revisit preserves its deterministic deep link', async ({ page }) => {
  await authenticate(page); await mockApi(page);
  await page.goto('/3dviewer/1?annotation=9');
  await expect(page).toHaveURL(/annotation=9/);
});

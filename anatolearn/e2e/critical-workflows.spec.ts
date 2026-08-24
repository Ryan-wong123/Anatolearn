import { expect, test, type Page, type Route } from '@playwright/test';

const student = { id: 1001, name: 'Test Student', email: 'student@test.invalid', role: 'student', program_id: 1 };
const apiRoute = /^https?:\/\/[^/]+\/api\//;

async function authenticate(page: Page) {
  await page.addInitScript((user) => {
    sessionStorage.setItem('anatolearn_token', 'browser-fixture-token');
    sessionStorage.setItem('anatolearn_user', JSON.stringify(user));
  }, student);
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
}

test('protected access redirects an anonymous browser', async ({ page }) => {
  await page.goto('/quizzes');
  await expect(page).toHaveURL(/\/login$/);
});

test('student completes a deterministic quiz', async ({ page }) => {
  await authenticate(page);
  await page.route(apiRoute, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST' } });
    const url = route.request().url();
    if (url.includes('/quizzes/1/questions')) return json(route, [{ id: 11, quiz_id: 1, question: 'Which chamber pumps systemically?', format: 'mcq', option_a: 'Right atrium', option_b: 'Left ventricle', option_c: 'Right ventricle', option_d: 'Left atrium' }]);
    if (url.includes('/quizzes/1/submit')) return json(route, { attempt: { id: 51 }, status: 'graded', score: 100, total: 1, correct: 1, incorrect: 0, mcq_count: 1, open_ended_count: 0, feedback: [{ question_id: 11, selected_option: 'B', correct_option: 'B', is_correct: true }] });
    if (url.includes('/students/me/attempts')) return json(route, []);
    if (url.includes('/quizzes')) return json(route, [{ id: 1, title: 'Heart quiz', description: 'Fixture', type: 'MCQ', category: 'Heart', is_published: true, created_at: '2026-01-01' }]);
    return json(route, []);
  });
  await page.goto('/quizzes');
  await page.getByRole('button', { name: 'Start Quiz' }).click();
  await page.getByText('Left ventricle').click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: 'You scored 100%' })).toBeVisible();
});

test('annotation creation can be revisited through the authenticated API', async ({ page }) => {
  await authenticate(page);
  const annotations: unknown[] = [];
  await page.route(/^https?:\/\/[^/]+\/api\/models\/1\/annotations$/, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST' } });
    if (route.request().method() === 'POST') {
      const created = { id: 71, ...route.request().postDataJSON() };
      annotations.push(created);
      return json(route, created, 201);
    }
    return json(route, annotations);
  });
  await page.goto('/dashboard');
  const result = await page.evaluate(async () => {
    await fetch('/api/models/1/annotations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ annotation_type: 'point', label: 'Aorta', description: '', annotation_data: { position: [0, 0, 0] } }) });
    return fetch('/api/models/1/annotations').then((response) => response.json());
  });
  expect(result).toEqual([expect.objectContaining({ id: 71, label: 'Aorta' })]);
});

test('model download uses an authenticated browser request', async ({ page }) => {
  await authenticate(page);
  let downloaded = false;
  await page.route(apiRoute, async (route) => {
    if (route.request().url().includes('/models/1/download')) {
      downloaded = route.request().headers().authorization === 'Bearer browser-fixture-token';
      return route.fulfill({ body: 'model', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Disposition', 'Content-Disposition': 'attachment; filename="heart.glb"' } });
    }
    if (route.request().url().includes('/models')) return json(route, [{ id: 1, title: 'Heart', description: 'Fixture', file_path: '/heart.glb', thumbnail_path: null, body_system: 'Cardiovascular', body_part: 'Heart', is_published: true }]);
    return json(route, []);
  });
  await page.goto('/3dviewer');
  await page.getByTitle('Download model file').click();
  await expect.poll(() => downloaded).toBe(true);
});

test('video navigation opens a linked video record', async ({ page }) => {
  await authenticate(page);
  await page.route(apiRoute, async (route) => {
    if (/\/videos\/8$/.test(route.request().url())) return json(route, { id: 8, title: 'Aorta explainer', description: 'Linked to annotation 71', video_path: '/videos/aorta.mp4', thumbnail_path: null, annotation_id: 71, created_at: '2026-01-01' });
    if (route.request().url().includes('/videos')) return json(route, [{ id: 8, title: 'Aorta explainer', description: 'Linked to annotation 71', video_path: '/videos/aorta.mp4', thumbnail_path: null, annotation_id: 71, is_published: true, created_at: '2026-01-01' }]);
    return json(route, []);
  });
  await page.goto('/videos');
  await page.getByText('Aorta explainer').click();
  await expect(page).toHaveURL(/\/videos\/8$/);
  await expect(page.getByRole('heading', { name: 'Aorta explainer' })).toBeVisible();
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const fixture = () => JSON.parse(readFileSync('.playwright/fixture.json', 'utf8'));

async function audit(page, testInfo, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await testInfo.attach(`${label}-axe`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  if (testInfo.project.name === 'chrome' && label === 'student-dark-Dashboard') {
    await page.screenshot({ path: 'docs/verification/playwright-dashboard-dark.png' });
  }
  expect.soft(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
}

async function signIn(page, role) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${fixture().stamp}-${role}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Testing123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).toHaveTitle('Dashboard | AnatoLearn');
  await expect(page.locator('main h1')).toContainText('Welcome back');
  await expect(page.getByRole('status').filter({ hasText: 'Loading' })).toHaveCount(0);
}

test('auth titles, landmarks, descriptions and accessibility', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page).toHaveTitle('Sign in | AnatoLearn');
  await expect(page.getByRole('main', { name: 'Sign in' })).toBeVisible();
  await audit(page, testInfo, 'login');
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page).toHaveTitle('Create account | AnatoLearn');
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAccessibleDescription(/8 characters.*uppercase.*number/);
  await audit(page, testInfo, 'register');
});

for (const role of ['student', 'teacher']) {
  test(`${role}: main sections in light and dark themes`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await signIn(page, role);
    const sections = [ ['Dashboard', '/dashboard'], ['3D Viewer', '/3dviewer'], ['Videos', '/videos'], ['Quizzes', '/quizzes'], ['Library', '/library'] ];
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      for (const [name, path] of sections) {
        const changed = new URL(page.url()).pathname !== path;
        const link = page.getByRole('navigation').getByRole('link', { name, exact: true }).filter({ visible: true });
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.getByRole('status').filter({ hasText: 'Loading' })).toHaveCount(0);
        await expect(link).toHaveAttribute('aria-current', 'page');
        if (changed) await expect(page.locator('main')).toBeFocused();
        await audit(page, testInfo, `${role}-${theme}-${name}`);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('teacher dialog isolation, keyboard trap and return focus', async ({ page }, testInfo) => {
  await signIn(page, 'teacher');
  await page.goto('/3dviewer');
  const trigger = page.getByRole('button', { name: '+ Upload Model', exact: true });
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Upload Model' });
  const close = dialog.getByRole('button', { name: 'Close dialog' });
  await expect(close).toBeFocused();
  expect(await page.locator('nav').evaluate(element => Boolean(element.closest('[inert]')))).toBe(true);
  await close.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Upload', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await audit(page, testInfo, 'model-upload-dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.locator('[inert]').count()).toBe(0);
});

test('compact navigation and skip link work by keyboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, 'student');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#mobile-navigation').getByRole('link', { name: 'Library', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await audit(page, testInfo, 'compact-dashboard');
});

test('viewer geometry, annotation keyboard selection and linked-video feedback', async ({ page, browserName }, testInfo) => {
  await signIn(page, 'student');
  await page.goto(`/3dviewer/${fixture().model}`);
  await expect(page.getByRole('status').filter({ hasText: 'Loading' })).toHaveCount(0, { timeout: 45_000 });
  const annotation = page.getByRole('button', { name: '1. QA point', exact: true });
  await expect(annotation).toBeVisible();
  await expect(page.locator('canvas[aria-label="Interactive anatomy model"]')).toBeVisible();
  await annotation.press('Space');
  await expect(annotation).toHaveAttribute('aria-pressed', 'true');
  const details = page.getByRole('region', { name: 'Annotation details: QA point' });
  await expect(details).toContainText('Test annotation');
  await audit(page, testInfo, 'viewer-details');
  await details.getByRole('button', { name: /^Watch:/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if (browserName === 'webkit' && process.platform === 'win32') {
    testInfo.annotations.push({ type: 'limitation', description: 'Windows WebKit cannot decode this H.264/AAC MP4; playback requires Safari/macOS verification.' });
    await expect(page.getByRole('alert')).toContainText('This video could not be played.');
    const response = await page.request.get('/videos/s.mp4', { headers: { Range: 'bytes=0-1023' } });
    expect(response.status()).toBe(206);
  } else {
    await expect(page.locator('video')).toHaveJSProperty('readyState', 4, { timeout: 30_000 });
  }
  await audit(page, testInfo, 'linked-video');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Collapse annotations' }).click();
  await expect(page.getByRole('button', { name: 'Expand annotations' })).toHaveAttribute('aria-expanded', 'false');
  await expect(annotation).toHaveCount(0);
});

test('authenticated MP4 playback', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit' && process.platform === 'win32', 'Windows WebKit reports NotSupportedError for the fixture H.264/AAC MP4. Test actual Safari on macOS.');
  await signIn(page, 'student');
  await page.goto(`/videos/${fixture().video}`);
  const video = page.locator('video');
  await expect(video).not.toHaveAttribute('autoplay', '');
  await expect(video).toHaveJSProperty('readyState', 4, { timeout: 30_000 });
  await video.evaluate(element => element.play());
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0);
});

test('video page exposes its authenticated WebVTT caption track without autoplay', async ({ page }, testInfo) => {
  await signIn(page, 'student');
  await page.goto(`/videos/${fixture().video}`);
  const video = page.locator('video');
  await expect(video).not.toHaveAttribute('autoplay', '');
  const track = video.locator('track[kind="captions"]');
  await expect(track).toHaveAttribute('srcLang', 'en');
  await expect(track).toHaveAttribute('default', '');
  const captionRequest = page.waitForResponse(response => new URL(response.url()).pathname.startsWith('/captions/'), { timeout: 8000 });
  await track.evaluate(element => { element.track.mode = 'hidden'; });
  let response;
  const browserRequest = await captionRequest.catch(error => ({ unavailable: error }));
  if ('unavailable' in browserRequest) {
    testInfo.annotations.push({ type: 'limitation', description: 'This browser did not request the fixture media track automatically; the same authenticated browser context fetched and verified its WebVTT response directly.' });
    const captionPath = await track.getAttribute('src');
    response = await page.request.get(new URL(captionPath, page.url()).toString());
  } else {
    response = browserRequest;
  }
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/vtt');
  expect(await response.text()).toContain('AnatoLearn test caption');
});

test('student quiz keyboard submission and accessible result', async ({ page }, testInfo) => {
  await signIn(page, 'student');
  await page.goto('/quizzes');
  const heading = page.getByText(fixture().stamp, { exact: true });
  const card = heading.locator('..').locator('..');
  await card.getByRole('button', { name: 'Start Quiz', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const answer = dialog.getByRole('radio', { name: /Femur/ });
  await answer.press('Space');
  await expect(answer).toBeChecked();
  await audit(page, testInfo, 'quiz-attempt');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).press('Enter');
  await expect(dialog).toContainText('You scored 100%');
  await audit(page, testInfo, 'quiz-result');
});

test('failed read keeps an accessible retry and recovers focus', async ({ page }, testInfo) => {
  await signIn(page, 'student');
  await page.route('**/api/resources*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"QA simulated outage"}' }));
  await page.goto('/library');
  await expect(page.getByRole('alert')).toContainText('Could not load resources');
  await audit(page, testInfo, 'read-error');
  await page.unroute('**/api/resources*');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('main')).toBeFocused();
});

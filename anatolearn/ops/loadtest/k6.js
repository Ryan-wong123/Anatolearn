// Load test for a STAGING deployment. Never point it at production data you care about.
//
//   k6 run -e BASE_URL=https://staging.example.com -e EMAIL=student@school.edu -e PASSWORD=... anatolearn/ops/loadtest/k6.js
//
// Options (all -e flags): PEAK_VUS (default 50), HOLD (default 5m), THINK (seconds between requests, default 1).
//
// The API limits requests to 600 per minute per client IP, and every virtual user here shares one IP, so set
// DISABLE_RATE_LIMIT=true on the staging backend or most requests will be 429. 429s are counted separately
// (rate_limited) and are not treated as server failures; 5xx responses and slow requests are.
// Log in once with a student account (login itself is limited to 10 per 15 minutes per IP).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || '').replace(/\/+$/, '');
const PEAK = Number(__ENV.PEAK_VUS) || 50;
const HOLD = __ENV.HOLD || '5m';
const THINK = Number(__ENV.THINK) || 1;
const serverErrors = new Counter('server_errors');
const rateLimited = new Counter('rate_limited');

export const options = {
  stages: [
    { duration: '1m', target: Math.max(1, Math.round(PEAK / 5)) },
    { duration: '2m', target: PEAK },
    { duration: HOLD, target: PEAK },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    server_errors: ['count==0'],
    'http_req_duration{kind:api}': ['p(95)<800'],
    'http_req_duration{kind:health}': ['p(95)<300'],
  },
};

export function setup() {
  if (!BASE) throw new Error('Set -e BASE_URL=https://your-staging-host');
  if (!__ENV.EMAIL || !__ENV.PASSWORD) throw new Error('Set -e EMAIL and -e PASSWORD for a student account');
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: __ENV.EMAIL, password: __ENV.PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } });
  // The token is only delivered as the anatolearn_session cookie; send it back as a Bearer header from every VU.
  const cookie = res.cookies.anatolearn_session && res.cookies.anatolearn_session[0];
  if (res.status !== 200 || !cookie) throw new Error(`Login failed (HTTP ${res.status}). MFA accounts cannot be used here.`);
  return { token: cookie.value };
}

function get(path, kind, headers) {
  const res = http.get(`${BASE}${path}`, { headers, tags: { kind } });
  if (res.status >= 500) serverErrors.add(1);
  if (res.status === 429) rateLimited.add(1);
  check(res, { [`${path} ok`]: (r) => r.status === 200 || r.status === 429 });
  return res;
}

export default function (data) {
  const auth = { Authorization: `Bearer ${data.token}` };
  get('/api/health', 'health');
  get('/api/programs', 'api');
  sleep(THINK);

  const models = get('/api/models?published=true', 'api', auth);
  sleep(THINK);
  let list = [];
  try { list = models.json(); } catch (error) { list = []; }
  if (Array.isArray(list) && list.length) {
    const model = list[Math.floor(Math.random() * list.length)];
    get(`/api/models/${model.id}`, 'api', auth);
    get(`/api/models/${model.id}/annotations`, 'api', auth);
  }
  sleep(THINK);

  const videos = get('/api/videos', 'api', auth);
  let clips = [];
  try { clips = videos.json(); } catch (error) { clips = []; }
  if (Array.isArray(clips) && clips.length) get(`/api/videos/${clips[Math.floor(Math.random() * clips.length)].id}`, 'api', auth);
  sleep(THINK);
}

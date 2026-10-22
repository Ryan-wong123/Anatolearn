const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { controller } = require('../src/http/controller');

function response() {
  return {
    headers: {}, cookies: [], statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    cookie(...args) { this.cookies.push(args); },
    clearCookie(...args) { this.cleared = args; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
    send(body) { this.body = body; },
    sendStatus(code) { this.statusCode = code; },
    sendFile(file) { this.file = file; },
    download(file, name, callback) { this.downloaded = { file, name }; this.downloadCallback = callback; },
  };
}

test('HTTP adapter isolates Express objects and preserves cookies, headers and JSON status', async () => {
  const req = { body: { title: 'Test' }, user: { id: 7 }, headers: {}, secretTransportProperty: true };
  const res = response();
  await controller(async input => {
    assert.notEqual(input, req);
    assert.equal(input.secretTransportProperty, undefined);
    assert.equal(input.body.title, 'Test');
    assert.equal(input.user.id, 7);
    return { status: 201, kind: 'json', body: { id: 3 }, headers: { 'Cache-Control': 'no-store' },
      cookies: [{ name: 'session', value: 'token', options: { httpOnly: true } }, { name: 'old', clear: true, options: { path: '/' } }] };
  })(req, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { id: 3 });
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(res.cookies, [['session', 'token', { httpOnly: true }]]);
  assert.deepEqual(res.cleared, ['old', { path: '/' }]);
});

test('HTTP adapter preserves exports, status-only replies, file delivery and download failures', async () => {
  for (const result of [
    { status: 200, kind: 'send', body: 'label,description', headers: { 'Content-Type': 'text/csv' } },
    { status: 404, kind: 'status' },
    { status: 200, kind: 'file', path: '/tmp/model.glb' },
  ]) {
    const res = response();
    await controller(async () => result)({}, res);
    assert.equal(res.statusCode, result.status);
    if (result.kind === 'send') assert.equal(res.body, result.body);
    if (result.kind === 'file') assert.equal(res.file, result.path);
  }
  const res = response();
  await controller(async () => ({ status: 200, kind: 'download', path: '/tmp/model.glb', filename: 'Anatomy.glb' }))({}, res);
  assert.deepEqual(res.downloaded, { file: '/tmp/model.glb', name: 'Anatomy.glb' });
  // An already-started stream must not attempt a second response.
  res.headersSent = true;
  res.downloadCallback(new Error('Connection closed'));
  assert.equal(res.statusCode, 200);
  await assert.rejects(controller(async () => { throw new Error('Database unavailable'); })({}, response()), /Database unavailable/);
});

test('feature boundaries keep SQL in repositories and Express out of services', () => {
  const root = path.join(__dirname, '../src/modules');
  for (const feature of fs.readdirSync(root)) {
    const directory = path.join(root, feature);
    const service = fs.readFileSync(path.join(directory, `${feature}.service.js`), 'utf8');
    const controllerSource = fs.readFileSync(path.join(directory, `${feature}.controller.js`), 'utf8');
    const repository = fs.readFileSync(path.join(directory, `${feature}.repository.js`), 'utf8');
    assert.doesNotMatch(service, /\b(?:pool|client|connection)\.query\s*\(/, feature);
    assert.doesNotMatch(service, /\b(?:req|res)\./, feature);
    assert.doesNotMatch(controllerSource, /require\([^\n]*(?:repository|\/db)/, feature);
    assert.doesNotMatch(repository, /require\([^\n]*(?:\.service|express)/, feature);
  }
});

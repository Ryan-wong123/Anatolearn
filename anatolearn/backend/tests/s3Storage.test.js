const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.STORAGE_DRIVER = 's3';
process.env.S3_BUCKET = 'test-bucket';
process.env.S3_PREFIX = 'site/';
process.env.AWS_REGION = 'us-east-1';
const { S3Client } = require('@aws-sdk/client-s3');

// An in-memory bucket behind the SDK client, so the S3 branches of storage.js run without the network.
const bucket = new Map();
const calls = [];
S3Client.prototype.send = async function send(command) {
  const input = command.input, name = command.constructor.name;
  calls.push({ name, input });
  if (name === 'PutObjectCommand') { bucket.set(input.Key, { size: Buffer.byteLength(input.Body), modified: new Date(Date.now() - 1000) }); return {}; }
  if (name === 'HeadObjectCommand') { const object = bucket.get(input.Key); if (!object) throw Object.assign(new Error('missing'), { name: 'NotFound' }); return { ContentLength: object.size }; }
  if (name === 'DeleteObjectCommand') { bucket.delete(input.Key); return {}; }
  if (name === 'ListObjectsV2Command') {
    const keys = [...bucket.keys()].filter((key) => key.startsWith(input.Prefix)).sort();
    const start = input.ContinuationToken ? Number(input.ContinuationToken) : 0;
    const page = keys.slice(start, start + 2);   // two per page forces pagination
    const more = start + 2 < keys.length;
    return { Contents: page.map((Key) => ({ Key, Size: bucket.get(Key).size, LastModified: bucket.get(Key).modified })), IsTruncated: more, NextContinuationToken: more ? String(start + 2) : undefined };
  }
  throw new Error(`unexpected ${name}`);
};
const storage = require('../src/storage');

test('S3 driver: write, stat, list (across pages) and remove use the prefixed keys', async () => {
  assert.equal(storage.REMOTE, true);
  for (const name of ['a.glb', 'b.glb', 'c.glb', 'd.glb', 'e.glb']) await storage.writeAsset(`/models/${name}`, Buffer.from('12345'));
  await storage.writeAsset('/videos/v.mp4', Buffer.from('1234567'));
  assert.ok(bucket.has('site/models/a.glb'), 'objects live under the configured prefix');

  assert.equal(await storage.statAsset('/models/a.glb'), 5);
  assert.equal(await storage.statAsset('/models/missing.glb'), null);

  const models = await storage.listAssets('models');
  assert.deepEqual(models.map((file) => file.path), ['/models/a.glb', '/models/b.glb', '/models/c.glb', '/models/d.glb', '/models/e.glb']);
  assert.ok(models.every((file) => file.size === 5 && file.modified < Date.now()));
  assert.equal(calls.filter((call) => call.name === 'ListObjectsV2Command').length, 3, 'all pages were requested');
  assert.deepEqual((await storage.listAssets('videos')).map((file) => file.path), ['/videos/v.mp4']);

  await storage.removeAsset('/models/b.glb');
  assert.equal(bucket.has('site/models/b.glb'), false);
  await storage.removeAsset('/models/never-existed.glb');   // best effort, never throws
  assert.equal((await storage.listAssets('models')).length, 4);
});

test('S3 driver refuses traversal in asset paths', async () => {
  await storage.removeAsset('/models/../../etc/passwd');   // swallowed by the best-effort wrapper
  assert.ok(![...bucket.keys()].some((key) => key.includes('..')));
  assert.equal(await storage.statAsset('/models/../x'), null);
});

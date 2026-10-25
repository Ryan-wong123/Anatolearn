const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { inspectZip } = require('../src/zipGuard');
const { buildZip, docx } = require('./helpers/zip');

const MB = 1024 * 1024;
async function inspect(buffer, options) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'anatolearn-zip-'));
  const file = path.join(dir, 'sample.zip');
  try { await fs.writeFile(file, buffer); return await inspectZip(file, options); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
}
const rejects = (buffer, pattern, options) => assert.rejects(inspect(buffer, options), (error) => { assert.equal(error.status, 400); assert.match(error.message, pattern); return true; });

test('an ordinary document archive is accepted and its entry names are reported', async () => {
  const result = await inspect(docx());
  assert.equal(result.entries, 3);
  assert.ok(result.names.includes('[Content_Types].xml') && result.names.includes('word/document.xml'));
});
test('a stored (uncompressed) archive such as a USDZ is accepted', async () => {
  assert.equal((await inspect(buildZip([{ name: 'model.usdc', data: Buffer.alloc(4096, 7), method: 'store' }, { name: 'tex.png', data: Buffer.alloc(100), method: 'store' }]), { methods: [0] })).entries, 2);
});
test('a zip bomb is rejected by its declared sizes (tiny file, huge expansion)', async () => {
  const bomb = buildZip([{ name: 'word/document.xml', data: Buffer.alloc(40 * MB), method: 'deflate' }]);
  assert.ok(bomb.length < 100 * 1024, `the bomb itself is only ${bomb.length} bytes`);
  await rejects(bomb, /expands to far more data/, { maxUncompressedBytes: 300 * MB });
  await rejects(bomb, /expands to more than 20 MB/, { maxUncompressedBytes: 20 * MB });
});
test('an archive whose headers lie about the size is caught by actually measuring it', async () => {
  const liar = buildZip([{ name: 'word/document.xml', data: Buffer.alloc(40 * MB), method: 'deflate', declaredSize: 1000 }]);
  await rejects(liar, /expands to far more data/, { maxUncompressedBytes: 300 * MB });
  const understated = buildZip([{ name: 'a.xml', data: Buffer.alloc(5000, 1), method: 'deflate', declaredSize: 9000 }]);
  await rejects(understated, /sizes do not match/);
  await rejects(buildZip([{ name: 'a.bin', data: Buffer.alloc(100), method: 'store', declaredSize: 50 }]), /sizes do not match/);
});
test('too many files, encrypted entries, ZIP64 and unsafe paths are rejected', async () => {
  await rejects(buildZip(Array.from({ length: 150 }, (_, index) => ({ name: `f${index}.txt`, data: 'x', method: 'store' }))), /too many files/, { maxEntries: 100 });
  await rejects(buildZip([{ name: 'secret.xml', data: 'x', method: 'store', flags: 1 }]), /Encrypted/);
  await rejects(buildZip([{ name: 'a.txt', data: 'x', method: 'store' }], { zip64End: true }), /ZIP64/);
  for (const name of ['../evil.xml', 'word/../../evil.xml', '/etc/passwd', 'C:/windows/evil.dll', 'a\\b.xml', 'a\0b.xml'])
    await rejects(buildZip([{ name, data: 'x', method: 'store' }]), /unsafe file path/);
});
test('compression methods can be restricted (USDZ entries must be stored)', async () => {
  await rejects(docx(), /compression method/, { methods: [0] });
});
test('damaged and non-ZIP files are rejected cleanly rather than crashing', async () => {
  await rejects(Buffer.from('this is not a zip file at all, just some text that is long enough'), /Not a valid ZIP/);
  await rejects(Buffer.alloc(10), /Not a valid ZIP/);
  const good = docx();
  await rejects(good.subarray(0, good.length - 30), /Not a valid ZIP|damaged/);
  const broken = Buffer.from(good); broken.writeUInt32LE(0xdeadbeef, 0);
  await rejects(broken, /damaged/);
  const truncatedBody = buildZip([{ name: 'a.xml', data: 'hello '.repeat(5000), method: 'deflate' }]);
  truncatedBody.fill(0xff, 40, 80);   // corrupt the deflate stream
  await rejects(truncatedBody, /damaged|sizes do not match/);
});
test('small archives with extreme ratios are not mistaken for bombs, large suspicious ones are', async () => {
  assert.equal((await inspect(buildZip([{ name: 'a.xml', data: Buffer.alloc(2 * MB), method: 'deflate' }]))).entries, 1);
  await rejects(buildZip([{ name: 'a.xml', data: Buffer.alloc(12 * MB), method: 'deflate' }]), /expands to far more data/);
  assert.equal((await inspect(buildZip([{ name: 'a.xml', data: Buffer.alloc(12 * MB), method: 'deflate' }]), { maxRatio: 100000 })).entries, 1, 'the ratio is configurable');
});

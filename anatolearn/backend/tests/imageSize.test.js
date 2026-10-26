const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { imageSize, assertImageSize } = require('../src/imageSize');
const storage = require('../src/storage');

const png = (width, height) => { const b = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a', 'hex').copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1'); b.writeUInt32BE(width, 16); b.writeUInt32BE(height, 20); return b; };
const jpeg = (width, height) => {   // SOI, a padding APP0, then SOF0
  const app = Buffer.concat([Buffer.from([0xff, 0xe0, 0, 16]), Buffer.alloc(14)]);
  const sof = Buffer.from([0xff, 0xc0, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app, sof, Buffer.alloc(8)]);
};
const webpHeader = (kind) => { const b = Buffer.alloc(40); b.write('RIFF', 0, 'latin1'); b.write('WEBP', 8, 'latin1'); b.write(kind, 12, 'latin1'); return b; };
const webpX = (w, h) => { const b = webpHeader('VP8X'); b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };
const webpL = (w, h) => { const b = webpHeader('VP8L'); b[20] = 0x2f; b.writeUInt32LE((w - 1) | ((h - 1) << 14), 21); return b; };
const webpLossy = (w, h) => { const b = webpHeader('VP8 '); b.writeUIntLE(0x2a019d, 23, 3); b.writeUInt16LE(w, 26); b.writeUInt16LE(h, 28); return b; };

test('reads sizes from PNG, JPEG and WebP headers', () => {
  assert.deepEqual(imageSize(png(640, 480)), { width: 640, height: 480 });
  assert.deepEqual(imageSize(jpeg(1920, 1080)), { width: 1920, height: 1080 });
  assert.deepEqual(imageSize(webpX(300, 200)), { width: 300, height: 200 });
  assert.deepEqual(imageSize(webpL(321, 123)), { width: 321, height: 123 });
  assert.deepEqual(imageSize(webpLossy(800, 600)), { width: 800, height: 600 });
  assert.equal(imageSize(Buffer.from('not an image')), null);
  assert.equal(imageSize(png(1, 1).subarray(0, 20)), null, 'truncated header');
});

test('rejects images that are too wide, too tall, too many pixels, or unreadable', () => {
  assert.doesNotThrow(() => assertImageSize(png(4000, 3000)));
  assert.throws(() => assertImageSize(png(20000, 10)), /20000x10 pixels/);
  assert.throws(() => assertImageSize(png(10, 20000)), /most allowed/);
  assert.throws(() => assertImageSize(png(7000, 7000)), /megapixels/);   // within each side limit, 49 MP in total
  assert.throws(() => assertImageSize(webpX(16000, 16000), 'The photo'), /The photo is 16000x16000/);
  assert.throws(() => assertImageSize(jpeg(0, 0)), /could not be read/);
  assert.throws(() => assertImageSize(Buffer.from('garbage')), (error) => error.status === 400);
});

test('limits can be changed with environment variables', () => {
  process.env.IMAGE_MAX_DIMENSION = '100';
  try { assert.throws(() => assertImageSize(png(101, 50)), /100 pixels on a side/); assert.doesNotThrow(() => assertImageSize(png(100, 50))); }
  finally { delete process.env.IMAGE_MAX_DIMENSION; }
});

test('photo resources are checked for size during upload validation', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'img-'));
  try {
    const check = async (name, bytes) => { const file = path.join(directory, name); await fs.writeFile(file, bytes); return storage.validateResource({ path: file, originalname: name }, 'image'); };
    await check('ok.png', png(800, 600));
    await assert.rejects(check('huge.png', png(30000, 30000)), /pixels/);
    await assert.rejects(check('huge.jpg', jpeg(30000, 30000)), /pixels/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

// Safety checks for uploaded ZIP containers (.docx and .usdz) before they are stored and handed to other people's browsers
// and word processors. Catches the classic "zip bomb" (a tiny file that expands to gigabytes), including archives whose headers
// lie about their size, plus archives that try to write outside their folder, are encrypted or use ZIP64.
//
// Nothing here extracts files. Stored entries are measured from the headers; deflated entries are decompressed into a counter
// that is thrown away, and stopped the moment they exceed the size they declared.
const fs = require('fs/promises');
const { createReadStream } = require('fs');
const zlib = require('zlib');

const MB = 1024 * 1024;
const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50, ZIP64_LOCATOR = 0x07064b50;
const STORED = 0, DEFLATED = 8;

const reject = (message) => Object.assign(new Error(message), { status: 400 });
const TOO_BIG = 'The archive expands to far more data than it contains, so it was rejected as unsafe';

async function findEndRecord(handle, size) {
  const length = Math.min(size, 22 + 65535);
  const tail = Buffer.alloc(length);
  await handle.read(tail, 0, length, size - length);
  for (let position = length - 22; position >= 0; position -= 1) {
    if (tail.readUInt32LE(position) !== EOCD) continue;
    if (position >= 20 && tail.readUInt32LE(position - 20) === ZIP64_LOCATOR) throw reject('ZIP64 archives are not supported');
    return { total: tail.readUInt16LE(position + 10), directorySize: tail.readUInt32LE(position + 12), directoryOffset: tail.readUInt32LE(position + 16) };
  }
  throw reject('Not a valid ZIP archive');
}

function parseDirectory(buffer, total, fileSize, limits) {
  const entries = [];
  let position = 0;
  for (let index = 0; index < total; index += 1) {
    if (position + 46 > buffer.length || buffer.readUInt32LE(position) !== CENTRAL) throw reject('The archive is damaged');
    const flags = buffer.readUInt16LE(position + 8), method = buffer.readUInt16LE(position + 10);
    const compressed = buffer.readUInt32LE(position + 20), uncompressed = buffer.readUInt32LE(position + 24);
    const nameLength = buffer.readUInt16LE(position + 28), extraLength = buffer.readUInt16LE(position + 30), commentLength = buffer.readUInt16LE(position + 32);
    const offset = buffer.readUInt32LE(position + 42);
    if (position + 46 + nameLength > buffer.length) throw reject('The archive is damaged');
    const name = buffer.toString('utf8', position + 46, position + 46 + nameLength);
    if (flags & 0x41) throw reject('Encrypted archives are not accepted');
    if (compressed === 0xffffffff || uncompressed === 0xffffffff || offset === 0xffffffff) throw reject('ZIP64 archives are not supported');
    if (!limits.methods.includes(method)) throw reject('The archive uses a compression method that is not accepted');
    if (name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[a-zA-Z]:/.test(name) || name.split('/').includes('..')) throw reject('The archive contains an unsafe file path');
    if (offset >= fileSize) throw reject('The archive is damaged');
    entries.push({ name, method, compressed, uncompressed, offset });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// Decompresses one deflated entry into a counter and makes sure it is exactly as large as it claimed to be.
function verifyDeflated(file, start, end, expected) {
  return new Promise((resolve, reject_) => {
    const source = createReadStream(file, { start, end: end - 1 });
    const inflate = zlib.createInflateRaw();
    let produced = 0, settled = false;
    const finish = (error) => { if (settled) return; settled = true; source.destroy(); inflate.destroy(); error ? reject_(error) : resolve(); };
    source.on('error', () => finish(reject('The archive is damaged')));
    inflate.on('error', () => finish(reject('The archive is damaged')));
    inflate.on('data', (chunk) => { produced += chunk.length; if (produced > expected) finish(reject(TOO_BIG)); });
    inflate.on('end', () => finish(produced === expected ? null : reject('The archive sizes do not match its contents')));
    source.pipe(inflate);
  });
}

// options: { maxEntries, maxUncompressedBytes, maxRatio, methods }. Resolves with { entries, names, uncompressed } or throws a 400 error.
async function inspectZip(file, options = {}) {
  const limits = { maxEntries: 10000, maxUncompressedBytes: 300 * MB, maxRatio: 200, methods: [STORED, DEFLATED], ...options };
  const handle = await fs.open(file, 'r');
  try {
    const { size } = await handle.stat();
    if (size < 22) throw reject('Not a valid ZIP archive');
    const end = await findEndRecord(handle, size);
    if (end.total > limits.maxEntries) throw reject(`The archive contains too many files (more than ${limits.maxEntries})`);
    if (end.directorySize > 16 * MB || end.directoryOffset + end.directorySize > size) throw reject('The archive is damaged');
    const directory = Buffer.alloc(end.directorySize);
    await handle.read(directory, 0, end.directorySize, end.directoryOffset);
    const entries = parseDirectory(directory, end.total, size, limits);

    const uncompressed = entries.reduce((sum, entry) => sum + entry.uncompressed, 0);
    const compressed = entries.reduce((sum, entry) => sum + entry.compressed, 0);
    if (uncompressed > limits.maxUncompressedBytes) throw reject(`The archive expands to more than ${Math.round(limits.maxUncompressedBytes / MB)} MB`);
    // Ratios on small archives are meaningless (tiny XML compresses extremely well), so only judge anything of real size.
    if (uncompressed > 10 * MB && uncompressed / Math.max(compressed, 1) > limits.maxRatio) throw reject(TOO_BIG);
    for (const entry of entries)
      if (entry.uncompressed > 10 * MB && entry.uncompressed / Math.max(entry.compressed, 1) > limits.maxRatio) throw reject(TOO_BIG);

    // Headers can lie, so measure what is really there.
    const local = Buffer.alloc(30);
    for (const entry of entries) {
      await handle.read(local, 0, 30, entry.offset);
      if (local.readUInt32LE(0) !== LOCAL) throw reject('The archive is damaged');
      const start = entry.offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      if (start + entry.compressed > size) throw reject('The archive is damaged');
      if (entry.method === STORED) { if (entry.compressed !== entry.uncompressed) throw reject('The archive sizes do not match its contents'); }
      else await verifyDeflated(file, start, start + entry.compressed, entry.uncompressed);
    }
    return { entries: entries.length, names: entries.map((entry) => entry.name), uncompressed };
  } finally { await handle.close(); }
}

module.exports = { inspectZip, STORED, DEFLATED };

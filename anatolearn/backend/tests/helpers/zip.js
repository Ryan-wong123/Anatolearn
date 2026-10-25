// Builds ZIP archives for tests, including hostile ones (headers that lie, encrypted flag, ZIP64 markers, unsafe paths).
const zlib = require('zlib');

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return ~crc >>> 0;
}

// entries: [{ name, data, method: 'store' | 'deflate', declaredSize?, flags? }]; options: { zip64End?, commentLength? }
function buildZip(entries, options = {}) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? '');
    const method = entry.method === 'deflate' ? 8 : 0;
    const body = method === 8 ? zlib.deflateRawSync(data) : data;
    const declared = entry.declaredSize ?? data.length;
    const flags = entry.flags ?? 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(declared, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(declared, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, body); centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  const parts = [...locals, directory];
  if (options.zip64End) { const locator = Buffer.alloc(20); locator.writeUInt32LE(0x07064b50, 0); parts.push(locator); }
  parts.push(end);
  return Buffer.concat(parts);
}

// A realistic minimal .docx: the parts Word requires.
const docx = (extra = []) => buildZip([
  { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types/>', method: 'deflate' },
  { name: '_rels/.rels', data: '<Relationships/>', method: 'deflate' },
  { name: 'word/document.xml', data: '<w:document>' + 'Hello anatomy. '.repeat(500) + '</w:document>', method: 'deflate' },
  ...extra,
]);

module.exports = { buildZip, docx, crc32 };

// Reads the pixel size of an uploaded PNG, JPEG or WebP from its headers, without decoding it, so an image that is tiny on
// disk but enormous in pixels (a "decompression bomb" for the viewer's browser) can be refused before it is stored.
const MAX_SIDE = () => Number(process.env.IMAGE_MAX_DIMENSION) || 8000;
const MAX_PIXELS = () => (Number(process.env.IMAGE_MAX_MEGAPIXELS) || 40) * 1_000_000;

// Returns { width, height } or null when the headers are damaged or not an image of a supported type.
function imageSize(bytes) {
  try {
    if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('latin1', 12, 16) === 'IHDR')
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) { offset += 1; continue; }
        const marker = bytes[offset + 1];
        if (marker === 0xff) { offset += 1; continue; }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
        const length = bytes.readUInt16BE(offset + 2);
        const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isFrame) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
        if (length < 2) return null;
        offset += 2 + length;
      }
      return null;
    }
    if (bytes.length >= 30 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
      const kind = bytes.toString('latin1', 12, 16);
      if (kind === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
      if (kind === 'VP8 ' && bytes.readUIntLE(23, 3) === 0x2a019d) return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L' && bytes[20] === 0x2f) {
        const bits = bytes.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
    }
  } catch { /* a truncated header falls through to null */ }
  return null;
}

// Throws a 400 when the image has no readable size, a zero size, or is larger than the configured limits.
function assertImageSize(bytes, label = 'The image') {
  const size = imageSize(bytes);
  if (!size || !size.width || !size.height) throw Object.assign(new Error(`${label} could not be read as a valid image`), { status: 400 });
  if (size.width > MAX_SIDE() || size.height > MAX_SIDE() || size.width * size.height > MAX_PIXELS())
    throw Object.assign(new Error(`${label} is ${size.width}x${size.height} pixels. The most allowed is ${MAX_SIDE()} pixels on a side and ${MAX_PIXELS() / 1_000_000} megapixels in total.`), { status: 400 });
  return size;
}
module.exports = { imageSize, assertImageSize };

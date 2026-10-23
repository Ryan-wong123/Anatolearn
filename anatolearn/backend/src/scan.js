const fs = require('fs');
const net = require('net');
const { Transform } = require('stream');

// Streams a file to clamd (INSTREAM). Enabled by CLAMAV_HOST; CLAMAV_REQUIRED=true rejects uploads when the scanner is down.
async function scanFile(filePath) {
  const host = process.env.CLAMAV_HOST;
  if (!host) return { skipped: true };
  const required = process.env.CLAMAV_REQUIRED === 'true';
  try {
    const reply = await new Promise((resolve, reject) => {
      const socket = net.connect({ host, port: Number(process.env.CLAMAV_PORT) || 3310 });
      socket.setTimeout(Number(process.env.CLAMAV_TIMEOUT_MS) || 120000, () => socket.destroy(new Error('Scanner timed out')));
      let response = '';
      socket.on('data', (chunk) => { response += chunk.toString(); });
      socket.on('error', reject);
      socket.on('close', () => (response ? resolve(response.replace(/\0/g, '').trim()) : reject(new Error('Scanner closed the connection'))));
      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        const framer = new Transform({
          transform(chunk, _encoding, callback) { const size = Buffer.alloc(4); size.writeUInt32BE(chunk.length); callback(null, Buffer.concat([size, chunk])); },
          flush(callback) { callback(null, Buffer.alloc(4)); },
        });
        fs.createReadStream(filePath).on('error', reject).pipe(framer).pipe(socket);
      });
    });
    if (/FOUND$/.test(reply)) return { infected: true, reply };
    if (!/OK$/.test(reply)) throw new Error(reply);
    return { clean: true };
  } catch (error) {
    if (required) throw Object.assign(new Error('Virus scanning is unavailable. Please try again shortly.'), { status: 503 });
    console.error('Virus scan skipped (scanner unavailable):', error.message);
    return { skipped: true };
  }
}

async function assertClean(file) {
  const result = await scanFile(file.path);
  if (result.infected) throw Object.assign(new Error('Upload rejected: the file was flagged by the virus scanner'), { status: 400 });
}
module.exports = { scanFile, assertClean };

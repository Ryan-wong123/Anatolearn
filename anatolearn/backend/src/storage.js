const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const ROOT = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname,'../../public'));
// STORAGE_DRIVER=s3 keeps every teaching asset in S3 (instance role credentials). Uploads are staged
// on local disk only long enough to be validated and copied across.
const REMOTE = (process.env.STORAGE_DRIVER || 'local') === 's3';
const UPLOAD_ROOT = REMOTE ? path.join(os.tmpdir(), 'anatolearn-uploads') : ROOT;
const BUCKET = process.env.S3_BUCKET;
const PREFIX = (process.env.S3_PREFIX || '').replace(/^\/+|\/+$/g, '');
if (REMOTE && !BUCKET) throw new Error('S3_BUCKET must be set when STORAGE_DRIVER=s3');
let client;
function s3() {
  if (!client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    client = new S3Client({ region: process.env.AWS_REGION, ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}) });
  }
  return client;
}
const CONTENT_TYPES = { '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.obj': 'text/plain', '.usdz': 'model/vnd.usdz+zip',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt', '.pdf': 'application/pdf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
function objectKey(assetPath) {
  const normalized = path.posix.normalize('/' + String(assetPath));
  if (normalized.includes('..') || normalized === '/') throw Object.assign(new Error('Invalid asset path'), { status: 400 });
  return (PREFIX ? PREFIX + '/' : '') + normalized.slice(1);
}
// Copies a validated staged upload into its permanent home and returns the stored asset path.
async function persist(file, folder) {
  await require('./scan').assertClean(file);
  const assetPath = `/${folder}/${file.filename}`;
  if (!REMOTE) return assetPath;
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const { size } = await fs.stat(file.path);
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: objectKey(assetPath), Body: require('fs').createReadStream(file.path),
    ContentLength: size, ContentType: CONTENT_TYPES[path.extname(file.filename).toLowerCase()] || 'application/octet-stream' }));
  await fs.unlink(file.path).catch(() => {});
  return assetPath;
}
async function writeAsset(assetPath, bytes) {
  if (!REMOTE) { const target = resolveAsset(assetPath); await fs.mkdir(path.dirname(target), { recursive: true }); return fs.writeFile(target, bytes); }
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: objectKey(assetPath), Body: bytes,
    ContentType: CONTENT_TYPES[path.extname(assetPath).toLowerCase()] || 'application/octet-stream' }));
}
async function removeAsset(assetPath) {
  try {
    if (!REMOTE) return await fs.unlink(resolveAsset(assetPath));
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey(assetPath) }));
  } catch { /* best effort: a missing file must not block the database change */ }
}
// Streams an S3 object to the response, honouring Range so video seeking keeps working.
async function sendObject(res, assetPath, { range, filename } = {}) {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  let object;
  try { object = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: objectKey(assetPath), ...(range ? { Range: range } : {}) })); }
  catch (error) {
    const status = error.$metadata?.httpStatusCode;
    if (status === 404 || error.name === 'NoSuchKey') return res.status(404).json({ message: 'Asset not found' });
    if (status === 416) return res.status(416).end();
    throw error;
  }
  res.status(object.ContentRange ? 206 : 200);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', CONTENT_TYPES[path.extname(assetPath).toLowerCase()] || object.ContentType || 'application/octet-stream');
  if (object.ContentLength != null) res.setHeader('Content-Length', object.ContentLength);
  if (object.ContentRange) res.setHeader('Content-Range', object.ContentRange);
  if (filename) res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`);
  object.Body.on('error', () => res.destroy());
  object.Body.pipe(res);
}
function resolveAsset(assetPath) {
  const absolute = path.resolve(ROOT,'.'+assetPath);
  if (!absolute.startsWith(ROOT+path.sep)) throw Object.assign(new Error('Invalid asset path'),{status:400});
  return absolute;
}
async function readAsset(assetPath) {
  if (!REMOTE) return fs.readFile(resolveAsset(assetPath));
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const object = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: objectKey(assetPath) }));
  return Buffer.from(await object.Body.transformToByteArray());
}
async function validateModel(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const bytes = await fs.readFile(file.path);
  if (extension === '.glb') {
    if (bytes.length < 20 || bytes.toString('ascii',0,4)!=='glTF' || bytes.readUInt32LE(4)!==2 || bytes.readUInt32LE(8)!==bytes.length)
      throw Object.assign(new Error('Invalid GLB 2.0 file'),{status:400});
  } else if(extension === '.gltf') {
    let document;
    try { document=JSON.parse(bytes.toString('utf8')); } catch { throw Object.assign(new Error('Invalid glTF JSON'),{status:400}); }
    if (document.asset?.version!=='2.0') throw Object.assign(new Error('Only glTF 2.0 is supported'),{status:400});
    if ([...(document.buffers||[]),...(document.images||[])].some((item)=>item.uri&&!item.uri.startsWith('data:')))
      throw Object.assign(new Error('Upload self-contained glTF with embedded buffers/textures, or convert the complete model to GLB before uploading'),{status:400});
  } else if(extension === '.usdz') {
    if (bytes.length<30 || bytes.readUInt32LE(0)!==0x04034b50) throw Object.assign(new Error('USDZ must be a valid ZIP container'),{status:400});
  } else if(extension === '.obj' && (!/^v\s+[-\d.]/m.test(bytes.toString('utf8')) || !/^f\s+\d/m.test(bytes.toString('utf8')))) {
    throw Object.assign(new Error('OBJ must contain vertices and faces'),{status:400});
  }
}
async function referencesAsset(model, assetPath) {
  if (!model.file_path.toLowerCase().endsWith('.gltf')) return false;
  try {
    const document=JSON.parse((await readAsset(model.file_path)).toString('utf8'));
    return [...(document.buffers||[]),...(document.images||[])].some((item)=>{
      if (!item.uri || /^(data:|https?:|\/)/i.test(item.uri)) return false;
      return path.posix.normalize(path.posix.join(path.posix.dirname(model.file_path),decodeURIComponent(item.uri)))===assetPath;
    });
  } catch { return false; }
}
async function validateResource(file,type) {
  const bytes=await fs.readFile(file.path);
  const ext=path.extname(file.originalname).toLowerCase();
  const matches = type==='pdf' ? ext==='.pdf' && bytes.subarray(0,5).toString()==='%PDF-'
    : type==='document' ? (ext==='.docx' && bytes.length>=4 && bytes.readUInt32LE(0)===0x04034b50 && bytes.includes('word/') && bytes.includes('[Content_Types].xml')) || (ext==='.doc' && bytes.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex')))
    : type==='image' && ((ext==='.png' && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) || (['.jpg','.jpeg'].includes(ext) && bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))) || (ext==='.webp' && bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP'));
  if (!matches) throw Object.assign(new Error('The file contents do not match the selected PDF, document or photo format'),{status:400});
}
// Checks the container signature against the claimed extension so a renamed executable or script is not stored as video.
async function validateVideo(file) {
  const extension=path.extname(file.originalname).toLowerCase();
  const handle=await fs.open(file.path,'r');
  const head=Buffer.alloc(12);
  try { await handle.read(head,0,12,0); } finally { await handle.close(); }
  const valid=extension==='.mp4' ? head.subarray(4,8).toString('latin1')==='ftyp' : extension==='.webm' && head.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'));
  if (!valid) throw Object.assign(new Error('The file contents do not match an MP4 or WebM video'),{status:400});
}
async function validateCaptions(file) {
  if (file.size > 2 * 1024 * 1024) throw Object.assign(new Error('Caption files must be 2 MiB or smaller'),{status:400});
  const bytes=await fs.readFile(file.path);
  const text=bytes.toString('utf8').replace(/^\uFEFF/, '');
  if (text.includes('\u0000') || !/^WEBVTT(?:[ \t]|\r?\n|$)/.test(text))
    throw Object.assign(new Error('Caption file must be a UTF-8 WebVTT (.vtt) file starting with WEBVTT'),{status:400});
}
module.exports={ROOT,UPLOAD_ROOT,REMOTE,persist,writeAsset,removeAsset,sendObject,resolveAsset,readAsset,validateModel,referencesAsset,validateResource,validateVideo,validateCaptions};

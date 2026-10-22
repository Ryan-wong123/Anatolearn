const fs = require('fs/promises');
const path = require('path');
const ROOT = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname,'../../public'));
function resolveAsset(assetPath) {
  const absolute = path.resolve(ROOT,'.'+assetPath);
  if (!absolute.startsWith(ROOT+path.sep)) throw Object.assign(new Error('Invalid asset path'),{status:400});
  return absolute;
}
async function readAsset(assetPath) { return fs.readFile(resolveAsset(assetPath)); }
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
    : type==='document' ? (ext==='.docx' && bytes.length>=4 && bytes.readUInt32LE(0)===0x04034b50) || (ext==='.doc' && bytes.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11e1','hex')))
    : type==='image' && ((ext==='.png' && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) || (['.jpg','.jpeg'].includes(ext) && bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))) || (ext==='.webp' && bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP'));
  if (!matches) throw Object.assign(new Error('The file contents do not match the selected PDF, document or photo format'),{status:400});
}
async function validateCaptions(file) {
  if (file.size > 2 * 1024 * 1024) throw Object.assign(new Error('Caption files must be 2 MiB or smaller'),{status:400});
  const bytes=await fs.readFile(file.path);
  const text=bytes.toString('utf8').replace(/^\uFEFF/, '');
  if (text.includes('\u0000') || !/^WEBVTT(?:[ \t].*)?(?:\r?\n|$)(?:[\s\S]*)$/.test(text))
    throw Object.assign(new Error('Caption file must be a UTF-8 WebVTT (.vtt) file starting with WEBVTT'),{status:400});
}
module.exports={ROOT,resolveAsset,readAsset,validateModel,referencesAsset,validateResource,validateCaptions};

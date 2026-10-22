// Disposable textured, transformed-mesh fixture for manual browser regression.
const pool = require('../src/db');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const storage = require('../src/storage');
const record = path.join(require('os').tmpdir(), 'anatolearn-viewer-fixture.json');

(async () => {
  if (process.argv[2] === 'cleanup') {
    const data = JSON.parse(await fs.readFile(record, 'utf8'));
    await pool.query('DELETE FROM videos WHERE id=ANY($1::int[])', [data.videos]);
    const models = (await pool.query('DELETE FROM models WHERE id=ANY($1::int[]) RETURNING thumbnail_path', [data.models])).rows;
    for (const model of models) if (model.thumbnail_path) await fs.unlink(storage.resolveAsset(model.thumbnail_path)).catch(() => {});
    await pool.query('DELETE FROM users WHERE id=ANY($1::int[])', [data.users]);
    for (const file of data.files) await fs.unlink(storage.resolveAsset(file)).catch(() => {});
    await fs.unlink(record);
    console.log('Viewer fixtures cleaned');
    return;
  }
  try { await fs.access(record); throw new Error('Clean the existing viewer fixture first'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const data = { stamp: `viewer-${Date.now()}`, users: [], models: [], videos: [], files: [] };
  const save = () => fs.writeFile(record, JSON.stringify(data));
  await save();
  for (const role of ['teacher', 'student']) {
    const email = `${data.stamp}-${role}@example.test`;
    const user = (await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id', [data.stamp,email,await bcrypt.hash('Testing123',4),role])).rows[0];
    data.users.push(user.id); await save(); console.log(role,email);
  }
  const positions = Buffer.from(new Float32Array([-0.5,-0.7,0, 0.5,-0.7,0, 0.5,0.7,0, -0.5,0.7,0]).buffer);
  const uv = Buffer.from(new Float32Array([0,0,1,0,1,1,0,1]).buffer);
  const indices = Buffer.from(new Uint16Array([0,1,2,0,2,3]).buffer);
  const bytes = Buffer.concat([positions,uv,indices]);
  const gltf = {
    asset: {version:'2.0'}, scene:0, scenes:[{nodes:[0,1]}],
    nodes:[{mesh:0,translation:[-0.6,0,0]},{mesh:0,translation:[0.6,0,0],rotation:[0,0,Math.sin(0.15),Math.cos(0.15)]}],
    meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],
    materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1}}],
    textures:[{source:0}],
    images:[{uri:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAIUlEQVR4nGOw2Zf3H4Tlmk6AMTqfgaACXBIwPmEFg8ANAP56mcFbICvjAAAAAElFTkSuQmCC'}],
    buffers:[{uri:`data:application/octet-stream;base64,${bytes.toString('base64')}`,byteLength:bytes.length}],
    bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.length},{buffer:0,byteOffset:positions.length,byteLength:uv.length},{buffer:0,byteOffset:positions.length+uv.length,byteLength:indices.length}],
    accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3',min:[-0.5,-0.7,0],max:[0.5,0.7,0]},{bufferView:1,componentType:5126,count:4,type:'VEC2'},{bufferView:2,componentType:5123,count:6,type:'SCALAR'}],
  };
  const neutral = {cameraPosition:{x:0,y:0,z:3},target:{x:0,y:0,z:0}};
  for (const [extension,contents] of [['gltf',JSON.stringify(gltf)],['obj','v -1 -1 0\nv 1 -1 0\nv 0 1 0\nf 1 2 3\n']]) {
    const file = `/models/anatomy/${data.stamp}.${extension}`;
    data.files.push(file); await save(); await fs.writeFile(storage.resolveAsset(file),contents);
    const model = (await pool.query('INSERT INTO models(title,file_path,is_published,program_id,neutral_view) VALUES($1,$2,true,1,$3) RETURNING id', [data.stamp+'-'+extension,file,JSON.stringify(neutral)])).rows[0];
    data.models.push(model.id); await save();
  }
  const annotation = (await pool.query("INSERT INTO annotations(model_id,annotation_type,label,description,annotation_data) VALUES($1,'point','Linked test point','Two transformed meshes with an embedded texture',$2) RETURNING id",[data.models[0],JSON.stringify({position:{x:-0.6,y:0,z:0},view:{x:0,y:0,z:1,distance:3}})])).rows[0];
  await pool.query("INSERT INTO annotations(model_id,annotation_type,label,description,color,annotation_data) VALUES($1,'region_fill','Saved filled region','Persisted polygon for cache and move checks','#22d3ee',$2)", [data.models[0],JSON.stringify({position:{x:-0.6,y:0,z:0.002},view:{x:0,y:0,z:1,distance:3},opacity:0.45,projectedMask:{meshIndex:0,position:{x:-0.6,y:0,z:0.002},orientation:{x:0,y:0,z:0},size:{x:0.5,y:0.7,z:0.4},maskPoints:[{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.1,y:0.9}],mode:'fill'}})]);
  const video = (await pool.query("INSERT INTO videos(title,video_path,is_published,program_id,annotation_id) VALUES($1,'/videos/s.mp4',true,1,$2) RETURNING id",[data.stamp+'-video',annotation.id])).rows[0];
  data.videos.push(video.id); await save(); console.log(JSON.stringify({...data,annotation:annotation.id}));
})().catch((error) => { console.error(error); process.exitCode=1; }).finally(() => pool.end());

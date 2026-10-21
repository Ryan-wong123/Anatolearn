// Isolated local fixtures for browser QA; cleanup only IDs recorded by this script.
const pool=require('../src/db');
const fs=require('fs/promises');
const bcrypt=require('bcryptjs');
const storage=require('../src/storage');
const record=require('path').join(require('os').tmpdir(),'anatolearn-browser-fixture.json');
(async()=>{
  if(process.argv[2]==='cleanup'){
    const data=JSON.parse(await fs.readFile(record,'utf8'));
    await pool.query('DELETE FROM videos WHERE id=$1',[data.video]);
    const thumbnail=(await pool.query('SELECT thumbnail_path FROM models WHERE id=$1',[data.model])).rows[0]?.thumbnail_path;
    await pool.query('DELETE FROM models WHERE id=$1',[data.model]);
    if(thumbnail)await fs.unlink(storage.resolveAsset(thumbnail)).catch(()=>{});
    await pool.query('DELETE FROM quizzes WHERE id=$1',[data.quiz]);
    await pool.query('DELETE FROM question_bank WHERE category=$1',[data.stamp]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::int[])',[data.users]);
    await fs.unlink(storage.resolveAsset(data.file));await fs.unlink(record);
    console.log('Browser fixtures cleaned');return;
  }
  const stamp='browser-'+Date.now();
  const users=[];
  for(const role of ['teacher','student']){
    const email=`${stamp}-${role}@example.test`;
    const user=(await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,1) RETURNING id',[stamp,email,await bcrypt.hash('Testing123',10),role])).rows[0];
    users.push(user.id);console.log(role,email);
  }
  const file=`/models/anatomy/${stamp}.obj`;
  const model=(await pool.query('INSERT INTO models(title,file_path,is_published,program_id) VALUES($1,$2,true,1) RETURNING id',[stamp,file])).rows[0].id;
  await fs.writeFile(storage.resolveAsset(file),'v -1 -1 0\nv 1 -1 0\nv 0 1 0\nf 1 2 3\n');
  const annotation=(await pool.query("INSERT INTO annotations(model_id,annotation_type,label,description,annotation_data) VALUES($1,'point','QA point','Test annotation',$2) RETURNING id",[model,JSON.stringify({position:{x:0,y:0,z:0},view:{x:0,y:0,z:1,distance:4}})])).rows[0].id;
  const video=(await pool.query("INSERT INTO videos(title,video_path,is_published,program_id,annotation_id) VALUES($1,'/videos/s.mp4',true,1,$2) RETURNING id",[stamp,annotation])).rows[0].id;
  const quiz=(await pool.query("INSERT INTO quizzes(title,category,is_published,program_id,time_limit_seconds) VALUES($1,$1,true,1,60) RETURNING id",[stamp])).rows[0].id;
  await pool.query("INSERT INTO quiz_questions(quiz_id,question,option_a,option_b,option_c,option_d,correct_option) VALUES($1,'Choose the femur','Femur','Heart','Lung','Brain','A')",[quiz]);
  const data={users,model,quiz,video,file,stamp};await fs.writeFile(record,JSON.stringify(data));console.log(JSON.stringify(data));
})().catch((error)=>{console.error(error);process.exitCode=1;}).finally(()=>pool.end());

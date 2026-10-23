const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const app = require('../src/server');
const storage = require('../src/storage');

test('authenticated assets, permissions, programmes, assessment sessions and question bank',async(t)=>{
  const server=app.listen(0,'127.0.0.1');
  await new Promise((resolve)=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const stamp=`qa-${Date.now()}`;
  const userIds=[],modelIds=[],quizIds=[],bankIds=[],resourceIds=[],videoIds=[];
  let filePath;
  const captionPaths=[];
  const refactorPaths=[];
  async function call(path,token,body,method=body?'POST':'GET',cookie){
    const response=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return response;
  }
  async function login(role,program){
    const email=`${stamp}-${role}-${program}-${userIds.length}@example.test`;
    const id=(await pool.query('INSERT INTO users(name,email,password_hash,role,program_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[stamp,email,await bcrypt.hash('Testing123',4),role,program])).rows[0].id;
    userIds.push(id);
    const response=await call('/api/auth/login',null,{email,password:'Testing123'});
    assert.equal(response.status,200);
    const cookie=response.headers.get('set-cookie').split(';')[0];
    const token=decodeURIComponent(cookie.split('=').slice(1).join('='));return {token,cookie,id};
  }
  try{
    const teacher=await login('teacher',1),student=await login('student',1),other=await login('student',2);
    await t.test('all four programme accounts receive only assigned and shared content',async()=>{
      const rows=[];
      for(const program of [1,2,3,4,null]) {
        const row=(await pool.query('INSERT INTO models(title,file_path,is_published,program_id) VALUES($1,$2,true,$3) RETURNING *',[stamp+'-matrix', '/models/matrix.obj', program])).rows[0];
        modelIds.push(row.id); rows.push(row);
      }
      for(const program of [1,2,3,4]) {
        const account=await login('student',program);
        const listed=await(await call('/api/models',account.token)).json();
        for(const row of rows) {
          const allowed=row.program_id===null || row.program_id===program;
          assert.equal(listed.some(item=>item.id===row.id),allowed);
          assert.equal((await call(`/api/models/${row.id}`,account.token)).status,allowed?200:404);
        }
        const instructor=await login('teacher',program);
        for(const row of rows) assert.equal((await call(`/api/models/${row.id}`,instructor.token)).status,200);
      }
    });
    const model=(await pool.query('INSERT INTO models(title,file_path,is_published,program_id) VALUES($1,$2,true,1) RETURNING *',[stamp,`/models/anatomy/${stamp}.obj`])).rows[0];modelIds.push(model.id);
    filePath=storage.resolveAsset(model.file_path);await fs.mkdir(require('path').dirname(filePath),{recursive:true});await fs.writeFile(filePath,'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
    await t.test('assets require login, support cookie media/ranges and enforce account programme',async()=>{
      assert.equal((await call(model.file_path)).status,401);
      assert.equal((await call(model.file_path,null,null,'GET',student.cookie)).status,200);
      const ranged=await fetch(base+model.file_path,{headers:{Cookie:student.cookie,Range:'bytes=0-5'}});assert.equal(ranged.status,206);
      assert.equal((await call(model.file_path,other.token)).status,404);
      assert.equal((await call(`/api/models/${model.id}`,other.token)).status,404);
      assert.equal((await call(`/api/models/${model.id}/thumbnail`,student.token,{thumbnailDataUrl:'bad'},'PATCH')).status,403);
    });
    const captionFile=`/captions/${stamp}.vtt`;
    captionPaths.push(captionFile);
    await fs.mkdir(require('path').dirname(storage.resolveAsset(captionFile)),{recursive:true});
    await fs.writeFile(storage.resolveAsset(captionFile),'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nA spoken line.\n');
    const video=(await pool.query('INSERT INTO videos(title,video_path,captions_path,is_published,program_id) VALUES($1,$2,$3,true,1) RETURNING id',[stamp,`/videos/${stamp}.mp4`,captionFile])).rows[0];videoIds.push(video.id);
    await t.test('caption tracks stay authenticated and respect owning video programme access',async()=>{
      assert.equal((await call(captionFile)).status,401);
      assert.equal((await call(captionFile,student.token)).status,200);
      assert.match(await(await call(captionFile,student.token)).text(),/WEBVTT/);
      assert.equal((await call(captionFile,other.token)).status,404);
      assert.equal((await call(`/api/videos/${video.id}/captions`,student.token,null,'DELETE')).status,403);
      const form=new FormData();form.append('captions',new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nUpdated cue\n']),`${stamp}.vtt`);
      const replaced=await fetch(base+`/api/videos/${video.id}/captions`,{method:'POST',headers:{Authorization:`Bearer ${teacher.token}`},body:form});
      assert.equal(replaced.status,200);const updated=await replaced.json();assert.notEqual(updated.captions_path,captionFile);captionPaths.push(updated.captions_path);
      assert.match(await(await call(updated.captions_path,student.token)).text(),/Updated cue/);
      assert.equal((await call(`/api/videos/${video.id}/captions`,teacher.token,null,'DELETE')).status,200);
    });
    await t.test('publication is enforced without query filters and downloads require teacher permission',async()=>{
      assert.equal((await call(`/api/models/${model.id}/download`,student.token)).status,403);
      assert.equal((await call(`/api/models/${model.id}/download`,teacher.token)).status,403);
      assert.equal((await call(`/api/models/${model.id}/download-permission`,teacher.token,{is_downloadable:true},'PATCH')).status,200);
      assert.equal((await call(`/api/models/${model.id}/download`,student.token)).status,200);
      await call(`/api/models/${model.id}/publish`,teacher.token,{is_published:false},'PATCH');
      const listed=await(await call('/api/models',student.token)).json();assert.ok(!listed.some((m)=>m.id===model.id));
      assert.equal((await call(model.file_path,student.token)).status,404);
      assert.equal((await call(`/api/models/${model.id}/annotations`,student.token)).status,404);
      assert.equal((await call(`/api/models/${model.id}`,teacher.token)).status,200);
    });
    await t.test('programme assignment changes server access',async()=>{
      await call(`/api/models/${model.id}/publish`,teacher.token,{is_published:true},'PATCH');
      assert.equal((await call(`/api/models/${model.id}/program`,teacher.token,{program_id:2},'PATCH')).status,200);
      assert.equal((await call(`/api/models/${model.id}`,student.token)).status,404);
      assert.equal((await call(`/api/models/${model.id}`,other.token)).status,200);
    });
    const quiz=(await pool.query("INSERT INTO quizzes(title,type,is_published,program_id) VALUES($1,'Mixed',true,1) RETURNING *",[stamp])).rows[0];quizIds.push(quiz.id);
    const q1=(await pool.query("INSERT INTO quiz_questions(quiz_id,question,option_a,option_b,option_c,option_d,correct_option) VALUES($1,'Pick B','A','B','C','D','B') RETURNING *",[quiz.id])).rows[0];
    const q2=(await pool.query("INSERT INTO quiz_questions(quiz_id,question,format,model_answer) VALUES($1,'Name a bone','open_ended','Femur') RETURNING *",[quiz.id])).rows[0];
    let session,attempt;
    await t.test('timer configuration and start snapshot omit answer keys',async()=>{
      assert.equal((await call(`/api/quizzes/${quiz.id}/timer`,teacher.token,{time_limit_seconds:60},'PATCH')).status,200);
      assert.equal((await call(`/api/quizzes/${quiz.id}/start`,other.token,{})).status,404);
      session=await(await call(`/api/quizzes/${quiz.id}/start`,student.token,{})).json();
      assert.ok(session.expires_at);assert.equal(session.questions.length,2);assert.ok(!('correct_option' in session.questions[0]));
    });
    await t.test('invalid submissions create no partial attempts, successful submissions are single use',async()=>{
      const bad=await call(`/api/quizzes/${quiz.id}/submit`,student.token,{session_id:session.session_id,answers:[{question_id:q1.id,selected_option:'B'},{question_id:q1.id,selected_option:'B'}]});assert.equal(bad.status,400);
      assert.equal(Number((await pool.query('SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=$1',[quiz.id])).rows[0].count),0);
      const body={session_id:session.session_id,answers:[{question_id:q1.id,selected_option:'B'},{question_id:q2.id,answer_text:'Femur'}]};
      const response=await call(`/api/quizzes/${quiz.id}/submit`,student.token,body);assert.equal(response.status,200);attempt=(await response.json()).attempt;
      assert.equal((await call(`/api/quizzes/${quiz.id}/submit`,student.token,body)).status,409);
    });
    await t.test('attempt ownership and transactional grading preserve complete results',async()=>{
      assert.equal((await call(`/api/attempts/${attempt.id}`,other.token)).status,404);
      assert.equal((await call(`/api/attempts/${attempt.id}/answers`,other.token)).status,404);
      assert.equal((await call(`/api/attempts/${attempt.id}`,student.token)).status,200);
      const answers=await(await call(`/api/attempts/${attempt.id}/answers`,teacher.token)).json();
      assert.equal((await call(`/api/attempt-answers/${answers.find(a=>a.question_id===q2.id).id}/grade`,teacher.token,{teacher_score:80},'PATCH')).status,200);
      const result=await(await call(`/api/attempts/${attempt.id}`,student.token)).json();assert.equal(result.score,90);assert.equal(result.status,'graded');
      const all=await(await call(`/api/quizzes/${quiz.id}/attempts`,teacher.token)).json();assert.ok(all.some(a=>a.id===attempt.id&&a.status==='graded'));
    });
    await t.test('expired sessions reject late answers',async()=>{
      const expired=await(await call(`/api/quizzes/${quiz.id}/start`,student.token,{})).json();
      await pool.query("UPDATE quiz_sessions SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[expired.session_id]);
      assert.equal((await call(`/api/quizzes/${quiz.id}/submit`,student.token,{session_id:expired.session_id,answers:[]})).status,409);
    });
    await t.test('a failure inserting answers rolls back the attempt and leaves the session reusable',async()=>{
      const fresh=await(await call(`/api/quizzes/${quiz.id}/start`,student.token,{})).json();
      await pool.query('UPDATE quiz_sessions SET questions=$1 WHERE id=$2',[JSON.stringify([{id:-1,format:'mcq',correct_option:'A'}]),fresh.session_id]);
      const before=Number((await pool.query('SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=$1',[quiz.id])).rows[0].count);
      assert.equal((await call(`/api/quizzes/${quiz.id}/submit`,student.token,{session_id:fresh.session_id,answers:[{question_id:-1,selected_option:'A'}]})).status,500);
      assert.equal(Number((await pool.query('SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=$1',[quiz.id])).rows[0].count),before);
      assert.equal((await pool.query('SELECT submitted_at FROM quiz_sessions WHERE id=$1',[fresh.session_id])).rows[0].submitted_at,null);
    });
    await t.test('teacher question bank categorises, edits and copies independently into quizzes',async()=>{
      assert.equal((await call('/api/question-bank',student.token)).status,403);
      const saved=await(await call(`/api/question-bank/from-question/${q1.id}`,teacher.token,{category:'Muscular'})).json();bankIds.push(saved.id);
      assert.equal((await call(`/api/question-bank/${saved.id}`,teacher.token,{...saved,question:'Updated bank question'},'PUT')).status,200);
      const copyQuiz=(await pool.query("INSERT INTO quizzes(title) VALUES($1) RETURNING *",[stamp+'-copy'])).rows[0];quizIds.push(copyQuiz.id);
      const copied=await call(`/api/quizzes/${copyQuiz.id}/bank-questions/${saved.id}`,teacher.token,{});assert.equal(copied.status,201);assert.equal((await copied.json()).category,'Muscular');
      assert.equal((await call(`/api/question-bank/${saved.id}`,teacher.token,null,'DELETE')).status,200);
      assert.equal(Number((await pool.query('SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=$1',[copyQuiz.id])).rows[0].count),1);
    });
    await t.test('active sessions lock quiz questions and cancellation safely permits editing again',async()=>{
      const id=quizIds[quizIds.length-1];
      await pool.query('UPDATE quizzes SET is_published=true,program_id=1 WHERE id=$1',[id]);
      const question=(await pool.query('SELECT * FROM quiz_questions WHERE quiz_id=$1',[id])).rows[0];
      const active=await(await call(`/api/quizzes/${id}/start`,student.token,{})).json();
      assert.equal((await call(`/api/questions/${question.id}`,teacher.token,{...question,question:'Revised question'},'PUT')).status,409);
      await pool.query("UPDATE quiz_sessions SET expires_at=NOW()-INTERVAL '3 seconds' WHERE id=$1",[active.session_id]);
      assert.equal((await call(`/api/questions/${question.id}`,teacher.token,{...question,question:'During transport grace'},'PUT')).status,409);
      assert.equal((await call(`/api/quiz-sessions/${active.session_id}/cancel`,student.token,{})).status,200);
      assert.equal((await call(`/api/questions/${question.id}`,teacher.token,{...question,question:'Revised question'},'PUT')).status,200);
    });
    await t.test('abandoned untimed sessions expire and maintenance preserves active sessions',async()=>{
      const id=quizIds[quizIds.length-1];
      const expired=await(await call(`/api/quizzes/${id}/start`,student.token,{})).json();
      const active=await(await call(`/api/quizzes/${id}/start`,student.token,{})).json();
      await pool.query("UPDATE quiz_sessions SET session_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[expired.session_id]);
      assert.equal((await call(`/api/quizzes/${id}/submit`,student.token,{session_id:expired.session_id,answers:[]})).status,409);
      await require('../src/maintenance').cleanupSessions(pool);
      const rows=(await pool.query('SELECT id,submitted_at FROM quiz_sessions WHERE id=ANY($1::uuid[])',[[expired.session_id,active.session_id]])).rows;
      assert.ok(rows.find(r=>r.id===expired.session_id).submitted_at);
      assert.equal(rows.find(r=>r.id===active.session_id).submitted_at,null);
      await call(`/api/quiz-sessions/${active.session_id}/cancel`,student.token,{});
    });
    await t.test('content deletion removes polymorphic favourites through database triggers',async()=>{
      const id=quizIds[quizIds.length-1];
      assert.equal((await call('/api/favorites',student.token,{item_type:'quiz',item_id:id})).status,201);
      assert.equal((await call(`/api/quizzes/${id}`,teacher.token,null,'DELETE')).status,200);
      assert.equal(Number((await pool.query("SELECT COUNT(*) FROM favorites WHERE item_type='quiz' AND item_id=$1",[id])).rows[0].count),0);
    });
    await t.test('public routes and registration preserve their contracts after module extraction',async()=>{
      assert.equal((await call('/api/health')).status,200);
      assert.equal((await call('/api/programs')).status,200);
      const email=`${stamp}-registration@example.test`;
      const registered=await call('/api/auth/register',null,{name:stamp,email,password:'Testing123',role:'student',program_id:1});
      assert.equal(registered.status,201);
      const account=await registered.json();userIds.push(account.id);
      assert.equal(account.email,email);
      assert.equal('password_hash' in account,false);
      assert.equal((await call('/api/auth/register',null,{name:stamp,email,password:'Testing123',role:'student'})).status,409);
      assert.equal((await call('/api/auth/login',null,{email,password:'incorrect'})).status,401);
      assert.equal((await call('/api/auth/logout',null,{})).status,200);
      const untrusted=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
      assert.equal(untrusted.status,403);
    });
    await t.test('model authoring, annotations and exports preserve response and file contracts',async()=>{
      const form=new FormData();form.append('title',stamp+'-refactor');
      // The model upload field remains "model".
      form.append('model',new Blob(['v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n']),'fixture.obj');
      const upload=await fetch(base+'/api/models/upload',{method:'POST',headers:{Authorization:`Bearer ${teacher.token}`},body:form});
      assert.equal(upload.status,201);const created=await upload.json();modelIds.push(created.id);refactorPaths.push(created.file_path);
      const id=created.id;
      assert.equal((await call(`/api/models/${id}`,teacher.token,{title:stamp+'-updated',body_system:'Muscular'},'PUT')).status,200);
      assert.equal((await call(`/api/models/${id}/neutral-view`,teacher.token,{cameraPosition:{x:0,y:0,z:5},target:{x:0,y:0,z:0}},'PATCH')).status,200);
      assert.equal((await call(`/api/models/${id}/publish`,teacher.token,{is_published:true},'PATCH')).status,200);
      const filtered=await(await call(`/api/models?system=Muscular&q=${encodeURIComponent(stamp+'-updated')}`,student.token)).json();
      assert.ok(filtered.some(row=>row.id===id));
      const unmatched=await(await call(`/api/models?q=${encodeURIComponent("' OR 1=1 --")}`,student.token)).json();
      assert.equal(unmatched.length,0);
      assert.equal((await call(`/api/models/${id}/download-permission`,teacher.token,{is_downloadable:true},'PATCH')).status,200);
      const download=await call(`/api/models/${id}/download`,student.token);
      assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);assert.match(await download.text(),/v 0 0 0/);
      const annotation=await call(`/api/models/${id}/annotations`,teacher.token,{annotation_type:'point',label:'Fixture point',annotation_data:{position:{x:0,y:0,z:0}}});
      assert.equal(annotation.status,201);const saved=await annotation.json();
      assert.equal((await call(`/api/annotations/${saved.id}`,teacher.token,{annotation_type:'point',label:'Updated point',annotation_data:{}},'PUT')).status,200);
      assert.equal((await call(`/api/models/${id}/annotations`,student.token)).status,200);
      const jsonExport=await call(`/api/models/${id}/annotations/export`,teacher.token);
      assert.match(jsonExport.headers.get('content-disposition'),/annotations.json/);assert.equal((await jsonExport.json())[0].label,'Updated point');
      const csvExport=await call(`/api/models/${id}/annotations/export?format=csv`,teacher.token);
      assert.match(csvExport.headers.get('content-type'),/text\/csv/);assert.match(await csvExport.text(),/Updated point/);
      assert.equal((await call(`/api/annotations/${saved.id}`,teacher.token,null,'DELETE')).status,200);
      assert.equal((await call(`/api/models/${id}`,teacher.token,null,'DELETE')).status,200);
    });
    await t.test('quiz, resource and video management and favourites retain their APIs',async()=>{
      const createdQuiz=await call('/api/quizzes',teacher.token,{title:stamp+'-crud',type:'MCQ',program_id:1});
      assert.equal(createdQuiz.status,201);const quiz=await createdQuiz.json();quizIds.push(quiz.id);
      assert.equal((await call(`/api/quizzes/${quiz.id}`,teacher.token,{title:stamp+'-revised'},'PUT')).status,200);
      assert.equal((await call(`/api/quizzes/${quiz.id}/publish`,teacher.token,{is_published:true},'PATCH')).status,200);
      assert.equal((await call('/api/favorites',student.token,{item_type:'quiz',item_id:quiz.id})).status,201);
      const favorites=await(await call('/api/favorites',student.token)).json();
      assert.ok(favorites.quizzes.some(row=>row.id===quiz.id));
      assert.equal((await call(`/api/favorites/quiz/${quiz.id}`,student.token,null,'DELETE')).status,200);
      const link=await call('/api/resources/upload',teacher.token,{title:stamp,resource_type:'link',url:'https://example.com',program_id:1});
      assert.equal(link.status,201);const resource=await link.json();resourceIds.push(resource.id);
      assert.equal((await call(`/api/resources/${resource.id}`,teacher.token,{title:stamp+'-updated',url:'https://example.com/updated'},'PUT')).status,200);
      assert.equal((await call(`/api/resources/${resource.id}/publish`,teacher.token,{is_published:true},'PATCH')).status,200);
      assert.equal((await call('/api/resources',student.token)).status,200);
      assert.equal((await call(`/api/resources/${resource.id}`,teacher.token,null,'DELETE')).status,200);
      const videoForm=new FormData();videoForm.append('title',stamp);videoForm.append('video',new Blob(['fixture video']),'fixture.mp4');
      const uploadedVideo=await fetch(base+'/api/videos/upload',{method:'POST',headers:{Authorization:`Bearer ${teacher.token}`},body:videoForm});
      assert.equal(uploadedVideo.status,201);const video=await uploadedVideo.json();videoIds.push(video.id);refactorPaths.push(video.video_path);
      assert.equal((await call(`/api/videos/${video.id}`,teacher.token,{title:stamp+'-updated'},'PUT')).status,200);
      assert.equal((await call(`/api/videos/${video.id}/publish`,teacher.token,{is_published:true},'PATCH')).status,200);
      assert.equal((await call(`/api/videos/${video.id}`,student.token)).status,200);
      assert.equal((await call(`/api/videos/${video.id}`,teacher.token,null,'DELETE')).status,200);
    });
    await t.test('photo materials upload, authenticated delivery and logout cookie clearing',async()=>{
      const form=new FormData();form.append('title',stamp);form.append('resource_type','image');form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9x8AAAAASUVORK5CYII=','base64')]),'photo.png');
      const upload=await fetch(base+'/api/resources/upload',{method:'POST',headers:{Authorization:`Bearer ${teacher.token}`},body:form});assert.equal(upload.status,201);const resource=await upload.json();resourceIds.push(resource.id);
      assert.equal((await call(resource.file_path)).status,401);assert.equal((await call(resource.file_path,teacher.token)).status,200);
      await fs.unlink(storage.resolveAsset(resource.file_path));
      const logout=await call('/api/auth/logout',null,{},'POST',student.cookie);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Expires=/);
      assert.equal((await call('/api/models',student.token)).status,401);
      assert.equal((await call('/api/models',null,null,'GET',student.cookie)).status,401);
      assert.equal((await call('/api/models',teacher.token)).status,200);
    });
  } finally {
    await pool.query('DELETE FROM models WHERE id=ANY($1::int[])',[modelIds]);
    await pool.query('DELETE FROM quizzes WHERE id=ANY($1::int[])',[quizIds]);
    await pool.query('DELETE FROM question_bank WHERE id=ANY($1::int[])',[bankIds]);
    await pool.query('DELETE FROM resources WHERE id=ANY($1::int[])',[resourceIds]);
    await pool.query('DELETE FROM videos WHERE id=ANY($1::int[])',[videoIds]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::int[])',[userIds]);
    if(filePath)await fs.unlink(filePath).catch(()=>{});
    for(const asset of captionPaths)await fs.unlink(storage.resolveAsset(asset)).catch(()=>{});
    for(const asset of refactorPaths)await fs.unlink(storage.resolveAsset(asset)).catch(()=>{});
    await new Promise((resolve)=>server.close(resolve));await pool.end();
  }
});

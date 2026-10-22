const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canRead, canDownload } = require('../src/access');
const { validateAnswers } = require('../src/assessments');
const { validQuestion } = require('../src/questionBank');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { validateCaptions } = require('../src/storage');
test('student access requires publication and the account programme, with shared content allowed',()=>{
  const student={role:'student',program_id:2};
  assert.equal(canRead(student,{is_published:false,program_id:2}),false);
  assert.equal(canRead(student,{is_published:true,program_id:1}),false);
  assert.equal(canRead(student,{is_published:true,program_id:2}),true);
  assert.equal(canRead(student,{is_published:true,program_id:null}),true);
  assert.equal(canRead({role:'teacher'},{is_published:false,program_id:1}),true);
  for(const account of [1,2,3,4])for(const target of [1,2,3,4])
    assert.equal(canRead({role:'student',program_id:account},{is_published:true,program_id:target}),account===target);
});
test('disabled downloads are blocked for both roles independently of viewing permission',()=>{
  for(const role of ['student','teacher']){
    const user={role,program_id:1};
    assert.equal(canDownload(user,{is_published:true,program_id:1,is_downloadable:false}),false);
    assert.equal(canDownload(user,{is_published:true,program_id:1,is_downloadable:true}),true);
  }
});
test('assessment answers must contain each session question once and reject foreign ids and invalid options',()=>{
  const questions=[{id:1,format:'mcq'},{id:2,format:'open_ended'}];
  const answers=[{question_id:1,selected_option:'A'},{question_id:2,answer_text:'Example'}];
  assert.equal(validateAnswers(questions,answers),true);
  assert.equal(validateAnswers(questions,[answers[0],answers[0]]),false);
  assert.equal(validateAnswers(questions,[answers[0]]),false);
  assert.equal(validateAnswers(questions,[answers[0],{question_id:3}]),false);
  assert.equal(validateAnswers(questions,[{question_id:1,selected_option:'Z'},answers[1]]),false);
});
test('question bank validates MCQ keys and model answers',()=>{
  assert.ok(validQuestion({question:'Name a bone',format:'open_ended',model_answer:'Femur'}));
  assert.equal(Boolean(validQuestion({question:'Name a bone',format:'open_ended'})),false);
  assert.equal(Boolean(validQuestion({question:'Pick',format:'mcq',option_a:'A',option_b:'B',option_c:'C',option_d:'D',correct_option:'E'})),false);
});
test('WebVTT caption upload accepts valid UTF-8 and rejects malformed or oversized files',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'anatolearn-vtt-'));
  const filePath=path.join(dir,'sample.vtt');
  try {
    const valid='WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nA spoken line.\n';
    await fs.writeFile(filePath,valid);
    await validateCaptions({path:filePath,size:Buffer.byteLength(valid)});
    const invalid='not a caption file';
    await fs.writeFile(filePath,invalid);
    await assert.rejects(validateCaptions({path:filePath,size:Buffer.byteLength(invalid)}),/WebVTT/);
    await assert.rejects(validateCaptions({path:filePath,size:2*1024*1024+1}),/2 MiB/);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

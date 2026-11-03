const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { validQuestion } = require('../src/modules/questions/question.validation');
const { gradeRegion, gradeMatching, valid3DAnswer } = require('../src/modules/assessments/threeDGrading');

const marker = (id, label) => ({ id, label, position: {x:id,y:0,z:0}, normal: {x:0,y:0,z:1}, meshIndex:0 });
const region = () => ({
  points:[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:1,y:1,z:0},{x:0,y:1,z:0}],
  projectedMask:{meshIndex:0,mode:'fill',position:{x:0.5,y:0.5,z:0},orientation:{x:0,y:0,z:0},size:{x:1.25,y:1.25,z:1},
    maskPoints:[{x:0.1,y:0.9},{x:0.9,y:0.9},{x:0.9,y:0.1},{x:0.1,y:0.1}]},
});
const customQuestion = (format, content) => ({question:'Identify this structure',format,question_config:{model_id:31,source:'custom',...content}});

test('existing annotation configurations remain backward compatible', () => {
  assert.equal(validQuestion({question:'Region?',format:'region_identification',question_config:{model_id:5,reference_annotation_id:23}}),true);
  assert.equal(validQuestion({question:'Match?',format:'annotation_matching',question_config:{model_id:5,annotation_ids:[1,2]}}),true);
});
test('custom regions have a valid projector and bounded polygon', () => {
  assert.equal(validQuestion(customQuestion('region_identification',{custom_region:region()})),true);
  assert.equal(validQuestion(customQuestion('region_identification',{custom_region:{...region(),points:[region().points[0]]}})),false);
  assert.equal(validQuestion(customQuestion('region_identification',{custom_region:{...region(),projectedMask:{...region().projectedMask,size:{x:0,y:1,z:1}}}})),false);
});
test('custom matching requires distinct labels and surface points', () => {
  assert.equal(validQuestion(customQuestion('annotation_matching',{custom_markers:[marker(1,'Masseter'),marker(2,'Temporalis')]})),true);
  assert.equal(validQuestion(customQuestion('annotation_matching',{custom_markers:[marker(1,'Masseter'),marker(2,' masseter ')]})),false);
  assert.equal(validQuestion(customQuestion('annotation_matching',{custom_markers:[marker(1,'Masseter')]})),false);
  assert.equal(validQuestion(customQuestion('annotation_matching',{custom_markers:[marker(1,'A'),{...marker(2,'B'),position:{x:Infinity,y:0,z:0}}]})),false);
});

test('new custom matching supports professor-selected structure counts with a drawn region per number', () => {
  const customMarkers=Array.from({length:8},(_,i)=>({...marker(i+1,`Structure ${i+1}`),region:region()}));
  const payload=customQuestion('annotation_matching',{target_count:8,custom_markers:customMarkers});
  assert.equal(validQuestion(payload),true);
  assert.equal(validQuestion(customQuestion('annotation_matching',{target_count:7,custom_markers:customMarkers})),false);
  assert.equal(validQuestion(customQuestion('annotation_matching',{target_count:8,custom_markers:customMarkers.map((m,i)=>i===0?{...m,region:undefined}:m)})),false);
  assert.equal(validQuestion(customQuestion('annotation_matching',{target_count:13,custom_markers:customMarkers})),false);
  const answers={matches:Object.fromEntries(customMarkers.map(m=>[m.id,m.label]))};
  assert.equal(valid3DAnswer({format:'annotation_matching'},answers),true);
  assert.equal(gradeMatching(Object.fromEntries(customMarkers.map(m=>[m.id,m.label])),answers).score,100);
});
test('custom region is scored by the same server algorithm as existing regions', () => {
  const data=region();
  const result=gradeRegion({projectedMask:data.projectedMask},{points:data.points});
  assert.equal(result.score,100);
  assert.equal(result.correct,true);
});
test('custom marker IDs are used to grade partial matching correctly', () => {
  const result=gradeMatching({'1':'Masseter','2':'Temporalis'},{matches:{'1':'Masseter','2':'Masseter'}});
  assert.equal(result.score,50);
  assert.equal(result.correct,false);
});

test('starting a custom 3D quiz snapshots answers without exposing the reference to students', async() => {
  const servicePath=path.resolve(__dirname,'../src/modules/assessments/assessments.service.js');
  const originalLoad=Module._load;
  const questions=[
    {...customQuestion('region_identification',{custom_region:region()}),id:101},
    {...customQuestion('annotation_matching',{target_count:2,custom_markers:[{...marker(3,'Masseter'),region:region()},{...marker(4,'Temporalis'),region:region()}]}),id:102},
  ];
  const queries=[];
  let sessionQuestions;
  const savedAnswers=[];
  const client={query:async(sql)=>{queries.push(sql);throw new Error('No annotation table query should be needed');},release(){}};
  const repository={
    begin:async()=>{},rollback:async()=>{},commit:async()=>{},lockStartForStudent:async()=>{},
    findQuizForShare:async()=>({rows:[{id:22,is_published:true}]}),
    findActiveSession:async()=>({rows:[]}),
    listQuizQuestions:async()=>({rows:structuredClone(questions)}),
    insertSession:async([id,quizId,studentId,_timer,snapshot])=>{
      sessionQuestions=JSON.parse(snapshot);
      return {rows:[{id,quiz_id:quizId,student_id:studentId,
        expires_at:null,server_now:new Date().toISOString(),session_expires_at:new Date(Date.now()+3600000).toISOString(),questions:sessionQuestions,draft_answers:{},draft_revision:0}]};
    },
    lockOwnedSession:async()=>({rows:[{questions:sessionQuestions,submitted_at:null,
      server_now:new Date().toISOString(),session_expires_at:new Date(Date.now()+3600000).toISOString(),expires_at:null}]}),
    insertAttempt:async()=>({rows:[{id:73}]}),
    insertAnswer:async params=>{savedAnswers.push(params);return {rows:[]};},
    completeSession:async()=>({rows:[]})
  };
  Module._load=function(request,parent,isMain){
    if(parent?.filename===servicePath){
      if(request==='./assessments.repository') return repository;
      if(request==='../../db') return {connect:async()=>client};
      if(request==='../../access') return {canRead:()=>true};
    }
    return originalLoad.apply(this,arguments);
  };
  let service;
  try{delete require.cache[servicePath];service=require(servicePath);}
  finally{Module._load=originalLoad;}
  const result=await service.startQuiz({params:{id:22},user:{id:9,role:'student'}});
  assert.equal(result.status,200);
  assert.equal(queries.length,0);
  const [shownRegion,shownMatching]=result.body.questions;
  for(const q of result.body.questions){
    assert.equal(q.question_config,undefined);
    assert.equal(q.reference_mask,undefined);
    assert.equal(q.matching_key,undefined);
  }
  assert.deepEqual(shownRegion.student_config,{model_id:31});
  assert.equal(shownMatching.student_config.custom_markers[0].label,undefined);
  assert.equal(shownMatching.student_config.custom_markers[0].region.points,undefined);
  assert.equal(shownMatching.student_config.custom_markers[0].region.projectedMask.mode,'fill');
  assert.deepEqual(shownMatching.student_config.marker_ids,[3,4]);
  assert.deepEqual([...shownMatching.student_config.options].sort(),['Masseter','Temporalis']);
  // Now submit the returned session. Its private snapshot must still contain
  // enough information to grade without fetching public model annotations.
  const submitted=await service.submitQuiz({params:{id:22},user:{id:9,role:'student'},body:{session_id:result.body.session_id,
    answers:[{question_id:101,answer_json:{points:region().points}},
      {question_id:102,answer_json:{matches:{'3':'Masseter','4':'Temporalis'}}}]}});
  assert.equal(submitted.status,200);
  assert.equal(submitted.body.score,100);
  assert.equal(savedAnswers.length,2);
  const review=JSON.parse(savedAnswers[0][7]);
  assert.equal(review.reference_annotation_id,null);
  assert.equal(review.reference_mask.mode,'fill');
  assert.equal(queries.length,0);
});

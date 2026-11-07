const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const editorPath = path.resolve(__dirname, '../src/modules/quizzes/editor.service.js');
const realLoad = Module._load;

const mcq = (id) => ({
  ...(id ? { id } : {}),
  question: 'Which muscle closes the jaw?', format: 'mcq', category: null,
  option_a: 'Masseter', option_b: 'Trapezius', option_c: 'Biceps', option_d: 'Deltoid',
  correct_option: 'A', model_answer: null, question_config: null,
});

function makeService({ existing = null, used = false, throwOn = null } = {}) {
  const calls = [];
  let generatedId = 200;
  const client = {
    async query(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (throwOn && sql.includes(throwOn)) throw new Error('database error');
      if (sql.includes('SELECT * FROM quizzes WHERE id=')) return {rows: existing ? [existing] : []};
      if (sql.includes('SELECT * FROM quiz_questions WHERE')) return {rows: existing?.questions || []};
      if (sql.includes('INSERT INTO quizzes')) return {rows:[{id:999}]};
      if (sql.includes('INSERT INTO quiz_questions')) return {rows:[{id:generatedId++,question:parameters[0],format:parameters[1]}]};
      if (sql.includes('UPDATE quiz_questions')) return {rows:[{id:parameters[10],question:parameters[0]}]};
      if (sql.includes('UPDATE quizzes SET')) return {rows:[{id:parameters[4],title:parameters[0],type:parameters[3]}]};
      return {rows:[]};
    },
    release() { calls.push({sql:'RELEASE'}); },
  };
  const pool = { connect:async()=>client };
  delete require.cache[editorPath];
  Module._load = function(request, parent, isMain) {
    if (parent?.filename === editorPath) {
      if (request === '../../db') return pool;
      if (request === '../questions/questions.service') return {validate3DReferences:async()=>null};
      if (request === '../questions/questions.repository') return {findQuizUsage:async()=>({rows:used?[{exists:true}]:[]})};
    }
    return realLoad.apply(this, arguments);
  };
  let service;
  try { service = require(editorPath); }
  finally { Module._load = realLoad; }
  return { service, calls };
}

const input = (questions, id = null, title = 'Anatomy Revision') => ({
  params: id == null ? {} : {id:String(id)}, user:{id:5,role:'teacher'},
  body:{title,description:'A practice quiz',category:'Anatomy',questions},
});

test('new quiz saves only on commit, with a single transaction', async()=>{
  const {service,calls} = makeService();
  const result = await service.commitQuizEditor(input([mcq()]));
  assert.equal(result.status,201);
  assert.equal(result.body.quiz.id,999);
  assert.equal(calls[0].sql,'BEGIN');
  assert.equal(calls.at(-2).sql,'COMMIT');
  assert.match(calls.map(c=>c.sql).join('\n'),/INSERT INTO quizzes/);
  assert.match(calls.map(c=>c.sql).join('\n'),/INSERT INTO quiz_questions/);
});

test('invalid draft never opens a DB transaction', async()=>{
  const {service,calls}=makeService();
  const result=await service.commitQuizEditor(input([{...mcq(), option_b:''}]));
  assert.equal(result.status,400);
  assert.equal(calls.length,0);
});

test('editing existing quiz updates questions and removes deleted questions in one transaction',async()=>{
  const {service,calls}=makeService({existing:{id:19,questions:[mcq(81),mcq(82)]}});
  const result=await service.commitQuizEditor(input([{...mcq(81),question:'Updated question'},mcq()],19));
  assert.equal(result.status,200);
  assert.ok(calls.some(c=>c.sql.includes('UPDATE quiz_questions')));
  assert.ok(calls.some(c=>c.sql.includes('INSERT INTO quiz_questions')));
  assert.ok(calls.some(c=>c.sql.includes('DELETE FROM quiz_questions')));
  assert.equal(calls.at(-2).sql,'COMMIT');
});

test('question edits are blocked when student attempts exist',async()=>{
  const {service,calls}=makeService({existing:{id:19,questions:[mcq(81)]},used:true});
  const result=await service.commitQuizEditor(input([{...mcq(81),question:'Changed'}],19));
  assert.equal(result.status,409);
  assert.equal(calls.at(-2).sql,'ROLLBACK');
  assert.equal(calls.some(c=>c.sql.includes('UPDATE quiz_questions')),false);
});

test('metadata-only edits remain permitted without mutating attempted questions',async()=>{
  const {service,calls}=makeService({existing:{id:19,questions:[mcq(81)]},used:true});
  const result=await service.commitQuizEditor(input([mcq(81)],19,'New title'));
  assert.equal(result.status,200);
  assert.equal(calls.some(c=>c.sql.includes('UPDATE quiz_questions')),false);
  assert.equal(calls.some(c=>c.sql.includes('DELETE FROM quiz_questions')),false);
  assert.equal(calls.at(-2).sql,'COMMIT');
});

test('database failures roll back all changes',async()=>{
  const {service,calls}=makeService({throwOn:'INSERT INTO quiz_questions'});
  const originalConsoleError=console.error;
  console.error=()=>{};
  let result;
  try {result=await service.commitQuizEditor(input([mcq()]));}
  finally {console.error=originalConsoleError;}
  assert.equal(result.status,500);
  assert.equal(calls.at(-2).sql,'ROLLBACK');
});

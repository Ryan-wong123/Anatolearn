const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validDraftAnswers } = require('../src/modules/assessments/draftValidation');
const questions = [
  { id: 1, format: 'mcq' }, { id: 2, format: 'open_ended' },
  { id: 3, format: 'region_identification' }, { id: 4, format: 'annotation_matching' },
];
test('quiz autosave accepts partial and cleared answers, including 3D drafts', () => {
  assert.equal(validDraftAnswers(questions, {}), true);
  assert.equal(validDraftAnswers(questions, {1:'B',2:'working draft'}), true);
  assert.equal(validDraftAnswers(questions, {1:'',3:JSON.stringify({points:[{x:1,y:2,z:3}]})}), true);
  assert.equal(validDraftAnswers(questions, {4:JSON.stringify({matches:{'9':'Temporalis'}})}), true);
});
test('quiz autosave rejects unrelated and malformed response data', () => {
  assert.equal(validDraftAnswers(questions, {'999':'A'}), false);
  assert.equal(validDraftAnswers(questions, {1:'X'}), false);
  assert.equal(validDraftAnswers(questions, {2:'x'.repeat(20001)}), false);
  assert.equal(validDraftAnswers(questions, {3:'{not json'}), false);
  assert.equal(validDraftAnswers(questions, {4:JSON.stringify({matches:{key:5}})}), false);
  assert.equal(validDraftAnswers(questions, []), false);
  assert.equal(validDraftAnswers(questions, null), false);
});
test('quiz autosave bounds 3D payloads and rejects invalid coordinates', () => {
  assert.equal(validDraftAnswers(questions, {3:JSON.stringify({points:[{x:Infinity,y:0,z:1}]})}), false);
  assert.equal(validDraftAnswers(questions, {3:JSON.stringify({points:[{x:1e10,y:0,z:1}]})}), false);
  assert.equal(validDraftAnswers(questions, {3:JSON.stringify({points:Array.from({length:257},(_,i)=>({x:i,y:0,z:0}))})}), false);
});

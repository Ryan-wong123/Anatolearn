const { test } = require('node:test');
const assert = require('node:assert/strict');
const { passwordProblem, minimumLength } = require('../src/passwords');

test('common passwords are rejected including the usual capital, digit and symbol variations', () => {
  for (const password of ['Password1', 'P@ssw0rd!', 'pAssWord123', 'Welcome2024', 'Summer2024!', 'Qwerty123', 'Abcd1234', 'Letmein123', 'Iloveyou1!',
    'Admin@12345', 'Monkey123', 'Anatolearn1', 'Password1Password1', 'Passw0rd', 'Testing123', 'Newpass123'])
    assert.match(passwordProblem(password), /too common/, password);
});
test('keyboard runs, sequences and repetition are rejected', () => {
  for (const password of ['Qwertyuiop1', '1qaz2wsx3EDC', 'Abcdefgh1', 'Aaaaaaa1A', 'Abcabcabc1', 'Xk9Xk9Xk9Xk9', '123456789Aa'])
    assert.match(passwordProblem(password), /too common/, password);
});
test('ordinary strong passwords and passphrases are accepted', () => {
  for (const password of ['Maple9Window', 'Zebra4Cloud', 'Orange55Pencil', 'Blue-Tractor-Lamp-7', 'tR7!kQ2mZp', 'Correct7Horse'])
    assert.equal(passwordProblem(password), null, password);
});
test('length, byte size and composition rules apply', () => {
  assert.match(passwordProblem('Ab1'), /at least 8/);
  assert.match(passwordProblem('Maple9Window'.repeat(8)), /72 bytes/);
  assert.match(passwordProblem('maple9window'), /uppercase letter and one number/);
  assert.match(passwordProblem('MapleWindowZ'), /uppercase letter and one number/);
  assert.match(passwordProblem('Maple9Windé'.repeat(8)), /72 bytes/, 'multi-byte characters count by bytes');
  for (const bad of [undefined, null, 12345678, {}, ['Maple9Window']]) assert.match(passwordProblem(bad), /required/);
});
test('teachers and administrators need 12 characters, students 8', () => {
  assert.deepEqual(['student', 'teacher', 'admin', undefined].map((role) => minimumLength(role)), [8, 12, 12, 8]);
  assert.equal(passwordProblem('Zebra4Cloud', { role: 'student' }), null);
  for (const role of ['teacher', 'admin']) {
    assert.match(passwordProblem('Zebra4Cloud', { role }), /at least 12 characters for teachers and administrators/);
    assert.equal(passwordProblem('Maple9Window', { role }), null);
  }
});
test('passwords containing the name or email are rejected, short fragments are ignored', () => {
  const person = { email: 'jonathan.lee@school.edu', name: 'Jonathan Lee' };
  for (const password of ['Jonathan2024x', 'xx7LEE-jonathan', 'Jonathan.Lee9Z', 'Cloud9jonathanZ']) assert.match(passwordProblem(password, person), /name or email/, password);
  assert.equal(passwordProblem('Zebra4Cloud', person), null);
  assert.equal(passwordProblem('Maple9Lee', { email: 'lee@school.edu', name: 'Lee' }), null, 'tokens under 4 characters are ignored');
  assert.equal(passwordProblem('Maple9Window', {}), null);
});

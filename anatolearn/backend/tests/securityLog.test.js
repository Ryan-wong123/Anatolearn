const { test } = require('node:test');
const assert = require('node:assert/strict');
const { securityEvent, SECURITY_ACTIONS } = require('../src/audit');

test('security-relevant audit actions produce a structured log entry with ids and IPs only', () => {
  const event = securityEvent({ actor: { id: 7, name: 'Pat Example', email: 'pat@example.test' }, action: 'auth.mfa_failed', targetType: 'user', targetId: 7,
    detail: { attempts: 3, email: 'pat@example.test' }, ip: '203.0.113.9' }, new Date('2026-01-02T03:04:05Z'));
  assert.deepEqual(event, { time: '2026-01-02T03:04:05.000Z', level: 'warn', msg: 'security_event', action: 'auth.mfa_failed', actor: 7, target: '7', ip: '203.0.113.9', attempts: 3 });
  assert.ok(!/pat|example\.test/i.test(JSON.stringify(event).replace('203.0.113.9', '')), 'no names or emails');
});
test('events without an actor still log, and other audit actions do not', () => {
  assert.equal(securityEvent({ action: 'auth.login_failed', ip: '198.51.100.1' }).actor, null);
  for (const action of ['auth.login', 'auth.register', 'POST /models/upload', 'user.update', 'profile.change_password', 'auth.mfa_challenge'])
    assert.equal(securityEvent({ actor: { id: 1 }, action }), null, action);
});
test('every alarm in setup-alarms.sh watches an action that is actually logged', () => {
  const script = require('fs').readFileSync(require('path').join(__dirname, '../../ops/cloudwatch/setup-alarms.sh'), 'utf8');
  // Lines look like: event_alarm <name> <metric> <period> <threshold> "<description>" <action> [<action> ...]
  const watched = [...script.matchAll(/^event_alarm \S+ \S+ \d+ \d+ "[^"]*" (.+)$/gm)].flatMap((match) => match[1].trim().split(/\s+/));
  assert.ok(watched.length >= 5, 'the script has security-event filters');
  for (const action of watched) assert.ok(SECURITY_ACTIONS.has(action), `${action} is watched but never logged`);
  for (const action of ['auth.mfa_failed', 'auth.account_locked', 'user.reset_mfa']) assert.ok(watched.includes(action), `${action} has an alarm`);
});
test('the level is warn so security events do not trigger the application-error alarm', () => {
  assert.equal(securityEvent({ action: 'auth.account_locked' }).level, 'warn');
});

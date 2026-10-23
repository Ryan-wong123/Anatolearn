const bcrypt = require('bcryptjs');
const repository = require('./profile.repository');
const { record } = require('../../audit');
const { CSRF_COOKIE } = require('../../csrf');
const meta = () => ({ headers: { 'Cache-Control': 'no-store' }, cookies: [] });
const fail = (status, message) => ({ ...meta(), status, kind: 'json', body: { message } });
const strongPassword = (password) => typeof password === 'string' && password.length >= 8 && Buffer.byteLength(password) <= 72 && /[A-Z]/.test(password) && /[0-9]/.test(password);

async function getProfile(input) {
    return { ...meta(), status: 200, kind: 'json', body: (await repository.findProfile([input.user.id])).rows[0] };
}
async function updateProfile(input) {
    const { name, program_id } = input.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 255) return fail(400, 'A name is required');
    let program = input.user.program_id;
    // Students stay in the programme they registered under: it decides which content they may see.
    if (input.user.role === 'teacher' && program_id !== undefined) {
        if (program_id !== null && !(Number.isInteger(program_id) && (await repository.findProgram([program_id])).rows[0])) return fail(400, 'Unknown programme');
        program = program_id;
    }
    await repository.updateProfile([input.user.id, name.trim(), program]);
    return { ...meta(), status: 200, kind: 'json', body: (await repository.findProfile([input.user.id])).rows[0] };
}
async function changePassword(input) {
    const { current_password, new_password } = input.body;
    if (typeof current_password !== 'string' || !strongPassword(new_password)) return fail(400, 'New password must be 8-72 characters with an uppercase letter and a number');
    const stored = (await repository.findPasswordHash([input.user.id])).rows[0];
    if (!stored || !(await bcrypt.compare(current_password, stored.password_hash))) return fail(403, 'Current password is incorrect');
    await repository.setPassword([input.user.id, await bcrypt.hash(new_password, 12)]);
    await repository.revokeOtherSessions([input.user.id, input.user.sid]);
    await record({ actor: input.user, action: 'profile.change_password', targetType: 'user', targetId: input.user.id, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: { message: 'Password updated. Other devices have been signed out.' } };
}
async function exportData(input) {
    const profile = (await repository.findProfile([input.user.id])).rows[0];
    return { ...meta(), status: 200, kind: 'send', headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="anatolearn-my-data.json"', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ exported_at: new Date().toISOString(), account: profile, ...(await repository.exportData(input.user.id)) }, null, 2) };
}
async function deleteAccount(input) {
    const stored = (await repository.findPasswordHash([input.user.id])).rows[0];
    if (typeof input.body.password !== 'string' || !stored || !(await bcrypt.compare(input.body.password, stored.password_hash))) return fail(403, 'Password is incorrect');
    if (input.user.role === 'teacher' && !(await repository.countOtherActiveTeachers([input.user.id])).rows[0].n)
        return fail(400, 'You are the only active teacher. Promote another teacher before deleting your account.');
    await record({ actor: input.user, action: 'profile.delete_account', targetType: 'user', targetId: input.user.id, ip: input.ip });
    await repository.revokeAllSessions([input.user.id]);
    await repository.deleteUser([input.user.id]);
    return { ...meta(), status: 200, kind: 'json', cookies: [{ name: 'anatolearn_session', clear: true, options: { path: '/' } }, { name: CSRF_COOKIE, clear: true, options: { path: '/' } }], body: { message: 'Account deleted' } };
}
module.exports = { getProfile, updateProfile, changePassword, exportData, deleteAccount };

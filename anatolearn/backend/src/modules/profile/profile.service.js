const bcrypt = require('bcryptjs');
const repository = require('./profile.repository');
const { record } = require('../../audit');
const { CSRF_COOKIE } = require('../../csrf');
const mfa = require('../../mfa');
const { passwordProblem } = require('../../passwords');
const { checkSecondFactor } = require('../auth/auth.service');
const authRepository = require('../auth/auth.repository');
const meta = () => ({ headers: { 'Cache-Control': 'no-store' }, cookies: [] });
const fail = (status, message) => ({ ...meta(), status, kind: 'json', body: { message } });

async function getProfile(input) {
    const profile = (await repository.findProfile([input.user.id])).rows[0];
    return { ...meta(), status: 200, kind: 'json', body: { ...profile, mfa_required: mfa.mfaRequired(profile.role) } };
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
    if (typeof current_password !== 'string') return fail(400, 'Your current password is required');
    const account = (await repository.findProfile([input.user.id])).rows[0];
    const weakness = passwordProblem(new_password, { role: account.role, email: account.email, name: account.name });
    if (weakness) return fail(400, weakness);
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
    if (input.user.role === 'admin' && !(await repository.countOtherActiveAdmins([input.user.id])).rows[0].n)
        return fail(400, 'You are the only active administrator. Promote another administrator before deleting your account.');
    await record({ actor: input.user, action: 'profile.delete_account', targetType: 'user', targetId: input.user.id, ip: input.ip });
    await repository.revokeAllSessions([input.user.id]);
    await repository.deleteUser([input.user.id]);
    return { ...meta(), status: 200, kind: 'json', cookies: [{ name: 'anatolearn_session', clear: true, options: { path: '/' } }, { name: CSRF_COOKIE, clear: true, options: { path: '/' } }], body: { message: 'Account deleted' } };
}
async function passwordMatches(userId, password) {
    const stored = (await repository.findPasswordHash([userId])).rows[0];
    return typeof password === 'string' && Boolean(stored) && await bcrypt.compare(password, stored.password_hash);
}
// Re-authenticates with the password and a current code. Wrong attempts feed the account lockout like a bad login.
async function confirmWithSecondFactor(input) {
    if (!(await passwordMatches(input.user.id, input.body.password))) return fail(403, 'Password is incorrect');
    const user = (await authRepository.findUserForMfa([input.user.id])).rows[0];
    const code = typeof input.body.code === 'string' && input.body.code.length <= 32 ? input.body.code : '';
    if (!user || !(await checkSecondFactor(user, code)).ok) {
        await authRepository.registerFailedLogin([input.user.id, Number(process.env.MAX_FAILED_LOGINS) || 5, Number(process.env.LOCKOUT_MINUTES) || 15]);
        return fail(403, 'Invalid verification code');
    }
    return null;
}
async function setupMfa(input) {
    if (!(await passwordMatches(input.user.id, input.body.password))) return fail(403, 'Password is incorrect');
    const state = (await repository.findMfaState([input.user.id])).rows[0];
    if (state.mfa_enabled_at) return fail(409, 'Two-factor authentication is already enabled');
    const secret = mfa.generateSecret();
    await repository.setPendingMfaSecret([input.user.id, mfa.encryptSecret(secret)]);
    return { ...meta(), status: 200, kind: 'json', body: { secret, otpauth_uri: mfa.otpauthUri(state.email, secret) } };
}
async function enableMfa(input) {
    const state = (await repository.findMfaState([input.user.id])).rows[0];
    if (state.mfa_enabled_at) return fail(409, 'Two-factor authentication is already enabled');
    if (!state.mfa_pending_secret) return fail(400, 'Start setup first');
    const step = mfa.verifyTotp(mfa.decryptSecret(state.mfa_pending_secret), input.body.code);
    if (step == null) return fail(400, 'That code is not valid. Check the time on your phone and try again.');
    const codes = mfa.generateRecoveryCodes();
    if (!(await repository.enableMfa([input.user.id, step, codes.map(mfa.hashRecoveryCode)])).rows.length) return fail(409, 'Setup is no longer pending');
    await repository.revokeOtherSessions([input.user.id, input.user.sid]);
    await record({ actor: input.user, action: 'profile.mfa_enabled', targetType: 'user', targetId: input.user.id, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: { recovery_codes: codes } };
}
async function disableMfa(input) {
    if (mfa.mfaRequired(input.user.role)) return fail(403, 'Two-factor authentication is required for your role and cannot be turned off');
    const denied = await confirmWithSecondFactor(input);
    if (denied) return denied;
    await repository.disableMfa([input.user.id]);
    await repository.revokeOtherSessions([input.user.id, input.user.sid]);
    await record({ actor: input.user, action: 'profile.mfa_disabled', targetType: 'user', targetId: input.user.id, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: { message: 'Two-factor authentication turned off' } };
}
async function regenerateRecoveryCodes(input) {
    const denied = await confirmWithSecondFactor(input);
    if (denied) return denied;
    const codes = mfa.generateRecoveryCodes();
    await repository.replaceRecoveryCodes([input.user.id, codes.map(mfa.hashRecoveryCode)]);
    await record({ actor: input.user, action: 'profile.mfa_recovery_regenerated', targetType: 'user', targetId: input.user.id, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: { recovery_codes: codes } };
}
module.exports = { setupMfa, enableMfa, disableMfa, regenerateRecoveryCodes, getProfile, updateProfile, changePassword, exportData, deleteAccount };

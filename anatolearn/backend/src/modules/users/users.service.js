const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const repository = require('./users.repository');
const { record } = require('../../audit');
const { paged } = require('../catalog/catalog.service');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const meta = () => ({ headers: {}, cookies: [] });
const fail = (status, message) => ({ ...meta(), status, kind: 'json', body: { message } });
const ROLES = ['student', 'teacher', 'admin'];
const passwordProblem = (password) => typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72
    || !/[A-Z]/.test(password) || !/[0-9]/.test(password) ? 'Password must be 8-72 characters with an uppercase letter and a number' : null;
const generatePassword = () => `Aa1-${randomBytes(9).toString('base64url')}`;

async function listUsers(input) {
    const rows = (await repository.listUsers(input.query)).rows;
    return { ...meta(), status: 200, kind: 'json', ...paged({ query: { page_size: input.query.page_size || 25, page: input.query.page } }, rows) };
}
async function createUser(input) {
    const { name, email, role, program_id } = input.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 255 || typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim()) || email.length > 255)
        return fail(400, 'A valid name and email are required');
    if (!ROLES.includes(role)) return fail(400, 'role must be student, teacher or admin');
    if (program_id != null && !(Number.isInteger(program_id) && (await repository.findProgram([program_id])).rows[0])) return fail(400, 'Unknown programme');
    const normalized = email.trim().toLowerCase();
    if ((await repository.findByEmail([normalized])).rows[0]) return fail(409, 'An account with this email already exists');
    const password = input.body.password ?? generatePassword();
    if (input.body.password != null && passwordProblem(password)) return fail(400, passwordProblem(password));
    const user = (await repository.insertUser([name.trim(), normalized, await bcrypt.hash(password, 12), role, program_id ?? null])).rows[0];
    await record({ actor: input.user, action: 'user.create', targetType: 'user', targetId: user.id, detail: { role }, ip: input.ip });
    return { ...meta(), status: 201, kind: 'json', body: { user, ...(input.body.password == null ? { temporary_password: password } : {}) } };
}
async function updateUser(input) {
    const id = Number(input.params.id);
    const current = (await repository.findUser([id])).rows[0];
    if (!current) return fail(404, 'User not found');
    const next = {
        name: input.body.name ?? current.name, role: input.body.role ?? current.role,
        program_id: input.body.program_id === undefined ? current.program_id : input.body.program_id,
        is_active: input.body.is_active ?? current.is_active, unlock: input.body.unlock === true,
    };
    if (typeof next.name !== 'string' || !next.name.trim() || next.name.length > 255) return fail(400, 'Invalid name');
    if (!ROLES.includes(next.role)) return fail(400, 'role must be student, teacher or admin');
    if (typeof next.is_active !== 'boolean') return fail(400, 'is_active must be boolean');
    if (next.program_id != null && !(Number.isInteger(next.program_id) && (await repository.findProgram([next.program_id])).rows[0])) return fail(400, 'Unknown programme');
    const losesAdminAccess = current.role === 'admin' && current.is_active && (next.role !== 'admin' || !next.is_active);
    if (id === input.user.id && losesAdminAccess) return fail(400, 'You cannot demote or disable your own account');
    if (losesAdminAccess && !(await repository.countOtherActiveAdmins([id])).rows[0].n) return fail(400, 'At least one active administrator account must remain');
    const user = (await repository.updateUser([id, next.name.trim(), next.role, next.program_id, next.is_active, next.unlock])).rows[0];
    if (!next.is_active || next.role !== current.role) await repository.revokeSessions([id]);
    await record({ actor: input.user, action: 'user.update', targetType: 'user', targetId: id,
        detail: { role: next.role, is_active: next.is_active, unlock: next.unlock }, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: user };
}
async function resetPassword(input) {
    const id = Number(input.params.id);
    if (!(await repository.findUser([id])).rows[0]) return fail(404, 'User not found');
    const password = input.body.password ?? generatePassword();
    if (input.body.password != null && passwordProblem(password)) return fail(400, passwordProblem(password));
    await repository.setPassword([id, await bcrypt.hash(password, 12)]);
    await repository.revokeSessions([id]);
    await record({ actor: input.user, action: 'user.reset_password', targetType: 'user', targetId: id, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', headers: { 'Cache-Control': 'no-store' }, body: input.body.password == null ? { temporary_password: password } : { message: 'Password updated' } };
}
async function deleteUser(input) {
    const id = Number(input.params.id);
    const current = (await repository.findUser([id])).rows[0];
    if (!current) return fail(404, 'User not found');
    if (id === input.user.id) return fail(400, 'You cannot delete your own account here; use your profile page');
    if (current.role === 'admin' && current.is_active && !(await repository.countOtherActiveAdmins([id])).rows[0].n) return fail(400, 'At least one active administrator account must remain');
    await repository.deleteUser([id]);
    await record({ actor: input.user, action: 'user.delete', targetType: 'user', targetId: id, detail: { email: current.email }, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: { message: 'User deleted' } };
}
async function listAuditLog(input) {
    const rows = (await repository.listAuditLog(input.query)).rows;
    return { ...meta(), status: 200, kind: 'json', ...paged({ query: { page_size: input.query.page_size || 50, page: input.query.page } }, rows) };
}
module.exports = { listUsers, createUser, updateUser, resetPassword, deleteUser, listAuditLog };

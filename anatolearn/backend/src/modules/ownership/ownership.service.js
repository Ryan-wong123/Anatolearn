const repository = require('./ownership.repository');
const { OWNED } = require('../../ownership');
const { record } = require('../../audit');
const meta = () => ({ headers: {}, cookies: [] });
const fail = (status, message) => ({ ...meta(), status, kind: 'json', body: { message } });

// A teacher takes ownership of content nobody owns yet (existing content from before ownership was recorded, or content of a
// deleted teacher). Content that already has an owner cannot be taken.
async function claim(input) {
    const target = OWNED[input.params.kind];
    if (!target || !/^\d+$/.test(input.params.id)) return fail(404, 'Not found');
    const id = Number(input.params.id);
    const row = (await repository.find(target.table, target.column, target.published, id)).rows[0];
    if (!row) return fail(404, 'Not found');
    if (row.owner === input.user.id) return { ...meta(), status: 200, kind: 'json', body: { message: 'You already own this' } };
    // Another teacher's draft is invisible to this teacher, so do not even confirm that it exists.
    if (row.owner !== null && !row.published) return fail(404, 'Not found');
    if (row.owner !== null) return fail(409, 'This already belongs to another teacher');
    const claimed = (await repository.claim(target.table, target.column, id, input.user.id)).rows[0];
    if (!claimed) return fail(409, 'This was claimed by someone else a moment ago');
    await record({ actor: input.user, action: 'content.claim', targetType: input.params.kind, targetId: id, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: { message: 'You now own this' } };
}

async function activeTeacher(id) {
    if (!Number.isInteger(id)) return null;
    const user = (await repository.findUser(id)).rows[0];
    return user && user.role === 'teacher' && user.is_active ? user : null;
}
const total = (moved) => Object.values(moved).reduce((sum, n) => sum + n, 0);

// Administrator: hand everything one teacher owns to another (a teacher is leaving or changing role).
async function transferContent(input) {
    const from = Number(input.params.id), toId = input.body?.to_user_id;
    const source = (await repository.findUser(from)).rows[0];
    if (!source) return fail(404, 'User not found');
    const target = await activeTeacher(toId);
    if (!target) return fail(400, 'Choose an active teacher to receive the content');
    if (target.id === from) return fail(400, 'Choose a different teacher');
    const moved = await repository.transfer(from, target.id);
    await record({ actor: input.user, action: 'content.transfer', targetType: 'user', targetId: from, detail: { to: target.id, moved }, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: { moved, total: total(moved), to: target.name } };
}

// Administrator: give all unclaimed content to a teacher (the one-off step after upgrading to ownership).
async function assignUnclaimed(input) {
    const target = await activeTeacher(input.body?.to_user_id);
    if (!target) return fail(400, 'Choose an active teacher to receive the content');
    const moved = await repository.transfer(null, target.id);
    await record({ actor: input.user, action: 'content.assign_unclaimed', targetType: 'user', targetId: target.id, detail: { moved }, ip: input.ip });
    return { ...meta(), status: 200, kind: 'json', body: { moved, total: total(moved), to: target.name } };
}
module.exports = { claim, transferContent, assignUnclaimed };

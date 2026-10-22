const repository = require('./auth.repository');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sessionToken } = require('../../access');
const VALID_ROLES = ['student', 'teacher'];
const { timingSafeEqual } = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET;
// Compared against when the email is unknown so response time doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('anatolearn-dummy-password', 12);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function inviteCodeMatches(provided) {
    const expected = process.env.TEACHER_INVITE_CODE;
    if (!expected || typeof provided !== 'string') return false;
    const a = Buffer.from(provided), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}
async function register(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const { name, email, password, role, program_id, invite_code } = input.body;
        if (!name || !email || !password || !role) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "name, email, password, and role are required" } });
        }
        if (!VALID_ROLES.includes(role)) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: `role must be one of: ${VALID_ROLES.join(", ")}` } });
        }
        if ([name, email, password].some((value) => typeof value !== 'string') || name.length > 255 || email.length > 255 || !EMAIL_PATTERN.test(email.trim())) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "A valid name and email are required" } });
        }
        if (password.length < 8 || Buffer.byteLength(password) > 72) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "password must be 8 to 72 bytes long" } });
        }
        if (role === 'teacher' && !inviteCodeMatches(invite_code)) {
            return ({ ...outcomeMeta, status: 403, kind: 'json', body: { message: "A valid teacher invite code is required" } });
        }
        if (program_id != null && (!Number.isInteger(program_id) || !(await repository.findProgram([program_id])).rows[0])) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "Unknown programme" } });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await repository.findExistingEmail([
            normalizedEmail,
        ]);
        if (existing.rows.length > 0) {
            return ({ ...outcomeMeta, status: 409, kind: 'json', body: { message: "An account with this email already exists" } });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await repository.insertUser([name, normalizedEmail, passwordHash, role, program_id || null]);
        return ({ ...outcomeMeta, status: 201, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to register user:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Failed to register user" } });
    }
}
async function login(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        if (!JWT_SECRET) {
            return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Server is missing JWT_SECRET configuration" } });
        }
        const { email, password } = input.body;
        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "email and password are required" } });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const result = await repository.findUserByEmail([normalizedEmail]);
        // Same generic message whether the email doesn't exist or the password is wrong â€”
        // don't reveal which one it was, that would let someone enumerate registered emails.
        const invalidCredentials = () => ({ ...outcomeMeta, status: 401, kind: 'json', body: { message: "Invalid email or password" } });
        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
        if (!user) {
            return invalidCredentials();
        }
        if (!passwordMatches) {
            return invalidCredentials();
        }
        const sid = randomUUID();
        await repository.insertSession([sid, user.id]);
        const token = jwt.sign({ id: user.id, name: user.name, role: user.role, program_id: user.program_id, sid }, JWT_SECRET, { expiresIn: "24h" });
        outcomeMeta.cookies.push({ name: 'anatolearn_session', value: token, options: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 86400000, path: '/' } });
        (outcomeMeta.headers['Cache-Control'] = 'no-store');
        return ({ ...outcomeMeta, status: 200, kind: 'json', body: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    program_id: user.program_id,
                },
            } });
    }
    catch (err) {
        console.error("Failed to log in:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Failed to log in" } });
    }
}
async function logout(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    let claims;
    try {
        claims = jwt.verify(sessionToken(input) || '', JWT_SECRET, { algorithms: ['HS256'] });
    }
    catch { /* Clear invalid or expired cookies too. */ }
    if (typeof claims?.sid === 'string' && /^[0-9a-f-]{36}$/i.test(claims.sid))
        await repository.revokeSession([claims.sid, claims.id]);
    outcomeMeta.cookies.push({ name: 'anatolearn_session', clear: true, options: { path: '/' } });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: 'Logged out' } });
}
module.exports = { register, login, logout };

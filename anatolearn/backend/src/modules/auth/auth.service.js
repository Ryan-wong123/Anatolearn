const repository = require('./auth.repository');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sessionToken } = require('../../access');
const VALID_ROLES = ['student', 'teacher'];
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.warn("WARNING: JWT_SECRET is not set. /api/auth/login will fail until it's provided (see docker-compose.yml's backend.environment block).");
}
async function register(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const { name, email, password, role, program_id } = input.body;
        if (!name || !email || !password || !role) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "name, email, password, and role are required" } });
        }
        if (!VALID_ROLES.includes(role)) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: `role must be one of: ${VALID_ROLES.join(", ")}` } });
        }
        if (password.length < 8) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "password must be at least 8 characters" } });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await repository.findExistingEmail([
            normalizedEmail,
        ]);
        if (existing.rows.length > 0) {
            return ({ ...outcomeMeta, status: 409, kind: 'json', body: { message: "An account with this email already exists" } });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await repository.insertUser([name, normalizedEmail, passwordHash, role, program_id || null]);
        return ({ ...outcomeMeta, status: 201, kind: 'json', body: result.rows[0] });
    }
    catch (err) {
        console.error("Failed to register user:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: err.message || "Failed to register user" } });
    }
}
async function login(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        if (!JWT_SECRET) {
            return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Server is missing JWT_SECRET configuration" } });
        }
        const { email, password } = input.body;
        if (!email || !password) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: "email and password are required" } });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const result = await repository.findUserByEmail([normalizedEmail]);
        // Same generic message whether the email doesn't exist or the password is wrong â€”
        // don't reveal which one it was, that would let someone enumerate registered emails.
        const invalidCredentials = () => ({ ...outcomeMeta, status: 401, kind: 'json', body: { message: "Invalid email or password" } });
        if (result.rows.length === 0) {
            return invalidCredentials();
        }
        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) {
            return invalidCredentials();
        }
        const sid = randomUUID();
        await repository.insertSession([sid, user.id]);
        const token = jwt.sign({ id: user.id, name: user.name, role: user.role, program_id: user.program_id, sid }, JWT_SECRET, { expiresIn: "24h" });
        outcomeMeta.cookies.push({ name: 'anatolearn_session', value: token, options: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 86400000, path: '/' } });
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
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: err.message || "Failed to log in" } });
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

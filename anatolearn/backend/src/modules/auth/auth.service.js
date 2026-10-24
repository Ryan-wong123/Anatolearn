const repository = require('./auth.repository');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sessionToken } = require('../../access');
const { record } = require('../../audit');
const { newCsrfToken, CSRF_COOKIE } = require('../../csrf');
const mfa = require('../../mfa');
const MFA_CHALLENGE_MINUTES = 5;
const MAX_FAILED_LOGINS = Number(process.env.MAX_FAILED_LOGINS) || 5;
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES) || 15;
const allowedDomains = () => (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((domain) => domain.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
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
        const domains = allowedDomains();
        if (domains.length && !domains.includes(email.trim().toLowerCase().split('@').pop())) {
            return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: `Registration is limited to ${domains.map((domain) => '@' + domain).join(', ')} email addresses` } });
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
        void record({ actor: result.rows[0], action: 'auth.register', targetType: 'user', targetId: result.rows[0].id, detail: { role }, ip: input.ip });
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
        // Locked and disabled accounts get the same generic reply so attackers learn nothing about them.
        if (user.is_locked || !user.is_active) {
            void record({ actor: user, action: user.is_active ? 'auth.login_blocked_locked' : 'auth.login_blocked_disabled', targetType: 'user', targetId: user.id, ip: input.ip });
            return invalidCredentials();
        }
        if (!passwordMatches) {
            const failure = (await repository.registerFailedLogin([user.id, MAX_FAILED_LOGINS, LOCKOUT_MINUTES])).rows[0];
            void record({ actor: user, action: failure.locked_until && failure.failed_login_count >= MAX_FAILED_LOGINS ? 'auth.account_locked' : 'auth.login_failed',
                targetType: 'user', targetId: user.id, detail: { attempts: failure.failed_login_count }, ip: input.ip });
            return invalidCredentials();
        }
        // Staff with MFA enrolled prove the second factor before any session exists.
        if (user.mfa_enabled) {
            void record({ actor: user, action: 'auth.mfa_challenge', targetType: 'user', targetId: user.id, ip: input.ip });
            const mfaToken = jwt.sign({ uid: user.id, purpose: 'mfa' }, JWT_SECRET, { expiresIn: `${MFA_CHALLENGE_MINUTES}m` });
            return ({ ...outcomeMeta, headers: { 'Cache-Control': 'no-store' }, status: 200, kind: 'json', body: { mfa_required: true, mfa_token: mfaToken } });
        }
        return await startSession(user, input, outcomeMeta);
    }
    catch (err) {
        console.error("Failed to log in:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: "Failed to log in" } });
    }
}
// Issues the session and CSRF cookies once every required factor has been proven.
async function startSession(user, input, outcomeMeta) {
    await repository.registerSuccessfulLogin([user.id]);
    void record({ actor: user, action: 'auth.login', targetType: 'user', targetId: user.id, ip: input.ip });
    const sid = randomUUID();
    await repository.insertSession([sid, user.id]);
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role, program_id: user.program_id, sid }, JWT_SECRET, { expiresIn: "24h" });
    const cookieSecurity = { sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 86400000, path: '/' };
    outcomeMeta.cookies.push({ name: 'anatolearn_session', value: token, options: { httpOnly: true, ...cookieSecurity } });
    outcomeMeta.cookies.push({ name: CSRF_COOKIE, value: newCsrfToken(), options: { httpOnly: false, ...cookieSecurity } });
    outcomeMeta.headers['Cache-Control'] = 'no-store';
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: {
            user: { id: user.id, name: user.name, email: user.email, role: user.role, program_id: user.program_id },
            mfa_setup_required: mfa.mfaRequired(user.role) && !user.mfa_enabled,
        } });
}
// Checks an authenticator code, or a recovery code, for a user who has MFA enabled. Returns { ok, usedRecovery, remaining }.
async function checkSecondFactor(user, code) {
    if (mfa.looksLikeRecoveryCode(code)) {
        const used = (await repository.consumeRecoveryCode([user.id, mfa.hashRecoveryCode(code)])).rows[0];
        return used ? { ok: true, usedRecovery: true, remaining: used.remaining } : { ok: false };
    }
    const step = mfa.verifyTotp(mfa.decryptSecret(user.mfa_secret), code, { lastStep: user.mfa_last_step });
    if (step == null || !(await repository.claimTotpStep([user.id, step])).rows.length) return { ok: false };
    return { ok: true };
}
async function verifyMfa(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const invalid = () => ({ ...outcomeMeta, status: 401, kind: 'json', body: { message: 'Invalid or expired verification code' } });
    try {
        const { mfa_token, code } = input.body || {};
        if (typeof mfa_token !== 'string' || typeof code !== 'string' || code.length > 32) return ({ ...outcomeMeta, status: 400, kind: 'json', body: { message: 'mfa_token and code are required' } });
        let claims;
        try { claims = jwt.verify(mfa_token, JWT_SECRET, { algorithms: ['HS256'] }); } catch { return invalid(); }
        if (claims.purpose !== 'mfa' || !Number.isInteger(claims.uid)) return invalid();
        const user = (await repository.findUserForMfa([claims.uid])).rows[0];
        if (!user || user.is_locked || !user.is_active) return invalid();
        const result = await checkSecondFactor(user, code);
        if (!result.ok) {
            // Wrong codes feed the same lockout as wrong passwords, so the second factor cannot be brute-forced.
            const failure = (await repository.registerFailedLogin([user.id, MAX_FAILED_LOGINS, LOCKOUT_MINUTES])).rows[0];
            void record({ actor: user, action: failure.locked_until && failure.failed_login_count >= MAX_FAILED_LOGINS ? 'auth.account_locked' : 'auth.mfa_failed',
                targetType: 'user', targetId: user.id, detail: { attempts: failure.failed_login_count }, ip: input.ip });
            return invalid();
        }
        if (result.usedRecovery) void record({ actor: user, action: 'auth.mfa_recovery_used', targetType: 'user', targetId: user.id, detail: { remaining: result.remaining }, ip: input.ip });
        const outcome = await startSession({ ...user, mfa_enabled: true }, input, outcomeMeta);
        if (result.usedRecovery) outcome.body.recovery_codes_remaining = result.remaining;
        return outcome;
    }
    catch (err) {
        console.error('Failed to verify MFA code:', err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: 'Failed to verify code' } });
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
    outcomeMeta.cookies.push({ name: CSRF_COOKIE, clear: true, options: { path: '/' } });
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: 'Logged out' } });
}
module.exports = { register, login, logout, verifyMfa, checkSecondFactor };

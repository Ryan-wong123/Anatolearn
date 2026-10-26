const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const webauthn = require('@simplewebauthn/server');
const repository = require('./passkeys.repository');
const authRepository = require('../auth/auth.repository');
const { startSession } = require('../auth/auth.service');
const { checkPassword } = require('../profile/profile.service');
const profileRepository = require('../profile/profile.repository');
const { record } = require('../../audit');
const mfa = require('../../mfa');
const passkeys = require('../../passkeys');
const meta = () => ({ headers: { 'Cache-Control': 'no-store' }, cookies: [] });
const reply = (status, body) => ({ ...meta(), status, kind: 'json', body });
const fail = (status, message) => reply(status, { message });
const MAX_FAILED_LOGINS = () => Number(process.env.MAX_FAILED_LOGINS) || 5;
const LOCKOUT_MINUTES = () => Number(process.env.LOCKOUT_MINUTES) || 15;
const asCredential = (row) => ({ id: row.credential_id, publicKey: new Uint8Array(row.public_key), counter: Number(row.counter), transports: row.transports });

async function list(input) {
    return reply(200, { passkeys: (await repository.list([input.user.id])).rows });
}

// Step 1 of adding a passkey: the password is confirmed (and counts toward the lockout), then the browser gets a one-time challenge.
async function registrationOptions(input) {
    const denied = await checkPassword(input, input.body?.password);
    if (denied) return denied;
    if ((await repository.countByUser([input.user.id])).rows[0].n >= passkeys.MAX_PASSKEYS) return fail(409, `You can register at most ${passkeys.MAX_PASSKEYS} passkeys. Remove one first.`);
    const account = (await profileRepository.findProfile([input.user.id])).rows[0];
    const existing = (await repository.listCredentials([input.user.id])).rows;
    const options = await webauthn.generateRegistrationOptions({
        rpName: passkeys.rpName(), rpID: passkeys.rpID(), userName: account.email, userDisplayName: account.name,
        userID: new TextEncoder().encode(String(input.user.id)), attestationType: 'none', timeout: 120000,
        excludeCredentials: existing.map((row) => ({ id: row.credential_id, transports: row.transports })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    await repository.saveChallenge([randomUUID(), input.user.id, 'register', options.challenge, passkeys.CHALLENGE_MINUTES]);
    return reply(200, options);
}

// Step 2: the browser returns the new credential. It is only accepted for the challenge issued in step 1, on this site's origin.
async function register(input) {
    const { response, name } = input.body || {};
    if (typeof response !== 'object' || response === null) return fail(400, 'A passkey response is required');
    const label = typeof name === 'string' && name.trim() ? name.trim().slice(0, 60) : 'Passkey';
    const challenge = await repository.takeChallenge([input.user.id, 'register']);
    if (!challenge) return fail(400, 'That request expired. Start again.');
    let verification;
    try {
        verification = await webauthn.verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: passkeys.origins(), expectedRPID: passkeys.rpID(), requireUserVerification: false });
    } catch { return fail(400, 'The passkey could not be verified. Try again.'); }
    if (!verification.verified) return fail(400, 'The passkey could not be verified. Try again.');
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const saved = (await repository.insert([input.user.id, credential.id, Buffer.from(credential.publicKey), credential.counter, credential.transports || [], label, credentialDeviceType, credentialBackedUp])).rows[0];
    if (!saved) return fail(409, 'That passkey is already registered');
    await authRepository.clearFailedLogins([input.user.id]);
    await profileRepository.revokeOtherSessions([input.user.id, input.user.sid]);
    await record({ actor: input.user, action: 'profile.passkey_added', targetType: 'user', targetId: input.user.id, detail: { name: label }, ip: input.ip });
    return reply(201, { passkey: saved });
}

async function remove(input) {
    if (!/^\d+$/.test(input.params.id)) return fail(400, 'Invalid passkey');
    const denied = await checkPassword(input, input.body?.password);
    if (denied) return denied;
    const count = (await repository.countByUser([input.user.id])).rows[0].n;
    const totp = (await repository.hasTotp([input.user.id])).rows[0]?.totp;
    if (mfa.mfaRequired(input.user.role) && count <= 1 && !totp)
        return fail(403, 'Two-factor authentication is required for your role. Set up an authenticator app or another passkey before removing your last one.');
    if (!(await repository.remove([Number(input.params.id), input.user.id])).rows.length) return fail(404, 'Passkey not found');
    await profileRepository.revokeOtherSessions([input.user.id, input.user.sid]);
    await record({ actor: input.user, action: 'profile.passkey_removed', targetType: 'user', targetId: input.user.id, ip: input.ip });
    return reply(200, { message: 'Passkey removed' });
}

// ---- Sign-in: after the password, a passkey can be the second factor (the same short-lived challenge token as the authenticator code).
async function challengeUser(mfaToken) {
    let claims;
    try { claims = jwt.verify(mfaToken, process.env.JWT_SECRET, { algorithms: ['HS256'] }); } catch { return null; }
    if (claims.purpose !== 'mfa' || !Number.isInteger(claims.uid)) return null;
    const user = (await repository.findUser([claims.uid])).rows[0];
    return user && user.is_active && !user.is_locked ? user : null;
}
const invalid = () => fail(401, 'Invalid or expired passkey check');

async function signInOptions(input) {
    if (typeof input.body?.mfa_token !== 'string') return fail(400, 'mfa_token is required');
    const user = await challengeUser(input.body.mfa_token);
    if (!user) return invalid();
    const credentials = (await repository.listCredentials([user.id])).rows;
    if (!credentials.length) return invalid();
    const options = await webauthn.generateAuthenticationOptions({ rpID: passkeys.rpID(), userVerification: 'preferred', timeout: 120000,
        allowCredentials: credentials.map((row) => ({ id: row.credential_id, transports: row.transports })) });
    await repository.saveChallenge([randomUUID(), user.id, 'authenticate', options.challenge, passkeys.CHALLENGE_MINUTES]);
    return reply(200, options);
}

async function signInVerify(input) {
    const { mfa_token, response } = input.body || {};
    if (typeof mfa_token !== 'string' || typeof response !== 'object' || response === null || typeof response.id !== 'string') return fail(400, 'mfa_token and response are required');
    const user = await challengeUser(mfa_token);
    if (!user) return invalid();
    const challenge = await repository.takeChallenge([user.id, 'authenticate']);
    const stored = (await repository.findCredential([user.id, response.id])).rows[0];
    let verification = null;
    if (challenge && stored) {
        try {
            verification = await webauthn.verifyAuthenticationResponse({ response, expectedChallenge: challenge, expectedOrigin: passkeys.origins(),
                expectedRPID: passkeys.rpID(), credential: asCredential(stored), requireUserVerification: false });
        } catch { verification = null; }
    }
    if (!verification?.verified) {
        // A wrong or replayed assertion feeds the same lockout as a wrong password or authenticator code.
        const failure = (await authRepository.registerFailedLogin([user.id, MAX_FAILED_LOGINS(), LOCKOUT_MINUTES()])).rows[0];
        void record({ actor: user, action: failure.locked_until && failure.failed_login_count >= MAX_FAILED_LOGINS() ? 'auth.account_locked' : 'auth.passkey_failed',
            targetType: 'user', targetId: user.id, detail: { attempts: failure.failed_login_count }, ip: input.ip });
        return invalid();
    }
    await repository.recordUse([stored.id, verification.authenticationInfo.newCounter]);
    return startSession({ ...user, mfa_enabled: true }, input, { headers: {}, cookies: [] });
}

module.exports = { list, registrationOptions, register, remove, signInOptions, signInVerify };

// WebAuthn settings shared by registration and sign-in. The relying-party ID must be the site's registrable domain name (no
// scheme or port); the browser refuses to use a passkey on any other site, which is what makes passkeys phishing-resistant.
const ORIGINS = () => (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(',').map((origin) => origin.trim()).filter(Boolean);
const rpID = () => process.env.WEBAUTHN_RP_ID || new URL(ORIGINS()[0]).hostname;
const rpName = () => process.env.WEBAUTHN_RP_NAME || 'AnatoLearn';
const CHALLENGE_MINUTES = 5;
const MAX_PASSKEYS = 10;
const toBase64Url = (bytes) => Buffer.from(bytes).toString('base64url');
module.exports = { origins: ORIGINS, rpID, rpName, CHALLENGE_MINUTES, MAX_PASSKEYS, toBase64Url };

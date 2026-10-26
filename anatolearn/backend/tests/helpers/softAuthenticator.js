// A minimal software WebAuthn authenticator (ES256, "none" attestation) so passkey flows can be exercised without a browser.
const { createHash, generateKeyPairSync, createSign, randomBytes } = require('crypto');

function cbor(value) {
  const head = (major, length) => {
    if (length < 24) return Buffer.from([(major << 5) | length]);
    if (length < 256) return Buffer.from([(major << 5) | 24, length]);
    return Buffer.from([(major << 5) | 25, length >> 8, length & 255]);
  };
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (typeof value === 'string') { const text = Buffer.from(value); return Buffer.concat([head(3, text.length), text]); }
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (value instanceof Map) return Buffer.concat([head(5, value.size), ...[...value].flatMap(([key, item]) => [cbor(key), cbor(item)])]);
  throw new Error('unsupported CBOR value');
}
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest();

function createAuthenticator({ rpID = 'localhost', origin = 'http://localhost:5173' } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credentialId = randomBytes(32);
  let counter = 0;
  const clientData = (type, challenge, forOrigin) => Buffer.from(JSON.stringify({ type, challenge, origin: forOrigin ?? origin, crossOrigin: false }));
  const rpHash = (id) => sha256(Buffer.from(id ?? rpID));
  return {
    credentialId: b64url(credentialId),
    create(challenge, { forOrigin } = {}) {
      const coseKey = cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
      const length = Buffer.alloc(2); length.writeUInt16BE(credentialId.length);
      const counterBytes = Buffer.alloc(4);
      const authData = Buffer.concat([rpHash(), Buffer.from([0x01 | 0x04 | 0x40]), counterBytes, Buffer.alloc(16), length, credentialId, coseKey]);
      return { id: b64url(credentialId), rawId: b64url(credentialId), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: b64url(clientData('webauthn.create', challenge, forOrigin)),
          attestationObject: b64url(cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))), transports: ['internal'] } };
    },
    get(challenge, { forOrigin, tamper = false, useCounter } = {}) {
      counter = useCounter ?? counter + 1;
      const counterBytes = Buffer.alloc(4); counterBytes.writeUInt32BE(counter);
      const authData = Buffer.concat([rpHash(), Buffer.from([0x01 | 0x04]), counterBytes]);
      const data = clientData('webauthn.get', challenge, forOrigin);
      const signer = createSign('SHA256'); signer.update(Buffer.concat([authData, sha256(data)]));
      const signature = signer.sign(privateKey);
      if (tamper) signature[signature.length - 1] ^= 0xff;
      return { id: b64url(credentialId), rawId: b64url(credentialId), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: b64url(data), authenticatorData: b64url(authData), signature: b64url(signature) } };
    },
  };
}
module.exports = { createAuthenticator };

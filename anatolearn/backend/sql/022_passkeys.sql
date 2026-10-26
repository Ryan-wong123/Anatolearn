-- Passkeys (WebAuthn) as a second factor next to the authenticator app. credential_id and the public key are what the browser
-- hands over at registration; the private key never leaves the person's device.
CREATE TABLE IF NOT EXISTS passkeys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT '{}',
  name VARCHAR(60) NOT NULL,
  device_type TEXT,
  backed_up BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS passkeys_user_idx ON passkeys(user_id);

-- One-time challenges for a registration or sign-in in progress. A challenge is deleted the moment it is used or looked up.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_user_idx ON webauthn_challenges(user_id, purpose);

-- TOTP two-factor authentication. The secret is stored encrypted (see src/mfa.js).
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ;
-- Time step of the last accepted code, so a code (or a shoulder-surfed one) cannot be replayed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_step BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_hashes TEXT[] NOT NULL DEFAULT '{}';

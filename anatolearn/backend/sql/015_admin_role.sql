-- Adds the administrator role. Admins manage accounts and the audit log only; teachers no longer can.
-- Idempotent. The new value is not used in this migration, so it is safe inside the migration transaction.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

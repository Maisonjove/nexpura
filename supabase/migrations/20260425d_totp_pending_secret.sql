-- Stash a pending TOTP secret server-side during the
-- /api/auth/2fa/setup → /api/auth/2fa/verify handshake. Pre-fix
-- /setup returned the secret to the client and /verify trusted
-- whatever secret the client posted back — meaning an attacker who
-- controlled the user's browser at enrollment time could substitute
-- a secret they know and read the user's TOTP for life.
--
-- Adds two columns on users:
--   totp_pending_secret  TEXT       — the candidate secret minted by /setup
--   totp_pending_at      TIMESTAMPTZ — when /setup minted it (TTL anchor)
--
-- The /verify route now reads the pending secret from these columns,
-- ignoring whatever the client sends. After successful verification it
-- promotes pending → totp_secret, sets totp_enabled, and clears pending.
-- Idempotent.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS totp_pending_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_pending_at TIMESTAMPTZ;

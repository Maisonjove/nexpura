-- CRIT-7: team_members invite hardening.
--
-- Adds:
--   * invite_expires_at  - a hard time bound on any outstanding invite.
--                           /api/invite/accept refuses accept after this.
--   * invite_token_hash  - sha256(invite_token) for storage. The plain
--                           invite_token column survives so we can email
--                           the link and so a transition window of
--                           already-outstanding invites keeps working;
--                           /api/invite/accept prefers hash compare and
--                           falls back to plaintext only when hash IS
--                           NULL (legacy rows).
--
-- Indexes added on both columns so the accept path can still hit an
-- index lookup by either token (legacy) or token_hash (new rows).

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_token_hash text;

CREATE INDEX IF NOT EXISTS team_members_invite_token_hash_idx
  ON public.team_members (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS team_members_invite_expires_at_idx
  ON public.team_members (invite_expires_at)
  WHERE invite_expires_at IS NOT NULL;

COMMENT ON COLUMN public.team_members.invite_expires_at IS
  'CRIT-7: hard expiry for the invite link. /api/invite/accept rejects with 410 after this.';
COMMENT ON COLUMN public.team_members.invite_token_hash IS
  'CRIT-7: sha256 hex of invite_token. Preferred over the plaintext column when set. Legacy rows (hash IS NULL) fall through to plaintext compare for one transition release.';

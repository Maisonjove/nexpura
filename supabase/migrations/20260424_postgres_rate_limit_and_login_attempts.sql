-- Postgres-backed rate limiting + login-attempt lockout.
--
-- Replaces the prior Upstash/Redis-based limiter. Constraint: Nexpura ships
-- on Supabase + Vercel only — no external cache/queue services. See the
-- Part 1 audit on the Redis/Upstash removal PR for full context.
--
-- Design:
--   • rate_limit_buckets — fixed-window counter per (bucket_key, window).
--     bucket_key encodes the window_start epoch, so each window is a
--     distinct row and the counter increments atomically via
--     INSERT ... ON CONFLICT DO UPDATE.
--   • login_attempts — stateful 5-strike → 15-min lockout per hashed
--     identifier (matches the old auth-security.ts behavior exactly).
--   • Both tables grow unbounded without cleanup; see the
--     /api/cron/cleanup-rate-limits route for the daily prune.
--
-- Trade-off vs Upstash slidingWindow: fixed-window permits up to 2× the
-- configured rate at a window boundary. This is acceptable for brute-force
-- protection (the absolute cap per minute is still bounded) and matches
-- the approximation Upstash itself uses. For the login-attempt module
-- (which has a stricter stateful lockout on top), boundary bursts are
-- bounded at 5 → lockout.

-- ──────────────────────────────────────────────────────────────────────
-- rate_limit_buckets
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index drives the cleanup cron's DELETE ... WHERE window_end < now() - interval.
CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_end_idx
  ON public.rate_limit_buckets (window_end);

-- No RLS — only the service role (via RPC) reads/writes this table.
-- Anon / authenticated roles must not see rate-limit state directly.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: default-deny for non-service roles.

-- ──────────────────────────────────────────────────────────────────────
-- check_and_increment_rate_limit(p_key, p_limit, p_window_seconds)
--   returns jsonb { success, count, limit, remaining, reset_at }
--
-- Atomic: a single INSERT ... ON CONFLICT statement. Concurrent callers
-- for the same key in the same window all increment the same row; the
-- returned count is the post-increment value seen by this caller.
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start bigint;
  v_bucket_key text;
  v_window_end timestamptz;
  v_count integer;
BEGIN
  IF p_limit <= 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'check_and_increment_rate_limit: p_limit and p_window_seconds must be positive';
  END IF;

  -- Floor-divide epoch into fixed window buckets so all calls in the
  -- same window land on the same row.
  v_window_start := (extract(epoch FROM now())::bigint / p_window_seconds) * p_window_seconds;
  v_bucket_key := p_key || ':' || v_window_start::text;
  v_window_end := to_timestamp(v_window_start + p_window_seconds);

  INSERT INTO public.rate_limit_buckets (bucket_key, count, window_end)
  VALUES (v_bucket_key, 1, v_window_end)
  ON CONFLICT (bucket_key) DO UPDATE
    SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO v_count;

  RETURN jsonb_build_object(
    'success', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'remaining', GREATEST(0, p_limit - v_count),
    'reset_at', v_window_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, integer) TO service_role;

-- ──────────────────────────────────────────────────────────────────────
-- login_attempts — stateful per-identifier failure counter + lockout
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.login_attempts (
  identifier_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_updated_at_idx
  ON public.login_attempts (updated_at);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: service-role-only.

-- check_login_allowed: returns whether the identifier may attempt login.
-- If locked_until has passed, treat the lock as expired (stale rows get
-- reset on the next failed attempt).
CREATE OR REPLACE FUNCTION public.check_login_allowed(
  p_identifier_hash text,
  p_max_attempts integer DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.login_attempts;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_row FROM public.login_attempts WHERE identifier_hash = p_identifier_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_remaining', p_max_attempts,
      'locked_until', NULL
    );
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'attempts_remaining', 0,
      'locked_until', v_row.locked_until
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_row.attempts < p_max_attempts,
    'attempts_remaining', GREATEST(0, p_max_attempts - v_row.attempts),
    'locked_until', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_login_allowed(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login_allowed(text, integer) TO service_role;

-- record_failed_login: atomically increments the counter. Triggers the
-- 15-min lockout once p_max_attempts is reached.
CREATE OR REPLACE FUNCTION public.record_failed_login(
  p_identifier_hash text,
  p_max_attempts integer DEFAULT 5,
  p_lockout_seconds integer DEFAULT 900
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
  v_locked_until timestamptz;
  v_now timestamptz := now();
BEGIN
  INSERT INTO public.login_attempts (identifier_hash, attempts, first_attempt_at, updated_at)
  VALUES (p_identifier_hash, 1, v_now, v_now)
  ON CONFLICT (identifier_hash) DO UPDATE
    SET
      -- If the previous lockout has expired, start a fresh count.
      attempts = CASE
        WHEN public.login_attempts.locked_until IS NOT NULL
          AND public.login_attempts.locked_until <= v_now
          THEN 1
        ELSE public.login_attempts.attempts + 1
      END,
      first_attempt_at = CASE
        WHEN public.login_attempts.locked_until IS NOT NULL
          AND public.login_attempts.locked_until <= v_now
          THEN v_now
        ELSE public.login_attempts.first_attempt_at
      END,
      locked_until = CASE
        WHEN public.login_attempts.locked_until IS NOT NULL
          AND public.login_attempts.locked_until <= v_now
          THEN NULL
        ELSE public.login_attempts.locked_until
      END,
      updated_at = v_now
  RETURNING attempts, locked_until INTO v_attempts, v_locked_until;

  -- If we've hit the threshold this call, set the lockout.
  IF v_attempts >= p_max_attempts AND (v_locked_until IS NULL OR v_locked_until <= v_now) THEN
    UPDATE public.login_attempts
      SET locked_until = v_now + make_interval(secs => p_lockout_seconds),
          updated_at = v_now
      WHERE identifier_hash = p_identifier_hash
      RETURNING locked_until INTO v_locked_until;
  END IF;

  RETURN jsonb_build_object(
    'attempts', v_attempts,
    'locked_until', v_locked_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_failed_login(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_failed_login(text, integer, integer) TO service_role;

-- clear_login_attempts: wipe the row on successful login.
CREATE OR REPLACE FUNCTION public.clear_login_attempts(
  p_identifier_hash text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE identifier_hash = p_identifier_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_login_attempts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_login_attempts(text) TO service_role;

-- ──────────────────────────────────────────────────────────────────────
-- cleanup helpers (called from /api/cron/cleanup-rate-limits)
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buckets_deleted integer;
  v_attempts_deleted integer;
BEGIN
  DELETE FROM public.rate_limit_buckets
    WHERE window_end < now() - interval '1 hour';
  GET DIAGNOSTICS v_buckets_deleted = ROW_COUNT;

  DELETE FROM public.login_attempts
    WHERE updated_at < now() - interval '24 hours'
      AND (locked_until IS NULL OR locked_until < now());
  GET DIAGNOSTICS v_attempts_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'rate_limit_buckets_deleted', v_buckets_deleted,
    'login_attempts_deleted', v_attempts_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;

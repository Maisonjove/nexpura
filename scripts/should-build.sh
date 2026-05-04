#!/usr/bin/env bash
# Vercel "Ignored Build Step" — exit 0 to SKIP the build, exit 1 to PROCEED.
#
# Goal: skip preview deploys when the diff is server-only (no UI impact),
# so we don't burn ~$3 of build minutes per backend-only PR. Production
# deploys to main are NEVER skipped.
#
# Vercel sets these env vars when invoking the ignore script:
#   VERCEL_GIT_COMMIT_REF        — branch name being deployed
#   VERCEL_GIT_PREVIOUS_SHA      — last successful deploy SHA on this branch
#   VERCEL_GIT_COMMIT_SHA        — current HEAD
#   VERCEL_ENV                   — "production" | "preview" | "development"
set -euo pipefail

log() { echo "[ignore-build] $*" >&2; }

BRANCH="${VERCEL_GIT_COMMIT_REF:-}"
PREV_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"
HEAD_SHA="${VERCEL_GIT_COMMIT_SHA:-}"
ENVIRONMENT="${VERCEL_ENV:-preview}"

# Always build production (main → prod). No exceptions.
if [ "$ENVIRONMENT" = "production" ] || [ "$BRANCH" = "main" ]; then
  log "production deploy — building."
  exit 1
fi

# No previous SHA usually means first deploy on this branch — be safe and build.
if [ -z "$PREV_SHA" ]; then
  log "no previous SHA on $BRANCH — building (first deploy)."
  exit 1
fi

# Compute changed files since the previous deploy.
CHANGED=$(git diff --name-only "$PREV_SHA" "$HEAD_SHA" 2>/dev/null || true)
if [ -z "$CHANGED" ]; then
  log "no changed files vs $PREV_SHA — skipping."
  exit 0
fi

log "diff vs $PREV_SHA:"
echo "$CHANGED" | sed 's/^/  /' >&2

# Skip-allowlist — files that CANNOT affect the deployed runtime.
#
# Joey 2026-05-04 (PR-#127 follow-up): pre-fix this allowlist also
# included `src/lib/`, `src/app/api/`, `supabase/` (all of it),
# and `scripts/`, which is wrong: those are baked into Vercel's
# serverless functions or into the build pipeline. A code change
# under any of them needs a redeploy for the new logic to be live.
#
# Concrete failure: the ad115d8 fix bumping num_stores' Zod cap
# under /api/contact got categorised as "server-only — skipping"
# and the broken validation kept running on preview, leaving Joey
# unable to verify the fix. Then we'd skipped middleware changes
# previously (G15 admin-allowlist) and edge-function changes too.
#
# New rule: skip ONLY for files with no runtime or build effect:
#   - supabase/migrations/** (run out-of-band against the DB)
#   - e2e/** (Playwright tests, run separately)
#   - docs/** + .github/** (no code on the lambda or build)
#   - markdown / git-meta files
#
# Anything else triggers a build. ALWAYS_BUILD_PATTERN is now
# redundant — middleware, lib, api, scripts, etc. all fall outside
# the new (much shorter) skip list — but kept as a belt-and-suspenders
# explicit list for the most foot-gun-prone files in case the
# allowlist regresses.
SERVER_ONLY_PATTERN='^(supabase/migrations/|e2e/|docs/|\.github/|[^/]*\.md$|\.gitignore$|\.gitattributes$|CHANGELOG[^/]*$|README[^/]*$)'

ALWAYS_BUILD_PATTERN='^(src/lib/supabase/middleware\.ts$|src/middleware\.ts$|src/lib/auth/entitlements\.ts$|src/app/api/|scripts/should-build\.sh$)'

NON_SERVER_ONLY=$(echo "$CHANGED" | grep -Ev "$SERVER_ONLY_PATTERN" || true)
ALWAYS_BUILD_HITS=$(echo "$CHANGED" | grep -E "$ALWAYS_BUILD_PATTERN" || true)
if [ -n "$ALWAYS_BUILD_HITS" ]; then
  log "always-build paths touched — building."
  echo "$ALWAYS_BUILD_HITS" | sed 's/^/  + /' >&2
  exit 1
fi
if [ -z "$NON_SERVER_ONLY" ]; then
  log "all $(echo "$CHANGED" | wc -l | tr -d ' ') changed file(s) are server-only — skipping preview build."
  exit 0
fi

log "$(echo "$NON_SERVER_ONLY" | wc -l | tr -d ' ') file(s) outside server-only allowlist — building."
echo "$NON_SERVER_ONLY" | sed 's/^/  ! /' >&2
exit 1

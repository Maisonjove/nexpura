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

# A path is "server-only" if it CANNOT affect the rendered UI:
#   - src/lib/**                 — server helpers (no React)
#   - src/app/api/**             — API routes
#   - supabase/**                — DB + edge function defs
#   - scripts/**                 — meta scripts (incl. this file)
#   - e2e/**                     — Playwright tests, run separately
#   - *.md / .gitignore / etc.   — docs + meta
#
# Anything outside this allowlist must trigger a build, including:
#   - src/app/(app|marketing|auth)/**, src/components/**, public/**
#   - package.json, pnpm-lock.yaml, next.config.*, tsconfig.json, vercel.json
#   - tailwind.config.*, postcss.config.*, src/middleware.ts, src/styles/**
SERVER_ONLY_PATTERN='^(src/lib/|src/app/api/|supabase/|scripts/|e2e/|docs/|\.github/|[^/]*\.md$|\.gitignore$|\.gitattributes$|CHANGELOG[^/]*$|README[^/]*$)'

# Even within "src/lib/" there's a small denylist of files that DO affect
# rendered routing/UI and must always trigger a rebuild. Joey 2026-05-03:
# the allowlist initially routed src/lib/supabase/middleware.ts → skip,
# which masked a routing change (admin-allowlist branch in the post-
# audit dogfood-consolidation PR). Add new paths here when you find a
# similar foot-gun.
ALWAYS_BUILD_PATTERN='^(src/lib/supabase/middleware\.ts$|src/middleware\.ts$|src/lib/auth/entitlements\.ts$)'

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

#!/usr/bin/env bash
# install-git-hooks.sh — point this clone's hooks at .githooks/.
#
# Run once per clone:
#   bash scripts/install-git-hooks.sh
#
# Also wired into `pnpm prepare` / `npm prepare`, so a fresh
# `pnpm install` after clone activates the hook automatically.
#
# What this does: sets core.hooksPath to the versioned .githooks/
# directory. That means every dev picks up the same pre-commit
# secret scanner without symlink gymnastics, and updating a hook
# is just committing the change.

set -e

# Skip silently outside a git repo — avoids noisy `pnpm install` errors
# when someone extracts a tarball or runs install in CI without .git.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit scripts/check-secrets.sh 2>/dev/null || true

echo "✓ git hooks installed (core.hooksPath = .githooks)"
echo "  pre-commit will now scan staged files for secret-shaped strings."
echo "  To bypass in a genuine emergency only: git commit --no-verify"
echo "  (don't. rotate first — see SECURITY.md)"

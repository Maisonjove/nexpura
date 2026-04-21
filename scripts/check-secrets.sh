#!/usr/bin/env bash
# check-secrets.sh — scan files for likely secret values and fail hard.
#
# Modes:
#   ./scripts/check-secrets.sh --staged   → scan files git has in the index
#                                            (for pre-commit hook use)
#   ./scripts/check-secrets.sh --all      → scan every tracked file in the
#                                            working tree (for CI use)
#   ./scripts/check-secrets.sh path ...   → scan an explicit list of files
#
# Exit status: 0 clean, 2 on match, 3 on unsupported invocation. The hook +
# CI both interpret non-zero as "block".
#
# Why a hand-rolled scanner instead of trufflehog/gitleaks/etc.?
# - No npm or python dep to bootstrap on the Vercel build runner.
# - Patterns are tuned to Nexpura's actual credential shapes — fewer false
#   positives than a general-purpose scanner.
# - Fast enough to run on every commit (~50-100ms against the full tree).
#
# Adding a new pattern: add it to PATTERNS below. Use a name + PCRE regex.
# Test by staging a file that contains a matching literal and committing.
#
# Suppressing a false positive on a specific line: end the line with the
# literal comment `# secret-allow` (any language) or `// secret-allow`.
# Reserve this for genuine placeholders (e.g. `sk_live_your-secret-key`
# in .env.example). Never use it on a real key — that defeats the whole
# point of the hook.

set -u

MODE="${1:-}"
shift || true

RED=$'\033[0;31m'
YEL=$'\033[0;33m'
GRN=$'\033[0;32m'
NC=$'\033[0m'

# =============================================================================
# Pattern registry — each entry: name | PCRE regex
# =============================================================================
# Shapes chosen to match real credential formats without matching documentation.
# Regex is applied via `grep -E` so keep it POSIX-ERE-compatible.
PATTERNS=(
  'Supabase JWT (legacy anon/service_role)|eyJhbGciOi[A-Za-z0-9_+=/-]{10,}\.eyJ[A-Za-z0-9_+=/-]{20,}\.[A-Za-z0-9_+=/-]{20,}'
  'Supabase new-format secret API key|\bsb_secret_[A-Za-z0-9_-]{20,}'
  'Supabase new-format publishable API key|\bsb_publishable_[A-Za-z0-9_-]{20,}'
  'Supabase Management PAT|\bsbp_[a-z0-9]{30,}'
  'Vercel personal API token|\bvcp_[A-Za-z0-9]{30,}'
  'GitHub personal access token|\bghp_[A-Za-z0-9]{36}'
  'GitHub fine-grained PAT|\bgithub_pat_[A-Za-z0-9_]{40,}'
  'AWS Access Key ID|\bAKIA[0-9A-Z]{16}\b'
  'Slack bot/user token|\bxox[baprs]-[A-Za-z0-9-]{10,}'
  'Stripe live secret key|\bsk_live_[A-Za-z0-9]{24,}'
  'Stripe live restricted key|\brk_live_[A-Za-z0-9]{24,}'
  'Private key header|-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED |)PRIVATE KEY-----'
  'Anthropic API key|\bsk-ant-[A-Za-z0-9_-]{30,}'
  'OpenAI API key|\bsk-proj-[A-Za-z0-9_-]{30,}'
  'Expo-account access token|\bEXPO_TOKEN[[:space:]]*[:=][[:space:]]*[["\x27]]?[A-Za-z0-9_-]{30,}'
  'Twilio auth token (high-entropy on a TWILIO line)|TWILIO_AUTH_TOKEN[[:space:]]*[:=][[:space:]]*[["\x27]]?[A-Za-z0-9]{32}'
)

# Files/paths that are scan-safe by design — placeholder-heavy docs/examples.
# These still get scanned, but any match must be on a line ending with a
# `secret-allow` marker, otherwise the hook rejects.
# The hook also ignores everything matching .gitignore (via git ls-files).

# =============================================================================
# Collect the file list
# =============================================================================
declare -a FILES
case "$MODE" in
  --staged)
    # Staged + modified, Added/Copied/Modified/Renamed, NUL-delimited to
    # survive spaces in filenames.
    while IFS= read -r -d '' f; do
      [[ -f "$f" ]] && FILES+=("$f")
    done < <(git diff --cached --name-only --diff-filter=ACMR -z)
    ;;
  --all)
    # Every tracked file — used by CI to catch anything historic that slipped in.
    while IFS= read -r -d '' f; do
      [[ -f "$f" ]] && FILES+=("$f")
    done < <(git ls-files -z)
    ;;
  "" | -h | --help)
    echo "usage: $0 --staged | --all | <file>..." >&2
    exit 3
    ;;
  *)
    # Treat $MODE + remaining args as explicit file list.
    FILES=("$MODE" "$@")
    ;;
esac

[[ ${#FILES[@]} -eq 0 ]] && exit 0

# =============================================================================
# Skip obviously binary files and vendored trees — pattern-matched secrets
# in binaries would be noise.
# =============================================================================
SKIP_PATH_RE='(^|/)(node_modules|dist|build|\.next|\.turbo|coverage|public|supabase/\.temp|e2e-live|playwright-report|test-results|qa-screenshots|migration-screenshots|mig-screenshots|screenshots?)/'
SKIP_EXT_RE='\.(png|jpe?g|gif|webp|ico|svg|mp4|mov|webm|pdf|zip|gz|tgz|bz2|woff2?|ttf|otf|eot|wasm|ico)$'

# =============================================================================
# Scan
# =============================================================================
HITS=0
for f in "${FILES[@]}"; do
  # Skip non-text / vendored paths.
  [[ "$f" =~ $SKIP_PATH_RE ]] && continue
  [[ "$f" =~ $SKIP_EXT_RE ]] && continue
  # Skip very large files (>1MB) — almost always binary or lockfiles.
  if [[ -f "$f" ]]; then
    sz=$(wc -c < "$f" 2>/dev/null || echo 0)
    (( sz > 1048576 )) && continue
  fi

  for entry in "${PATTERNS[@]}"; do
    name="${entry%%|*}"
    regex="${entry#*|}"
    # -n line numbers, -E extended regex, -H always print filename
    matches=$(grep -nHE "$regex" "$f" 2>/dev/null || true)
    [[ -z "$matches" ]] && continue

    # Filter out lines carrying the explicit `secret-allow` marker.
    filtered=$(echo "$matches" | grep -vE '(#|//)[[:space:]]*secret-allow' || true)
    [[ -z "$filtered" ]] && continue

    # If every filtered hit looks like a placeholder (your-key / XXXX / changeme),
    # that's noise — skip.
    real=$(echo "$filtered" | grep -viE 'your-[a-z]+|example|placeholder|xxxxxxx+|dummy|changeme|<[a-z_]+>|\.\.\.' || true)
    [[ -z "$real" ]] && continue

    if (( HITS == 0 )); then
      echo ""
      echo "${RED}✗ Secret-shaped string detected in staged files. Commit rejected.${NC}" >&2
      echo "" >&2
      echo "  Types found + where (line numbers shown):" >&2
    fi
    echo "${YEL}    ${name}:${NC}" >&2
    # Truncate matched line to 80 chars per hit to avoid dumping the full secret to the terminal.
    while IFS= read -r hit; do
      file_line="${hit%%:*}:${hit#*:}"; file_line="${file_line%%:*}"
      [[ "$hit" =~ ^([^:]+):([0-9]+): ]] && echo "      $f:${BASH_REMATCH[2]}" >&2
    done <<< "$real"
    HITS=$((HITS + $(echo "$real" | wc -l)))
  done
done

if (( HITS > 0 )); then
  cat >&2 <<EOF

${RED}Blocked.${NC} ${HITS} suspected secret(s) in the files you were about to commit.

What to do now:
  1. Don't force-commit this. Rotating a secret AFTER it's in git is the bad path.
  2. Remove the secret from the file. Replace with \`process.env.YOUR_VAR\`
     or similar, set the real value in Vercel / .env.local instead.
  3. If the match is a genuine placeholder in docs/examples, end the line
     with a \`# secret-allow\` (or \`// secret-allow\`) comment and retry.
  4. For rotation steps if a real secret already leaked, see SECURITY.md.

EOF
  exit 2
fi

# On --all (CI), print a success line so the workflow log isn't empty.
[[ "$MODE" == "--all" ]] && echo "${GRN}✓ No secret-shaped strings found across $(echo "${#FILES[@]}") tracked files.${NC}"

exit 0

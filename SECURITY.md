# Security

This doc covers the secret-scanning guardrails in this repo and what
to do when the guard catches something — or, worse, when it didn't
and a real credential already made it into git history.

## What's in place

Two layers, one scanner, one source of truth.

1. **Local pre-commit hook** — `.githooks/pre-commit`, a thin wrapper
   that invokes `scripts/check-secrets.sh --staged` every time you run
   `git commit`. If any staged file contains a string matching a known
   credential shape, the commit is blocked before it ever touches
   local history.
2. **CI secret scan** — `.github/workflows/secret-scan.yml` runs the
   same scanner in `--all` mode on every push and pull request. This
   catches anything that slipped past the hook (someone cloned without
   running the installer, skipped the hook with `--no-verify`, merged
   a fork, etc.). The workflow fails hard and blocks the merge.

Both layers call the same script — `scripts/check-secrets.sh` — so a
rule change in the scanner immediately applies to local and CI. Never
copy-paste the regex list into a second place.

## First-time setup (per clone)

```bash
bash scripts/install-git-hooks.sh
```

This sets `core.hooksPath` to `.githooks` so your local clone picks up
the versioned hook. It's also wired into `pnpm prepare` / `npm prepare`,
so a fresh install after `git clone` activates the hook automatically —
manual invocation is only needed if `prepare` didn't run (e.g. you
cloned without installing dependencies).

Verify it's active:

```bash
git config core.hooksPath
# → .githooks
```

## What gets blocked

The scanner matches on credential *shapes*, not entropy. Current list
(see `PATTERNS` in `scripts/check-secrets.sh` for the source of truth):

- Supabase legacy JWTs (`eyJ…` anon + service_role)
- Supabase new-format keys (`sb_secret_…`, `sb_publishable_…`)
- Supabase Management PATs (`sbp_…`)
- Vercel personal API tokens (`vcp_…`)
- GitHub classic + fine-grained PATs (`ghp_…`, `github_pat_…`)
- AWS access key IDs (`AKIA…`)
- Slack bot/user tokens (`xox[baprs]-…`)
- Stripe live secret + restricted keys (`sk_live_…`, `rk_live_…`)
- Anthropic API keys (`sk-ant-…`)
- OpenAI project API keys (`sk-proj-…`)
- Private key PEM headers (RSA, EC, DSA, OpenSSH, PGP, ENCRYPTED)
- `EXPO_TOKEN=…` with a 30+ char value
- `TWILIO_AUTH_TOKEN=…` with a 32-char value

Adding a new shape: append to `PATTERNS` in `scripts/check-secrets.sh`
with a human-readable name + PCRE regex. Keep the regex POSIX-ERE
compatible (used via `grep -E`). Test with a staged file containing
a matching literal.

## When the hook blocks a real secret

Do **not** `git commit --no-verify`. The whole point of the guard is
to catch this before it hits your clone's history, let alone the
remote. Once a secret is in any git history, assume it is public.

Instead:

1. Remove the literal from the file. Replace with
   `process.env.YOUR_VAR` (or equivalent) and set the real value in
   Vercel env vars / `.env.local` / your deploy platform.
2. Re-stage and commit.

If the secret was only in the working tree (never committed), you're
done — Vercel/Supabase/etc. still hold the only copies.

## When the hook blocks a legitimate placeholder

Docs and `.env.example` files sometimes contain strings that *look*
like credentials but are obvious placeholders. The scanner already
filters out the common ones (`your-key`, `XXXX…`, `changeme`, `dummy`,
`<placeholder>`, `example`, `…`). For anything it still catches:

End the line with a `# secret-allow` (or `// secret-allow`) comment.
Example:

```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your-secret-key-here # secret-allow
```

Use this marker **only** for genuine placeholders in docs/examples.
Never on a real key, even "temporarily" — that defeats the whole
guardrail.

## What this scanner does NOT do

- **History scan.** It only inspects the working tree (staged files
  for the hook, tracked files for CI). If a secret is already in an
  older commit, the scanner will not flag it unless that secret is
  also still present in the current tree. Use a tool like
  `trufflehog git file://. --only-verified` for a one-time deep
  history audit.
- **Entropy detection.** Generic high-entropy strings don't match.
  This is deliberate — the false positive rate on pure entropy
  against 1400+ files was unworkable. If you introduce a new
  credential format, add a shape pattern.
- **Binary / large files.** Skipped by design (images, fonts, PDFs,
  lockfiles, anything >1MB). Binary secret leakage is extremely rare
  and the noise cost isn't worth it.

## If a real secret already leaked

Order matters. Do these in order, do not skip steps.

1. **Rotate first.** The leaked value must be invalidated before
   anything else. Getting it out of git history afterward is
   cleanup; rotating afterward is damage control.
   - Supabase: Dashboard → Project Settings → API. New-format keys:
     regenerate `sb_secret_…`. Legacy JWTs: "Generate a new secret"
     invalidates the old anon + service_role pair. Legacy-JWT
     disabling (per-project) is done via Management API — see
     `https://api.supabase.com/v1/projects/{ref}/config/auth-legacy-jwt`.
   - Vercel: Account Settings → Tokens → Revoke.
   - GitHub PAT: Settings → Developer settings → Personal access
     tokens → Revoke.
   - Stripe: Dashboard → Developers → API keys → Roll.
   - AWS IAM: deactivate the access key, then delete.
   - Anthropic / OpenAI: console → revoke the exposed key.
2. **Redeploy with new values.** Update env vars in Vercel (or
   wherever the key is consumed) and trigger a redeploy. Anything
   still running with the old secret is a liability window.
3. **Verify live traffic on the new key.** For the Supabase case,
   `e2e-live/verify-new-key.mjs` exists as a template — mint an
   admin magic link, hit `/dashboard`, confirm data renders. Adapt
   per service.
4. **Clean history** (optional, lower priority than rotation).
   `git filter-repo` or BFG Repo-Cleaner to purge the blob; then
   force-push. Note: GitHub caches blob SHAs for a while after
   cleanup, so the old commit may still be reachable by SHA for
   ~24h. Rotation + step 2 is what actually makes you safe.
5. **Tell the right people.** For a shared-account leak, at
   minimum the owner of that account. For anything that touches
   customer data, that's also a disclosure decision — loop in Teo.

## Skipping the guard (genuine emergencies only)

```bash
git commit --no-verify
```

Valid uses:

- You're committing a file that contains a credential shape but
  isn't actually a credential, the placeholder filter didn't catch
  it, and you have not yet added the `secret-allow` marker. In that
  case, **add the marker instead** — don't skip.
- You're committing a rotation doc that needs to contain an old
  (already-revoked) key for incident-record purposes. Same thing —
  mark it.

There is no "I'll fix it later" case. The hook takes <200ms and the
CI scan will block the push anyway.

# Runbook — Nexpura

Owner operations. When something happens at 11pm on a Sunday, this is
the file to open first.

Sections (roughly ordered by "how urgent is this"):

- [Emergency: something's broken in production](#emergency-something-is-broken-in-production)
- [Deploy to production](#deploy-to-production)
- [Rotate a credential](#rotate-a-credential)
- [Clean up QA / test data](#clean-up-qa--test-data)
- [Backfill data](#backfill-data)
- [Run a one-off database migration](#run-a-one-off-database-migration)
- [Support surfaces (where to look)](#support-surfaces-where-to-look)

---

## Emergency: something is broken in production

Triage in this order. Don't skip.

1. **Is Vercel up?** Check https://www.vercel-status.com. If Vercel has
   an incident, nothing below will help — wait or consider failing over
   manually.
2. **Is the deploy itself OK?** Vercel → nexpura project → Deployments.
   Is the latest production deploy green? If it's red, the site is
   running the previous green deploy (Vercel's default). You still have
   a working site — deal with the fix at your leisure.
3. **Sentry.** https://sentry.io. Filter by `environment:production`.
   Sort by events/minute. The top error right now is almost certainly
   the one causing the noise. Thanks to Pass 2, server-side 5xx now
   have a `handler` tag (e.g. `handler:bespoke/approval-response:POST`)
   — filter by that to isolate.
4. **Vercel runtime logs.** If the error isn't in Sentry, it's probably
   a non-throwing failure (silently-dropped DB write). Vercel →
   Deployments → [latest] → Functions → Logs. Search for the route
   path. `logger.error` lines are structured JSON so you can grep them.
5. **Supabase advisors.** https://supabase.com/dashboard/project/vkpjocnrefjfpuovzinn/advisors.
   If the issue is DB-level (RLS, slow query, lock), Supabase's advisor
   board often has it before Sentry does.

### Quick mitigations

- **Rollback to a previous deploy.** Vercel → Deployments → find the
  last green deploy → "..." → "Promote to production". This swaps the
  production alias in ~10s. Safer than hot-fixing under pressure.
- **Kill a runaway cron job.** Supabase SQL editor:
  ```sql
  SELECT cron.unschedule('<jobname>');
  ```
  Re-enable later with whatever the migration file uses.
- **Disable a flaky route.** Fastest way is to push a commit that
  returns 503 from the route's `GET`/`POST` — re-deploys in ~40s.
  Don't delete the file; that breaks imports elsewhere.
- **Disable sandbox mode on prod, if accidentally enabled.** Vercel →
  Environment Variables → remove `SANDBOX_MODE` from Production scope.
  Redeploy (Vercel → latest deploy → "..." → "Redeploy" without cache).

### After the fire is out

- Write the incident into `docs/incidents/` (if you want a log) — date,
  symptom, cause, fix, prevention. One file per incident.
- If the root cause was an invisible-failure bug, add a guard via the
  pattern in Pass 2 (`reportServerError` in the catch, capture the
  `{ error }` from awaited Supabase calls) so the next occurrence
  isn't silent.
- Revoke any credential that might have been exposed during debugging.

---

## Deploy to production

Normal flow: merge to `main`, Vercel picks it up automatically.

### Pre-deploy checklist

- Local `pnpm build` passes. Next doesn't always surface the kinds of
  errors `tsc` catches, so keep both clean.
- `bash scripts/check-secrets.sh --all` — should pass (the CI workflow
  will block the merge otherwise, but catch it locally first).
- If the change touches a migration, read [Run a one-off database
  migration](#run-a-one-off-database-migration) below — migrations and
  code deploy on different clocks, order matters.

### Preview first

For anything non-trivial, push to a feature branch and let Vercel build
a preview. Sandbox mode is automatically on in previews (see
`SANDBOX.md`), so QA there without worrying about real sends.

The preview URL is posted as a GitHub commit status. Open it, walk
through the golden path of whatever you changed, then merge.

### Merging

```bash
git checkout main
git pull --ff-only
git merge --no-ff <branch>    # explicit merge commit, makes history readable
git push origin main
```

Vercel auto-deploys. Takes ~90s to production.

### If the deploy fails

Vercel → the failed deploy → Logs. Usually a TypeScript error you
missed locally. Fix on the branch, push, let it rebuild. If you need
to ship urgently and the error is in a file unrelated to the fix,
revert the unrelated change on a hotfix branch and ship only what
matters.

### Post-deploy sanity check

- Load https://nexpura.com — does the landing page render?
- Hit `/login`, `/signup` — do the forms render?
- If you shipped a feature, exercise it once on a real tenant.
- Sentry — any new error shapes in the last 5 min?

---

## Rotate a credential

This is a tactical procedure, not a theoretical one. Do it in the
order below. Do not skip steps.

General rule: **rotate first, clean up history second.** Once a secret
is in git, it's public. The only thing that makes you safe is the key
being invalidated.

### Supabase new-format keys (sb_secret_, sb_publishable_)

1. Dashboard → Project Settings → API → under "API keys (new format)".
2. Generate a new `sb_secret_…`. Copy the new value *before closing the
   dialog* — it's shown once.
3. Vercel → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY`. Replace
   value. Scope: Production + Preview + Development.
4. Same for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / anon equivalent if
   rotating that.
5. Vercel → Deployments → Redeploy latest with "Use existing build
   cache" **off** (force a fresh build so server bundles pick up the
   new env).
6. Smoke test: load `/dashboard` while authed — if it renders with
   data, the new key is wired through server-side correctly.
7. Back in Supabase: delete / revoke the old `sb_secret_…` after
   verifying the new one works.

### Supabase legacy JWT (anon / service_role in `eyJ…` form)

Same dashboard page. "Generate a new secret" invalidates both anon and
service_role at once. After rotation, same redeploy + smoke test.
Then optionally disable legacy JWTs entirely via Management API:

```bash
curl -X PUT "https://api.supabase.com/v1/projects/vkpjocnrefjfpuovzinn/config/auth-legacy-jwt?enabled=false" \
  -H "Authorization: Bearer $SBP_TOKEN"
```

Note the `?enabled=false` is a query param — the JSON body form
(`{"enabled":false}`) is rejected with "enabled: Required". Lesson from
the last rotation.

### Vercel personal API token (vcp_…)

1. Vercel → Account Settings → Tokens → find the token → Revoke.
2. If it was used anywhere (scripts, CI secrets), replace first, then
   revoke.

### GitHub PAT (ghp_, github_pat_)

1. GitHub → Settings → Developer settings → Personal access tokens →
   find the PAT → Revoke.
2. If used in repo secrets (Actions), update the secret before revoking.

### Stripe live keys (sk_live_, rk_live_)

Dashboard → Developers → API keys → "Roll key". Then update Vercel env
vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET_LIVE`), redeploy,
smoke test a real checkout (or a Stripe-triggered test webhook in live
mode) to verify.

### Resend / Anthropic / OpenAI / Twilio

All follow the same shape: console → revoke old, generate new → Vercel
env → redeploy → smoke test. Twilio specifically: if you rotate
`TWILIO_AUTH_TOKEN` without updating `TWILIO_ACCOUNT_SID` in Vercel,
every outbound SMS fails with 401 — verify the SID is unchanged.

### Proving a rotation worked

For Supabase service key, there's a template at
`e2e-live/verify-new-key.mjs` — mints an admin magic link, hits
`/dashboard`, confirms numbers render. Adapt per service. The check
that matters is "does live traffic work with the new key" — not "does
the key look right."

---

## Clean up QA / test data

Common shape: a tenant has accumulated test rows across several tables
during QA (inventory items named "test-*", invoices with `notes =
"QA"`, etc.) and you want to soft-delete them without breaking FK
relations.

### Approach

1. **Audit first.** Always count before you delete. In Supabase SQL
   editor:
   ```sql
   SELECT count(*) FROM inventory
   WHERE tenant_id = 'TENANT_UUID'
     AND (name ILIKE 'test-%' OR sku ILIKE 'TEST-%');
   ```
   If the count is surprising, stop and investigate — test data is the
   canary for "did production traffic sneak in?"

2. **Prefer soft-delete.** Every table with a `deleted_at` column
   should be marked, not DROPped. Keeps FKs intact and reversible:
   ```sql
   UPDATE inventory
   SET deleted_at = now(), updated_at = now()
   WHERE tenant_id = 'TENANT_UUID'
     AND name ILIKE 'test-%';
   ```

3. **Hard-delete only if there's no `deleted_at` and no FK references
   to the rows.** Check FKs with
   `SELECT * FROM information_schema.referential_constraints` first.

4. **One transaction.** Wrap batch deletes in `BEGIN / COMMIT` so a
   mistake can be rolled back:
   ```sql
   BEGIN;
   -- your updates / deletes
   -- verify with SELECT
   COMMIT;  -- or ROLLBACK
   ```

### Script pattern

For larger cleanups, put it in `e2e-live/cleanup-*.mjs` (gitignored):
load the service key from env, use the admin client, log before/after
counts. Template shape:

```js
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.SUPABASE_URL, process.env.SERVICE_KEY);

const TENANT = "…";
const { count: before } = await s.from("inventory").select("id", { count: "exact", head: true })
  .eq("tenant_id", TENANT).ilike("name", "test-%");
console.log("to delete:", before);

// dry-run first — comment out the update, just log the rows
const { error } = await s.from("inventory").update({ deleted_at: new Date().toISOString() })
  .eq("tenant_id", TENANT).ilike("name", "test-%");
console.log("result:", error ?? "ok");
```

Run the dry-run version first. Always.

---

## Backfill data

When you add a new column or a new derived-state row type, existing
rows need to be populated. Two shapes:

### Shape A: Backfill column from existing data

Prefer a SQL `UPDATE` inside a migration file (see below). That way
the backfill is versioned alongside the schema change and lands on
every environment in order.

Example (from the `sku_sequence` atomic-counter backfill):

```sql
UPDATE public.tenants t
SET sku_sequence = GREATEST(
  t.sku_sequence,
  COALESCE((
    SELECT MAX(CASE WHEN SUBSTRING(sku FROM 4) ~ '^[0-9]+$'
      THEN CAST(SUBSTRING(sku FROM 4) AS integer) ELSE 0 END)
    FROM public.inventory i
    WHERE i.tenant_id = t.id AND i.sku LIKE 'SKU%'
  ), 0)
);
```

Idempotency matters — a migration runs once in order, but if someone
re-runs it (or a branch is rebased), the update should be safe. Use
`GREATEST(existing, new)` or `WHERE col IS NULL` guards.

### Shape B: Backfill derived rows across tenants

When you add a new table (e.g. `tenant_dashboard_stats`) that needs a
row per existing tenant, prefer a one-off script in `e2e-live/` over
a migration — it's slow, it's idempotent-on-retry, and it doesn't
block schema changes if it fails partway.

Pattern (from the dashboard-stats backfill that fixed 6/35 tenants
having precomputed stats → all 35):

```js
const { data: tenants } = await s.from("tenants").select("id");
for (const t of tenants) {
  const { error } = await s.rpc("refresh_tenant_dashboard_stats", {
    p_tenant_id: t.id,
  });
  console.log(t.id, error ? "FAIL " + error.message : "ok");
}
```

Log every tenant's outcome. Failures are tenant-specific and you need
to know which ones to retry.

---

## Run a one-off database migration

Preferred path: commit a migration file to `supabase/migrations/` with
timestamp-first naming (`20260421_description.sql`), open a PR, review,
merge, let the deploy pipeline apply it.

When you need to apply something immediately (a hotfix for a hot path):

### Via Supabase MCP (preferred for Claude Code sessions)

```
mcp__supabase-sysmo__apply_migration
  project_id: vkpjocnrefjfpuovzinn
  name: short_descriptive_name
  query: <the SQL>
```

Commit the SQL as a migration file **in the same PR** — the DB state
and the migration history must match, otherwise the next developer
can't reproduce the schema locally.

### Via Supabase dashboard

Dashboard → SQL Editor → Run. Same rule: commit the equivalent
migration file in the repo so history is truthful.

### Safety notes

- **Never DDL without a `BEGIN` / `COMMIT`** unless the statement itself
  doesn't support transactions (`CREATE INDEX CONCURRENTLY` is the
  common one). If the statement errors mid-run, rollback saves you.
- **`NOT NULL` columns must have a default or a backfill** — adding a
  `NOT NULL` column to an existing table without one will reject on
  every existing row. Pattern: add nullable → backfill → `ALTER`
  `SET NOT NULL` as three separate statements.
- **New tables need RLS policies.** Every table accessible via
  PostgREST needs RLS enabled and policies that respect `tenant_id`.
  Without policies, the service role still works but any authed user
  can read everything.
- **Schema cache lag.** After an `ALTER TABLE`, PostgREST's cached
  schema may not know about the new column for a few seconds. For a
  high-frequency route that writes to that column, add a defensive
  retry — see `src/app/api/bespoke/approval-response/route.ts` for
  the pattern.

---

## Support surfaces (where to look)

Which dashboard for which question:

| Question | Look here |
| --- | --- |
| Is the site up? | https://www.vercel-status.com + `curl -I https://nexpura.com` |
| What's the latest deploy? | Vercel → nexpura → Deployments |
| What's throwing? | Sentry → filter `environment:production` |
| Is a specific handler throwing? | Sentry → filter `tags.handler:"<name>"` (set by `reportServerError`) |
| What did the Lambda actually print? | Vercel → Deployments → latest → Functions → Logs |
| Why is this DB query slow? | Supabase → Dashboard → Reports → Performance |
| Did the migration apply? | Supabase → Database → Migrations |
| Is there an RLS hole? | Supabase → Advisors |
| Is cron firing? | Supabase → SQL editor: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;` |
| Did the key rotation actually propagate? | `e2e-live/verify-new-key.mjs` (adapt per key) |
| Was an outbound email actually sent or suppressed by sandbox? | Vercel logs, grep for `"[sandbox] suppressed outbound send"` |

### Useful one-liners

```bash
# Tail prod function logs (requires vercel CLI + login)
vercel logs --follow

# Check a specific migration landed
psql "$DATABASE_URL" -c "SELECT name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;"

# Current running cron jobs
psql "$DATABASE_URL" -c "SELECT jobname, schedule, active FROM cron.job;"

# Sentry events in the last hour (requires sentry-cli + auth token)
sentry-cli events list --org nexpura --project nexpura-web --stat-period=1h
```

---

## Reference: related docs

- `SECURITY.md` — secret-scan guardrails, rotation-if-leak procedure.
- `SANDBOX.md` — what sandbox mode suppresses, how to enable it.
- `CLAUDE.md` (if present) — project conventions for AI-assisted work.

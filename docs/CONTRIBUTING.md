# Contributing — engineering invariants

Two systemic patterns surfaced repeatedly during the Phase 2 audit
(swallowed errors, cacheComponents-stale-UI). Both are now enforced by
ESLint rules in `eslint-rules/`. This doc explains the rules, the
policies behind them, and how to handle the rare cases where you
legitimately need to suppress them.

If you're new to the codebase, the short version is:

1. **Capture errors on every Supabase write.** Bare
   `await admin.from(...).insert/update/upsert/delete(...)` is banned.
2. **Mark admin server-component bodies as dynamic.** Async functions
   that render JSX + read from Supabase under `(admin)/admin/*` and
   `(app)/admin/*` must call `await connection()` (or `cookies()` /
   `headers()` / `params`) within their first 5 statements.

Both are starting at `severity: warn` and will flip to `error` once the
existing-violation backlog clears (see PR-B4).

---

## 1. Database write error policy (`local/no-bare-supabase-write`)

### The pattern

```ts
// ❌ BAD — error silently swallowed. If the update fails (RLS, broken
// schema, transient connection drop), the handler returns 200 to the
// caller anyway. State-of-record drift accumulates with no signal.
await admin.from("tenants").update({ plan: "studio" }).eq("id", id);

// ❌ ALSO BAD — partial destructure that ignores `error`.
const { data } = await admin.from("tenants").insert(...);
```

### The fix

Two policies depending on what the row means:

#### Destructive writes — throw on error

State-of-record mutations: tenants, subscriptions, sales, sale_items,
inventory, customers, repairs, bespoke_jobs, invoices, quotes, payments,
stocktakes, refunds, demo_requests, etc. If a destructive write fails,
the platform's idea of reality has drifted from the DB. We want the
caller (webhook, server action, cron) to surface the failure so the
provider retries / the user sees an error / the cron logs the failure.

```ts
// ✅ Destructive: throw → outer try/catch → 500 → provider retries
const { error } = await admin
  .from("tenants")
  .update({ plan: "studio" })
  .eq("id", id);
if (error) {
  throw new Error(`tenants update failed: ${error.message}`);
}
```

Why throw and not return: the call site is usually deep inside a server
action / webhook handler that has its own try/catch wrapping. Throwing
lets that outer scope decide how to respond (typically 500 + idempotency
lock cleanup so the provider retries the whole event).

#### Side-effect writes — log + continue

Observability rows: `activity_log`, `audit_logs`, `admin_audit_logs`,
`notifications`, `email_logs`, `sms_sends`, `whatsapp_sends`,
`communications`, telemetry, scheduled_report_logs. These rows are
"things happened" not "the thing IS this". A failed insert here means
degraded telemetry, not data loss. Log loudly so we can chase it down,
but don't break the main flow.

```ts
// ✅ Side-effect: log + continue
const { error } = await admin.from("activity_log").insert({
  tenant_id,
  action: "checkout.completed",
  details: { ... },
});
if (error) {
  logger.error("[stripe-webhook] activity_log insert failed (non-fatal)", {
    tenant_id,
    err: error,
  });
}
```

### Document the policy choice per call site

Every wrapped write should carry a brief comment explaining which
policy applies and why. Future contributors editing the file can
follow the precedent without re-deriving the choice.

```ts
// Destructive — line items are state-of-record. Throw → 500 →
// Woo retries the entire order.created event.
const { error: lineErr } = await admin.from("sale_items").insert({...});
if (lineErr) throw new Error(`sale_items insert failed: ${lineErr.message}`);
```

### Coverage gap — assigned-without-destructure

The lint rule's AST pattern catches:
- Bare expression statements: `await admin.from("X").update(...)`
- VariableDeclarator with ObjectPattern that omits `error`:
  `const { data } = await admin.from("X").insert(...)`

It does NOT catch:
- Plain assignment to a single variable that reads `.error` later:
  `const r = await admin.from("X").insert(...); if (r.error) ...`

Functionally those `r.error` patterns are equivalent (the error IS
captured), but they slip past the rule because the parent is a
VariableDeclarator with an Identifier, not an ObjectPattern. PR #135
fixed one such site in `pos/actions.ts` by refactoring to
`{ data, error }` destructure for consistency. **When you see this
pattern in code, treat it as if covered by the rule** — refactor to
destructure so future readers don't have to verify the next-line
error check.

### Allowed escape hatch: `.throwOnError()`

The Supabase client has a built-in `.throwOnError()` chain method that
makes a write throw on any DB error. The lint rule allows it.

```ts
// ✅ Allowed
await admin.from("X").update({...}).eq("id", id).throwOnError();
```

Use this for destructive writes where you'd throw the error verbatim
anyway (no custom error message). Logger error capture is automatic
via the surrounding try/catch + Sentry hook on `logger.error`.

### Suppressing the rule (rarely)

If you have a legitimate reason to swallow the error — for example, a
best-effort cache invalidation that is OK to fail silently — suppress
with a per-line comment + reason:

```ts
// eslint-disable-next-line local/no-bare-supabase-write -- best-effort
// cache invalidation, the next request will rebuild it. Real path
// behind the cache writes already handled error.
await admin.from("dashboard_cache").delete().eq("tenant_id", tenantId);
```

Reviewers should challenge any disable that doesn't have a real reason.

---

## 2. Admin page dynamic-marker policy (`local/require-connection-in-admin-pages`)

### The pattern

```tsx
// ❌ BAD — under cacheComponents: true, this body is implicitly cached
// by the prerender pipeline. After a server action mutates the DB and
// fires `revalidatePath` / `router.refresh()`, the cached render keeps
// serving stale state. The "Mark Completed" bug on /admin/demo-requests/[id]
// (PR #130) was caused by this — DB flipped to 'completed' on the first
// click; UI kept showing 'scheduled' for three more clicks.
async function TenantDetailBody({ paramsPromise }) {
  const { id } = await paramsPromise;
  const data = await loadTenantDetail(id); // ← supabase read
  return <TenantActions tenant={data.tenant} />;
}
```

### The fix

```tsx
// ✅ Marks the body as dynamic. router.refresh() now re-fetches.
async function TenantDetailBody({ paramsPromise }) {
  await connection();
  const { id } = await paramsPromise;
  const data = await loadTenantDetail(id);
  return <TenantActions tenant={data.tenant} />;
}
```

The marker can be any of:

- `await connection()` — explicit "I am dynamic" from `next/server`. Preferred.
- `await cookies()` — implicitly dynamic (you're reading request-scoped state).
- `await headers()` — same reasoning.
- `await someParams` — awaiting a `params` Promise from props counts.

`(admin)/layout.tsx` uses `await connection()` for the same reason —
look at its header comment for the canonical pattern.

### Why only admin pages?

The lint rule scopes to `src/app/(admin)/admin/**/page.tsx` and
`src/app/(app)/admin/**/page.tsx`. These are the surfaces where
mutation + UI-state-of-record pairs are most common (server actions in
TenantActions, demo-request actions, pilot-issues create/resolve, etc.)
and where Joey has been bitten twice. Other pages can be added to the
rule's scope later.

### Suppressing the rule

Same per-line comment pattern, with reason:

```tsx
async function StaticAdminShell() {
  // eslint-disable-next-line local/require-connection-in-admin-pages --
  // this body is a pure header with no DB reads; the dynamic Suspense
  // child handles its own connection() call.
  return <SomeStaticHeader />;
}
```

The rule already auto-skips functions that don't render JSX (pure
loaders) and functions that don't call `admin.from(`/`supabase.from(`
(pure shells), so suppression should be rare.

---

## 3. Webhook signature-rejection alerting

The `webhook_audit_log` table (PR #129) records every inbound webhook
delivery, valid or rejected. The hourly cron at
`/api/cron/webhook-audit-summary` rolls up the last hour by status,
adds a Sentry breadcrumb (always), and captures a Sentry exception
when tamper-shaped rejections (`invalid_signature`, `replay_attack`,
`tampered_body`) cross the threshold (default 5/hour, env var
`WEBHOOK_TAMPER_ALERT_THRESHOLD`).

Sentry alert rules on the dashboard side should fire pages / Slack /
email off these captures. Tune the threshold up if you start seeing
legitimate noise (Stripe replay buffer occasionally hits
`invalid_signature` on retries of timed-out events).

`logger.error` already forwards to `Sentry.captureException` (see
`src/lib/logger.ts:65`), so this fires through the same pipeline as
every other server-side error in the codebase.

---

## 4. Pre-commit checklist

Before pushing a PR that touches Supabase writes or admin server
components:

- [ ] `pnpm exec tsc --noEmit` — no type errors
- [ ] `pnpm exec eslint src/...` — no `error`-severity violations on
      changed files. `warn` is allowed for now (PR-B4 will tighten);
      reviewers may still ask you to wrap any new violations you
      introduce.
- [ ] If you modified webhook handlers or admin actions: check the
      audit table afterwards has exactly ONE row per intentional
      action (no duplicate retries from the cacheComponents bug).

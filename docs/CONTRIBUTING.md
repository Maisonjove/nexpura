# Contributing — engineering invariants

Three systemic patterns surfaced during the Phase 2 audit (swallowed
errors, cacheComponents-stale-UI, Sentry-flush-race). All three are
now enforced by ESLint rules in `eslint-rules/`. This doc explains the
rules, the policies behind them, and how to handle the rare cases
where you legitimately need to suppress them.

If you're new to the codebase, the short version is:

1. **Capture errors on every Supabase write.** Bare
   `await admin.from(...).insert/update/upsert/delete(...)` is banned.
2. **Mark admin server-component bodies as dynamic.** Async functions
   that render JSX + read from Supabase under `(admin)/admin/*` and
   `(app)/admin/*` must call `await connection()` (or `cookies()` /
   `headers()` / `params`) within their first 5 statements.
3. **Drain Sentry before returning from a route handler / server
   action.** Wrap route handler exports with `withSentryFlush(...)`,
   or call `await flushSentry()` before returns in server actions.

All three start at `severity: warn` and flip to `error` once the
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

## 3. Sentry serverless flush (`local/sentry-flush-before-return`)

### The pattern

```ts
// ❌ BAD — Sentry capture dropped on Vercel serverless.
//
// `logger.error(...)` forwards to `Sentry.captureException` (lib/logger.ts:67),
// which queues the event in @sentry/core's PromiseBuffer. A background
// task drains the buffer over the network. If the handler returns
// immediately after the logger.error call, the Lambda freezes before
// the buffer drains. The event never reaches Sentry — so we lose the
// observability the side-effect-log policy promised.
export async function POST(req: NextRequest) {
  const { error } = await admin.from("activity_log").insert({...});
  if (error) {
    logger.error("[stripe-webhook] activity_log insert failed (non-fatal)", {
      tenant_id, err: error,
    });
  }
  return NextResponse.json({ received: true });  // ← Sentry capture drops here
}
```

### The fix — two acceptable shapes

#### Route handlers — HOF wrap at export

```ts
// ✅ Wrap once at the export. Adds `await Sentry.flush(2000)` after
// the handler returns AND on throw (so Next.js's onRequestError hook
// can also drain). One flush per request, regardless of how many
// logger.error calls happened inside.
import { withSentryFlush } from "@/lib/sentry-flush";

export const POST = withSentryFlush(async (req: NextRequest) => {
  const { error } = await admin.from("activity_log").insert({...});
  if (error) {
    logger.error("[stripe-webhook] activity_log insert failed (non-fatal)", {
      tenant_id, err: error,
    });
  }
  return NextResponse.json({ received: true });
});
```

#### Server actions — inline `await flushSentry()`

`export async function X` declarations can't be HOF-wrapped without
breaking React's RSC form-action bindings (the React layer expects a
function declaration with a stable identifier, not a const-bound
expression with arbitrary call-site rewriting). Use the inline
helper instead:

```ts
// ✅ Inline flush before the return after logger.error.
import { flushSentry } from "@/lib/sentry-flush";

"use server";

export async function recordRepairPayment(input: RecordPaymentInput) {
  const { error } = await admin.from("payments").insert(input);
  if (error) {
    logger.error("[recordRepairPayment] insert failed", { err: error });
    await flushSentry();
    return { error: error.message };
  }
  return { success: true };
}
```

#### Exit-by-throw helpers — same flush rule

Generic principle: anything that exits the handler without an explicit
`return` still freezes the Lambda after the response is sent. The
SDK buffer needs draining before the exit. Affected helpers in this
codebase:

- `redirect(path)` from `next/navigation` — throws `NEXT_REDIRECT`
- `permanentRedirect(path)` — throws `NEXT_REDIRECT` with permanent flag
- `notFound()` — throws `NEXT_NOT_FOUND`
- `unauthorized()` — throws `NEXT_HTTP_ERROR_FALLBACK;401`
- `forbidden()` — throws `NEXT_HTTP_ERROR_FALLBACK;403`

Add `await flushSentry()` immediately before any of these when a
logger.error has fired in the function (or in a nested callback whose
queued Sentry event would otherwise drop):

```ts
// ✅ Flush before redirect. The throw still propagates to the React
// layer; Sentry events queued in catch blocks above this point land.
try {
  await maybeFireSomeOptionalThing();
} catch (err) {
  logger.error("[createRepair] optional thing failed (non-fatal)", { err });
}
revalidatePath("/repairs");
await flushSentry();
redirect(`/repairs/${data.id}`);
```

### Why explicit flush works

`Sentry.flush(timeout)` calls the transport's `drain(timeout)` which
`Promise.allSettled`s the entire pending PromiseBuffer (see
`@sentry/core/utils/promisebuffer.js`). So a single flush at end-of-
handler drains every queued event from any number of in-handler
logger.error calls. The 2000ms is a TIMEOUT not a fixed wait —
empty buffers resolve immediately. Latency penalty is roughly the
ingest round-trip (~2-3s on a hit, <5ms on miss).

### Caveats

**Buffer cap is 100 events.** If a single request fires 100+
logger.error calls, events 101+ are silently rejected by the
PromiseBuffer with `SENTRY_BUFFER_FULL_ERROR` before flush can save
them. Not a practical concern unless we hit a runaway loop, but flagged
here so future contributors know.

**Flush latency on /api/contact and other latency-sensitive routes**
is ~2-3s on a real capture. Acceptable because (a) only fires when
the buffer has events, and (b) by definition the route already had
something interesting to surface to Sentry. If a route legitimately
needs to keep the latency budget tight, consider whether the
logger.error itself should be downgraded to logger.warn (which
doesn't queue to Sentry) for that call site.

### Suppressing the rule

Same per-line comment pattern as the other two rules. Suppression
should be very rare — there's almost always a way to wrap or inline
flush. Document why:

```ts
// eslint-disable-next-line local/sentry-flush-before-return -- this
// route is invoked thousands of times per minute and has no
// logger.error path; the rule mis-fires because of a logger.error in
// a helper that's only reachable via a separate non-Sentry-instrumented
// call frame.
export const GET = async (req) => { ... };
```

### Rule scope reminder

The lint rule only catches **exported** route handlers / server
actions. Top-level helper FUNCTION DECLARATIONS in route files (e.g.
`async function handleCheckoutCompleted(...)` in
`webhooks/stripe/route.ts`) sit one frame in from the boundary, and
the wrap at the exported handler covers their flush. Internal helpers
+ UI components are not in scope.

### Known rule gap — nested-callback logger.error

The rule only inspects events within the exported function's own
body; it skips nested callbacks (`.catch(() => ...)`,
`withIdempotency(async () => {...})`, transaction wrappers). This
means a logger.error queued from inside such a callback won't trigger
the rule's flush requirement on the outer function's exit (return /
redirect / etc.). PR #138 patched two known sites manually:
`createBespokeJob` and `processRefund`, both of which fire
logger.error inside callbacks then exit via redirect. When you add a
new server action with a similar nested-callback pattern: think about
whether the callback can fire logger.error, and if so add an
`await flushSentry()` before the exit. A future enhancement to the
rule could trace logger.error calls into common callback patterns;
tracked under post-Phase-2 cleanup.

### Post-Phase-2 cleanup additions

Tracked separately for the post-Phase-2 work:
- **Capture-amplification alarm**: a single request firing > 50
  `logger.error` calls is itself a bug (likely a runaway loop); the
  PromiseBuffer's 100-event cap silently drops everything past 100.
  Future addition: a Sentry breadcrumb counter per request + alert
  rule when count exceeds 50.
- **Loop-shaped logger.error lint rule**: warn when logger.error
  appears inside a `for` / `while` / `.forEach(` body — early signal
  of capture amplification before it hits the cap.
- **Nested-callback flow detection** in the existing
  `local/sentry-flush-before-return` rule (see "Known rule gap"
  above).

---

## 4. Webhook signature-rejection alerting

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

## 5. Pre-commit checklist

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

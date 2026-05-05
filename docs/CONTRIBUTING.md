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

All three landed (Joey 2026-05-04). Sections 4 and 5 document the
two new lint rules; the runtime alarm is wired through
`runWithCaptureScope` + `withSentryFlush` and emits a Sentry
breadcrumb at the 50-capture threshold per request.

---

## 4. Loop-shaped logger.error (`local/no-logger-error-in-loop`)

### The pattern

```ts
// ❌ BAD — fires once per iteration. A 500-row batch with pervasive
// failures queues 500 Sentry events; the PromiseBuffer caps at 100
// per request, so events 101+ silently drop with
// SENTRY_BUFFER_FULL_ERROR. By the time anyone looks at Sentry, the
// observability promise the side-effect-log policy made is broken.
for (const row of rows) {
  const { error } = await admin.from("X").insert(row);
  if (error) logger.error("[X] insert failed", { row, err: error });
}
```

### The fix

Collect failures into an array inside the loop; fire a SINGLE
`logger.error` after the loop with the array as context. One Sentry
event with 500 failure rows attached beats 500 Sentry events that get
truncated to 100 (and consume 100× the request's flush budget on
transport queue time):

```ts
// ✅ GOOD — one Sentry event with the full failure list.
const failures: Array<{ row: typeof rows[number]; err: PostgrestError }> = [];
for (const row of rows) {
  const { error } = await admin.from("X").insert(row);
  if (error) failures.push({ row, err: error });
}
if (failures.length > 0) {
  logger.error("[X] batch insert had failures", {
    count: failures.length, failures,
  });
}
```

### What the rule catches

Loop shapes detected:
- `for (...)`, `for (... of ...)`, `for (... in ...)`
- `while (...)`, `do { } while (...)`
- `.forEach(...)`, `.map(...)`, `.filter(...)`, `.reduce(...)`,
  `.flatMap(...)`, `.some(...)`, `.every(...)`

### Auto-skips

- `logger.error` inside a `.catch()` callback. The rule for those
  is `local/sentry-flush-before-callback-exit` (section 5) —
  `.catch` only fires on rejection, not per iteration.
- `logger.error` inside a try/catch INSIDE a loop. Still per-iter
  but the engineer wrote the catch deliberately — opt-in shape.

### Suppressing the rule (sometimes legitimate)

For BOUNDED loops (small fixed-size step arrays, early-return
branches that fire at most ONCE per request), suppress with a
per-line comment + reason:

```ts
for (const item of items) {
  // ...
  if (rollbackErr) {
    // eslint-disable-next-line local/no-logger-error-in-loop -- bounded: this branch returns immediately, fires at most ONCE per request.
    logger.error("...", { rollbackErr });
  }
  return NextResponse.json({ error: "..." }, { status: 500 });
}
```

Severity is `warn`; the rule is observability-grade, not a hard
gate. PR-B5 swept the codebase: ~30 sites refactored to
collect-and-log-once, ~5 sites suppressed as bounded.

---

## 5. Nested-callback flush (`local/sentry-flush-before-callback-exit`)

### The pattern

This rule closes the gap section 3's "Known rule gap — nested-
callback logger.error" called out: `local/sentry-flush-before-return`
walks only the exported function's own body, missing logger.error
calls queued from inside `.catch(...)` / `withIdempotency(async () =>
{...})` / transaction-step callbacks. PR #138's amendment manually
patched two sites; this rule now flags the entire pattern.

```ts
// ❌ BAD — logger.error fires from inside the .catch() callback,
// which the sibling rule's per-function walk skips. The outer
// function exits via redirect() before the buffer drains.
export async function createBespokeJob(...) {
  // ...
  sendTrackingEmail({...}).catch((err) => {
    logger.error("[createBespokeJob] tracking email failed", err);
  });
  redirect(`/bespoke/${data.id}`);  // Lambda freezes; capture lost
}

// ✅ GOOD — flush before the exit. Drains any queued capture from
// the nested callback regardless of whether it actually fired this
// request (no-op on empty buffer).
export async function createBespokeJob(...) {
  // ...
  sendTrackingEmail({...}).catch((err) => {
    logger.error("[createBespokeJob] tracking email failed", err);
  });
  await flushSentry();
  redirect(`/bespoke/${data.id}`);
}
```

### Detection

Walked in source-line order:
1. Find every nested `logger.error` — i.e. a logger.error call
   inside a callback function passed as an argument to another call
   (`.catch(...)`, `withIdempotency(...)`, `Promise.all([...])`,
   transaction wrappers, etc.) whose enclosing function is NOT the
   outer exported handler.
2. For each exit point in the outer function's own body
   (`return` / `throw` / `redirect()` / `notFound()` /
   `unauthorized()` / `permanentRedirect()` / `forbidden()`):
   if a nested logger.error appears earlier in source order AND
   no `await flushSentry()` / `await Sentry.flush()` sits between
   the two in the outer body — flag the exit.

### Auto-skips

- Functions wrapped with `withSentryFlush(...)` at export site
  (the wrapper drains at the boundary).
- Exits already preceded by an inline flush.

### Edge cases / known false-positive shape

The rule walks source-line order, not full control-flow. If the only
path to an exit doesn't actually run the nested callback (e.g. a
`.catch()` on a fire-and-forget promise that the outer function
never awaits, plus an outer exit on a totally separate branch), the
rule may still flag. The cost of a stray `await flushSentry()` is
negligible (no-op on empty buffer; ~5ms on miss), so the practical
guidance is: just add the flush and move on. If it becomes noisy in
a particular file, suppress per-line with a reason.

### Severity

`warn`. PR-B5 swept the codebase: 10 sites patched (pos/actions,
refunds/actions, settings/locations/actions, tasks/actions). All
real nested-callback paths where a logger.error in `.catch` /
`withIdempotency` could otherwise drop on Lambda freeze.

---

## 6. Capture-amplification alarm (runtime, `src/lib/logger.ts`)

Companion to section 4's lint rule. Where `no-logger-error-in-loop`
catches the pattern at build time, this surfaces it at runtime for
any pattern the lint rule didn't catch (helper called from a loop,
recursive function with logger.error, etc.).

### Mechanics

- `runWithCaptureScope(fn, { tag })` seeds a fresh per-request scope
  using `AsyncLocalStorage`. `withSentryFlush` calls it at the route
  handler boundary; the handler's name becomes the scope `tag`.
- Every `logger.error` call increments the scope's counter (no-op
  outside a scope — unit tests, scripts, etc.).
- The first time the count crosses the threshold (50), the rule
  emits ONE `Sentry.addBreadcrumb({ category: "capture-amplification",
  level: "warning", message: "...", data: { count, threshold, tag } })`.
- The breadcrumb is latched per scope: counts of 51, 52, 53, ... do
  not emit again. Operator sees one breadcrumb per amplified request,
  not 50+.
- Threshold is 50 — well clear of the PromiseBuffer's 100-event cap,
  but high enough to avoid noise from routes that legitimately fire
  3-5 logger.error in a complex saga.

### What the operator sees

A request that fires 50+ logger.error has the breadcrumb attached
to whichever Sentry event landed (the captureException for one of
the logger.error calls). Filter Sentry by the
`capture-amplification` category to find runaway-loop routes.

### Test

`src/lib/__tests__/capture-amplification-alarm.test.ts` mocks
`@sentry/nextjs` and asserts:
1. 60 logger.error calls in a scope → exactly 1 amplification
   breadcrumb (at count=50).
2. 49 calls → 0 breadcrumbs.
3. 60 calls outside any scope → 0 breadcrumbs (silent no-op).
4. Nested `runWithCaptureScope` keeps separate counters.

---

## 7. Webhook signature-rejection alerting

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

## 8. Top-level `node:*` imports in `src/lib/*` — verify import surface first

Files in `src/lib/*` are often imported by both server and client/edge
code paths. Adding a top-level `import { ... } from "node:..."` (or any
node-only module) to a file that's transitively imported by client code
breaks the Turbopack build with this signature in Vercel logs:

```
Build error occurred
Error: Turbopack build failed with 1 errors:
./src/lib/<file>.ts
Code generation for chunk item errored
```

Surfaced in PR #144 → PR #145: `src/lib/logger.ts` got a top-level
`import { AsyncLocalStorage } from "node:async_hooks"`. logger.ts is
imported by client components (for client-side error capture) and edge
runtime contexts. Turbopack errored on the client/edge chunk; the
production deploy went to ERROR and main was ahead-of-prod with broken
code for ~10 min before the deploy poll caught it.

### The hook-registration pattern (canonical fix)

When you need server-only instrumentation that integrates with a shared
utility (logger, error-reporter, tracing), don't add the node-only
import to the shared utility. Use hook-registration instead:

1. **Shared utility** (runtime-agnostic) exposes a `setHook(fn)`
   registration entry + an internal `hook?.()` call site. If no hook
   is registered, the call is a clean no-op.

2. **Server-only module** (separate file) imports the shared utility,
   imports its own node-only deps, defines the hook implementation, and
   self-registers via `setHook(fn)` on import. Server contexts that
   import this module install the hook; client/edge bundles never
   import it, so the hook stays null.

3. **Wiring**: an existing server-only entry point (HOF wrapper, route-
   handler boundary) imports the server-only module to ensure
   registration fires. e.g. `src/lib/sentry-flush.ts` imports
   `src/lib/capture-amplification-alarm.ts` so every
   `withSentryFlush`-wrapped handler installs the hook on logger.

PR #145 split is the canonical example:
- `src/lib/logger.ts` — runtime-agnostic, exposes
  `setIncrementCaptureHook`
- `src/lib/capture-amplification-alarm.ts` — server-only, imports
  `node:async_hooks`, registers itself on import
- `src/lib/sentry-flush.ts` — imports the alarm module so route
  handler boundaries install the hook

**Defensive guard**: wrap the `setHook` call in `try/catch` — test
files that `vi.mock(...)` the shared utility may return a proxy that
throws on unmocked property access. Failing to register at test-time
is acceptable because mocked tests aren't exercising the hook path
anyway. PR #148 added this guard after PR #145.

### Pre-flight check before adding top-level node-only imports

If you're adding `import { ... } from "node:..."` (or any node-only
module like `fs`, `path`, `child_process`, etc.) to a file in
`src/lib/*`, run:

```bash
grep -rln '@/lib/<your-file>\|"\./<your-file>"\|"\.\./<your-file>"' src/ \
  --include="*.tsx" --include="*.ts" \
  | xargs grep -l '"use client"\|export const runtime = "edge"' 2>/dev/null
```

If any result — even one client component or edge route — DO NOT add
the import. Use the hook-registration pattern instead.

---

## 9. Multi-agent dispatch isolation

When dispatching 2+ parallel coding agents on the same repo working
tree, they will collide. Symptoms observed in this codebase
(PR #144 → #148 sequence):

- Branch HEAD bouncing between commits as agents `git checkout -b`
  back-and-forth
- Cross-branch commit contamination (PR-13's commit landed on the
  PR-18 branch, requiring manual cherry-pick recovery during rebase)
- Lint catching working-tree drift sometimes but not always (PR #142's
  `eslint-disable` comments added to webhooks/resend after Stream C
  agent's tree was created — the agent's edits didn't include them,
  lint caught the gap on rebase)
- Agents committing files not in their assigned scope (their
  `git add -A` swept in another agent's mid-edit files)

### Three approaches (in order of robustness)

**A. `git worktree` per agent (recommended for true isolation)**

```bash
# At dispatch time, for each agent:
git worktree add /tmp/agent-<n>-worktree -b cleanup/<scope>
# Agent operates entirely in /tmp/agent-<n>-worktree
# After: git worktree remove /tmp/agent-<n>-worktree
```

The Agent tool's `isolation: "worktree"` parameter does this
automatically — pass it when dispatching code-modifying agents in
parallel.

**B. Serial dispatch with explicit completion gates**

Dispatch one agent at a time. Wait for completion + push + branch
creation before dispatching the next. Loses parallelism but trivially
safe. Use when worktree isolation isn't available or when agents need
to cross-check each other's work.

**C. Read-only / non-modifying agents in parallel**

Audit / forensic / analysis agents that only READ files (no edits, no
git commits) can safely run in parallel without isolation. They share
the working tree but never modify it. Stream 2-5 in the post-Phase-2
cleanup parallel run used this pattern.

### Discipline at agent kickoff

If isolation isn't available, brief each parallel agent with explicit
git discipline:

```
ALWAYS branch from main HEAD before starting:
  git fetch origin main
  git checkout main
  git pull --ff-only
  git checkout -b cleanup/<scope>
```

And: stage explicit file paths (not `git add -A`) when committing, so
mid-edit files from sibling agents don't sweep into your commit.

### Verification before opening PR

After parallel agents complete, ALWAYS run before opening their PRs:

1. `git log origin/main..HEAD` — verify only YOUR commits, no contamination
2. `pnpm exec tsc --noEmit && pnpm exec eslint src/` — verify clean state
3. CI on the preview deploy actually passes — if it errors, the
   working-tree drift didn't get caught locally

---

## 10. Pre-commit checklist

Before pushing a PR that touches Supabase writes or admin server
components:

- [ ] `pnpm exec tsc --noEmit` — no type errors
- [ ] `pnpm exec eslint src/...` — no `error`-severity violations on
      changed files. The 5 local rules (`no-bare-supabase-write`,
      `require-connection-in-admin-pages`,
      `sentry-flush-before-return`, `no-logger-error-in-loop`,
      `sentry-flush-before-callback-exit`) are at `error` severity post
      PR-B4/B5 — any new violation blocks the build.
- [ ] If you modified webhook handlers or admin actions: check the
      audit table afterwards has exactly ONE row per intentional
      action (no duplicate retries from the cacheComponents bug).
- [ ] If you added a top-level `node:*` import to `src/lib/*`: ran the
      import-surface grep (§8) — no client/edge consumers, OR used
      the hook-registration pattern.
- [ ] If you edited a `"use server"` file's exports (consolidation,
      re-export, etc.): ran a local `pnpm build` once before pushing.
      tsc + vitest cannot see the SWC server-action transform's
      "module has no exports at all" failure. The
      `local/no-server-action-reexport` rule catches the most common
      shape (bare `export {x} from "y"`), but exotic shapes still need
      the build verification. See §14.
- [ ] If multiple parallel agents touched the codebase: ran the §9
      verification step before opening the PR.
- [ ] Post-deploy: ran `BASE_URL=https://nexpura.com pnpm smoke:dashboard`
      against prod with the test creds. Asserts /nexpura/dashboard
      renders cleanly — see §11.
- [ ] If a build script touches `public/*`: post-deploy `curl` the
      modified file from prod and confirm the modification is live —
      see §12. Vercel publishes from staged output, not source, so a
      script that only runs after `next build` will appear successful
      in build logs but ship the pre-modification file.
- [ ] Did this PR add a defense (rate-limit / role gate / signature /
      tenant-scope / soft-delete filter / idempotency / error-shape)?
      If yes, were sibling handlers under the same parent path checked
      for the same defense? Document siblings audited in PR description;
      if any sibling was found missing, fix in this PR or open
      follow-up tagged `half-fix-pair`. See §13.

---

## 11. Post-deploy dashboard smoke (cleanup #24)

After every prod deploy, run:

```bash
BASE_URL=https://nexpura.com pnpm smoke:dashboard
```

The spec lives at `e2e/post-deploy-smoke.spec.ts`. It launches a fresh
browser context (no cookies, no SW, no cache), logs in as the dogfood
test user, navigates to `/nexpura/dashboard`, and asserts the page
renders a `Workspace` h1 with no `"Something went wrong"` /
`"We've been notified about this issue"` strings anywhere on the page.

This catches the failure class from 2026-05-05: a deploy that ships
modified RSC chunk hashes can leave SW-cached RSC payloads pointing at
removed exports, which trips the global error boundary on the next
click-time fetch. Hard-refresh hides the bug because hard-refresh
bypasses the SW. The smoke test does NOT use a hard-refresh, so it
catches what real users hit.

Override the user with `SMOKE_EMAIL` / `SMOKE_PASSWORD`. Override the
target path with `SMOKE_DASHBOARD_PATH` (default `/nexpura/dashboard`).

The matching SW-side fix lives in `public/sw.js` (cache-first
restricted to content-hashed assets, RSC payloads always network-only)
and `scripts/inject-sw-version.mjs` (postbuild rewrite of
CACHE_VERSION per Vercel deploy).

---

## 12. Modifying `public/*` at build time on Vercel

Next.js stages `public/*` files into `.vercel/output/static` DURING
`next build`. Modifications to `public/*` files AFTER `next build`
finishes do NOT propagate to the deployed bundle — Vercel publishes
from the staged output, not from the post-build source.

Implications:

- A `postbuild` lifecycle hook fires AFTER staging — too late.
- Chaining a script with `&& node ...` after `next build` — also too
  late.
- The script must run BEFORE `next build` (use `prebuild` lifecycle,
  or chain BEFORE `next build` via `&&`).

Example: PR-P2A-dashboard-fix shipped a `scripts/inject-sw-version.mjs`
that rewrites `CACHE_VERSION` in `public/sw.js` to a per-deploy build
ID. Initial implementation used `postbuild` — the script ran on
Vercel (build logs confirmed) but the deployed `sw.js` still showed
the pre-injection literal. Fix: switch to `prebuild` so the
modification lands in source BEFORE `next build` snapshots `public/`.

If you need to modify ANY `public/*` file at deploy time, use
`prebuild`, never `postbuild`. Verification probe: after deploy,
`curl` the modified file from prod and confirm the change is present.

---

## 13. Half-fix-pair pattern

A "half-fix-pair" is a recurring bug class in this codebase. Two or
more sibling handlers (same parent path, same logic family) share
substantively identical logic, but a defensive change applied during
incident response to ONE sibling never propagates to the others.
The "defense" is the diff that closed the original issue; the
"exposure" is the same code path on a sibling that never received
the diff.

### Confirmed historical instances (2026-04 → 2026-05)

1. **AAL2 middleware over-reach** (PRs #121 / #123 / #129).
   `src/lib/supabase/middleware.ts` short-circuited `/api/*` past the
   AAL2 enforcement chain. Fix added exemptions one path at a time
   across THREE PRs; without the audit,
   `/api/integrations/woocommerce/webhook` would still be in the
   over-reach state.

2. **Resend webhook email.bounced vs email.complained** (PR #142).
   `email.bounced` was hardened to scope by tenant via
   `email_logs.resend_id → tenant_id` and to log+continue on update
   failures. `email.complained` — same shape, same threat — stayed
   exposed until P2-F audit caught it.

3. **sms/send-login + sms/setup** (closed by PR #150 — full SMS-2FA
   removal). Both routes had the IP-keyed rate-limit bug; only one
   was being patched at a time. Removing SMS 2FA entirely closed
   both branches structurally.

4. **storefront /api/shop/* deleted_at filtering** (PR #154). Three
   sibling routes (appointment / repair-enquiry / repair-track) had
   `tenants!inner(deleted_at)` filtering after PR #121's P2-B audit;
   `enquiry` did not. A soft-deleted tenant could still receive
   public-form submissions until P2-C audit caught the asymmetry.

5. **cron-iterates-tenants** (THIS PR). Three lifecycle crons
   (grace-period-checker / trial-end-checker / process-tenant-deletions)
   filter on `tenants.deleted_at IS NULL`. Three other crons
   (daily-tasks-digest / scheduled-reports / shopify-reconciliation)
   iterate every tenant including soft-deleted. Soft-deleted tenant +
   active scheduled_reports row → CSV data dump emailed to saved
   recipients post-deletion. Same family, same threat, three sibling
   defences missing.

### Discipline: when patching a defensive change, propagate to siblings

Whenever you add a defense to a handler — rate-limit, signature
verification, role gate, soft-delete filter, error-shape sanitisation,
tenant scope, idempotency lock — STOP before opening the PR and:

1. Identify the sibling set. Default unit = the directory containing
   your file: `src/app/api/<parent>/*/route.ts`. For lib helpers, look
   at the family that imports the same primitive (e.g. all callers of
   `sendTwilioWhatsApp` / `sendTwilioSms`).
2. Run the same grep across siblings:
   ```bash
   git grep -nE "<defense pattern>" src/app/api/<parent>/
   ```
3. For every sibling that does NOT carry the defense, decide
   explicitly: deliberate design choice OR half-fix?
4. If half-fix: fix in same PR, OR open follow-up issue tagged
   `half-fix-pair` referencing the originating audit.

### Pre-flight checklist line for the deployment-audit gate

Add to the deployment-audit gate (per-PR review before merge to main):

> [ ] Did this PR add a defense (rate-limit / role gate / signature /
> tenant-scope / soft-delete filter / idempotency / error-shape)?
> If yes, were sibling handlers under the same parent path checked
> for the same defense? Document siblings audited in PR description;
> if any sibling was found missing, fix in this PR or open
> follow-up tagged `half-fix-pair`.

### Cross-reference

Lint rules that catch related patterns are documented in §4-§6:
- `no-bare-supabase-write` (defensive write-error capture)
- `sentry-flush-before-return` (serverless flush)
- `sentry-flush-before-callback-exit` (callback-style flush)
- `no-logger-error-in-loop` (capture amplification alarm)

These rules catch the SHAPE of half-fix-pair siblings — when
bare-write or no-flush is added back via copy-paste from a different
file, lint surfaces it. The half-fix-pair audit is a complementary
manual check for non-lint-able patterns (deleted_at filtering, role
gates, etc.).

---

## 14. "Use server" files: only async functions allowed

Files with a `"use server"` directive at the top are restricted by
Next.js's SWC server-action transform: **only directly-defined async
functions may be exported.** Anything else — a re-export, a
non-async function, a const/let/var, a class, a default-export of a
non-async value — silently breaks **every** export from that file at
build time. Not just the offending symbol; all local async exports
become invisible to the bundler too.

The local TypeScript compiler and Vitest contract tests do not catch
this — both shapes are valid TypeScript and contract tests grep
source. Only an actual Next.js production build does.

### Two failure shapes (canonical incidents)

#### Shape A — re-export (PR #187, fixed by commit `fbd2d0c0`)

```ts
// src/app/(app)/settings/team/actions.ts
"use server";

import { logger } from "@/lib/logger";

// 👇 This single line silently nukes every other export below.
export { inviteTeamMember } from "../roles/actions";

export async function updateTeamMemberRole(...) { ... }   // ← invisible
export async function removeTeamMember(...) { ... }       // ← invisible
export async function createTask(...) { ... }             // ← invisible
```

Build error from Vercel:

> `./src/app/(app)/settings/team/TeamClient.tsx:6:1`
> `Export updateTeamMemberRole doesn't exist in target module`
>
> The export `updateTeamMemberRole` was not found in module
> `./src/app/(app)/settings/team/actions.ts`. **The module has no
> exports at all.** All exports of the module are statically known
> (It doesn't have dynamic exports). So it's known statically that
> the requested export doesn't exist.

#### Shape B — non-async const (PR #161, fixed by commit `99d02d4b` / hotfix #195)

```ts
// src/app/(app)/sales/sales-actions.ts
"use server";

// 👇 const exports trigger the same cascade.
export const SALES_LIST_PAGE_SIZE = 50;

export async function getSalesPage(...) { ... }   // ← invisible
export async function getSales(...) { ... }       // ← invisible
```

Build error from Vercel:

> `./src/app/(app)/sales/sales-actions.ts:73:1`
> `Only async functions are allowed to be exported in a "use server" file.`
>
> Followed by the same downstream "module has no exports at all"
> cascade across every consumer of `getSales`, `getSalesPage`, and
> the `SaleWithLocation` type.

The two shapes share the same root cause — anything other than
`export async function` poisons the entire module — but they emit
different first-line errors, which is why the rule was first cut
narrow (re-exports only) and extended after Shape B caught us.

### The patterns that work

For Shape A (re-export): drop the re-export, have consumers import
directly from the canonical file.

```ts
// src/app/(app)/settings/team/actions.ts — no re-export, only locals
"use server";
export async function updateTeamMemberRole(...) { ... }
export async function removeTeamMember(...) { ... }
export async function createTask(...) { ... }
```

```tsx
// src/app/(app)/settings/team/TeamClient.tsx
import {
  removeTeamMember,
  updateTeamMemberRole,
  createTask,
} from "./actions";

// Imported directly from the canonical, NOT via a re-export.
import { inviteTeamMember } from "../roles/actions";
```

For Shape B (non-async export): extract to a sibling types/constants
file with NO `"use server"` directive. Type-only re-exports back into
the action file are bundler-safe (the lint rule explicitly exempts
them) so callers that import types from the action file keep working.

```ts
// src/app/(app)/sales/sales-types.ts — no "use server"; non-async exports OK
export const SALES_LIST_PAGE_SIZE = 50;
export interface SaleWithLocation { /* ... */ }
```

```ts
// src/app/(app)/sales/sales-actions.ts
"use server";
import { SALES_LIST_PAGE_SIZE } from "./sales-types";
// Type-only re-export (allowed; the lint rule exempts type-only).
export type { SaleWithLocation } from "./sales-types";
export async function getSalesPage(...) { ... }
```

### Allowed shapes inside a `"use server"` file

| Shape | Allowed? | Notes |
|---|---|---|
| `export async function x(...)` | ✅ | The canonical pattern |
| `export type { T } from "y"` | ✅ | Type-only re-export — erased before bundling |
| `export type X = ...` | ✅ | Type alias — erased |
| `export interface X { ... }` | ✅ | Interface — erased |
| `export { x } from "y"` | ❌ | Re-export (Shape A) |
| `export * from "y"` | ❌ | Star re-export |
| `export const X = ...` | ❌ | Non-async const (Shape B) |
| `export let X = ...` | ❌ | Non-async let |
| `export var X = ...` | ❌ | Non-async var |
| `export function x(...)` | ❌ | Non-async function |
| `export class X {}` | ❌ | Class |
| `export default X` | ❌ | Non-async-function default |
| `export default async function ...` | ✅ | The async-default exception |

### Why local checks don't catch this

| Tool | Sees the bug? | Why |
|---|---|---|
| `pnpm tsc --noEmit` | ❌ no | Both shapes are valid TypeScript. |
| `pnpm vitest run` | ❌ no | Contract tests grep source. |
| `pnpm exec eslint` (`local/no-server-action-reexport`) | ✅ yes | Custom rule covers all forbidden shapes. Locked at `error` severity. |
| `pnpm build` (locally) | ✅ yes | The Next.js production build runs the SWC transform. |
| Vercel deploy | ✅ yes | Same as `pnpm build`. |

The lint rule is the cheapest gate — you don't need a full local
build to catch the common shape. But the build remains the ultimate
verifier for exotic cases (e.g. dynamic re-exports the rule can't
statically detect, or future SWC behaviors).

Treat a clean tsc + green Vitest as necessary-but-not-sufficient for
server-action edits. If you change anything in a `"use server"`
file's export shape (especially adding/removing re-exports), run a
local `pnpm build` once before pushing, or accept that the Vercel
preview is the verifier.

### Canonical references

- **Shape A — PR #187** (`post-audit/h04-invite-consolidation`).
  Introduced the re-export when consolidating `inviteTeamMember`.
  tsc + Vitest were green; Vercel preview deploy failed. Commit
  `fbd2d0c0` reverted the re-export and switched the consumer to a
  direct import; deploy cleared on the next commit.

- **Shape B — PR #161 → wave-2 hotfix #195** (`post-audit/sales-actions-server-violation`).
  PR #161 (UX hygiene /sales) inlined `export const SALES_LIST_PAGE_SIZE = 50`
  at the top of `sales-actions.ts`. Wave 2 of the post-audit merge
  cadence merged it cleanly (tsc + Vitest still green) but the prod
  deploy ERRORed with "Only async functions are allowed to be exported
  in a 'use server' file" plus 5 cascade errors. Hotfix #195
  (commit `99d02d4b`) extracted the const + types to a sibling
  `sales-types.ts` file. After this incident the
  `local/no-server-action-reexport` rule was extended to cover all
  non-async export shapes; the proactive grep across all 70+
  `"use server"` files in the codebase confirmed zero remaining
  violations.

### Why this is a half-fix-pair (§13) signal too

The original H-04a change touched two siblings (`settings/team/actions.ts`
and `settings/roles/actions.ts`). The fix consolidated logic into one,
which is the right shape — but the re-export was added as a
backwards-compatibility convenience for callers, and that convenience
is what tripped the bundler. **When consolidating sibling files, do
not leave a re-export shim behind**; update the call sites.

---

## 15. Mocking the contract point hides production failures

When a contract test mocks the value at the boundary it's supposed to
verify — an HTTP header name, an env var name, the shape a third-party
API returns — the test passes while production fails because the
boundary's actual identity differs from the mock. The test isn't
testing what it claims to test; it's testing the test's own assumption
about the boundary, and the assumption can be wrong.

### Canonical example — C-06 v1 (PR #157, fixed in commit `5d031c7b`)

The first cut of the deploy-skew detection layer mocked a header name
in its unit tests:

```ts
// src/components/__tests__/DeployVersionBanner.test.tsx (v1)
function makeResponseWithHeader(value: string | null): Response {
  const headers = new Headers();
  if (value !== null) headers.set('x-deployment-id', value); // ← assumed
  return new Response(null, { status: 200, headers });
}

it('triggers onMismatch when x-deployment-id differs from clientBuildId', async () => {
  window.fetch = vi.fn().mockResolvedValue(makeResponseWithHeader('build-newdeploy12'));
  // ...
});
```

14/14 unit tests passed. The component shipped to a Vercel preview.
The mechanism never triggered in production. Verification probe:

```bash
curl -sI -H "RSC: 1" https://<preview>/login | grep -i deployment
# x-nextjs-deployment-id: dpl_9L39oEXjGjahfcxAj8viKAd6oENX
# (no x-deployment-id)
```

The actual header is `x-nextjs-deployment-id`, carrying Vercel's
`dpl_xxx` token. The test mocked the contract point — the response
header — so the component's behavior given that mock was correct, but
the mock itself was a fiction.

### Detection rule — when writing a test that asserts behavior at a third-party boundary

Ask yourself one question: *am I testing my code's behavior given a
value, or am I testing that the boundary actually emits that value?*

| Test shape | What it verifies | When it's enough |
|---|---|---|
| Unit (mocked boundary) | Code's behavior given a value | When the boundary's identity is well-documented + stable + part of a published public API |
| Contract (probes real boundary) | Code's behavior AND the boundary emits the expected shape | When the boundary is a third-party surface (Vercel/Next/Stripe/Supabase headers, env vars, response payloads) |

Boundaries that need contract-level coverage in this codebase:

- HTTP response headers from Vercel/Next (e.g. `x-nextjs-deployment-id`,
  `x-vercel-cache`)
- Env var names auto-injected by Vercel (e.g. `VERCEL_GIT_COMMIT_SHA`,
  `NEXT_DEPLOYMENT_ID`)
- Response shapes from third-party SDKs (Supabase shadow-response
  signatures — see NEW-01 / PR #191; Stripe webhook event types;
  Resend send-result codes)
- Postgres error codes the app branches on
- File-system layout the SWC bundler keys on (see §14)

### How to probe instead of mock

For HTTP boundaries: capture an actual response from a deployed
preview (`curl -I` is enough for headers) and pin the header name +
shape in a fixture file. Test against the fixture; document the date
and deploy ID the fixture was captured from.

For env boundaries: pin the names in the test, not the values
(`expect(process.env).toHaveProperty('NEXT_DEPLOYMENT_ID')` proves the
env var is set, not what it contains).

For SDK shapes: use the SDK's own typed response in your fixture
(don't hand-roll a plain object whose shape you assumed).

Don't replace unit tests with contract tests — keep both. Unit tests
are still the cheapest way to cover branching logic. The contract test
is what catches the assumption error in the unit-test fixtures.

### Cross-references

- §14 — `"use server"` re-export pitfall (caught by `pnpm build`,
  missed by tsc + vitest; same shape: a test that doesn't run the
  real boundary's machinery can't see the failure)
- PR #157 commit `5d031c7b` — the fix for the header-name assumption
- PR #157 commit `6a71881d` — the original failure shape (kept in
  history as the canonical reference; see commit body)
- `src/lib/__tests__/c06-config-contract.test.ts` — the contract test
  added in `5d031c7b` that probes the actual surface (next.config.ts
  output + bundle inlining + header name in source)

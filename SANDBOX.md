# Sandbox Mode

How to test, QA, and demo Nexpura end-to-end without firing real
Stripe charges, real customer emails, or real WhatsApp/SMS sends.

## What sandbox mode does

When sandbox mode is on:

- **Resend email sends are suppressed.** `sendTenantEmail` and
  `sendSystemEmail` return a fake success (`messageId: "sandbox-suppressed"`)
  and log the intent as structured JSON. No request hits Resend. Optionally
  redirect all sandbox email to a single QA inbox (see
  `SANDBOX_REDIRECT_EMAIL` below) to inspect templates visually.
- **Twilio SMS sends are suppressed.** `sendTwilioSms` returns
  `{ success: true, messageId: "sandbox-suppressed" }` and logs the body
  + recipient. No request hits Twilio. This includes 2FA SMS, so 2FA in
  a sandbox deploy won't work — which is the point.
- **Twilio WhatsApp sends are suppressed.** Same pattern. The marketing
  campaign batch-send path is the most dangerous — a QA click on
  "send campaign" in a live environment fires real messages — so this
  gate is the primary guard for that surface.
- **Stripe key mismatch warning.** On boot, if sandbox mode is on but
  `STRIPE_SECRET_KEY` still starts with `sk_live_`, a loud error is
  logged and sent to Sentry. The app does not crash — a mismatch in a
  preview deploy isn't a security breach, just a configuration mistake.

All sandbox suppressions are logged as structured JSON via `logger.info`
with `channel`, `to`, and `subject` / `preview` fields, so you can see
exactly what *would* have gone out in Vercel logs.

## What sandbox mode does NOT do (yet)

- **Stripe charges still work.** Sandbox mode does not intercept Stripe
  API calls. If you want sandbox deploys to hit Stripe test mode, set
  `STRIPE_SECRET_KEY` to a `sk_test_…` key and `STRIPE_WEBHOOK_SECRET` to
  the test-mode webhook secret in that environment's Vercel config. The
  startup assert above will warn you if you forget.
- **Supabase database is shared.** All deploys still point at the
  production Supabase project. If you want an isolated test DB, use a
  Supabase branch (see https://supabase.com/docs/guides/platform/branching)
  and swap the `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  vars in that Vercel environment.
- **Cron jobs are not gated.** If a scheduled `pg_cron` job runs in a
  sandbox environment with production DB access, it runs against
  production data. This is the biggest remaining gap and should be
  closed before running cron-triggered workflows in preview deploys.

## When sandbox mode is ON

The gate is `src/lib/sandbox.ts` → `isSandbox()`. Returns `true` when
**any** of these are true:

1. `SANDBOX_MODE=true` (explicit, recommended for clarity)
2. `VERCEL_ENV !== "production"` (Vercel preview + development)
3. `NODE_ENV === "development"` (local dev)

Intentionally permissive: the cost of a false positive (a preview deploy
that should have sent an email but didn't) is much lower than the cost
of a false negative (a preview deploy that quietly texts a customer).

## Running local dev safely

Nothing to do. `NODE_ENV=development` triggers sandbox mode automatically.
You can still *see* what would have been sent in the console / Vercel
logs — look for `"[sandbox] suppressed outbound send"`.

If you want local sends to actually reach a test inbox for visual QA,
set `SANDBOX_REDIRECT_EMAIL=your+qa@example.com` in your `.env.local`.

## Running a Vercel preview deploy safely

Vercel previews (PR previews, branch deploys) are already sandbox-mode
by default via `VERCEL_ENV`. No extra config needed.

To redirect preview emails to the team QA inbox instead of dropping
them on the floor:

```
# Vercel → Project → Settings → Environment Variables → Preview scope
SANDBOX_REDIRECT_EMAIL=qa@nexpura.com
```

That inbox will receive every outbound email with a `[SANDBOX]` subject
prefix and a banner noting the original intended recipient.

## Running a production-looking demo safely

For a staged demo where everything *looks* like production but you
don't want real sends:

```
# Vercel → Project → Settings → Environment Variables → Production scope
SANDBOX_MODE=true
```

This makes `isSandbox()` return true even with `VERCEL_ENV=production`
and `NODE_ENV=production`. Useful for a demo tenant on the real domain.

## Verifying sandbox mode is active

1. Trigger any email / SMS / WhatsApp send from the UI.
2. Check Vercel logs for the line:
   `{"level":"info","message":"[sandbox] suppressed outbound send", ...}`
3. If you see it, the guard is working. If you don't, either you're not
   in sandbox mode (check the three conditions above) or the caller is
   using a sender that isn't routed through `src/lib/sandbox.ts` —
   please add it to the gate.

## Extending the gate

If you add a new outbound surface (push notifications, a new third-party
integration, a webhook delivery), route it through `isSandbox()` at the
top of the sender. Pattern:

```ts
import { isSandbox, logSandboxSuppressedSend } from "@/lib/sandbox";

export async function sendMyNewChannel(to: string, body: string) {
  if (isSandbox()) {
    logSandboxSuppressedSend({ channel: "mychannel", to, preview: body });
    return { success: true, id: "sandbox-suppressed" };
  }
  // ... real send
}
```

Keep the return shape compatible with real success so existing callers
don't need to branch on sandbox mode.

## Emergencies: temporarily bypass sandbox mode locally

Set `SANDBOX_MODE=false` explicitly to **override** the auto-detected
sandbox state — but only in your own local `.env.local`, never in a
Vercel environment.

```
# .env.local
SANDBOX_MODE=false
```

Wait — this won't work by itself. `isSandbox()` treats any non-`"true"`
value as "not set", and `NODE_ENV === "development"` still wins. If you
genuinely need to send a real email from local dev (extremely rare),
set `NODE_ENV=production` AND `SANDBOX_MODE=false` AND ensure
`VERCEL_ENV` is unset. Almost always the better move is to just deploy
to a proper preview and send from there.

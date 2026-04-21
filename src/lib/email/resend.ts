import { Resend } from 'resend'
import { isSandbox, sandboxRedirectEmail, logSandboxSuppressedSend } from '@/lib/sandbox'

/**
 * Centralised Resend client.
 *
 * PR-03 (sandbox-outbound sweep): every `.emails.send()` call through this
 * client branches on `isSandbox()` first. In sandbox mode we either
 * no-op + log (default) or redirect the send to `SANDBOX_REDIRECT_EMAIL`
 * with a banner so QA can inspect the rendered template.
 *
 * This is the single choke point for all `import { resend } from
 * "@/lib/email/resend"` call-sites. Co-exists with `sendTenantEmail` /
 * `sendSystemEmail` in `@/lib/email-sender.ts`, which layer tenant-config
 * resolution on top; both ultimately short-circuit the same way when
 * `isSandbox()` is true.
 *
 * Do not instantiate `new Resend(...)` elsewhere in the codebase — the
 * ESLint rule `no-restricted-imports` enforces this outside the allow-
 * list. Raw imports of `resend` are banned outside `src/lib/email/**`,
 * `src/lib/email-sender.ts`, and this file.
 */

const realResend = new Resend(process.env.RESEND_API_KEY)

type SendArgs = Parameters<typeof realResend.emails.send>[0]
type SendReturn = ReturnType<typeof realResend.emails.send>

function sandboxedSend(args: SendArgs): SendReturn {
  const redirect = sandboxRedirectEmail()
  const subject = 'subject' in args ? (args.subject as string | undefined) : undefined
  const previewSource =
    'html' in args && typeof args.html === 'string'
      ? (args.html as string)
      : 'text' in args && typeof args.text === 'string'
        ? (args.text as string)
        : undefined

  if (!redirect) {
    logSandboxSuppressedSend({
      channel: 'email',
      to: (args as { to: string | string[] }).to,
      subject,
      preview: previewSource,
    })
    // Match Resend's success shape so callers that read `data.id` keep working.
    return Promise.resolve({
      data: { id: 'sandbox-suppressed' },
      error: null,
    }) as unknown as SendReturn
  }

  const originalTo = Array.isArray((args as { to: string | string[] }).to)
    ? ((args as { to: string[] }).to).join(', ')
    : (args as { to: string }).to
  const banner = `<div style="background:#fff3cd;border:1px solid #ffe69c;padding:12px;margin-bottom:16px;color:#664d03;font-family:sans-serif;"><strong>[SANDBOX]</strong> Originally intended for: ${originalTo}. This copy was redirected to ${redirect} by SANDBOX_REDIRECT_EMAIL.</div>`
  const html = 'html' in args && typeof args.html === 'string'
    ? banner + (args.html as string)
    : banner

  return realResend.emails.send({
    ...args,
    to: redirect,
    subject: `[SANDBOX] ${subject ?? ''}`.trim(),
    html,
  } as SendArgs)
}

// Proxy the real client, intercepting only `.emails.send`.
export const resend = {
  ...realResend,
  emails: {
    ...realResend.emails,
    send: (args: SendArgs): SendReturn => {
      if (isSandbox()) return sandboxedSend(args)
      return realResend.emails.send(args)
    },
  },
} as unknown as typeof realResend

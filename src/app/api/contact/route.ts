import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resend } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";
import { withSentryFlush } from "@/lib/sentry-flush";

/**
 * Public contact-form endpoint. Wired to /contact's design-only form
 * (Kaitlyn brief #2 commit cd2276c added the name/id attributes; this
 * route is the backend Joey asked for in the post-design follow-up
 * pass).
 *
 * Submissions land in hello@nexpura.com via Resend with reply-to set
 * to the submitter so the team can reply directly.
 *
 * Joey 2026-05-04: when topic='demo', ALSO insert a row into
 * demo_requests so /admin/demo-requests can manage the lifecycle.
 * Email send still fires either way — DB insert failure is logged but
 * does not break the prospect-facing flow.
 *
 * Rate-limited per source IP via the existing checkRateLimit helper
 * to prevent the form from being weaponised as a spam relay.
 */

const contactSchema = z.object({
  first_name: z.string().min(1).max(80).trim(),
  last_name: z.string().max(80).optional().or(z.literal("")),
  business_name: z.string().max(120).optional().or(z.literal("")),
  email: z.string().email().max(160),
  topic: z.enum(["demo", "trial", "migration", "pricing", "other"]),
  message: z.string().min(5).max(4000).trim(),
  // Joey 2026-05-04: demo-flow extras Kaitlyn's /contact?intent=demo
  // form already collects (and pricing-page → /contact passes plan).
  // All optional; only inserted into demo_requests when topic='demo'.
  //
  // Caps re-tuned 2026-05-04 (post-PR-#127 reproduction): the original
  // num_stores cap of 20 chars rejected realistic answers like "We
  // have 3 stores in NSW" (24 chars) — the form's placeholder shows
  // "1" but the input is a free-text TEXT field, not a number, so
  // visitors type phrases. current_pos / preferred_time same risk for
  // verbose answers ("Lightspeed Retail (X-Series) considering
  // Shopify", "We're available weekdays between 10am-4pm Sydney
  // time"). Bumped these to 500 — generous enough to never reject a
  // good-faith answer, still bounded against abuse, and the
  // demo_requests TEXT columns have no DB-level length cap so storage
  // isn't a concern.
  intent: z.string().max(20).optional(),
  current_pos: z.string().max(500).optional(),
  num_stores: z.string().max(500).optional(),
  pain_point: z.string().max(2000).optional(),
  preferred_time: z.string().max(500).optional(),
  country: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  plan: z.string().max(40).optional(),
});

const TOPIC_LABELS: Record<z.infer<typeof contactSchema>["topic"], string> = {
  demo: "Book a product demo",
  trial: "Help with my free trial",
  migration: "Migration from another system",
  pricing: "Pricing and plans",
  other: "Something else",
};

const RECIPIENT = process.env.NEXPURA_CONTACT_INBOX || "hello@nexpura.com";
// Source the from-address from the same env var the rest of the
// transactional-email stack reads (`RESEND_FROM_EMAIL`) so we send
// from the address that's actually been verified in Resend. Falling
// back to `notifications@nexpura.com` would 500 the route on Resend's
// "from address not verified" rejection.
const FROM_ADDR = process.env.RESEND_FROM_EMAIL || "support@nexpura.com";
const FROM = `Nexpura Contact Form <${FROM_ADDR}>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const POST = withSentryFlush(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";

  const { success: rateOk } = await checkRateLimit(`contact:${ip}`, "api");
  if (!rateOk) {
    return NextResponse.json(
      { error: "Too many submissions. Try again in a minute." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    // Joey 2026-05-04 (post-PR-#127 follow-up): the prior generic
    // "Please check your details and try again" left the visitor
    // (and us) with no signal about which field failed. Log every
    // issue server-side, and return the first failing-field name so
    // the client can surface "Please check the email field" instead
    // of the catch-all.
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    logger.error("[contact] zod validation failed", {
      issues,
      bodyKeys: body && typeof body === "object" ? Object.keys(body as object) : null,
    });
    const firstField = issues[0]?.path || "form";
    return NextResponse.json(
      {
        error: `Please check the ${firstField.replace(/_/g, " ")} field and try again.`,
        field: firstField,
      },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  const subject = `[Contact] ${TOPIC_LABELS[data.topic]} — ${fullName || data.email}`;
  const html = `
    <p><strong>From:</strong> ${escapeHtml(fullName)} &lt;${escapeHtml(data.email)}&gt;</p>
    ${data.business_name ? `<p><strong>Business:</strong> ${escapeHtml(data.business_name)}</p>` : ""}
    <p><strong>Topic:</strong> ${escapeHtml(TOPIC_LABELS[data.topic])}</p>
    <hr style="border:none;border-top:1px solid #E8E1D6;margin:16px 0" />
    <pre style="font-family:inherit;white-space:pre-wrap;word-break:break-word;font-size:15px;line-height:1.55;color:#1A1A1A;margin:0">${escapeHtml(data.message)}</pre>
  `;

  try {
    const r = await resend.emails.send({
      from: FROM,
      to: RECIPIENT,
      replyTo: data.email,
      subject,
      html,
    });
    if (r.error) {
      logger.error("[contact] Resend error", { err: r.error });
      return NextResponse.json(
        { error: "Couldn't deliver your message right now. Please email hello@nexpura.com directly." },
        { status: 500 },
      );
    }

    // Joey 2026-05-04: demo-request capture. When topic='demo' (or
    // intent='demo'/'sales' from Kaitlyn's form variant), persist a
    // structured row to demo_requests so /admin/demo-requests can
    // manage the lifecycle. Failures are logged but do not break the
    // prospect-facing flow — email already went out.
    if (data.topic === "demo" || data.intent === "demo" || data.intent === "sales") {
      try {
        const admin = createAdminClient();
        const userAgent = req.headers.get("user-agent") || null;
        const { error: drErr } = await admin.from("demo_requests").insert({
          first_name: data.first_name,
          last_name: data.last_name || null,
          email: data.email,
          business_name: data.business_name || null,
          phone: data.phone || null,
          country: data.country || "AU",
          message: data.message,
          current_pos: data.current_pos || null,
          num_stores: data.num_stores || null,
          pain_point: data.pain_point || null,
          preferred_time: data.preferred_time || null,
          plan: data.plan || null,
          status: "new",
          ip_address: ip === "anon" ? null : ip,
          user_agent: userAgent,
        });
        if (drErr) {
          logger.error("[contact] demo_requests insert failed", { err: drErr, email: data.email });
        }
      } catch (drErr) {
        logger.error("[contact] demo_requests insert threw", { err: drErr, email: data.email });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[contact] send threw", { err });
    return NextResponse.json(
      { error: "Couldn't deliver your message right now. Please email hello@nexpura.com directly." },
      { status: 500 },
    );
  }
});

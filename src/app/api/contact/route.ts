import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resend } from "@/lib/email/resend";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

/**
 * Public contact-form endpoint. Wired to /contact's design-only form
 * (Kaitlyn brief #2 commit cd2276c added the name/id attributes; this
 * route is the backend Joey asked for in the post-design follow-up
 * pass).
 *
 * Submissions land in hello@nexpura.com via Resend with reply-to set
 * to the submitter so the team can reply directly. No DB persistence
 * — keeps the table count + GDPR surface area down. If we later want
 * a CRM record, an audit row in customers / a `contact_submissions`
 * table can be added without a schema migration affecting this
 * endpoint's contract.
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
});

const TOPIC_LABELS: Record<z.infer<typeof contactSchema>["topic"], string> = {
  demo: "Book a product demo",
  trial: "Help with my free trial",
  migration: "Migration from another system",
  pricing: "Pricing and plans",
  other: "Something else",
};

const RECIPIENT = process.env.NEXPURA_CONTACT_INBOX || "hello@nexpura.com";
const FROM = "Nexpura Contact Form <notifications@nexpura.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
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
    return NextResponse.json(
      { error: "Please check your details and try again." },
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[contact] send threw", { err });
    return NextResponse.json(
      { error: "Couldn't deliver your message right now. Please email hello@nexpura.com directly." },
      { status: 500 },
    );
  }
}

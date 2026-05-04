import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { resend } from "@/lib/email/resend";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText, escapeHtml } from "@/lib/sanitize";
import { withSentryFlush } from "@/lib/sentry-flush";

export const maxDuration = 60;

// ─── Email export helper ──────────────────────────────────────────────────────

async function handleEmailExport(
  intent: string,
  tenantId: string,
  userEmail: string,
  businessName: string
): Promise<string | null> {
  const adminClient = createAdminClient();

  // Detect invoice export intent
  const invoiceMatch = intent.match(/invoice[s]?.*?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i);
  const repairMatch = intent.match(/repair[s]?.*?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i);
  const quoteMatch = intent.match(/quote[s]?.*?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i);

  const monthNames: Record<string, string> = {
    jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
    apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
    aug: "08", august: "08", sep: "09", september: "09", oct: "10", october: "10",
    nov: "11", november: "11", dec: "12", december: "12",
  };

  const getDateRange = (match: RegExpMatchArray | null) => {
    if (!match) return null;
    const monthStr = match[1].toLowerCase().slice(0, 3);
    const month = monthNames[monthStr] || monthNames[match[1].toLowerCase()];
    const year = match[2] || new Date().getFullYear().toString();
    if (!month) return null;
    const from = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const to = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
    return { from, to, label: `${match[1]} ${year}` };
  };

  if (invoiceMatch) {
    const range = getDateRange(invoiceMatch);
    if (!range) return null;

    const { data: invoices } = await adminClient
      .from("invoices")
      .select("invoice_number, invoice_date, total, status, customers(name)")
      .eq("tenant_id", tenantId)
      .gte("invoice_date", range.from)
      .lte("invoice_date", range.to)
      .is("deleted_at", null)
      .order("invoice_date", { ascending: true });

    if (!invoices || invoices.length === 0) {
      return `No invoices found for ${range.label}.`;
    }

    const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const rows = invoices.map((inv) => {
      // L-ai-chat-email-html: every DB-sourced string goes through
      // escapeHtml before interpolation — invoice_number, customer
      // name, and status all originate from user input.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerName = (inv.customers as any)?.name || "Unknown";
      return `<tr>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(inv.invoice_number || "—"))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(inv.invoice_date ?? ""))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(customerName))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-transform:capitalize">${escapeHtml(String(inv.status ?? ""))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">$${(inv.total || 0).toFixed(2)}</td>
      </tr>`;
    }).join("");

    const html = `
      <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
        <h2 style="color:#1f2937">${businessName} — Invoices for ${range.label}</h2>
        <p style="color:#6b7280">${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} · Total: <strong>$${totalAmount.toFixed(2)}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Invoice #</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Date</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Customer</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Status</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#f9fafb;font-weight:600">
              <td colspan="4" style="padding:8px;border:1px solid #e5e7eb">Total</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">$${totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent by Nexpura AI Copilot</p>
      </div>`;

    await resend.emails.send({
      from: "Nexpura <noreply@nexpura.com>",
      to: userEmail,
      subject: `${businessName} — Invoices for ${range.label}`,
      html,
    });

    return `✅ Done! I've emailed a summary of **${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}** for ${range.label} to **${userEmail}**. Total value: **$${totalAmount.toFixed(2)}**.`;
  }

  if (repairMatch) {
    const range = getDateRange(repairMatch);
    if (!range) return null;

    const { data: repairs } = await adminClient
      .from("repairs")
      .select("id, created_at, stage, description, price, customers(name)")
      .eq("tenant_id", tenantId)
      .gte("created_at", range.from)
      .lte("created_at", range.to + "T23:59:59")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (!repairs || repairs.length === 0) {
      return `No repairs found for ${range.label}.`;
    }

    const rows = repairs.map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerName = (r.customers as any)?.name || "Unknown";
      const desc = r.description?.slice(0, 60) || "—";
      return `<tr>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(r.created_at?.slice(0, 10) ?? ""))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(customerName))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(desc))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-transform:capitalize">${escapeHtml(String(r.stage ?? ""))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">$${(r.price || 0).toFixed(2)}</td>
      </tr>`;
    }).join("");

    const html = `
      <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
        <h2 style="color:#1f2937">${businessName} — Repairs for ${range.label}</h2>
        <p style="color:#6b7280">${repairs.length} repair${repairs.length !== 1 ? "s" : ""}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Date</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Customer</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Description</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Stage</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent by Nexpura AI Copilot</p>
      </div>`;

    await resend.emails.send({
      from: "Nexpura <noreply@nexpura.com>",
      to: userEmail,
      subject: `${businessName} — Repairs for ${range.label}`,
      html,
    });

    return `✅ Done! I've emailed a summary of **${repairs.length} repair${repairs.length !== 1 ? "s" : ""}** for ${range.label} to **${userEmail}**.`;
  }

  if (quoteMatch) {
    const range = getDateRange(quoteMatch);
    if (!range) return null;

    const { data: quotes } = await adminClient
      .from("quotes")
      .select("quote_number, created_at, status, total, customers(name)")
      .eq("tenant_id", tenantId)
      .gte("created_at", range.from)
      .lte("created_at", range.to + "T23:59:59")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (!quotes || quotes.length === 0) {
      return `No quotes found for ${range.label}.`;
    }

    const rows = quotes.map((q) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerName = (q.customers as any)?.name || "Unknown";
      return `<tr>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(q.quote_number || "—"))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(q.created_at?.slice(0, 10) ?? ""))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(String(customerName))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-transform:capitalize">${escapeHtml(String(q.status ?? ""))}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">$${(q.total || 0).toFixed(2)}</td>
      </tr>`;
    }).join("");

    const html = `
      <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
        <h2 style="color:#1f2937">${businessName} — Quotes for ${range.label}</h2>
        <p style="color:#6b7280">${quotes.length} quote${quotes.length !== 1 ? "s" : ""}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Quote #</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Date</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Customer</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Status</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent by Nexpura AI Copilot</p>
      </div>`;

    await resend.emails.send({
      from: "Nexpura <noreply@nexpura.com>",
      to: userEmail,
      subject: `${businessName} — Quotes for ${range.label}`,
      html,
    });

    return `✅ Done! I've emailed a summary of **${quotes.length} quote${quotes.length !== 1 ? "s" : ""}** for ${range.label} to **${userEmail}**.`;
  }

  return null;
}

// ─── Main route ───────────────────────────────────────────────────────────────

export const POST = withSentryFlush(async (req: Request) => {
  const _ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success: _rlSuccess } = await checkRateLimit(_ip, 'ai');
  if (!_rlSuccess) {
    return new Response("Too many requests", { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user + tenant + subscription + email
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id, email, tenants(id, name, subscriptions(plan, status))")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return Response.json({ error: "No tenant found" }, { status: 403 });
    }

    const tenantId = userData.tenant_id;
    const userEmail = userData.email || user.email || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = userData.tenants as any as {
      id: string;
      name: string;
      subscriptions?: { plan: string; status: string }[] | { plan: string; status: string } | null;
    } | null;

    // Get plan
    let plan = "boutique";
    if (tenant?.subscriptions) {
      const subs = Array.isArray(tenant.subscriptions) ? tenant.subscriptions[0] : tenant.subscriptions;
      if (subs?.plan) plan = subs.plan;
    }

    // AI Copilot is included in all plans — boutique, studio, atelier
    const aiPlans = ["boutique", "studio", "atelier", "group", "pro", "ultimate", "basic"];
    if (!aiPlans.includes(plan)) {
      return Response.json({ error: "AI Copilot requires Studio or Group plan" }, { status: 403 });
    }

    const body = await req.json();
    const { message: rawMessage, conversationId } = body as { message: string; conversationId?: string };

    if (!rawMessage?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Sanitize user input
    const message = sanitizeText(rawMessage.trim());

    const adminClient = createAdminClient();
    const businessName = tenant?.name ?? "your business";

    // CRIT-5: If the caller supplied a conversationId, verify the conversation
    // actually belongs to the caller's tenant BEFORE any downstream query uses
    // it. Prior behaviour looked up ai_messages by conversation_id alone —
    // Tenant A could pass Tenant B's convoId and the AI would quote back
    // Tenant B's history. We reject unknown / cross-tenant ids with 404 so
    // the surface doesn't leak existence.
    if (conversationId) {
      const { data: convoRow } = await adminClient
        .from("ai_conversations")
        .select("id, tenant_id")
        .eq("id", conversationId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!convoRow) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }
    }

    // ── Check for email export intent first ──────────────────────────────────
    const emailKeywords = /\b(email|send|export)\b/i;
    const docKeywords = /\b(invoice|repair|quote|document|report)\b/i;
    const dateKeywords = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i;

    if (emailKeywords.test(message) && docKeywords.test(message) && dateKeywords.test(message) && userEmail) {
      const exportResult = await handleEmailExport(message, tenantId, userEmail, businessName);
      if (exportResult) {
        // Save this exchange
        let convoId = conversationId;
        if (!convoId) {
          const { data: newConvo } = await adminClient
            .from("ai_conversations")
            .insert({ tenant_id: tenantId, user_id: user.id, title: message.slice(0, 80) })
            .select("id").single();
          convoId = newConvo?.id;
        }
        if (convoId) {
          await adminClient.from("ai_messages").insert([
            { conversation_id: convoId, tenant_id: tenantId, role: "user", content: message },
            { conversation_id: convoId, tenant_id: tenantId, role: "assistant", content: exportResult },
          ]);
        }
        return Response.json({ text: exportResult, conversationId: convoId });
      }
    }

    // ── Fetch full business context ──────────────────────────────────────────
    const [
      { count: customerCount },
      { count: activeJobsCount },
      { count: activeRepairsCount },
      { count: inventoryCount },
      { count: passportCount },
      { count: quoteCount },
    ] = await Promise.all([
      adminClient.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null),
      adminClient.from("bespoke_jobs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null).not("stage", "in", '("completed","cancelled")'),
      adminClient.from("repairs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null).not("stage", "in", '("collected","cancelled")'),
      adminClient.from("inventory").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active").is("deleted_at", null),
      adminClient.from("passports").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null),
      adminClient.from("quotes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null),
    ]);

    // Outstanding invoices
    const { data: outstandingData } = await adminClient
      .from("invoices").select("amount_due, total, status, invoice_date, invoice_number, customers(name)")
      .eq("tenant_id", tenantId).in("status", ["sent", "partially_paid", "overdue"]).is("deleted_at", null);

    const outstandingCount = outstandingData?.length ?? 0;
    const outstandingAmount = (outstandingData ?? []).reduce((s, i) => s + (i.amount_due || 0), 0);

    // Recent invoices (last 10)
    const { data: recentInvoices } = await adminClient
      .from("invoices").select("invoice_number, invoice_date, total, status, customers(name)")
      .eq("tenant_id", tenantId).is("deleted_at", null)
      .order("invoice_date", { ascending: false }).limit(10);

    // Active repairs
    const { data: activeRepairs } = await adminClient
      .from("repairs").select("description, stage, price, due_date, customers(name)")
      .eq("tenant_id", tenantId).is("deleted_at", null)
      .not("stage", "in", '("collected","cancelled")').limit(10);

    // Low stock
    const { data: lowStockItems } = await adminClient
      .from("inventory").select("name, quantity, low_stock_threshold, track_quantity")
      .eq("tenant_id", tenantId).eq("status", "active").is("deleted_at", null).eq("track_quantity", true);

    const lowStock = (lowStockItems ?? []).filter((i) => i.quantity <= (i.low_stock_threshold ?? 1));

    // Recent expenses (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: recentExpenses } = await adminClient
      .from("expenses").select("amount, category, description, expense_date")
      .eq("tenant_id", tenantId).is("deleted_at", null)
      .gte("expense_date", thirtyDaysAgo).order("expense_date", { ascending: false }).limit(10);

    const totalExpenses30d = (recentExpenses ?? []).reduce((s, e) => s + (e.amount || 0), 0);

    const systemPrompt = `You are an AI Business Copilot for ${businessName}, a jewellery business using Nexpura.
You have full access to their live business data and help them run their business smarter.
The jeweller's email is: ${userEmail}

## Live Business Snapshot
- Customers: ${customerCount ?? 0}
- Active bespoke jobs: ${activeJobsCount ?? 0}
- Active repairs: ${activeRepairsCount ?? 0}
- Quotes created: ${quoteCount ?? 0}
- Inventory items: ${inventoryCount ?? 0}
- Low stock alerts: ${lowStock.length}${lowStock.length > 0 ? " — " + lowStock.map((i) => `${i.name} (${i.quantity} left)`).join(", ") : ""}
- Digital passports: ${passportCount ?? 0}
- Outstanding invoices: ${outstandingCount} totalling $${outstandingAmount.toFixed(2)}
- Expenses last 30 days: $${totalExpenses30d.toFixed(2)}

## Recent Invoices (last 10)
${(recentInvoices ?? []).map((inv) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cname = (inv.customers as any)?.name || "Unknown";
  return `- ${inv.invoice_number || "INV"} · ${inv.invoice_date} · ${cname} · $${(inv.total || 0).toFixed(2)} · ${inv.status}`;
}).join("\n") || "No recent invoices"}

## Active Repairs (up to 10)
${(activeRepairs ?? []).map((r) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cname = (r.customers as any)?.name || "Unknown";
  return `- ${cname}: ${r.description?.slice(0, 50) || "—"} · Stage: ${r.stage} · $${(r.price || 0).toFixed(2)}${r.due_date ? ` · Due: ${r.due_date}` : ""}`;
}).join("\n") || "No active repairs"}

## Outstanding Invoices
${(outstandingData ?? []).slice(0, 10).map((inv) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cname = (inv.customers as any)?.name || "Unknown";
  return `- ${inv.invoice_number || "INV"} · ${cname} · $${(inv.amount_due || 0).toFixed(2)} · ${inv.status}`;
}).join("\n") || "No outstanding invoices"}

## Recent Expenses (last 30 days)
${(recentExpenses ?? []).map((e) => `- ${e.expense_date} · ${e.category || "General"} · ${e.description?.slice(0, 40) || "—"} · $${(e.amount || 0).toFixed(2)}`).join("\n") || "No recent expenses"}

## Your Capabilities
- Answer any questions about their business data above
- Provide insights, trends, and recommendations
- Help with pricing, customer communications, workflow
- **Email exports**: If asked to email invoices/repairs/quotes for a specific month, tell them to use the format "email me all [invoices/repairs/quotes] of [month] [year]" and the system will handle it automatically
- Jewellery industry knowledge and best practices

Be concise, direct, and practical. You know jewellery.`;

    // Get or create conversation
    let convoId = conversationId;
    if (!convoId) {
      const { data: newConvo, error: convoError } = await adminClient
        .from("ai_conversations")
        .insert({ tenant_id: tenantId, user_id: user.id, title: message.slice(0, 80) })
        .select("id").single();

      if (convoError || !newConvo) {
        return Response.json({ error: "Failed to create conversation" }, { status: 500 });
      }
      convoId = newConvo.id;
    }

    // Save user message
    await adminClient.from("ai_messages").insert({
      conversation_id: convoId, tenant_id: tenantId, role: "user", content: message,
    });

    // Fetch history
    // CRIT-5: always scope by tenant_id — even though convoId was verified
    // above, defense-in-depth guarantees a race or future edit can't leak
    // another tenant's messages.
    const { data: history } = await adminClient
      .from("ai_messages").select("role, content")
      .eq("conversation_id", convoId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }).limit(20);

    const messages = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Stream with gpt-4o
    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages,
      onFinish: async ({ text, usage }) => {
        await adminClient.from("ai_messages").insert({
          conversation_id: convoId,
          tenant_id: tenantId,
          role: "assistant",
          content: text,
          tokens_used: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
        });
        await adminClient.from("ai_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convoId!)
          .eq("tenant_id", tenantId);
      },
    });

    const response = result.toTextStreamResponse();
    const headers = new Headers(response.headers);
    headers.set("X-Conversation-Id", convoId!);
    headers.set("Access-Control-Expose-Headers", "X-Conversation-Id");

    return new Response(response.body, { status: response.status, headers });

  } catch (err) {
    logger.error("AI chat error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});

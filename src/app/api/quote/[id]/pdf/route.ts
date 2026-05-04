import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { QuotePDF, type QuotePDFProps } from "@/lib/pdf/QuotePDF";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

export const GET = withSentryFlush(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "pdf");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // W7-CRIT-03: the previous handler accepted `?token=<anything>` as a
  // full bypass of the auth check. The "token" was never verified and
  // the previewed `?preview=1` parallel existed only in older versions.
  // The only internal consumer (/quotes/[id] client) is logged-in,
  // so we now require a real Supabase session — no unsigned backdoor.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const admin = createAdminClient();

    // Derive session tenant and enforce ownership — the previous handler
    // leaked any tenant's quote PDF to any authenticated user.
    const { data: userRow } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!userRow?.tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch quote scoped to caller's tenant
    const { data: quote, error: quoteError } = await admin
      .from("quotes")
      .select("*, customers(*)")
      .eq("id", id)
      .eq("tenant_id", userRow.tenant_id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // W2-005 note: quotes is tenant-global (no location_id column);
    // tenant check above is the scope.

    // Fetch tenant
    const { data: tenant } = await admin
      .from("tenants")
      .select("*")
      .eq("id", quote.tenant_id)
      .single();

    const pdfProps: QuotePDFProps = {
      quote: {
        id: quote.id,
        quote_number: quote.quote_number ?? '',
        status: quote.status ?? 'draft',
        created_at: quote.created_at,
        expires_at: quote.expires_at,
        total_amount: quote.total_amount ?? 0,
        notes: quote.notes,
        customers: quote.customers,
        items: quote.items ?? [],
      },
      tenant: tenant,
    };

    // Render PDF - type assertion needed for react-pdf compatibility
    const element = React.createElement(QuotePDF, pdfProps);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await renderToStream(element as any);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="quote-${quote.quote_number || id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    logger.error("Quote PDF error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
});

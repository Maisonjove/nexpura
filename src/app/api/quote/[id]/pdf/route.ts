import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { QuotePDF, type QuotePDFProps } from "@/lib/pdf/QuotePDF";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "pdf");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Auth check — also allow token-based access via ?token= query param for email links
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { id } = await params;
    const admin = createAdminClient();

    // Fetch quote
    const { data: quote, error: quoteError } = await admin
      .from("quotes")
      .select("*, customers(*)")
      .eq("id", id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

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
}

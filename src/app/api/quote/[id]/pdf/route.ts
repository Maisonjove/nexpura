import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { QuotePDF, type QuotePDFProps } from "@/lib/pdf/QuotePDF";
import logger from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      quote: quote as any,
      tenant: tenant as any,
    };

    // Render PDF
    const stream = await renderToStream(
      React.createElement(QuotePDF, pdfProps as any) as any
    );

    return new NextResponse(stream as any, {
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

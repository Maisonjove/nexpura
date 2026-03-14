import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { QuotePDF, type QuotePDFProps } from "@/lib/pdf/QuotePDF";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    console.error("Quote PDF error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}

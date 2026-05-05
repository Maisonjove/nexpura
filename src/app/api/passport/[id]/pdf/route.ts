import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import PassportCertificatePDF from "@/lib/pdf/PassportCertificatePDF";
import React, { type JSXElementConstructor, type ReactElement } from "react";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = _request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "pdf");
  if (!success) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return new NextResponse("Forbidden", { status: 403 });

  const { data: passport, error } = await supabase
    .from("passports")
    .select("*, customers(full_name)")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (error || !passport) return new NextResponse("Not found", { status: 404 });

  // W2-005 note: passports is a tenant-global resource (no location_id
  // column). Tenant check is sufficient — no location scope to apply.

  // L-passport-pdf-tenant-fields: widen tenant select to match the
  // shape RepairTicketPDF uses, so the passport certificate renders
  // the full trading identity (business name + ABN + address) rather
  // than just the loose `name` field. Falls back to `name` if
  // `business_name` is null.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("business_name, name, abn, address_line1, suburb, state, postcode, phone, email")
    .eq("id", userData.tenant_id)
    .single();

  const customer = Array.isArray(passport.customers) ? passport.customers[0] : passport.customers;

  // M-10: prefer public_uid for QR data + filename — that's what the
  // /verify/[uid] public route accepts as the unenumerable id. Falls
  // back to legacy passport_uid for passports issued before the
  // backfill ran, then to internal uuid as last resort.
  const passportData = {
    passportNumber: passport.public_uid ?? passport.passport_uid ?? passport.id,
    itemName: passport.title,
    description: passport.description,
    tenantName: tenant?.business_name ?? tenant?.name ?? "Jewellery Studio",
    tenantAbn: tenant?.abn ?? undefined,
    tenantAddressLine1: tenant?.address_line1 ?? undefined,
    tenantSuburb: tenant?.suburb ?? undefined,
    tenantState: tenant?.state ?? undefined,
    tenantPostcode: tenant?.postcode ?? undefined,
    tenantPhone: tenant?.phone,
    tenantEmail: tenant?.email,
    customerName: customer?.full_name,
    purchaseDate: passport.purchase_date,
    purchasePrice: passport.purchase_price,
    metal: passport.metal_type,
    stone: passport.stone_type,
    carat: passport.stone_carat,
    weightGrams: passport.metal_weight_grams,
    isPublic: passport.is_public,
    createdAt: passport.created_at,
  };

  const element = React.createElement(PassportCertificatePDF, { passport: passportData });

   
  const buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps, JSXElementConstructor<DocumentProps>>);

  const filename = `passport-${passportData.passportNumber.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}

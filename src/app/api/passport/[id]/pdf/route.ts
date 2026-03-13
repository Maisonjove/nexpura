import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import PassportCertificatePDF from "@/lib/pdf/PassportCertificatePDF";
import React, { type JSXElementConstructor, type ReactElement } from "react";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, phone, email")
    .eq("id", userData.tenant_id)
    .single();

  const customer = Array.isArray(passport.customers) ? passport.customers[0] : passport.customers;

  const passportData = {
    passportNumber: passport.passport_uid ?? passport.id,
    itemName: passport.title,
    description: passport.description,
    tenantName: tenant?.name ?? "Jewellery Studio",
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

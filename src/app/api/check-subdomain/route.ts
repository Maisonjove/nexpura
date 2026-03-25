import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Edge runtime — no Node.js APIs needed, just Supabase fetch calls
export const runtime = 'edge';

// Reserved subdomains that cannot be used
const RESERVED = [
  "www", "app", "api", "admin", "demo", "staging", "test",
  "mail", "email", "smtp", "ftp", "cdn", "static", "assets",
  "help", "support", "docs", "blog", "news", "status",
  "account", "accounts", "billing", "payments", "checkout",
  "login", "logout", "signup", "register", "auth",
  "nexpura", "team", "staff", "internal", "dev", "development",
];

export async function GET(request: NextRequest) {
  const subdomain = request.nextUrl.searchParams.get("subdomain");

  if (!subdomain) {
    return NextResponse.json(
      { available: false, error: "Subdomain parameter required" },
      { status: 400 }
    );
  }

  // Normalize to lowercase
  const normalized = subdomain.toLowerCase().trim();

  // Check format: alphanumeric + hyphens, 3-63 chars, no leading/trailing hyphens
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
  if (!subdomainRegex.test(normalized) || normalized.length < 3) {
    return NextResponse.json({
      available: false,
      error: "Subdomain must be 3-63 characters, alphanumeric with hyphens (no leading/trailing hyphens)",
    });
  }

  // Check reserved list
  if (RESERVED.includes(normalized)) {
    return NextResponse.json({
      available: false,
      error: "This subdomain is reserved",
    });
  }

  // Check database for existing tenant with this subdomain
  const supabase = createAdminClient();
  
  const { data: existingBySubdomain } = await supabase
    .from("tenants")
    .select("id")
    .eq("subdomain", normalized)
    .maybeSingle();

  if (existingBySubdomain) {
    return NextResponse.json({
      available: false,
      error: "This subdomain is already taken",
    });
  }

  // Also check slug (for backward compatibility)
  const { data: existingBySlug } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", normalized)
    .maybeSingle();

  if (existingBySlug) {
    return NextResponse.json({
      available: false,
      error: "This subdomain is already taken",
    });
  }

  return NextResponse.json({
    available: true,
    subdomain: normalized,
  });
}

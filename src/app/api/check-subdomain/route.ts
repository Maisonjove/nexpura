import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkSubdomainQuerySchema } from "@/lib/schemas";

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
  // Rate limit subdomain checks to prevent enumeration
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  const { success: rateLimitOk } = await checkRateLimit(`check-subdomain:${ip}`);
  if (!rateLimitOk) {
    return NextResponse.json({ available: false, error: "Too many requests" }, { status: 429 });
  }

  const parseResult = checkSubdomainQuerySchema.safeParse({
    subdomain: request.nextUrl.searchParams.get("subdomain"),
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { available: false, error: parseResult.error.issues[0]?.message || "Invalid subdomain" },
      { status: 400 }
    );
  }

  // Normalize to lowercase
  const normalized = parseResult.data.subdomain.toLowerCase().trim();

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

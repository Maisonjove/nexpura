import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkActiveAccess } from "@/lib/support-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant");
  
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant ID required" }, { status: 400 });
  }

  // Rate limit support access attempts by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  const { success: rateLimitOk } = await checkRateLimit(`support-access:${ip}`);
  if (!rateLimitOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify user is a super admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const adminClient = createAdminClient();
  const { data: superAdmin } = await adminClient
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!superAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if they have active access to this tenant
  const { hasAccess, expiresAt } = await checkActiveAccess(user.id, tenantId);

  if (!hasAccess) {
    return NextResponse.json(
      { error: "No active access to this tenant" },
      { status: 403 }
    );
  }

  // Log the access
  await adminClient.from("activity_logs").insert({
    tenant_id: tenantId,
    user_id: user.id,
    action: "support_access_entered",
    entity_type: "support_access",
    details: {
      super_admin_email: user.email,
      expires_at: expiresAt,
    },
  });

  // Set a cookie to indicate support access mode
  const cookieStore = await cookies();
  cookieStore.set("support_access_tenant", tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });
  
  cookieStore.set("support_access_expires", expiresAt || "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  // Redirect to the tenant's dashboard
  return NextResponse.redirect(new URL("/dashboard", request.url));
}

export async function DELETE(request: NextRequest) {
  // Exit support access mode
  const cookieStore = await cookies();
  cookieStore.delete("support_access_tenant");
  cookieStore.delete("support_access_expires");

  return NextResponse.json({ success: true });
}

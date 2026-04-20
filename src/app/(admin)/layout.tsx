import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminSidebar from "./AdminSidebar";

/**
 * (admin) group layout — shared by all /admin/* pages.
 *
 * ── cacheComponents migration notes ─────────────────────────────────────
 *
 * Same one-line `await connection()` template that worked on the API
 * routes (check-subdomain, health/concurrency, warm, integrations/connect).
 *
 * Blocker under global cacheComponents:
 *   Every /admin/* page inherits this layout's prerender behaviour.
 *   Without `connection()`, the prerender pipeline enters the layout
 *   body, bails on the `supabase.auth.getUser()` cookie read, and the
 *   following super_admins fetch continues in the background — classic
 *   HANGING_PROMISE_REJECTION, one entry per admin page (/admin/qa,
 *   /admin/qa/bugs, /admin/revenue, /admin/subscriptions, ...).
 *
 * Fix:
 *   `await connection()` as the very first statement. Under CC the
 *   layout never prerenders — it runs at request time, identically to
 *   today. Under the current pre-CC model it resolves immediately
 *   (no-op).
 *
 * Why here instead of Suspense-wrapping the body:
 *   The auth guard calls `redirect()`, which must run before any admin
 *   chrome renders — otherwise a non-admin briefly sees the sidebar
 *   shell. `connection()` preserves the current control flow exactly;
 *   Suspense-wrapping would stream the shell before the redirect check.
 */

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // CC-migration marker: defer to request time. Prevents the prerender
  // pipeline from entering the cookie-backed auth guard below.
  await connection();

  // Get the logged-in user via normal (anon) client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check super_admins table via service role (bypasses RLS)
  const adminClient = createAdminClient();
  const { data: superAdmin } = await adminClient
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!superAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      <AdminSidebar userEmail={user.email ?? ""} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

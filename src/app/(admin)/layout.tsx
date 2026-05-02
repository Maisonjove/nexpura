import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowlistedAdmin } from "@/lib/admin-allowlist";
import AdminSidebar from "./AdminSidebar";

/**
 * (admin) group layout — shared by all /admin/* pages.
 *
 * ── cacheComponents migration notes ─────────────────────────────────────
 *
 * First pass (previous commit, the connection() one-liner) turned out to
 * be INSUFFICIENT under a real global CC flip. The preview build
 * (dpl_CM3qKXR12NSMZt5zLnvMJAaS7rrE @ d9a54af) failed on /admin/qa with:
 *
 *   Route "/admin/qa": Uncached data was accessed outside of <Suspense>.
 *   This delays the entire page from rendering.
 *     at PWAProvider → LiveRegion → body → html
 *
 * The stack trace ending at PWAProvider/body/html (no page-specific
 * frame) means the uncached access was at the LAYOUT level — specifically
 * the async auth guard body here, even with connection() at the top.
 * connection() defers the work to request time but CC still classifies
 * the layout itself as "dynamic at the top" which blocks the shell
 * extraction.
 *
 * Final fix: keep the outer shell (the flex container) synchronous so
 * CC can prerender it as part of the static shell, and move the async
 * auth guard + sidebar + main content into a Suspense-wrapped async
 * child. Control flow is unchanged at request time: the auth guard
 * still runs + redirects BEFORE any admin chrome streams to the
 * client, because redirect() throws synchronously during the async
 * body's render (Next handles NEXT_REDIRECT at the streaming layer).
 *
 * Under current pre-CC model:
 *   - connection() still resolves immediately.
 *   - Suspense boundary resolves immediately (body awaits chain fully
 *     before the parent render commits), so there's no visible
 *     fallback flash for authenticated admins.
 *   - redirect() semantics for non-admin / unauth users are unchanged —
 *     Next's streaming renderer holds the response until the first
 *     content flush, and redirect() thrown during that window
 *     converts to an HTTP redirect with no partial body sent.
 *
 * Under CC (flag flipped):
 *   - The outer <div> shell prerenders.
 *   - Request-time: auth guard runs in the Suspense boundary, either
 *     redirects (same behaviour) or streams the admin content.
 */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      <Suspense fallback={<AdminLayoutFallback />}>
        <AdminAuthenticatedShell>{children}</AdminAuthenticatedShell>
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Authenticated admin shell. All async work (cookies, super_admins check,
// redirects) happens here inside the Suspense boundary.
// ─────────────────────────────────────────────────────────────────────────
async function AdminAuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defer to request time. Prevents CC's prerender pipeline from entering
  // the cookie-backed auth guard below. No-op under the current pre-CC
  // model.
  await connection();

  // Get the logged-in user via the request-scoped (anon) client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Hard email allowlist — even if super_admins gains additional rows,
  // only this exact account may access /admin. See admin-allowlist.ts.
  if (!isAllowlistedAdmin(user.email)) {
    redirect("/dashboard");
  }

  // Check super_admins table via service role (bypasses RLS).
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
    <>
      <AdminSidebar userEmail={user.email ?? ""} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Fallback while the auth guard resolves. Under current pre-CC behaviour
// this is effectively invisible (Next buffers the response until the
// first content flush, so authenticated admins never see it and unauth
// users get the redirect headers directly). Under CC this paints
// briefly during streaming then gets replaced with the real shell.
// ─────────────────────────────────────────────────────────────────────────
function AdminLayoutFallback() {
  return (
    <>
      <div className="w-64 bg-white border-r border-stone-200 flex-shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6" />
      </div>
    </>
  );
}

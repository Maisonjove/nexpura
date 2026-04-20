import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import logger from "@/lib/logger";
import TagTemplateManager from "./TagTemplateManager";

export const metadata = { title: "Tag Templates — Nexpura" };

/**
 * /settings/tags — first route-by-route cacheComponents migration template.
 *
 * Structure is the pattern other routes should follow when we migrate them
 * one at a time:
 *
 *   - page.tsx default export: synchronous. Returns ONLY the static shell
 *     (title, description, Suspense fallback skeleton). No awaits here.
 *   - Dynamic body: `<TagTemplatesBody />`, an async server component
 *     wrapped in Suspense. ALL request-bound access (cookies, auth,
 *     tenant lookup) + DB reads live inside this subtree.
 *   - Request-bound helper: `resolveTenantId()` reads cookies via the
 *     request-scoped Supabase client. Never cacheable.
 *   - Cacheable helper: `loadTagTemplatesByTenant(tenantId)` takes the
 *     tenant ID as a parameter, does a pure per-tenant DB read. Ready
 *     to be marked `'use cache'` the moment cacheComponents is flipped
 *     globally — `tenantId` becomes part of the cache key automatically.
 *
 *   When `cacheComponents: true` is set globally in next.config.ts:
 *
 *     1. Delete the `export const dynamic = "force-dynamic"` line below.
 *        Cache Components makes every route dynamic by default; the
 *        export becomes a build error under the new flag.
 *
 *     2. Inside `loadTagTemplatesByTenant`, add:
 *
 *          'use cache';
 *          cacheLife('minutes');
 *          cacheTag(`tag-templates:${tenantId}`);
 *
 *        Import `cacheLife` + `cacheTag` from 'next/cache'. Then add
 *        matching `revalidateTag(...)` calls in the create/update/
 *        delete/setDefault server actions in ./actions.ts so tenants
 *        see their own writes immediately.
 *
 *   Both steps are mechanical. The code SHAPE below is the real work.
 *
 * Under the current (pre-cacheComponents) behaviour this refactor is
 * also a small live win: the static shell emits in the first streamed
 * HTML chunk before the tag-template fetch resolves, instead of the
 * whole page blocking on the top-level await it used to do.
 */

// globally. Cache Components replaces `force-dynamic` with dynamic-by-
// default, and the export is rejected at build time.

export default function StockTagsSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Shell — pure static JSX. No awaits, no cookies, no DB. Under
          the current model this paints in the first streamed byte chunk;
          under cacheComponents it prerenders to HTML at build and
          serves from Vercel Edge. */}
      <div>
        <h1 className="font-semibold text-2xl text-stone-900">Stock Tag Templates</h1>
        <p className="text-sm text-stone-500 mt-1">
          Design and manage your stock tag templates for printing price labels.
        </p>
      </div>
      <Suspense fallback={<TagTemplatesSkeleton />}>
        <TagTemplatesBody />
      </Suspense>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. All request-bound work happens here, inside Suspense.
// Under cacheComponents, Next.js treats this boundary as the dynamic
// streaming point; the shell above is prerenderable.
// ─────────────────────────────────────────────────────────────────────────
async function TagTemplatesBody() {
  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return <TagTemplatesUnauthorized />;
  }
  const templates = await loadTagTemplatesByTenant(tenantId);
  return <TagTemplateManager templates={templates} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Request-time: reads cookies via the request-scoped Supabase client,
// resolves the authenticated user's tenant ID. NEVER cacheable — this
// depends on the current request's cookies.
//
// Returns null instead of throwing so the UI can render an auth-denied
// message inside the Suspense boundary rather than crashing the whole
// page. Middleware is the primary auth enforcer; this is
// defence-in-depth.
// ─────────────────────────────────────────────────────────────────────────
async function resolveTenantId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    return (data?.tenant_id as string | null) ?? null;
  } catch (error) {
    logger.error("[settings/tags] resolveTenantId failed", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable per tenant. `tenantId` is a parameter (not read from cookies
// inside the body), so this function is pure w.r.t. its inputs — the
// ideal shape for `'use cache'` under cacheComponents. See the TODO in
// the file header for the exact two lines to add when the flag flips.
// ─────────────────────────────────────────────────────────────────────────
async function loadTagTemplatesByTenant(tenantId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`tag-templates:${tenantId}`);
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("stock_tag_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    return data ?? [];
  } catch (error) {
    logger.error("[settings/tags] loadTagTemplatesByTenant failed", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Fallbacks
// ─────────────────────────────────────────────────────────────────────────
function TagTemplatesUnauthorized() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 p-10 text-center">
      <h2 className="font-semibold text-lg text-stone-900 mb-2">Not authenticated</h2>
      <p className="text-sm text-stone-500">
        Sign in to manage your stock tag templates.
      </p>
    </div>
  );
}

function TagTemplatesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-3"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

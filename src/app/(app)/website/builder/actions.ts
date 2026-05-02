"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-context";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  return { tenantId: userData.tenant_id as string };
}

export interface SitePage {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  page_type: string;
  meta_title: string | null;
  meta_description: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteSection {
  id: string;
  page_id: string;
  tenant_id: string;
  section_type: string;
  display_order: number;
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PAGES = [
  { slug: "home", title: "Home", page_type: "home" },
  { slug: "about", title: "About", page_type: "about" },
  { slug: "contact", title: "Contact", page_type: "contact" },
  { slug: "policies", title: "Policies", page_type: "policies" },
];

export async function getOrCreateDefaultPages(): Promise<{ data: SitePage[]; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("site_pages")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    if (existing && existing.length > 0) {
      return { data: existing as SitePage[] };
    }

    // Create default pages
    const toInsert = DEFAULT_PAGES.map((p) => ({
      tenant_id: tenantId,
      slug: p.slug,
      title: p.title,
      page_type: p.page_type,
      published: p.slug === "home",
    }));

    const { data: created, error } = await admin
      .from("site_pages")
      .insert(toInsert)
      .select("*");

    if (error) return { data: [], error: error.message };
    return { data: created as SitePage[] };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Error" };
  }
}

// Validation helpers
function validatePageTitle(title: string): { valid: boolean; error?: string } {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) {
    return { valid: false, error: "Page title is required" };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: "Page title must be at least 2 characters" };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: "Page title must be 100 characters or less" };
  }
  return { valid: true };
}

function validateSlug(slug: string): { valid: boolean; error?: string } {
  const trimmed = slug?.trim() ?? "";
  if (!trimmed) {
    return { valid: false, error: "URL slug is required" };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: "URL slug must be at least 2 characters" };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: "URL slug must be 100 characters or less" };
  }
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return { valid: false, error: "URL slug can only contain lowercase letters, numbers, and hyphens" };
  }
  if (trimmed.startsWith("-") || trimmed.endsWith("-")) {
    return { valid: false, error: "URL slug cannot start or end with a hyphen" };
  }
  return { valid: true };
}

const RESERVED_SLUGS = ["api", "admin", "dashboard", "login", "logout", "signup", "settings", "account", "profile"];

export async function createSitePage(input: {
  title: string;
  slug: string;
  page_type: string;
}): Promise<{ data: SitePage | null; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Validate title
    const titleValidation = validatePageTitle(input.title);
    if (!titleValidation.valid) {
      return { data: null, error: titleValidation.error };
    }

    // Sanitize and validate slug
    const sanitizedSlug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "");
    const slugValidation = validateSlug(sanitizedSlug);
    if (!slugValidation.valid) {
      return { data: null, error: slugValidation.error };
    }

    // Check reserved slugs
    if (RESERVED_SLUGS.includes(sanitizedSlug)) {
      return { data: null, error: `"${sanitizedSlug}" is a reserved URL. Please choose a different slug.` };
    }

    // Check for duplicate slugs within tenant
    const { data: existingPage } = await admin
      .from("site_pages")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", sanitizedSlug)
      .maybeSingle();

    if (existingPage) {
      return { data: null, error: `A page with URL "/${sanitizedSlug}" already exists` };
    }

    const { data, error } = await admin
      .from("site_pages")
      .insert({
        tenant_id: tenantId,
        slug: sanitizedSlug,
        title: input.title.trim(),
        page_type: input.page_type,
        published: false,
      })
      .select("*")
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/website/builder");
    return { data: data as SitePage };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Failed to create page. Please try again." };
  }
}

export async function togglePagePublished(pageId: string, published: boolean): Promise<{ error?: string; success?: boolean }> {
  try {
    if (!pageId || typeof pageId !== "string") {
      return { error: "Invalid page ID" };
    }

    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Verify page exists and belongs to tenant
    const { data: page } = await admin
      .from("site_pages")
      .select("id, title")
      .eq("id", pageId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!page) {
      return { error: "Page not found or access denied" };
    }

    const { error } = await admin
      .from("site_pages")
      .update({ published, updated_at: new Date().toISOString() })
      .eq("id", pageId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath("/website/builder");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update page status. Please try again." };
  }
}

export async function deleteSitePage(pageId: string): Promise<{ error?: string; success?: boolean }> {
  try {
    if (!pageId || typeof pageId !== "string") {
      return { error: "Invalid page ID" };
    }

    // RBAC: destructive on customer-facing site content. Owner/manager only.
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete site pages." };
    }

    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Verify page exists and belongs to tenant
    const { data: page } = await admin
      .from("site_pages")
      .select("id, title, page_type")
      .eq("id", pageId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!page) {
      return { error: "Page not found or access denied" };
    }

    // Prevent deletion of essential pages
    const protectedTypes = ["home"];
    if (protectedTypes.includes(page.page_type)) {
      return { error: "The home page cannot be deleted" };
    }

    // Delete associated sections first
    const { error: sectionsError } = await admin
      .from("site_sections")
      .delete()
      .eq("page_id", pageId)
      .eq("tenant_id", tenantId);

    if (sectionsError) {
      return { error: "Failed to delete page sections. Please try again." };
    }

    // Delete the page
    const { error } = await admin
      .from("site_pages")
      .delete()
      .eq("id", pageId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath("/website/builder");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete page. Please try again." };
  }
}

export async function getPageWithSections(pageId: string): Promise<{
  page: SitePage | null;
  sections: SiteSection[];
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { data: page, error: pageErr } = await admin
      .from("site_pages")
      .select("*")
      .eq("id", pageId)
      .eq("tenant_id", tenantId)
      .single();

    if (pageErr || !page) return { page: null, sections: [], error: "Page not found" };

    const { data: sections } = await admin
      .from("site_sections")
      .select("*")
      .eq("page_id", pageId)
      .eq("tenant_id", tenantId)
      .order("display_order", { ascending: true });

    return { page: page as SitePage, sections: (sections ?? []) as SiteSection[] };
  } catch (e) {
    return { page: null, sections: [], error: e instanceof Error ? e.message : "Error" };
  }
}

export async function saveSections(pageId: string, sections: Omit<SiteSection, "created_at" | "updated_at">[]): Promise<{ error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    // Upsert all sections
    const toUpsert = sections.map((s) => ({
      id: s.id,
      page_id: pageId,
      tenant_id: tenantId,
      section_type: s.section_type,
      display_order: s.display_order,
      content: s.content,
      styles: s.styles,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await admin
      .from("site_sections")
      .upsert(toUpsert, { onConflict: "id" });

    if (error) return { error: error.message };

    // Update page updated_at
    await admin
      .from("site_pages")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", pageId)
      .eq("tenant_id", tenantId);

    revalidatePath(`/website/builder/${pageId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

/**
 * Phase 2 manual publish — flips `published` from draft (false) → live (true)
 * for every page on this tenant in a single click. AI never calls this; it's
 * the human merchant's "I'm happy with the draft, push it live" button.
 *
 * If `pageId` is provided, only that one page is published. Without it, every
 * draft page on the tenant goes live (the common case after an AI session).
 */
export async function publishAllPages(
  pageId?: string,
): Promise<{ error?: string; published?: number }> {
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can publish site pages." };
    }
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    let q = admin
      .from("site_pages")
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    if (pageId) q = q.eq("id", pageId);

    const { data, error } = await q.select("id");
    if (error) return { error: error.message };

    revalidatePath("/website");
    revalidatePath("/website/builder");
    return { published: (data || []).length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to publish pages." };
  }
}

/**
 * Take the tenant's site offline by flipping every page's `published` flag
 * to false. Mirror of publishAllPages. Owner/manager only.
 *
 * Pre-fix the only way to unpublish was a manual DB toggle — flagged in the
 * Phase 2 QA pass as a missing UX control. The merchant might want to pull
 * a campaign offline, redo a template, or take the site dark for any reason.
 */
export async function unpublishAllPages(
  pageId?: string,
): Promise<{ error?: string; unpublished?: number }> {
  try {
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can unpublish site pages." };
    }
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    let q = admin
      .from("site_pages")
      .update({ published: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    if (pageId) q = q.eq("id", pageId);

    const { data, error } = await q.select("id");
    if (error) return { error: error.message };

    revalidatePath("/website");
    revalidatePath("/website/builder");
    return { unpublished: (data || []).length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to unpublish pages." };
  }
}

export async function deleteSection(sectionId: string): Promise<{ error?: string }> {
  try {
    // RBAC: removing a section from a published/draft page mutates
    // public-facing content. Owner/manager only.
    const authCtx = await requireAuth();
    if (!authCtx.isManager && !authCtx.isOwner) {
      return { error: "Only owner or manager can delete site sections." };
    }

    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { error } = await admin
      .from("site_sections")
      .delete()
      .eq("id", sectionId)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

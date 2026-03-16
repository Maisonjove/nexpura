"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export async function createSitePage(input: {
  title: string;
  slug: string;
  page_type: string;
}): Promise<{ data: SitePage | null; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("site_pages")
      .insert({
        tenant_id: tenantId,
        slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        title: input.title,
        page_type: input.page_type,
        published: false,
      })
      .select("*")
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/website/builder");
    return { data: data as SitePage };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function togglePagePublished(pageId: string, published: boolean): Promise<{ error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { error } = await admin
      .from("site_pages")
      .update({ published, updated_at: new Date().toISOString() })
      .eq("id", pageId)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    revalidatePath("/website/builder");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
  }
}

export async function deleteSitePage(pageId: string): Promise<{ error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();
    const { error } = await admin
      .from("site_pages")
      .delete()
      .eq("id", pageId)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    revalidatePath("/website/builder");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error" };
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

export async function deleteSection(sectionId: string): Promise<{ error?: string }> {
  try {
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

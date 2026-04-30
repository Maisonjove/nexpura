"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getTemplateById } from "@/lib/templates/data";
import logger from "@/lib/logger";

/**
 * Resolve the authenticated user's tenant. Mirrors the helper used by
 * `(app)/website/actions.ts` — tenant_id always comes from the session,
 * never from client input.
 */
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { userId: user.id, tenantId: userData.tenant_id as string };
}

export type ApplyTemplateResult =
  | { success: true; homePageId: string; pagesCreated: number }
  | { error: string };

/**
 * Apply a Phase 1 jewellery template to the authenticated tenant.
 *
 * Strategy:
 *  - Look up the template by id from the static catalogue.
 *  - For every slug the template defines, delete any existing page with
 *    that (tenant_id, slug) — including its sections — so re-applying
 *    a template overwrites cleanly without leaving orphaned content.
 *  - Insert fresh `site_pages` rows (published=true so the public renderer
 *    picks them up) and the corresponding `site_sections` rows.
 *  - Pages outside the template's slug list are left untouched, so a tenant
 *    who hand-built a custom page won't lose it.
 *
 * Notes for Phase 2: no AI, no chat, no draft state — published rows go in
 * directly so Joey can review the rendered result on the public shop URL.
 */
export async function applyTemplate(
  templateId: string
): Promise<ApplyTemplateResult> {
  try {
    const template = getTemplateById(templateId);
    if (!template) {
      return { error: `Unknown template "${templateId}"` };
    }

    const { tenantId } = await getAuthContext();
    const admin = createAdminClient();

    const slugs = template.pages.map((p) => p.slug);

    // Step 1: find all existing pages we'll replace
    const { data: existing, error: fetchErr } = await admin
      .from("site_pages")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("slug", slugs);

    if (fetchErr) {
      logger.error("[applyTemplate] fetch existing failed", fetchErr);
      return { error: "Could not read existing pages." };
    }

    const existingIds = (existing || []).map((r) => r.id as string);

    // Step 2: nuke their sections + pages so we can re-seed cleanly
    if (existingIds.length > 0) {
      const { error: secDelErr } = await admin
        .from("site_sections")
        .delete()
        .in("page_id", existingIds)
        .eq("tenant_id", tenantId);

      if (secDelErr) {
        logger.error("[applyTemplate] section delete failed", secDelErr);
        return { error: "Could not clear existing sections." };
      }

      const { error: pageDelErr } = await admin
        .from("site_pages")
        .delete()
        .in("id", existingIds)
        .eq("tenant_id", tenantId);

      if (pageDelErr) {
        logger.error("[applyTemplate] page delete failed", pageDelErr);
        return { error: "Could not clear existing pages." };
      }
    }

    // Step 3: insert fresh pages
    const pageRows = template.pages.map((p) => ({
      tenant_id: tenantId,
      slug: p.slug,
      title: p.title,
      page_type: p.type,
      meta_title: p.metaTitle,
      meta_description: p.metaDescription,
      published: true,
    }));

    const { data: insertedPages, error: pageErr } = await admin
      .from("site_pages")
      .insert(pageRows)
      .select("id, slug, page_type");

    if (pageErr || !insertedPages) {
      logger.error("[applyTemplate] page insert failed", pageErr);
      return { error: pageErr?.message || "Could not create pages." };
    }

    // Step 4: insert sections for each page
    const sectionRows: Array<{
      tenant_id: string;
      page_id: string;
      section_type: string;
      display_order: number;
      content: Record<string, unknown>;
      styles: Record<string, unknown>;
    }> = [];

    for (const page of insertedPages) {
      const tplPage = template.pages.find((p) => p.slug === page.slug);
      if (!tplPage) continue;

      tplPage.sections.forEach((section, idx) => {
        sectionRows.push({
          tenant_id: tenantId,
          page_id: page.id as string,
          section_type: section.type,
          display_order: idx,
          content: section.content,
          styles: section.styles || {},
        });
      });
    }

    if (sectionRows.length > 0) {
      const { error: secErr } = await admin
        .from("site_sections")
        .insert(sectionRows);
      if (secErr) {
        logger.error("[applyTemplate] section insert failed", secErr);
        return { error: secErr.message };
      }
    }

    const homePage = insertedPages.find((p) => p.page_type === "home");
    const homePageId = (homePage?.id as string) || (insertedPages[0]?.id as string);

    revalidatePath("/website");
    revalidatePath("/website/builder");
    revalidatePath("/website/templates");

    return {
      success: true,
      homePageId,
      pagesCreated: insertedPages.length,
    };
  } catch (err) {
    logger.error("[applyTemplate] unexpected", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not apply template. Please try again.",
    };
  }
}

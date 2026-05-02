/**
 * Phase 2 — Website AI Assistant
 *
 * Single chat endpoint that drives the new "your site" panel. The model is
 * asked to return a structured JSON envelope of high-level actions and we
 * execute each one server-side against site_pages / site_sections, with
 * tenant scoping enforced from the authenticated session — never from the
 * payload.
 *
 * Hard rules implemented here:
 *   - Tenant id ONLY comes from getAuthContext(). Any tenant_id in the
 *     payload is rejected before any DB write.
 *   - Allowlist of action types. Anything else is dropped.
 *   - "publish" is NOT an allowed action. Only humans flip published=true.
 *   - All AI-driven mutations land with published=false (drafts).
 *   - Responses are validated by Zod before any DB write.
 *   - Refusal rules for billing/auth/cross-tenant prompts are baked into
 *     the system prompt AND backed up by allowlist filtering.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

const AI_TIMEOUT_MS = 30000;

// ─────────────────────────────────────────────────────────────────────────────
// Auth — tenant id always from session, never from input.
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return null;
  return { userId: user.id, tenantId: userData.tenant_id as string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowlists (must stay in sync with Phase 1 section + page registries).
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_TYPES = [
  "hero",
  "text",
  "image_text",
  "gallery",
  "product_grid",
  "collection_grid",
  "testimonials",
  "contact_form",
  "enquiry_form",
  "repair_form",
  "appointment_form",
  "faq",
  "divider",
  "spacer",
] as const;

const PAGE_TYPES = ["home", "about", "contact", "policies", "custom"] as const;

const ALLOWED_FONTS = [
  "Inter",
  "Playfair Display",
  "Cormorant Garamond",
] as const;

// Whitelisted content keys per section_type. Anything outside this list is
// stripped before we touch the row, so the model can't sneak unexpected
// HTML/JS payloads into JSONB.
const CONTENT_KEY_WHITELIST: Record<(typeof SECTION_TYPES)[number], string[]> = {
  hero: [
    "heading",
    "subheading",
    "eyebrow",
    "cta_text",
    "cta_url",
    "background_image_url",
    "overlay_opacity",
  ],
  text: ["heading", "body", "alignment", "cta_text", "cta_url"],
  image_text: [
    "heading",
    "body",
    "image_url",
    "image_side",
    "cta_text",
    "cta_url",
  ],
  gallery: ["heading", "subheading", "columns", "placeholderItems"],
  product_grid: ["heading", "subheading", "columns", "placeholderItems"],
  collection_grid: ["heading", "subheading", "columns", "placeholderItems"],
  testimonials: ["heading", "items"],
  contact_form: ["heading", "subheading"],
  enquiry_form: ["heading", "subheading"],
  repair_form: ["heading", "subheading"],
  appointment_form: ["heading", "subheading"],
  faq: ["heading", "items"],
  divider: [],
  spacer: ["height"],
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// ─────────────────────────────────────────────────────────────────────────────
// Zod action schemas. Top-level `actions` is a discriminated union.
// ─────────────────────────────────────────────────────────────────────────────

const themeSchema = z
  .object({
    primary_color: z.string().regex(HEX).optional(),
    secondary_color: z.string().regex(HEX).optional(),
    accent_color: z.string().regex(HEX).optional(),
    heading_font: z.enum(ALLOWED_FONTS).optional(),
    body_font: z.enum(ALLOWED_FONTS).optional(),
  })
  .strict();

const sanitizedString = z.string().max(2000);
const sanitizedShort = z.string().max(200);

// content patches — keys must be whitelisted at runtime per section_type;
// values are constrained to JSON-safe primitives + small arrays.
const contentValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(4000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(contentValueSchema).max(50),
    z.record(z.string(), contentValueSchema),
  ]),
);
const contentPatchSchema = z.record(z.string(), contentValueSchema);

const updateThemeAction = z
  .object({
    type: z.literal("update_theme"),
    theme: themeSchema,
  })
  .strict();

const updateSectionCopyAction = z
  .object({
    type: z.literal("update_section_copy"),
    page_id: z.string().uuid(),
    section_id: z.string().uuid(),
    content: contentPatchSchema,
  })
  .strict();

const addSectionAction = z
  .object({
    type: z.literal("add_section"),
    page_id: z.string().uuid(),
    section_type: z.enum(SECTION_TYPES),
    content: contentPatchSchema.optional(),
    styles: contentPatchSchema.optional(),
    display_order: z.number().int().min(0).max(999).optional(),
  })
  .strict();

const removeSectionAction = z
  .object({
    type: z.literal("remove_section"),
    section_id: z.string().uuid(),
  })
  .strict();

const reorderSectionsAction = z
  .object({
    type: z.literal("reorder_sections"),
    page_id: z.string().uuid(),
    section_ids: z.array(z.string().uuid()).min(1).max(50),
  })
  .strict();

const createPageAction = z
  .object({
    type: z.literal("create_page"),
    slug: z.string().regex(SLUG).min(2).max(60),
    title: sanitizedShort,
    page_type: z.enum(PAGE_TYPES),
    meta_title: sanitizedShort.optional(),
    meta_description: z.string().max(400).optional(),
    starter_sections: z
      .array(
        z
          .object({
            section_type: z.enum(SECTION_TYPES),
            content: contentPatchSchema.optional(),
            styles: contentPatchSchema.optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
  })
  .strict();

const updateSeoAction = z
  .object({
    type: z.literal("update_seo"),
    page_id: z.string().uuid().optional(), // omit for site-wide
    meta_title: sanitizedShort.optional(),
    meta_description: z.string().max(400).optional(),
  })
  .strict()
  .refine(
    (v) => v.meta_title !== undefined || v.meta_description !== undefined,
    { message: "update_seo needs meta_title or meta_description" },
  );

const updateNavAction = z
  .object({
    type: z.literal("update_nav"),
    items: z
      .array(
        z
          .object({
            label: sanitizedShort,
            slug: z.string().regex(SLUG).max(60),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

const updateFooterAction = z
  .object({
    type: z.literal("update_footer"),
    copy: sanitizedString.optional(),
    columns: z
      .array(
        z
          .object({
            heading: sanitizedShort,
            links: z
              .array(
                z
                  .object({
                    label: sanitizedShort,
                    href: z.string().max(400),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict()
  .refine((v) => v.copy !== undefined || v.columns !== undefined, {
    message: "update_footer needs copy or columns",
  });

const actionSchema = z.discriminatedUnion("type", [
  updateThemeAction,
  updateSectionCopyAction,
  addSectionAction,
  removeSectionAction,
  reorderSectionsAction,
  createPageAction,
  updateSeoAction,
  updateNavAction,
  updateFooterAction,
]);

const envelopeSchema = z
  .object({
    summary: z.string().min(1).max(1500),
    actions: z.array(actionSchema).max(20),
  })
  .strict();

type ParsedAction = z.infer<typeof actionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively scan an unknown object for forbidden tenant_id fields. Belt
 * and braces: even though our Zod schemas .strict() reject unknown keys, we
 * also walk the parsed object so any future schema relaxation can't smuggle
 * in tenant_id without us noticing.
 */
function containsTenantId(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsTenantId);
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (
      key === "tenant_id" ||
      key === "tenantId" ||
      key === "tenant" ||
      key === "user_id" ||
      key === "userId"
    ) {
      return true;
    }
    if (containsTenantId(obj[key])) return true;
  }
  return false;
}

function sanitizeContent(
  sectionType: (typeof SECTION_TYPES)[number],
  content: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!content) return {};
  const allowed = new Set(CONTENT_KEY_WHITELIST[sectionType]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(content)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

function sanitizeStyles(
  styles: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!styles) return {};
  const allowed = new Set([
    "background_color",
    "text_color",
    "padding_y",
    "padding_x",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(styles)) {
    if (allowed.has(k) && typeof v === "string" && v.length < 200) out[k] = v;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant-scoped action handlers
// Each handler returns { applied: bool, error?: string }.
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult = { type: string; applied: boolean; error?: string };

async function applyAction(
  action: ParsedAction,
  tenantId: string,
): Promise<ActionResult> {
  const admin = createAdminClient();

  try {
    switch (action.type) {
      case "update_theme": {
        const updates: Record<string, unknown> = {};
        if (action.theme.primary_color)
          updates.primary_color = action.theme.primary_color;
        if (action.theme.secondary_color)
          updates.secondary_color = action.theme.secondary_color;
        if (action.theme.heading_font || action.theme.body_font) {
          // website_config has a single `font` column — pick the body font
          // first, falling back to heading. Heading fonts in the renderer
          // are derived per-section.
          updates.font = action.theme.body_font || action.theme.heading_font;
        }
        if (Object.keys(updates).length === 0) {
          return { type: action.type, applied: false, error: "no theme keys" };
        }
        // Upsert against existing row (Phase 1 guaranteed website_config exists
        // for any tenant who entered the builder; if not, insert minimal row).
        const { data: existing } = await admin
          .from("website_config")
          .select("id")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (existing?.id) {
          const { error } = await admin
            .from("website_config")
            .update(updates)
            .eq("tenant_id", tenantId);
          if (error) return { type: action.type, applied: false, error: error.message };
        } else {
          const { error } = await admin
            .from("website_config")
            .insert({ tenant_id: tenantId, ...updates });
          if (error) return { type: action.type, applied: false, error: error.message };
        }
        return { type: action.type, applied: true };
      }

      case "update_section_copy": {
        // Verify section + page belong to tenant before writing.
        const { data: section } = await admin
          .from("site_sections")
          .select("id, section_type, content, page_id, tenant_id")
          .eq("id", action.section_id)
          .eq("tenant_id", tenantId)
          .eq("page_id", action.page_id)
          .maybeSingle();
        if (!section) {
          return { type: action.type, applied: false, error: "section not found" };
        }
        const sectionType = section.section_type as (typeof SECTION_TYPES)[number];
        if (!SECTION_TYPES.includes(sectionType)) {
          return { type: action.type, applied: false, error: "unsupported section_type" };
        }
        const merged = {
          ...((section.content as Record<string, unknown>) || {}),
          ...sanitizeContent(sectionType, action.content),
        };
        const { error } = await admin
          .from("site_sections")
          .update({ content: merged, updated_at: new Date().toISOString() })
          .eq("id", action.section_id)
          .eq("tenant_id", tenantId);
        if (error) return { type: action.type, applied: false, error: error.message };

        // Mark the parent page as a draft so the publish button is the only
        // thing that flips it back to live.
        await admin
          .from("site_pages")
          .update({ published: false, updated_at: new Date().toISOString() })
          .eq("id", action.page_id)
          .eq("tenant_id", tenantId);
        return { type: action.type, applied: true };
      }

      case "add_section": {
        // Verify page belongs to tenant.
        const { data: page } = await admin
          .from("site_pages")
          .select("id")
          .eq("id", action.page_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (!page) return { type: action.type, applied: false, error: "page not found" };

        // Determine display_order — default to end of list.
        let order = action.display_order;
        if (order === undefined) {
          const { data: last } = await admin
            .from("site_sections")
            .select("display_order")
            .eq("page_id", action.page_id)
            .eq("tenant_id", tenantId)
            .order("display_order", { ascending: false })
            .limit(1)
            .maybeSingle();
          order = ((last?.display_order as number | undefined) ?? -1) + 1;
        }

        const { error } = await admin.from("site_sections").insert({
          tenant_id: tenantId,
          page_id: action.page_id,
          section_type: action.section_type,
          display_order: order,
          content: sanitizeContent(action.section_type, action.content),
          styles: sanitizeStyles(action.styles),
        });
        if (error) return { type: action.type, applied: false, error: error.message };

        await admin
          .from("site_pages")
          .update({ published: false, updated_at: new Date().toISOString() })
          .eq("id", action.page_id)
          .eq("tenant_id", tenantId);
        return { type: action.type, applied: true };
      }

      case "remove_section": {
        const { data: section } = await admin
          .from("site_sections")
          .select("id, page_id")
          .eq("id", action.section_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (!section) return { type: action.type, applied: false, error: "section not found" };
        const { error } = await admin
          .from("site_sections")
          .delete()
          .eq("id", action.section_id)
          .eq("tenant_id", tenantId);
        if (error) return { type: action.type, applied: false, error: error.message };

        await admin
          .from("site_pages")
          .update({ published: false, updated_at: new Date().toISOString() })
          .eq("id", section.page_id as string)
          .eq("tenant_id", tenantId);
        return { type: action.type, applied: true };
      }

      case "reorder_sections": {
        // Verify every id belongs to the page+tenant.
        const { data: rows } = await admin
          .from("site_sections")
          .select("id")
          .eq("page_id", action.page_id)
          .eq("tenant_id", tenantId);
        const validIds = new Set((rows || []).map((r) => r.id as string));
        for (const id of action.section_ids) {
          if (!validIds.has(id)) {
            return {
              type: action.type,
              applied: false,
              error: "section_ids include a row outside this page/tenant",
            };
          }
        }
        // Apply new ordering.
        for (let i = 0; i < action.section_ids.length; i++) {
          const id = action.section_ids[i];
          const { error } = await admin
            .from("site_sections")
            .update({ display_order: i, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("tenant_id", tenantId);
          if (error) return { type: action.type, applied: false, error: error.message };
        }
        await admin
          .from("site_pages")
          .update({ published: false, updated_at: new Date().toISOString() })
          .eq("id", action.page_id)
          .eq("tenant_id", tenantId);
        return { type: action.type, applied: true };
      }

      case "create_page": {
        // Reject duplicate slug on this tenant.
        const { data: existing } = await admin
          .from("site_pages")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("slug", action.slug)
          .maybeSingle();
        if (existing) {
          return { type: action.type, applied: false, error: "slug already exists" };
        }
        const { data: inserted, error } = await admin
          .from("site_pages")
          .insert({
            tenant_id: tenantId,
            slug: action.slug,
            title: action.title,
            page_type: action.page_type,
            meta_title: action.meta_title || null,
            meta_description: action.meta_description || null,
            published: false, // draft until manual publish
          })
          .select("id")
          .single();
        if (error || !inserted) {
          return { type: action.type, applied: false, error: error?.message || "insert failed" };
        }
        if (action.starter_sections && action.starter_sections.length > 0) {
          const rows = action.starter_sections.map((s, idx) => ({
            tenant_id: tenantId,
            page_id: inserted.id,
            section_type: s.section_type,
            display_order: idx,
            content: sanitizeContent(s.section_type, s.content),
            styles: sanitizeStyles(s.styles),
          }));
          const { error: secErr } = await admin.from("site_sections").insert(rows);
          if (secErr) {
            // Page exists but sections didn't insert — surface the partial state.
            return {
              type: action.type,
              applied: false,
              error: `page created, sections failed: ${secErr.message}`,
            };
          }
        }
        return { type: action.type, applied: true };
      }

      case "update_seo": {
        if (action.page_id) {
          const { data: page } = await admin
            .from("site_pages")
            .select("id")
            .eq("id", action.page_id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          if (!page) return { type: action.type, applied: false, error: "page not found" };
          const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (action.meta_title !== undefined) updates.meta_title = action.meta_title;
          if (action.meta_description !== undefined)
            updates.meta_description = action.meta_description;
          updates.published = false;
          const { error } = await admin
            .from("site_pages")
            .update(updates)
            .eq("id", action.page_id)
            .eq("tenant_id", tenantId);
          if (error) return { type: action.type, applied: false, error: error.message };
          return { type: action.type, applied: true };
        }
        // Site-wide SEO → website_config.meta_*
        const updates: Record<string, unknown> = {};
        if (action.meta_title !== undefined) updates.meta_title = action.meta_title;
        if (action.meta_description !== undefined)
          updates.meta_description = action.meta_description;
        const { error } = await admin
          .from("website_config")
          .update(updates)
          .eq("tenant_id", tenantId);
        if (error) return { type: action.type, applied: false, error: error.message };
        return { type: action.type, applied: true };
      }

      case "update_nav": {
        // The renderer derives the nav from published `site_pages` rows for
        // this tenant. There is no dedicated nav_items column on
        // website_config in the current schema (Phase 2 forbids schema
        // changes). To honour the request without a schema change, we surface
        // a soft-applied result so the user knows nav order is page-driven.
        return {
          type: action.type,
          applied: false,
          error:
            "Navigation is generated from your pages — rename or reorder pages to update the nav.",
        };
      }

      case "update_footer": {
        // No footer columns in the current schema. Same constraint as
        // update_nav — surface the limitation.
        return {
          type: action.type,
          applied: false,
          error:
            "Footer editing isn't available in Phase 2 — coming soon.",
        };
      }

      default: {
        // Should be impossible given the discriminated union.
        const _exhaust: never = action;
        return { type: "unknown", applied: false, error: `unhandled action ${String(_exhaust)}` };
      }
    }
  } catch (err) {
    logger.error("[ai-assistant] action failed", { type: action.type, err });
    return {
      type: action.type,
      applied: false,
      error: err instanceof Error ? err.message : "unexpected",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt builder
// ─────────────────────────────────────────────────────────────────────────────

type DraftSummary = {
  pages: { id: string; slug: string; title: string; sections: { id: string; type: string; heading: string }[] }[];
  theme: {
    primary_color: string | null;
    secondary_color: string | null;
    font: string | null;
    business_name: string | null;
  };
};

async function buildDraftSummary(tenantId: string): Promise<DraftSummary> {
  const admin = createAdminClient();

  const { data: pages } = await admin
    .from("site_pages")
    .select("id, slug, title")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  const pageIds = (pages || []).map((p) => p.id as string);
  const { data: sections } = pageIds.length
    ? await admin
        .from("site_sections")
        .select("id, page_id, section_type, content, display_order")
        .in("page_id", pageIds)
        .eq("tenant_id", tenantId)
        .order("display_order", { ascending: true })
    : { data: [] as Array<{ id: string; page_id: string; section_type: string; content: Record<string, unknown>; display_order: number }> };

  const sectionsByPage = new Map<string, { id: string; type: string; heading: string }[]>();
  for (const s of sections || []) {
    const heading =
      typeof (s.content as Record<string, unknown>)?.heading === "string"
        ? ((s.content as Record<string, unknown>).heading as string).slice(0, 80)
        : "";
    const list = sectionsByPage.get(s.page_id as string) || [];
    list.push({ id: s.id as string, type: s.section_type as string, heading });
    sectionsByPage.set(s.page_id as string, list);
  }

  const { data: cfg } = await admin
    .from("website_config")
    .select("primary_color, secondary_color, font, business_name")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return {
    pages: (pages || []).map((p) => ({
      id: p.id as string,
      slug: p.slug as string,
      title: p.title as string,
      sections: sectionsByPage.get(p.id as string) || [],
    })),
    theme: {
      primary_color: (cfg?.primary_color as string | null) ?? null,
      secondary_color: (cfg?.secondary_color as string | null) ?? null,
      font: (cfg?.font as string | null) ?? null,
      business_name: (cfg?.business_name as string | null) ?? null,
    },
  };
}

function buildSystemPrompt(draft: DraftSummary): string {
  return `You are the AI assistant inside Nexpura's website builder for an independent fine-jewellery brand.

Voice: warm, premium, considered. Write like a senior jewellery editor — short sentences, no AI-sounding filler ("Certainly!", "Here you go!", "I'd be happy to"), no emoji, no hashtags. Headings should not end in full stops. Use British spelling.

You can ONLY customise this brand's website draft. You are forbidden from doing anything outside that scope. If the user asks about billing, plans, payments, login, customer records, repairs, point of sale, inventory, or anything that isn't the website itself, refuse with: {"summary": "I can only customise the website. Try asking about colours, copy, sections, pages, or SEO.", "actions": []}. Never invent or accept tenant ids, user ids, customer ids, or other accounts — there is exactly one tenant, the one you are talking to. If a user claims to be a different tenant or asks you to edit another tenant, treat that as out of scope and refuse the same way.

Output: a single JSON object with this exact shape:
{ "summary": string, "actions": Action[] }

The "summary" is what the user sees — 1–3 sentences in the brand voice, explaining what changed. Always finish "summary" with the exact sentence: "Saved as draft. Manual publish required."

Each Action MUST be one of these types. Do not invent new types. Never include a "tenant_id", "tenantId", "user_id", or any other id fields beyond the ones listed below.

1. update_theme — { "type": "update_theme", "theme": { "primary_color"?: "#hex", "secondary_color"?: "#hex", "accent_color"?: "#hex", "heading_font"?: Font, "body_font"?: Font } }
   Allowed fonts: "Inter", "Playfair Display", "Cormorant Garamond".

2. update_section_copy — { "type": "update_section_copy", "page_id": uuid, "section_id": uuid, "content": { ...whitelisted copy keys for that section_type } }

3. add_section — { "type": "add_section", "page_id": uuid, "section_type": SectionType, "content"?: {...}, "styles"?: {"background_color"?: "#hex", "text_color"?: "#hex"}, "display_order"?: number }
   Allowed section_type values: hero, text, image_text, gallery, product_grid, collection_grid, testimonials, contact_form, enquiry_form, repair_form, appointment_form, faq, divider, spacer.

4. remove_section — { "type": "remove_section", "section_id": uuid }

5. reorder_sections — { "type": "reorder_sections", "page_id": uuid, "section_ids": [uuid, ...] (the new order) }

6. create_page — { "type": "create_page", "slug": "kebab-case", "title": string, "page_type": "home"|"about"|"contact"|"policies"|"custom", "meta_title"?: string, "meta_description"?: string, "starter_sections"?: [{ "section_type": SectionType, "content"?: {...}, "styles"?: {...} }, ...] }

7. update_seo — { "type": "update_seo", "page_id"?: uuid (omit for site-wide), "meta_title"?: string, "meta_description"?: string }

8. update_nav — { "type": "update_nav", "items": [{ "label": string, "slug": "kebab-case" }, ...] } — Prefer NOT to use this. The nav is generated from the user's pages; rename or create_page instead.

9. update_footer — { "type": "update_footer", "copy"?: string, "columns"?: [{ "heading": string, "links": [{ "label": string, "href": string }] }] } — Footer customisation is limited in this phase. Prefer not to use this.

There is no publish action. Drafts only — the human merchant clicks "publish" themselves.

Whitelisted content keys per section_type (anything else is dropped silently):
- hero: heading, subheading, eyebrow, cta_text, cta_url, background_image_url, overlay_opacity
- text: heading, body, alignment ("left"|"center"|"right"), cta_text, cta_url
- image_text: heading, body, image_url, image_side ("left"|"right"), cta_text, cta_url
- gallery / product_grid / collection_grid: heading, subheading, columns (2|3|4), placeholderItems[{name, caption}]
- testimonials: heading, items[{quote, author, role?}]
- faq: heading, items[{question, answer}]
- form sections (contact_form / enquiry_form / repair_form / appointment_form): heading, subheading
- divider: (no copy keys)
- spacer: height (number, px)

Current draft for this tenant:
${JSON.stringify(draft)}

When the user names something descriptively ("the testimonials section", "the homepage", "the engagement rings page"), match by slug/title/section_type from the draft above and use the real uuid.

Be action-biased. When a user asks for any change you can make ("more luxury", "improve SEO", "make it minimal", "rewrite the homepage"), make a concrete edit — don't just describe what could be done. Pick the smallest sensible change that moves the site toward the request and use the appropriate action. Examples:
- "Make it more luxury" → at minimum, update_theme (deeper / more saturated palette, Playfair or Cormorant Garamond for headings) and/or update_section_copy on the home hero with more refined copy.
- "Improve SEO" / "Improve SEO for engagement rings in Sydney" → update_seo for the most relevant page (or site-wide) with a concrete meta_title and meta_description that include the location and category. Always emit at least one update_seo action when SEO is requested.
- "Make it more minimal" → update_theme to a quieter palette + Inter typography, and update_section_copy to shorten/strip a hero or text section.
- "Rewrite homepage copy" → emit update_section_copy actions on every visible copy section of the home page (hero, text, image_text).

Only return an empty actions array when the request is genuinely outside what these actions can do, or when the request is a refusal case (billing/auth/cross-tenant). Never return an empty actions array just because you're unsure — pick a reasonable default and explain it.

Always end your summary with exactly: "Saved as draft. Manual publish required."`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth first so per-user rate limit + tenant scoping are correct.
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Please log in to use the website assistant." }, { status: 401 });
  }

  // Per-user rate limit on the AI bucket (20/min — see rate-limit BUCKETS.ai).
  const { success: rlSuccess } = await checkRateLimit(`assistant:${auth.userId}`, "ai");
  if (!rlSuccess) {
    return NextResponse.json(
      { error: "Too many AI requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = (body as { message?: unknown }).message;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  // Sanitise — cap length to keep prompt cost predictable.
  const userMessage = message.trim().slice(0, 2000);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured." }, { status: 500 });
  }

  let draft: DraftSummary;
  try {
    draft = await buildDraftSummary(auth.tenantId);
  } catch (err) {
    logger.error("[ai-assistant] draft summary failed", err);
    return NextResponse.json(
      { error: "Could not load your website draft. Please try again." },
      { status: 500 },
    );
  }

  const systemPrompt = buildSystemPrompt(draft);

  const openai = new OpenAI({ apiKey, timeout: AI_TIMEOUT_MS });
  let raw: string;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    raw = response.choices[0]?.message?.content || "";
  } catch (err) {
    logger.error("[ai-assistant] openai failed", err);
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) {
        return NextResponse.json({ error: "AI service is busy. Please try again in a moment." }, { status: 429 });
      }
      if (err.status === 503) {
        return NextResponse.json({ error: "AI service is temporarily unavailable." }, { status: 503 });
      }
    }
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 500 });
  }

  if (!raw.trim()) {
    return NextResponse.json({ error: "AI returned an empty response." }, { status: 500 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    logger.error("[ai-assistant] non-JSON response", { raw: raw.slice(0, 500) });
    return NextResponse.json({ error: "AI returned an invalid response. Please try again." }, { status: 500 });
  }

  // Reject obvious tenant injection attempts before schema parsing — gives a
  // tighter audit trail than relying on .strict() alone.
  if (containsTenantId(parsedJson)) {
    logger.warn("[ai-assistant] tenant_id in AI response — rejecting", {
      tenantId: auth.tenantId,
    });
    return NextResponse.json({
      summary: "I can only customise the website. Try asking about colours, copy, sections, pages, or SEO.",
      actions: [] as ActionResult[],
    });
  }

  const parsed = envelopeSchema.safeParse(parsedJson);
  if (!parsed.success) {
    // Validation failed — keep the AI's summary if present, drop unknown actions.
    const fallbackSummary =
      typeof (parsedJson as { summary?: unknown })?.summary === "string"
        ? ((parsedJson as { summary: string }).summary as string).slice(0, 1500)
        : "I couldn't translate that into a safe edit. Try rephrasing — for example, mention the page or section by name.";
    return NextResponse.json({ summary: fallbackSummary, actions: [] as ActionResult[] });
  }

  const envelope = parsed.data;
  const results: ActionResult[] = [];
  for (const action of envelope.actions) {
    results.push(await applyAction(action, auth.tenantId));
  }

  return NextResponse.json({ summary: envelope.summary, actions: results });
}

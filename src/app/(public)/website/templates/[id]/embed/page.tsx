import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTemplateById } from "@/lib/templates/data";
import type { Theme } from "@/lib/templates/types";
import { SectionRenderer } from "@/components/website/SectionRenderer";
import {
  TemplateFontLink,
  TemplateNav,
  TemplateFooter,
} from "@/components/website/TemplateChrome";

/**
 * R6-F14 (item 16): sandboxed embed-only template preview.
 *
 * Why this lives under (public) instead of (app):
 *   The pre-fix preview iframe in TemplateGalleryClient pointed at
 *   `/website/templates/[id]?embed=1`, which lives inside the (app)
 *   route group. Even though the page itself hid its in-page admin
 *   bar when ?embed=1 was set, the (app)/layout.tsx wrapper still
 *   rendered TopNav + the chrome around the page, so the iframe
 *   showed the full app shell instead of a clean website render.
 *   Customer-facing preview MUST be clean.
 *
 *   Moving the embed view under (public) — which has no layout, only
 *   the bare root layout.tsx — strips the admin chrome entirely.
 *   The standalone /website/templates/[id] route under (app) keeps
 *   its admin chrome for the gallery's full-page preview path; only
 *   the iframe's sandboxed render moves here.
 *
 * Route URL: /website/templates/[id]/embed
 *   No conflict with the existing (app)/website/templates/[id]/page.tsx
 *   because the trailing /embed segment is unique to this route.
 *
 * Render parity:
 *   This page intentionally renders only the template body — no admin
 *   bar, no "Use this template" link, no breadcrumb. The iframe modal
 *   in TemplateGalleryClient owns the close + use-this controls.
 */

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = getTemplateById(id);
  if (!template) return { title: "Template not found" };
  return {
    title: `${template.name} preview — Nexpura`,
    description: template.description,
    // The embed view is iframed inside the gallery; no need for
    // search engines to index this URL on its own.
    robots: { index: false, follow: false },
  };
}

export default async function TemplateEmbedPreviewPage({ params }: Props) {
  const { id } = await params;
  const template = getTemplateById(id);
  if (!template) notFound();

  const home = template.pages.find((p) => p.type === "home") || template.pages[0];
  if (!home) notFound();

  const theme: Theme = {
    primaryColor: template.palette.primary,
    secondaryColor: template.palette.secondary,
    accentColor: template.palette.accent,
    headingFont: template.typography.heading,
    bodyFont: template.typography.body,
  };

  return (
    <>
      <TemplateFontLink theme={theme} />

      <div
        style={{
          fontFamily: theme.bodyFont,
          backgroundColor: "#ffffff",
          color: theme.secondaryColor,
        }}
      >
        <TemplateNav
          brandName={template.name}
          items={template.nav}
          theme={theme}
        />

        <main>
          <SectionRenderer
            sections={home.sections.map((s, idx) => ({
              section_type: s.type,
              display_order: idx,
              content: s.content,
              styles: s.styles ?? null,
            }))}
            theme={theme}
          />
        </main>

        <TemplateFooter
          brandName={template.name}
          copy={template.footer.copy}
          columns={template.footer.columns}
          theme={theme}
        />
      </div>
    </>
  );
}

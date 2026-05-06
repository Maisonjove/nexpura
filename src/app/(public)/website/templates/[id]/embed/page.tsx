import { Suspense } from "react";
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
 *
 * Cache Components shape:
 *   Sync top-level export → <Suspense> → async body that awaits the
 *   `params` promise. Same canonical pattern used by /embed/[tenantId]
 *   and /[subdomain]/* . Without this split, awaiting `params` at the
 *   page top level pulls dynamic data through the root layout's
 *   client-component chain (LiveRegionProvider → PWAProvider) before
 *   any Suspense boundary, and the cacheComponents prerender pipeline
 *   fails with "Uncached data was accessed outside of <Suspense>".
 *   Unlike the (app) version of this route, the (public) group has no
 *   layout-level Suspense above us, so the page itself must provide
 *   the boundary.
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

export default function TemplateEmbedPreviewPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <TemplateEmbedBody paramsPromise={params} />
    </Suspense>
  );
}

async function TemplateEmbedBody({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = await paramsPromise;
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

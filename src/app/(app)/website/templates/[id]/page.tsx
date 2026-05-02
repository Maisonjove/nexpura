import Link from "next/link";
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
  };
}

export default async function TemplatePreviewPage({ params }: Props) {
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

      {/* Top admin bar (only visible inside the app shell) */}
      <div className="bg-stone-900 text-white text-xs">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <Link
            href="/website/templates"
            className="text-white/80 hover:text-white inline-flex items-center gap-1"
          >
            ← All templates
          </Link>
          <div className="flex items-center gap-2 text-[11px] text-white/70 truncate">
            <span className="hidden sm:inline">Previewing</span>
            <strong className="text-white truncate">{template.name}</strong>
          </div>
          <Link
            href={`/website/templates#${template.id}`}
            className="bg-white text-stone-900 hover:bg-stone-100 transition-colors px-3 py-1.5 rounded-md font-medium"
          >
            Use this
          </Link>
        </div>
      </div>

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

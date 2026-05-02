import { SECTION_REGISTRY } from "./sections/registry";
import type { SectionType, Theme } from "@/lib/templates/types";

type Section = {
  section_type: string;
  display_order?: number | null;
  content: Record<string, unknown> | null;
  styles?: Record<string, unknown> | null;
};

export function SectionRenderer({
  sections,
  theme,
}: {
  sections: Section[];
  theme: Theme;
}) {
  const sorted = [...sections].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  return (
    <>
      {sorted.map((s, idx) => {
        const Component = SECTION_REGISTRY[s.section_type as SectionType];
        if (!Component) return null;
        return (
          <Component
            key={idx}
            content={s.content || {}}
            styles={s.styles || undefined}
            theme={theme}
          />
        );
      })}
    </>
  );
}

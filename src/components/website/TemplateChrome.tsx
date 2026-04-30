import type { Theme, Font } from "@/lib/templates/types";

const FONT_FAMILIES: Record<Font, string> = {
  Inter: "Inter:wght@300;400;500;600;700",
  "Playfair Display": "Playfair+Display:wght@400;500;600;700",
  "Cormorant Garamond": "Cormorant+Garamond:wght@400;500;600;700",
};

/**
 * Builds a single Google Fonts URL covering both heading + body fonts.
 */
export function buildFontHref(theme: Theme): string {
  const families = new Set<string>([
    FONT_FAMILIES[theme.headingFont],
    FONT_FAMILIES[theme.bodyFont],
  ]);
  const params = Array.from(families)
    .map((f) => `family=${f}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

export function TemplateFontLink({ theme }: { theme: Theme }) {
  return <link rel="stylesheet" href={buildFontHref(theme)} />;
}

type NavItem = { label: string; slug: string };
type FooterColumn = {
  heading: string;
  links: { label: string; href: string }[];
};

export function TemplateNav({
  brandName,
  items,
  theme,
  basePath = "",
  ctaLabel,
  ctaHref,
}: {
  brandName: string;
  items: NavItem[];
  theme: Theme;
  /** Prepend e.g. /subdomain when navigating shop pages */
  basePath?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <nav
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        backgroundColor: `${theme.secondaryColor}f2`,
        borderColor: `${theme.primaryColor}25`,
        color: getReadableOn(theme.secondaryColor),
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <a
          href={basePath || "/"}
          className="text-base sm:text-lg font-medium whitespace-nowrap"
          style={{ fontFamily: theme.headingFont }}
        >
          {brandName}
        </a>
        <div className="hidden md:flex items-center gap-7">
          {items.map((item) => (
            <a
              key={item.slug}
              href={`${basePath}/${item.slug}`}
              className="text-sm opacity-80 hover:opacity-100 transition-opacity"
              style={{ fontFamily: theme.bodyFont }}
            >
              {item.label}
            </a>
          ))}
          {ctaLabel && (
            <a
              href={ctaHref || "#"}
              className="text-xs uppercase tracking-widest px-4 py-2 rounded-full transition-opacity hover:opacity-90"
              style={{
                backgroundColor: theme.primaryColor,
                color: "#ffffff",
                fontFamily: theme.bodyFont,
              }}
            >
              {ctaLabel}
            </a>
          )}
        </div>
        <div className="md:hidden text-xs opacity-70" style={{ fontFamily: theme.bodyFont }}>
          Menu
        </div>
      </div>
    </nav>
  );
}

export function TemplateFooter({
  brandName,
  copy,
  columns,
  theme,
}: {
  brandName: string;
  copy: string;
  columns?: FooterColumn[];
  theme: Theme;
}) {
  return (
    <footer
      className="px-4 pt-14 pb-8"
      style={{
        backgroundColor: theme.secondaryColor,
        color: getReadableOn(theme.secondaryColor),
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div
              className="text-lg mb-2"
              style={{ fontFamily: theme.headingFont }}
            >
              {brandName}
            </div>
            <p className="text-xs opacity-70" style={{ fontFamily: theme.bodyFont }}>
              {copy}
            </p>
          </div>
          {(columns || []).map((col) => (
            <div key={col.heading}>
              <div
                className="text-xs uppercase tracking-widest mb-3 opacity-70"
                style={{ fontFamily: theme.bodyFont, color: theme.primaryColor }}
              >
                {col.heading}
              </div>
              <ul className="space-y-1.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="text-sm opacity-80 hover:opacity-100"
                      style={{ fontFamily: theme.bodyFont }}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className="border-t mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs opacity-60"
          style={{ borderColor: `${theme.primaryColor}30`, fontFamily: theme.bodyFont }}
        >
          <p>
            © {new Date().getFullYear()} {brandName}. All rights reserved.
          </p>
          <p className="opacity-70">Powered by Nexpura</p>
        </div>
      </div>
    </footer>
  );
}

/** Picks white or near-black depending on background luminance. */
function getReadableOn(bgHex: string): string {
  if (!bgHex || !bgHex.startsWith("#")) return "#ffffff";
  const hex = bgHex.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1a1a1a" : "#ffffff";
}

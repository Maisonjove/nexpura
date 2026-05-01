import type { SectionProps } from "./types";
import { getString, getNumber, styleOverrides } from "./types";

export default function HeroSection({ content, styles, theme }: SectionProps) {
  const heading = getString(content, "heading", "Welcome");
  const subheading = getString(content, "subheading");
  const eyebrow = getString(content, "eyebrow");
  const ctaText = getString(content, "cta_text");
  const ctaUrl = getString(content, "cta_url", "#");
  const bgImage = getString(content, "background_image_url");
  const overlay = getNumber(content, "overlay_opacity", 0.4);
  const baseBg =
    styleOverrides(styles).backgroundColor || theme.secondaryColor || "#0d0d0d";
  const baseFg = styleOverrides(styles).color || "#ffffff";

  return (
    <section
      className="relative px-4 py-20 sm:py-28 md:py-32 overflow-hidden"
      style={{ backgroundColor: baseBg, color: baseFg }}
    >
      {bgImage && (
        // Use a plain img — works for any external URL without next/image config.
        // fetchPriority + loading=eager: hero bg is almost always the LCP element
        // when set, so signal the browser to fetch ASAP and avoid lazy-load
        // delaying the paint.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgImage}
          alt=""
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 1 - overlay }}
        />
      )}
      <div className="relative max-w-4xl mx-auto text-center">
        {eyebrow && (
          <p
            className="uppercase tracking-[0.25em] text-xs sm:text-sm mb-5 opacity-80"
            style={{ fontFamily: theme.bodyFont, color: theme.primaryColor }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight font-medium"
          style={{ fontFamily: theme.headingFont }}
        >
          {heading}
        </h1>
        {subheading && (
          <p
            className="mt-6 text-base sm:text-lg md:text-xl opacity-85 max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: theme.bodyFont }}
          >
            {subheading}
          </p>
        )}
        {ctaText && (
          <div className="mt-10">
            <a
              href={ctaUrl}
              className="inline-block px-7 py-3.5 text-sm font-medium rounded-full transition-opacity hover:opacity-90"
              style={{
                backgroundColor: theme.primaryColor,
                color: "#ffffff",
                fontFamily: theme.bodyFont,
              }}
            >
              {ctaText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

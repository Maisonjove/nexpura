import type { SectionProps } from "./types";
import { getString, styleOverrides } from "./types";

export default function TextSection({ content, styles, theme }: SectionProps) {
  const heading = getString(content, "heading");
  const body = getString(content, "body");
  const alignment = getString(content, "alignment", "left") as
    | "left"
    | "center"
    | "right";
  const ctaText = getString(content, "cta_text");
  const ctaUrl = getString(content, "cta_url", "#");
  const align =
    alignment === "center"
      ? "text-center"
      : alignment === "right"
        ? "text-right"
        : "text-left";

  return (
    <section
      className="px-4 py-16 sm:py-20"
      style={{
        ...styleOverrides(styles),
        color: styleOverrides(styles).color || theme.secondaryColor,
      }}
    >
      <div className={`max-w-3xl mx-auto ${align}`}>
        {heading && (
          <h2
            className="text-3xl sm:text-4xl mb-6"
            style={{ fontFamily: theme.headingFont }}
          >
            {heading}
          </h2>
        )}
        {body && (
          <p
            className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line"
            style={{ fontFamily: theme.bodyFont }}
          >
            {body}
          </p>
        )}
        {ctaText && (
          <div
            className={`mt-8 ${alignment === "center" ? "flex justify-center" : ""}`}
          >
            <a
              href={ctaUrl}
              className="inline-block px-6 py-3 text-sm font-medium rounded-full transition-opacity hover:opacity-90"
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

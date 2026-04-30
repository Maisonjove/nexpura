import type { SectionProps } from "./types";
import { getString, styleOverrides } from "./types";

export default function ImageTextSection({
  content,
  styles,
  theme,
}: SectionProps) {
  const heading = getString(content, "heading");
  const body = getString(content, "body");
  const imageUrl = getString(content, "image_url");
  const imageSide = (getString(content, "image_side", "left") as
    | "left"
    | "right");
  const ctaText = getString(content, "cta_text");
  const ctaUrl = getString(content, "cta_url", "#");

  const reverse = imageSide === "right";

  return (
    <section
      className="px-4 py-16 sm:py-20"
      style={{
        ...styleOverrides(styles),
        color: styleOverrides(styles).color || theme.secondaryColor,
      }}
    >
      <div
        className={`max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center ${
          reverse ? "md:[&>div:first-child]:order-2" : ""
        }`}
      >
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={heading || ""}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${theme.primaryColor}22, ${theme.primaryColor}55)`,
                color: theme.primaryColor,
                fontFamily: theme.headingFont,
              }}
            >
              <span className="text-sm tracking-widest uppercase opacity-70">
                Image
              </span>
            </div>
          )}
        </div>
        <div>
          {heading && (
            <h2
              className="text-3xl sm:text-4xl mb-5"
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
            <div className="mt-7">
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
      </div>
    </section>
  );
}

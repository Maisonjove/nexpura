import type { SectionProps } from "./types";
import { getArray, getString, styleOverrides } from "./types";

type Item = { quote?: string; author?: string };

const DEFAULT_ITEMS: Item[] = [
  { quote: "An absolute pleasure to work with — the piece is beautiful.", author: "Mrs A." },
  { quote: "Thoughtful, patient and properly skilled.", author: "Mr B." },
  { quote: "We've been customers for years. Always our first call.", author: "Ms C." },
];

export default function TestimonialsSection({
  content,
  styles,
  theme,
}: SectionProps) {
  const heading = getString(content, "heading", "What our clients say");
  const provided = getArray<Item>(content, "items");
  const items = provided.length ? provided : DEFAULT_ITEMS;

  return (
    <section
      className="px-4 py-16 sm:py-20"
      style={{
        ...styleOverrides(styles),
        color: styleOverrides(styles).color || theme.secondaryColor,
      }}
    >
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl text-center mb-12"
          style={{ fontFamily: theme.headingFont }}
        >
          {heading}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
          {items.map((item, idx) => (
            <figure key={idx} className="text-center">
              <div
                className="text-3xl mb-4 opacity-50"
                style={{
                  color: theme.primaryColor,
                  fontFamily: theme.headingFont,
                }}
              >
                &ldquo;
              </div>
              <blockquote
                className="text-base sm:text-lg leading-relaxed opacity-90"
                style={{ fontFamily: theme.bodyFont }}
              >
                {item.quote || ""}
              </blockquote>
              {item.author && (
                <figcaption
                  className="mt-4 text-xs uppercase tracking-widest opacity-70"
                  style={{
                    fontFamily: theme.bodyFont,
                    color: theme.primaryColor,
                  }}
                >
                  {item.author}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

import type { SectionProps } from "./types";
import { getArray, getString, styleOverrides } from "./types";

type Item = { q?: string; a?: string };

const DEFAULT_ITEMS: Item[] = [
  { q: "How long does delivery take", a: "UK delivery is usually 2-3 working days." },
  { q: "Can I return a piece", a: "Yes — within 30 days, in its original condition." },
  { q: "Do you offer sizing", a: "First sizing is complimentary within 12 months of purchase." },
];

export default function FaqSection({ content, styles, theme }: SectionProps) {
  const heading = getString(content, "heading", "Frequently asked");
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
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl text-center mb-10"
          style={{ fontFamily: theme.headingFont }}
        >
          {heading}
        </h2>
        <div
          className="divide-y"
          style={{ borderColor: `${theme.primaryColor}30` }}
        >
          {items.map((item, idx) => (
            <details
              key={idx}
              className="group py-5"
              style={{ borderColor: `${theme.primaryColor}30` }}
            >
              <summary
                className="cursor-pointer list-none flex items-center justify-between"
                style={{ fontFamily: theme.headingFont }}
              >
                <span className="text-base sm:text-lg pr-4">
                  {item.q || ""}
                </span>
                <span
                  className="text-xl transition-transform group-open:rotate-45"
                  style={{ color: theme.primaryColor }}
                >
                  +
                </span>
              </summary>
              {item.a && (
                <p
                  className="mt-3 text-sm sm:text-base opacity-80 leading-relaxed"
                  style={{ fontFamily: theme.bodyFont }}
                >
                  {item.a}
                </p>
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

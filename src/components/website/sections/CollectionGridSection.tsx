import type { SectionProps } from "./types";
import { getArray, getNumber, getString, styleOverrides } from "./types";

type Item = { name?: string; caption?: string; image_url?: string; href?: string };

const DEFAULT_ITEMS: Item[] = [
  { name: "Engagement", caption: "Solitaires, halos, three-stones" },
  { name: "Wedding Bands", caption: "Plain, channel-set, eternity" },
  { name: "Fine Jewellery", caption: "Earrings, pendants, bracelets" },
  { name: "Bespoke", caption: "Designed entirely around you" },
];

export default function CollectionGridSection({
  content,
  styles,
  theme,
}: SectionProps) {
  const heading = getString(content, "heading");
  const subheading = getString(content, "subheading");
  const columns = getNumber(content, "columns", 3);
  const provided = getArray<Item>(content, "placeholderItems");
  const items = provided.length ? provided : DEFAULT_ITEMS;

  const colsClass =
    columns === 4
      ? "grid-cols-2 md:grid-cols-4"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-2 md:grid-cols-3";

  return (
    <section
      className="px-4 py-16 sm:py-20"
      style={{
        ...styleOverrides(styles),
        color: styleOverrides(styles).color || theme.secondaryColor,
      }}
    >
      <div className="max-w-6xl mx-auto">
        {heading && (
          <h2
            className="text-3xl sm:text-4xl text-center mb-3"
            style={{ fontFamily: theme.headingFont }}
          >
            {heading}
          </h2>
        )}
        {subheading && (
          <p
            className="text-center opacity-70 mb-10"
            style={{ fontFamily: theme.bodyFont }}
          >
            {subheading}
          </p>
        )}
        <div className={`grid ${colsClass} gap-4 md:gap-6`}>
          {items.map((item, idx) => (
            <a
              key={idx}
              href={item.href || "#"}
              className="group block rounded-lg overflow-hidden relative aspect-[4/5] transition-transform hover:-translate-y-1"
              style={{
                background: `linear-gradient(180deg, ${theme.primaryColor}11 0%, ${theme.primaryColor}55 100%)`,
              }}
            >
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt={item.name || ""}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}
              <div
                className="absolute inset-0 flex flex-col justify-end p-5"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)",
                }}
              >
                <div
                  className="text-white text-lg sm:text-xl"
                  style={{ fontFamily: theme.headingFont }}
                >
                  {item.name || "Collection"}
                </div>
                {item.caption && (
                  <div
                    className="text-white/80 text-xs sm:text-sm mt-1"
                    style={{ fontFamily: theme.bodyFont }}
                  >
                    {item.caption}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

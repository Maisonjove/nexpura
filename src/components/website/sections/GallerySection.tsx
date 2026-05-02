import type { SectionProps } from "./types";
import { getArray, getNumber, getString, styleOverrides } from "./types";

type Item = { name?: string; caption?: string; image_url?: string };

const DEFAULT_ITEMS: Item[] = [
  { name: "Diamond Solitaire", caption: "Round brilliant" },
  { name: "Yellow Gold Eternity Band", caption: "18ct, channel set" },
  { name: "Sapphire Halo Pendant", caption: "Ceylon sapphire" },
  { name: "Pearl Drop Earrings", caption: "South Sea" },
  { name: "Tennis Bracelet", caption: "Lab-grown diamonds" },
  { name: "Emerald Cluster Ring", caption: "Colombian emerald" },
];

export default function GallerySection({
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
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
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
            <figure key={idx} className="group">
              <div
                className="aspect-square w-full overflow-hidden rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.02]"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor}1a, ${theme.primaryColor}55)`,
                }}
              >
                {item.image_url ? (
                  // Below-the-fold for almost every layout — lazy-load so the
                  // gallery doesn't compete with the hero for bandwidth/decode
                  // time on initial paint.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name || ""}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="text-xs uppercase tracking-widest opacity-60"
                    style={{ color: theme.primaryColor, fontFamily: theme.bodyFont }}
                  >
                    {item.name || "Piece"}
                  </span>
                )}
              </div>
              <figcaption className="mt-3 text-sm">
                <div
                  className="font-medium"
                  style={{ fontFamily: theme.headingFont }}
                >
                  {item.name || "Piece"}
                </div>
                {item.caption && (
                  <div
                    className="opacity-60 text-xs mt-0.5"
                    style={{ fontFamily: theme.bodyFont }}
                  >
                    {item.caption}
                  </div>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

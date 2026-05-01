import type { SectionProps } from "./types";
import { getArray, getNumber, getString, styleOverrides } from "./types";

type Item = {
  name?: string;
  caption?: string;
  price?: string | number;
  image_url?: string;
};

const DEFAULT_ITEMS: Item[] = [
  { name: "Diamond Solitaire", caption: "1.00ct, 18ct white gold", price: "£4,950" },
  { name: "Yellow Gold Eternity Band", caption: "18ct, channel set", price: "£1,850" },
  { name: "Sapphire Halo Pendant", caption: "Ceylon sapphire", price: "£1,420" },
  { name: "Pearl Drop Earrings", caption: "South Sea", price: "£890" },
];

export default function ProductGridSection({
  content,
  styles,
  theme,
}: SectionProps) {
  const heading = getString(content, "heading");
  const subheading = getString(content, "subheading");
  const columns = getNumber(content, "columns", 4);
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
            <article
              key={idx}
              className="group rounded-lg overflow-hidden border transition-all hover:-translate-y-0.5"
              style={{ borderColor: `${theme.primaryColor}22` }}
            >
              <div
                className="aspect-square w-full overflow-hidden flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor}14, ${theme.primaryColor}44)`,
                }}
              >
                {item.image_url ? (
                  // Product grid sits below the hero in every template — lazy
                  // so initial paint isn't blocked by N image decodes.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name || ""}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <span
                    className="text-xs uppercase tracking-widest opacity-60"
                    style={{ color: theme.primaryColor, fontFamily: theme.bodyFont }}
                  >
                    {item.name || "Product"}
                  </span>
                )}
              </div>
              <div className="p-4">
                <div
                  className="text-sm font-medium truncate"
                  style={{ fontFamily: theme.headingFont }}
                >
                  {item.name || "Product"}
                </div>
                {item.caption && (
                  <div
                    className="text-xs opacity-60 truncate mt-0.5"
                    style={{ fontFamily: theme.bodyFont }}
                  >
                    {item.caption}
                  </div>
                )}
                {item.price !== undefined && item.price !== "" && (
                  <div
                    className="mt-2 text-sm font-semibold"
                    style={{ color: theme.primaryColor, fontFamily: theme.bodyFont }}
                  >
                    {typeof item.price === "number"
                      ? `£${item.price.toLocaleString()}`
                      : item.price}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

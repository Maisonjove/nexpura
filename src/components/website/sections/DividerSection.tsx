import type { SectionProps } from "./types";
import { getString, styleOverrides } from "./types";

export default function DividerSection({
  content,
  styles,
  theme,
}: SectionProps) {
  const variant = getString(content, "style", "line") as "line" | "space";

  if (variant === "space") {
    return <div className="h-12 sm:h-16" style={styleOverrides(styles)} />;
  }

  return (
    <div className="px-4 py-8" style={styleOverrides(styles)}>
      <div className="max-w-6xl mx-auto">
        <hr
          className="border-0 h-px"
          style={{ backgroundColor: `${theme.primaryColor}30` }}
        />
      </div>
    </div>
  );
}

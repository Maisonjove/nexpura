import type { SectionProps } from "./types";
import { getNumber, styleOverrides } from "./types";

export default function SpacerSection({ content, styles }: SectionProps) {
  const size = getNumber(content, "size", 64); // px
  return <div style={{ height: `${size}px`, ...styleOverrides(styles) }} />;
}

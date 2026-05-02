import type { Theme } from "@/lib/templates/types";

export type SectionProps = {
  content: Record<string, unknown>;
  styles?: Record<string, unknown>;
  theme: Theme;
};

export type { Theme };

export function getString(
  c: Record<string, unknown> | undefined,
  key: string,
  fallback = ""
): string {
  const v = c?.[key];
  return typeof v === "string" ? v : fallback;
}

export function getNumber(
  c: Record<string, unknown> | undefined,
  key: string,
  fallback: number
): number {
  const v = c?.[key];
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

export function getArray<T = unknown>(
  c: Record<string, unknown> | undefined,
  key: string
): T[] {
  const v = c?.[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

export function styleOverrides(styles?: Record<string, unknown>) {
  const out: React.CSSProperties = {};
  const bg = styles?.["background_color"];
  if (typeof bg === "string") out.backgroundColor = bg;
  const fg = styles?.["text_color"];
  if (typeof fg === "string") out.color = fg;
  return out;
}

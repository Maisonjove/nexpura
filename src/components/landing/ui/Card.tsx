import { type ReactNode } from "react";

/**
 * Marketing-site card per Kaitlyn's brief (section 2 — Cards).
 *
 * White-soft background, soft border, 16px radius. Lift + warm tint +
 * champagne border on hover. Optional `interactive` flag enables the
 * hover transition (off for static info cards).
 */

export interface CardProps {
  children: ReactNode;
  interactive?: boolean;
  variant?: "default" | "muted" | "dark";
  className?: string;
  as?: "div" | "article" | "section";
}

export default function Card({
  children,
  interactive = true,
  variant = "default",
  className,
  as = "div",
}: CardProps) {
  const Tag = as;
  // Internal padding minimum 32px desktop / 22px mobile per Kaitlyn's
  // correction Fix #8 (was 28px both, breaching the desktop minimum).
  const base = "rounded-2xl border p-[22px] sm:p-8 transition-all duration-[250ms] ease-out";
  const variantCls =
    variant === "muted"
      ? "bg-m-ivory border-m-border-soft text-m-text-muted"
      : variant === "dark"
      ? "bg-m-charcoal text-white border-[rgba(201,169,97,0.2)] " +
        "shadow-[inset_0_60px_120px_-80px_rgba(201,169,97,0.18)]"
      : "bg-m-white-soft border-m-border-soft";
  const hover = interactive
    ? variant === "default"
      ? "hover:-translate-y-1 hover:border-m-border-hover hover:bg-[#FDFAF4] hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)]"
      : "hover:-translate-y-0.5"
    : "";
  return (
    <Tag className={[base, variantCls, hover, className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}

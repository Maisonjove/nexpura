import { type ReactNode } from "react";

/**
 * Standard section header — serif H2 + sans subheading.
 *
 * Used by every section on the homepage so the typography rhythm is
 * consistent (24px between headline and subheading per the brief).
 */

export interface SectionHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: SectionHeaderProps) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <header className={[alignCls, "max-w-3xl", className ?? ""].filter(Boolean).join(" ")}>
      {eyebrow && (
        <p className="text-[12px] font-sans font-medium tracking-[0.2em] uppercase text-m-champagne mb-4">
          {eyebrow}
        </p>
      )}
      <h2 className="font-serif text-[34px] sm:text-[40px] leading-[1.15] text-m-charcoal">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-6 text-[16px] sm:text-[17px] leading-[1.6] text-m-text-secondary">
          {subtitle}
        </p>
      )}
    </header>
  );
}

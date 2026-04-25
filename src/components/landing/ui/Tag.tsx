import { type ReactNode } from "react";

/**
 * Small pill tag — used in the audience cards on the homepage to list
 * sub-features (POS / Inventory / CRM / Repairs etc.). Sans 12px,
 * ivory background, charcoal text, soft border.
 */
export default function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-1 rounded-full",
        "bg-m-ivory border border-m-border-soft text-m-charcoal",
        "font-sans text-[12px] font-medium",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

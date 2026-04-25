import { type ReactNode } from "react";

/**
 * Refined audience-card chip per Kaitlyn's correction brief (Fix #1C).
 *
 * 34px tall, 14px charcoal text, ivory background, soft border, no
 * shadow. When the parent card is hovered (Tailwind `group` on the
 * card root), the chip background shifts from `#FBF8F3` → `#F3E9D5`.
 */
export default function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center h-[34px] px-[14px] rounded-full whitespace-nowrap",
        "bg-[#FBF8F3] border border-[#E8E1D6] text-[#292929]",
        "font-sans text-[14px] font-medium leading-none",
        "transition-[background-color,border-color] duration-200 [transition-timing-function:var(--m-ease)]",
        "group-hover:bg-[#F3E9D5]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

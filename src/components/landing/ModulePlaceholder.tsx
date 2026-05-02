// ============================================
// ModulePlaceholder — elegant on-brand "mockup coming soon" tile.
// Batch 5 site refinement (2026-04-28).
//
// Replaces the prior stylised SVG illustrations at
// public/mockups/modules/*.svg AND the inline ModulePreviewPlaceholder
// that lived inside PlatformPageClient. Kaitlyn's note:
//
//   "The current module mockup images look too realistic and don't
//    represent the real product."
//
// The new tile reads CLEARLY as a placeholder while staying on-brand:
// cream background, hairline gold dashed border, centred serif label,
// muted secondary text. Aspect ratio matches the previous image slots
// (16/10) so adjacent text columns don't reflow when this swaps in.
//
// SVG files at public/mockups/modules/*.svg are intentionally left on
// disk — they're staged for later replacement by real screenshots, at
// which point a single component swap (this file → an <img> tag) will
// flip the whole site over to live product captures.
// ============================================

import React from "react"

type ModulePlaceholderProps = {
  /** The module's display name, e.g. "Point of Sale". */
  name: string
  /**
   * Aspect ratio override for callsites that need a different slot
   * shape than the default 16/10. Most callers should leave this alone.
   */
  aspectRatio?: string
  /** Extra classes for the outer wrapper, mostly for layout overrides. */
  className?: string
}

export default function ModulePlaceholder({
  name,
  aspectRatio = "16 / 10",
  className = "",
}: ModulePlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={`${name} — mockup coming soon`}
      className={[
        // Layout — hairline dashed border, soft cream fill, rounded corners
        "relative w-full rounded-lg",
        "bg-[#F1E9D8]",
        "border border-dashed border-[#C9A24A]/40",
        "flex items-center justify-center",
        // Text inside — centred, serif, muted
        "px-6 text-center",
        className,
      ].join(" ")}
      style={{ aspectRatio }}
    >
      <span className="font-serif text-m-text-secondary text-[1rem] md:text-[1.05rem] leading-[1.4] tracking-[0.005em]">
        {name}
        <span className="mx-2 text-m-text-faint" aria-hidden="true">
          —
        </span>
        <span className="text-m-text-faint italic">mockup coming soon</span>
      </span>
    </div>
  )
}

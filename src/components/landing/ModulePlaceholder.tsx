// ============================================
// ModulePlaceholder — renders a real platform screenshot.
// Updated 2026-05-04: replaces the prior dashed-border "mockup coming soon"
// tile with an actual screenshot of the platform demo (auth-free /demo
// route). The image lives at public/mockups/screenshots/dashboard.png and
// shows the redesigned command-centre look the marketing pages reference.
// ============================================

import React from "react"

type ModulePlaceholderProps = {
  /** The module's display name, used for alt text. */
  name: string
  /**
   * Aspect ratio override for callsites that need a different slot
   * shape than the default 16/10. Most callers should leave this alone.
   */
  aspectRatio?: string
  /** Extra classes for the outer wrapper, mostly for layout overrides. */
  className?: string
  /**
   * Optional override of the image source. Defaults to the platform
   * dashboard screenshot used across the marketing site.
   */
  src?: string
}

export default function ModulePlaceholder({
  name,
  aspectRatio = "16 / 10",
  className = "",
  src = "/mockups/screenshots/dashboard.png",
}: ModulePlaceholderProps) {
  return (
    <div
      className={[
        "relative w-full overflow-hidden rounded-2xl",
        "bg-[#FAFAF9]",
        "border border-stone-200",
        "shadow-[0_8px_24px_rgba(0,0,0,0.06)]",
        className,
      ].join(" ")}
      style={{ aspectRatio }}
    >
      <img
        src={src}
        alt={`${name} — Nexpura platform preview`}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
    </div>
  )
}

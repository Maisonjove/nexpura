// ============================================
// src/components/landing/_tokens.ts
// Single source of truth for landing page design tokens.
// Every landing component imports from here.
//
// Per Kaitlyn 2026-04-26 "global aesthetic alignment" brief.
// ============================================

// Section vertical padding — varies by emphasis tier
export const SECTION_PADDING = {
  // Tier 1 — flagship sections (Hero, Product Demo)
  flagship: "px-6 py-20 md:py-24 lg:py-28",
  // Tier 2 — premium differentiators (AI Copilot, Digital Passport)
  premium: "px-6 py-20 md:py-24",
  // Tier 3 — standard sections (Platform Modules, Audience Cards, Comparison, Final CTA, Problem, Explore Platform)
  standard: "px-6 py-16 md:py-20",
  // Tier 4 — compact sections (Migration Strip, FAQ)
  compact: "px-6 py-14 md:py-16",
}

// Heading hierarchy — uniform across all sections
export const HEADING = {
  // Section H2 — used on every section heading except Hero (H1) and Final CTA
  h2: "font-serif text-m-charcoal text-[1.85rem] leading-[1.15] tracking-[-0.005em] md:text-[2.4rem]",
  // Final CTA H2 — slightly larger to mark page closure
  h2Closing: "font-serif text-m-charcoal text-[2rem] leading-[1.12] tracking-[-0.005em] md:text-[2.6rem]",
  // Card titles inside sections (H3)
  h3: "font-serif text-m-charcoal text-[1.2rem] leading-[1.25] md:text-[1.3rem]",
  // Eyebrow above H2
  eyebrow: "inline-block font-sans text-[0.78rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4",
  // Subheading under H2
  subhead: "mt-5 text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.55]",
}

// Spacing between intro block and content grid below it
export const INTRO_SPACING = {
  standard: "mb-12 md:mb-14",
  compact: "mb-10 md:mb-12",
}

// Card system — uniform across all card-based sections
export const CARD = {
  // Base card style — applies to all light cards on cream background
  base: "rounded-2xl border border-[#E4DBC9] bg-white/60 transition-all duration-200",
  // Padding tier for card-heavy sections (problem, audience cards, platform modules)
  paddingStandard: "p-7 md:p-8",
  // Padding tier for compact card sections (migration strip)
  paddingCompact: "p-6 md:p-7",
  // Hover state — subtle lift, no aggressive shadow
  hover: "hover:border-[#C9BFA9] hover:bg-white/80 hover:-translate-y-0.5",
}

// Button system — exactly two button styles across the entire page
export const BUTTON = {
  primary:
    "inline-flex items-center justify-center rounded-full bg-[#111] text-white border border-[#111] px-7 py-3.5 font-sans text-[0.95rem] font-medium transition-all duration-200 hover:bg-[#2a2a2a] hover:-translate-y-0.5",
  secondary:
    "inline-flex items-center justify-center rounded-full bg-transparent text-m-charcoal border border-m-charcoal px-7 py-3.5 font-sans text-[0.95rem] font-medium transition-all duration-200 hover:bg-m-charcoal hover:text-white hover:-translate-y-0.5",
}

// Inline link style (e.g. "View feature →", "See full migration support →")
export const INLINE_LINK =
  "inline-flex items-center gap-2 font-sans text-[0.95rem] font-medium text-m-charcoal border-b border-m-charcoal pb-0.5 transition-opacity duration-200 hover:opacity-70"

// Container max-widths
export const CONTAINER = {
  // Standard wide container for grids
  wide: "mx-auto max-w-6xl",
  // Narrow container for centred intros and FAQ
  narrow: "mx-auto max-w-3xl",
  // Medium container for migration strip
  medium: "mx-auto max-w-5xl",
}

// Recurring colour values
export const COLORS = {
  ivory: "#F6F1E9",
  warmCream: "#F1E9D8",
  borderSoft: "#E4DBC9",
  borderHover: "#C9BFA9",
  borderMuted: "#B9B0A1",
  charcoal: "#1A1A1A",
  nearBlack: "#0E0E10",
  gold: "#C9A24A",
  goldDeep: "#A8852C",
  textMuted: "#8A8276",
  textSubtle: "#5A554C",
}

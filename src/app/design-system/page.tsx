"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// ─── Animation helpers ──────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeBlur = {
  initial: { opacity: 0, filter: "blur(6px)" },
  whileInView: { opacity: 1, filter: "blur(0px)" },
  viewport: { once: true } as const,
  transition: { duration: 1.2, ease: EASE },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, filter: "blur(4px)", y: 16 },
  whileInView: { opacity: 1, filter: "blur(0px)", y: 0 },
  viewport: { once: true } as const,
  transition: { duration: 1.2, ease: EASE, delay },
});

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-baseline gap-4 mb-3">
        <span className="text-sm tabular-nums text-stone-300 font-medium">
          {number}
        </span>
        <motion.h2
          {...fadeBlur}
          className="font-serif text-[1.75rem] sm:text-[2rem] text-stone-900 font-normal"
        >
          {title}
        </motion.h2>
      </div>
      <motion.p
        {...fadeUp(0.1)}
        className="text-[0.9375rem] text-stone-400 leading-relaxed mb-10 pl-10 max-w-[600px]"
      >
        {description}
      </motion.p>
      <div className="pl-0 sm:pl-10">{children}</div>
    </section>
  );
}

// ─── Color swatch ───────────────────────────────────────────────────────────

function Swatch({
  name,
  hex,
  className,
  dark = false,
}: {
  name: string;
  hex: string;
  className: string;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(hex);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group text-left cursor-pointer"
    >
      <div
        className={`${className} w-full aspect-[3/2] rounded-2xl border border-stone-200 transition-all duration-400 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] group-hover:border-stone-300 relative overflow-hidden`}
      >
        <span
          className={`absolute bottom-3 right-3 text-[0.6875rem] font-mono ${dark ? "text-white/50" : "text-stone-400"} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        >
          {copied ? "Copied!" : hex}
        </span>
      </div>
      <p className="text-[0.8125rem] font-medium text-stone-900 mt-2.5">
        {name}
      </p>
      <p className="text-[0.75rem] text-stone-400 font-mono">{hex}</p>
    </button>
  );
}

// ─── Token row ──────────────────────────────────────────────────────────────

function TokenRow({
  token,
  value,
  preview,
}: {
  token: string;
  value: string;
  preview?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-6 py-3 border-b border-stone-100 last:border-0">
      <code className="text-[0.8125rem] font-mono text-nexpura-bronze w-48 shrink-0">
        {token}
      </code>
      <span className="text-[0.8125rem] text-stone-500 flex-1">{value}</span>
      {preview && <div className="shrink-0">{preview}</div>}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState<"primary" | "semantic" | "chart">(
    "primary"
  );

  return (
    <div className="space-y-20 lg:space-y-28">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center pt-8 lg:pt-16 pb-4">
        <motion.p
          {...fadeUp()}
          className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-4"
        >
          Nexpura Design System
        </motion.p>
        <motion.h1
          {...fadeBlur}
          className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-normal leading-[1.08] tracking-[-0.01em] text-stone-900 mb-6"
        >
          The Visual Language
        </motion.h1>
        <motion.p
          {...fadeUp(0.3)}
          className="text-base lg:text-lg text-stone-500 leading-relaxed max-w-[560px] mx-auto"
        >
          Every color, typeface, and interaction has been crafted to reflect the
          precision and elegance of fine jewellery. This is the foundation.
        </motion.p>
      </div>

      {/* ── 01 Colors ─────────────────────────────────────────────────────── */}
      <Section
        id="colors"
        number="01"
        title="Colors"
        description="A warm, neutral palette rooted in stone and bronze. Designed to feel premium without demanding attention."
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-stone-100 rounded-xl p-1 w-fit">
          {(
            [
              { key: "primary", label: "Brand" },
              { key: "semantic", label: "Semantic" },
              { key: "chart", label: "Chart" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-[0.8125rem] font-medium transition-all duration-300 cursor-pointer ${
                activeTab === tab.key
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Brand colors */}
        {activeTab === "primary" && (
          <motion.div
            {...fadeUp()}
            className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4"
          >
            <Swatch
              name="Charcoal"
              hex="#1A1A1A"
              className="bg-nexpura-charcoal"
              dark
            />
            <Swatch
              name="Bronze"
              hex="#8B7355"
              className="bg-nexpura-bronze"
              dark
            />
            <Swatch
              name="Bronze Hover"
              hex="#7A6347"
              className="bg-nexpura-bronze-hover"
              dark
            />
            <Swatch
              name="Bronze Light"
              hex="#C4A882"
              className="bg-nexpura-bronze-light"
            />
            <Swatch
              name="Champagne"
              hex="#E8DCC8"
              className="bg-nexpura-champagne"
            />
            <Swatch name="Warm" hex="#EDE9E3" className="bg-nexpura-warm" />
            <Swatch name="Cream" hex="#F5F2EE" className="bg-nexpura-cream" />
            <Swatch name="Ivory" hex="#FAFAF9" className="bg-nexpura-ivory" />
          </motion.div>
        )}

        {/* Semantic colors */}
        {activeTab === "semantic" && (
          <motion.div
            {...fadeUp()}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            <Swatch
              name="Background"
              hex="stone-50"
              className="bg-background"
            />
            <Swatch
              name="Foreground"
              hex="stone-950"
              className="bg-foreground"
              dark
            />
            <Swatch name="Card" hex="#FFFFFF" className="bg-card" />
            <Swatch name="Primary" hex="#8B7355" className="bg-primary" dark />
            <Swatch
              name="Secondary"
              hex="stone-100"
              className="bg-secondary"
            />
            <Swatch
              name="Destructive"
              hex="red-500"
              className="bg-destructive"
              dark
            />
            <Swatch name="Muted" hex="stone-100" className="bg-muted" />
            <Swatch name="Accent" hex="stone-100" className="bg-accent" />
            <Swatch name="Border" hex="stone-200" className="bg-border" />
            <Swatch name="Input" hex="stone-200" className="bg-input" />
            <Swatch name="Ring" hex="#8B7355" className="bg-ring" dark />
            <Swatch
              name="Popover"
              hex="#FFFFFF"
              className="bg-popover"
            />
          </motion.div>
        )}

        {/* Chart colors */}
        {activeTab === "chart" && (
          <motion.div
            {...fadeUp()}
            className="grid grid-cols-2 sm:grid-cols-5 gap-4"
          >
            <Swatch
              name="Chart 1 (Bronze)"
              hex="#8B7355"
              className="bg-chart-1"
              dark
            />
            <Swatch
              name="Chart 2 (Green)"
              hex="#22C55E"
              className="bg-chart-2"
              dark
            />
            <Swatch
              name="Chart 3 (Orange)"
              hex="#EAB308"
              className="bg-chart-3"
            />
            <Swatch
              name="Chart 4 (Red)"
              hex="#EF4444"
              className="bg-chart-4"
              dark
            />
            <Swatch
              name="Chart 5 (Blue)"
              hex="#475569"
              className="bg-chart-5"
              dark
            />
          </motion.div>
        )}
      </Section>

      {/* ── 02 Typography ─────────────────────────────────────────────────── */}
      <Section
        id="typography"
        number="02"
        title="Typography"
        description="Cormorant Garamond for display and headings conveys heritage. Inter for body text ensures clarity at every size."
      >
        {/* Type scale */}
        <div className="space-y-0">
          {/* Display */}
          <motion.div
            {...fadeUp()}
            className="py-8 border-b border-stone-200"
          >
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                Display &middot; Serif
              </span>
              <code className="text-[0.75rem] font-mono text-stone-400">
                3rem / 1.15 / -0.01em
              </code>
            </div>
            <p className="font-serif text-display text-stone-900">
              The Art of Fine Jewellery
            </p>
          </motion.div>

          {/* Heading XL */}
          <motion.div
            {...fadeUp(0.05)}
            className="py-8 border-b border-stone-200"
          >
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                Heading XL &middot; Serif
              </span>
              <code className="text-[0.75rem] font-mono text-stone-400">
                2.5rem / 1.2 / -0.01em
              </code>
            </div>
            <p className="font-serif text-heading-xl text-stone-900">
              Precision meets elegance
            </p>
          </motion.div>

          {/* Heading LG */}
          <motion.div
            {...fadeUp(0.1)}
            className="py-8 border-b border-stone-200"
          >
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                Heading LG &middot; Serif
              </span>
              <code className="text-[0.75rem] font-mono text-stone-400">
                2rem / 1.25
              </code>
            </div>
            <p className="font-serif text-heading-lg text-stone-900">
              Crafted for jewellers who care
            </p>
          </motion.div>

          {/* Heading */}
          <motion.div
            {...fadeUp(0.15)}
            className="py-8 border-b border-stone-200"
          >
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                Heading &middot; Serif
              </span>
              <code className="text-[0.75rem] font-mono text-stone-400">
                1.5rem / 1.3 / 0.01em
              </code>
            </div>
            <p className="font-serif text-heading text-stone-900">
              Workshop management, reimagined
            </p>
          </motion.div>

          {/* Body LG */}
          <motion.div
            {...fadeUp(0.2)}
            className="py-8 border-b border-stone-200"
          >
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                Body Large &middot; Sans
              </span>
              <code className="text-[0.75rem] font-mono text-stone-400">
                1.125rem / 1.7
              </code>
            </div>
            <p className="text-body-lg text-stone-600 max-w-[640px]">
              From point of sale to bespoke orders, Nexpura gives retail and
              workshop jewellers the modern platform they&apos;ve been waiting
              for.
            </p>
          </motion.div>

          {/* Body */}
          <motion.div
            {...fadeUp(0.25)}
            className="py-8 border-b border-stone-200"
          >
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                Body &middot; Sans
              </span>
              <code className="text-[0.75rem] font-mono text-stone-400">
                0.9375rem / relaxed
              </code>
            </div>
            <p className="text-[0.9375rem] leading-relaxed text-stone-500 max-w-[640px]">
              Every piece leaves your atelier with a verifiable certificate of
              authenticity. One QR scan and your client sees provenance,
              materials, craftsmanship.
            </p>
          </motion.div>

          {/* Overline */}
          <motion.div {...fadeUp(0.3)} className="py-8 border-b border-stone-200">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                Overline &middot; Sans
              </span>
              <code className="text-[0.75rem] font-mono text-stone-400">
                0.75rem / 1.4 / 0.15em
              </code>
            </div>
            <p className="text-overline uppercase text-stone-400">
              Fine Jewellery &middot; Since 2024
            </p>
          </motion.div>

          {/* Caption */}
          <motion.div {...fadeUp(0.35)} className="py-8">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                Caption &middot; Sans
              </span>
              <code className="text-[0.75rem] font-mono text-stone-400">
                0.8125rem / relaxed
              </code>
            </div>
            <p className="text-[0.8125rem] text-stone-400 leading-relaxed">
              REP-1038 &middot; Emma Clarke &middot; Clasp Replacement
            </p>
          </motion.div>
        </div>

        {/* Letter spacing tokens */}
        <div className="mt-12">
          <h3 className="font-serif text-lg text-stone-900 mb-6">
            Letter Spacing
          </h3>
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <TokenRow
              token="tracking-luxury"
              value="0.2em"
              preview={
                <span className="tracking-luxury text-sm text-stone-700 uppercase">
                  NEXPURA
                </span>
              }
            />
            <TokenRow
              token="tracking-editorial"
              value="0.1em"
              preview={
                <span className="tracking-editorial text-sm text-stone-700 uppercase">
                  Fine Jewellery
                </span>
              }
            />
            <TokenRow
              token="tracking-refined"
              value="0.05em"
              preview={
                <span className="tracking-refined text-sm text-stone-700">
                  Premium Quality
                </span>
              }
            />
          </div>
        </div>

        {/* Font families */}
        <div className="mt-12">
          <h3 className="font-serif text-lg text-stone-900 mb-6">
            Font Families
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400">
              <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-3">
                Serif
              </p>
              <p className="font-serif text-3xl text-stone-900 mb-2">
                Cormorant Garamond
              </p>
              <p className="font-serif text-lg text-stone-500 italic">
                Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk
              </p>
              <div className="flex gap-4 mt-4">
                <span className="font-serif font-light text-stone-400">
                  Light
                </span>
                <span className="font-serif font-normal text-stone-500">
                  Regular
                </span>
                <span className="font-serif font-medium text-stone-600">
                  Medium
                </span>
                <span className="font-serif font-semibold text-stone-700">
                  Semi
                </span>
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400">
              <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-3">
                Sans-Serif
              </p>
              <p className="font-sans text-3xl font-medium text-stone-900 mb-2">
                Inter
              </p>
              <p className="font-sans text-lg text-stone-500">
                Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk
              </p>
              <div className="flex gap-4 mt-4">
                <span className="font-sans font-light text-stone-400">
                  Light
                </span>
                <span className="font-sans font-normal text-stone-500">
                  Regular
                </span>
                <span className="font-sans font-medium text-stone-600">
                  Medium
                </span>
                <span className="font-sans font-semibold text-stone-700">
                  Semi
                </span>
                <span className="font-sans font-bold text-stone-800">Bold</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 03 Spacing ────────────────────────────────────────────────────── */}
      <Section
        id="spacing"
        number="03"
        title="Spacing"
        description="Generous whitespace conveys luxury. Tight spacing feels cramped, wide spacing lets the content breathe."
      >
        <div className="bg-white border border-stone-200 rounded-2xl p-6 overflow-x-auto">
          <div className="flex items-end gap-3 min-w-[600px]">
            {[
              { label: "2", px: 8 },
              { label: "3", px: 12 },
              { label: "4", px: 16 },
              { label: "5", px: 20 },
              { label: "6", px: 24 },
              { label: "8", px: 32 },
              { label: "10", px: 40 },
              { label: "12", px: 48 },
              { label: "16", px: 64 },
              { label: "20", px: 80 },
              { label: "24", px: 96 },
            ].map((space) => (
              <div key={space.label} className="flex flex-col items-center gap-2">
                <div
                  className="bg-nexpura-bronze/20 rounded-sm border border-nexpura-bronze/30 w-10"
                  style={{ height: `${space.px}px` }}
                />
                <span className="text-[0.6875rem] font-mono text-stone-400">
                  {space.label}
                </span>
                <span className="text-[0.625rem] font-mono text-stone-300">
                  {space.px}px
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Common spacing patterns */}
        <div className="mt-8 bg-white border border-stone-200 rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-stone-700 mb-4">
            Common Spacing Patterns
          </h4>
          <TokenRow
            token="Page padding"
            value="px-6 sm:px-10 lg:px-16"
          />
          <TokenRow
            token="Section gap"
            value="py-20 lg:py-36"
          />
          <TokenRow
            token="Card padding"
            value="p-6"
          />
          <TokenRow
            token="Card item gap"
            value="gap-3 or gap-4"
          />
          <TokenRow
            token="Content max-width"
            value="max-w-[1400px] mx-auto"
          />
        </div>
      </Section>

      {/* ── 04 Buttons ────────────────────────────────────────────────────── */}
      <Section
        id="buttons"
        number="04"
        title="Buttons"
        description="Three tiers: the premium dark CTA for hero moments, the bronze primary for key actions, and quiet variants for secondary tasks."
      >
        {/* Premium CTA */}
        <div className="mb-10">
          <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-4">
            Premium CTA
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <a className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] transition-shadow duration-400 hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden cursor-pointer">
              <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
              <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">
                Get Started
              </span>
            </a>
            <a className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] transition-shadow duration-400 hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden cursor-pointer opacity-50 pointer-events-none">
              <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
              <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">
                Disabled
              </span>
            </a>
          </div>
        </div>

        {/* Bronze primary */}
        <div className="mb-10">
          <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-4">
            Primary (Bronze)
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="nx-btn-primary cursor-pointer">
              Save Changes
            </button>
            <button className="nx-btn-primary cursor-pointer px-6 py-2.5">
              Create New Item
            </button>
            <button className="nx-btn-primary cursor-pointer opacity-50 pointer-events-none">
              Disabled
            </button>
          </div>
        </div>

        {/* Secondary variants */}
        <div className="mb-10">
          <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-4">
            Secondary Variants
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200 cursor-pointer">
              Outline
            </button>
            <button className="px-4 py-2 rounded-md text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors duration-200 cursor-pointer">
              Secondary
            </button>
            <button className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors duration-200 cursor-pointer">
              Ghost
            </button>
            <button className="px-4 py-2 rounded-md text-sm font-medium text-nexpura-bronze hover:underline transition-colors duration-200 cursor-pointer">
              Link
            </button>
          </div>
        </div>

        {/* Destructive */}
        <div className="mb-10">
          <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-4">
            Destructive
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors duration-200 cursor-pointer">
              Delete Item
            </button>
            <button className="px-4 py-2 rounded-md text-sm font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors duration-200 cursor-pointer">
              Remove
            </button>
          </div>
        </div>

        {/* Sizes */}
        <div>
          <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-4">
            Sizes
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="nx-btn-primary cursor-pointer text-xs px-3 py-1.5">
              Small
            </button>
            <button className="nx-btn-primary cursor-pointer">Default</button>
            <button className="nx-btn-primary cursor-pointer px-6 py-2.5 text-base">
              Large
            </button>
            <button className="nx-btn-primary cursor-pointer w-10 h-10 p-0 flex items-center justify-center rounded-lg">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          </div>
        </div>
      </Section>

      {/* ── 05 Cards ──────────────────────────────────────────────────────── */}
      <Section
        id="cards"
        number="05"
        title="Cards"
        description="White surfaces on ivory backgrounds. Subtle borders, rounded corners, optional hover elevation."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Default card */}
          <motion.div {...fadeUp()} className="nx-card">
            <p className="nx-card-title mb-1">Default Card</p>
            <p className="text-[0.8125rem] text-stone-400 leading-relaxed">
              The standard card with{" "}
              <code className="text-[0.75rem] bg-stone-100 px-1.5 py-0.5 rounded">
                .nx-card
              </code>{" "}
              class. White bg, stone-200 border, subtle shadow.
            </p>
          </motion.div>

          {/* Hover card */}
          <motion.div
            {...fadeUp(0.1)}
            className="bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer"
          >
            <p className="text-sm font-semibold text-stone-700 mb-1">
              Interactive Card
            </p>
            <p className="text-[0.8125rem] text-stone-400 leading-relaxed">
              Hover to see elevated shadow and border darkening. Used for
              actionable items like the demo dashboard.
            </p>
          </motion.div>

          {/* Action card */}
          <motion.div {...fadeUp(0.2)}>
            <a
              href="#cards"
              className="group flex items-center gap-5 bg-white border border-stone-200 rounded-2xl px-6 py-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer"
            >
              <div className="flex-shrink-0 text-stone-400 group-hover:text-[#8B7355] transition-colors duration-400">
                <svg
                  className="w-7 h-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[0.9375rem] font-medium text-stone-900">
                  Action Card
                </p>
                <p className="text-[0.8125rem] text-stone-400 mt-0.5 leading-relaxed">
                  Icon + text pattern from the demo
                </p>
              </div>
            </a>
          </motion.div>

          {/* Stat card */}
          <motion.div
            {...fadeUp(0.05)}
            className="bg-white border border-stone-200 rounded-2xl p-6"
          >
            <p className="text-[0.8125rem] text-stone-400 mb-1">
              Revenue This Month
            </p>
            <p className="text-2xl font-semibold text-stone-900 tabular-nums">
              $48,295
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-emerald-600 text-[0.8125rem] font-medium">
                +12.5%
              </span>
              <span className="text-[0.75rem] text-stone-400">
                vs last month
              </span>
            </div>
          </motion.div>

          {/* Glass card */}
          <motion.div
            {...fadeUp(0.15)}
            className="backdrop-blur-2xl bg-white/85 border border-black/[0.08] rounded-2xl p-6"
          >
            <p className="text-sm font-semibold text-stone-700 mb-1">
              Glass Card
            </p>
            <p className="text-[0.8125rem] text-stone-400 leading-relaxed">
              Used in sticky headers and overlays.{" "}
              <code className="text-[0.75rem] bg-stone-100 px-1.5 py-0.5 rounded">
                backdrop-blur-2xl bg-white/85
              </code>
            </p>
          </motion.div>

          {/* Side panel card */}
          <motion.div
            {...fadeUp(0.25)}
            className="bg-white border border-stone-200 rounded-2xl p-6"
          >
            <h3 className="font-serif text-lg text-stone-900 mb-4 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Panel Card
            </h3>
            <div className="space-y-0.5">
              {["Emma Clarke", "David Chen", "James Taylor"].map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-stone-50 transition-colors duration-200 cursor-pointer"
                >
                  <span className="text-[0.875rem] text-stone-700">{name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ── 06 Badges ─────────────────────────────────────────────────────── */}
      <Section
        id="badges"
        number="06"
        title="Badges"
        description="Contextual status indicators. Each uses a tinted background, matching text, and a subtle border."
      >
        <div className="flex flex-wrap gap-3 items-center mb-8">
          <span className="nx-badge-success">Completed</span>
          <span className="nx-badge-success">Paid</span>
          <span className="nx-badge-warning">Pending</span>
          <span className="nx-badge-warning">In Progress</span>
          <span className="nx-badge-danger">Overdue</span>
          <span className="nx-badge-danger">Cancelled</span>
          <span className="nx-badge-neutral">Draft</span>
          <span className="nx-badge-neutral">Archived</span>
        </div>

        {/* Badge specs */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <TokenRow
            token=".nx-badge-success"
            value="emerald-700 / emerald-50 / emerald-200 border"
            preview={<span className="nx-badge-success">Active</span>}
          />
          <TokenRow
            token=".nx-badge-warning"
            value="amber-700 / amber-50 / amber-200 border"
            preview={<span className="nx-badge-warning">Pending</span>}
          />
          <TokenRow
            token=".nx-badge-danger"
            value="red-700 / red-50 / red-200 border"
            preview={<span className="nx-badge-danger">Overdue</span>}
          />
          <TokenRow
            token=".nx-badge-neutral"
            value="stone-600 / stone-100 / stone-200 border"
            preview={<span className="nx-badge-neutral">Draft</span>}
          />
        </div>
      </Section>

      {/* ── 07 Inputs ─────────────────────────────────────────────────────── */}
      <Section
        id="inputs"
        number="07"
        title="Form Inputs"
        description="Clean, minimal form elements with stone borders and bronze focus rings."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[800px]">
          {/* Text input */}
          <div>
            <label className="block text-[0.8125rem] font-medium text-stone-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>

          {/* Email input */}
          <div>
            <label className="block text-[0.8125rem] font-medium text-stone-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
            />
          </div>

          {/* Search input (rounded pill) */}
          <div>
            <label className="block text-[0.8125rem] font-medium text-stone-700 mb-1.5">
              Search (Pill)
            </label>
            <div className="flex items-center border border-stone-200 rounded-full px-4 py-2.5 hover:border-stone-300 transition-colors duration-200 focus-within:border-nexpura-bronze focus-within:ring-2 focus-within:ring-nexpura-bronze/20">
              <svg
                className="w-3.5 h-3.5 text-stone-400 mr-2.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                className="text-sm text-stone-900 placeholder:text-stone-400 outline-none bg-transparent w-full"
              />
            </div>
          </div>

          {/* Select */}
          <div>
            <label className="block text-[0.8125rem] font-medium text-stone-700 mb-1.5">
              Category
            </label>
            <select className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 bg-white">
              <option>Rings</option>
              <option>Necklaces</option>
              <option>Bracelets</option>
              <option>Earrings</option>
            </select>
          </div>

          {/* Textarea */}
          <div className="sm:col-span-2">
            <label className="block text-[0.8125rem] font-medium text-stone-700 mb-1.5">
              Notes
            </label>
            <textarea
              placeholder="Add any additional notes..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none"
            />
          </div>

          {/* Checkbox */}
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="ds-check"
              className="w-4 h-4 rounded border-stone-300 text-nexpura-bronze focus:ring-nexpura-bronze/20"
            />
            <label
              htmlFor="ds-check"
              className="text-[0.8125rem] text-stone-700"
            >
              Include certificate of authenticity
            </label>
          </div>
        </div>
      </Section>

      {/* ── 08 Icons ──────────────────────────────────────────────────────── */}
      <Section
        id="icons"
        number="08"
        title="Icons"
        description="Heroicons (outline, 1.5px stroke) at 28px for action cards, 20px for UI, 16px for inline. Bronze on hover."
      >
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-4">
          {[
            {
              name: "Plus",
              path: "M12 4.5v15m7.5-7.5h-15",
            },
            {
              name: "Search",
              path: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
            },
            {
              name: "Cart",
              path: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z",
            },
            {
              name: "Box",
              path: "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
            },
            {
              name: "User",
              path: "M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z",
            },
            {
              name: "Mail",
              path: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
            },
            {
              name: "Wrench",
              path: "M11.42 15.17l-5.648 5.648a2.121 2.121 0 01-3-3l5.648-5.648m3-3L19.5 4.5m-8.08 10.67a5.068 5.068 0 01-1.54-3.62c0-1.326.527-2.6 1.46-3.54a5.068 5.068 0 013.54-1.46c1.326 0 2.6.527 3.54 1.46",
            },
            {
              name: "Sparkles",
              path: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
            },
            {
              name: "Clipboard",
              path: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z",
            },
          ].map((icon) => (
            <div
              key={icon.name}
              className="group flex flex-col items-center gap-2.5 bg-white border border-stone-200 rounded-2xl p-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400 cursor-pointer"
            >
              <svg
                className="w-7 h-7 text-stone-400 group-hover:text-[#8B7355] transition-colors duration-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={icon.path}
                />
              </svg>
              <span className="text-[0.6875rem] text-stone-400 group-hover:text-stone-600 transition-colors duration-300">
                {icon.name}
              </span>
            </div>
          ))}
        </div>

        {/* Icon sizes */}
        <div className="mt-8 bg-white border border-stone-200 rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-stone-700 mb-4">Sizes</h4>
          <div className="flex items-end gap-8">
            {[
              { size: "w-4 h-4", label: "16px — Inline" },
              { size: "w-5 h-5", label: "20px — UI" },
              { size: "w-6 h-6", label: "24px — Default" },
              { size: "w-7 h-7", label: "28px — Action Card" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2">
                <svg
                  className={`${s.size} text-stone-500`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
                <span className="text-[0.6875rem] text-stone-400 text-center">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── 09 Shadows ────────────────────────────────────────────────────── */}
      <Section
        id="shadows"
        number="09"
        title="Shadows & Elevation"
        description="Shadows are used sparingly. Cards rest flat by default, lifting gently on hover to signal interactivity."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-white rounded-xl shadow-none border border-stone-200" />
            <span className="text-[0.75rem] text-stone-400 text-center">
              None (default)
            </span>
            <code className="text-[0.625rem] font-mono text-stone-300">
              shadow-none
            </code>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-stone-200" />
            <span className="text-[0.75rem] text-stone-400 text-center">
              Subtle
            </span>
            <code className="text-[0.625rem] font-mono text-stone-300">
              shadow-sm
            </code>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-stone-200" />
            <span className="text-[0.75rem] text-stone-400 text-center">
              Hover elevation
            </span>
            <code className="text-[0.625rem] font-mono text-stone-300 text-center">
              0 8px 24px rgba(0,0,0,0.06)
            </code>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]" />
            <span className="text-[0.75rem] text-stone-400 text-center">
              Premium CTA
            </span>
            <code className="text-[0.625rem] font-mono text-stone-300 text-center">
              Multi-layer + inset
            </code>
          </div>
        </div>
      </Section>

      {/* ── 10 Borders & Radius ───────────────────────────────────────────── */}
      <Section
        id="borders"
        number="10"
        title="Borders & Radius"
        description="Soft corners and delicate borders. The radius system uses a CSS variable for global consistency."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Radius scale */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <h4 className="text-sm font-semibold text-stone-700 mb-6">
              Border Radius
            </h4>
            <div className="flex items-end gap-6">
              {[
                { cls: "rounded-sm", label: "sm", val: "8px" },
                { cls: "rounded-md", label: "md", val: "10px" },
                { cls: "rounded-lg", label: "lg", val: "12px" },
                { cls: "rounded-xl", label: "xl", val: "16px" },
                { cls: "rounded-2xl", label: "2xl", val: "24px" },
                { cls: "rounded-full", label: "full", val: "9999px" },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex flex-col items-center gap-2"
                >
                  <div
                    className={`w-12 h-12 bg-nexpura-bronze/15 border border-nexpura-bronze/30 ${r.cls}`}
                  />
                  <span className="text-[0.6875rem] font-mono text-stone-500">
                    {r.label}
                  </span>
                  <span className="text-[0.625rem] text-stone-300">
                    {r.val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Border styles */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <h4 className="text-sm font-semibold text-stone-700 mb-6">
              Border Styles
            </h4>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-12 rounded-xl border border-stone-200" />
                <div>
                  <p className="text-[0.8125rem] text-stone-700">Card border</p>
                  <code className="text-[0.6875rem] font-mono text-stone-400">
                    border-stone-200
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 h-12 rounded-xl border border-black/[0.08]" />
                <div>
                  <p className="text-[0.8125rem] text-stone-700">Glass border</p>
                  <code className="text-[0.6875rem] font-mono text-stone-400">
                    border-black/[0.08]
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 h-12 rounded-xl border border-stone-300" />
                <div>
                  <p className="text-[0.8125rem] text-stone-700">Hover border</p>
                  <code className="text-[0.6875rem] font-mono text-stone-400">
                    border-stone-300
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 11 Animations ─────────────────────────────────────────────────── */}
      <Section
        id="animations"
        number="11"
        title="Motion & Animations"
        description="Framer Motion with blur-fade entrance. Luxury easing, staggered reveals, scroll-driven opacity."
      >
        {/* Animation demos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <AnimationDemo name="Fade In" animation="animate-fade-in" />
          <AnimationDemo name="Fade In Up" animation="animate-fade-in-up" />
          <AnimationDemo
            name="Slide In Right"
            animation="animate-slide-in-right"
          />
          <AnimationDemo name="Scale In" animation="animate-scale-in" />
        </div>

        {/* Motion tokens */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-stone-700 mb-4">
            Framer Motion Presets
          </h4>
          <TokenRow
            token="fadeBlur"
            value="opacity: 0 → 1, blur: 6px → 0px, 1.2s"
          />
          <TokenRow
            token="fadeUp"
            value="opacity: 0 → 1, blur: 4px → 0, y: 16 → 0, 1.2s"
          />
          <TokenRow
            token="easing"
            value="cubic-bezier(0.22, 1, 0.36, 1) — luxury"
          />
          <TokenRow
            token="stagger"
            value="delay: index * 0.1s"
          />
          <TokenRow
            token="scroll-driven"
            value="useScroll + useTransform for opacity and y"
          />
        </div>

        {/* Transition tokens */}
        <div className="mt-6 bg-white border border-stone-200 rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-stone-700 mb-4">
            Transition Durations
          </h4>
          <TokenRow token="duration-200" value="200ms — Micro interactions" />
          <TokenRow token="duration-300" value="300ms — Menu, toggle" />
          <TokenRow token="duration-400" value="400ms — Card hover, color change" />
          <TokenRow token="duration-600" value="600ms — Panel reveal" />
          <TokenRow token="duration-800" value="800ms — Section entrance" />
        </div>
      </Section>

      {/* ── 12 Glass & Overlays ───────────────────────────────────────────── */}
      <Section
        id="glass"
        number="12"
        title="Glass & Overlays"
        description="Frosted glass headers, semi-transparent overlays, and dropdown panels."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Glass header mock */}
          <div className="relative rounded-2xl overflow-hidden h-[280px] border border-stone-200">
            <div className="absolute inset-0 bg-gradient-to-br from-nexpura-bronze/20 via-nexpura-champagne to-nexpura-cream" />
            <div className="absolute inset-x-0 top-0 backdrop-blur-2xl bg-white/85 border-b border-black/[0.08] px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="font-serif text-lg tracking-[0.12em] text-stone-900">
                  NEXPURA
                </span>
                <div className="flex gap-4">
                  <span className="text-[0.8125rem] text-stone-500">Sales</span>
                  <span className="text-[0.8125rem] text-stone-500">
                    Inventory
                  </span>
                  <span className="text-[0.8125rem] text-stone-500">
                    Workshop
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <code className="text-[0.6875rem] font-mono text-stone-600 bg-white/60 px-2 py-1 rounded">
                backdrop-blur-2xl bg-white/85 border-black/[0.08]
              </code>
            </div>
          </div>

          {/* Dropdown mock */}
          <div className="relative rounded-2xl overflow-hidden h-[280px] border border-stone-200 bg-stone-50">
            <div className="absolute top-6 left-6 right-6">
              <div className="bg-white/95 backdrop-blur-2xl border border-black/[0.08] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-2">
                {["New Sale", "Quick Sale", "Find Sale", "Point of Sale"].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex flex-col px-4 py-3 rounded-xl hover:bg-stone-50 transition-colors duration-200 cursor-pointer"
                    >
                      <span className="text-[0.875rem] font-medium text-stone-900">
                        {item}
                      </span>
                      <span className="text-[0.8125rem] text-stone-400 mt-0.5">
                        Action description
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <code className="text-[0.6875rem] font-mono text-stone-600 bg-white/60 px-2 py-1 rounded">
                bg-white/95 backdrop-blur-2xl shadow-[0_8px_24px]
              </code>
            </div>
          </div>
        </div>

        {/* Sidebar mock */}
        <div className="mt-6">
          <div className="bg-[#1A1A1A] rounded-2xl p-6 max-w-[280px]">
            <span className="font-serif text-lg tracking-[0.12em] text-white mb-6 block">
              NEXPURA
            </span>
            <div className="space-y-0.5">
              <div className="nx-nav-item nx-nav-item-active">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                  />
                </svg>
                Dashboard
              </div>
              <div className="nx-nav-item nx-nav-item-inactive">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                  />
                </svg>
                Sales
              </div>
              <div className="nx-nav-item nx-nav-item-inactive">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                  />
                </svg>
                Inventory
              </div>
            </div>
            <div className="mt-4">
              <code className="text-[0.6875rem] font-mono text-stone-500">
                bg-[#1A1A1A] + .nx-nav-item classes
              </code>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="border-t border-stone-200 pt-12 pb-8 text-center">
        <p className="font-serif text-lg text-stone-900 mb-2">NEXPURA</p>
        <p className="text-[0.8125rem] text-stone-400">
          Design System v1.0 &middot; Built with Tailwind CSS, Framer Motion &
          shadcn/ui
        </p>
      </div>
    </div>
  );
}

// ─── Animation demo component ───────────────────────────────────────────────

function AnimationDemo({
  name,
  animation,
}: {
  name: string;
  animation: string;
}) {
  const [key, setKey] = useState(0);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col items-center gap-4">
      <div
        key={key}
        className={`w-12 h-12 rounded-xl bg-nexpura-bronze/20 border border-nexpura-bronze/30 ${animation}`}
      />
      <span className="text-[0.8125rem] text-stone-700 font-medium">
        {name}
      </span>
      <button
        onClick={() => setKey((k) => k + 1)}
        className="text-[0.75rem] text-nexpura-bronze hover:underline cursor-pointer"
      >
        Replay
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";

const SECTIONS = [
  { label: "Colors", href: "#colors" },
  { label: "Typography", href: "#typography" },
  { label: "Spacing", href: "#spacing" },
  { label: "Buttons", href: "#buttons" },
  { label: "Cards", href: "#cards" },
  { label: "Badges", href: "#badges" },
  { label: "Inputs", href: "#inputs" },
  { label: "Icons", href: "#icons" },
  { label: "Shadows", href: "#shadows" },
  { label: "Borders", href: "#borders" },
  { label: "Animations", href: "#animations" },
  { label: "Glass", href: "#glass" },
];

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {/* Top banner */}
      <div className="bg-stone-900 px-4 py-2.5 text-center text-[0.8125rem] text-stone-300 z-50 relative">
        <span className="text-stone-400">Design System</span>
        <span className="mx-2 text-stone-600">&mdash;</span>
        <span>Nexpura visual language & component reference.</span>
        <a
          href="/"
          className="text-white font-medium ml-3 hover:opacity-70 transition-opacity duration-300"
        >
          Back to site &rarr;
        </a>
      </div>

      {/* Glass header */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-white/85 border-b border-black/[0.08]">
        <nav className="flex items-center justify-between max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 h-[72px]">
          {/* Logo */}
          <a
            href="/design-system"
            className="font-serif text-[1.75rem] tracking-[0.12em] text-stone-900 transition-opacity duration-300 hover:opacity-70 shrink-0"
          >
            NEXPURA
          </a>

          {/* Center nav - section links */}
          <div className="hidden lg:flex items-center gap-1">
            {SECTIONS.map((section) => (
              <a
                key={section.href}
                href={section.href}
                className="relative px-3.5 py-6 text-[0.8125rem] text-stone-500 transition-colors duration-300 hover:text-stone-900 group"
              >
                {section.label}
                <span className="absolute bottom-[18px] left-3.5 right-3.5 h-px bg-stone-900 w-0 group-hover:w-[calc(100%-28px)] transition-[width] duration-300" />
              </a>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-4">
            <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
              v1.0
            </span>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden flex flex-col gap-1.5 p-1 cursor-pointer"
            aria-label="Toggle menu"
          >
            <span
              className={`block w-6 h-[1.5px] bg-stone-900 transition-transform duration-300 ${menuOpen ? "translate-y-[3.75px] rotate-45" : ""}`}
            />
            <span
              className={`block w-6 h-[1.5px] bg-stone-900 transition-transform duration-300 ${menuOpen ? "-translate-y-[3.75px] -rotate-45" : ""}`}
            />
          </button>
        </nav>

        {/* Mobile menu */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-out ${menuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="flex flex-col gap-1 px-6 sm:px-10 py-4 bg-white/97 border-t border-black/[0.04]">
            {SECTIONS.map((section) => (
              <a
                key={section.href}
                href={section.href}
                onClick={() => setMenuOpen(false)}
                className="text-[0.9375rem] text-stone-900 py-2.5 hover:opacity-70 transition-opacity duration-300"
              >
                {section.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-8 lg:py-12">
        {children}
      </main>
    </div>
  );
}

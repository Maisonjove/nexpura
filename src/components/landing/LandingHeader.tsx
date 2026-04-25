'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Button from './ui/Button'

/**
 * Sticky marketing nav per Kaitlyn's brief (section 4).
 *
 * - Left cluster: Platform · Solutions · Migration · Pricing
 * - Centre: NEXPURA serif wordmark
 * - Right cluster: About · Login · Book a Demo (tertiary) · Start Free Trial (primary)
 *
 * Sticky behaviour:
 *   - At scroll 0: ivory background, no shadow
 *   - After 40px: frosted glass (bg-rgba(250,247,242,0.78) + backdrop-blur)
 *     + border-bottom + subtle shadow
 *   - Transition 250ms
 *
 * Mobile: hamburger toggles a slide-down full-width panel; primary CTA
 * is a full-width filled pill at the bottom, with Book a Demo as a
 * ghost link below.
 */
export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on resize past breakpoint
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMenuOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <header
      className={[
        'sticky top-0 left-0 right-0 z-50',
        'transition-[background-color,box-shadow,border-color] duration-[250ms]',
        '[transition-timing-function:var(--m-ease)]',
        scrolled
          ? 'bg-[rgba(250,247,242,0.78)] backdrop-blur-[14px] border-b border-m-border-soft shadow-[0_1px_8px_rgba(0,0,0,0.04)]'
          : 'bg-m-ivory border-b border-transparent',
      ].join(' ')}
    >
      <nav
        aria-label="Primary"
        className="flex items-center justify-between max-w-[1200px] mx-auto px-6 sm:px-12 h-[72px]"
      >
        {/* Left cluster: Platform · Solutions · Migration · Pricing */}
        <div className="hidden md:flex items-center gap-8 flex-1">
          <NavLink href="/platform">Platform</NavLink>
          <NavLink href="/features">Solutions</NavLink>
          <NavLink href="/#migration">Migration</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
        </div>

        {/* Centre: serif wordmark */}
        <Link
          href="/"
          aria-label="Nexpura — home"
          className="font-serif text-[1.625rem] sm:text-[1.75rem] tracking-[0.12em] text-m-charcoal shrink-0"
        >
          NEXPURA
        </Link>

        {/* Right cluster: About · Login · Book a Demo (tertiary) · Start Free Trial (primary) */}
        <div className="hidden md:flex items-center gap-6 flex-1 justify-end">
          <NavLink href="/about">About</NavLink>
          <NavLink href="/login">Login</NavLink>
          <Link
            href="/contact"
            className="text-[14px] font-sans text-m-text-secondary transition-colors duration-200 hover:text-m-charcoal hover:underline underline-offset-4"
          >
            Book a Demo
          </Link>
          <Button href="/signup" size="default">
            Start Free Trial
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2 -mr-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne rounded"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-panel"
        >
          <span
            className={`block w-6 h-[1.5px] bg-m-charcoal transition-transform duration-300 ${
              menuOpen ? 'translate-y-[3.75px] rotate-45' : ''
            }`}
          />
          <span
            className={`block w-6 h-[1.5px] bg-m-charcoal transition-transform duration-300 ${
              menuOpen ? '-translate-y-[3.75px] -rotate-45' : ''
            }`}
          />
        </button>
      </nav>

      {/* Mobile menu — slide-down panel */}
      <div
        id="mobile-nav-panel"
        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          menuOpen ? 'max-h-[640px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-1 px-6 py-4 bg-m-ivory border-t border-m-border-soft">
          <MobileLink href="/platform">Platform</MobileLink>
          <MobileLink href="/features">Solutions</MobileLink>
          <MobileLink href="/#migration">Migration</MobileLink>
          <MobileLink href="/pricing">Pricing</MobileLink>
          <MobileLink href="/about">About</MobileLink>
          <MobileLink href="/login">Login</MobileLink>
          <div className="pt-4 mt-2 border-t border-m-border-soft">
            <Button href="/signup" fullWidth size="lg">
              Start Free Trial
            </Button>
            <Link
              href="/contact"
              className="block text-center mt-3 py-2 text-[14px] font-sans text-m-text-secondary hover:text-m-charcoal"
              onClick={() => setMenuOpen(false)}
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative text-[15px] font-sans font-normal text-m-text-secondary transition-colors duration-200 hover:text-m-charcoal"
    >
      {children}
      <span className="absolute bottom-[-4px] left-0 w-0 h-px bg-m-charcoal transition-[width] duration-300 group-hover:w-full" />
    </Link>
  )
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block py-3 px-2 text-[16px] font-sans text-m-charcoal min-h-[48px] flex items-center hover:bg-m-champagne-soft rounded-lg transition-colors"
    >
      {children}
    </Link>
  )
}

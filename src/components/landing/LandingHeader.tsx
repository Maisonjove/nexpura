'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Match a link href against the current pathname.
 *  - "/" only matches the literal homepage
 *  - any other href matches exact OR child paths (e.g. /platform/foo)
 */
function isActive(href: string, pathname: string | null) {
  if (!pathname) return false
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Sticky marketing nav. Updated 2026-04-28 (Batch 1 site refinement):
 *
 * - Left cluster: Platform · Features · Pricing · Verify Passport
 * - Centre: NEXPURA serif wordmark
 * - Right cluster: About · Book a Demo · Login (outlined pill) ·
 *   Start Free Trial (filled pill)
 *
 * 2026-04-28 (Batch 1): the right-side text-link demo CTA stays
 * "Book a Demo" — the spec's "Book a Guided Demo" form is reserved for
 * page-level CTAs where it has room to breathe. In the header, the
 * extra word forces a wrap at 1024–1280px and crowds the right cluster
 * against the wordmark, so we keep the short form here. (Footer +
 * page CTAs use "Book a Guided Demo".) Verify Passport stays as a
 * plain NavLink so it reads as utility, visually subordinate to Login
 * and Start Free Trial.
 *
 * Login + Start Free Trial are now visible compact pill buttons at
 * header scale (px-5 py-2 text-[0.88rem]) so they don't compete with
 * the page-CTA-scale buttons in the Hero / FinalCTA. About + Book a
 * Demo stay as plain text nav links — preserves the visual hierarchy
 * (nav links → outline pill → filled pill).
 *
 * Sticky behaviour:
 *   - At scroll 0: ivory background, no shadow
 *   - After 40px: frosted glass + border-bottom + subtle shadow
 */
export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

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
        {/* Left cluster: Platform · Features · Pricing · Verify Passport
            (Migration removed 2026-04-26; "Solutions" → "Features" same day;
            "Verify Passport" added 2026-04-26 — points at the existing
            public verification page at /verify, restoring the entry point
            that was cut during an earlier cleanup. Plain-text NavLink to
            match the rest of the cluster — no pill, no badge.) Reduced
            gap from gap-8 to gap-6 to keep all four items fitting cleanly
            against the right cluster at 1280px without wrapping. */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          <NavLink href="/platform" pathname={pathname}>Platform</NavLink>
          <NavLink href="/features" pathname={pathname}>Features</NavLink>
          <NavLink href="/pricing" pathname={pathname}>Pricing</NavLink>
          <NavLink href="/verify" pathname={pathname}>Verify Passport</NavLink>
        </div>

        {/* Centre: serif wordmark */}
        <Link
          href="/"
          aria-label="Nexpura — home"
          className="font-serif text-[1.625rem] sm:text-[1.75rem] tracking-[0.12em] text-m-charcoal shrink-0"
        >
          NEXPURA
        </Link>

        {/* Right cluster: About · Book a Demo · Login (outlined pill) · Start Free Trial (filled pill) */}
        <div className="hidden md:flex items-center gap-5 flex-1 justify-end">
          <NavLink href="/about" pathname={pathname}>About</NavLink>
          <NavLink href="/contact" pathname={pathname}>Book a Demo</NavLink>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-transparent text-m-charcoal border border-m-charcoal px-5 py-2 font-sans text-[0.88rem] font-medium transition-all duration-200 hover:bg-m-charcoal hover:text-white"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-[#111] text-white border border-[#111] px-5 py-2 font-sans text-[0.88rem] font-medium transition-all duration-200 hover:bg-[#2a2a2a]"
          >
            Start Free Trial
          </Link>
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
          <MobileLink href="/platform" pathname={pathname}>Platform</MobileLink>
          <MobileLink href="/features" pathname={pathname}>Features</MobileLink>
          <MobileLink href="/pricing" pathname={pathname}>Pricing</MobileLink>
          <MobileLink href="/verify" pathname={pathname}>Verify Passport</MobileLink>
          <MobileLink href="/about" pathname={pathname}>About</MobileLink>
          <MobileLink href="/contact" pathname={pathname}>Book a Demo</MobileLink>
          <MobileLink href="/login" pathname={pathname}>Login</MobileLink>
          <div className="pt-4 mt-2 border-t border-m-border-soft">
            <Link
              href="/signup"
              className="block w-full text-center rounded-full bg-[#111] text-white border border-[#111] px-7 py-3.5 font-sans text-[0.95rem] font-medium transition-all duration-200 hover:bg-[#2a2a2a]"
              onClick={() => setMenuOpen(false)}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

function NavLink({
  href,
  pathname,
  children,
}: {
  href: string
  pathname: string | null
  children: React.ReactNode
}) {
  // Active state treatment: full-opacity charcoal text + medium font-weight
  // (vs muted secondary + normal weight for inactive). Underline grows on
  // hover for inactive links and stays visible at full width for active.
  const active = isActive(href, pathname)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'group relative text-[15px] font-sans transition-colors duration-200',
        active
          ? 'text-m-charcoal font-medium'
          : 'text-m-text-secondary font-normal hover:text-m-charcoal',
      ].join(' ')}
    >
      {children}
      <span
        className={[
          'absolute bottom-[-4px] left-0 h-px bg-m-charcoal transition-[width] duration-300',
          active ? 'w-full' : 'w-0 group-hover:w-full',
        ].join(' ')}
      />
    </Link>
  )
}

function MobileLink({
  href,
  pathname,
  children,
}: {
  href: string
  pathname: string | null
  children: React.ReactNode
}) {
  const active = isActive(href, pathname)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'block py-3 px-2 text-[16px] font-sans text-m-charcoal min-h-[48px] flex items-center hover:bg-m-champagne-soft rounded-lg transition-colors',
        active ? 'font-medium bg-m-champagne-soft/60' : 'font-normal',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}

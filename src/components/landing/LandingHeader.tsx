'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl transition-[border-color] duration-300 ${
        scrolled
          ? 'border-b border-black/[0.08] bg-white/85'
          : 'border-b border-black/[0.04] bg-white/85'
      }`}
    >
      <nav className="flex items-center justify-between max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-20 h-[72px]">
        {/* Left nav */}
        <div className="hidden md:flex items-center gap-10 flex-1">
          <NavLink href="#toolkit">Solutions</NavLink>
          <NavLink href="#toolkit">Platform</NavLink>
        </div>

        {/* Logo */}
        <Link
          href="/"
          className="font-serif text-[1.75rem] tracking-[0.12em] text-stone-900 transition-opacity duration-300 hover:opacity-70 shrink-0"
        >
          NEXPURA
        </Link>

        {/* Right nav */}
        <div className="hidden md:flex items-center gap-6 flex-1 justify-end">
          <NavLink href="#">About</NavLink>
          <NavLink href="#">Contact</NavLink>
          <NavLink href="/login">Login</NavLink>
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#52B788] text-white text-sm font-medium rounded-lg hover:bg-[#3d9970] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Verify Passport
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-1 cursor-pointer"
          aria-label="Toggle menu"
        >
          <span
            className={`block w-6 h-[1.5px] bg-stone-900 transition-transform duration-300 ${
              menuOpen ? 'translate-y-[3.75px] rotate-45' : ''
            }`}
          />
          <span
            className={`block w-6 h-[1.5px] bg-stone-900 transition-transform duration-300 ${
              menuOpen ? '-translate-y-[3.75px] -rotate-45' : ''
            }`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          menuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-col gap-4 px-6 sm:px-10 py-6 bg-white/97">
          <NavLink href="#toolkit">Solutions</NavLink>
          <NavLink href="#toolkit">Platform</NavLink>
          <NavLink href="#">About</NavLink>
          <NavLink href="#">Contact</NavLink>
          <NavLink href="/login">Login</NavLink>
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 mt-2 px-4 py-2.5 bg-[#52B788] text-white text-sm font-medium rounded-lg hover:bg-[#3d9970] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Verify Passport
          </Link>
        </div>
      </div>
    </header>
  )
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group relative text-[0.9375rem] font-normal text-stone-900 transition-opacity duration-300 hover:opacity-70"
    >
      {children}
      <span className="absolute bottom-[-4px] left-0 w-0 h-px bg-stone-900 transition-[width] duration-300 group-hover:w-full" />
    </Link>
  )
}

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
      className={`fixed top-0 left-0 right-0 z-50 bg-white transition-[border-color,box-shadow] duration-300 ${
        scrolled
          ? 'border-b border-black/[0.08] shadow-[0_1px_0_rgba(0,0,0,0.02)]'
          : 'border-b border-transparent'
      }`}
    >
      <nav className="flex items-center justify-between max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-20 h-[72px]">
        {/* Left nav */}
        <div className="hidden md:flex items-center gap-10 flex-1">
          <NavLink href="/features">Features</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
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
          <NavLink href="/about">About</NavLink>
          <NavLink href="/contact">Contact</NavLink>
          <NavLink href="/login">Login</NavLink>
          <Link
            href="/verify"
            className="
              group inline-flex items-center gap-2
              pl-4 pr-5 py-2
              bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]
              rounded-full
              shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.08)]
              transition-shadow duration-400
              hover:shadow-[0_2px_4px_rgba(0,0,0,0.22),0_8px_20px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.08)]
              relative overflow-hidden
            "
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <svg
              className="w-3.5 h-3.5 text-nexpura-bronze-light relative z-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-[0.8125rem] font-medium text-white tracking-[0.01em] relative z-10">
              Verify Passport
            </span>
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
          <NavLink href="/features">Features</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/about">About</NavLink>
          <NavLink href="/contact">Contact</NavLink>
          <NavLink href="/login">Login</NavLink>
          <Link
            href="/verify"
            className="
              inline-flex items-center gap-2 mt-2 self-start
              pl-4 pr-5 py-2.5
              bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]
              rounded-full
              shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.08)]
              relative overflow-hidden
            "
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <svg
              className="w-3.5 h-3.5 text-nexpura-bronze-light relative z-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-[0.8125rem] font-medium text-white tracking-[0.01em] relative z-10">
              Verify Passport
            </span>
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

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Gem, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
  { label: 'Migration', href: '/switching' },
];

export function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-stone-950 border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-amber-600 flex items-center justify-center flex-shrink-0">
            <Gem size={14} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">Nexpura</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={link.href === '/pricing' || link.href === '/features'}
              className="text-sm text-stone-400 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            prefetch
            className="text-sm text-stone-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            prefetch
            className="text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 px-4 py-2 rounded-lg transition-colors"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-stone-400 hover:text-white"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-stone-950 border-t border-white/[0.06] px-6 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-sm text-stone-400 hover:text-white transition-colors py-1"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2">
            <Link href="/login" className="text-sm text-stone-400 py-1">Sign in</Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 px-4 py-2 rounded-lg transition-colors text-center"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { InstagramIcon, Facebook01Icon, Linkedin01Icon, NewTwitterIcon } from '@hugeicons/core-free-icons'

/**
 * Footer per Kaitlyn's brief (section 19). Charcoal background, four
 * link columns + a small Legal column, social icons row, and the brand
 * tagline. Hover state per link is a champagne underline that animates
 * in from the left.
 */

const COLUMNS = [
  {
    title: 'Solutions',
    links: [
      { label: 'Retail Jewellers', href: '/features' },
      { label: 'Repairs & Workshop', href: '/features#repairs' },
      { label: 'Bespoke Orders', href: '/features#bespoke' },
      { label: 'Multi-Store Groups', href: '/features' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Inventory', href: '/features#inventory' },
      { label: 'Repairs', href: '/features#repairs' },
      { label: 'Digital Passport', href: '/verify' },
      { label: 'Analytics', href: '/features#analytics' },
    ],
  },
  {
    title: 'Migration & Pricing',
    links: [
      { label: 'Migration', href: '/#migration' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Verify Passport', href: '/verify' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Book a Demo', href: '/contact' },
      { label: 'Start Free Trial', href: '/signup' },
    ],
  },
] as const

const SOCIALS = [
  { icon: InstagramIcon, label: 'Instagram', href: 'https://instagram.com/nexpura' },
  { icon: Facebook01Icon, label: 'Facebook', href: 'https://facebook.com/nexpura' },
  { icon: Linkedin01Icon, label: 'LinkedIn', href: 'https://linkedin.com/company/nexpura' },
  { icon: NewTwitterIcon, label: 'X', href: 'https://x.com/nexpura' },
] as const

export default function LandingFooter() {
  return (
    <footer className="bg-m-charcoal text-white pt-20 pb-10 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto">
        {/* Brand row */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 pb-12 border-b border-white/10">
          <div className="max-w-[420px]">
            <Link href="/" className="font-serif text-[24px] tracking-[0.12em] text-white">
              NEXPURA
            </Link>
            <p className="mt-4 text-[14px] leading-[1.6] text-white/60">
              The operating system for jewellery retail, repairs, bespoke, and inventory.
            </p>
          </div>
          {/* Legal column on the right of the brand row */}
          <div className="text-[13px] text-white/60">
            <h4 className="text-[12px] uppercase tracking-[0.15em] text-white/80 mb-4 font-medium">
              Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <FooterLink href="/terms">Terms of Service</FooterLink>
              </li>
              <li>
                <FooterLink href="/privacy">Privacy Policy</FooterLink>
              </li>
            </ul>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 sm:gap-8 py-12">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[12px] uppercase tracking-[0.15em] text-white/80 mb-4 font-medium">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/80 transition-all duration-200 [transition-timing-function:var(--m-ease)] hover:-translate-y-0.5 hover:border-m-champagne hover:text-m-champagne"
              >
                <HugeiconsIcon icon={s.icon} size={14} strokeWidth={1.5} />
              </a>
            ))}
          </div>
          <div className="text-[12px] text-white/50 sm:text-right space-y-1">
            <p>© 2026 Nexpura. All rights reserved.</p>
            <p>Built for modern jewellers.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-block text-[13px] text-white/60 transition-colors duration-200 hover:text-white"
    >
      {children}
      <span
        aria-hidden
        className="absolute -bottom-0.5 left-0 right-0 h-px bg-m-champagne origin-left scale-x-0 transition-transform duration-200 [transition-timing-function:var(--m-ease)] group-hover:scale-x-100"
      />
    </Link>
  )
}

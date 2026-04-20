import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { InstagramIcon, Facebook01Icon, Linkedin01Icon, NewTwitterIcon } from '@hugeicons/core-free-icons'

const columns = [
  {
    title: 'Solutions',
    links: [
      { label: 'Retail Jewellers', href: '/features' },
      { label: 'Repairs & Workshop', href: '/features' },
      { label: 'Bespoke Orders', href: '/features' },
      { label: 'Multi-Store Groups', href: '/features' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Security', href: '/security' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Migration', href: '/contact' },
      { label: 'Verify Passport', href: '/verify' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
]

const socials = [
  { icon: InstagramIcon, label: 'Instagram' },
  { icon: Facebook01Icon, label: 'Facebook' },
  { icon: Linkedin01Icon, label: 'LinkedIn' },
  { icon: NewTwitterIcon, label: 'Twitter' },
]

export default function LandingFooter() {
  return (
    <footer className="bg-white border-t border-black/[0.06] pt-12 pb-10 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        {/* Logo */}
        <div
          className="nx-fade-in-blur text-center mb-10"
        >
          <Link
            href="/"
            className="font-serif text-[1.5rem] tracking-[0.12em] text-stone-900"
          >
            NEXPURA
          </Link>
          <p className="text-sm text-stone-500 mt-2">
            The operating system for jewellery retail, repairs, bespoke, and inventory.
          </p>
        </div>

        {/* Link columns */}
        <div
          style={{ animationDelay: '0.1s' }}
          className="nx-fade-in-blur-up grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-6 mb-10"
        >
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[0.875rem] font-medium text-stone-900 mb-3">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[0.8125rem] text-stone-500 transition-opacity duration-300 hover:opacity-60"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Social icons */}
        <div
          style={{ animationDelay: '0.25s' }}
          className="nx-fade-in-blur flex items-center justify-center gap-6"
        >
          {socials.map((social) => (
            <a
              key={social.label}
              href="#"
              className="text-stone-900 transition-opacity duration-300 hover:opacity-50"
              aria-label={social.label}
            >
              <HugeiconsIcon icon={social.icon} size={20} strokeWidth={1.5} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}

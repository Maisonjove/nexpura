import Link from 'next/link';
import { Gem } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Migration Hub', href: '/switching' },
    { label: 'POS', href: '/features#pos' },
    { label: 'Repairs & Workshop', href: '/features#repairs' },
    { label: 'Bespoke Design', href: '/features#bespoke' },
  ],
  Platform: [
    { label: 'Inventory', href: '/features#inventory' },
    { label: 'Customers', href: '/features#customers' },
    { label: 'Invoicing', href: '/features#invoices' },
    { label: 'Suppliers', href: '/features#suppliers' },
    { label: 'Analytics', href: '/features#analytics' },
    { label: 'Command Centers', href: '/features#command-center' },
  ],
  Company: [
    { label: 'Contact', href: '/contact' },
    { label: 'Book a Demo', href: '/contact' },
    { label: 'Sign In', href: '/login' },
    { label: 'Start Free Trial', href: '/signup' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-stone-950 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded bg-amber-600 flex items-center justify-center flex-shrink-0">
                <Gem size={14} className="text-white" />
              </div>
              <span className="text-white font-semibold text-sm">Nexpura</span>
            </div>
            <p className="text-sm text-stone-500 leading-relaxed max-w-xs">
              The modern operating system for jewellery businesses. Built exclusively for jewellers.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-4">{group}</p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-stone-500 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-xs text-stone-600">
            © {new Date().getFullYear()} Nexpura. All rights reserved.
          </p>
          <p className="text-xs text-stone-600">Built for jewellers, by people who care about craft.</p>
        </div>
      </div>
    </footer>
  );
}

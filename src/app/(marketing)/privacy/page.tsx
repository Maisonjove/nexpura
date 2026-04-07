import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy — Nexpura",
  description: "How Nexpura collects, uses, and protects your data.",
};

const sections = [
  {
    title: "Information We Collect",
    body: "We collect information you provide directly to us, including your name, email address, business details, and payment information when you register for or use Nexpura. We also collect business data you enter into the platform — such as inventory, customer records, repair jobs, and sales transactions — which remains yours at all times.",
  },
  {
    title: "How We Use Information",
    body: "We use your information to provide, maintain, and improve the Service; process payments; send transactional and product communications; respond to support requests; and comply with legal obligations. We do not use your business data for any purpose beyond delivering the Service to you.",
  },
  {
    title: "Data Storage & Security",
    body: "Your data is stored on Supabase infrastructure hosted in Australia (where available) with industry-standard encryption at rest and in transit. We implement appropriate technical and organisational measures to protect your data against unauthorised access, loss, or disclosure. Regular backups are performed automatically.",
  },
  {
    title: "Third-Party Services",
    body: "Nexpura uses a limited set of third-party services to operate the platform: Stripe for payment processing, Supabase for database and authentication, Vercel for application hosting, and Resend for transactional email. Each maintains their own privacy and security commitments. We do not sell or share your data with third parties for marketing purposes.",
  },
  {
    title: "Cookies",
    body: "We use cookies and similar technologies to maintain your authentication session, remember your preferences, and analyse aggregate usage patterns. Essential cookies are required for the Service to function. You can manage non-essential cookies through your browser settings.",
  },
  {
    title: "Your Rights",
    body: "You have the right to access, correct, or delete your personal data at any time. You may export your business data from within the platform. To request deletion of your account, contact us at hello@nexpura.com. We will process your request within 30 days.",
  },
  {
    title: "Data Retention",
    body: "We retain your data for as long as your account is active or as needed to provide the Service. If you cancel, your data will be retained for 90 days to allow for reactivation, after which it will be permanently deleted. Anonymised, aggregated statistical data may be retained indefinitely.",
  },
  {
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification before they take effect. The date at the top of this page indicates when the policy was last revised.",
  },
  {
    title: "Contact",
    body: "For privacy-related questions or to exercise your data rights, please contact us at hello@nexpura.com.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-20 pb-16 lg:pt-28 lg:pb-20 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <p className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6">
            Legal
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4rem)] font-normal leading-[1.08] tracking-[-0.01em] text-stone-900 mb-6">
            Privacy <em className="italic">Policy</em>
          </h1>
          <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
            Last updated &middot; March 2026
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="pb-24 lg:pb-32 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[820px] mx-auto divide-y divide-stone-200 border-y border-stone-200">
          {sections.map((s, i) => (
            <article key={s.title} className="py-10 lg:py-12">
              <div className="flex items-baseline gap-6 mb-4">
                <span className="text-sm tabular-nums text-stone-300 font-medium">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="font-serif text-2xl lg:text-[1.75rem] text-stone-900 font-normal">
                  {s.title}
                </h2>
              </div>
              <p className="text-[0.9375rem] leading-relaxed text-stone-500 pl-10">
                {s.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

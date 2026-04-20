import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Service — Nexpura",
  description: "Nexpura Terms of Service — your agreement when using the platform.",
};

const sections = [
  {
    title: "Acceptance of Terms",
    body: "By accessing or using Nexpura (\"Service\"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.",
  },
  {
    title: "Description of Service",
    body: "Nexpura is a software-as-a-service platform for jewellery businesses, providing tools for inventory management, point of sale, repairs, bespoke job management, customer relationships, invoicing, and related operations.",
  },
  {
    title: "Account Registration",
    body: "You must provide accurate and complete information when creating your account. You are responsible for maintaining the security of your account credentials and for all activities that occur under your account.",
  },
  {
    title: "Subscription and Payment",
    body: "Nexpura offers subscription plans billed monthly or annually. All payments are processed securely through Stripe. Subscriptions automatically renew unless cancelled before the renewal date. You may cancel at any time through your account settings.",
  },
  {
    title: "Data and Privacy",
    body: "Your business data remains yours. We do not sell or share your data with third parties. Data is stored securely and backed up regularly. Please review our Privacy Policy for full details on how we handle your information.",
  },
  {
    title: "Acceptable Use",
    body: "You agree to use Nexpura only for lawful business purposes. You may not use the Service to violate any applicable laws, infringe on third-party rights, or interfere with the operation of the Service.",
  },
  {
    title: "Service Availability",
    body: "We strive to maintain high availability but do not guarantee uninterrupted access. Scheduled maintenance will be communicated in advance where possible.",
  },
  {
    title: "Limitation of Liability",
    body: "To the maximum extent permitted by law, Nexpura shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the Service.",
  },
  {
    title: "Changes to Terms",
    body: "We may update these terms from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance of the new terms.",
  },
  {
    title: "Contact",
    body: "For questions about these Terms, please contact us at hello@nexpura.com.",
  },
];

export default function TermsPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-20 pb-16 lg:pt-28 lg:pb-20 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <p className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6">
            Legal
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4rem)] font-normal leading-[1.08] tracking-[-0.01em] text-stone-900 mb-6">
            Terms of <em className="italic">Service</em>
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

import Link from "next/link";
import { Calendar } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Nexpura",
  description:
    "Insights, guides, and industry news for jewellery business owners — practical advice on inventory, repairs, bespoke, and growing your store.",
  openGraph: {
    title: "Blog — Nexpura",
    description:
      "Insights and guides for jewellery business owners — practical advice on inventory, repairs, bespoke, and growth.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Nexpura",
  },
};

const posts = [
  {
    slug: "jeweller-inventory-management-guide",
    title: "The Complete Guide to Jewellery Inventory Management in 2026",
    excerpt:
      "Learn how modern jewellery businesses track precious metal stock, gemstone provenance, finished pieces, and supplier relationships — all from one platform.",
    date: "2026-03-20",
    category: "Guide",
    readTime: "8 min read",
  },
  {
    slug: "repair-workshop-efficiency",
    title: "5 Ways to Improve Your Repair Workshop Efficiency",
    excerpt:
      "From intake to collection, discover how streamlining your repair workflow can increase throughput by 40% without adding more staff.",
    date: "2026-03-15",
    category: "Operations",
    readTime: "6 min read",
  },
  {
    slug: "bespoke-commission-workflow",
    title: "Managing Bespoke Commissions Like a Pro",
    excerpt:
      "Bespoke design is where jewellers shine — and where project management gets complex. Here's how top ateliers keep commissions on track.",
    date: "2026-03-10",
    category: "Workshop",
    readTime: "5 min read",
  },
  {
    slug: "digital-jewellery-passports",
    title: "Why Digital Jewellery Passports Are the Future of Customer Loyalty",
    excerpt:
      "A jewellery passport isn't just documentation — it's a story. Learn how this new standard is transforming the post-sale relationship.",
    date: "2026-03-05",
    category: "Innovation",
    readTime: "4 min read",
  },
  {
    slug: "jewellery-pos-features",
    title: "What Your POS System Should Do (and What Most Can't)",
    excerpt:
      "Not all point-of-sale systems are created equal. Here's what POS features built for jewellers make the biggest difference on the shop floor.",
    date: "2026-02-28",
    category: "Technology",
    readTime: "7 min read",
  },
  {
    slug: "customer-crm-jewellery",
    title: "Building Lasting Customer Relationships with a Jewellery CRM",
    excerpt:
      "Your best customers keep coming back — to you. Discover how a purpose-built jewellery CRM helps you nurture those relationships systematically.",
    date: "2026-02-20",
    category: "Marketing",
    readTime: "5 min read",
  },
];

/**
 * Blog index — restyled to the marketing token system per Joey's
 * follow-up sweep (item 5/6). Content (post list, copy, slugs) is
 * preserved verbatim. Was the last marketing surface still using
 * stone-950 / amber-600 / amber-50 outside the global system.
 */
export default function BlogPage() {
  return (
    <div className="min-h-screen bg-m-ivory">
      {/* Hero — charcoal stripe, matches Switching */}
      <section className="bg-m-charcoal text-white py-24 lg:py-32 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[820px] mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-m-champagne/40 bg-m-champagne/10 text-m-champagne text-[12px] font-medium tracking-[0.18em] uppercase mb-6">
            Insights &amp; Resources
          </span>
          <h1 className="font-serif text-[42px] sm:text-[56px] lg:text-[clamp(2.75rem,5vw,4.5rem)] font-normal leading-[1.06] tracking-[-0.015em] mb-5">
            The Jeweller&apos;s <em className="italic">Journal</em>
          </h1>
          <p className="text-[16px] sm:text-[18px] text-m-champagne-soft leading-[1.55] max-w-[620px] mx-auto">
            Practical guides, industry insights, and business advice for modern jewellery professionals.
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className="py-20 lg:py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[860px] mx-auto">
          <div className="grid gap-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group bg-m-white-soft border border-m-border-soft rounded-[18px] p-[22px] sm:p-8 transition-all duration-[250ms] [transition-timing-function:var(--m-ease)] hover:-translate-y-1 hover:border-m-border-hover hover:shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className="text-[10px] font-medium text-m-charcoal bg-m-champagne-tint border border-m-champagne-soft px-2.5 py-0.5 rounded-full uppercase tracking-[0.12em]">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1.5 text-[12px] text-m-text-faint">
                    <Calendar size={12} />
                    {new Date(post.date).toLocaleDateString("en-AU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-[12px] text-m-text-faint">· {post.readTime}</span>
                </div>
                <Link href={`/blog/${post.slug}`} className="block">
                  <h2 className="font-serif text-[22px] lg:text-[24px] text-m-charcoal mb-3 leading-[1.25] group-hover:underline underline-offset-4 decoration-m-charcoal">
                    {post.title}
                  </h2>
                </Link>
                <p className="text-[15px] leading-[1.6] text-m-text-secondary mb-5">{post.excerpt}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-1.5 text-[14px] font-sans font-medium text-m-charcoal hover:underline underline-offset-4 decoration-m-charcoal"
                >
                  Read article
                  <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20 lg:py-28 bg-m-white-soft border-t border-m-border-soft px-6 sm:px-10 lg:px-20">
        <div className="max-w-[560px] mx-auto text-center">
          <h2 className="font-serif text-[28px] lg:text-[36px] text-m-charcoal mb-3 leading-[1.2]">
            Stay in the loop
          </h2>
          <p className="text-[16px] text-m-text-secondary mb-8 leading-[1.6]">
            Get practical jewellery business insights delivered to your inbox — no fluff, just actionable advice.
          </p>
          <form
            className="flex flex-col sm:flex-row gap-3 max-w-[480px] mx-auto"
            action="https://nexpura.com/api/contact"
            method="post"
            noValidate
          >
            <input
              type="email"
              name="email"
              placeholder="Your email address"
              required
              className="m-form-input flex-1"
            />
            <button
              type="submit"
              className="h-[54px] px-7 rounded-full bg-m-charcoal text-white text-[15px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:bg-m-charcoal-soft hover:shadow-[0_6px_16px_rgba(0,0,0,0.18)] transition-all duration-200 [transition-timing-function:var(--m-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne focus-visible:ring-offset-2"
            >
              Subscribe
            </button>
          </form>
          <p className="text-[12px] text-m-text-faint mt-4 tracking-[0.05em]">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* Back to site */}
      <section className="py-10 border-t border-m-border-soft px-6">
        <div className="max-w-[860px] mx-auto text-center">
          <Link
            href="/"
            className="text-[14px] text-m-text-secondary hover:text-m-charcoal transition-colors font-medium"
          >
            ← Back to Nexpura
          </Link>
        </div>
      </section>
    </div>
  );
}

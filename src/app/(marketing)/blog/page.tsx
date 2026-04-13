import Link from "next/link";
import { Gem, Calendar, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Nexpura",
  description: "Insights, guides, and industry news for jewellery business owners. Learn how to grow your jewellery business with Nexpura.",
};

const posts = [
  {
    slug: "jeweller-inventory-management-guide",
    title: "The Complete Guide to Jewellery Inventory Management in 2026",
    excerpt: "Learn how modern jewellery businesses track precious metal stock, gemstone provenance, finished pieces, and supplier relationships — all from one platform.",
    date: "2026-03-20",
    category: "Guide",
    readTime: "8 min read",
  },
  {
    slug: "repair-workshop-efficiency",
    title: "5 Ways to Improve Your Repair Workshop Efficiency",
    excerpt: "From intake to collection, discover how streamlining your repair workflow can increase throughput by 40% without adding more staff.",
    date: "2026-03-15",
    category: "Operations",
    readTime: "6 min read",
  },
  {
    slug: "bespoke-commission-workflow",
    title: "Managing Bespoke Commissions Like a Pro",
    excerpt: "Bespoke design is where jewellers shine — and where project management gets complex. Here's how top ateliers keep commissions on track.",
    date: "2026-03-10",
    category: "Workshop",
    readTime: "5 min read",
  },
  {
    slug: "digital-jewellery-passports",
    title: "Why Digital Jewellery Passports Are the Future of Customer Loyalty",
    excerpt: "A jewellery passport isn't just documentation — it's a story. Learn how this new standard is transforming the post-sale relationship.",
    date: "2026-03-05",
    category: "Innovation",
    readTime: "4 min read",
  },
  {
    slug: "jewellery-pos-features",
    title: "What Your POS System Should Do (and What Most Can't)",
    excerpt: "Not all point-of-sale systems are created equal. Here's what POS features built for jewellers make the biggest difference on the shop floor.",
    date: "2026-02-28",
    category: "Technology",
    readTime: "7 min read",
  },
  {
    slug: "customer-crm-jewellery",
    title: "Building Lasting Customer Relationships with a Jewellery CRM",
    excerpt: "Your best customers keep coming back — to you. Discover how a purpose-built jewellery CRM helps you nurture those relationships systematically.",
    date: "2026-02-20",
    category: "Marketing",
    readTime: "5 min read",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-stone-950 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-600/30 bg-amber-600/10 text-amber-400 text-xs font-medium mb-8">
            <Gem size={12} />
            Insights &amp; Resources
          </div>
          <h1 className="text-5xl font-semibold tracking-tight leading-tight mb-6">
            The Jeweller&apos;s Journal
          </h1>
          <p className="text-lg text-stone-400 max-w-2xl mx-auto leading-relaxed">
            Practical guides, industry insights, and business advice for modern jewellery professionals.
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid gap-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group bg-white border border-stone-200 rounded-2xl p-8 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wider">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-stone-400">
                    <Calendar size={12} />
                    {new Date(post.date).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                  <span className="text-xs text-stone-400">· {post.readTime}</span>
                </div>
                <Link href={`/blog/${post.slug}`} className="block">
                  <h2 className="text-xl font-semibold text-stone-900 mb-3 group-hover:text-amber-700 transition-colors">
                    {post.title}
                  </h2>
                </Link>
                <p className="text-stone-500 text-sm leading-relaxed mb-4">{post.excerpt}</p>
                <Link href={`/blog/${post.slug}`} className="flex items-center gap-1.5 text-sm font-medium text-amber-700 group-hover:gap-3 transition-all">
                  Read article <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20 bg-stone-50 border-t border-stone-200">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold text-stone-900 mb-3">Stay in the loop</h2>
          <p className="text-stone-500 mb-8 text-sm leading-relaxed">
            Get practical jewellery business insights delivered to your inbox — no fluff, just actionable advice.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <button className="px-6 py-3 bg-amber-600 text-white rounded-xl font-medium text-sm hover:bg-amber-700 transition-colors">
              Subscribe
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-4">No spam. Unsubscribe anytime.</p>
        </div>
      </section>

      {/* Back to site */}
      <section className="py-10 bg-white border-t border-stone-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Link href="/" className="text-sm text-stone-500 hover:text-amber-700 transition-colors font-medium">
            ← Back to Nexpura
          </Link>
        </div>
      </section>
    </div>
  );
}

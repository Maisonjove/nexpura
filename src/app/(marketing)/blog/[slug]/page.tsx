import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Tag, Share2 } from "lucide-react";
import type { Metadata } from "next";

const posts = [
  {
    slug: "jeweller-inventory-management-guide",
    title: "The Complete Guide to Jewellery Inventory Management in 2026",
    excerpt: "Learn how modern jewellery businesses track precious metal stock, gemstone provenance, finished pieces, and supplier relationships — all from one platform.",
    date: "2026-03-20",
    category: "Guide",
    readTime: "8 min read",
    author: "Nexpura Team",
    content: `
Managing inventory in a jewellery business is unlike any other retail sector. You're dealing with precious metals whose value fluctuates daily, gemstones with unique provenance stories, handcrafted pieces where no two are exactly alike, and an intricate web of supplier relationships spanning continents.

## Why Standard Inventory Systems Fall Short

Most off-the-shelf inventory software was designed for businesses selling identical, repeatable products. A SKU maps to a description, a quantity, and a price. Simple. But jewellery doesn't work that way.

A single diamond ring might have:
- Metal type and purity (18ct yellow gold)
- Stone details (0.75ct H/SI1 round brilliant)
- Supplier certificate number
- Acquisition cost in foreign currency
- Insurance valuation separate from retail price
- Provenance documentation

Standard systems can't capture this nuance. When you force jewellery into a generic inventory tool, you lose the details that matter — the ones that justify premium pricing and build customer trust.

## The Core Components of Jewellery Inventory Management

### 1. Item Identity and Description
Every piece needs a unique identity that captures what makes it valuable. This goes beyond a simple description to include:
- Metal specifications (type, purity, weight)
- Stone details (type, carat, cut, colour, clarity for diamonds)
- Manufacturer or artisan details
- Country of origin where relevant
- Any hallmarks or certifications

### 2. Cost Tracking
The cost of a jewellery item isn't static. Precious metal prices move with the market. Labour costs vary. When you buy a parcel of stones, you need to allocate cost across individual pieces.

Modern jewellery inventory systems should track:
- Original acquisition cost
- Current replacement cost
- Metal value based on live spot prices
- Total landed cost including freight and duties

### 3. Location and Status
Where is each piece right now? Is it in the display case, in the workshop being sized, on memo with a client, or on consignment with another retailer? Status tracking prevents pieces from disappearing into the void.

### 4. Movement History
Every time a piece moves — from supplier to stock, from stock to workshop, from workshop to display, from display to sale — that should be recorded. This audit trail is invaluable for insurance purposes and for understanding your business.

## Setting Up Your Inventory System

The key to good inventory management is consistency. Decide on your naming conventions, your category structure, and your data fields before you start entering items. Then stick to them.

Start with your physical count. This is the painful part — going through every drawer, every cabinet, every corner of the workshop. But it's the foundation everything else builds on.

Once you have accurate stock counts, focus on the financial data. Getting your costs right matters more than perfect descriptions. You can always add better photos later; if your costs are wrong, every margin analysis will mislead you.

## The ROI of Good Inventory Management

Businesses that invest in proper jewellery inventory management consistently see:
- **Reduced stock shrinkage** through better tracking
- **Higher sell-through rates** because you know what's sitting unsold
- **Better buying decisions** because you understand what sells
- **Faster insurance claims** because documentation is complete
- **Improved customer confidence** because you can answer questions with certainty

The investment in a purpose-built system pays for itself within months in most jewellery businesses.
    `.trim(),
  },
  {
    slug: "repair-workshop-efficiency",
    title: "5 Ways to Improve Your Repair Workshop Efficiency",
    excerpt: "From intake to collection, discover how streamlining your repair workflow can increase throughput by 40% without adding more staff.",
    date: "2026-03-15",
    category: "Operations",
    readTime: "6 min read",
    author: "Nexpura Team",
    content: `
Your repair workshop is the engine room of your jewellery business. For many independent jewellers, repairs provide the reliable revenue base that supports everything else. Yet most workshops operate well below their potential throughput — not because the craftspeople are slow, but because the processes around them are inefficient.

## The Hidden Time Thieves

Before we talk about what to improve, let's identify where time actually goes in a typical repair workflow:

- **Intake**: Writing up job tickets, often by hand, sometimes illegibly
- **Communication**: Phone calls to ask "is my ring ready yet?"
- **Searching**: "Where is job #847? I put it somewhere..."
- **Approval bottlenecks**: Waiting for customer sign-off before proceeding
- **Collection friction**: Finding the completed job, processing payment

In many workshops, the actual repair work is only 40-50% of the time spent on a job. The rest is administration.

## 1. Digital Job Tickets from the Start

Paper job tickets are the enemy of efficiency. They get lost, they're hard to read, they can't be searched, and they don't update automatically when a job moves through the workshop.

A digital system lets you capture repair details at intake — with photos — and instantly generate a reference number the customer can use to track their job. Photos are particularly important: they document the item's condition before work begins, protecting you from "this scratch was already there" disputes.

## 2. Automated SMS/Email Updates

The number one reason customers call about repairs is uncertainty. They don't know when to expect their item. They're anxious about something valuable they've left with a stranger.

Automated notifications at key stages — "Your repair has been received", "Work is underway", "Your repair is ready for collection" — dramatically reduce inbound calls. One jeweller we worked with reduced repair-related phone calls by 70% after implementing automated notifications.

## 3. Visual Workshop Board

A digital workshop board showing all active jobs, their status, and their due dates gives your team a shared view of what needs doing. No more sticky notes. No more "whose job is this?" No more items sitting finished for a week because no one noticed.

## 4. Clear Pricing Structure

Vague pricing creates friction at every stage. If your bench jeweller has to check with you before quoting a ring sizing, that's a delay. If customers get a different price than they expected at collection, that's a dispute.

Documenting your standard repair prices and enabling your team to quote confidently at intake saves time and builds trust.

## 5. Collection Preparation Workflow

The collection step should be frictionless. When a customer arrives, you should be able to:
1. Find their job immediately (by name, phone number, or job number)
2. See exactly what work was done and the agreed price
3. Process payment and provide a receipt
4. Hand over the item confidently

This sounds obvious, but many workshops still have customers waiting while staff search through bags of completed jobs.

## Measuring Your Improvement

Start tracking your workshop metrics before you make changes. Key numbers to watch:
- Average days from intake to completion
- Jobs past due date (as % of active jobs)
- Inbound phone calls per week
- Customer satisfaction scores at collection

You can't improve what you don't measure.
    `.trim(),
  },
  {
    slug: "bespoke-commission-workflow",
    title: "Managing Bespoke Commissions Like a Pro",
    excerpt: "Bespoke design is where jewellers shine — and where project management gets complex. Here's how top ateliers keep commissions on track.",
    date: "2026-03-10",
    category: "Workshop",
    readTime: "5 min read",
    author: "Nexpura Team",
    content: `
Bespoke jewellery is where craft meets collaboration. When a client trusts you to create something unique — an engagement ring, a piece to mark a milestone, a family heirloom reimagined — the stakes are high. The work must be exceptional. But exceptional craft alone isn't enough; the experience of creating something bespoke must also be exceptional.

## The Bespoke Journey

Every bespoke commission follows a similar arc:
1. **Initial consultation**: Understanding the client's vision, budget, and timeline
2. **Design**: Sketches, CAD renders, or both
3. **Client approval**: Sign-off before any metal is committed
4. **Material sourcing**: Finding the right stones, ordering metal
5. **Manufacture**: The actual crafting
6. **Quality check**: Ensuring the piece meets specifications
7. **Final presentation**: The handover moment

Each of these stages requires clear communication, documentation, and client sign-off. Where bespoke projects go wrong is almost always in communication — unclear expectations, unapproved changes, surprise costs.

## The Approval Paper Trail

Before any money is spent on materials, you need written client approval. This protects you and protects the client. It answers the question "did we agree to this?" with evidence rather than memory.

Your approval documentation should capture:
- Design description or render
- Metal specifications and estimated weight
- Stone specifications and estimated cost
- Total price and payment schedule
- Expected completion date
- What happens if the client changes their mind

Getting this signed off — digitally or physically — before proceeding is non-negotiable for serious bespoke work.

## Managing the Timeline

Bespoke pieces take time. Clients often underestimate this. Setting realistic expectations at the outset is crucial.

Build your timeline with milestones:
- Design approval: [date]
- Material sourcing complete: [date]
- Workshop start: [date]
- Initial fitting (if applicable): [date]
- Completion target: [date]
- Final handover: [date]

Sharing this timeline with the client sets expectations. Updating them at each milestone keeps them engaged and reduces anxiety.

## Photography Throughout

Photographing the piece at each major stage does several things:
- Creates a record of the manufacturing process
- Gives clients the "behind the scenes" content they love
- Documents any pre-existing conditions in source materials
- Makes for compelling marketing content with client permission

The story of how a piece was made is often as valuable to the client as the piece itself.
    `.trim(),
  },
  {
    slug: "digital-jewellery-passports",
    title: "Why Digital Jewellery Passports Are the Future of Customer Loyalty",
    excerpt: "A jewellery passport isn't just documentation — it's a story. Learn how this new standard is transforming the post-sale relationship.",
    date: "2026-03-05",
    category: "Innovation",
    readTime: "4 min read",
    author: "Nexpura Team",
    content: `
When someone buys a piece of jewellery, they're not just buying an object. They're buying a story — of craftsmanship, of provenance, of meaning. A digital jewellery passport extends that story indefinitely, becoming a living record of a piece's history that grows richer over time.

## What Is a Jewellery Passport?

A digital jewellery passport is a permanent record associated with a specific piece that captures:
- The original purchase details (date, price, retailer)
- Metal and stone specifications
- Provenance documentation
- Photographs
- Insurance valuation history
- Service and repair history
- Any modifications made over the years

Think of it as the piece's birth certificate, service history, and autobiography combined.

## Why Customers Love Them

For customers, a jewellery passport provides:

**Peace of mind**: If a piece is lost or stolen, the passport provides documentation for insurance claims that's far more reliable than memory.

**Provenance confidence**: For stones with ethical sourcing requirements, the passport provides the documentation chain.

**Service continuity**: When a piece needs resizing or repair years later, the craftsperson can see exactly what it's made of and how it's been cared for.

**Legacy documentation**: Jewellery is often passed between generations. A passport gives the recipient context and meaning.

## Why Jewellers Benefit

For the jewellery business, passports create a touchpoint that extends the relationship far beyond the initial sale:

**Service reminders**: The passport enables you to reach out when service is due — "Your sapphire ring is 18 months old, it's time for its first professional clean."

**Upgrade opportunities**: When a client comes in for their anniversary, their passport shows what they own and what might complement it.

**Repeat business**: Clients who feel cared for come back. The passport is a tangible expression of care.

**Referrals**: A client who has a passport loves showing it to friends. It's a conversation starter that showcases your service standard.

## Getting Started with Passports

You don't need to issue passports for every item you've ever sold. Start with new sales and bespoke commissions going forward. The data is easy to capture at point of sale; retrofitting it for historical purchases is much harder.

Make the passport presentation part of your handover ritual. When a client collects their purchase, show them their passport. Walk them through what it contains. Explain that it will grow richer over time. This moment transforms a transaction into a relationship.
    `.trim(),
  },
  {
    slug: "jewellery-pos-features",
    title: "What Your POS System Should Do (and What Most Can't)",
    excerpt: "Not all point-of-sale systems are created equal. Here's what POS features built for jewellers make the biggest difference on the shop floor.",
    date: "2026-02-28",
    category: "Technology",
    readTime: "7 min read",
    author: "Nexpura Team",
    content: `
Walk into most jewellery stores and you'll find a generic retail POS system that was designed for selling t-shirts or coffee. It works, after a fashion — but it misses so much of what makes jewellery retail distinctive.

## The Jewellery POS Difference

A POS system built for jewellers understands that:
- Each item is often unique (one of a kind or very limited)
- Prices include precious metal value that fluctuates
- Sales often involve trade-ins, layby, or custom work
- Customer relationships matter enormously
- Staff need product knowledge support on the floor

Let's look at what this means in practice.

## Client History at Point of Sale

When a customer approaches the counter, your staff should be able to pull up their complete history in seconds: what they've bought, what they've had repaired, their preferences, any special dates, their budget patterns. This context transforms a transaction into a conversation.

Generic POS systems show you purchase history. Jewellery POS shows you the relationship.

## Flexible Payment Options

Jewellery purchases often involve non-standard payment arrangements:
- **Layby**: Customer pays in instalments, collects when paid off
- **Trade-in credit**: Customer exchanges existing jewellery toward a purchase
- **Split payment**: Part cash, part card, maybe part voucher
- **Finance**: Third-party buy-now-pay-later integration

Your POS needs to handle all of these cleanly, with clear documentation of the arrangement and what's owed.

## Inventory Integration

A jewellery POS should connect directly to your inventory. When a piece sells, it should automatically update stock levels. When you're looking at an item on the floor, you should be able to see its complete record — its cost, its margin, its history.

## Workshop Connections

Sales often generate workshop work. A customer buys a ring that needs sizing. A repair is completed and needs to be invoiced. Your POS and workshop systems should be connected, not separate silos.

## What to Look For

When evaluating POS systems, ask:
- Can it handle layby with partial payments?
- Does it connect to my inventory system?
- Can I pull up customer history during a sale?
- Does it support trade-in transactions?
- Can it generate repair tickets from the sale screen?
- Does it handle multiple payment methods per transaction?

If the answer to any of these is "no" or "sort of", you're looking at a system that will create workarounds and frustrations.
    `.trim(),
  },
  {
    slug: "customer-crm-jewellery",
    title: "Building Lasting Customer Relationships with a Jewellery CRM",
    excerpt: "Your best customers keep coming back — to you. Discover how a purpose-built jewellery CRM helps you nurture those relationships systematically.",
    date: "2026-02-20",
    category: "Marketing",
    readTime: "5 min read",
    author: "Nexpura Team",
    content: `
The best jewellery businesses aren't built on transactions — they're built on relationships. A customer who buys an engagement ring from you, gets their anniversary jewellery from you, and brings in pieces for cleaning and repairs year after year is worth many times more than a one-time buyer. The question is: how do you systematically build that kind of relationship at scale?

## The Relationship Memory Problem

In a small jewellery business, the owner knows every customer personally. They remember birthdays, anniversaries, preferences, allergies (yes, some people are allergic to certain metals), family situations. This personal knowledge creates a warm, consultative experience that customers love and value.

But as the business grows, this personal memory can't scale. Staff turn over. The owner can't be everywhere. Details get lost. Customers who felt like family start to feel like strangers.

A jewellery CRM is a system that preserves and shares this relationship knowledge across your whole team, regardless of scale.

## What a Jewellery CRM Should Capture

**Demographics and contact information** — the basics.

**Purchase history** — every piece they've bought, when, at what price, for what occasion.

**Service history** — every repair, cleaning, resize, revaluation.

**Preferences** — metal preferences, stone preferences, style notes.

**Important dates** — birthday, anniversary, children's birthdays for gift-giving occasions.

**Communication history** — what you've sent them, what they've responded to.

**Lifetime value** — total spend, average transaction, visit frequency.

## Using CRM Data for Better Service

The most immediate use of CRM data is at the point of sale. When a customer walks in, your team can pull up their record and see everything relevant. This enables them to:
- Greet the customer by name with genuine context ("Did that ring you bought your mother in March go down well?")
- Make relevant suggestions based on history
- Handle requests confidently ("Your ring is 18ct white gold — I can see that in your purchase record")

## Proactive Outreach

CRM data enables you to reach out proactively rather than waiting for customers to come to you:
- Birthday messages with a special offer
- Anniversary reminders ("It's been a year since the engagement ring — have you thought about an anniversary band?")
- Service reminders ("Your pearls need re-stringing every 12-18 months — yours are due")
- New arrival alerts for customers who love a particular style

Done well, this isn't marketing — it's service. Customers appreciate being thought of.

## Getting Started

Start by auditing what customer data you currently have. It's almost certainly scattered across your POS system, a spreadsheet or two, email threads, and staff memories. Consolidating this into a single system is the first step.

Then focus on consistently capturing new interactions. Every purchase, every service, every visit should add to the record. Over time, you'll build a rich picture of each customer relationship.

The competitive advantage of excellent customer relationships can't be easily copied by competitors. It's built slowly and is deeply personal to your business.
    `.trim(),
  },
];

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return { title: "Post Not Found — Nexpura Blog" };

  return {
    title: `${post.title} — Nexpura Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: ["/og-image.png"],
    },
  };
}

export async function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const relatedPosts = posts.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-m-ivory">
      {/* Hero */}
      <section className="bg-m-charcoal text-white py-24 lg:py-32 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[820px] mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-m-champagne-soft hover:text-m-champagne text-[14px] mb-8 transition-colors duration-200"
          >
            <ArrowLeft size={14} />
            Back to blog
          </Link>
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="text-[10px] font-medium text-m-charcoal bg-m-champagne-tint border border-m-champagne-soft px-2.5 py-0.5 rounded-full uppercase tracking-[0.12em]">
              {post.category}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-m-champagne-soft">
              <Calendar size={12} />
              {new Date(post.date).toLocaleDateString("en-AU", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-m-champagne-soft">
              <Clock size={12} />
              {post.readTime}
            </span>
          </div>
          <h1 className="font-serif text-[36px] sm:text-[44px] lg:text-[clamp(2.25rem,4vw,3.5rem)] font-normal leading-[1.1] tracking-[-0.015em] mb-6">
            {post.title}
          </h1>
          <p className="text-[16px] sm:text-[18px] text-m-champagne-soft leading-[1.55]">{post.excerpt}</p>
          <div className="mt-6 text-[14px] text-m-champagne-soft">By {post.author}</div>
        </div>
      </section>

      {/* Content + Sidebar */}
      <section className="py-16 lg:py-24 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Article content */}
          <article className="lg:col-span-2 max-w-none">
            {post.content.split("\n\n").map((block, i) => {
              if (block.startsWith("## ")) {
                return (
                  <h2
                    key={i}
                    className="font-serif text-[24px] lg:text-[28px] text-m-charcoal mt-10 mb-3 leading-[1.25] font-medium"
                  >
                    {block.replace("## ", "")}
                  </h2>
                );
              }
              if (block.startsWith("### ")) {
                return (
                  <h3
                    key={i}
                    className="font-sans font-semibold text-[18px] text-m-charcoal mt-7 mb-2"
                  >
                    {block.replace("### ", "")}
                  </h3>
                );
              }
              if (block.startsWith("- ")) {
                const items = block.split("\n").filter((l) => l.startsWith("- "));
                return (
                  <ul
                    key={i}
                    className="list-disc list-outside ml-5 space-y-1.5 text-m-text-secondary text-[15px] leading-[1.65] my-4"
                  >
                    {items.map((item, j) => (
                      <li key={j}>
                        {item.replace(/^- \*\*(.*?)\*\*:/, (_, m) => `${m}:`).replace("- ", "")}
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={i} className="text-m-text-secondary leading-[1.65] text-[15px] my-4">
                  {block}
                </p>
              );
            })}
          </article>

          {/* Sidebar */}
          <aside className="space-y-8">
            {/* Share */}
            <div className="bg-m-white-soft rounded-[18px] p-6 border border-m-border-soft">
              <div className="flex items-center gap-2 mb-4 text-[14px] font-semibold text-m-charcoal">
                <Share2 size={14} />
                Share this article
              </div>
              <div className="space-y-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://nexpura.com/blog/${post.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2.5 bg-m-charcoal text-white text-[13px] rounded-full font-medium hover:bg-m-charcoal-soft transition-colors duration-200"
                >
                  Share on X / Twitter
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://nexpura.com/blog/${post.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2.5 bg-transparent border border-m-charcoal text-m-charcoal text-[13px] rounded-full font-medium hover:bg-m-champagne-tint transition-colors duration-200"
                >
                  Share on LinkedIn
                </a>
              </div>
            </div>

            {/* Related posts */}
            <div>
              <div className="flex items-center gap-2 mb-4 text-[14px] font-semibold text-m-charcoal">
                <Tag size={14} />
                Related articles
              </div>
              <div className="space-y-3">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="block p-4 bg-m-white-soft border border-m-border-soft rounded-[14px] hover:border-m-border-hover hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200"
                  >
                    <span className="text-[10px] font-medium text-m-charcoal uppercase tracking-[0.12em] bg-m-champagne-tint border border-m-champagne-soft px-2 py-0.5 rounded-full inline-block">
                      {related.category}
                    </span>
                    <p className="text-[14px] font-medium text-m-charcoal mt-2 leading-[1.35]">
                      {related.title}
                    </p>
                    <p className="text-[12px] text-m-text-faint mt-1">{related.readTime}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-m-charcoal text-white rounded-[18px] p-6">
              <h3 className="font-serif text-[20px] mb-2 leading-[1.25]">Try Nexpura free</h3>
              <p className="text-[13px] text-m-champagne-soft mb-5 leading-[1.55]">
                The all-in-one platform for modern jewellery businesses.
              </p>
              <Link
                href="/signup"
                className="block w-full text-center px-4 py-3 bg-white text-m-charcoal text-[14px] rounded-full font-semibold hover:bg-m-champagne-tint transition-colors duration-200"
              >
                Start free trial
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Back */}
      <section className="py-10 bg-m-white-soft border-t border-m-border-soft">
        <div className="max-w-[820px] mx-auto px-6 text-center">
          <Link
            href="/blog"
            className="text-[14px] text-m-text-secondary hover:text-m-charcoal transition-colors font-medium"
          >
            ← Back to The Jeweller&apos;s Journal
          </Link>
        </div>
      </section>
    </div>
  );
}

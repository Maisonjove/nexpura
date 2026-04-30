import type { Template, TemplatePage, TemplateSection } from "./types";

/**
 * Phase 1 catalogue of 10 jewellery website templates.
 *
 * Copy tone: premium jewellery industry. No full stops on headings.
 * No AI-sounding filler. Each template differs in palette, typography,
 * section ordering and copy register.
 */

// ───────────────────────────────────────────────────────────────────────────
// Helpers — shared placeholder pieces so layouts feel polished but stay light
// ───────────────────────────────────────────────────────────────────────────

const galleryItems = (label: string) => [
  { name: `${label} I`, caption: "From the archive" },
  { name: `${label} II`, caption: "Hand-finished" },
  { name: `${label} III`, caption: "Limited edition" },
  { name: `${label} IV`, caption: "Made to order" },
  { name: `${label} V`, caption: "House signature" },
  { name: `${label} VI`, caption: "Studio favourite" },
];

const collectionItems = [
  { name: "Engagement", caption: "Solitaires, halos, three-stones" },
  { name: "Wedding Bands", caption: "Plain, channel-set, eternity" },
  { name: "Fine Jewellery", caption: "Earrings, pendants, bracelets" },
  { name: "Bespoke", caption: "Designed entirely around you" },
];

// ───────────────────────────────────────────────────────────────────────────
// 1. Luxury Boutique
// ───────────────────────────────────────────────────────────────────────────

const luxuryBoutiqueHome: TemplatePage = {
  slug: "home",
  title: "Home",
  type: "home",
  metaTitle: "Luxury Boutique — Fine Jewellery",
  metaDescription:
    "An independent boutique for the collector. Diamonds, signed pieces and bespoke commissions, served with discretion.",
  sections: [
    {
      type: "hero",
      content: {
        heading: "Quietly extraordinary",
        subheading:
          "An independent boutique for the considered collector. Signed pieces, rare stones and private commissions",
        cta_text: "Book a private viewing",
        cta_url: "/contact",
        overlay_opacity: 0.55,
        eyebrow: "Established 1972",
      },
      styles: { background_color: "#0d0d0d", text_color: "#f7f3ea" },
    },
    {
      type: "image_text",
      content: {
        heading: "The boutique",
        body:
          "Set on a quiet stretch of Mount Street, the boutique receives clients by appointment. Every piece is selected, set and finished in-house — most are seen by only one or two people before they leave with you.",
        image_side: "left",
        cta_text: "Plan your visit",
        cta_url: "/contact",
      },
    },
    {
      type: "collection_grid",
      content: {
        heading: "Houses we work with",
        subheading: "A curated rotation of the world's signed jewellery makers",
        columns: 4,
        placeholderItems: [
          { name: "Cartier", caption: "Signed, period and contemporary" },
          { name: "Van Cleef & Arpels", caption: "Estate, signed examples" },
          { name: "Bulgari", caption: "Selected high jewellery" },
          { name: "House Atelier", caption: "Designed in-house" },
        ],
      },
      styles: { background_color: "#f7f3ea" },
    },
    {
      type: "gallery",
      content: {
        heading: "Currently in the boutique",
        subheading: "A small selection, refreshed weekly",
        columns: 3,
        placeholderItems: galleryItems("Solitaire"),
      },
    },
    {
      type: "testimonials",
      content: {
        heading: "Trusted across three generations",
        items: [
          {
            quote:
              "We have bought from the boutique for thirty years. Discretion, judgement and an absolute eye.",
            author: "Mrs A.K., London",
          },
          {
            quote:
              "They sourced a stone that no one else could find. Quietly, and at the right price.",
            author: "Mr R.S., Geneva",
          },
          {
            quote: "The most thoughtful jeweller I have worked with.",
            author: "Lady V.M., New York",
          },
        ],
      },
      styles: { background_color: "#0d0d0d", text_color: "#f7f3ea" },
    },
    {
      type: "text",
      content: {
        heading: "By appointment",
        body:
          "We see one client at a time. To arrange a private viewing, please write or call — we shall reply within the working day.",
        alignment: "center",
        cta_text: "Request an appointment",
        cta_url: "/contact",
      },
    },
  ],
};

const luxuryBoutique: Template = {
  id: "luxury-boutique",
  name: "Luxury Boutique",
  description:
    "Editorial, restrained, by-appointment. Built for high-end independent jewellers and signed-piece dealers.",
  bestFor:
    "High-end independent jewellers, premium diamond boutiques and signed-piece specialists",
  styleKeywords: ["Editorial", "Champagne gold", "By appointment", "Discreet"],
  palette: { primary: "#c9a96e", secondary: "#0d0d0d", accent: "#f7f3ea" },
  typography: { heading: "Playfair Display", body: "Inter" },
  pages: [
    luxuryBoutiqueHome,
    {
      slug: "collections",
      title: "Collections",
      type: "custom",
      metaTitle: "Collections",
      metaDescription: "Curated rotations and house signatures.",
      sections: [
        {
          type: "hero",
          content: { heading: "Collections", subheading: "Rotated, never replicated" },
          styles: { background_color: "#0d0d0d", text_color: "#f7f3ea" },
        },
        {
          type: "collection_grid",
          content: { columns: 3, placeholderItems: collectionItems },
        },
      ],
    },
    {
      slug: "bespoke",
      title: "Bespoke",
      type: "custom",
      metaTitle: "Bespoke commissions",
      metaDescription: "Private commissions, made to order.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "Bespoke",
            subheading: "Commissioned with you, signed by us",
          },
        },
        {
          type: "text",
          content: {
            heading: "How a commission moves",
            body:
              "We meet, we listen, we sketch. Stones are sourced over the following weeks. A wax model is shown to you. Once approved, the piece is set in our workshop and finished by hand.",
            alignment: "left",
          },
        },
        { type: "enquiry_form", content: { heading: "Begin a commission" } },
      ],
    },
    {
      slug: "engagement-rings",
      title: "Engagement Rings",
      type: "custom",
      metaTitle: "Engagement rings",
      metaDescription: "Solitaires, halos and three-stones, set in our workshop.",
      sections: [
        {
          type: "hero",
          content: { heading: "Engagement rings", subheading: "A piece for the rest of a life" },
        },
        {
          type: "gallery",
          content: { columns: 3, placeholderItems: galleryItems("Engagement") },
        },
        { type: "appointment_form", content: { heading: "Book a viewing" } },
      ],
    },
    {
      slug: "about",
      title: "About",
      type: "about",
      metaTitle: "About",
      metaDescription: "Three generations on Mount Street.",
      sections: [
        { type: "hero", content: { heading: "About the boutique" } },
        {
          type: "text",
          content: {
            body:
              "We opened in 1972 in a townhouse off Berkeley Square. Two of the three founding partners are still here. We answer the door ourselves, we know our regulars by name, and we stay small on purpose.",
            alignment: "left",
          },
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      type: "contact",
      metaTitle: "Contact",
      metaDescription: "By appointment.",
      sections: [
        { type: "hero", content: { heading: "Visit by appointment" } },
        { type: "contact_form", content: { heading: "Write to us" } },
      ],
    },
  ],
  nav: [
    { label: "Collections", slug: "collections" },
    { label: "Bespoke", slug: "bespoke" },
    { label: "Engagement", slug: "engagement-rings" },
    { label: "About", slug: "about" },
    { label: "Contact", slug: "contact" },
  ],
  footer: {
    copy: "By appointment, six days a week",
    columns: [
      {
        heading: "The Boutique",
        links: [
          { label: "Collections", href: "/collections" },
          { label: "Bespoke", href: "/bespoke" },
          { label: "About", href: "/about" },
        ],
      },
      {
        heading: "Visit",
        links: [
          { label: "Mount Street", href: "/contact" },
          { label: "Private viewing", href: "/contact" },
        ],
      },
    ],
  },
  seo: {
    title: "Luxury Boutique — Fine jewellery, by appointment",
    description:
      "An independent boutique for the considered collector. Signed pieces, rare stones and private commissions.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #0d0d0d 0%, #2a2a2a 55%, #c9a96e 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 2. Engagement Ring Studio
// ───────────────────────────────────────────────────────────────────────────

const engagementStudio: Template = {
  id: "engagement-ring-studio",
  name: "Engagement Ring Studio",
  description:
    "A bridal-first studio. Soft, romantic and bright — built for couples shopping for the one ring.",
  bestFor: "Bridal-focused jewellers and engagement ring specialists",
  styleKeywords: ["Bridal", "Romantic", "Soft palette", "Bright"],
  palette: { primary: "#c89b8a", secondary: "#3b2a25", accent: "#fdf6f1" },
  typography: { heading: "Cormorant Garamond", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Engagement Ring Studio",
      metaDescription:
        "Engagement rings, wedding bands and custom designs — fitted, sized and signed in our studio.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "The ring you've been picturing",
            subheading:
              "Designed with you, set in our studio, ready in four to six weeks",
            cta_text: "Book a fitting",
            cta_url: "/book-appointment",
            eyebrow: "Engagement ring studio",
            overlay_opacity: 0.25,
          },
          styles: { background_color: "#fdf6f1", text_color: "#3b2a25" },
        },
        {
          type: "collection_grid",
          content: {
            heading: "Find your shape",
            subheading: "Most clients arrive with a feeling, not a sketch — start here",
            columns: 4,
            placeholderItems: [
              { name: "Round", caption: "Brilliant and timeless" },
              { name: "Oval", caption: "Elongating, modern classic" },
              { name: "Cushion", caption: "Soft, romantic outline" },
              { name: "Emerald", caption: "Sharp, architectural" },
            ],
          },
        },
        {
          type: "image_text",
          content: {
            heading: "Try on, before you decide",
            body:
              "Every appointment includes a tray of try-on samples in your shape and size. No pressure, no commission — just an honest hour with someone who knows what they're doing.",
            image_side: "right",
            cta_text: "Book a private fitting",
            cta_url: "/book-appointment",
          },
          styles: { background_color: "#fdf6f1" },
        },
        {
          type: "gallery",
          content: {
            heading: "Recently set",
            subheading: "A small portfolio from the studio bench",
            columns: 3,
            placeholderItems: galleryItems("Solitaire"),
          },
        },
        {
          type: "testimonials",
          content: {
            heading: "From the people who said yes",
            items: [
              {
                quote:
                  "We came in with a Pinterest board and left with something better than any of it.",
                author: "Sarah & James",
              },
              {
                quote:
                  "It fit on the first try. They knew exactly what to suggest.",
                author: "Megan & David",
              },
              {
                quote:
                  "Honest, calm, and not for one second pushy.",
                author: "Anna & Tom",
              },
            ],
          },
          styles: { background_color: "#3b2a25", text_color: "#fdf6f1" },
        },
        {
          type: "faq",
          content: {
            heading: "What couples ask first",
            items: [
              {
                q: "How long does a custom ring take",
                a: "Four to six weeks from design sign-off, including stone sourcing and setting.",
              },
              {
                q: "Can I bring my own diamond",
                a: "Yes. We're happy to set heirloom and supplied stones, with a written receipt.",
              },
              {
                q: "Do you size after delivery",
                a: "Two complimentary resizes within the first year.",
              },
            ],
          },
        },
        {
          type: "appointment_form",
          content: {
            heading: "Book a private fitting",
            subheading:
              "We see one couple at a time. Tell us a little, and we'll come back within a day.",
          },
        },
      ],
    },
    {
      slug: "engagement-rings",
      title: "Engagement Rings",
      type: "custom",
      metaTitle: "Engagement rings",
      metaDescription: "Solitaires, halos, three-stones and hidden halos.",
      sections: [
        { type: "hero", content: { heading: "Engagement rings" } },
        { type: "gallery", content: { columns: 3, placeholderItems: galleryItems("Ring") } },
      ],
    },
    {
      slug: "wedding-bands",
      title: "Wedding Bands",
      type: "custom",
      metaTitle: "Wedding bands",
      metaDescription: "Plain, set, fitted and shaped bands.",
      sections: [
        { type: "hero", content: { heading: "Wedding bands" } },
        { type: "gallery", content: { columns: 3, placeholderItems: galleryItems("Band") } },
      ],
    },
    {
      slug: "custom-design",
      title: "Custom Design",
      type: "custom",
      metaTitle: "Custom design",
      metaDescription: "Designed with you, made in our studio.",
      sections: [
        { type: "hero", content: { heading: "Designed with you" } },
        {
          type: "text",
          content: {
            heading: "How it goes",
            body:
              "We meet for an hour. We sketch. We source stones together. You see a wax model before anything is set in metal.",
          },
        },
        { type: "enquiry_form", content: { heading: "Start the conversation" } },
      ],
    },
    {
      slug: "diamond-education",
      title: "Diamond Education",
      type: "custom",
      metaTitle: "Diamond education",
      metaDescription: "Cut, colour, clarity and carat — explained simply.",
      sections: [
        { type: "hero", content: { heading: "What to know about diamonds" } },
        {
          type: "text",
          content: {
            body:
              "The four Cs are a starting point, not a scoreboard. Cut matters most for sparkle. Colour is more about your setting than the stone alone. We'll walk you through it without the jargon.",
          },
        },
        {
          type: "faq",
          content: {
            items: [
              { q: "What's the most important C", a: "Cut — it controls how much the diamond actually shines." },
              { q: "Lab-grown or natural", a: "Both have their place. We carry, certify and explain both." },
            ],
          },
        },
      ],
    },
    {
      slug: "book-appointment",
      title: "Book Appointment",
      type: "contact",
      metaTitle: "Book an appointment",
      metaDescription: "Private fittings at the studio.",
      sections: [
        { type: "hero", content: { heading: "Book a private fitting" } },
        { type: "appointment_form", content: { heading: "When works for you" } },
      ],
    },
  ],
  nav: [
    { label: "Engagement", slug: "engagement-rings" },
    { label: "Wedding Bands", slug: "wedding-bands" },
    { label: "Custom", slug: "custom-design" },
    { label: "Diamonds", slug: "diamond-education" },
    { label: "Book", slug: "book-appointment" },
  ],
  footer: {
    copy: "Private fittings, by appointment",
    columns: [
      {
        heading: "Studio",
        links: [
          { label: "Engagement", href: "/engagement-rings" },
          { label: "Custom design", href: "/custom-design" },
          { label: "Book a fitting", href: "/book-appointment" },
        ],
      },
    ],
  },
  seo: {
    title: "Engagement Ring Studio — Designed with you",
    description:
      "Engagement rings, wedding bands and custom designs — fitted, sized and signed in our studio.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #fdf6f1 0%, #e8c8b8 60%, #c89b8a 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 3. Bespoke Atelier
// ───────────────────────────────────────────────────────────────────────────

const bespokeAtelier: Template = {
  id: "bespoke-atelier",
  name: "Bespoke Atelier",
  description:
    "Atelier-led, handcrafted, warm. Designed for makers who lead with the workshop.",
  bestFor: "Custom jewellers and made-to-order ateliers",
  styleKeywords: ["Atelier", "Handcrafted", "Warm luxury", "Workshop-led"],
  palette: { primary: "#a06c3e", secondary: "#231915", accent: "#f1ebe0" },
  typography: { heading: "Playfair Display", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Bespoke Atelier — Made by hand",
      metaDescription:
        "An atelier of jewellers, gemmologists and setters. Pieces made by hand, for one wearer at a time.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "Made by the hands that designed it",
            subheading:
              "An atelier of jewellers, gemmologists and setters. Every commission begins at our bench",
            cta_text: "Begin a commission",
            cta_url: "/contact",
            eyebrow: "The atelier",
          },
          styles: { background_color: "#231915", text_color: "#f1ebe0" },
        },
        {
          type: "image_text",
          content: {
            heading: "Inside the atelier",
            body:
              "We work in a single room above the shop — twelve benches, four generations of tools, one shared file of clients we've come to know well.",
            image_side: "left",
          },
          styles: { background_color: "#f1ebe0" },
        },
        {
          type: "text",
          content: {
            heading: "How a piece is made",
            body:
              "An hour together to sketch. Stones laid out and selected. A wax carved on the bench. The metal cast, filed, set and polished by the same hand throughout. Six to eight weeks, end to end.",
            alignment: "center",
          },
        },
        {
          type: "gallery",
          content: {
            heading: "From the workshop",
            subheading: "A rotating archive of recent commissions",
            columns: 3,
            placeholderItems: galleryItems("Commission"),
          },
        },
        {
          type: "image_text",
          content: {
            heading: "Materials",
            body:
              "Recycled 18ct gold, fairmined platinum, and stones from sources we have visited ourselves. Provenance for everything we set, in writing.",
            image_side: "right",
          },
          styles: { background_color: "#f1ebe0" },
        },
        {
          type: "testimonials",
          content: {
            heading: "From those we've made for",
            items: [
              { quote: "It looks like it was always meant to be hers.", author: "C.R., Edinburgh" },
              { quote: "I felt looked after at every stage.", author: "T.B., Bath" },
              { quote: "The wax stage made all the difference.", author: "M.P., London" },
            ],
          },
        },
        { type: "enquiry_form", content: { heading: "Tell us about your piece" } },
      ],
    },
    {
      slug: "bespoke-process",
      title: "Bespoke Process",
      type: "custom",
      metaTitle: "Bespoke process",
      metaDescription: "From first sketch to final polish.",
      sections: [
        { type: "hero", content: { heading: "How a piece is made" } },
        {
          type: "text",
          content: {
            body:
              "Six stages, six to eight weeks. Sketch, source, wax, cast, set, polish. You'll see the piece at three of those stages before it's complete.",
          },
        },
      ],
    },
    {
      slug: "gallery",
      title: "Gallery",
      type: "custom",
      metaTitle: "Atelier gallery",
      metaDescription: "Recent commissions.",
      sections: [
        { type: "hero", content: { heading: "From the bench" } },
        { type: "gallery", content: { columns: 3, placeholderItems: galleryItems("Piece") } },
      ],
    },
    {
      slug: "materials",
      title: "Materials",
      type: "custom",
      metaTitle: "Materials and provenance",
      metaDescription: "Recycled gold, ethical stones, traceable supply.",
      sections: [
        { type: "hero", content: { heading: "Materials" } },
        {
          type: "text",
          content: {
            body:
              "We work in recycled 18ct gold and fairmined platinum. Diamonds are sourced through a single trusted house in Antwerp. Coloured stones are cut in Jaipur or Bangkok by people we have visited.",
          },
        },
      ],
    },
    {
      slug: "about",
      title: "About the Atelier",
      type: "about",
      metaTitle: "About the atelier",
      metaDescription: "Twelve benches, four generations of tools.",
      sections: [
        { type: "hero", content: { heading: "About the atelier" } },
        {
          type: "text",
          content: {
            body:
              "Founded in 1989 by master jeweller Henri Lacroix, the atelier is now run by his daughter Margaux. We've trained four apprentices under the bench, three of whom are still with us.",
          },
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      type: "contact",
      metaTitle: "Contact the atelier",
      metaDescription: "Begin a commission.",
      sections: [
        { type: "hero", content: { heading: "Begin a commission" } },
        { type: "contact_form", content: {} },
      ],
    },
  ],
  nav: [
    { label: "Process", slug: "bespoke-process" },
    { label: "Gallery", slug: "gallery" },
    { label: "Materials", slug: "materials" },
    { label: "About", slug: "about" },
    { label: "Contact", slug: "contact" },
  ],
  footer: {
    copy: "Made by hand, in our atelier",
  },
  seo: {
    title: "Bespoke Atelier — Made by hand",
    description: "An atelier of jewellers, gemmologists and setters.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #231915 0%, #5a3a23 55%, #a06c3e 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 4. Heritage Jeweller
// ───────────────────────────────────────────────────────────────────────────

const heritageJeweller: Template = {
  id: "heritage-jeweller",
  name: "Heritage Jeweller",
  description:
    "Family-run, established, classic. Trustworthy and timeless without leaning old-fashioned.",
  bestFor: "Family-run jewellers and established high-street stores",
  styleKeywords: ["Heritage", "Family business", "Classic", "Trustworthy"],
  palette: { primary: "#1c3a5e", secondary: "#fbfaf6", accent: "#b88840" },
  typography: { heading: "Playfair Display", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Heritage Jeweller — Three generations on the high street",
      metaDescription:
        "Established 1953. Engagement, fine jewellery, repairs and bespoke — all under one roof.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "Three generations of jewellers",
            subheading:
              "Engagement rings, fine jewellery, repairs and bespoke — all under one roof since 1953",
            cta_text: "Visit the shop",
            cta_url: "/visit-us",
            eyebrow: "Est. 1953",
          },
          styles: { background_color: "#fbfaf6", text_color: "#1c3a5e" },
        },
        {
          type: "collection_grid",
          content: {
            heading: "What we do",
            columns: 4,
            placeholderItems: [
              { name: "Engagement", caption: "Solitaires and halos" },
              { name: "Fine jewellery", caption: "Earrings, pendants, bracelets" },
              { name: "Repairs", caption: "Sized, soldered, restored" },
              { name: "Bespoke", caption: "Designed in store" },
            ],
          },
          styles: { background_color: "#fbfaf6" },
        },
        {
          type: "image_text",
          content: {
            heading: "Our story",
            body:
              "My grandfather opened the shop with two cabinets and a workbench. We still work at that bench. The cabinets have multiplied a little.",
            image_side: "left",
            cta_text: "Read the full story",
            cta_url: "/our-story",
          },
        },
        {
          type: "gallery",
          content: {
            heading: "In the cabinets this week",
            columns: 3,
            placeholderItems: galleryItems("Piece"),
          },
        },
        {
          type: "testimonials",
          content: {
            heading: "Customers, often for life",
            items: [
              { quote: "I bought my engagement ring here in 1987. My daughter just bought hers.", author: "Mr T., Harrogate" },
              { quote: "Honest pricing, every single time.", author: "Mrs L., Leeds" },
              { quote: "They re-tipped my grandmother's diamond ring perfectly.", author: "Ms S., York" },
            ],
          },
          styles: { background_color: "#fbfaf6" },
        },
        {
          type: "image_text",
          content: {
            heading: "Visit us",
            body:
              "12 High Street. Open six days a week, no appointment needed. Tea is on if you'd like one.",
            image_side: "right",
            cta_text: "Get directions",
            cta_url: "/visit-us",
          },
        },
      ],
    },
    {
      slug: "our-story",
      title: "Our Story",
      type: "about",
      metaTitle: "Our story",
      metaDescription: "Three generations on the high street.",
      sections: [
        { type: "hero", content: { heading: "Our story" } },
        {
          type: "text",
          content: {
            body:
              "Founded in 1953 by Albert Whitcomb, with one bench and two cabinets. His son Peter took over in 1981. His granddaughter Helen runs the shop today.",
          },
        },
      ],
    },
    {
      slug: "jewellery",
      title: "Jewellery",
      type: "custom",
      metaTitle: "Fine jewellery",
      metaDescription: "Engagement, eternity, fine pieces.",
      sections: [
        { type: "hero", content: { heading: "Fine jewellery" } },
        { type: "gallery", content: { columns: 3, placeholderItems: galleryItems("Piece") } },
      ],
    },
    {
      slug: "repairs",
      title: "Repairs",
      type: "custom",
      metaTitle: "Repairs",
      metaDescription: "Sizing, soldering, restoration.",
      sections: [
        { type: "hero", content: { heading: "Repairs" } },
        {
          type: "text",
          content: {
            body:
              "Resizing, claw re-tipping, chain repair, restringing, watch batteries and straps. Most repairs returned within seven working days.",
          },
        },
        { type: "repair_form", content: { heading: "Bring something in" } },
      ],
    },
    {
      slug: "bespoke",
      title: "Bespoke",
      type: "custom",
      metaTitle: "Bespoke",
      metaDescription: "Designed in store.",
      sections: [
        { type: "hero", content: { heading: "Bespoke" } },
        { type: "enquiry_form", content: {} },
      ],
    },
    {
      slug: "visit-us",
      title: "Visit Us",
      type: "contact",
      metaTitle: "Visit us",
      metaDescription: "12 High Street.",
      sections: [
        { type: "hero", content: { heading: "Come and see us" } },
        { type: "contact_form", content: {} },
      ],
    },
  ],
  nav: [
    { label: "Story", slug: "our-story" },
    { label: "Jewellery", slug: "jewellery" },
    { label: "Repairs", slug: "repairs" },
    { label: "Bespoke", slug: "bespoke" },
    { label: "Visit", slug: "visit-us" },
  ],
  footer: {
    copy: "Established 1953",
  },
  seo: {
    title: "Heritage Jeweller — Established 1953",
    description: "A family jeweller for three generations.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #fbfaf6 0%, #e2dccf 50%, #1c3a5e 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 5. Modern Minimal
// ───────────────────────────────────────────────────────────────────────────

const modernMinimal: Template = {
  id: "modern-minimal",
  name: "Modern Minimal",
  description:
    "Clean, white space, soft neutral. Built for modern fine jewellery brands and direct-to-consumer makers.",
  bestFor: "Modern fine jewellery brands and everyday-luxury makers",
  styleKeywords: ["Minimal", "White space", "Editorial", "Direct"],
  palette: { primary: "#1a1a1a", secondary: "#ffffff", accent: "#f4efe8" },
  typography: { heading: "Inter", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Modern Minimal — Everyday fine jewellery",
      metaDescription: "Considered fine jewellery, made to be worn every day.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "Everyday fine jewellery",
            subheading: "Made to be worn — not stored",
            cta_text: "Shop new in",
            cta_url: "/new-arrivals",
            overlay_opacity: 0.15,
          },
          styles: { background_color: "#ffffff", text_color: "#1a1a1a" },
        },
        {
          type: "product_grid",
          content: {
            heading: "New in",
            columns: 4,
            placeholderItems: [
              { name: "Fine Hoop", caption: "14ct gold" },
              { name: "Solitaire Pendant", caption: "Lab-grown diamond" },
              { name: "Stack Band", caption: "Sterling silver" },
              { name: "Drop Earring", caption: "Recycled gold" },
            ],
          },
        },
        {
          type: "image_text",
          content: {
            heading: "Made for daily wear",
            body:
              "Every piece is designed to live on you — through the gym, the shower, the school run. Tested, finished and finished again.",
            image_side: "right",
          },
          styles: { background_color: "#f4efe8", text_color: "#1a1a1a" },
        },
        {
          type: "collection_grid",
          content: {
            heading: "Shop by category",
            columns: 4,
            placeholderItems: [
              { name: "Earrings", caption: "Studs, hoops, drops" },
              { name: "Necklaces", caption: "Pendants, layering" },
              { name: "Rings", caption: "Stack, signet, fine" },
              { name: "Bracelets", caption: "Tennis, chain, bangle" },
            ],
          },
        },
        {
          type: "image_text",
          content: {
            heading: "Quietly responsible",
            body:
              "Recycled metal, lab-grown stones, and a packaging box you can plant. Nothing is shouted about. It just is.",
            image_side: "left",
          },
          styles: { background_color: "#ffffff", text_color: "#1a1a1a" },
        },
        {
          type: "text",
          content: {
            heading: "Free returns, always",
            body:
              "Thirty days, no questions. We'll send a pre-paid label and refund within two working days of receipt.",
            alignment: "center",
          },
          styles: { background_color: "#1a1a1a", text_color: "#ffffff" },
        },
      ],
    },
    {
      slug: "shop",
      title: "Shop",
      type: "custom",
      metaTitle: "Shop",
      metaDescription: "All pieces.",
      sections: [
        { type: "hero", content: { heading: "Shop all" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Piece") } },
      ],
    },
    {
      slug: "new-arrivals",
      title: "New Arrivals",
      type: "custom",
      metaTitle: "New in",
      metaDescription: "Latest pieces.",
      sections: [
        { type: "hero", content: { heading: "New in" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("New") } },
      ],
    },
    {
      slug: "best-sellers",
      title: "Best Sellers",
      type: "custom",
      metaTitle: "Best sellers",
      metaDescription: "Our most loved.",
      sections: [
        { type: "hero", content: { heading: "Best sellers" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Best") } },
      ],
    },
    {
      slug: "about",
      title: "About",
      type: "about",
      metaTitle: "About",
      metaDescription: "Designed for daily wear.",
      sections: [
        { type: "hero", content: { heading: "About" } },
        {
          type: "text",
          content: {
            body:
              "Started in a kitchen in 2018. Now made in a small studio in Hackney. Still designed by the same two hands.",
          },
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      type: "contact",
      metaTitle: "Contact",
      metaDescription: "Get in touch.",
      sections: [
        { type: "hero", content: { heading: "Contact" } },
        { type: "contact_form", content: {} },
      ],
    },
  ],
  nav: [
    { label: "Shop", slug: "shop" },
    { label: "New In", slug: "new-arrivals" },
    { label: "Best Sellers", slug: "best-sellers" },
    { label: "About", slug: "about" },
    { label: "Contact", slug: "contact" },
  ],
  footer: { copy: "Made for daily wear" },
  seo: {
    title: "Modern Minimal — Everyday fine jewellery",
    description: "Considered fine jewellery, made to be worn every day.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #ffffff 0%, #f4efe8 65%, #1a1a1a 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 6. Diamond Specialist
// ───────────────────────────────────────────────────────────────────────────

const diamondSpecialist: Template = {
  id: "diamond-specialist",
  name: "Diamond Specialist",
  description:
    "Sharp, premium, educational. Built for diamond dealers and certified-stone specialists.",
  bestFor: "Diamond dealers and certified-stone specialists",
  styleKeywords: ["Premium", "Sharp", "Educational", "Certified"],
  palette: { primary: "#0a2540", secondary: "#ffffff", accent: "#1d6ddc" },
  typography: { heading: "Playfair Display", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Diamond Specialist — Certified, sourced and set",
      metaDescription:
        "GIA-certified diamonds, expert advice and ethical sourcing. From loose stones to finished rings.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "Diamonds, properly explained",
            subheading:
              "GIA-certified, ethically sourced and set in our own workshop",
            cta_text: "Browse loose diamonds",
            cta_url: "/diamonds",
            eyebrow: "Specialists since 2004",
          },
          styles: { background_color: "#0a2540", text_color: "#ffffff" },
        },
        {
          type: "collection_grid",
          content: {
            heading: "Start here",
            columns: 4,
            placeholderItems: [
              { name: "Loose diamonds", caption: "GIA, IGI, HRD certified" },
              { name: "Engagement rings", caption: "Set in our workshop" },
              { name: "Education", caption: "The four Cs, properly" },
              { name: "Sourcing", caption: "Match a stone to a brief" },
            ],
          },
          styles: { background_color: "#ffffff" },
        },
        {
          type: "image_text",
          content: {
            heading: "Loose diamonds, with the certificate in front of you",
            body:
              "We carry over 400 loose stones in store, every one with full lab certification. Compare side-by-side, in daylight, with no pressure to buy on the day.",
            image_side: "left",
            cta_text: "Book a viewing",
            cta_url: "/contact",
          },
        },
        {
          type: "faq",
          content: {
            heading: "The four Cs, simply",
            items: [
              { q: "Cut", a: "How well the stone returns light. The single biggest factor in how a diamond actually looks." },
              { q: "Colour", a: "Graded D (colourless) to Z. Most clients sit comfortably in the G–H range." },
              { q: "Clarity", a: "Internal characteristics. VS1 or VS2 are eye-clean and excellent value." },
              { q: "Carat", a: "Weight, not size. Two stones at 1.00ct can look very different on the finger." },
            ],
          },
          styles: { background_color: "#ffffff" },
        },
        {
          type: "gallery",
          content: {
            heading: "Recently set",
            columns: 3,
            placeholderItems: galleryItems("Diamond"),
          },
        },
        {
          type: "testimonials",
          content: {
            heading: "From clients and other jewellers",
            items: [
              { quote: "The most knowledgeable diamond people in the city.", author: "Trade buyer, Hatton Garden" },
              { quote: "They found me a stone three other jewellers couldn't.", author: "Private client" },
              { quote: "Certified, fair and patient.", author: "Repeat client" },
            ],
          },
          styles: { background_color: "#0a2540", text_color: "#ffffff" },
        },
        { type: "appointment_form", content: { heading: "Book a viewing" } },
      ],
    },
    {
      slug: "diamonds",
      title: "Diamonds",
      type: "custom",
      metaTitle: "Loose diamonds",
      metaDescription: "Certified, in stock.",
      sections: [
        { type: "hero", content: { heading: "Loose diamonds" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Diamond") } },
      ],
    },
    {
      slug: "engagement-rings",
      title: "Engagement Rings",
      type: "custom",
      metaTitle: "Engagement rings",
      metaDescription: "Set around your stone.",
      sections: [
        { type: "hero", content: { heading: "Engagement rings" } },
        { type: "gallery", content: { columns: 3, placeholderItems: galleryItems("Setting") } },
      ],
    },
    {
      slug: "education",
      title: "Education",
      type: "custom",
      metaTitle: "Diamond education",
      metaDescription: "The four Cs, properly explained.",
      sections: [
        { type: "hero", content: { heading: "Diamond education" } },
        {
          type: "faq",
          content: {
            items: [
              { q: "What's the most important C", a: "Cut, by a long way." },
              { q: "Lab-grown vs natural", a: "Both are real diamonds. We carry, certify and explain both." },
              { q: "How big is a carat", a: "It's a weight (0.2g). The visual size depends on cut." },
            ],
          },
        },
      ],
    },
    {
      slug: "services",
      title: "Services",
      type: "custom",
      metaTitle: "Services",
      metaDescription: "Sourcing, valuation, recutting.",
      sections: [
        { type: "hero", content: { heading: "Services" } },
        {
          type: "text",
          content: {
            body:
              "Stone sourcing to brief, written valuations for insurance, recutting and recertification. Trade enquiries welcome.",
          },
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      type: "contact",
      metaTitle: "Contact",
      metaDescription: "Book a viewing.",
      sections: [
        { type: "hero", content: { heading: "Contact" } },
        { type: "contact_form", content: {} },
      ],
    },
  ],
  nav: [
    { label: "Diamonds", slug: "diamonds" },
    { label: "Engagement", slug: "engagement-rings" },
    { label: "Education", slug: "education" },
    { label: "Services", slug: "services" },
    { label: "Contact", slug: "contact" },
  ],
  footer: { copy: "GIA-certified diamonds, set in our workshop" },
  seo: {
    title: "Diamond Specialist — Certified and explained",
    description: "GIA-certified diamonds, expert advice and ethical sourcing.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #0a2540 0%, #1d6ddc 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 7. Watch & Jewellery
// ───────────────────────────────────────────────────────────────────────────

const watchAndJewellery: Template = {
  id: "watch-jewellery",
  name: "Watch & Jewellery",
  description:
    "Masculine luxury, dark and high-contrast. Built for jewellers who also handle fine watches.",
  bestFor: "Jewellers who carry fine watches alongside jewellery",
  styleKeywords: ["Watches", "Masculine", "Dark", "High contrast"],
  palette: { primary: "#8a6a3b", secondary: "#101418", accent: "#e8e2d3" },
  typography: { heading: "Playfair Display", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Watch & Jewellery — Pre-owned and new",
      metaDescription:
        "Fine watches and jewellery, bought, sold and serviced. Authenticated in-house.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "Watches and jewellery — bought, sold, serviced",
            subheading: "Authenticated in-house, traded with discretion",
            cta_text: "Sell or trade",
            cta_url: "/sell-or-trade",
          },
          styles: { background_color: "#101418", text_color: "#e8e2d3" },
        },
        {
          type: "collection_grid",
          content: {
            heading: "What we carry",
            columns: 4,
            placeholderItems: [
              { name: "Watches", caption: "Pre-owned and new" },
              { name: "Jewellery", caption: "Engagement, fine, signed" },
              { name: "Trade", caption: "Sell, trade, consign" },
              { name: "Service", caption: "Watchmaking workshop" },
            ],
          },
          styles: { background_color: "#101418", text_color: "#e8e2d3" },
        },
        {
          type: "gallery",
          content: {
            heading: "On the wall this week",
            subheading: "Watches in stock, refreshed weekly",
            columns: 3,
            placeholderItems: [
              { name: "Submariner Date", caption: "Pre-owned, full set" },
              { name: "Speedmaster Pro", caption: "Service complete" },
              { name: "Royal Oak 15500ST", caption: "Box and papers" },
              { name: "Datejust 41", caption: "Fluted bezel" },
              { name: "Nautilus 5711", caption: "Recent service" },
              { name: "Aquanaut 5167", caption: "Full set" },
            ],
          },
        },
        {
          type: "image_text",
          content: {
            heading: "Authenticated in-house",
            body:
              "Every pre-owned watch is checked by our watchmaker before it goes on display — case, movement, dial and bracelet. We'd rather lose the deal than sell a watch we're not sure about.",
            image_side: "right",
          },
          styles: { background_color: "#1a1f25", text_color: "#e8e2d3" },
        },
        {
          type: "image_text",
          content: {
            heading: "Sell or trade",
            body:
              "We pay strong prices for the right pieces, in cash or against a trade. Bring it in, or send pictures and we'll quote within the day.",
            image_side: "left",
            cta_text: "Get a valuation",
            cta_url: "/sell-or-trade",
          },
        },
        {
          type: "testimonials",
          content: {
            heading: "From collectors and clients",
            items: [
              { quote: "Fair on the buy, fair on the sell.", author: "Collector, ten years" },
              { quote: "They serviced my Daytona properly. Better than the boutique.", author: "Repeat client" },
              { quote: "Honest about what's a deal and what isn't.", author: "Trade buyer" },
            ],
          },
          styles: { background_color: "#101418", text_color: "#e8e2d3" },
        },
      ],
    },
    {
      slug: "watches",
      title: "Watches",
      type: "custom",
      metaTitle: "Watches in stock",
      metaDescription: "Pre-owned and new.",
      sections: [
        { type: "hero", content: { heading: "Watches" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Watch") } },
      ],
    },
    {
      slug: "jewellery",
      title: "Jewellery",
      type: "custom",
      metaTitle: "Jewellery",
      metaDescription: "Engagement, fine and signed.",
      sections: [
        { type: "hero", content: { heading: "Jewellery" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Piece") } },
      ],
    },
    {
      slug: "sell-or-trade",
      title: "Sell or Trade",
      type: "custom",
      metaTitle: "Sell or trade",
      metaDescription: "We buy watches and jewellery.",
      sections: [
        { type: "hero", content: { heading: "Sell or trade" } },
        {
          type: "text",
          content: {
            body:
              "We pay strong prices in cash or trade against a watch in stock. Send pictures with serial and reference and we'll quote within a working day.",
          },
        },
        { type: "enquiry_form", content: { heading: "Tell us what you have" } },
      ],
    },
    {
      slug: "services",
      title: "Services",
      type: "custom",
      metaTitle: "Services",
      metaDescription: "Watchmaking and jewellery workshops.",
      sections: [
        { type: "hero", content: { heading: "Services" } },
        {
          type: "text",
          content: {
            body:
              "In-house watchmaking — battery, movement service, crystal, bracelet refinish. Jewellery workshop for sizing, polishing and re-tipping.",
          },
        },
        { type: "repair_form", content: { heading: "Book it in" } },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      type: "contact",
      metaTitle: "Contact",
      metaDescription: "Visit or call.",
      sections: [
        { type: "hero", content: { heading: "Contact" } },
        { type: "contact_form", content: {} },
      ],
    },
  ],
  nav: [
    { label: "Watches", slug: "watches" },
    { label: "Jewellery", slug: "jewellery" },
    { label: "Sell or Trade", slug: "sell-or-trade" },
    { label: "Services", slug: "services" },
    { label: "Contact", slug: "contact" },
  ],
  footer: { copy: "Bought, sold, serviced — discreetly" },
  seo: {
    title: "Watch & Jewellery — Bought, sold, serviced",
    description: "Fine watches and jewellery, authenticated in-house.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #101418 0%, #2a2519 60%, #8a6a3b 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 8. Fashion Fine Jewellery
// ───────────────────────────────────────────────────────────────────────────

const fashionFine: Template = {
  id: "fashion-fine-jewellery",
  name: "Fashion Fine Jewellery",
  description:
    "Trend-driven and social-first. Modern, stylish and playful — without losing the premium edge.",
  bestFor: "Trend-led fine jewellery brands and social-first labels",
  styleKeywords: ["Trending", "Stylish", "Playful", "Social-first"],
  palette: { primary: "#e35d6a", secondary: "#fff8f3", accent: "#1a1a1a" },
  typography: { heading: "Cormorant Garamond", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Fashion Fine Jewellery — Wear it loud, wear it daily",
      metaDescription:
        "Fine jewellery for everyone who actually wants to wear it. Trends, classics and a little bit of fun.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "Wear it loud, wear it daily",
            subheading: "Fine jewellery, trending pieces and a little bit of fun",
            cta_text: "Shop trending",
            cta_url: "/trending",
            eyebrow: "New drop every Friday",
          },
          styles: { background_color: "#fff8f3", text_color: "#1a1a1a" },
        },
        {
          type: "product_grid",
          content: {
            heading: "Trending now",
            subheading: "What everyone's stacking this week",
            columns: 4,
            placeholderItems: [
              { name: "Pearl Drop Hoop", caption: "Sold out twice" },
              { name: "Charm Necklace", caption: "Build your stack" },
              { name: "Heart Signet", caption: "Personalise it" },
              { name: "Tennis Anklet", caption: "Back in stock" },
            ],
          },
        },
        {
          type: "image_text",
          content: {
            heading: "Build your stack",
            body:
              "Mix metals, layer chains, double up on rings. Every piece is fine jewellery — recycled gold, lab-grown stones, made to last.",
            image_side: "right",
            cta_text: "Shop the stack",
            cta_url: "/shop",
          },
        },
        {
          type: "collection_grid",
          content: {
            heading: "Shop the edits",
            columns: 4,
            placeholderItems: [
              { name: "Bridal", caption: "Engagement, the fun way" },
              { name: "Charms", caption: "Build your story" },
              { name: "Daily wear", caption: "Sleep, shower, swim" },
              { name: "Stack starters", caption: "Beginner friendly" },
            ],
          },
          styles: { background_color: "#fff8f3" },
        },
        {
          type: "gallery",
          content: {
            heading: "From the feed",
            subheading: "Tag #YourBrand to be reposted",
            columns: 4,
            placeholderItems: galleryItems("Look"),
          },
        },
        {
          type: "testimonials",
          content: {
            heading: "From the community",
            items: [
              { quote: "Obsessed. Already on order number four.", author: "@maddiemcgowan" },
              { quote: "The packaging alone is a moment.", author: "@joeyabroad" },
              { quote: "Wears every day. Doesn't tarnish. Magic.", author: "@studio.kee" },
            ],
          },
        },
        {
          type: "text",
          content: {
            heading: "Free returns, fast shipping",
            body:
              "30 day no-questions returns. Tracked next-day shipping above £100.",
            alignment: "center",
          },
          styles: { background_color: "#1a1a1a", text_color: "#fff8f3" },
        },
      ],
    },
    {
      slug: "shop",
      title: "Shop",
      type: "custom",
      metaTitle: "Shop everything",
      metaDescription: "All pieces.",
      sections: [
        { type: "hero", content: { heading: "Shop all" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Piece") } },
      ],
    },
    {
      slug: "trending",
      title: "Trending",
      type: "custom",
      metaTitle: "Trending now",
      metaDescription: "What's flying out the door.",
      sections: [
        { type: "hero", content: { heading: "Trending" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Trending") } },
      ],
    },
    {
      slug: "gifts",
      title: "Gifts",
      type: "custom",
      metaTitle: "Gifts",
      metaDescription: "From £45 — wrapped, ready and theirs.",
      sections: [
        { type: "hero", content: { heading: "Gifts they'll actually wear" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Gift") } },
      ],
    },
    {
      slug: "about",
      title: "About",
      type: "about",
      metaTitle: "About",
      metaDescription: "Made for everyone, finished like fine jewellery.",
      sections: [
        { type: "hero", content: { heading: "About" } },
        {
          type: "text",
          content: {
            body:
              "Started by two friends in Dalston who couldn't find fine jewellery that didn't take itself too seriously. So we made it.",
          },
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      type: "contact",
      metaTitle: "Contact",
      metaDescription: "We reply within a day.",
      sections: [
        { type: "hero", content: { heading: "Get in touch" } },
        { type: "contact_form", content: {} },
      ],
    },
  ],
  nav: [
    { label: "Shop", slug: "shop" },
    { label: "Trending", slug: "trending" },
    { label: "Gifts", slug: "gifts" },
    { label: "About", slug: "about" },
    { label: "Contact", slug: "contact" },
  ],
  footer: { copy: "Made for the everyday" },
  seo: {
    title: "Fashion Fine Jewellery — Wear it loud",
    description: "Fine jewellery for people who actually wear it.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #fff8f3 0%, #f7c5ca 55%, #e35d6a 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 9. Repairs & Services
// ───────────────────────────────────────────────────────────────────────────

const repairsAndServices: Template = {
  id: "repairs-services",
  name: "Repairs & Services",
  description:
    "Practical, trustworthy and service-focused. Built around the workshop and what it can do.",
  bestFor: "Repair-focused jewellers and workshop-led businesses",
  styleKeywords: ["Repairs", "Workshop", "Practical", "Trustworthy"],
  palette: { primary: "#2f6b4f", secondary: "#fafaf7", accent: "#e8e2d3" },
  typography: { heading: "Inter", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Repairs & Services — Workshop on the high street",
      metaDescription:
        "A working jewellery workshop. Repairs, restoration, remodelling and valuations — most returned within a week.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "A workshop, on the high street",
            subheading:
              "Repairs, restoration, remodelling and valuations — most pieces returned within a week",
            cta_text: "Bring something in",
            cta_url: "/repairs",
          },
          styles: { background_color: "#fafaf7", text_color: "#1a1a1a" },
        },
        {
          type: "collection_grid",
          content: {
            heading: "What we do",
            columns: 4,
            placeholderItems: [
              { name: "Resizing", caption: "Up, down, comfort fit" },
              { name: "Restoration", caption: "Re-tipping, soldering, stones" },
              { name: "Remodelling", caption: "New piece, your stones" },
              { name: "Valuations", caption: "Insurance, written" },
            ],
          },
          styles: { background_color: "#fafaf7" },
        },
        {
          type: "image_text",
          content: {
            heading: "Bring it in, see what we can do",
            body:
              "Most repairs are quoted on the spot. Resizing, claw re-tipping, chain repair and re-stringing all happen in our workshop, never sent away.",
            image_side: "left",
            cta_text: "Drop something off",
            cta_url: "/repairs",
          },
        },
        {
          type: "image_text",
          content: {
            heading: "Remodelling — your gold, a new piece",
            body:
              "We melt down old pieces, recover the stones, and design something you'll actually wear. Usually quicker and cheaper than starting from new.",
            image_side: "right",
          },
          styles: { background_color: "#e8e2d3" },
        },
        {
          type: "faq",
          content: {
            heading: "What people ask",
            items: [
              { q: "How long do repairs take", a: "Most within seven working days. Straight resizes often the same day." },
              { q: "Do you quote on the spot", a: "Yes — usually. We may take it in for a closer look first." },
              { q: "Can I melt down an old ring into a new one", a: "Yes. We do this every week." },
              { q: "Do you do valuations", a: "Yes. Written, insurance-grade, while you wait by appointment." },
            ],
          },
        },
        {
          type: "testimonials",
          content: {
            heading: "From regulars",
            items: [
              { quote: "Saved my grandmother's ring. It's back on my finger after thirty years.", author: "Mrs P." },
              { quote: "Honest about what's worth fixing and what isn't.", author: "Mr K." },
              { quote: "Quick, fair and properly skilled.", author: "Repeat client" },
            ],
          },
          styles: { background_color: "#fafaf7" },
        },
        { type: "repair_form", content: { heading: "Tell us about your repair" } },
      ],
    },
    {
      slug: "repairs",
      title: "Repairs",
      type: "custom",
      metaTitle: "Repairs",
      metaDescription: "Sizing, soldering, stones, chains.",
      sections: [
        { type: "hero", content: { heading: "Repairs" } },
        { type: "repair_form", content: {} },
      ],
    },
    {
      slug: "remodelling",
      title: "Remodelling",
      type: "custom",
      metaTitle: "Remodelling",
      metaDescription: "Your gold, a new piece.",
      sections: [
        { type: "hero", content: { heading: "Remodelling" } },
        {
          type: "text",
          content: {
            body:
              "We weigh and value your old pieces, melt them down, recover the stones, and design something new with you. Often less than half the cost of buying new.",
          },
        },
      ],
    },
    {
      slug: "services",
      title: "Services",
      type: "custom",
      metaTitle: "Services",
      metaDescription: "Valuations, cleaning, engraving.",
      sections: [
        { type: "hero", content: { heading: "Services" } },
        {
          type: "text",
          content: {
            body:
              "Insurance valuations, ultrasonic cleaning, engraving, pearl re-stringing, watch batteries and straps.",
          },
        },
      ],
    },
    {
      slug: "about",
      title: "About",
      type: "about",
      metaTitle: "About",
      metaDescription: "A working workshop on the high street.",
      sections: [
        { type: "hero", content: { heading: "About the workshop" } },
        {
          type: "text",
          content: {
            body:
              "Two benches, three jewellers and a steady stream of regulars. We've been on the same high street since 1996.",
          },
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      type: "contact",
      metaTitle: "Contact",
      metaDescription: "Drop in, no appointment needed.",
      sections: [
        { type: "hero", content: { heading: "Drop in" } },
        { type: "contact_form", content: {} },
      ],
    },
  ],
  nav: [
    { label: "Repairs", slug: "repairs" },
    { label: "Remodelling", slug: "remodelling" },
    { label: "Services", slug: "services" },
    { label: "About", slug: "about" },
    { label: "Contact", slug: "contact" },
  ],
  footer: { copy: "A working workshop on the high street" },
  seo: {
    title: "Repairs & Services — Workshop on the high street",
    description: "Repairs, restoration, remodelling and valuations.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #fafaf7 0%, #d8dccd 55%, #2f6b4f 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// 10. Premium Retail Store
// ───────────────────────────────────────────────────────────────────────────

const premiumRetail: Template = {
  id: "premium-retail",
  name: "Premium Retail Store",
  description:
    "Polished, broad-range, well-rounded. Built for general jewellery shops that do a bit of everything.",
  bestFor: "General jewellery shops and polished retail stores",
  styleKeywords: ["Polished", "Retail", "Broad range", "Well rounded"],
  palette: { primary: "#7d2a3a", secondary: "#fcf8f5", accent: "#cfa05f" },
  typography: { heading: "Playfair Display", body: "Inter" },
  pages: [
    {
      slug: "home",
      title: "Home",
      type: "home",
      metaTitle: "Premium Retail Store — Jewellery for every occasion",
      metaDescription:
        "Engagement, fine jewellery, gifts and services — under one roof, since 1968.",
      sections: [
        {
          type: "hero",
          content: {
            heading: "Jewellery for every occasion",
            subheading:
              "Engagement, fine pieces, gifts and services — well kept, well priced",
            cta_text: "Shop the store",
            cta_url: "/jewellery",
            eyebrow: "Family run since 1968",
          },
          styles: { background_color: "#7d2a3a", text_color: "#fcf8f5" },
        },
        {
          type: "collection_grid",
          content: {
            heading: "Shop by occasion",
            columns: 4,
            placeholderItems: [
              { name: "Engagement", caption: "Solitaires, halos, three-stones" },
              { name: "Anniversary", caption: "Eternity bands, tennis bracelets" },
              { name: "Gifts", caption: "From £75" },
              { name: "Self-buying", caption: "Treat yourself, properly" },
            ],
          },
          styles: { background_color: "#fcf8f5" },
        },
        {
          type: "product_grid",
          content: {
            heading: "Best sellers",
            columns: 4,
            placeholderItems: galleryItems("Best"),
          },
        },
        {
          type: "image_text",
          content: {
            heading: "In store and online",
            body:
              "Reserve online, try in store. Free UK delivery on orders over £200, and full hands-on returns at the counter.",
            image_side: "right",
            cta_text: "Visit the store",
            cta_url: "/about",
          },
          styles: { background_color: "#fcf8f5" },
        },
        {
          type: "gallery",
          content: {
            heading: "New in this week",
            columns: 3,
            placeholderItems: galleryItems("New"),
          },
        },
        {
          type: "image_text",
          content: {
            heading: "Services we offer",
            body:
              "Resizing, repair, valuation, cleaning, engraving and bespoke design — all from the same trusted team.",
            image_side: "left",
            cta_text: "See all services",
            cta_url: "/services",
          },
        },
        {
          type: "testimonials",
          content: {
            heading: "What our customers say",
            items: [
              { quote: "Always our first stop for special occasions.", author: "M.B., regular" },
              { quote: "Helpful staff, never pushy.", author: "J.O., bride" },
              { quote: "Repaired my grandmother's necklace beautifully.", author: "S.L." },
            ],
          },
          styles: { background_color: "#fcf8f5" },
        },
      ],
    },
    {
      slug: "jewellery",
      title: "Jewellery",
      type: "custom",
      metaTitle: "Jewellery",
      metaDescription: "Earrings, necklaces, rings, bracelets.",
      sections: [
        { type: "hero", content: { heading: "Jewellery" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Piece") } },
      ],
    },
    {
      slug: "engagement",
      title: "Engagement",
      type: "custom",
      metaTitle: "Engagement rings",
      metaDescription: "Solitaires, halos, three-stones.",
      sections: [
        { type: "hero", content: { heading: "Engagement" } },
        { type: "gallery", content: { columns: 3, placeholderItems: galleryItems("Engagement") } },
      ],
    },
    {
      slug: "gifts",
      title: "Gifts",
      type: "custom",
      metaTitle: "Gifts",
      metaDescription: "From £75. Wrapped and ready.",
      sections: [
        { type: "hero", content: { heading: "Gifts" } },
        { type: "product_grid", content: { columns: 4, placeholderItems: galleryItems("Gift") } },
      ],
    },
    {
      slug: "services",
      title: "Services",
      type: "custom",
      metaTitle: "Services",
      metaDescription: "Repairs, valuations, engraving.",
      sections: [
        { type: "hero", content: { heading: "Services" } },
        {
          type: "text",
          content: {
            body:
              "Repairs, resizing, valuations, engraving, cleaning, watch batteries and straps. Most repairs returned within a week.",
          },
        },
        { type: "repair_form", content: { heading: "Book a repair" } },
      ],
    },
    {
      slug: "about",
      title: "About",
      type: "about",
      metaTitle: "About",
      metaDescription: "Family run since 1968.",
      sections: [
        { type: "hero", content: { heading: "About the store" } },
        {
          type: "text",
          content: {
            body:
              "Three generations on the high street. Same family, same standards, same workshop out the back.",
          },
        },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      type: "contact",
      metaTitle: "Contact",
      metaDescription: "Visit, call or write.",
      sections: [
        { type: "hero", content: { heading: "Contact" } },
        { type: "contact_form", content: {} },
      ],
    },
  ],
  nav: [
    { label: "Jewellery", slug: "jewellery" },
    { label: "Engagement", slug: "engagement" },
    { label: "Gifts", slug: "gifts" },
    { label: "Services", slug: "services" },
    { label: "About", slug: "about" },
    { label: "Contact", slug: "contact" },
  ],
  footer: { copy: "Family run since 1968" },
  seo: {
    title: "Premium Retail Store — Jewellery for every occasion",
    description: "Engagement, fine jewellery, gifts and services.",
  },
  thumbnailGradient:
    "linear-gradient(135deg, #fcf8f5 0%, #cfa05f 55%, #7d2a3a 100%)",
};

// ───────────────────────────────────────────────────────────────────────────
// Export catalogue
// ───────────────────────────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [
  luxuryBoutique,
  engagementStudio,
  bespokeAtelier,
  heritageJeweller,
  modernMinimal,
  diamondSpecialist,
  watchAndJewellery,
  fashionFine,
  repairsAndServices,
  premiumRetail,
];

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export type { TemplateSection };

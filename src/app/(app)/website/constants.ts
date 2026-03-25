// Shared constants for Website Builder

export const FONTS = ["Inter", "Playfair Display", "Cormorant Garamond"];

export const MODES = [
  {
    id: "A",
    name: "Catalogue",
    desc: "Show your inventory publicly. No prices, enquiry form only.",
    icon: "🗂️",
  },
  {
    id: "B",
    name: "Catalogue + Prices",
    desc: "Show inventory with prices. Customers can enquire.",
    icon: "💎",
  },
  {
    id: "C",
    name: "Full E-commerce",
    desc: "Accept online payments via Stripe.",
    icon: "🛒",
  },
];

export const TYPE_OPTIONS = [
  {
    id: "hosted",
    title: "Hosted Website",
    desc: "We host your site on nexpura.store with optional custom domain",
    icon: "🌐",
  },
  {
    id: "connect",
    title: "Connect Existing Site",
    desc: "Link to your existing website (Shopify, Wix, etc.)",
    icon: "🔗",
  },
  {
    id: "domain-guide",
    title: "Need Help?",
    desc: "Get guidance on domain setup and DNS configuration",
    icon: "❓",
  },
];

export const PLATFORMS = [
  { id: "shopify", name: "Shopify" },
  { id: "wix", name: "Wix" },
  { id: "squarespace", name: "Squarespace" },
  { id: "wordpress", name: "WordPress" },
  { id: "other", name: "Other" },
];

export const PLATFORM_INSTRUCTIONS: Record<string, string[]> = {
  shopify: [
    "Log in to Shopify Admin",
    "Go to Settings → Domains",
    "Click 'Add existing domain'",
  ],
  wix: [
    "Log in to Wix Dashboard",
    "Go to Settings → Domains",
    "Click 'Connect a domain you already own'",
  ],
  squarespace: [
    "Log in to Squarespace",
    "Go to Settings → Domains",
    "Click 'Use a domain I own'",
  ],
  wordpress: [
    "Log in to your WordPress hosting",
    "Navigate to domain settings",
    "Update DNS A record",
  ],
  other: [
    "Access your hosting provider's dashboard",
    "Navigate to DNS or domain settings",
    "Add A record pointing to your server IP",
  ],
};

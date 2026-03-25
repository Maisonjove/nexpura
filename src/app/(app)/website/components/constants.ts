import { Globe, Link2, ShoppingCart } from "lucide-react";
import type { WebsiteType } from "../types";

export const FONTS = ["Inter", "Playfair Display", "Cormorant Garamond"];

export const MODES = [
  { id: "A", name: "Catalogue", desc: "Show your inventory publicly. No prices, enquiry form only.", icon: "🗂️" },
  { id: "B", name: "Catalogue + Prices", desc: "Show inventory with prices. Customers can enquire.", icon: "💎" },
  { id: "C", name: "Full E-commerce", desc: "Accept online payments via Stripe.", icon: "🛒" },
];

export const TYPE_OPTIONS = [
  {
    id: "hosted" as WebsiteType,
    icon: Globe,
    title: "Nexpura Hosted",
    desc: "We build and host your jewellery website. Pick a style, add your branding, go live.",
    badge: "Most Popular",
  },
  {
    id: "connect" as WebsiteType,
    icon: Link2,
    title: "Connect My Site",
    desc: "Already have a Squarespace, Wix, Shopify or custom site? Connect it and embed your live inventory.",
    badge: null,
  },
  {
    id: "domain-guide" as WebsiteType,
    icon: ShoppingCart,
    title: "Get a Domain First",
    desc: "Don't have a website yet? We'll guide you through buying a domain and getting online.",
    badge: null,
  },
];

export const PLATFORMS = [
  { id: "squarespace", label: "Squarespace" },
  { id: "wix", label: "Wix" },
  { id: "shopify", label: "Shopify" },
  { id: "wordpress", label: "WordPress" },
  { id: "webflow", label: "Webflow" },
  { id: "other", label: "Custom / Other" },
];

export const PLATFORM_INSTRUCTIONS: Record<string, string[]> = {
  squarespace: [
    "Go to Pages → select the page where you want the catalogue",
    "Add a Code Block (insert point → +)",
    "Paste this code:",
  ],
  wix: [
    "Go to your Wix Editor",
    "Add → Embed → Custom Code (HTML iframe)",
    "Paste this code:",
  ],
  shopify: [
    "Go to Online Store → Themes → Edit Code",
    "Open the page template where you want the widget",
    "Paste this code before </body>:",
  ],
  wordpress: [
    "Edit the page in WordPress",
    "Add a Custom HTML block",
    "Paste this code:",
  ],
  webflow: [
    "Open the page in Webflow Designer",
    "Add an Embed element",
    "Paste this code:",
  ],
  other: [
    "Open your website's HTML file or page template",
    "Paste this code anywhere in <body>:",
  ],
};

export const DOMAIN_REGISTRARS = [
  {
    emoji: "🟡",
    name: "Namecheap",
    price: "Starting from ~$15/yr",
    desc: "Great for beginners. Easy DNS management.",
    href: "https://www.namecheap.com",
  },
  {
    emoji: "🟢",
    name: "GoDaddy",
    price: "Starting from ~$20/yr",
    desc: "Largest registrar. 24/7 support.",
    href: "https://au.godaddy.com",
  },
  {
    emoji: "🔵",
    name: "Cloudflare",
    price: "At cost (cheapest)",
    desc: "Technical but best value. Zero markup on domains.",
    href: "https://www.cloudflare.com/products/registrar/",
  },
];

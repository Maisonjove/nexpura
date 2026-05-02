import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Nexpura Premium Palette
        nexpura: {
          charcoal: "#1A1A1A",
          bronze: "#8B7355",
          "bronze-hover": "#7A6347",
          "bronze-light": "#C4A882",
          ivory: "#FAFAF9",
          "ivory-elevated": "#FCFAF6",
          cream: "#F5F2EE",
          warm: "#EDE9E3",
          champagne: "#E8DCC8",
          // Workspace redesign — Kaitlyn's 2026-05-02 brief. Extends the
          // existing nexpura.* palette with the missing taupe scale,
          // charcoal text levels, secondary accent (cognac), and status
          // colours used across the logged-in workspace. The marketing
          // (`m-*`) palette stays separate.
          "taupe-100": "#E5DED1",
          "taupe-200": "#D4CABA",
          "taupe-400": "#A8997F",
          "charcoal-700": "#332F2A",
          "charcoal-500": "#5A5249",
          cognac: "#A47551",
          "emerald-deep": "#2F5D4F",
          "emerald-bg": "#E8EFEA",
          oxblood: "#7A2E2E",
          "oxblood-bg": "#F2E4E2",
          "amber-muted": "#A8803A",
          "amber-bg": "#F4ECD9",
        },
        // Marketing-site palette (Kaitlyn's homepage brief). The `m-`
        // prefix keeps these scoped — only the (marketing) tree +
        // landing components use them; the (app) UI keeps the warm-
        // stone theme above.
        m: {
          ivory: "#FAF7F2",
          "white-soft": "#FFFFFF",
          "warm-tint": "#FDFAF4",
          charcoal: "#1A1A1A",
          "charcoal-soft": "#2B2B2B",
          champagne: "#C9A961",
          "champagne-soft": "#E8D9B5",
          "champagne-tint": "#F3E9D5",
          "text-primary": "#1A1A1A",
          "text-secondary": "#5C5C5C",
          "text-muted": "#8A8A8A",
          "text-faint": "#9A8F82",
          "border-soft": "#E8E1D6",
          "border-soft-2": "#EFEAE1",
          "border-hover": "#C9A961",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "var(--font-serif)", "Cormorant Garamond", "Georgia", "serif"],
      },
      fontSize: {
        "display": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "heading-xl": ["2.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "heading-lg": ["2rem", { lineHeight: "1.25" }],
        "heading": ["1.5rem", { lineHeight: "1.3", letterSpacing: "0.01em" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7" }],
        "overline": ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.15em" }],
      },
      letterSpacing: {
        luxury: "0.2em",
        editorial: "0.1em",
        refined: "0.05em",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out forwards",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "slide-in-right": "slideInRight 0.6s ease-out forwards",
        "scale-in": "scaleIn 0.5s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
      },
      transitionTimingFunction: {
        luxury: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/forms")],
} satisfies Config;

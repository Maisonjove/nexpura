import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { PWAProvider } from "@/components/PWAProvider";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { LiveRegionProvider } from "@/components/LiveRegion";
import { PrehydrationPrefetch } from "@/components/PrehydrationPrefetch";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#a16207",
};

export const metadata: Metadata = {
  title: "Nexpura — The Operating System for Modern Jewellers",
  description:
    "POS, repairs, bespoke design, inventory, customers, invoicing — unified in one platform built around how jewellers actually work.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nexpura",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Nexpura — The Operating System for Modern Jewellers",
    description:
      "POS, repairs, bespoke design, inventory, customers, invoicing — unified in one platform built around how jewellers actually work.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Nexpura — Jewellery Business Software",
      },
    ],
    type: "website",
    siteName: "Nexpura",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexpura — The Operating System for Modern Jewellers",
    description:
      "POS, repairs, bespoke design, inventory, customers, invoicing — unified in one platform built around how jewellers actually work.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={cn("font-sans", geist.variable, instrumentSerif.variable)}
    >
      <head>
        {/* Preconnect to Supabase to reduce connection latency */}
        <link
          rel="preconnect"
          href="https://vkpjocnrefjfpuovzinn.supabase.co"
        />
        <link
          rel="dns-prefetch"
          href="https://vkpjocnrefjfpuovzinn.supabase.co"
        />
        {/* Preconnect to Google Fonts to speed up font delivery */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* PWA iOS Safari */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Pre-hydration hot-route prefetch — fires during HTML parse in
            the browser, populates HTTP cache so router.prefetch() later
            serves from cache instead of round-tripping. Reads tenant
            slug from location.pathname at parse time. */}
        <PrehydrationPrefetch />
        <LiveRegionProvider>
          <PWAProvider>
            {children}
            <OfflineIndicator />
          </PWAProvider>
          <Toaster position="bottom-right" richColors />
        </LiveRegionProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=document.createElement('script');s.src='https://www.annot8.dev/snippet.js?project=88bbfcbe4f28b316dc968c9d';s.setAttribute('data-project','88bbfcbe4f28b316dc968c9d');document.head.appendChild(s);})();`,
          }}
        />
      </body>
    </html>
  );
}


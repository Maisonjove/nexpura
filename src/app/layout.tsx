import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { PWAProvider } from "@/components/PWAProvider";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { LiveRegionProvider } from "@/components/LiveRegion";
import { PrehydrationPrefetch } from "@/components/PrehydrationPrefetch";
import { HotRouteBootstrap } from "@/components/HotRouteBootstrap";

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
  themeColor: "#1A1A1A",
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
      className={cn(
        "font-sans",
        geist.variable,
        instrumentSerif.variable,
      )}
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
        {/*
          Pre-hydration RSC warmup for the hot tenant-prefixed routes.
          See src/components/PrehydrationPrefetch.tsx for the full rationale.

          Emitted inside <head> so the browser executes it the moment the
          <head> parse reaches this node — before the body paints, before
          any JS module loads, certainly before React hydrates. The user's
          first click in the hot path therefore sees a Lambda + DB that's
          already warm, cutting ~500-1500ms off the first-click cold RSC
          fetch even though RSC responses themselves are `no-store`.

          URL + header shape is byte-identical to what Next's
          `router.prefetch` fires for a route-level cache miss (audited
          live on prod via e2e/prefetch-audit.spec.ts). A previous attempt
          that used a different request shape caused duplicate traffic and
          was reverted; this version does not.
        */}
        <PrehydrationPrefetch />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <LiveRegionProvider>
          <PWAProvider>
            {/*
              Tiny client island mounted BEFORE {children}. See the file
              header in src/components/HotRouteBootstrap.tsx for the
              rationale. This is intentionally sibling-ahead-of-children
              so its useEffect fires during the root-layout render cycle
              rather than waiting on the heavy (app)-layout subtree
              commit path the legacy RoutePrefetcher is gated behind.

              Wrapped in <Suspense fallback={null}> because the component
              reads `useRouter()` + `usePathname()` — both report the
              current request URL, which CacheComponents classes as
              "uncached dynamic data". Under CC the prerender pipeline
              needs a Suspense boundary to know this region is intentionally
              dynamic; without one the whole /[subdomain]/... and /admin/*
              tree fails the "Uncached data accessed outside of <Suspense>"
              check. Timing unchanged: the client island still commits at
              root-layout render cycle, the useEffect still fires at the
              same point. Fallback is null → zero visual impact.
            */}
            <Suspense fallback={null}>
              <HotRouteBootstrap />
            </Suspense>
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


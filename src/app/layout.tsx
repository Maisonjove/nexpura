import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { PWAProvider } from "@/components/PWAProvider";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#a16207',
};

export const metadata: Metadata = {
  title: "Nexpura — The Operating System for Modern Jewellers",
  description: "POS, repairs, bespoke design, inventory, customers, invoicing — unified in one platform built around how jewellers actually work.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nexpura',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Nexpura — The Operating System for Modern Jewellers",
    description: "POS, repairs, bespoke design, inventory, customers, invoicing — unified in one platform built around how jewellers actually work.",
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
    description: "POS, repairs, bespoke design, inventory, customers, invoicing — unified in one platform built around how jewellers actually work.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className={cn("font-sans", geist.variable)}>
      <head>
        {/* Preconnect to Supabase to reduce connection latency */}
        <link rel="preconnect" href="https://vkpjocnrefjfpuovzinn.supabase.co" />
        <link rel="dns-prefetch" href="https://vkpjocnrefjfpuovzinn.supabase.co" />
        {/* PWA iOS Safari */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.variable
      )}>
        <PWAProvider>
          {children}
          <OfflineIndicator />
        </PWAProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexpura — The operating system for jewellery businesses",
  description:
    "Manage bespoke jobs, repairs, customers, inventory, and invoicing. Built for the bench.",
  openGraph: {
    title: "Nexpura — The operating system for jewellery businesses",
    description:
      "Manage bespoke jobs, repairs, customers, inventory, and invoicing. Built for the bench.",
    type: "website",
    siteName: "Nexpura",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexpura — The operating system for jewellery businesses",
    description:
      "Manage bespoke jobs, repairs, customers, inventory, and invoicing. Built for the bench.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-inter bg-ivory text-forest">{children}</body>
    </html>
  );
}

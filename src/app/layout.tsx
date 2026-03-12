import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexpura — Cloud OS for Jewellery Businesses",
  description: "Manage bespoke jobs, repairs, stock, invoices, and customers — all in one place. Built for jewellers who take their craft seriously.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

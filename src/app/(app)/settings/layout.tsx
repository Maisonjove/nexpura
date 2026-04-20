import type { Metadata } from "next";

// Default metadata for /settings/. Individual subpages (/settings/payments,
// /settings/locations, /settings/team, /settings/notifications, /settings/email,
// /settings/printing, etc.) export their own `metadata` object which overrides
// this one. The /settings index page is a client component and can't export
// metadata itself — this layout provides the tab title for that one page.
export const metadata: Metadata = {
  title: "Settings — Nexpura",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

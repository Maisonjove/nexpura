// /passports/new/page.tsx is a "use client" component, so it cannot
// export `metadata` directly. Adding a colocated layout that exports
// metadata is the lightest fix — Next.js merges layout metadata into
// the route segment, so the browser tab shows "Create Passport — Nexpura"
// instead of falling through to the marketing-site default title.

export const metadata = { title: "Create Passport — Nexpura" };

export default function PassportsNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// /verification/page.tsx is "use client", so metadata can't live there.
// Colocated layout supplies the title for the browser tab.

export const metadata = { title: "Verification — Nexpura" };

export default function VerificationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Colocated layout supplies the browser tab title for /verification.
// (Group 14 first-pass added this when the page was a "use client"
// QA checklist. The page is now a server component for the employee
// credentials feature, but the layout still owns metadata so the
// tab title is consistent regardless of future page restructuring.)

export const metadata = { title: "Verification — Nexpura" };

export default function VerificationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

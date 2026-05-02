/**
 * Single-account allowlist for the SaaS platform admin (`/admin/*`).
 *
 * Per Joey 2026-05-02: only this exact email may access platform-level
 * tenant administration, even if `super_admins` ever has additional
 * rows. Belt-and-suspenders: the gate requires both (a) presence in
 * super_admins AND (b) membership of this allowlist.
 */
export const ADMIN_EMAIL_ALLOWLIST: ReadonlySet<string> = new Set([
  "germanijoey@yahoo.com",
]);

export function isAllowlistedAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAIL_ALLOWLIST.has(email.toLowerCase());
}

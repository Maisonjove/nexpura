import { redirect } from "next/navigation";

// Compatibility alias for /bespoke/approve/[token] → /approve/[token].
// Emails + UI always send the customer to /approve/[token], but older
// bookmarks and hand-typed URLs sometimes land here. Without this stub
// the request falls through to the app's auth middleware and dumps the
// customer onto the jeweller login form — which looks like a broken
// product. Redirect preserves the token so valid links Just Work, and
// invalid tokens get the branded invalid-state at /approve/[token].

interface Props {
  params: Promise<{ token: string }>;
}

export default async function LegacyBespokeApproveRedirect({ params }: Props) {
  const { token } = await params;
  redirect(`/approve/${token}`);
}

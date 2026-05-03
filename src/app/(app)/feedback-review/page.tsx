import { promises as fs } from "node:fs";
import path from "node:path";
import FeedbackReviewClient, { type ReviewItem } from "./FeedbackReviewClient";

export const metadata = { title: "Feedback Review — Nexpura" };

const ALL_ITEMS: ReviewItem[] = [
  {
    slug: "segments",
    label: "Customer Segments",
    feedback:
      "same for this one — match the fonts, colors and design palette",
    beforePath: "/feedback-review/before/segments",
    afterPath: "/marketing/segments",
    legacyFile: "src/app/(app)/marketing/segments/SegmentsClientLegacy.tsx",
  },
  {
    slug: "templates",
    label: "Email Templates",
    feedback:
      "this page as well, it looks very ugly again — bright amber buttons and dark inputs",
    beforePath: "/feedback-review/before/templates",
    afterPath: "/marketing/templates",
    legacyFile: "src/app/(app)/marketing/templates/TemplatesClientLegacy.tsx",
  },
  {
    slug: "billing",
    label: "Billing",
    feedback: "this whole page should have been updated with the new design",
    beforePath: "/feedback-review/before/billing",
    afterPath: "/billing",
    legacyFile: "src/app/(app)/billing/BillingClientLegacy.tsx",
  },
  {
    slug: "reminders",
    label: "Service Reminders",
    feedback: "same for this one — generic Tailwind, no nexpura tokens",
    beforePath: "/feedback-review/before/reminders",
    afterPath: "/settings/reminders",
    legacyFile: "src/app/(app)/settings/reminders/RemindersClientLegacy.tsx",
  },
  {
    slug: "website",
    label: "Website Builder",
    feedback: "looks AI-designed, doesn't reflect with any of the outside design",
    beforePath: "/feedback-review/before/website",
    afterPath: "/website",
    legacyFile: "src/app/(app)/website/WebsiteHomeClientLegacy.tsx",
  },
];

async function fileExists(rel: string): Promise<boolean> {
  try {
    await fs.access(path.join(process.cwd(), rel));
    return true;
  } catch {
    return false;
  }
}

export default async function FeedbackReviewPage() {
  const items = await Promise.all(
    ALL_ITEMS.map(async (it) => ({
      ...it,
      pending: await fileExists(it.legacyFile),
    })),
  );

  const visible = items.filter((it) => it.pending);

  return <FeedbackReviewClient items={visible} totalConfirmed={items.length - visible.length} />;
}

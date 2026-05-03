import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getAuthContext } from "@/lib/auth-context";

const SLUG_TO_FILES: Record<string, { legacy: string; beforeDir: string }> = {
  billing: {
    legacy: "src/app/(app)/billing/BillingClientLegacy.tsx",
    beforeDir: "src/app/(app)/feedback-review/before/billing",
  },
  segments: {
    legacy: "src/app/(app)/marketing/segments/SegmentsClientLegacy.tsx",
    beforeDir: "src/app/(app)/feedback-review/before/segments",
  },
  templates: {
    legacy: "src/app/(app)/marketing/templates/TemplatesClientLegacy.tsx",
    beforeDir: "src/app/(app)/feedback-review/before/templates",
  },
  reminders: {
    legacy: "src/app/(app)/settings/reminders/RemindersClientLegacy.tsx",
    beforeDir: "src/app/(app)/feedback-review/before/reminders",
  },
  website: {
    legacy: "src/app/(app)/website/WebsiteHomeClientLegacy.tsx",
    beforeDir: "src/app/(app)/feedback-review/before/website",
  },
};

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!slug || !(slug in SLUG_TO_FILES)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const { legacy, beforeDir } = SLUG_TO_FILES[slug];
  const cwd = process.cwd();

  try {
    await fs.unlink(path.join(cwd, legacy)).catch(() => {});
    await fs.rm(path.join(cwd, beforeDir), { recursive: true, force: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, slug });
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Template } from "@/lib/templates/types";
import { applyTemplate } from "./actions";

export default function TemplateGalleryClient({
  templates,
  embedded = false,
}: {
  templates: Template[];
  // When embedded inside another page (e.g. WebsiteHomeClient's "Your Site"
  // tab), drop the outer max-width wrapper and the duplicate "Back to
  // website builder" + page heading — the host already provides those.
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleApply(template: Template) {
    if (confirmId !== template.id) {
      setConfirmId(template.id);
      return;
    }
    setPendingId(template.id);
    startTransition(async () => {
      const result = await applyTemplate(template.id);
      setPendingId(null);
      setConfirmId(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${template.name} applied. Saved as draft — review then publish.`);
      // Client-side navigate to /website (WebsiteHomeClient) instead of a hard
      // `window.location.href` reload. Pre-fix the hard reload caused a 5–8s
      // skeleton state because Next had to refetch and re-hydrate the whole
      // tree. router.push reuses the existing React tree, and applyTemplate
      // already calls revalidatePath so the new server data is fresh.
      router.push("/website");
      router.refresh();
    });
  }

  const cards = templates.map((t) => {
    const isThisPending = pendingId === t.id && isPending;
    const isConfirming = confirmId === t.id;

    return (
      <article
        key={t.id}
        className="group rounded-2xl border border-stone-200 bg-white overflow-hidden flex flex-col hover:shadow-md transition-shadow"
      >
        {/* Visual thumbnail */}
        <div
          className="relative aspect-[5/3] flex items-end p-5"
          style={{ background: t.thumbnailGradient }}
        >
          <div className="text-white">
            <div
              className="text-2xl sm:text-3xl leading-tight drop-shadow-sm"
              style={{ fontFamily: t.typography.heading }}
            >
              {t.name}
            </div>
            <div
              className="text-white/80 text-xs mt-1 uppercase tracking-widest"
              style={{ fontFamily: t.typography.body }}
            >
              {t.styleKeywords[0]}
            </div>
          </div>
          <div className="absolute top-3 right-3 flex gap-1">
            {[t.palette.primary, t.palette.secondary, t.palette.accent]
              .filter(Boolean)
              .map((c) => (
                <span
                  key={c as string}
                  className="w-3 h-3 rounded-full ring-1 ring-white/50"
                  style={{ backgroundColor: c as string }}
                />
              ))}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3 flex-1">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              {t.name}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">{t.bestFor}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {t.styleKeywords.map((k) => (
              <span
                key={k}
                className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600"
              >
                {k}
              </span>
            ))}
          </div>
          <p className="text-sm text-stone-600 leading-relaxed">
            {t.description}
          </p>

          <div className="mt-auto pt-2 flex flex-col sm:flex-row gap-2">
            <Link
              href={`/website/templates/${t.id}`}
              className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors"
            >
              Preview template
            </Link>
            <button
              onClick={() => handleApply(t)}
              disabled={isThisPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {isThisPending
                ? "Applying…"
                : isConfirming
                  ? "Click again to confirm"
                  : "Use this template"}
            </button>
          </div>
          {isConfirming && !isThisPending && (
            <p className="text-[11px] text-amber-700 -mt-1">
              Applying replaces existing template-managed pages on your site.
            </p>
          )}
        </div>
      </article>
    );
  });

  if (embedded) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-stone-500 px-1">
          Ten polished jewellery website templates. Preview any one, then apply it as a starting point — every page and section is editable in the builder.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{cards}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link
            href="/website"
            className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1"
          >
            ← Back to website builder
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-stone-900 mt-2">
            Pick a template
          </h1>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">
            Ten polished jewellery website templates. Preview any one, then apply it as a starting point — every page and section is editable in the builder.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{cards}</div>
    </div>
  );
}

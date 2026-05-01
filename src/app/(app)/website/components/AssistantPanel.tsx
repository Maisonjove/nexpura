"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import logger from "@/lib/logger";

const QUICK_PROMPTS = [
  "Make it more luxury",
  "Add engagement rings page",
  "Rewrite homepage copy",
  "Change colours to black and champagne",
  "Add bespoke section",
  "Improve SEO",
  "Make it more minimal",
  "Add repairs page",
  "Add watch section",
  "Make it bridal focused",
];

const NO_TEMPLATE_PROMPTS = [
  "Which template fits a bridal jeweller?",
  "Show me a minimal template",
  "What if I sell mostly watches?",
  "Compare Maison and Atelier templates",
];

type ActionResult = { type: string; applied: boolean; error?: string };
type ChatTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; actions: ActionResult[] }
  | { role: "error"; text: string };

export default function AssistantPanel({
  variant = "sidebar",
  hasTemplate = true,
}: {
  // tenantId is intentionally NOT a prop — the server resolves it from the
  // session. We accept the same shape callers were using to avoid surprise.
  tenantId?: string;
  variant?: "sidebar" | "modal";
  // When no template has been applied, render an empty-state hint above the
  // quick prompts. Chat input remains enabled — the AI route handles
  // template-less tenants gracefully.
  hasTemplate?: boolean;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setTurns((prev) => [...prev, { role: "user", text: trimmed }]);
    setBusy(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch("/api/ai/website/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = (await res.json()) as
        | { summary: string; actions: ActionResult[] }
        | { error: string };

      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : "AI request failed.";
        setTurns((prev) => [...prev, { role: "error", text: msg }]);
        return;
      }

      setTurns((prev) => [
        ...prev,
        { role: "assistant", text: data.summary, actions: data.actions },
      ]);

      const appliedCount = data.actions.filter((a) => a.applied).length;
      if (appliedCount > 0) {
        toast.success(`${appliedCount} change${appliedCount === 1 ? "" : "s"} saved as draft`);
        // Refresh page list / draft counter.
        router.refresh();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        setTurns((prev) => [
          ...prev,
          { role: "error", text: "AI request timed out. Please try again." },
        ]);
      } else {
        logger.error(err);
        setTurns((prev) => [
          ...prev,
          { role: "error", text: "AI request failed. Please try again." },
        ]);
      }
    } finally {
      setBusy(false);
      // Scroll to bottom on next tick.
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }

  const heightClass = variant === "modal" ? "h-full" : "max-h-[80vh]";

  return (
    <div
      className={`flex flex-col rounded-xl border border-stone-200 bg-white overflow-hidden ${heightClass}`}
    >
      <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <span className="text-amber-700">✦</span>
          <div>
            <div className="text-sm font-semibold text-stone-900">Website assistant</div>
            <div className="text-[11px] text-stone-500">
              Edits land as drafts — manual publish required.
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {turns.length === 0 && !hasTemplate && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
            Pick a template first to unlock customisation. Or ask me anything about which template fits your business.
          </div>
        )}
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              {hasTemplate
                ? "Tell the assistant what to change. A few ideas:"
                : "A few questions you can ask right now:"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(hasTemplate ? QUICK_PROMPTS : NO_TEMPLATE_PROMPTS).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  disabled={busy}
                  className="text-[11px] px-2.5 py-1.5 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, idx) => (
          <Turn key={idx} turn={t} />
        ))}
        {busy && (
          <div className="text-xs text-stone-400 animate-pulse">Thinking…</div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-stone-100 p-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Tell the assistant what to change…"
          rows={2}
          className="flex-1 resize-none text-sm bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-stone-400"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-3 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-stone-900 text-white px-3 py-2 text-sm">
          {turn.text}
        </div>
      </div>
    );
  }
  if (turn.role === "error") {
    return (
      <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
        {turn.text}
      </div>
    );
  }
  // Assistant
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-stone-100 text-stone-900 px-3 py-2 text-sm space-y-2 whitespace-pre-line">
        <div>{turn.text}</div>
        {turn.actions.length > 0 && (
          <ul className="text-[11px] text-stone-600 space-y-0.5 border-t border-stone-200 pt-2">
            {turn.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className={a.applied ? "text-green-700" : "text-amber-700"}>
                  {a.applied ? "✓" : "·"}
                </span>
                <span className="font-mono text-[10px] text-stone-500">{a.type}</span>
                {!a.applied && a.error ? (
                  <span className="text-stone-500">— {a.error}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

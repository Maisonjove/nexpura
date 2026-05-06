"use client";

/**
 * Manager PIN modal — set + verify states, embedded in the refund
 * flow (SaleDetailClient) per A1 Day 4 component 6.
 *
 * Triggered when processRefundV2 returns the "Manager PIN required"
 * 403 — refund beyond the 30-day window or refund without an
 * original sale. Two states:
 *
 *   mode='set'    — user has no PIN yet. Form: PIN + Confirm PIN.
 *                   Submit calls setManagerPin from
 *                   /settings/manager-pin/actions.ts. After success,
 *                   onSubmit(pin) fires so the caller can retry the
 *                   refund with the PIN attached.
 *
 *   mode='verify' — user has a PIN. Form: PIN only.
 *                   Submit calls verifyManagerPin. After success,
 *                   onSubmit(pin) fires.
 *
 * Edge cases handled:
 *   - 3 wrong attempts in a row → rate-limit lockout. The
 *     verifyManagerPin server action returns
 *     "Too many PIN attempts. Please wait a minute and retry." —
 *     surfaced as inline error.
 *   - Trivial PIN rejection (0000, 1234, etc.) — surfaced as
 *     inline error from setManagerPin.
 *   - Modal cancellation → onCancel fires and the parent aborts
 *     the refund attempt cleanly. PIN stays unset (set mode) /
 *     unverified (verify mode); next refund attempt re-prompts.
 */

import { useState, useTransition } from "react";

interface Props {
  /** "set" if user has no PIN configured; "verify" if they do. */
  mode: "set" | "verify";
  /** Action to set/save the PIN (returns { success?, error? }). */
  onSetPin?: (pin: string) => Promise<{ success?: boolean; error?: string }>;
  /** Action to verify the PIN (returns { valid?, error? }). */
  onVerifyPin?: (
    pin: string,
  ) => Promise<{ valid?: boolean; error?: string }>;
  /** Fired with the verified PIN — caller retries the gated action. */
  onSubmit: (pin: string) => void;
  /** Fired on cancel — caller aborts the gated action. */
  onCancel: () => void;
}

export default function ManagerPinModal({
  mode,
  onSetPin,
  onVerifyPin,
  onSubmit,
  onCancel,
}: Props) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function isValidPin(value: string): boolean {
    return /^\d{4,6}$/.test(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPin(pin)) {
      setError("PIN must be 4–6 digits, numeric only.");
      return;
    }

    if (mode === "set") {
      if (pin !== confirmPin) {
        setError("PINs don't match.");
        return;
      }
      if (!onSetPin) {
        setError("Set-PIN handler missing.");
        return;
      }
      startTransition(async () => {
        const result = await onSetPin(pin);
        if (result.error) {
          setError(result.error);
          return;
        }
        // PIN set successfully — fire onSubmit so caller retries.
        onSubmit(pin);
      });
    } else {
      // verify mode
      if (!onVerifyPin) {
        setError("Verify-PIN handler missing.");
        return;
      }
      startTransition(async () => {
        const result = await onVerifyPin(pin);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (!result.valid) {
          setError("PIN incorrect. Please try again.");
          return;
        }
        // PIN verified — fire onSubmit so caller retries.
        onSubmit(pin);
      });
    }
  }

  const title = mode === "set" ? "Set your manager PIN" : "Enter your manager PIN";
  const description =
    mode === "set"
      ? "This refund needs manager authorization. Set a 4–6 digit PIN now to authorize. You'll re-use it for future override refunds (sales older than 30 days, or refunds without an original sale)."
      : "This sale is older than 30 days — a manager PIN is required to refund it.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="manager-pin-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="text-stone-400 hover:text-stone-900 text-xl"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-stone-600 mb-5">{description}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700 block mb-1">
              {mode === "set" ? "PIN (4–6 digits)" : "PIN"}
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ""))}
              disabled={isPending}
              data-testid="manager-pin-input"
              className="w-full border border-stone-300 rounded px-3 py-2 text-lg tracking-widest text-center font-mono"
              placeholder="••••"
            />
          </label>

          {mode === "set" && (
            <label className="block">
              <span className="text-sm font-medium text-stone-700 block mb-1">
                Confirm PIN
              </span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/[^\d]/g, ""))
                }
                disabled={isPending}
                data-testid="manager-pin-confirm-input"
                className="w-full border border-stone-300 rounded px-3 py-2 text-lg tracking-widest text-center font-mono"
                placeholder="••••"
              />
            </label>
          )}

          {error && (
            <div
              role="alert"
              data-testid="manager-pin-error"
              className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-stone-700 hover:text-stone-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !isValidPin(pin)}
              data-testid="manager-pin-submit"
              className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded disabled:opacity-50"
            >
              {isPending
                ? mode === "set"
                  ? "Saving…"
                  : "Verifying…"
                : mode === "set"
                  ? "Set PIN + Authorize"
                  : "Authorize"}
            </button>
          </div>
        </form>

        {mode === "set" && (
          <p className="text-xs text-stone-500 mt-4">
            Avoid sequential or repeated digits like 1234 or 0000 — those
            are blocked. Your PIN is hashed at rest; you can reset it
            from Settings → Profile.
          </p>
        )}
      </div>
    </div>
  );
}

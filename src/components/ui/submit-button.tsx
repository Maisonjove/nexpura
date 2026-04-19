"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Returns `true` only after the component has mounted on the client, i.e.
 * after React has hydrated the tree and attached event handlers. Use this
 * to gate a submit button so that a click before `onSubmit` is attached
 * cannot fall through to native HTML form submission (which would POST the
 * form to the current URL with no `action`, silently losing the submit).
 */
export function useFormHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}

type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children" | "disabled"> & {
  isPending?: boolean;
  idleLabel: ReactNode;
  pendingLabel?: ReactNode;
  preparingLabel?: ReactNode;
  /** Extra disabled condition on top of hydration + pending (e.g. validation). */
  disabled?: boolean;
};

/**
 * Hydration-safe submit button. Renders disabled + "Preparing…" until the
 * React tree hydrates, then swaps to the normal idle/pending label.
 *
 * Use for any `<form onSubmit={...}>` where a fast user could click submit
 * before React attaches the handler. Without this guard, the click triggers
 * a native form POST (no server action fires, form state lost, user thinks
 * they saved when they didn't).
 */
export function SubmitButton({
  isPending = false,
  idleLabel,
  pendingLabel,
  preparingLabel = "Preparing…",
  disabled = false,
  ...buttonProps
}: SubmitButtonProps) {
  const hydrated = useFormHydrated();
  const effectivelyDisabled = !hydrated || isPending || disabled;
  const label = !hydrated ? preparingLabel : isPending ? (pendingLabel ?? idleLabel) : idleLabel;

  return (
    <button
      type="submit"
      disabled={effectivelyDisabled}
      {...buttonProps}
    >
      {label}
    </button>
  );
}

/**
 * Reload-blocker registry — pages with un-savable in-progress state
 * register here so the deploy-skew soft-reload (DeployVersionBanner)
 * defers until they're idle.
 *
 * Per QA agent's C-06 verification ask (2026-05-05): "Behaviour on the
 * POS page mid-sale — soft reload must not lose an in-progress cart.
 * If it would, gate the reload on idle state."
 *
 * USAGE (page-level):
 *
 *   import { useReloadBlocker } from '@/lib/reload-blockers';
 *
 *   function POSPage() {
 *     const cartHasItems = cart.lineItems.length > 0;
 *     useReloadBlocker('pos-cart', cartHasItems);
 *     // ...
 *   }
 *
 * When `cartHasItems` becomes false (cart cleared / sale completed),
 * the blocker auto-releases. If a deploy-skew was detected and the
 * banner was waiting, the reload fires immediately on release.
 *
 * USAGE (consumer — DeployVersionBanner):
 *
 *   import { isAnyReloadBlocked, onReloadBlockersChange } from '@/lib/reload-blockers';
 *
 *   if (isAnyReloadBlocked()) {
 *     // Defer reload; subscribe to changes and reload when registry empty
 *     const unsub = onReloadBlockersChange(() => {
 *       if (!isAnyReloadBlocked()) reload();
 *     });
 *   } else {
 *     reload();
 *   }
 *
 * Why a registry instead of a single boolean: multiple pages may have
 * concurrent blockers (e.g. POS cart + repair-intake form). All must
 * release before reload is safe.
 *
 * Why module-state instead of React context: the banner is mounted at
 * the root layout. Pages that block live deeper in the tree. Module
 * state is the simplest cross-tree signaling primitive that doesn't
 * require lifting state to the root.
 */

import { useEffect } from 'react';

const blockers = new Set<string>();
const subscribers = new Set<() => void>();

function notify(): void {
  for (const fn of subscribers) {
    try { fn(); } catch { /* never let one bad subscriber kill the rest */ }
  }
}

/** Block reload while `name` is registered. Idempotent on re-add. */
export function blockReload(name: string): void {
  if (blockers.has(name)) return;
  blockers.add(name);
  notify();
}

/** Release the named blocker. Idempotent on absent. */
export function releaseReload(name: string): void {
  if (!blockers.has(name)) return;
  blockers.delete(name);
  notify();
}

/** True iff any blocker is currently registered. */
export function isAnyReloadBlocked(): boolean {
  return blockers.size > 0;
}

/** Snapshot of current blocker names — for telemetry / debugging only. */
export function getReloadBlockers(): string[] {
  return Array.from(blockers);
}

/** Subscribe to registry changes. Returns an unsubscribe function. */
export function onReloadBlockersChange(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

/**
 * React hook — block reload while `blocked === true`. Releases automatically
 * on unmount or when `blocked` flips to false.
 *
 * Pages that hold un-savable state (POS cart, repair intake form, bespoke
 * approval flow, etc.) should call this with their canonical name + a
 * boolean that's true iff the page would lose data on reload.
 */
export function useReloadBlocker(name: string, blocked: boolean): void {
  useEffect(() => {
    if (blocked) {
      blockReload(name);
      return () => releaseReload(name);
    }
    return undefined;
  }, [name, blocked]);
}

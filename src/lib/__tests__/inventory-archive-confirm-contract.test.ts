import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test for the L-01 inventory-archive confirmation requirement.
 *
 * Audit ID L-01 (desktop-Opus): "Archive item → confirm modal."
 *
 * Investigation (2026-05-05): both archive surfaces ALREADY implement
 * a 2-step confirm-then-archive flow. This test pins the contract
 * so a future refactor (e.g., extracting the modal into a shared
 * <ConfirmDialog>, removing the visible button copy, switching to a
 * shadcn Dialog component) can't silently regress to a one-click
 * destructive archive.
 *
 * Surfaces in scope:
 *   - src/app/(app)/inventory/[id]/ItemDetailClient.tsx
 *   - src/app/(app)/inventory/StockDetailModal.tsx
 *
 * Both reach the same destructive server action (archiveInventoryItem
 * / archiveStockItem). Both must:
 *   1. Have a confirm-modal state variable (showArchiveConfirm /
 *      showDeleteConfirm).
 *   2. The user-facing Archive button must SET the modal state, not
 *      call the destructive action directly.
 *   3. The modal must offer a Cancel path that resets state without
 *      calling the destructive action.
 *   4. The modal must label the destructive button with copy that
 *      identifies it as destructive (Archive — not Delete vs.
 *      Cancel — not Confirm).
 */

const itemDetailClient = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/inventory/[id]/ItemDetailClient.tsx"),
  "utf8",
);

const stockDetailModal = fs.readFileSync(
  path.resolve(__dirname, "../../app/(app)/inventory/StockDetailModal.tsx"),
  "utf8",
);

describe("ItemDetailClient — archive requires confirmation", () => {
  it("declares a showArchiveConfirm state", () => {
    expect(itemDetailClient).toMatch(
      /useState.*showArchiveConfirm|setShowArchiveConfirm/,
    );
  });

  it("Archive button on the page body opens the confirm modal — does NOT call archiveInventoryItem directly", () => {
    // The user-facing Archive trigger on the page must call
    // setShowArchiveConfirm(true). The actual archiveInventoryItem
    // call lives inside the modal's confirm button (handleArchive).
    expect(itemDetailClient).toMatch(/setShowArchiveConfirm\(true\)/);

    // Find every JSX onClick that references archiveInventoryItem
    // directly — there should be none. (handleArchive is allowed,
    // because it's the confirm-modal's confirm button handler.)
    const directOnClick = itemDetailClient.match(
      /onClick=\{[^}]*archiveInventoryItem\([^}]*\}/g,
    );
    expect(directOnClick).toBeNull();
  });

  it("has a handleArchive function that wraps archiveInventoryItem", () => {
    expect(itemDetailClient).toMatch(/async\s+function\s+handleArchive/);
    expect(itemDetailClient).toMatch(/await\s+archiveInventoryItem\(/);
  });

  it("modal renders only when showArchiveConfirm is true", () => {
    // Conditional JSX render — must reference showArchiveConfirm
    // adjacent to a JSX-element open. The exact predicate may include
    // additional guards (e.g. !readOnly && showArchiveConfirm) so we
    // just look for the pattern `showArchiveConfirm && <`.
    expect(itemDetailClient).toMatch(/showArchiveConfirm\s*&&\s*\(/);
  });

  it("modal has both Cancel and Archive buttons with explicit copy", () => {
    expect(itemDetailClient).toMatch(/>\s*Cancel\s*</);
    // The destructive button text changes during the in-flight state
    // (archiving ? "Archiving..." : "Archive").
    expect(itemDetailClient).toMatch(/Archiving\.\.\."\s*:\s*"Archive/);
  });
});

describe("StockDetailModal — archive requires confirmation", () => {
  it("declares a showDeleteConfirm state", () => {
    // Modal predates the standard naming and uses showDeleteConfirm
    // even though the action is "archive". Behaviour is identical
    // (soft-delete = archive); test allows either naming.
    expect(stockDetailModal).toMatch(/showDeleteConfirm|showArchiveConfirm/);
  });

  it("Archive button onClick opens the confirm modal — does NOT call archiveStockItem directly", () => {
    expect(stockDetailModal).toMatch(/setShowDeleteConfirm\(true\)/);

    const directOnClick = stockDetailModal.match(
      /onClick=\{[^}]*archiveStockItem\([^}]*\}/g,
    );
    expect(directOnClick).toBeNull();
  });

  it("has a handleDelete (or handleArchive) function that wraps archiveStockItem", () => {
    expect(stockDetailModal).toMatch(/handleDelete|handleArchive/);
    expect(stockDetailModal).toMatch(/await\s+archiveStockItem\(/);
  });

  it("modal renders only when showDeleteConfirm is true", () => {
    expect(stockDetailModal).toMatch(
      /\{showDeleteConfirm\s*&&[\s\S]{0,40}<div/,
    );
  });

  it("modal labels Cancel and Archive separately (not yes/no)", () => {
    expect(stockDetailModal).toMatch(/>\s*Cancel\s*</);
    expect(stockDetailModal).toMatch(/>\s*Archive\s*</);
  });

  it("modal heading + body explicitly call out 'archive', not generic 'delete'", () => {
    // Archive copy matters — Joey's product call is that archive is
    // recoverable. A "Delete?" heading would mislead the user into
    // thinking the action is permanent.
    expect(stockDetailModal).toMatch(/Archive Item\?/);
  });
});

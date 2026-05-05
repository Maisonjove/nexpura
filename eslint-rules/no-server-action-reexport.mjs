/**
 * Custom ESLint rule: forbid `export { x } from "y"` re-exports inside
 * "use server" files.
 *
 * Background — see CONTRIBUTING.md §14 for the full rationale and the
 * canonical PR #187 incident. Short version:
 *
 *   A bare `export { x } from "y"` re-export inside a file with a
 *   "use server" directive at the top causes the Next.js SWC server-
 *   action transform to emit a module with NO exports at all. Not
 *   just the re-exported symbol — every local export from the file
 *   becomes invisible to the bundler.
 *
 *   `pnpm tsc --noEmit` is happy because re-exports are valid TS.
 *   `pnpm vitest run` is happy because contract tests grep source.
 *   Only `pnpm build` (= the Vercel deploy pipeline) catches it.
 *
 * The trap caught us once (PR #187, commit fbd2d0c0 reverted it). This
 * rule fires at lint time so the build never has to.
 *
 *   ❌ BAD
 *   "use server";
 *   export { inviteTeamMember } from "../roles/actions";
 *
 *   ✅ GOOD — drop the re-export, have callers import direct from canonical.
 *   "use server";
 *   // (only local exports here; consumers import inviteTeamMember
 *   //  directly from "../roles/actions")
 *
 * Scope of the check:
 *   - Fires only on files whose first non-comment, non-empty statement
 *     is a "use server" string-literal directive (matches the pattern
 *     Next.js's bundler keys on).
 *   - Reports both `ExportNamedDeclaration` with a source (the bare
 *     `export { x } from "y"` shape) and `ExportAllDeclaration`
 *     (`export * from "y"`).
 *   - Type-only re-exports (`export type { T } from "y"`) do not
 *     trigger the SWC trap and are allowed.
 *   - To suppress for a deliberate exception, use eslint-disable-next-line.
 */

const FILE_DIRECTIVE = "use server";

function hasUseServerDirective(programNode) {
  // The "use server" directive must be the first statement of the file
  // (or after other directives like "use client" but Next.js doesn't
  // mix them — first directive wins). Walk leading statements while
  // they are ExpressionStatement of a string literal directive.
  for (const stmt of programNode.body) {
    if (stmt.type !== "ExpressionStatement") return false;
    if (
      stmt.expression?.type === "Literal" &&
      typeof stmt.expression.value === "string"
    ) {
      if (stmt.expression.value === FILE_DIRECTIVE) return true;
      // Some other directive — keep walking.
      continue;
    }
    return false;
  }
  return false;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Forbid `export { x } from "y"` re-exports inside "use server" files (breaks Next.js SWC bundler — see CONTRIBUTING §14).',
    },
    schema: [],
    messages: {
      reexport:
        'Re-exports from a "use server" file silently break the Next.js SWC bundler — every other export from this file disappears too. Have the consumer import directly from the canonical source instead. See CONTRIBUTING.md §14 (and PR #187 / commit fbd2d0c0 for the canonical incident).',
    },
  },
  create(context) {
    let isUseServerFile = false;

    return {
      Program(node) {
        isUseServerFile = hasUseServerDirective(node);
      },
      ExportNamedDeclaration(node) {
        if (!isUseServerFile) return;
        // `export { x } from "y"` — node.source is non-null.
        if (node.source == null) return;
        // Type-only re-exports don't go through the value-export path
        // the SWC transform mangles. Allow them.
        if (node.exportKind === "type") return;
        // If every specifier is a type-only specifier, also allow.
        if (
          node.specifiers.length > 0 &&
          node.specifiers.every((s) => s.exportKind === "type")
        ) {
          return;
        }
        context.report({ node, messageId: "reexport" });
      },
      ExportAllDeclaration(node) {
        if (!isUseServerFile) return;
        if (node.exportKind === "type") return;
        context.report({ node, messageId: "reexport" });
      },
    };
  },
};

export default rule;

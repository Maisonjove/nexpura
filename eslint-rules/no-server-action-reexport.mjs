/**
 * Custom ESLint rule: enforce Next.js's "use server" file constraint —
 * only directly-defined async functions may be exported from a file
 * with a `"use server"` directive at the top. Anything else (a
 * re-export, a non-async function, a const, a class, a default-export
 * of a non-async value) makes the SWC server-action transform emit a
 * module with NO exports at all — every local async function in the
 * file disappears too.
 *
 * Background — see CONTRIBUTING.md §14 for the full rationale.
 *
 * Two canonical incidents this rule was extended in response to:
 *
 *   1. PR #187 (commit fbd2d0c0). Bare re-export shape:
 *        "use server";
 *        export { inviteTeamMember } from "../roles/actions";
 *      → "module has no exports at all". The rule's first cut covered
 *      this shape.
 *
 *   2. PR #161 → wave-2 hotfix #195 (commit 99d02d4b). Non-async const
 *      shape:
 *        "use server";
 *        export const SALES_LIST_PAGE_SIZE = 50;
 *      → SWC error "Only async functions are allowed to be exported in
 *      a 'use server' file" + same downstream cascade. The rule was
 *      extended to also catch this shape.
 *
 * Detection toolchain:
 *   `pnpm tsc --noEmit` happy — both shapes are valid TypeScript.
 *   `pnpm vitest run` happy — contract tests grep source.
 *   `pnpm build` (= Vercel pipeline) is the only thing that catches
 *      either shape. This rule fires at lint time so the build never
 *      has to.
 *
 * Allowed shapes inside a "use server" file:
 *   ✅ export async function x(...)   — the canonical pattern
 *   ✅ export type { T } from "y"      — type-only re-export (erased)
 *   ✅ export type { T }               — local type-only export (erased)
 *   ✅ export interface X {...}        — type-only (erased)
 *   ✅ export type X = ...             — type alias (erased)
 *   (no value exports outside the async-function shape)
 *
 * Forbidden shapes:
 *   ❌ export { x } from "y"           — re-export (PR #187)
 *   ❌ export * from "y"               — star re-export
 *   ❌ export const X = ...            — non-async const (PR #161)
 *   ❌ export let X = ...              — non-async let
 *   ❌ export var X = ...              — non-async var
 *   ❌ export function x(...)          — non-async function
 *   ❌ export class X {...}            — class
 *   ❌ export default X                — non-async-function default
 *   ❌ export { x }                    — local re-binding (re-exports
 *                                         a value identifier; same trap
 *                                         shape as bare re-export)
 *
 * Each forbidden shape gets a dedicated message ID so the lint output
 * points the engineer at the right fix shape — usually "extract to a
 * sibling .ts file without 'use server'".
 *
 * Suppress for a deliberate exception with `eslint-disable-next-line`.
 */

const FILE_DIRECTIVE = "use server";

function hasUseServerDirective(programNode) {
  // The "use server" directive must be the first statement of the file
  // (or after other directives — Next.js doesn't mix them, but be
  // defensive). Walk leading statements while they are
  // ExpressionStatement of a string literal directive.
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
        'Enforce "use server" file constraint — only async functions may be exported. Re-exports, const/let/var, non-async functions, classes, and non-async defaults all break the Next.js SWC bundler. See CONTRIBUTING §14.',
    },
    schema: [],
    messages: {
      reexport:
        'Re-exports from a "use server" file silently break the Next.js SWC bundler — every other export from this file disappears too. Have the consumer import directly from the canonical source instead. See CONTRIBUTING.md §14 (PR #187 / commit fbd2d0c0).',
      constLetVar:
        'Non-async exports (const/let/var) inside a "use server" file are forbidden by SWC ("Only async functions are allowed to be exported in a \'use server\' file"). Move {{kind}} {{name}} to a sibling file without the "use server" directive and import from there. See CONTRIBUTING.md §14 (PR #161 / commit 99d02d4b).',
      nonAsyncFunction:
        'Non-async function exports inside a "use server" file are forbidden by SWC. Either make {{name}} async, or move it to a sibling file without "use server". See CONTRIBUTING.md §14.',
      classExport:
        'Class exports inside a "use server" file are forbidden by SWC. Move class {{name}} to a sibling file without "use server" and import from there. See CONTRIBUTING.md §14.',
      defaultNonAsync:
        'Default exports of non-async-function values inside a "use server" file are forbidden by SWC. The only allowed shape is `export default async function`. See CONTRIBUTING.md §14.',
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

        // Type-only export modifier — fine in any shape.
        if (node.exportKind === "type") return;

        // `export { x } from "y"` — node.source non-null = re-export.
        if (node.source != null) {
          // If every specifier is a type-only specifier, allow.
          if (
            node.specifiers.length > 0 &&
            node.specifiers.every((s) => s.exportKind === "type")
          ) {
            return;
          }
          context.report({ node, messageId: "reexport" });
          return;
        }

        // `export { x }` (no `from`) — local re-binding. Same trap
        // shape as bare re-export when `x` is a value identifier; if
        // every specifier is type-only, allow.
        if (node.declaration == null) {
          if (
            node.specifiers.length > 0 &&
            node.specifiers.every((s) => s.exportKind === "type")
          ) {
            return;
          }
          context.report({ node, messageId: "reexport" });
          return;
        }

        // `export <declaration>` — declaration shape determines what's
        // allowed.
        const decl = node.declaration;

        // Type-only declarations are always fine — they get erased.
        if (
          decl.type === "TSTypeAliasDeclaration" ||
          decl.type === "TSInterfaceDeclaration"
        ) {
          return;
        }

        // VariableDeclaration: const / let / var — all forbidden.
        if (decl.type === "VariableDeclaration") {
          // `declare const X` is type-only (TS ambient) — allow.
          if (decl.declare === true) return;
          const names = (decl.declarations || [])
            .map((d) => (d.id?.type === "Identifier" ? d.id.name : "?"))
            .join(", ");
          context.report({
            node: decl,
            messageId: "constLetVar",
            data: { kind: decl.kind, name: names || "?" },
          });
          return;
        }

        // FunctionDeclaration: async required.
        if (decl.type === "FunctionDeclaration") {
          if (decl.async) return;
          context.report({
            node: decl,
            messageId: "nonAsyncFunction",
            data: { name: decl.id?.name ?? "?" },
          });
          return;
        }

        // ClassDeclaration: forbidden.
        if (decl.type === "ClassDeclaration") {
          context.report({
            node: decl,
            messageId: "classExport",
            data: { name: decl.id?.name ?? "?" },
          });
          return;
        }

        // Other declaration shapes — be lenient (TS enum etc. are rare
        // in practice and would also fail SWC; but flag conservatively
        // as a non-async function-equivalent only when we can prove it).
      },

      ExportAllDeclaration(node) {
        if (!isUseServerFile) return;
        if (node.exportKind === "type") return;
        context.report({ node, messageId: "reexport" });
      },

      ExportDefaultDeclaration(node) {
        if (!isUseServerFile) return;
        const decl = node.declaration;
        // The only allowed default export shape: `export default async function`.
        if (decl.type === "FunctionDeclaration" && decl.async) return;
        if (decl.type === "FunctionExpression" && decl.async) return;
        if (decl.type === "ArrowFunctionExpression" && decl.async) return;
        // Class default export — forbidden.
        if (decl.type === "ClassDeclaration") {
          context.report({ node, messageId: "classExport", data: { name: decl.id?.name ?? "default" } });
          return;
        }
        context.report({ node, messageId: "defaultNonAsync" });
      },
    };
  },
};

export default rule;

/**
 * Contract for the local ESLint rule `local/no-server-action-reexport`.
 *
 * Pins the trap that caught us on PR #187: a bare
 * `export {x} from "y"` inside a "use server" file silently breaks
 * Next.js's SWC bundler — every export from the file disappears at
 * build time. tsc + vitest miss it; this rule catches it at lint time.
 *
 * See CONTRIBUTING.md §14 for the full rationale.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Linter } from "eslint";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

let rule: unknown;

beforeAll(async () => {
  // Load the rule via dynamic import. The rule is an ESM .mjs at the
  // repo root, so the path needs to climb out of src/lib/__tests__.
  const mod = await import(
    path.resolve(__dirname, "../../../eslint-rules/no-server-action-reexport.mjs")
  );
  rule = mod.default;
});

function lintWith(rule: unknown, code: string, fileName = "actions.ts") {
  const linter = new Linter();
  return linter.verify(
    code,
    [
      {
        files: ["**/*.ts"],
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
        },
        plugins: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          local: { rules: { "no-server-action-reexport": rule as any } },
        },
        rules: { "local/no-server-action-reexport": "error" },
      },
    ],
    fileName,
  );
}

describe("local/no-server-action-reexport", () => {
  it("flags `export { x } from \"y\"` inside a \"use server\" file", () => {
    const code = `"use server";\nexport { foo } from "./other";\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
    expect(messages[0].messageId ?? messages[0].message).toMatch(
      /reexport|silently break|server-action/i,
    );
  });

  it("flags `export * from \"y\"` inside a \"use server\" file", () => {
    const code = `"use server";\nexport * from "./other";\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
  });

  it("does NOT flag local exports in a \"use server\" file", () => {
    const code = `"use server";\nexport async function bar() { return 1; }\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(0);
  });

  it("does NOT flag re-exports in a non-\"use server\" file", () => {
    const code = `export { foo } from "./other";\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(0);
  });

  it("does NOT flag a single string-literal directive that is not 'use server'", () => {
    // Sanity check the directive matcher: a "use client" file with the
    // same re-export shape must NOT trigger the rule.
    const code = `"use client";\nexport { foo } from "./other";\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(0);
  });

  // PR #161 → wave-2 hotfix #195 (commit 99d02d4b) extended the rule
  // to cover non-async export shapes. The SWC transform refuses
  // anything in a "use server" file that isn't a directly-defined
  // async function, but the original rule only caught re-exports.
  // These cases pin the extended coverage.

  it("flags `export const X = ...` inside a \"use server\" file (PR #161 shape)", () => {
    const code = `"use server";\nexport const SALES_LIST_PAGE_SIZE = 50;\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
    expect(messages[0].messageId).toBe("constLetVar");
  });

  it("flags `export let X = ...` inside a \"use server\" file", () => {
    const code = `"use server";\nexport let counter = 0;\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
    expect(messages[0].messageId).toBe("constLetVar");
  });

  it("flags `export var X = ...` inside a \"use server\" file", () => {
    const code = `"use server";\nexport var legacy = 1;\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
    expect(messages[0].messageId).toBe("constLetVar");
  });

  it("flags `export function X(...)` (non-async) inside a \"use server\" file", () => {
    const code = `"use server";\nexport function helper() { return 1; }\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
    expect(messages[0].messageId).toBe("nonAsyncFunction");
  });

  it("flags `export class X {...}` inside a \"use server\" file", () => {
    const code = `"use server";\nexport class Service {}\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
    expect(messages[0].messageId).toBe("classExport");
  });

  it("flags `export default X` (non-async-function) inside a \"use server\" file", () => {
    const code = `"use server";\nconst x = 1;\nexport default x;\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
    expect(messages[0].messageId).toBe("defaultNonAsync");
  });

  it("flags `export default class X {}` inside a \"use server\" file", () => {
    const code = `"use server";\nexport default class Service {}\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(1);
    expect(messages[0].messageId).toBe("classExport");
  });

  it("does NOT flag `export default async function` inside a \"use server\" file", () => {
    const code = `"use server";\nexport default async function action() { return 1; }\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(0);
  });

  it("does NOT flag `export const` in a non-\"use server\" file (sales-types.ts shape)", () => {
    // The fix shape: extract non-async exports to a sibling file
    // without "use server". Pin that this file is not flagged.
    // (Default parser doesn't understand TS syntax, so test plain JS.)
    const code = `export const SALES_LIST_PAGE_SIZE = 50;\nexport function helper() {}\n`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(0);
  });

  it("flags multiple violations in the same file", () => {
    const code = `"use server";
export const X = 1;
export class Y {}
export function z() {}
export async function valid() { return 1; }
`;
    const messages = lintWith(rule, code);
    expect(messages.length).toBe(3);
  });
});

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
});

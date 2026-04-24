/**
 * CRIT-5 contract — /api/ai/chat cross-tenant conversation leak.
 *
 * Static-analysis contract that locks in the three fixes on
 * src/app/api/ai/chat/route.ts:
 *
 *   1. When `conversationId` is supplied in the body, the route verifies
 *      the matching ai_conversations row belongs to the caller's tenant
 *      and rejects with 404 otherwise.
 *   2. The ai_messages history select is scoped by both conversation_id
 *      AND tenant_id.
 *   3. The ai_conversations.updated_at poke in `onFinish` is scoped by
 *      both id AND tenant_id so a mis-routed convoId can't silently
 *      touch another tenant's row.
 *
 * Matches the pattern of tenant-isolation-contract.test.ts.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

describe("CRIT-5 /api/ai/chat — no cross-tenant conversation leak", () => {
  const src = readSrc("app/api/ai/chat/route.ts");

  it("verifies ai_conversations belongs to tenant before using conversationId", () => {
    // We expect an explicit lookup that scopes both id AND tenant_id,
    // AND that rejects with 404 when the row is absent.
    expect(src).toMatch(/from\(["']ai_conversations["']\)/);
    // The verification block must include a tenant_id filter matched
    // against the session-derived tenantId.
    // The conversationId verification block opens with `if (conversationId) {`
    // and typically contains a destructuring expression whose `}` would
    // match a non-greedy regex prematurely. Walk forward from the opening
    // brace tracking depth so we capture the full block.
    const openMatch = src.match(/if\s*\(\s*conversationId\s*\)\s*\{/);
    let verifyBlock: string | undefined;
    if (openMatch && openMatch.index !== undefined) {
      const start = openMatch.index + openMatch[0].length - 1; // on the `{`
      let depth = 0;
      for (let i = start; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) {
            verifyBlock = src.slice(openMatch.index, i + 1);
            break;
          }
        }
      }
    }
    expect(verifyBlock).toBeDefined();
    expect(verifyBlock!).toMatch(/\.eq\(\s*["']id["']\s*,\s*conversationId\s*\)/);
    expect(verifyBlock!).toMatch(/\.eq\(\s*["']tenant_id["']\s*,\s*tenantId\s*\)/);
    expect(verifyBlock!).toMatch(/status:\s*404/);
  });

  it("fetches ai_messages history scoped by both conversation_id and tenant_id", () => {
    // Locate every .from("ai_messages").select(...).eq(...)... chain and
    // require at least one with both eq filters.
    const matches = src.match(
      /from\(["']ai_messages["']\)\.select\([^)]*\)[\s\S]{0,400}?\.order\(/g
    );
    expect(matches, "expected at least one ai_messages select chain").toBeTruthy();
    const anyTenantScoped = (matches ?? []).some(
      (chunk) =>
        /\.eq\(\s*["']conversation_id["']/.test(chunk) &&
        /\.eq\(\s*["']tenant_id["']\s*,\s*tenantId\s*\)/.test(chunk)
    );
    expect(anyTenantScoped).toBe(true);
  });

  it("scopes the ai_conversations.updated_at touch by tenant_id", () => {
    // The onFinish stream handler updates updated_at — it must include
    // a tenant_id filter so a mis-routed convoId can't silently poke
    // another tenant's row.
    const touch = src.match(
      /from\(["']ai_conversations["']\)\s*\.update\([^)]*updated_at[\s\S]*?\)/g
    );
    expect(touch, "expected an ai_conversations.update(updated_at) chain").toBeTruthy();
    // The full surrounding statement should include the tenant_id eq.
    const block = src.match(
      /from\(["']ai_conversations["']\)\s*\.update\([^)]*updated_at[\s\S]*?;/
    )?.[0];
    expect(block).toBeDefined();
    expect(block!).toMatch(/\.eq\(\s*["']tenant_id["']\s*,\s*tenantId\s*\)/);
  });

  it("does NOT contain any ai_messages select that is scoped solely by conversation_id", () => {
    // Regression guard: find all .from("ai_messages").select(...) chains
    // up to the terminating semicolon. Each must carry a tenant_id eq.
    const chains = src.match(
      /from\(["']ai_messages["']\)\.select\([\s\S]*?(?:;|\n\s*\n)/g
    );
    for (const chain of chains ?? []) {
      if (/\.eq\(\s*["']conversation_id["']/.test(chain)) {
        expect(
          chain,
          "every ai_messages select filtered by conversation_id must also filter by tenant_id"
        ).toMatch(/\.eq\(\s*["']tenant_id["']\s*,\s*tenantId\s*\)/);
      }
    }
  });
});

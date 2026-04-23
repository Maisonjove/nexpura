/**
 * W2-004: PostgREST `.or()` filter escape regression coverage.
 *
 * The old pattern `query.or(\`name.ilike.%${input}%,...\`)` let an
 * attacker who controlled `input` inject extra clauses by using the
 * filter syntax chars `,` `.` `(` `)` (e.g. `,id.eq.<uuid>` would add
 * an equality clause that matches a specific row across the tenant's
 * dataset).
 *
 * Our fix: `escapeOrLiteral` / `ilikeOrValue` / `eqOrValue` wrap the
 * value in a PostgREST double-quoted string and escape `"`, `\`, `*`
 * inside. Wrapping in quotes neutralises `,` `.` `(` `)`.
 *
 * Supabase's PostgREST client builder sees these values as quoted
 * literals and sends them through unmodified — we don't rely on the
 * client to escape for us.
 */
import { describe, it, expect } from "vitest";
import { escapeOrLiteral, ilikeOrValue, eqOrValue } from "../db/or-escape";

describe("escapeOrLiteral — basic shapes", () => {
  it("wraps a plain string in double quotes", () => {
    expect(escapeOrLiteral("alice")).toBe('"alice"');
  });

  it("returns an empty quoted string for null/undefined", () => {
    expect(escapeOrLiteral(null)).toBe('""');
    expect(escapeOrLiteral(undefined)).toBe('""');
  });

  it("stringifies numbers", () => {
    expect(escapeOrLiteral(42)).toBe('"42"');
  });
});

describe("escapeOrLiteral — dangerous characters", () => {
  it("neutralises comma (clause separator)", () => {
    const input = "alice,id.eq.00000000-0000-0000-0000-000000000000";
    const out = escapeOrLiteral(input);
    // Everything lives inside the quotes — can't be parsed as a new clause.
    expect(out.startsWith('"')).toBe(true);
    expect(out.endsWith('"')).toBe(true);
    expect(out.slice(1, -1)).toBe(input);
  });

  it("neutralises dot (field/operator separator)", () => {
    const input = "x.eq.y";
    const out = escapeOrLiteral(input);
    expect(out).toBe('"x.eq.y"');
  });

  it("neutralises parentheses (group delimiters)", () => {
    const out = escapeOrLiteral("and(id.eq.1)");
    expect(out).toBe('"and(id.eq.1)"');
  });

  it("escapes backslash and double-quote", () => {
    expect(escapeOrLiteral('he said "hi"')).toBe('"he said \\"hi\\""');
    expect(escapeOrLiteral("a\\b")).toBe('"a\\\\b"');
  });

  it("escapes the ilike wildcard asterisk so attacker can't widen match", () => {
    expect(escapeOrLiteral("*")).toBe('"\\*"');
    expect(escapeOrLiteral("foo*bar")).toBe('"foo\\*bar"');
  });
});

describe("ilikeOrValue — substring search helper", () => {
  it("produces an ilike expression with quoted wildcarded value", () => {
    expect(ilikeOrValue("alice")).toBe('ilike."*alice*"');
  });

  it("escapes quotes / backslashes / asterisks in the search term", () => {
    expect(ilikeOrValue('bad"input')).toBe('ilike."*bad\\"input*"');
    expect(ilikeOrValue("with*star")).toBe('ilike."*with\\*star*"');
    expect(ilikeOrValue("back\\slash")).toBe('ilike."*back\\\\slash*"');
  });

  it("handles null / empty / numeric", () => {
    expect(ilikeOrValue(null)).toBe('ilike."*"');
    expect(ilikeOrValue(undefined)).toBe('ilike."*"');
    expect(ilikeOrValue("")).toBe('ilike."**"');
    expect(ilikeOrValue(7)).toBe('ilike."*7*"');
  });

  it("injection payload is contained inside the quoted value", () => {
    // The attack string we care about: `,id.eq.<uuid>` used to append
    // a clause to the .or() filter. After ilikeOrValue, every char is
    // inside the quotes.
    const payload = ",id.eq.00000000-0000-0000-0000-000000000000";
    const out = ilikeOrValue(payload);
    expect(out).toBe(`ilike."*${payload}*"`);
    // The `,` is inside the quotes, not acting as a clause separator.
    expect(out.split('"').length).toBe(3);
  });
});

describe("eqOrValue — equality helper", () => {
  it("produces an eq expression with a quoted value", () => {
    expect(eqOrValue("SKU-001")).toBe('eq."SKU-001"');
  });

  it("escapes special chars in barcodes", () => {
    expect(eqOrValue('12"34')).toBe('eq."12\\"34"');
    expect(eqOrValue("a,b.c")).toBe('eq."a,b.c"');
  });
});

describe("W2-004 attack payloads are neutralised in typical .or() clauses", () => {
  it("customer-search `,id.eq.<uuid>` stays inside the ilike value", () => {
    const attacker = ",id.eq.deadbeef-0000-0000-0000-000000000000";
    const clause = `full_name.${ilikeOrValue(attacker)}`;
    // Exactly one `.` after full_name before the quote — no extra clause.
    expect(clause).toBe(`full_name.ilike."*,id.eq.deadbeef-0000-0000-0000-000000000000*"`);
    // Still exactly one top-level clause (no comma outside of quotes).
    const topLevelCommas = [...clause].reduce(
      (acc, ch) => {
        if (ch === '"') return { ...acc, inQuote: !acc.inQuote };
        if (ch === "," && !acc.inQuote) return { ...acc, count: acc.count + 1 };
        return acc;
      },
      { inQuote: false, count: 0 },
    );
    expect(topLevelCommas.count).toBe(0);
  });

  it("barcode `0).or(id.eq.X` is neutralised for eq.", () => {
    const attacker = "0).or(id.eq.deadbeef";
    const clause = `barcode_value.${eqOrValue(attacker)}`;
    expect(clause).toBe(`barcode_value.eq."0).or(id.eq.deadbeef"`);
    // `(` and `)` are literal chars in the quoted value, can't start a
    // new logical group.
  });
});

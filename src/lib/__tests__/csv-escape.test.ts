/**
 * W6-HIGH-05 / W4-REPORT8: CSV formula-injection defence.
 *
 * Every CSV export had cells that started with `=`, `+`, `-`, `@`,
 * `\t` or `\r` flow through raw. Opening that CSV in Excel or
 * LibreOffice would execute the content as a live formula:
 *   - `=HYPERLINK("http://evil",...)` → phishing
 *   - `=cmd|' /C calc'!A1` → DDE, arbitrary exec on some locales
 *   - `@SUM(INDIRECT(...))` → cross-sheet lookup exfil
 *
 * Fix: prefix any cell starting with one of those triggers with a
 * single apostrophe. Also RFC-4180 quote the whole cell so `,`, `"`,
 * `\n`, `\r` inside strings survive.
 */
import { describe, it, expect } from "vitest";
import { csvEscape, buildCsv } from "../csv/escape";

describe("csvEscape — formula-trigger neutralisation", () => {
  it("neutralises `=HYPERLINK(\"http://evil\")`", () => {
    const out = csvEscape('=HYPERLINK("http://evil")');
    // The apostrophe prefix keeps Excel from parsing the content as a
    // formula; the embedded `"` is escape-doubled per RFC 4180.
    expect(out).toBe(`"'=HYPERLINK(""http://evil"")"`);
    // And the leading `=` is inside a literal that starts with `'`.
    expect(out.startsWith(`"'=`)).toBe(true);
  });

  it("neutralises `=cmd|' /C calc'!A1` (the canonical payload)", () => {
    const out = csvEscape(`=cmd|' /C calc'!A1`);
    expect(out.startsWith(`"'=`)).toBe(true);
  });

  it("prefixes leading + / - / @ / \\t / \\r", () => {
    expect(csvEscape("+SUM(A1:A9)")).toBe(`"'+SUM(A1:A9)"`);
    expect(csvEscape("-1000")).toBe(`"'-1000"`);
    expect(csvEscape("@dde(...)")).toBe(`"'@dde(...)"`);
    expect(csvEscape("\tleadingtab")).toBe(`"'\tleadingtab"`);
    expect(csvEscape("\rleadingcr")).toBe(`"'\rleadingcr"`);
  });

  it("leaves non-trigger cells alone (just RFC-4180 quoting)", () => {
    expect(csvEscape("Alice Smith")).toBe(`"Alice Smith"`);
    expect(csvEscape("19 Main St, Apt 5")).toBe(`"19 Main St, Apt 5"`);
    expect(csvEscape('She said "hi"')).toBe(`"She said ""hi"""`);
    expect(csvEscape("line\nbreak")).toBe(`"line\nbreak"`);
  });

  it("handles unicode unchanged (no trigger)", () => {
    expect(csvEscape("café ☕ 漢字")).toBe(`"café ☕ 漢字"`);
  });

  it("null / undefined → empty quoted", () => {
    expect(csvEscape(null)).toBe(`""`);
    expect(csvEscape(undefined)).toBe(`""`);
  });

  it("numbers pass through quoted (negative numbers get the prefix)", () => {
    expect(csvEscape(42)).toBe(`"42"`);
    expect(csvEscape(-5)).toBe(`"'-5"`);
    expect(csvEscape(3.14)).toBe(`"3.14"`);
  });

  it("Dates → ISO 8601 quoted", () => {
    const d = new Date("2026-04-21T00:00:00Z");
    expect(csvEscape(d)).toBe(`"2026-04-21T00:00:00.000Z"`);
  });

  it("objects → JSON-quoted (internal `\"` escaped)", () => {
    expect(csvEscape({ a: 1 })).toBe(`"{""a"":1}"`);
  });
});

describe("csvRow + buildCsv — end-to-end", () => {
  it("buildCsv neutralises a header with a formula trigger", () => {
    const csv = buildCsv(["=calc"], [{ "=calc": "safe" }]);
    expect(csv.split("\n")[0]).toBe(`"'=calc"`);
    expect(csv.split("\n")[1]).toBe(`"safe"`);
  });

  it("customer row with injection payload stays neutralised end-to-end", () => {
    const rows = [
      { id: "1", name: `=cmd|' /C calc'!A1`, total: 100 },
      { id: "2", name: "+SUM(A1:A9)", total: 200 },
      { id: "3", name: "Alice", total: -50 },
    ];
    const csv = buildCsv(["id", "name", "total"], rows);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(`"id","name","total"`);
    // First data row: formula neutralised, normal number quoted.
    expect(lines[1]).toBe(`"1","'=cmd|' /C calc'!A1","100"`);
    expect(lines[2]).toBe(`"2","'+SUM(A1:A9)","200"`);
    expect(lines[3]).toBe(`"3","Alice","'-50"`);
  });

  it("HYPERLINK payload stays neutralised inside a larger row", () => {
    const rows = [{ name: `=HYPERLINK("http://evil","click")`, amount: 99 }];
    const csv = buildCsv(["name", "amount"], rows);
    const dataLine = csv.split("\n")[1];
    expect(dataLine.startsWith(`"'=HYPERLINK`)).toBe(true);
    // Excel opening this sees a literal string, not a hyperlink formula.
  });
});

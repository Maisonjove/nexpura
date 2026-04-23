/**
 * PostgREST `.or()` filter literal escape.
 *
 * Audit finding W2-004: user-supplied strings were interpolated raw
 * into `supabase.from(X).or(\`name.ilike.*${input}*,...\`)`. The
 * PostgREST grammar treats `,` as a clause separator and `.` as a
 * field/operator separator; `(` `)` delimit logical groups; `*` is
 * the ilike wildcard; `\\` escapes. Any of these characters in
 * `input` breaks out of the intended clause and can add arbitrary
 * filters — e.g. `,id.eq.<uuid>` would (within tenant scope, still
 * bad) broaden the search to hit any chosen row.
 *
 * Fix: quote the literal. PostgREST allows a double-quoted string
 * value where internal `"` and `\\` are backslash-escaped. Wrapping
 * in quotes neutralises `,` `.` `(` `)` — they become part of the
 * literal, not filter syntax.
 *
 * Also prefixes any `*` inside a quoted ilike value with a backslash
 * so an attacker can't inject wildcards to cast a wider net. The
 * caller adds the outermost `*…*` for the ilike wildcarding — user
 * input in the middle must be treated as literal.
 *
 * Usage:
 *   import { escapeOrLiteral } from "@/lib/db/or-escape";
 *   const v = escapeOrLiteral(userInput);
 *   query.or(`name.ilike.*${v}*,sku.ilike.*${v}*`);
 *
 * Note: PostgREST supports two ilike wildcard forms — `%` and `*`.
 * `.or()` uses `*`. Escaping `*` inside a quoted value stops an
 * attacker from embedding their own wildcard boundary.
 */
export function escapeOrLiteral(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '""';
  const s = String(input);
  // Inside a double-quoted PostgREST value:
  //   \ must be doubled
  //   " must be backslash-escaped
  //   * (ilike wildcard) must be backslash-escaped so it can't widen a match
  const body = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\*/g, "\\*");
  return `"${body}"`;
}

/**
 * Convenience for ilike-substring clauses. Returns a pre-quoted
 * wildcarded value that can be dropped into the `.or()` string as the
 * value of an `ilike.` operator. Example:
 *   or(`name.${ilikeOrValue(q)},sku.${ilikeOrValue(q)}`)
 * becomes:
 *   or(`name.ilike."*safe*",sku.ilike."*safe*"`)
 */
export function ilikeOrValue(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return 'ilike."*"';
  const s = String(input)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\*/g, "\\*");
  return `ilike."*${s}*"`;
}

/**
 * Equality value inside a quoted or() literal. For exact matches like
 * barcode lookups, renders as: field.eq."<escaped>"
 */
export function eqOrValue(input: string | number | null | undefined): string {
  return `eq.${escapeOrLiteral(input)}`;
}

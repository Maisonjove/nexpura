/**
 * Custom ESLint rule: catches admin page.tsx files whose async server-
 * component bodies don't call a dynamic marker (`connection()` /
 * `cookies()` / `headers()` / `params`).
 *
 * Background (PR #130 + #131): under `cacheComponents: true`, an async
 * server-component body without an explicit dynamic marker is implicitly
 * cached by the prerender pipeline. After a server action mutates the
 * DB and fires `revalidatePath` / `router.refresh()`, the cached render
 * keeps serving stale state — e.g. clicking Mark Completed on
 * /admin/demo-requests/[id] mutated the DB three times because the UI
 * never reflected the first click. The fix is `await connection()` (or
 * cookies/headers/params) at the top of the async body. This rule
 * flags admin page.tsx files that omit the marker.
 *
 * Scoped to:
 *   - src/app/(admin)/**\/page.tsx
 *   - src/app/(app)/admin/**\/page.tsx
 *
 * Flags only top-level async function declarations exported (default
 * or named) and async helper functions called from the page-default —
 * heuristic: any async function declaration whose body's first 5
 * statements don't include an `await` of one of the dynamic helpers.
 *
 * False positives are easily suppressed with a per-line eslint-disable
 * comment + a brief reason.
 */

const DYNAMIC_HELPERS = new Set([
  "connection",
  "cookies",
  "headers",
  "params",
]);

function isAdminPageFile(filename) {
  if (!filename) return false;
  // Match Unix and Windows path separators; the (admin)/(app) parens
  // are literal in the path.
  const norm = filename.replace(/\\/g, "/");
  return (
    /\/src\/app\/\(admin\)\/.+\/page\.(t|j)sx?$/.test(norm) ||
    /\/src\/app\/\(app\)\/admin\/.+\/page\.(t|j)sx?$/.test(norm)
  );
}

function awaitOfDynamicHelper(stmt) {
  if (!stmt || stmt.type !== "ExpressionStatement") return false;
  const expr = stmt.expression;
  if (expr.type !== "AwaitExpression") return false;
  const arg = expr.argument;
  if (!arg) return false;

  // await connection() / await cookies() / await headers()
  if (arg.type === "CallExpression") {
    const callee = arg.callee;
    if (callee.type === "Identifier" && DYNAMIC_HELPERS.has(callee.name)) {
      return true;
    }
    // await someParams (the params promise) — also fine
  }
  // `await paramsPromise` (an Identifier whose name suggests the params
  // promise) — accept any bare Identifier await as "this body resolves
  // request-time params/promises and is therefore dynamic".
  if (arg.type === "Identifier") return true;

  // `await someThing.someProperty` (rarely used but possible)
  if (arg.type === "MemberExpression") return true;

  return false;
}

// Heuristic: is this async function a RENDERING server component (i.e.
// returns JSX), or just a data-loader / helper that the rendering body
// awaits? Only the rendering body needs `connection()` because its
// children inherit the dynamic mark; pure loaders are fine to be
// implicitly cached as long as their caller isn't.
// AST keys that point back up the tree — skip them to avoid infinite
// recursion when the AST has parent pointers attached.
const PARENT_KEYS = new Set(["parent", "prev", "next"]);

function returnsJsx(node) {
  const body = node.body;
  if (!body || body.type !== "BlockStatement") return false;
  let found = false;
  const seen = new WeakSet();
  function visit(n) {
    if (found || !n || typeof n !== "object" || seen.has(n)) return;
    seen.add(n);
    if (n.type === "JSXElement" || n.type === "JSXFragment") {
      found = true;
      return;
    }
    // Don't descend into nested functions — their JSX is their own
    // (and they'll get visited separately by FunctionDeclaration /
    // VariableDeclarator handlers).
    if (
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression"
    ) {
      return;
    }
    for (const key of Object.keys(n)) {
      if (PARENT_KEYS.has(key)) continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object" && v.type) visit(v);
    }
  }
  visit(body);
  return found;
}

// Does the function body contain a DB read/write that depends on
// request-time state? We use `admin.from(` / `supabase.from(` as the
// proxy. A pure shell that just renders <Suspense fallback>...</Suspense>
// without any DB call doesn't need the marker — its dynamic
// children get scoped on their own.
function bodyContainsSupabaseCall(node) {
  const body = node.body;
  if (!body || body.type !== "BlockStatement") return false;
  let found = false;
  const seen = new WeakSet();
  function visit(n) {
    if (found || !n || typeof n !== "object" || seen.has(n)) return;
    seen.add(n);
    // Look for `something.from(...)` where something is admin / supabase / etc.
    if (
      n.type === "CallExpression" &&
      n.callee?.type === "MemberExpression" &&
      n.callee.property?.name === "from" &&
      n.callee.object?.type === "Identifier"
    ) {
      const objName = n.callee.object.name;
      if (
        objName === "admin" ||
        objName === "supabase" ||
        objName === "adminClient" ||
        objName === "supabaseClient" ||
        objName === "client"
      ) {
        found = true;
        return;
      }
    }
    if (
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression"
    ) {
      return; // don't descend into nested fns
    }
    for (const key of Object.keys(n)) {
      if (PARENT_KEYS.has(key)) continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object" && v.type) visit(v);
    }
  }
  visit(body);
  return found;
}

function checkAsyncFunction(context, node, label) {
  // Only flag bodies that actually render JSX AND do DB reads. Pure
  // shells (e.g. page-default that just unwraps params + renders
  // Suspense) don't need the marker because they don't render any
  // mutable DB state. Pure data-loader helpers don't render JSX so
  // they're already filtered out by returnsJsx.
  if (!returnsJsx(node)) return;
  if (!bodyContainsSupabaseCall(node)) return;

  const body = node.body?.body ?? [];
  // Look at the first 5 statements for a dynamic-marker call.
  const head = body.slice(0, 5);
  const ok = head.some(awaitOfDynamicHelper);
  if (!ok) {
    context.report({
      node,
      messageId: "missingMarker",
      data: { label },
    });
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `await connection()` (or other dynamic marker) in admin page.tsx async server-component bodies",
      recommended: false,
    },
    schema: [],
    messages: {
      missingMarker:
        "Async server-component body `{{label}}` in an admin page.tsx must start with `await connection()` (or cookies/headers/params) within its first 5 statements. Without it, cacheComponents implicitly caches this body and `router.refresh()` after server actions keeps serving stale state. See PR #130 (demo-requests Mark Completed bug) + CONTRIBUTING.md.",
    },
  },
  create(context) {
    const filename = context.filename || (context.getFilename && context.getFilename());
    if (!isAdminPageFile(filename)) return {};

    return {
      FunctionDeclaration(node) {
        if (!node.async) return;
        checkAsyncFunction(context, node, node.id?.name ?? "anonymous");
      },
      // Anonymous async arrow / function expressions assigned to a
      // const are common too (e.g. `const Body = async () => {...}`).
      VariableDeclarator(node) {
        const init = node.init;
        if (
          !init ||
          (init.type !== "ArrowFunctionExpression" &&
            init.type !== "FunctionExpression")
        )
          return;
        if (!init.async) return;
        if (init.body?.type !== "BlockStatement") return; // expression-bodied arrow can't have markers
        checkAsyncFunction(context, init, node.id?.name ?? "anonymous");
      },
    };
  },
};

export default rule;

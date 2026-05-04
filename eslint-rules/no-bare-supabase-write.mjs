/**
 * Custom ESLint rule: catches bare Supabase writes that swallow errors.
 *
 * P2-F audit (Joey 2026-05-04) named the "swallowed-error" pattern as
 * systemic across the codebase — bare `await admin.from(...).insert/
 * update/upsert/delete(...)` with no `{ error }` destructure or
 * `.throwOnError()` chain means a transient DB failure silently
 * succeeds at the HTTP layer, leaving state-of-record drift. PR #129
 * fixed 33 webhook-handler sites; this rule lights up the remaining
 * ones across the codebase + prevents regression.
 *
 * Allowed shapes:
 *   const { error } = await admin.from("x").update({...}).eq(...);
 *   const { data, error } = await admin.from("x").insert({...});
 *   await admin.from("x").update({...}).eq(...).throwOnError();
 *
 * Flagged shapes:
 *   await admin.from("x").update({...}).eq(...);
 *   const { data } = await admin.from("x").insert({...});
 *   const result = await admin.from("x").upsert({...}); // no destructure
 *
 * Each violation should be wrapped per the destructive-vs-side-effect
 * policy (see CONTRIBUTING.md): destructive writes throw on error,
 * side-effect writes log + continue.
 */

const DESTRUCTIVE_OPS = new Set(["insert", "update", "upsert", "delete"]);

function getCalleeMemberName(node) {
  // node is a CallExpression; if its callee is a MemberExpression,
  // return the property name (e.g. ".from" → "from").
  if (!node || node.type !== "CallExpression") return null;
  if (node.callee?.type !== "MemberExpression") return null;
  return node.callee.property?.name ?? null;
}

function walkChain(callExpr) {
  // Walk down the CallExpression chain via .callee.object, returning
  // an array of method names from outermost to innermost.
  const names = [];
  let cur = callExpr;
  while (cur && cur.type === "CallExpression") {
    const name = getCalleeMemberName(cur);
    if (name) names.push(name);
    if (cur.callee?.type === "MemberExpression") {
      cur = cur.callee.object;
    } else {
      break;
    }
  }
  return names;
}

function destructuresError(idNode) {
  if (!idNode || idNode.type !== "ObjectPattern") return false;
  return idNode.properties.some(
    (p) =>
      p.type === "Property" &&
      ((p.key.type === "Identifier" && p.key.name === "error") ||
        (p.key.type === "Literal" && p.key.value === "error")),
  );
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow bare Supabase writes (`.insert/.update/.upsert/.delete`) that don't capture `{ error }` or chain `.throwOnError()`",
      recommended: false,
    },
    schema: [],
    messages: {
      bareWrite:
        "Bare `.{{op}}` on Supabase chain swallows errors. Wrap in `const { error } = await ...` (destructive: throw; side-effect: log + continue) or chain `.throwOnError()`. See CONTRIBUTING.md → 'Database write error policy'.",
    },
  },
  create(context) {
    function reportIfBareWrite(awaitNode) {
      const arg = awaitNode.argument;
      if (!arg || arg.type !== "CallExpression") return;

      const chain = walkChain(arg);
      // Allow .throwOnError() chain anywhere in the call chain.
      if (chain.includes("throwOnError")) return;
      // Need both a destructive op AND a .from() in the chain (otherwise
      // it's not a Supabase write — could be unrelated chained call).
      const destructiveOp = chain.find((n) => DESTRUCTIVE_OPS.has(n));
      if (!destructiveOp) return;
      if (!chain.includes("from")) return;

      // Check the AwaitExpression's parent context:
      // - ExpressionStatement → bare statement, definitely flag.
      // - VariableDeclarator with ObjectPattern → flag unless `error`
      //   is destructured.
      // - Anything else (e.g. argument of another call) → leave alone;
      //   it's likely passed somewhere that handles errors.
      const parent = awaitNode.parent;
      if (parent.type === "ExpressionStatement") {
        context.report({
          node: awaitNode,
          messageId: "bareWrite",
          data: { op: destructiveOp },
        });
        return;
      }
      if (parent.type === "VariableDeclarator") {
        if (!destructuresError(parent.id)) {
          context.report({
            node: awaitNode,
            messageId: "bareWrite",
            data: { op: destructiveOp },
          });
        }
      }
    }

    return {
      AwaitExpression: reportIfBareWrite,
    };
  },
};

export default rule;

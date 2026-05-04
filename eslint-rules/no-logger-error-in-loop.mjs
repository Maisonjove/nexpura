/**
 * Custom ESLint rule: catches `logger.error(...)` calls inside obvious
 * loop bodies.
 *
 * Background — capture-amplification class (post-Phase-2 cleanup, see
 * CONTRIBUTING.md item 3 → "Post-Phase-2 cleanup additions"). The
 * Sentry SDK's PromiseBuffer caps at 100 events per request. A
 * `logger.error` inside a hot loop iterating > 100 times silently drops
 * every event past the cap with `SENTRY_BUFFER_FULL_ERROR` — the
 * observability we promised in the side-effect-log policy quietly
 * disappears, AND the route blows its flush budget on transport queue
 * timeouts.
 *
 * Better pattern: collect failures into an array inside the loop, then
 * fire a SINGLE `logger.error` after the loop with the array as
 * context. One Sentry event with 200 failure rows attached beats 200
 * Sentry events that get truncated to 100.
 *
 *   ❌ BAD — fires once per iteration; > 100 iters drops past cap.
 *   for (const row of rows) {
 *     const { error } = await admin.from("X").insert(row);
 *     if (error) logger.error("[X] insert failed", { row, err: error });
 *   }
 *
 *   ✅ GOOD — collect, then log once with the collected context.
 *   const failures: Array<{ row: typeof rows[number]; err: PostgrestError }> = [];
 *   for (const row of rows) {
 *     const { error } = await admin.from("X").insert(row);
 *     if (error) failures.push({ row, err: error });
 *   }
 *   if (failures.length > 0) {
 *     logger.error("[X] batch insert had failures", { count: failures.length, failures });
 *   }
 *
 * Loop shapes detected:
 *   - for (...) {...}  /  for (... of ...) {...}  /  for (... in ...) {...}
 *   - while (...) {...}  /  do {...} while (...);
 *   - .forEach((...) => ...)  /  .map(...)  /  .filter(...)  /  .reduce(...)
 *   - .flatMap(...)  /  .some(...)  /  .every(...)
 *
 * Auto-skipped:
 *   - logger.error inside a `.catch(...)` callback. Those don't fire on
 *     every iteration — they fire only on rejection of a single
 *     promise, and the existing sentry-flush rule (+ its callback-
 *     extension) covers that domain.
 *   - logger.error inside a try/catch INSIDE a loop. Still fires per
 *     iteration but the engineer wrote the catch block deliberately;
 *     opting out is opt-in via the try shape.
 *   - eslint-disable-next-line on the offending line.
 */

const ARRAY_LOOP_METHODS = new Set([
  "forEach",
  "map",
  "filter",
  "reduce",
  "flatMap",
  "some",
  "every",
]);

function isLoggerErrorCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (!callee) return false;
  if (callee.type === "MemberExpression") {
    return (
      callee.property?.type === "Identifier" &&
      callee.property.name === "error" &&
      callee.object?.type === "Identifier" &&
      (callee.object.name === "logger" || callee.object.name === "default")
    );
  }
  return false;
}

// Walk up the AST and ask: is this CallExpression node enclosed by
// a loop body, where "loop body" means
//   - the body of for / while / do-while / for-of / for-in
//   - the callback argument of an array iteration method (.forEach etc.)
// AND while walking up, we have not yet entered a `.catch(...)` callback
// or a try/catch block that itself sits inside the loop (the auto-skip
// cases above).
function findEnclosingLoop(node) {
  let prev = node;
  let cur = node.parent;
  while (cur) {
    // Auto-skip: walked into a try/catch — engineer thought about it.
    if (cur.type === "TryStatement") {
      // The try block's body lives in cur.block; the catch handler in
      // cur.handler.body. Either way, hitting the TryStatement before a
      // loop ancestor means the logger.error sits inside try/catch
      // logic. Skip.
      return null;
    }
    // Auto-skip: walked into a .catch(...) callback. cur is the
    // CallExpression `something.catch(arg)` and `prev` is the callback
    // function being passed. Skip — sentry-flush family handles this.
    if (
      cur.type === "CallExpression" &&
      cur.callee?.type === "MemberExpression" &&
      cur.callee.property?.type === "Identifier" &&
      cur.callee.property.name === "catch" &&
      cur.arguments.includes(prev)
    ) {
      return null;
    }
    // Loop shapes — direct AST nodes.
    if (
      cur.type === "ForStatement" ||
      cur.type === "ForOfStatement" ||
      cur.type === "ForInStatement" ||
      cur.type === "WhileStatement" ||
      cur.type === "DoWhileStatement"
    ) {
      return cur;
    }
    // Array iteration method callback — cur is the CallExpression
    // `arr.method(callback)`, prev is the callback function passed in.
    if (
      cur.type === "CallExpression" &&
      cur.callee?.type === "MemberExpression" &&
      cur.callee.property?.type === "Identifier" &&
      ARRAY_LOOP_METHODS.has(cur.callee.property.name) &&
      cur.arguments.includes(prev)
    ) {
      return cur;
    }
    // If we cross a function boundary that ISN'T the array-method
    // callback we're currently checking, stop. Nested function decls
    // hoist out of loops conceptually (their own bodies are their own
    // scope) — calling them from the loop is the engineer's choice and
    // we don't want to flag the inside of a helper that happens to be
    // called from a loop.
    if (
      (cur.type === "FunctionDeclaration" ||
        cur.type === "FunctionExpression" ||
        cur.type === "ArrowFunctionExpression") &&
      // Exception: the function we're inside might BE the array-method
      // callback. We handle that on the next iteration when we check
      // cur.parent for the CallExpression match above. So we only stop
      // when the parent is NOT that pattern.
      !(
        cur.parent?.type === "CallExpression" &&
        cur.parent.callee?.type === "MemberExpression" &&
        cur.parent.callee.property?.type === "Identifier" &&
        ARRAY_LOOP_METHODS.has(cur.parent.callee.property.name) &&
        cur.parent.arguments.includes(cur)
      )
    ) {
      return null;
    }
    prev = cur;
    cur = cur.parent;
  }
  return null;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `logger.error(...)` directly inside loops; collect into an array and log once after the loop instead",
      recommended: false,
    },
    schema: [],
    messages: {
      loggerInLoop:
        "logger.error inside a loop body queues one Sentry event per iteration. The PromiseBuffer caps at 100 events per request — past that, captures are silently dropped. Collect failures into an array inside the loop, then call logger.error ONCE after the loop with the array as context. See CONTRIBUTING.md → 'Loop-shaped logger.error'.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isLoggerErrorCall(node)) return;
        const loop = findEnclosingLoop(node);
        if (!loop) return;
        context.report({ node, messageId: "loggerInLoop" });
      },
    };
  },
};

export default rule;

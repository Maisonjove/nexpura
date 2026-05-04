/**
 * Custom ESLint rule: closes the known-gap in
 * `local/sentry-flush-before-return` for nested-callback logger.error.
 *
 * Background — sibling rule recap. `sentry-flush-before-return` flags
 * any exported route handler / server action whose own body fires
 * logger.error and then exits without flush. But it walks ONLY the
 * exported function's own body — it skips the bodies of inline
 * callbacks the function passes to other code:
 *
 *     export async function createBespokeJob(...) {
 *       // ...
 *       sendTrackingEmail({...}).catch((err) => {
 *         logger.error("[createBespokeJob] tracking email failed", err);
 *         //   ^ never visited by sentry-flush-before-return
 *       });
 *       redirect(`/bespoke/${data.id}`);  // throw NEXT_REDIRECT
 *       // → buffer drains? No: Lambda freezes. logger.error event lost.
 *     }
 *
 *     export const refundAction = async (...) => {
 *       const result = await withIdempotency("...", async () => {
 *         const { error } = await admin.from(...).insert(...);
 *         if (error) logger.error("[refund] insert failed", { err: error });
 *         //          ^ also never visited
 *         return ...;
 *       });
 *       redirect(`/refunds/${result.id}`);  // same drop
 *     }
 *
 * PR #138's amendment patched the two known sites (createBespokeJob
 * and processRefund) by hand: an `await flushSentry()` inserted
 * immediately before the redirect / return at the outer-function
 * exit. This rule generalizes that fix into a build-time check.
 *
 * Detection logic, walked in source-line order:
 *   1. Locate every nested logger.error — i.e. any logger.error inside a
 *      callback function passed as an argument to another call (most
 *      commonly `.catch(...)`, `withIdempotency(...)`, `Promise.all([...])`,
 *      transaction wrappers, etc.)
 *   2. For each such logger.error, find the outer exported function it
 *      belongs to (the one that sentry-flush-before-return scopes to).
 *   3. Find the next "exit" event in the OUTER function's source after
 *      the nested logger.error: a `return`, `throw`, `redirect()`,
 *      `notFound()`, `unauthorized()`, `permanentRedirect()`, `forbidden()`.
 *   4. If between the nested logger.error site (by source position)
 *      and that exit, there's no `await flushSentry()` /
 *      `await Sentry.flush()` IN THE OUTER FUNCTION'S OWN BODY —
 *      flag the exit point.
 *
 * Skip:
 *   - functions whose export is wrapped with `withSentryFlush(...)`
 *     (the wrapper handles flush at the boundary)
 *   - exits that ARE preceded by an inline flush in the outer function
 *
 * The rule is intentionally simpler than full control-flow analysis —
 * it walks source-line order, not branch structure. False positives are
 * possible if the only path to an exit doesn't actually run the
 * callback (e.g. logger.error in a `.catch()` on a promise that the
 * outer function doesn't await before exiting). At warn severity the
 * tradeoff is fine: a stray `await flushSentry()` is a no-op on an
 * empty buffer and costs nothing.
 *
 * See CONTRIBUTING.md → "Known rule gap — nested-callback logger.error".
 */

const SCOPE_PATH_RE = /\/route\.ts$|\/actions\.ts$|\/actions\//;

const EXIT_HELPER_NAMES = new Set([
  "redirect",
  "permanentRedirect",
  "notFound",
  "unauthorized",
  "forbidden",
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

function isFlushCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (!callee) return false;
  if (callee.type === "Identifier" && callee.name === "flushSentry") return true;
  if (callee.type === "MemberExpression") {
    return (
      callee.property?.type === "Identifier" &&
      callee.property.name === "flush" &&
      callee.object?.type === "Identifier" &&
      callee.object.name === "Sentry"
    );
  }
  return false;
}

function isAwaitFlush(node) {
  return node?.type === "AwaitExpression" && isFlushCall(node.argument);
}

function isExitHelperCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (!callee) return false;
  if (callee.type === "Identifier" && EXIT_HELPER_NAMES.has(callee.name)) return true;
  return false;
}

function isWithSentryFlushArg(fn) {
  let p = fn.parent;
  while (p) {
    if (
      p.type === "CallExpression" &&
      p.callee?.type === "Identifier" &&
      p.callee.name === "withSentryFlush"
    ) {
      if (p.arguments.includes(fn)) return true;
    }
    if (
      p.type === "BlockStatement" ||
      p.type === "Program" ||
      p.type === "FunctionDeclaration" ||
      p.type === "FunctionExpression" ||
      p.type === "ArrowFunctionExpression"
    ) {
      return false;
    }
    p = p.parent;
  }
  return false;
}

function isExported(fn) {
  let p = fn.parent;
  while (p) {
    if (p.type === "ExportNamedDeclaration" || p.type === "ExportDefaultDeclaration") return true;
    if (p.type === "Program") return false;
    if (
      p.type === "FunctionDeclaration" ||
      p.type === "FunctionExpression" ||
      p.type === "ArrowFunctionExpression" ||
      p.type === "MethodDefinition"
    ) {
      return false;
    }
    p = p.parent;
  }
  return false;
}

// Find the nearest enclosing function for a given node. Walks .parent
// pointers until it hits one of the function node types.
function nearestEnclosingFn(node) {
  let p = node.parent;
  while (p) {
    if (
      p.type === "FunctionDeclaration" ||
      p.type === "FunctionExpression" ||
      p.type === "ArrowFunctionExpression"
    ) {
      return p;
    }
    p = p.parent;
  }
  return null;
}

// Walk a node tree and call `visit(n)` on every descendant. Crosses
// function boundaries by default (unlike sentry-flush-before-return,
// where we explicitly stopped). Skips parent / loc / range to avoid
// infinite loops on parented ASTs.
function deepWalk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) deepWalk(child, visit);
    return;
  }
  if (!node.type) return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    deepWalk(node[key], visit);
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `await flushSentry()` between a nested-callback logger.error and the outer function's exit (return / redirect / notFound / etc.)",
      recommended: false,
    },
    schema: [],
    messages: {
      missingFlushAtCallbackExit:
        "Outer function exits without `await flushSentry()` — but a nested callback at line {{loggerLine}} fires logger.error, queueing a Sentry capture. In Vercel serverless the Lambda freezes after this exit before the buffer drains. Add `await flushSentry()` before this exit. See CONTRIBUTING.md → 'Known rule gap — nested-callback logger.error'.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || "";
    if (!SCOPE_PATH_RE.test(filename)) return {};

    function checkOuterFunction(fn) {
      if (!isExported(fn)) return;
      if (isWithSentryFlushArg(fn)) return;
      if (!fn.body || fn.body.type !== "BlockStatement") return;

      // Step 1: collect every NESTED logger.error in this function's
      // descendants. "Nested" here means "inside an inner function
      // expression / arrow function / function declaration that is NOT
      // `fn` itself". The sibling rule already covers logger.error
      // calls in `fn`'s OWN top-level body.
      const nestedLoggerErrors = [];
      // Step 2: collect every exit point in `fn`'s OWN body — i.e.
      // ReturnStatement / ThrowStatement / call to redirect()-family
      // helpers — that is NOT inside an inner function. (We have to
      // track whether a node sits inside an inner function during the
      // walk; .parent chain tells us.)
      const ownBodyExits = [];
      // Step 3: collect every flushSentry / Sentry.flush call in `fn`'s
      // OWN body that is NOT inside an inner function.
      const ownBodyFlushes = [];

      deepWalk(fn.body, (n) => {
        // Nested logger.error: a logger.error call whose nearest
        // enclosing function is NOT `fn`.
        if (isLoggerErrorCall(n)) {
          const enclosing = nearestEnclosingFn(n);
          if (enclosing && enclosing !== fn) {
            nestedLoggerErrors.push(n);
          }
        }
        // Own-body exit: a return / throw / call to redirect-family,
        // whose nearest enclosing function IS `fn`.
        const enclosing = nearestEnclosingFn(n);
        if (enclosing === fn) {
          if (n.type === "ReturnStatement" || n.type === "ThrowStatement") {
            ownBodyExits.push(n);
          }
          if (n.type === "ExpressionStatement" && isExitHelperCall(n.expression)) {
            ownBodyExits.push(n);
          }
          // Call to exit helper not wrapped in ExpressionStatement (rare,
          // e.g. inside a logical expression). Still treat as exit.
          if (isExitHelperCall(n) && n.parent?.type !== "ExpressionStatement") {
            ownBodyExits.push(n);
          }
          // Inline flush in fn's own body.
          if (isAwaitFlush(n)) {
            ownBodyFlushes.push(n);
          }
        }
      });

      if (nestedLoggerErrors.length === 0) return;
      if (ownBodyExits.length === 0) return;

      // For each exit, find any nested logger.error that occurs
      // earlier in source order (i.e. range[0] < exit.range[0]).
      // If such a logger.error exists AND there's no flush in fn's
      // own body BETWEEN the nested logger.error and this exit
      // (in source-line order) — flag the exit.
      for (const exitNode of ownBodyExits) {
        const exitStart = exitNode.range?.[0] ?? 0;
        // Find the LATEST nested logger.error that happens before
        // this exit. If it exists, that's the most recent
        // amplification that needs flushing.
        let latestPriorNested = null;
        for (const ln of nestedLoggerErrors) {
          const lnStart = ln.range?.[0] ?? 0;
          if (lnStart < exitStart) {
            if (!latestPriorNested || lnStart > (latestPriorNested.range?.[0] ?? 0)) {
              latestPriorNested = ln;
            }
          }
        }
        if (!latestPriorNested) continue;
        const nestedStart = latestPriorNested.range?.[0] ?? 0;
        // Is there a flush in fn's own body strictly between
        // nestedStart and exitStart?
        const flushBetween = ownBodyFlushes.some((fl) => {
          const flStart = fl.range?.[0] ?? 0;
          return flStart > nestedStart && flStart < exitStart;
        });
        if (flushBetween) continue;

        const loggerLine = latestPriorNested.loc?.start?.line ?? "?";
        context.report({
          node: exitNode,
          messageId: "missingFlushAtCallbackExit",
          data: { loggerLine: String(loggerLine) },
        });
      }
    }

    return {
      FunctionDeclaration: checkOuterFunction,
      FunctionExpression: checkOuterFunction,
      ArrowFunctionExpression: checkOuterFunction,
    };
  },
};

export default rule;

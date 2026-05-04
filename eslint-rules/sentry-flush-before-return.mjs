/**
 * Custom ESLint rule: catches in-handler `logger.error → return` without
 * a Sentry flush between them.
 *
 * Background — Joey 2026-05-04 P1 finding (PR #138). `logger.error(...)`
 * forwards to `Sentry.captureException` (lib/logger.ts:67). In Vercel
 * serverless, the SDK queues the event in a PromiseBuffer and a
 * background task drains it. If a route handler / server action returns
 * its response immediately after the logger.error call, the Lambda
 * freezes before the buffer drains — the event never reaches Sentry.
 * Confirmed via /api/qa-test/bespoke-wrap-probe: without explicit
 * flush, the synthetic capture never landed; with `await Sentry.flush()`
 * it lands within ~2.5s.
 *
 * Two acceptable shapes (both prevent the race):
 *
 *   ✅ Route handler wrapped at export site:
 *     export const POST = withSentryFlush(async (req) => {
 *       ...
 *       if (err) logger.error("...");
 *       return NextResponse.json(...);
 *     });
 *
 *   ✅ Server action with inline flush:
 *     "use server";
 *     export async function myAction(...) {
 *       ...
 *       if (err) {
 *         logger.error("...");
 *         await flushSentry();   // or: await Sentry.flush(2000)
 *         return { error: "..." };
 *       }
 *     }
 *
 * Flagged shape:
 *
 *   ❌ logger.error + return without flush in between:
 *     export async function myAction(...) {
 *       const { error } = await admin.from(...).insert(...);
 *       if (error) {
 *         logger.error("[myAction] insert failed", { err: error });
 *         return { error: "Save failed" };  // ← Sentry capture dropped
 *       }
 *     }
 *
 * Scope: route handlers + server actions only. Internal helpers + UI
 * components are not flagged because they don't sit at the request
 * boundary; their flush gate is provided by whichever handler invoked
 * them.
 *
 * See CONTRIBUTING.md → "Sentry serverless flush" for the full
 * rationale.
 */

const SCOPE_PATH_RE = /\/route\.ts$|\/actions\.ts$|\/actions\//;

function isLoggerErrorCall(node) {
  // node.callee can be `logger.error` or `default.error` (default import)
  // or `error` directly (destructured). Match the most common shape.
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
  // Match: Sentry.flush(...) or flushSentry(...)
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

function isWithSentryFlushArg(fn) {
  // Walk up: is this function the argument of a withSentryFlush(...) call?
  let p = fn.parent;
  while (p) {
    if (
      p.type === "CallExpression" &&
      p.callee?.type === "Identifier" &&
      p.callee.name === "withSentryFlush"
    ) {
      // Confirm this fn is one of its arguments (not the callee).
      if (p.arguments.includes(fn)) return true;
    }
    // Don't walk past statement boundaries — the wrap is always direct.
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
  // Walk up from the function looking for an ExportNamedDeclaration /
  // ExportDefaultDeclaration ancestor. Crossing a function boundary
  // first means it's a nested helper (not exported).
  //
  // Patterns this catches:
  //   export async function POST(...) {...}                  → FunctionDecl > ExportNamedDecl
  //   export const POST = withSentryFlush(async (...) => {}) → ArrowFn > CallExpr > VarDecl > ExportNamedDecl
  //   export const myAction = async (...) => {...}           → ArrowFn > VarDecl > ExportNamedDecl
  //   export default async function (...) {...}              → FunctionDecl > ExportDefaultDecl
  //
  // Top-level helper FUNCTION DECLARATIONS (e.g. `async function
  // handleCheckoutCompleted(...)` in webhooks/stripe/route.ts) are
  // intentionally NOT in scope — they sit one call-frame in from the
  // exported handler, and the wrap at the export covers their flush.
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

function walkNodeRecursive(node, visit, skipFn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walkNodeRecursive(child, visit, skipFn);
    return;
  }
  if (!node.type) return;
  // Don't recurse into nested function bodies — their logger.error /
  // return analysis is independent (they get their own visit).
  if (skipFn && node !== skipFn._self && (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  )) return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    walkNodeRecursive(node[key], visit, skipFn);
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `await Sentry.flush()` (or withSentryFlush wrap) when a route handler / server action calls logger.error and then returns",
      recommended: false,
    },
    schema: [],
    messages: {
      missingFlush:
        "logger.error followed by return without `await flushSentry()` (or `await Sentry.flush(2000)`). In Vercel serverless this drops the Sentry capture: Lambda freezes before the SDK transport drains. Either wrap the export with `withSentryFlush(...)` or add `await flushSentry()` before the return. See CONTRIBUTING.md → 'Sentry serverless flush'.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || "";
    if (!SCOPE_PATH_RE.test(filename)) return {};

    function checkFunction(fn) {
      if (!isExported(fn)) return;
      if (isWithSentryFlushArg(fn)) return;
      if (!fn.body || fn.body.type !== "BlockStatement") return;

      let firstLoggerError = null;
      let hasReturn = false;
      let hasFlush = false;

      const sentinel = { _self: fn };
      walkNodeRecursive(fn.body, (n) => {
        if (!firstLoggerError && isLoggerErrorCall(n)) {
          firstLoggerError = n;
        }
        if (n.type === "ReturnStatement") {
          hasReturn = true;
        }
        if (isAwaitFlush(n)) {
          hasFlush = true;
        }
      }, sentinel);

      // Implicit fall-through return at end of async function body still
      // counts — async functions return a Promise<undefined> on fall-
      // through. But for our purposes we only flag if there's an EXPLICIT
      // return AND a logger.error AND no flush. Implicit-return functions
      // that log errors and exit are rare and the warn-level severity is
      // tolerable noise.
      if (firstLoggerError && hasReturn && !hasFlush) {
        context.report({
          node: firstLoggerError,
          messageId: "missingFlush",
        });
      }
    }

    return {
      "FunctionDeclaration": checkFunction,
      "FunctionExpression": checkFunction,
      "ArrowFunctionExpression": checkFunction,
    };
  },
};

export default rule;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";
// Local plugin: catches the swallowed-error + cacheComponents-stale-UI
// patterns that the P2-F audit (PR #129 / #130 / #131) named as
// systemic. See eslint-rules/*.mjs for the rule sources + rationale.
import noBareSupabaseWrite from "./eslint-rules/no-bare-supabase-write.mjs";
import requireConnectionInAdminPages from "./eslint-rules/require-connection-in-admin-pages.mjs";
import sentryFlushBeforeReturn from "./eslint-rules/sentry-flush-before-return.mjs";
import noLoggerErrorInLoop from "./eslint-rules/no-logger-error-in-loop.mjs";
import sentryFlushBeforeCallbackExit from "./eslint-rules/sentry-flush-before-callback-exit.mjs";

const localPlugin = {
  rules: {
    "no-bare-supabase-write": noBareSupabaseWrite,
    "require-connection-in-admin-pages": requireConnectionInAdminPages,
    "sentry-flush-before-return": sentryFlushBeforeReturn,
    "no-logger-error-in-loop": noLoggerErrorInLoop,
    "sentry-flush-before-callback-exit": sentryFlushBeforeCallbackExit,
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone Node.js scripts (use require legitimately)
    "*.js",
    "*.cjs",
    "*.mjs",
    "public/sw.js",
    "tailwind.config.ts",
  ]),
  // Unused imports plugin
  {
    plugins: {
      "unused-imports": unusedImports,
      local: localPlugin,
    },
    rules: {
      // Auto-fix unused imports
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      // Locked at `error` after PR-B4 cleared all violations across
      // the codebase. Three systemic patterns from the P2-F audit (Joey
      // 2026-05-04) now build-time-enforced:
      //
      // 1. no-bare-supabase-write: every admin.from(...).insert/update/
      //    upsert/delete chain captures { error } or chains
      //    .throwOnError(). Was warn from PR-B1; flipped to error in
      //    PR-B4 after PR-B1/B2a/B2b/B3/B4 wrapped all 249 sites with
      //    appropriate destructive/side-effect policy comments.
      "local/no-bare-supabase-write": "error",
      // 2. require-connection-in-admin-pages: every async server-
      //    component body under (admin)/admin/* and (app)/admin/* that
      //    renders JSX + reads from Supabase calls await connection()
      //    (or cookies/headers/params) within its first 5 statements.
      //    Was warn from PR-B1; baseline was already 0 by PR #131 + PR-B4.
      "local/require-connection-in-admin-pages": "error",
      // 3. sentry-flush-before-return: every exported route handler /
      //    server action that calls logger.error followed by a return
      //    has `await flushSentry()` (or is wrapped with
      //    withSentryFlush). Was warn from PR #138; flipped to error
      //    in PR-B4 after PR-B4 wraps + the redirect-as-exit + nested-
      //    callback fixes from PR #138 amendment cleared all sites.
      //
      // Suppressing any of these now requires a per-line eslint-disable
      // comment with reason — see CONTRIBUTING.md per-rule sections.
      "local/sentry-flush-before-return": "error",
      // Post-Phase-2 cleanup additions (Joey 2026-05-04). Two new
      // capture-amplification-class rules, both starting at `warn`:
      //
      // 4. no-logger-error-in-loop: logger.error inside for/while/
      //    forEach/map/etc. queues one Sentry event per iteration. The
      //    PromiseBuffer caps at 100 events per request — past that,
      //    captures silently drop. Pattern: collect into array, log
      //    once after the loop. See CONTRIBUTING.md item 4.
      "local/no-logger-error-in-loop": "warn",
      // 5. sentry-flush-before-callback-exit: closes the known-gap
      //    (CONTRIBUTING.md "Known rule gap — nested-callback
      //    logger.error") in sentry-flush-before-return. Walks into
      //    `.catch()` / `withIdempotency(...)` callbacks and flags
      //    outer-function exits that follow without flush. See
      //    CONTRIBUTING.md item 5.
      "local/sentry-flush-before-callback-exit": "warn",
    },
  },
  // Project-specific rule overrides
  {
    rules: {
      // Turn off the default no-unused-vars since unused-imports handles it
      "@typescript-eslint/no-unused-vars": "off",
      // Downgrade to warnings - these don't affect runtime
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-head-element": "warn",
      "@next/next/no-img-element": "warn",
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "prefer-const": "warn",
      // Disable React Compiler rules that are too strict for existing codebase
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/static-components": "off",
      "react-compiler/react-compiler": "off",
      // Disable empty interface rule (common pattern for extending)
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  // PR-03: ban direct imports of outbound-comms SDKs anywhere outside the
  // sandbox-aware helpers. Every `new Resend(...)` / `twilio(...)` /
  // `@sendgrid/*` import has to go through `src/lib/email/resend.ts`,
  // `src/lib/email-sender.ts`, `src/lib/email/**`, `src/lib/twilio-sms.ts`,
  // or `src/lib/twilio-whatsapp.ts`. Those call-sites branch on
  // `isSandbox()` so preview/dev deploys never hit real customer
  // inboxes/phones. The exception allow-list is expressed via per-file
  // overrides below.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "resend",
              message:
                "Import the sandbox-aware client from '@/lib/email/resend' " +
                "or the tenant/system senders from '@/lib/email-sender' instead. " +
                "Raw 'resend' imports bypass the sandbox gate (PR-03).",
            },
            {
              name: "twilio",
              message:
                "Use '@/lib/twilio-sms' or '@/lib/twilio-whatsapp' — those " +
                "helpers branch on isSandbox() before hitting Twilio (PR-03).",
            },
          ],
          patterns: [
            {
              group: ["@sendgrid/*"],
              message:
                "Route outbound email through '@/lib/email-sender' or " +
                "'@/lib/email/resend'. SendGrid imports are banned outside " +
                "the central comms layer (PR-03).",
            },
          ],
        },
      ],
    },
  },
  // Allow-list for files that ARE the sandbox-aware comms layer.
  {
    files: [
      "src/lib/email/resend.ts",
      "src/lib/email-sender.ts",
      "src/lib/email/**",
      "src/lib/twilio-sms.ts",
      "src/lib/twilio-whatsapp.ts",
      "src/lib/sandbox.ts",
      "src/lib/comms/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // W2-004: forbid raw `%${...}%` or `.eq.${...}` (no-quote) patterns
  // inside `.or(` PostgREST filters. User input must go through
  // `escapeOrLiteral` / `ilikeOrValue` / `eqOrValue` from
  // `@/lib/db/or-escape`. Safe patterns are `.${ilikeVal}` / `.${eqVal}`
  // where the expression itself already produces a quoted literal.
  //
  // Regex explanation (applied to the raw template-literal source):
  //   - `%\$\{` : caller used `%${...}%` — unquoted interpolation with
  //     LIKE wildcards, the classic injection surface.
  //   - `\.eq\.\$\{` or `\.ilike\.\$\{` : caller inlined an unquoted
  //     value right after a PostgREST operator.
  //
  // Patterns that only use `${varAlreadyQuotedByHelper}` (like
  // `name.${ilikeVal}`) do not match and are allowed.
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='or'] TemplateLiteral[quasis.0.value.raw=/(%\\$\\{|\\.(eq|ilike|neq|gt|lt|gte|lte|like)\\.\\$\\{)/]",
          message:
            "Raw template-literal interpolation inside .or() can break the PostgREST filter " +
            "grammar (`,` `.` `(` `)` `*`). Route user input through escapeOrLiteral / " +
            "ilikeOrValue / eqOrValue from '@/lib/db/or-escape' (W2-004).",
        },
        {
          selector:
            "CallExpression[callee.property.name='or'] TemplateLiteral[quasis.1.value.raw=/(%\\$\\{|\\.(eq|ilike|neq|gt|lt|gte|lte|like)\\.\\$\\{)/]",
          message:
            "Raw template-literal interpolation inside .or() can break the PostgREST filter " +
            "grammar. Route user input through escapeOrLiteral / ilikeOrValue / eqOrValue " +
            "from '@/lib/db/or-escape' (W2-004).",
        },
      ],
    },
  },
  // Allow-list: the or-escape helper itself and its tests.
  {
    files: [
      "src/lib/db/or-escape.ts",
      "src/lib/__tests__/or-escape.test.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]);

export default eslintConfig;

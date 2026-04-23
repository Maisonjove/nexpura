import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

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

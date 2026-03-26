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
]);

export default eslintConfig;

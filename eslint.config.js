import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "client/src/components/ui/**", // shadcn-generated primitives, not hand-maintained
      "drizzle/migrations/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  // Type-aware rules — only the ones worth the cost of full type info.
  // Excludes *.test.ts: tsconfig.json itself excludes test files from the
  // project (see "exclude"), so the type-aware project service can't see
  // them — they still get the non-type-aware rules from configs.recommended.
  {
    files: ["server/**/*.ts", "client/src/**/*.{ts,tsx}", "shared/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  // React hooks rules for client code.
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // This codebase leans on `any` a lot for loosely-typed JSON blobs (exercise
  // data, meal plans) — not worth blocking on right now. Unused vars/args are
  // real bugs worth catching, but prefixing with `_` is the established way
  // to opt out intentionally (e.g. destructuring/callback params).
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // This codebase's convention for optional localStorage/sessionStorage
      // writes is a deliberately-empty catch (private browsing, quota, etc.
      // shouldn't break the feature). Other empty blocks still get flagged.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  }
);

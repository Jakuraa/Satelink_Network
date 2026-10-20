// ESLint flat config (W0, 2026-10-20). The lint script was `echo Skipped`, so CI never linted
// this app. Built from the plugins
// directly: eslint-config-next's base config loads a parser that requires `next` from the
// repo root, where npm does not install it (next lives per app).
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "out/**", "build/**", "playwright-report/**", "test-results/**"] },
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    settings: { react: { version: "detect" } },
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/no-unescaped-entities": "error",
      "react/jsx-key": "error",
      // apps/web carried 184 explicit `any`s when lint was first enabled (2026-10-20; tracked as
      // W0 tech debt in docs/build/BUILD_LEDGER.md). Warn here; console and corporate enforce it.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

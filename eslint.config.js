import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Ignore build output and agent scratch worktrees. `.claude/**` matters:
  // ESLint does NOT read .gitignore, so without this the linter walks
  // `.claude/worktrees/*` copies and double/triple-counts every finding
  // (e.g. 30 real exhaustive-deps warnings reported as 92).
  { ignores: ["dist", ".claude/**", "**/*.timestamp-*.mjs", "android/**", "ios/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // QA-02 2/3 (2026-07-17): re-enabled — nothing caught dead code before.
      // _-prefix opt-out for intentionally-unused args/vars; catch bindings exempt.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
);

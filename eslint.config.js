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
  // supabase/.temp is written by `supabase start` — bundled, minified runtime
  // code the CLI drops into the working tree. It is not ours and it is not
  // committed, but eslint does not read .gitignore, so anyone who starts the
  // local stack before running the lint gate got 189 errors from it.
  // ds-bundle/** came from main (#576) for the same reason.
  {
    ignores: [
      "dist",
      ".claude/**",
      "**/*.timestamp-*.mjs",
      "android/**",
      "ios/**",
      "supabase/.temp/**",
      "ds-bundle/**",
    ],
  },
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
      // react-hooks v7's `recommended` adds the React Compiler rules (180 hits
      // on 2026-11-03). Keep the v5 set until those are triaged on purpose.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // New in eslint 10 `recommended`; 19 hits, mostly edge functions + workers
      // (shop-sepay-ipn, dupr-webhook). Off for parity with eslint 9 — fixing
      // them redeploys those functions, so do it in its own PR.
      "no-useless-assignment": "off",
      "preserve-caught-error": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // QA-02 2/3 (2026-07-17): re-enabled — nothing caught dead code before.
      // _-prefix opt-out for intentionally-unused args/vars; catch bindings exempt.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
);

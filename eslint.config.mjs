import js from "@eslint/js";

export default [
  {
    ignores: [".changeset/**", "coverage/**", "dist/**", "node_modules/**", "pnpm-lock.yaml"]
  },
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        AbortSignal: "readonly",
        console: "readonly",
        process: "readonly"
      }
    }
  }
];

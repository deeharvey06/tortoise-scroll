import { defineConfig } from "eslint/config";
// import js from "eslint/configs/js";
import globals from "globals";

export default defineConfig([
  // 1. Apply global ignores first
  {
    ignores: ["dist/", "build/", "node_modules/"],
  },

  // 2. Base configuration for JavaScript files
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      js,
    },
    // Apply recommended rules
    rules: {
      // ...js.configs.recommended.rules,
      "no-unused-vars": "warn",
      "prefer-const": "error",
    },
  },
]);

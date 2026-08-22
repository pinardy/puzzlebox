import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      ...tseslint.configs.recommended,
      reactRefresh.configs.vite,
      prettier
    ],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // The classic hooks rules only — the v7 compiler preset flags
      // established patterns here (read-once useRef(loadSlot()) etc.).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Ignored callback params are underscore-prefixed by convention.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  }
);

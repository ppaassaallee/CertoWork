import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist/**/*", "dist/**", "node_modules/**/*", "vite.config.ts"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "off",
      "no-empty": "warn",
      "no-useless-escape": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/components/ui/Icon.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message: "Import Icon from src/components/ui/Icon.tsx.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/components/ui/Icon.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{6}/]",
          message:
            "No raw hex in components. Use CSS variables or chartColors.ts.",
        },
      ],
    },
  },
];

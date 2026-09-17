import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Hardening Paso 0 — CI guardrails.
 *
 * Debt rules start as **warn** on the whole tree so `npm run lint` stays green.
 * `src/features/**` and `src/lib/**` (where new code lands) use the same rules at
 * **error** for restricted syntax / firestore imports once counts are driven
 * down; today those paths still carry legacy debt, so they stay warn + are
 * enforced by `npm run lint:budget` (fails if any budget number rises).
 *
 * Targets (elevate to error when budget allows):
 * - max-lines 600
 * - @typescript-eslint/no-explicit-any
 * - no native <select>, window.confirm/alert, locale ternaries
 * - no firebase/firestore imports outside src/lib
 */

const debtRestrictedSyntax = [
  {
    selector: 'JSXOpeningElement[name.name="select"]',
    message: "Usá <Select> de src/components/ui.",
  },
  {
    selector:
      'CallExpression[callee.object.name="window"][callee.property.name=/^(confirm|alert)$/]',
    message: "Usá DestructiveDialog o toast.",
  },
  {
    selector:
      'ConditionalExpression[test.type="BinaryExpression"][test.left.name="locale"]',
    message: "Usá t().",
  },
  {
    selector:
      'ConditionalExpression[test.type="BinaryExpression"][test.right.name="locale"]',
    message: "Usá t().",
  },
];

const debtRulesWarn = {
  "max-lines": [
    "warn",
    { max: 600, skipBlankLines: true, skipComments: true },
  ],
  "@typescript-eslint/no-explicit-any": "warn",
  "no-restricted-syntax": ["warn", ...debtRestrictedSyntax],
};

export default [
  {
    ignores: [
      "dist/**/*",
      "dist/**",
      "node_modules/**/*",
      "vite.config.ts",
      "vite.config.js",
      "scripts/**",
      "lint-budget.json",
    ],
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
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
  },

  // Whole src: debt rules as warnings (baseline).
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/components/ui/Icon.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...debtRulesWarn,
      "no-restricted-imports": [
        "warn",
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

  // UI components: keep hex ban as error; debt syntax stays warn (budget CI).
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
      // Firestore only from lib — warn until repos absorb writers.
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "lucide-react",
              message: "Import Icon from src/components/ui/Icon.tsx.",
            },
            {
              name: "firebase/firestore",
              message:
                "Firestore writes belong in src/lib/<entity>/storage.ts — not in components.",
            },
          ],
          patterns: [
            {
              group: ["firebase/firestore/*"],
              message:
                "Firestore writes belong in src/lib/<entity>/storage.ts — not in components.",
            },
          ],
        },
      ],
    },
  },

  // New-code homes: same debt rules (warn today; budget CI fails on regressions).
  // When max-lines/any budgets drop, flip these to "error".
  {
    files: ["src/features/**/*.{js,jsx,ts,tsx}", "src/lib/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...debtRulesWarn,
      "no-restricted-imports": [
        "warn",
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

  // Features must not import firestore directly (lib/* may).
  {
    files: ["src/features/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "lucide-react",
              message: "Import Icon from src/components/ui/Icon.tsx.",
            },
            {
              name: "firebase/firestore",
              message:
                "Firestore writes belong in src/lib/<entity>/storage.ts — not in features.",
            },
          ],
          patterns: [
            {
              group: ["firebase/firestore/*"],
              message:
                "Firestore writes belong in src/lib/<entity>/storage.ts — not in features.",
            },
          ],
        },
      ],
    },
  },
];

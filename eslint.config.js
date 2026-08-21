import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist/**/*", "dist/**", "node_modules/**/*", "vite.config.ts"]
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
         ecmaVersion: 'latest',
         sourceType: 'module'
      }
    },
    rules: {
         "no-unused-vars": "warn",
         "no-undef": "off",
         "no-restricted-imports": ["error", {
           paths: [{
             name: "lucide-react",
             message: "Import icons from src/components/ui/Icon.tsx"
           }]
         }]
    }
  }
];

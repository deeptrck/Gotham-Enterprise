import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "dist-workers/**",
      "amplify/backend/types/**",
      "lib/**/*.js",
      "scripts/**/*.js",
    ],
  },
  {
    files: [
      "app/admin/**/*.{ts,tsx}",
      "app/api/**/*.{ts,tsx}",
      "app/backoffice/**/*.{ts,tsx}",
      "app/login/**/*.{ts,tsx}",
      "app/results/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
    ],
    // These existing areas contain legacy patterns being migrated incrementally.
    // New code outside these paths keeps the stricter Next.js defaults.
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import tailwindcss from "eslint-plugin-tailwindcss";

export default defineConfig([
  ...nextVitals,
  tailwindcss.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "tailwindcss/no-custom-classname": "off",
      "tailwindcss/classnames-order": "off",
      "tailwindcss/no-unnecessary-arbitrary-value": "off",
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling"],
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
    settings: {
      tailwindcss: { cssConfigPath: "app/globals.css" },
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
    },
  },
  prettier,
  globalIgnores([
    ".next/**",
    "lib/generated/**",
    "components/ui/**",
    "next-env.d.ts",
  ]),
]);

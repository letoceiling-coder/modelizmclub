import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
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
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Дизайн-токены (W0-04): точные px в spacing-классах — предупреждение.
      // Шкала Tailwind (4px) покрывает все значения проекта: p-[12px] → p-3.
      // Уровень warn: существующие ~2200 вхождений мигрируют волнами (W4-09),
      // правило останавливает только новые. См. docs/design-system.md.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/(^|\\s)-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy])-\\[\\d+px\\]/]',
          message: "Используйте шкалу отступов Tailwind вместо точных px (p-[12px] → p-3). См. docs/design-system.md",
        },
        {
          selector:
            'JSXAttribute[name.name="className"] TemplateElement[value.raw=/(^|\\s)-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy])-\\[\\d+px\\]/]',
          message: "Используйте шкалу отступов Tailwind вместо точных px (p-[12px] → p-3). См. docs/design-system.md",
        },
      ],
    },
  },
  eslintPluginPrettier,
);

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
            {
              // Полный `motion` тянет движок framer-motion в тот чанк, где стоит.
              // Везде — только `m` под LazyMotion (components/motion/MotionProvider.tsx).
              // Один случайный `motion.div` на первом экране молча вернул бы движок
              // в главный чанк. Исключения — два админских файла ниже.
              name: "framer-motion",
              importNames: ["motion"],
              message:
                "Импортируйте `m` вместо `motion`: движок анимаций грузится лениво через MotionProvider. См. src/components/motion/MotionProvider.tsx.",
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
          // Аватар мимо общего компонента — это оригинал вместо варианта.
          // 05.09 на первом экране ленты так грузились 412 КБ PNG 480×480 в
          // кружок 32 пикселя. UserAvatar и ui/avatar запрашивают thumb;
          // сырой <img src={x.avatar}> — нет.
          selector:
            'JSXElement > JSXOpeningElement[name.name=/^(img|Img)$/] > JSXAttribute[name.name="src"] > JSXExpressionContainer MemberExpression[property.name=/[Aa]vatar/]',
          message:
            'Аватар рисуйте через <UserAvatar> из @/components/ui/UserAvatar — он запрашивает вариант thumb. Если это не аватар пользователя, оберните src в variantUrl(x, "thumb").',
        },
        {
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/(^|\\s)-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy])-\\[\\d+px\\]/]',
          message:
            "Используйте шкалу отступов Tailwind вместо точных px (p-[12px] → p-3). См. docs/design-system.md",
        },
        {
          selector:
            'JSXAttribute[name.name="className"] TemplateElement[value.raw=/(^|\\s)-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy])-\\[\\d+px\\]/]',
          message:
            "Используйте шкалу отступов Tailwind вместо точных px (p-[12px] → p-3). См. docs/design-system.md",
        },
        {
          // Пустой обработчик отказа. Здесь он подсказка в редакторе — уровень
          // у всего правила один, и поднять его до ошибки значило бы сделать
          // ошибками полторы тысячи предупреждений про px. Воротами служит
          // deploy/scripts/check-empty-catch.sh, он падает на первом же
          // вхождении.
          selector:
            'CallExpression[callee.property.name="catch"] > ArrowFunctionExpression > BlockStatement[body.length=0]',
          message:
            "Пустой catch запрещён. Возьмите reportActionFailure, reportReadFailure или ignoreFailure из @/lib/errors/handle — три ответа на три случая, см. docblock файла.",
        },
      ],
    },
  },
  {
    // Reorder и useDragControls работают только с полным `motion`. Оба файла —
    // в ленивом чанке админки, до первого экрана не доходят. Правило
    // переобъявлено целиком: в плоском конфиге поздний блок заменяет его, а не
    // дополняет, поэтому запрет на `server-only` повторён.
    files: [
      "src/components/admin/ReviewCategoriesAdminSection.tsx",
      "src/components/admin/LandingBlocksAdminCard.tsx",
    ],
    rules: {
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
    },
  },
  eslintPluginPrettier,
);

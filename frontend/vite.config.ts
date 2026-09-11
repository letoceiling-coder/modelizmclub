// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Итоговая статика лежит в .output/public (её собирает Nitro в конце сборки),
// туда же кладём service worker. Каталог создаём заранее: vite-plugin-pwa
// отрабатывает и на ранних проходах, до того как Nitro что-то сгенерировал.
const NITRO_PUBLIC_DIR = resolve(import.meta.dirname, ".output/public");

function ensureNitroPublicDir(): Plugin {
  return {
    name: "modelizm:ensure-nitro-public-dir",
    apply: "build",
    buildStart() {
      mkdirSync(NITRO_PUBLIC_DIR, { recursive: true });
    },
  };
}

/*
 * Иконки, которые импортируются статически, — в один чанк.
 *
 * lucide-icon.ts держит выбранный список иконок обычным импортом и добирает
 * остальные ленивым `import("lucide-react")`. Иконка, попавшая в оба графа,
 * оказывается общей между главным чанком и ленивым хвостом, и Rollup выносит
 * каждую такую в отдельный файл. Замер сборки 06.09: 134 чанка мельче 4 КБ на
 * 156 КБ суммарно, из них 46 импортирует сам хвост. На /communities/:id это
 * два десятка отдельных соединений на критическом пути — они финишировали
 * одной отсечкой и давали разброс прогонов Lighthouse в 30 пунктов.
 *
 * Склеиваем только те иконки, что действительно импортируются статически:
 * список собирается из исходников. Свалить в общий чанк все `icons/*` нельзя —
 * тогда туда уедет и хвост, и первый экран потянет 537 КБ вместо сорока.
 */
function staticallyImportedLucideIcons(): Set<string> {
  const names = new Set<string>();
  const named = /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
      const source = readFileSync(full, "utf8");
      for (const match of source.matchAll(named)) {
        for (const raw of match[1].split(",")) {
          // «Send as SendIcon» — в файле иконки лежит исходное имя.
          const name = raw.split(" as ")[0].trim();
          if (/^[A-Z][A-Za-z0-9]*$/.test(name)) names.add(kebab(name));
        }
      }
    }
  };

  walk(resolve(import.meta.dirname, "src"));
  return names;
}

/** `BellOff` → `bell-off`, `Settings2` → `settings-2`: так названы файлы lucide. */
function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .toLowerCase();
}

/*
 * Список существующих имён lucide — отдельным ленивым модулем.
 *
 * `resolveLucideIcon` на незнакомом имени добирал всю библиотеку ленивым
 * `import("lucide-react")`. Имя, которого в lucide нет вовсе, стоило ровно
 * столько же — и всё равно оставляло на экране заглушку.
 *
 * Замер прода 07.09: в `post_categories` лежит `tank` (категория
 * «Бронетехника»), такой иконки в lucide нет ни в одной версии. Каждая
 * загрузка /feed тянула из-за неё бочку `lucide-react-*.js`: 549 КБ
 * исходника, 115 КБ по проводу brotli, плюс восемь отдельных чанков-иконок,
 * на которые бочка разбивается. Ради пустого места.
 *
 * Теперь промах сначала спрашивает этот список — 24 КБ исходника, 6,8 КБ
 * brotli, — и лезет за библиотекой, только если имя в ней действительно
 * есть. Список собирается из установленного пакета, поэтому не расходится
 * с ним при обновлении.
 */
const LUCIDE_NAMES_ID = "virtual:lucide-names";

function lucideNamesModule(): Plugin {
  return {
    name: "modelizm:lucide-names",
    resolveId(id) {
      return id === LUCIDE_NAMES_ID ? "\0" + LUCIDE_NAMES_ID : undefined;
    },
    load(id) {
      if (id !== "\0" + LUCIDE_NAMES_ID) return undefined;
      const dir = resolve(import.meta.dirname, "node_modules/lucide-react/dist/esm/icons");
      const names = readdirSync(dir)
        .filter((f) => f.endsWith(".js"))
        .map((f) => f.slice(0, -3))
        .sort();
      // Одной строкой с разделителем: так их сжимает brotli, а массив из
      // 1936 строковых литералов раздувает и исходник, и разбор.
      return `export const NAMES = ${JSON.stringify(names.join(" "))}.split(" ");\n`;
    },
  };
}

const EAGER_ICONS = staticallyImportedLucideIcons();

// Цвета берутся из токенов тёмной темы (src/styles.css): --bg-primary для
// подложки/строки состояния, --accent для акцента установленного приложения.
const THEME_COLOR = "#1a1a1e";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // VPS runs a long-lived Node process (systemd). The wrapper defaults Nitro to
  // the cloudflare target, which exits immediately under Node and yields 502.
  // compressPublicAssets переехал в nitro.config.ts — там его тип объявлен
  // по-настоящему, а в наборе ключей обёртки его нет. См. комментарий там.
  nitro: { preset: "node-server" },
  vite: {
    build: {
      // Карта исходников только для разбора состава чанков:
      //   NODE_OPTIONS=--max-old-space-size=8192 BUNDLE_ANALYZE=1 bun run build
      // В обычной сборке её нет — .map не должен уехать на прод.
      sourcemap: process.env.BUNDLE_ANALYZE === "1",
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            const icon = /[\\/]lucide-react[\\/].*[\\/]icons[\\/]([^\\/]+)\.m?js$/.exec(id);
            if (icon && EAGER_ICONS.has(icon[1])) return "lucide-core";
            return undefined;
          },
        },
      },
    },
  },
  plugins: [
    ensureNitroPublicDir(),
    lucideNamesModule(),
    VitePWA({
      // Свой service worker (src/sw.ts): страницы отдаёт SSR, поэтому готовые
      // стратегии generateSW с их SPA-фолбэком тут не подходят.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      outDir: NITRO_PUBLIC_DIR,
      // Обновление не применяется молча — пользователь подтверждает его тостом
      // (см. components/pwa/PwaUpdatePrompt.tsx).
      registerType: "prompt",
      injectRegister: null,
      manifest: {
        name: "МоДелизМ",
        short_name: "МоДелизМ",
        description: "Сообщество моделистов: лента, сообщества, объявления и безопасные сделки.",
        lang: "ru",
        dir: "ltr",
        display: "standalone",
        start_url: "/feed",
        scope: "/",
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        icons: [
          { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/pwa/icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "/pwa/screenshot-mobile.png",
            sizes: "375x812",
            type: "image/png",
            form_factor: "narrow",
          },
        ],
      },
      injectManifest: {
        // В прекеш идёт только оболочка: офлайн-страница и иконки. JS/CSS с
        // хешем в имени кешируются на лету (stale-while-revalidate), иначе
        // каждый релиз тянул бы весь бандл до первого экрана.
        globDirectory: resolve(import.meta.dirname, "public"),
        globPatterns: ["offline.html", "favicon.ico", "pwa/*.png"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
});

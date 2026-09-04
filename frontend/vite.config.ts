// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

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
  nitro: { preset: "node-server", compressPublicAssets: { gzip: true, brotli: true } },
  plugins: [
    ensureNitroPublicDir(),
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

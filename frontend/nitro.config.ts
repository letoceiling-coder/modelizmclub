import { defineNitroConfig } from "nitro/config";

/**
 * Настройки Nitro, которых нет в узкой обёртке.
 *
 * `@lovable.dev/vite-tanstack-config` объявляет для ключа `nitro` всего три
 * поля — `preset`, `output`, `cloudflare` — и пишет об этом прямо: «The option
 * surface is narrow on purpose … File an issue if you need more». Значения
 * оттуда доходят до `nitro()`, поэтому `compressPublicAssets` работал и в
 * `vite.config.ts` (в сборке лежат по 140 файлов `.gz` и `.br`), но проверку
 * типов не проходил: ключа в объявлении обёртки нет.
 *
 * Обходить это приведением типа — значит соврать компилятору про чужой
 * интерфейс. Nitro читает собственный `nitro.config.ts` и типизирует его сам,
 * поэтому настройка переехала туда, где её тип объявлен по-настоящему.
 *
 * `preset` остаётся в `vite.config.ts`: он относится к тому, как обёртка
 * запускает Nitro, и в её наборе ключей объявлен.
 */
export default defineNitroConfig({
  compressPublicAssets: { gzip: true, brotli: true },
});

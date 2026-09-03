# 70 — Факты производительности

Срез `origin/master` @ `ecb4d60`. Замеры — `01-baseline.md` (сборка) и
`02-lighthouse-2026-09-03.md` (прод). Здесь только факты из кода и ответов
сервера, без рекомендаций.

## Чанки

Сборка даёт **127** клиентских JS-чанков, **5716 КБ** raw суммарно.

| Чанк | raw | gzip | Отдаётся на проде |
|---|---:|---:|---|
| `index-*.js` | 2268 КБ | 668 КБ | **2320098 байт без сжатия** |
| `heic2any-*.js` | 1324 КБ | 333 КБ | отдельный чанк |
| `LiveKitRoomUI-*.js` | 624 КБ | 169 КБ | отдельный чанк |
| `admin-*.js` | 300 КБ | 61 КБ | отдельный чанк |
| `messenger-*.js` | 88 КБ | 22 КБ | |

**Сжатие на сервере не включено.** Запрос с `Accept-Encoding: gzip, br` к
`/assets/index-*.js` возвращает `content-length: 2320098` без заголовка
`content-encoding`. CSS так же — 161 813 байт. Кэширование при этом настроено
правильно: `cache-control: public, max-age=31536000, immutable`.

## Запросы при открытии главной

**20 запросов, 4902 КБ** (мобильный профиль Lighthouse).

| Тип | Штук |
|---|---:|
| Image | 8 |
| Script | 6 |
| Stylesheet | 2 |
| Document | 1 |
| Fetch | 1 |
| Font | 1 |
| Other | 1 |

К API — **6** запросов, из них пять отдают картинки через
`/api/v1/media/<uuid>` (707, 702, 519, 157, 65 КБ) и один настоящий
data-запрос — `/api/v1/plans` (1.1 КБ).

## `herovideo.mp4`

| Проверка | Результат |
|---|---|
| `/herovideo.mp4` | **404** |
| `/videos/herovideo.mp4` | 200, `content-type: video/mp4`, **6 005 880 байт** |
| `Accept-Ranges` | `bytes` — заявлено |
| Range-запрос `bytes=0-1023` | **HTTP 200 с полным файлом**, `Content-Range` отсутствует |
| `Cache-Control` | **отсутствует** |
| Запросов на главной | **0** — в текущей вёрстке видео не подключено |
| `herovideo.webm` рядом | 200, 2 238 893 байта — не используется |

Сервер объявляет поддержку range-запросов, но отвечает на них полным файлом.
Это воспроизводит `net::ERR_ABORTED`: браузер запрашивает диапазон, получает
6 МБ, обрывает соединение.

В коде фронта видео упоминается один раз — как placeholder в поле админки
(`frontend/src/components/admin/LandingBlocksAdminCard.tsx:256`), то есть
адрес подставляется контент-менеджером через настройку блока лендинга.

## Изображения

| Признак | Значение |
|---|---:|
| Тегов `<img` в `frontend/src` | **83** |
| С `loading="lazy"` | **15** (18%) |
| С `decoding="async"` | 5 |
| С заданными `width`/`height` | **2** |
| `<picture>` или `srcSet` | 3 |

WebP/AVIF-вариантов на фронте нет; картинки приходят как есть из
`/api/v1/media/<uuid>`. Три изображения на главной весят 519–707 КБ каждое.

Отсутствие `width`/`height` у 81 из 83 тегов — прямой вклад в CLS
(0.226 на `/feed`, 0.133 на `/subscription`).

## `content-visibility`

Применён в двух правилах `frontend/src/styles.css`:

    }
    
    /* Off-screen feed cards skip layout/paint but still reserve their height, so
       long lists stay cheap without the scroll-anchoring bugs of a virtualiser. */
    .feed-virtual-item {
      content-visibility: auto;
      contain-intrinsic-size: auto 420px;
    }
    
    .catalog-virtual-item {
      content-visibility: auto;
      contain-intrinsic-size: auto 320px;
    }
    
    /* Landing tappable cards — on touch devices iOS applies sticky :hover on the
       first tap (border/transform via JS or Tailwind hover:*), which consumes the

Классы `feed-virtual-item` и `catalog-virtual-item` навешены в
`components/PostCard.tsx:750` и `components/ads/CatalogCard.tsx:28`.

**Виртуализации списков нет:** ни `react-window`, ни `react-virtuoso` в
зависимостях отсутствуют. Названия классов содержат слово «virtual», но за
ними стоит только CSS `content-visibility: auto`, а не оконный рендер.

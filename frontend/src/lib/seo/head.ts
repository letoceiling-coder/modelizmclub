/**
 * Заголовки, описания и превью публичных страниц. ТЗ раздел 2, промпт 2.
 *
 * Было (замер 07.10 на боевой сборке, запросом без браузера): у страниц
 * разделов заголовок и описание свои, а у карточек — общие на весь сайт.
 *
 * | Адрес | title | description | og:title |
 * | --- | --- | --- | --- |
 * | `/ads` | «Объявления — МоДелизМ» | каталога | «МоДелизМ — сообщество моделистов» |
 * | `/ads/1` | «Объявление — МоДелизМ» | сайта целиком | «МоДелизМ — сообщество моделистов» |
 * | `/channel/tamiya` | «Канал — МоДелизМ» | сайта целиком | то же |
 * | `/communities/…` | «Сообщество — МоДелизМ» | сайта целиком | то же |
 * | `/user/3` | «Профиль — МоДелизМ» | сайта целиком | то же |
 *
 * То есть любая ссылка на объявление, канал или сообщество в мессенджере
 * показывалась одинаково — именем площадки и одной и той же картинкой.
 * Механизм при этом был на месте: `head` уже получал `loaderData` и строил
 * из него `preload` обложки, не использовались только название и описание.
 *
 * Поэтому здесь не новый слой, а одна сборка метаданных на все карточки:
 * имя сущности в заголовке, её же описание, её картинка в превью,
 * канонический адрес и структурированные данные.
 *
 * Ничего не выдумывается: если у сущности нет описания, тега description
 * не будет вовсе — общий текст про площадку в карточке врёт не меньше, чем
 * его отсутствие, а пустое поле поисковик заполняет сам.
 */

export const SITE_ORIGIN = "https://modelizmclub.ru";
export const SITE_NAME = "МоДелизМ";
export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

/** Реквизиты — те же, что в правовых документах; второго источника нет. */
export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "ООО «МОДЕЛИЗМ»",
    alternateName: SITE_NAME,
    url: SITE_ORIGIN,
    email: "modelizmclub@mail.ru",
    telephone: "+7-989-808-98-88",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Краснодар",
      addressCountry: "RU",
    },
  } as const;
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    inLanguage: "ru-RU",
    publisher: { "@id": ORGANIZATION_ID },
  } as const;
}

/** Абсолютный адрес страницы: и для canonical, и для структурированных данных. */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Картинка превью должна быть абсолютной: мессенджеры относительные адреса
 * не разворачивают. Варианты медиа уже приходят абсолютными с хранилища,
 * а статика из сборки — нет.
 */
export function absoluteImage(url: string | null | undefined): string | null {
  const v = url?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;
  return absoluteUrl(v);
}

/**
 * Описание для поисковика: одна строка, без разметки, обрезанная по слову.
 *
 * 160 знаков — не догма, а то, что показывают выдача и превью; длиннее
 * обрезают они сами, и обрыв посередине слова виден человеку.
 */
export function metaDescription(text: string | null | undefined, limit = 160): string | null {
  const одной = text
    ?.replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!одной) return null;
  if (одной.length <= limit) return одной;
  const обрез = одной.slice(0, limit);
  const пробел = обрез.lastIndexOf(" ");
  return `${(пробел > limit * 0.6 ? обрез.slice(0, пробел) : обрез).replace(/[\s,.;:—-]+$/, "")}…`;
}

/**
 * SVG в превью не годится.
 *
 * Ни Telegram, ни WhatsApp, ни VK, ни Twitter не рисуют `og:image` в SVG —
 * показывают пустое место вместо картинки. То есть такой тег хуже, чем его
 * отсутствие: без него подхватывается превью площадки, с ним — ничего.
 *
 * Попадает сюда это не из загруженных файлов, а из рисованных аватаров:
 * `api.dicebear.com/7.x/initials/svg?seed=…` стоит у каждого, кто своей
 * фотографии не поставил. Замер 07.10 на `/user/{uuid}`: og:image вёл
 * ровно туда.
 */
function isSvg(url: string): boolean {
  return /\.svg($|[?#])/i.test(url) || /\/svg(\?|$)/i.test(url) || url.startsWith("data:image/svg");
}

export type OgType = "website" | "article" | "profile" | "product" | "video.other";

interface MetaTag {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
}

export interface PageHeadInput {
  /** Своё имя страницы без хвоста площадки; пустое — берётся запасной. */
  title?: string | null;
  description?: string | null;
  /** Путь без домена: `/ads/12`. Нужен для canonical. */
  path: string;
  image?: string | null;
  type?: OgType;
  /** Заголовок, когда данных ещё или уже нет (гость, отказ API, срок загрузчика). */
  fallbackTitle: string;
  /** Страница закрыта от индексации: кабинет, настройки, переписка. */
  noindex?: boolean;
}

/**
 * Метатеги страницы. Корневой маршрут задаёт те же `og:*` на весь сайт;
 * одноимённые теги глубже по дереву их перекрывают — проверено запросом,
 * в разметке остаётся по одному каждого.
 */
export function pageHead(input: PageHeadInput): {
  meta: MetaTag[];
  links: { rel: string; href: string }[];
} {
  const своё = input.title?.trim();
  const title = своё ? `${своё} — ${SITE_NAME}` : input.fallbackTitle;
  const description = metaDescription(input.description);
  const image = absoluteImage(input.image);
  const url = absoluteUrl(input.path);

  const meta: MetaTag[] = [
    { title },
    { property: "og:title", content: своё ? своё : title },
    { name: "twitter:title", content: своё ? своё : title },
    { property: "og:url", content: url },
    { property: "og:type", content: input.type ?? "website" },
  ];
  if (description) {
    meta.push({ name: "description", content: description });
    meta.push({ property: "og:description", content: description });
    meta.push({ name: "twitter:description", content: description });
  }
  if (image && !isSvg(image)) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
    meta.push({ name: "twitter:card", content: "summary_large_image" });
  }
  if (input.noindex) {
    // noindex и follow: страницу не показывать в выдаче, ссылки с неё читать.
    meta.push({ name: "robots", content: "noindex, follow" });
  }

  return { meta, links: [{ rel: "canonical", href: url }] };
}

/** `<script type="application/ld+json">` в head для `head()` маршрута. */
export function jsonLdScript(graph: object[]): { type: string; children: string }[] {
  if (graph.length === 0) return [];
  return [
    {
      type: "application/ld+json",
      children: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
    },
  ];
}

export interface Crumb {
  name: string;
  path: string;
}

/**
 * Хлебные крошки для карточек. Первая — всегда площадка: путь к карточке
 * начинается с главной, и поисковик показывает его целиком.
 */
export function breadcrumbNode(crumbs: Crumb[]) {
  const все = [{ name: SITE_NAME, path: "/" }, ...crumbs];
  return {
    "@type": "BreadcrumbList",
    itemListElement: все.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

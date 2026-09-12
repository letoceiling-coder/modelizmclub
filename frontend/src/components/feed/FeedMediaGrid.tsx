import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { getMediaAspect, rememberMediaAspect } from "@/lib/media/aspectCache";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import { displaySrc, toDisplayMedia, variantUrl, type DisplayMedia } from "@/lib/media/variants";

/**
 * Снимок сетки: адрес, варианты и пропорция, если её знает API
 * (`media.width / media.height`). С пропорцией одиночное фото встаёт в
 * свой размер с первого кадра, а не после отдельного замера картинки.
 */
export type GridMedia = DisplayMedia & { aspect?: number };

/** Зазор между плитками — 4, по шкале отступов. Было 2. */
const GRID_GAP = 4;
/**
 * Потолок высоты всего блока: 400 на телефоне, 512 от 768. Задан классами,
 * чтобы брейкпоинт считал браузер, а не скрипт после гидрации.
 */
const MAX_H = "max-h-[400px] md:max-h-[512px]";

function useImageAspect(url: string, known?: number): number | null {
  const [aspect, setAspect] = useState<number | null>(() => known ?? getMediaAspect(url) ?? null);

  useEffect(() => {
    if (known) {
      setAspect(known);
      return;
    }
    const cached = getMediaAspect(url);
    if (cached != null) {
      setAspect(cached);
      return;
    }
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (!active || !img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      rememberMediaAspect(url, ratio);
      setAspect(ratio);
    };
    // thumb, not the original: this Image exists only to read naturalWidth,
    // and the proxy returns the original when a variant is missing, so the
    // measurement is identical either way.
    img.src = variantUrl(url, "thumb");
    return () => {
      active = false;
    };
  }, [url, known]);

  return aspect;
}

function GridImage({
  media,
  alt,
  priority = false,
  sizes,
}: {
  media: DisplayMedia;
  alt: string;
  /** LCP candidate (first image of the first feed card). */
  priority?: boolean;
  sizes: string;
}) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <span
        className="flex h-full w-full items-center justify-center"
        style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}
      >
        <ImageOff className="h-[18px] w-[18px]" />
      </span>
    );
  }
  return (
    <ResponsiveImage
      media={media}
      alt={alt}
      /*
       * `thumb` в списке обязателен, иначе плитки качают лишнее.
       *
       * `sizes` для мелкой плитки объявляет 34vw — при 412 px это ~140 CSS px,
       * то есть ~245 device px. Но в `srcset` предлагались только 640 и
       * 1080 px, и браузер честно брал наименьшее доступное — `card` на 18 КБ
       * вместо `thumb` на 8 КБ. На первом экране ленты таких плиток восемь
       * (замер 12.09: 15 изображений на 238 КБ стартуют вместе с LCP-картинкой).
       */
      variants={["thumb", "card", "medium"]}
      sizes={sizes}
      width={680}
      height={680}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      /*
       * Всё, кроме кандидата LCP, ждёт подхода к экрану. Плитки первого
       * экрана от этого тоже выигрывают: они перестают конкурировать с
       * LCP-картинкой за канал и уходят в сеть после гидрации.
       */
      defer={!priority}
      // Плитка — cover: заполняет свою клетку без растягивания.
      className="h-full w-full object-cover"
      onError={() => setErr(true)}
    />
  );
}

/**
 * Плитка — кнопка: открывает просмотрщик на своём снимке и доступна с
 * клавиатуры. Раньше щелчок висел на самой картинке, и Tab её не находил.
 */
function Tile({
  media,
  index,
  total,
  alt,
  priority,
  sizes,
  extra = 0,
  onOpen,
  style,
}: {
  media: DisplayMedia;
  index: number;
  total: number;
  alt: string;
  priority?: boolean;
  sizes: string;
  /** Сколько снимков не поместилось — «+N» на последней плитке. */
  extra?: number;
  onOpen?: (index: number) => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(index)}
      aria-label={
        extra > 0 ? `Ещё ${extra} фото — открыть` : `Открыть фото ${index + 1} из ${total}`
      }
      className="relative block min-h-0 min-w-0 cursor-zoom-in overflow-hidden"
      style={{ background: "var(--background-surface)", ...style }}
    >
      <GridImage media={media} alt={`${alt} — ${index + 1}`} priority={priority} sizes={sizes} />
      {extra > 0 && (
        // Как во ВКонтакте: плитка затемнена, поверх — «+N» серым.
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center text-[24px] font-semibold"
          style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.8)" }}
        >
          +{extra}
        </span>
      )}
    </button>
  );
}

/**
 * Одно фото — во всю ширину, пропорции сохранены, высота не больше 512
 * (400 на телефоне). Высокий снимок не обрезается: рамка сужается до его
 * пропорции и встаёт по центру.
 */
function SingleImage({
  media,
  alt,
  onOpen,
  priority = false,
}: {
  media: GridMedia;
  alt: string;
  onOpen?: (index: number) => void;
  priority?: boolean;
}) {
  const aspect = useImageAspect(media.url, media.aspect) ?? 4 / 3;
  return (
    <div
      data-media-count={1}
      className={`mx-auto grid ${MAX_H} [--media-max:400px] md:[--media-max:512px]`}
      style={{ aspectRatio: aspect, width: `min(100%, calc(var(--media-max) * ${aspect}))` }}
    >
      <Tile
        media={media}
        index={0}
        total={1}
        alt={alt}
        priority={priority}
        sizes="(max-width:768px) 100vw, 680px"
        onOpen={onOpen}
      />
    </div>
  );
}

/**
 * Адреса снимков для просмотрщика — в том же порядке, в каком сетка их
 * показывает. Карточка строит по ним свой список: номер, который приходит
 * из `onOpenViewer`, должен указывать на тот же снимок.
 */
export function viewerUrls(images: Array<string | DisplayMedia>): string[] {
  return images
    .map((item) => (typeof item === "string" ? toDisplayMedia(item) : item))
    .filter((item): item is DisplayMedia => Boolean(item?.url))
    .map((item) => displaySrc(item, "large"));
}

const BIG = "(max-width:768px) 100vw, 680px";
const SMALL = "(max-width:768px) 34vw, 240px";

/**
 * Сетка фото ленты — по образцу ВКонтакте.
 *
 * | фото | раскладка                                          | блок   |
 * |------|----------------------------------------------------|--------|
 * | 1    | во всю ширину, пропорции снимка                     | ≤ 512  |
 * | 2    | в ряд, равные половины 1:1                          | 2 : 1  |
 * | 3    | большое слева, два в столбик справа                 | 3 : 2  |
 * | 4    | 2 × 2                                              | 4 : 3  |
 * | 5–6  | большое сверху, остальные в ряд снизу               | ≈ 4:3  |
 * | 7–10 | 3 × 3, на девятой плитке затемнение и «+N»          | 4 : 3  |
 *
 * Высота блока задана пропорцией от ширины и потолком — 512 от 768, 400
 * ниже, — поэтому известна с первого кадра: ничего не сдвигается, когда
 * приходят картинки. Каждая плитка — cover. До 11.09 от четырёх снимков
 * всё сводилось к 2 × 2 с «+N», а десять фото растягивались по высоте.
 */
export function FeedMediaGrid({
  images,
  alt,
  priority = false,
  onOpenViewer,
}: {
  images: Array<string | GridMedia>;
  alt: string;
  priority?: boolean;
  /**
   * Открыть просмотрщик на снимке с этим номером.
   *
   * Сам просмотрщик сетка не рисует: окно одно и живёт в карточке — его
   * открывает и счётчик комментариев тоже.
   */
  onOpenViewer?: (index: number) => void;
}) {
  const items = images
    .map((item) => (typeof item === "string" ? (toDisplayMedia(item) as GridMedia) : item))
    .filter((item): item is GridMedia => Boolean(item?.url));

  const n = items.length;
  if (n === 0) return null;
  if (n === 1) {
    return <SingleImage media={items[0]} alt={alt} onOpen={onOpenViewer} priority={priority} />;
  }

  const tile = (i: number, sizes: string, style?: CSSProperties, extra = 0) => (
    <Tile
      key={`${i}-${items[i].url}`}
      media={items[i]}
      index={i}
      total={n}
      alt={alt}
      priority={priority && i === 0}
      sizes={sizes}
      extra={extra}
      onOpen={onOpenViewer}
      style={style}
    />
  );

  let layout: CSSProperties;
  let cells: ReactNode[];

  if (n === 2) {
    layout = { aspectRatio: "2 / 1", gridTemplateColumns: "1fr 1fr" };
    cells = [tile(0, SMALL), tile(1, SMALL)];
  } else if (n === 3) {
    layout = {
      aspectRatio: "3 / 2",
      gridTemplateColumns: "2fr 1fr",
      gridTemplateRows: "1fr 1fr",
    };
    cells = [tile(0, BIG, { gridRow: "1 / 3" }), tile(1, SMALL), tile(2, SMALL)];
  } else if (n === 4) {
    layout = { aspectRatio: "4 / 3", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" };
    cells = items.map((_, i) => tile(i, SMALL));
  } else if (n <= 6) {
    // Верхнее — 2 : 1 во всю ширину, нижние — квадраты: высоты рядов k : 2.
    const k = n - 1;
    layout = {
      aspectRatio: `${2 * k} / ${k + 2}`,
      gridTemplateColumns: `repeat(${k}, 1fr)`,
      gridTemplateRows: `${k}fr 2fr`,
    };
    cells = [
      tile(0, BIG, { gridColumn: "1 / -1" }),
      ...items.slice(1).map((_, j) => tile(j + 1, SMALL)),
    ];
  } else {
    // 3 × 3 из шести колонок: плитка занимает две, а в неполном последнем
    // ряду (7 и 8 снимков) оставшиеся делят ширину поровну.
    const shown = Math.min(n, 9);
    const extra = n - shown;
    const lastRow = shown - 6;
    layout = {
      aspectRatio: "4 / 3",
      gridTemplateColumns: "repeat(6, 1fr)",
      gridTemplateRows: "repeat(3, 1fr)",
    };
    cells = items.slice(0, shown).map((_, i) => {
      const span = i >= 6 ? 6 / lastRow : 2;
      return tile(i, SMALL, { gridColumn: `span ${span}` }, i === 8 ? extra : 0);
    });
  }

  return (
    <div
      data-media-count={n}
      className={`grid w-full overflow-hidden ${MAX_H}`}
      style={{ gap: GRID_GAP, ...layout }}
    >
      {cells}
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/**
 * Догрузка следующей страницы списка — сама, когда конец подходит к экрану.
 * Решение Е5 от 06.10.
 *
 * Жалоба владельца: в каталоге внизу кнопка «Показать ещё», которую
 * приходится нажимать каждый раз. Кнопка остаётся — но только как запасной
 * ход при отказе, как и просит решение.
 *
 * ## Сторож, а не прокрутка руками
 *
 * Пустой узел под списком; `IntersectionObserver` с запасом `rootMargin`
 * сообщает о его приближении заранее, и страница успевает приехать до того,
 * как человек доскроллит до конца.
 *
 * **Корень наблюдателя — ближайший прокручиваемый предок, а не окно.** На
 * широком экране прокручивается `<main>` (`lg:overflow-y-auto`), а не
 * документ. С корнем-окном запас `rootMargin` уходит за край `main`, тот
 * обрезает узел, и наблюдатель молчит до самого низа — то есть запас
 * перестаёт работать ровно там, где он нужен.
 *
 * ## Чего здесь нет
 *
 * Собственного состояния загрузки: `hasMore`, `loading` и `failed` остаются
 * у списка. Иначе два источника правды разъехались бы, и повторный запрос
 * одной страницы стало бы нечем запретить.
 *
 * Скрытая вкладка наблюдателей не будит — `IntersectionObserver` отдаёт
 * колбэки по кадрам. Для человека это незаметно (невидимую страницу он не
 * листает), но замер в скрытой вкладке покажет «не сработало» вместо «не
 * измерялось». Проверено 06.10: `document.visibilityState` в замерах
 * проверяется отдельно.
 */
interface Props {
  /** Есть ли что догружать. Нет — сторож не рисуется вовсе. */
  hasMore: boolean;
  /** Страница уже едет. */
  loading: boolean;
  /** Предыдущая попытка не удалась: вместо сторожа — «Повторить». */
  failed: boolean;
  /** Догрузить следующую страницу. */
  onLoad: () => void;
  /** Повторить после отказа. */
  onRetry: () => void;
  /** Заглушки на время загрузки — рисует вызывающий, в своей сетке. */
  skeletons?: ReactNode;
  /**
   * Что сказать диктору о догруженном. Пустая строка — молчать.
   * Область `aria-live` стоит здесь всегда, а не появляется вместе с
   * текстом: появившуюся область диктор может не прочитать.
   */
  announcement?: string;
  /** Запас, с которым начинать догрузку. */
  rootMargin?: string;
}

/** Ближайший предок, который действительно прокручивается по вертикали. */
function прокручиваемыйПредок(el: HTMLElement | null): HTMLElement | null {
  let узел = el?.parentElement ?? null;
  while (узел) {
    const st = getComputedStyle(узел);
    if (/auto|scroll|overlay/.test(st.overflowY) && узел.scrollHeight > узел.clientHeight + 1) {
      return узел;
    }
    узел = узел.parentElement;
  }
  return null;
}

export function AutoLoadMore({
  hasMore,
  loading,
  failed,
  onLoad,
  onRetry,
  skeletons,
  announcement = "",
  rootMargin = "600px 0px",
}: Props) {
  const { t } = useTranslation();
  const сторож = useRef<HTMLDivElement>(null);
  /* Свежий обработчик без перезаводки наблюдателя на каждый рендер. */
  const грузить = useRef(onLoad);
  грузить.current = onLoad;

  useEffect(() => {
    const узел = сторож.current;
    if (!узел || !hasMore || failed) return;
    if (typeof IntersectionObserver === "undefined") return;
    const наблюдатель = new IntersectionObserver(
      (записи) => {
        if (записи.some((з) => з.isIntersecting)) грузить.current();
      },
      { root: прокручиваемыйПредок(узел), rootMargin },
    );
    наблюдатель.observe(узел);
    return () => наблюдатель.disconnect();
    /*
     * `loading` в зависимостях намеренно: пока страница едет, наблюдатель
     * пересоздаётся и сразу сообщает о видимом стороже снова. Повторный
     * запрос одной страницы это не даёт — его запрещает сам список по
     * `loading`, — а вот следующую страницу начинает без лишнего движения
     * колесом, если сторож так и остался на экране.
     */
  }, [hasMore, failed, loading, rootMargin]);

  return (
    <>
      {loading && skeletons}

      {failed && (
        <div className="mt-[16px] flex flex-col items-center gap-[8px]">
          <p className="text-[13px]" style={{ color: "var(--foreground-70)" }}>
            {t("components.autoLoadMore.failed")}
          </p>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw size={14} className="mr-[6px]" /> {t("pages.shared.retry")}
          </Button>
        </div>
      )}

      {hasMore && !failed && (
        /*
         * Высота 1 px, а не 0: узел нулевой высоты наблюдатель считает
         * непересекающимся, и догрузка не начиналась бы никогда.
         */
        <div ref={сторож} aria-hidden="true" className="h-px w-full" />
      )}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

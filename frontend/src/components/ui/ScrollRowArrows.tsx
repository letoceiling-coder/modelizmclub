import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Стрелки по краям горизонтального ряда — для мыши.
 *
 * Пальцем ряд листается родной прокруткой, и две кнопки поверх крайних
 * элементов там только мешали бы, поэтому стрелки показываются лишь
 * точному указателю (`pointer-fine:`). Замер 06.10 это подтверждает: в
 * контексте с `hasTouch` обе кнопки остаются невидимыми.
 *
 * Из обхода клавиатурой убраны (`tabIndex={-1}`, `aria-hidden`): у ряда
 * вкладок для того же есть стрелки, Home и End, у ряда фильтров — обычный
 * Tab, а диктору лишние «предыдущая/следующая» ничего не добавляют.
 *
 * Края и шаг считает `useRowEdges` из `@/lib/ui/scroll-row`; колесо и
 * перетаскивание — `useScrollRow` оттуда же. Обёртка ряда должна быть
 * `position: relative`.
 */
export function ScrollRowArrows({
  края,
  листать,
  высота = 44,
}: {
  края: { слева: boolean; справа: boolean };
  листать: (куда: -1 | 1) => void;
  /** Высота кнопки — под высоту ряда, чтобы зона нажатия совпадала. */
  высота?: number;
}) {
  const { t } = useTranslation();
  return (
    <>
      {края.слева && (
        <Стрелка
          сторона="left"
          высота={высота}
          подпись={t("common.scrollLeft")}
          onClick={() => листать(-1)}
        />
      )}
      {края.справа && (
        <Стрелка
          сторона="right"
          высота={высота}
          подпись={t("common.scrollRight")}
          onClick={() => листать(1)}
        />
      )}
    </>
  );
}

function Стрелка({
  сторона,
  подпись,
  высота,
  onClick,
}: {
  сторона: "left" | "right";
  подпись: string;
  высота: number;
  onClick: () => void;
}) {
  const Значок = сторона === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      title={подпись}
      onClick={onClick}
      className={`pointer-fine:grid absolute top-1/2 hidden w-7 -translate-y-1/2 place-items-center ${
        сторона === "left" ? "left-0" : "right-0"
      }`}
      style={{
        height: высота,
        /* Подложка под значком того же цвета, что фон ряда: иначе значок
           ложится на подпись крайнего элемента и оба становятся нечитаемы. */
        background:
          сторона === "left"
            ? "linear-gradient(to right, var(--background) 60%, transparent)"
            : "linear-gradient(to left, var(--background) 60%, transparent)",
        color: "var(--foreground-70)",
      }}
    >
      <Значок className="h-[18px] w-[18px]" />
    </button>
  );
}

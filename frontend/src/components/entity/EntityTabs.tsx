import { useEffect, useRef } from "react";
import { m } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ScrollRowArrows } from "@/components/ui/ScrollRowArrows";
import { useRowEdges, useScrollRow } from "@/lib/ui/scroll-row";

export interface EntityTab<K extends string> {
  key: K;
  label: string;
  /**
   * Число рядом с названием. `undefined` — число неизвестно (ещё грузится или
   * у вкладки его нет), кружка нет. Ноль показывается только при `showZero`.
   */
  count?: number;
  /**
   * Значок перед названием. Есть у вкладок профиля, нет у сообщества и
   * канала. Вариант добавлен в сам компонент, а не заведён рядом вторым
   * ряд­ом вкладок: профиль собирал свой и из-за этого остался без ролей.
   */
  icon?: LucideIcon;
}

interface Props<K extends string> {
  tabs: EntityTab<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Общий для страницы идентификатор подчёркивания, чтобы оно переезжало. */
  layoutId: string;
  /**
   * Показывать ноль. У направления счётчик стоит на всех вкладках, и пустой
   * кружок отличает «здесь пусто» от «счётчик не работает». У сообщества и
   * канала ноль по-прежнему скрыт: там счётчики есть не у всех вкладок.
   */
  showZero?: boolean;
}

/**
 * Ряд вкладок сообщества, канала, профиля и направления.
 *
 * Был набран дважды, слово в слово — одинаковые классы, одинаковый
 * `overflow-x-auto no-scrollbar`, одинаковый счётчик. Разъезжались только
 * значения.
 *
 * Ряд прижат влево и не растягивается: вкладок три-четыре, и растянутые на
 * всю ширину они читаются как сегментированный переключатель, а не как
 * навигация по разделу.
 *
 * ## Мышью до дальних вкладок было не добраться
 *
 * Жалоба владельца 06.10, свой профиль, 1280: ряд обрезан справа, мышью до
 * остальных вкладок не дойти. Замер на стенде показал, что дело не в 1280 —
 * ряд переполнен на всех четырёх ширинах, и способа прокрутить его мышью не
 * было ни одного:
 *
 * | Ширина | scrollWidth / clientWidth | Вкладок за краем | Колесо | Перетаскивание |
 * | --- | --- | --- | --- | --- |
 * | 360 | 1048 / 302 | 6 | 0 → 0 | 0 → 0 |
 * | 768 | 1048 / 590 | 4 | 0 → 0 | 0 → 0 |
 * | 1024 | 1048 / 478 | 4 | 0 → 0 | 0 → 0 |
 * | 1280 | 1048 / 547 | 4 | 0 → 0 | 0 → 0 |
 *
 * Полоса прокрутки скрыта (`no-scrollbar`, видимая высота 1 px), колеса ряд
 * не слушал, перетаскивания тоже. Пальцем ряд листался родной прокруткой —
 * поэтому на телефоне дефекта не видно, а мышью вкладки «Сообщества»,
 * «Приглашённые», «Заблокированные» и «О себе» были недостижимы вовсе.
 *
 * Добавлено: стрелки по краям (только для точного указателя — пальцу они не
 * нужны), затухание края как подсказка, что ряд продолжается, и колесо.
 *
 * **Колесо отдаёт прокрутку странице на краях ряда.** Это главное отличие
 * от `HorizontalScrollNav`, где `preventDefault` стоит на любом вертикальном
 * колесе: там ряд, упёршийся в край, молча съедает прокрутку страницы, и
 * колесо над ним перестаёт работать вообще.
 *
 * Клавиатура, роли `tablist`/`tab` и автоцентровка выбранной вкладки были
 * здесь и раньше — и остаются единственным способом для тех, кто мышью не
 * пользуется.
 */
export function EntityTabs<K extends string>({
  tabs,
  active,
  onChange,
  layoutId,
  showZero = false,
}: Props<K>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  /* Выбор пришёл со стрелок, а не мышью: только тогда переносим фокус
     (находка B-13). */
  const сКлавиатуры = useRef(false);
  /* Колесо и перетаскивание — `useScrollRow` (он здесь был нужен и раньше:
     ряд слушал только родную прокрутку), края, стрелки и затухание —
     `useRowEdges`. Обе половины лежат в `lib/ui/scroll-row`: ту же нехватку
     нашли ещё в фильтрах ленты, обзоров, моих объявлений и разделов
     сообщений, и держать её решение в одном месте дешевле. */
  useScrollRow(rowRef, [tabs.length]);
  const { края, листать, маска } = useRowEdges(rowRef, [tabs.length]);

  /*
   * Клавиатура: стрелки переключают вкладку, Home и End уводят к краям.
   *
   * Роли `tablist` и `tab` здесь стояли, а поведения при них не было: по
   * Tab фокус проходил все вкладки по одной, а стрелки не делали ничего —
   * то есть разметка обещала диктору навигацию, которой не существовало.
   * `tabIndex` ниже оставляет в обходе Tab только выбранную вкладку, как и
   * предписывает образец tablist.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const шаг =
      e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowLeft"
          ? -1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? 0
              : null;
    if (шаг === null) return;
    const i = tabs.findIndex((t) => t.key === active);
    if (i < 0) return;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (i + шаг + tabs.length) % tabs.length;
    if (tabs[next] && tabs[next].key !== active) {
      e.preventDefault();
      /*
       * Фокус переезжает за выбором — находка B-13.
       *
       * Узор `roving tabindex` был сделан верно: `tabindex=0` только у
       * выбранной, одна `aria-selected=true`, стрелки и Home/End работают.
       * Не переезжал только фокус: замер на `/profile` по номеру узла
       * показал выбранную №2 при фокусе на №0. Для того, кто ведёт по
       * клавиатуре, это значит, что следующий Tab уходит не оттуда, где он
       * смотрит, а экранный диктор продолжает читать прежнюю вкладку.
       *
       * Сам `focus()` здесь вызывать нельзя: кнопка следующей вкладки
       * получит `tabindex=0` только после перерисовки. Поэтому ставим
       * отметку, а фокус переносит эффект ниже — тот же, что центрирует ряд.
       */
      сКлавиатуры.current = true;
      onChange(tabs[next].key);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
    }
  };

  useEffect(() => {
    const row = rowRef.current;
    const btn = activeRef.current;
    if (!row || !btn) return;

    /*
     * Перенос фокуса на выбранную вкладку — только если выбор пришёл со
     * стрелок. Мышью и касанием фокус забирать нельзя: нажатие по вкладке
     * и так оставляет фокус там, где надо, а принудительный `focus()`
     * показал бы кольцо фокуса тому, кто мышью его не ждёт.
     */
    if (сКлавиатуры.current) {
      сКлавиатуры.current = false;
      /* preventScroll: прокрутку ряда делает этот же эффект строкой ниже,
         и своя прокрутка от focus() увела бы ряд дважды. */
      btn.focus({ preventScroll: true });
    }
    // Только по горизонтали и только внутри ряда: scrollIntoView увёл бы
    // вместе с рядом всю страницу к вкладкам, стоит переключить раздел.
    const center = (behavior: ScrollBehavior) => {
      const left = btn.offsetLeft - row.clientWidth / 2 + btn.clientWidth / 2;
      row.scrollTo({ left: Math.max(0, left), behavior });
    };
    center("smooth");

    /*
     * Ширины вкладок меняются уже после первой прокрутки: счётчики приходят
     * запросами и добавляют кружки. При прямом заходе на `?tab=posts` ряд
     * прокручивался, пока он ещё помещался в экран, а потом четыре кружка
     * выталкивали «Записи» за край — `scrollLeft` оставался нулём (замер на
     * проде 15.09, 375). Поэтому центрируем снова, когда меняется размер
     * любой вкладки. Ручную прокрутку это не перебивает: смахивание размеров
     * не меняет.
     */
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => center("auto"));
    for (const tab of Array.from(row.children)) observer.observe(tab);
    return () => observer.disconnect();
  }, [active]);

  return (
    /* Черта под рядом — на обёртке, а не на самом ряду: ряд теперь обрезает
       по вертикали (см. ниже), и своя граница у него съела бы подчёркивание
       выбранной вкладки. */
    <div className="relative" style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        ref={rowRef}
        role="tablist"
        onKeyDown={onKeyDown}
        /*
         * `overflow-y-hidden` — не украшение, а починка.
         *
         * При `overflow-x: auto` и `overflow-y: visible` CSS вычисляет
         * `overflow-y: auto`, то есть ряд становится ещё и вертикальным
         * прокручиваемым узлом. Прокручивать в нём нечего, но Chromium
         * привязывает к нему ПЕРВОЕ колесо и съедает его: замер 06.10,
         * 1280, ряд на правом краю, три колеса подряд по 300 —
         *
         *   как было          #1: 0 → 0;   #2: 0 → 300; #3: 300 → 600
         *   overflow-y hidden #1: 0 → 300; #2: 300 → 600; #3: 600 → 900
         *   сам main          #1: 0 → 300; #2: 300 → 600; #3: 600 → 900
         *
         * То есть на краю страница начинала прокручиваться только со
         * второго движения колеса. С `hidden` ряд перестаёт быть
         * вертикальным контейнером и ведёт себя как обычное содержимое.
         *
         * Ловушка замера: первый опыт в прогоне всегда показывал 0, и по
         * одному прогону легко было решить, что виноваты стили. Порядок
         * опытов в проверке перевёрнут, и тогда «как было» дало 300 —
         * различие было в номере колеса, а не в правке.
         */
        className="no-scrollbar flex items-center gap-6 overflow-x-auto overflow-y-hidden overscroll-x-contain"
        style={{
          maskImage: маска,
          WebkitMaskImage: маска,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const count = tab.count;
          const showCount = count !== undefined && (count > 0 || showZero);
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              ref={isActive ? activeRef : undefined}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.key)}
              className="relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 text-[15px] font-semibold transition-colors"
              style={{ color: isActive ? "var(--foreground)" : "var(--foreground-50)" }}
            >
              {Icon && <Icon size={16} aria-hidden />}
              {tab.label}
              {showCount && (
                /* Счётчик кружком рядом с названием, а не отдельным блоком:
                   в пилюле с полями он весил как ещё одна вкладка. */
                <span
                  className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none"
                  style={{
                    background: isActive ? "var(--accent-soft)" : "var(--background-surface)",
                    color: isActive ? "var(--accent)" : "var(--foreground-50)",
                  }}
                >
                  {count}
                </span>
              )}
              {isActive && (
                <m.span
                  layoutId={layoutId}
                  /* `bottom-0`, а не `-1px`: ряд обрезает по вертикали, и
                     выехавший за край пиксель подчёркивания исчезал бы. */
                  className="absolute bottom-0 left-0 right-0"
                  style={{ height: 2, background: "var(--accent-fill)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <ScrollRowArrows края={края} листать={листать} />
    </div>
  );
}

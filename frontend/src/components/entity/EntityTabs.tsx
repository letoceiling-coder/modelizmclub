import { useEffect, useRef } from "react";
import { m } from "framer-motion";
import type { LucideIcon } from "lucide-react";

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
 * Ряд вкладок сообщества и канала.
 *
 * Был набран дважды, слово в слово — одинаковые классы, одинаковый
 * `overflow-x-auto no-scrollbar`, одинаковый счётчик. Разъезжались только
 * значения.
 *
 * Ряд прижат влево и не растягивается: вкладок три-четыре, и растянутые на
 * всю ширину они читаются как сегментированный переключатель, а не как
 * навигация по разделу.
 *
 * На узком экране ряд прокручивается горизонтально без видимой полосы, и
 * выбранная вкладка сама уезжает в видимую область — иначе на 375 «Участники»
 * оказываются за краем, и о них узнаёшь, только если догадаешься смахнуть.
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
      onChange(tabs[next].key);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
    }
  };

  useEffect(() => {
    const row = rowRef.current;
    const btn = activeRef.current;
    if (!row || !btn) return;
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
    <div
      ref={rowRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className="no-scrollbar flex items-center gap-6 overflow-x-auto overscroll-x-contain"
      style={{ borderBottom: "1px solid var(--border)" }}
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
                className="absolute bottom-[-1px] left-0 right-0"
                style={{ height: 2, background: "var(--accent-fill)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

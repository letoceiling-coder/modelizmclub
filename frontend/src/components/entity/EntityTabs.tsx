import { useEffect, useRef } from "react";
import { m } from "framer-motion";

export interface EntityTab<K extends string> {
  key: K;
  label: string;
  /** Число рядом с названием. 0 и undefined не показываются. */
  count?: number;
}

interface Props<K extends string> {
  tabs: EntityTab<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Общий для страницы идентификатор подчёркивания, чтобы оно переезжало. */
  layoutId: string;
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
export function EntityTabs<K extends string>({ tabs, active, onChange, layoutId }: Props<K>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    const btn = activeRef.current;
    if (!row || !btn) return;
    // Только по горизонтали и только внутри ряда: scrollIntoView увёл бы
    // вместе с рядом всю страницу к вкладкам, стоит переключить раздел.
    const left = btn.offsetLeft - row.clientWidth / 2 + btn.clientWidth / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  return (
    <div
      ref={rowRef}
      role="tablist"
      className="no-scrollbar flex items-center gap-6 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const count = tab.count ?? 0;
        return (
          <button
            key={tab.key}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className="relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            style={{ color: isActive ? "var(--foreground)" : "var(--foreground-50)" }}
          >
            {tab.label}
            {count > 0 && (
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
                style={{ height: 2, background: "var(--accent)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

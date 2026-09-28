import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { card } from "@/components/admin/adminShared";

/**
 * Раскрывающаяся секция админки: заголовок, нажатие, содержимое.
 *
 * Страницы монетизации выросли до трёхсот строк разметки: чтобы добраться до
 * надбавки на доставку, приходилось листать мимо цен размещения и тарифов.
 * Свёрнутые секции возвращают странице оглавление.
 *
 * ПЕРВЫЙ КАДР — ВСЕГДА СВЁРНУТО. Это не про вкусы, а про гидрацию: состояние
 * лежит в localStorage, которого на сервере нет. Прочитай его в первом рендере —
 * и разметка браузера разойдётся с серверной, React бросит #418 и перерисует
 * страницу целиком (разбор в `docs/hydration.md`). Поэтому сохранённое
 * читается в `useEffect`, после гидрации.
 *
 * ЗАПИСЬ НЕ НАЧИНАЕТСЯ РАНЬШЕ ЧТЕНИЯ. Без этого первый же рендер записал бы
 * пустой набор поверх сохранённого, и выбор человека стёрся бы ровно в тот
 * момент, когда он открыл страницу. Флаг `прочитано` сторожит именно это.
 *
 * СОДЕРЖИМОЕ МОНТИРУЕТСЯ ПРИ ПЕРВОМ РАСКРЫТИИ И БОЛЬШЕ НЕ СНИМАЕТСЯ.
 * Свёрнутая секция ничего не рисует и ничего не грузит — в этом смысл. Но
 * если снимать её обратно при сворачивании, карточка внутри теряла бы своё
 * состояние и перезагружала данные на каждое открытие, а задание требует
 * «внутри весь текущий функционал без изменений». Поэтому открытая однажды
 * секция остаётся смонтированной и прячется стилем.
 */
export function AdminAccordion({
  /** Ключ хранения: у каждой страницы свой набор секций. */
  storageKey,
  sections,
}: {
  storageKey: string;
  sections: Array<{
    id: string;
    title: string;
    /** Короткая подпись под заголовком: что внутри, одной строкой. */
    hint?: string;
    children: React.ReactNode;
  }>;
}) {
  const [открытые, setОткрытые] = useState<ReadonlySet<string>>(() => new Set());
  const [прочитано, setПрочитано] = useState(false);
  /* Что уже было открыто хоть раз — эти секции остаются в дереве. */
  const смонтированные = useRef<Set<string>>(new Set());

  const полный = `admin.accordion.${storageKey}`;

  useEffect(() => {
    try {
      const сохранённое = window.localStorage.getItem(полный);
      if (сохранённое) {
        const список: unknown = JSON.parse(сохранённое);
        if (Array.isArray(список)) {
          const набор = new Set(список.filter((x): x is string => typeof x === "string"));
          набор.forEach((id) => смонтированные.current.add(id));
          setОткрытые(набор);
        }
      }
    } catch {
      /* Приватное окно, запрет на хранилище, испорченный JSON — не беда:
         секции просто останутся свёрнутыми. Ронять из-за этого страницу
         незачем, и писать в журнал тоже: это не отказ, а отсутствие памяти. */
    }
    setПрочитано(true);
  }, [полный]);

  useEffect(() => {
    if (!прочитано) return;
    try {
      window.localStorage.setItem(полный, JSON.stringify([...открытые]));
    } catch {
      /* Хранилище может быть закрыто — тогда состояние живёт до перезагрузки. */
    }
  }, [открытые, прочитано, полный]);

  const переключить = useCallback((id: string) => {
    setОткрытые((prev) => {
      const следующий = new Set(prev);
      if (следующий.has(id)) {
        следующий.delete(id);
      } else {
        следующий.add(id);
        смонтированные.current.add(id);
      }

      return следующий;
    });
  }, []);

  return (
    <div className="grid" style={{ gap: "12px" }}>
      {sections.map((s) => {
        const открыта = открытые.has(s.id);
        const смонтирована = открыта || смонтированные.current.has(s.id);

        return (
          <section key={s.id} style={{ ...card, padding: 0, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => переключить(s.id)}
              aria-expanded={открыта}
              aria-controls={`${storageKey}-${s.id}`}
              className="flex w-full items-center justify-between text-left"
              style={{
                background: "transparent",
                border: 0,
                cursor: "pointer",
                gap: "12px",
                minHeight: "56px",
                padding: "14px 16px",
              }}
            >
              <span className="min-w-0">
                <span
                  style={{
                    color: "var(--foreground)",
                    display: "block",
                    fontFamily: "var(--font-display)",
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                >
                  {s.title}
                </span>
                {s.hint ? (
                  <span
                    style={{ color: "var(--foreground-50)", display: "block", fontSize: "12px" }}
                  >
                    {s.hint}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                size={18}
                className="shrink-0"
                style={{
                  color: "var(--foreground-50)",
                  transform: открыта ? "rotate(180deg)" : "none",
                  transition: "transform .15s",
                }}
              />
            </button>
            {смонтирована ? (
              <div
                id={`${storageKey}-${s.id}`}
                hidden={!открыта}
                style={{ borderTop: "1px solid var(--border)", padding: "16px" }}
              >
                {s.children}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

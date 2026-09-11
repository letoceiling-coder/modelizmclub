import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  text: string;
  /** Approximate max lines before collapse. */
  maxLines?: number;
  /**
   * Строк от 1024, если на широком экране нужно другое число. По умолчанию —
   * как `maxLines`. Описание объявления: 6 на телефоне, где оно идёт одной
   * колонкой со всем остальным, и 16 на широком, где рядом стоит правая
   * колонка своей высоты.
   */
  maxLinesLg?: number;
  className?: string;
  style?: CSSProperties;
}

// На сервере layout-эффекты не выполняются и предупреждают — там обычный.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function CollapsibleText({ text, maxLines = 6, maxLinesLg, className, style }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  /*
    Переполнение меряем до отрисовки кадра, а не после.

    С обычным эффектом первый кадр выходил без кнопки «Показать полностью»,
    а следующий — с ней: кнопка вставала под текстом и сдвигала всё ниже.
    На странице объявления это доставка, продавец, «Спросите» и похожие —
    сдвиг на каждом открытии. Layout-эффект успевает до отрисовки, и текст
    появляется сразу вместе с кнопкой.
  */
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 2);
    };
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, expanded, maxLines, maxLinesLg]);

  if (!text.trim()) return null;

  /*
    Число строк — через переменные: инлайн-стиль один на все ширины, а
    класс lg: подменяет переменную от 1024. Сам -webkit-line-clamp берёт
    итоговую --clamp.
  */
  const clampStyle: Record<string, string | number | undefined> = {
    color: "var(--foreground-90)",
    "--clamp-base": maxLines,
    "--clamp-lg": maxLinesLg ?? maxLines,
    overflow: expanded ? "visible" : "hidden",
    display: expanded ? "block" : "-webkit-box",
    WebkitLineClamp: expanded ? undefined : "var(--clamp)",
    WebkitBoxOrient: expanded ? undefined : "vertical",
    ...(style as Record<string, string | number | undefined>),
  };

  return (
    <div className={className}>
      <p
        ref={ref}
        className="whitespace-pre-line text-[14px] leading-[1.6] [--clamp:var(--clamp-base)] lg:[--clamp:var(--clamp-lg)]"
        style={clampStyle as CSSProperties}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-[8px] text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          {expanded
            ? t("components.collapsibleText.collapse")
            : t("components.collapsibleText.expand")}
        </button>
      )}
    </div>
  );
}

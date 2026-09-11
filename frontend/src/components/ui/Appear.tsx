import { m, type MotionProps } from "framer-motion";
import { useState, type ReactNode } from "react";
import { useHydrated } from "@/hooks/use-hydrated";

interface Props extends Omit<MotionProps, "initial" | "animate"> {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Смещение снизу вверх при появлении, px. */
  y?: number;
  durationMs?: number;
}

/**
 * Появление, которое не прячет то, что уже пришло с сервера.
 *
 * framer-motion записывает проп `initial` инлайн-стилем прямо в серверную
 * разметку. Содержимое приезжает готовым, но с `opacity: 0`, и становится
 * видимым только когда отработает гидрация. Замерено 05.09 на 1,6 Мбит и 4×
 * CPU: карточки ленты лежали скрытыми 3,7 с, вкладка профиля — 2,9 с. LCP
 * баннера ленты по той же причине держался на 6,7 с при готовой к 3,1 с
 * картинке.
 *
 * Поэтому то, что пришло с сервера и гидрируется, `initial` не получает —
 * видно сразу. То, что смонтировано позже (новое сообщение, догрузка
 * страницы ленты, переключение вкладки, ответ на действие), появляется с
 * движением.
 *
 * Решение принимается один раз, при монтировании: framer-motion читает
 * `initial` только тогда. До 11.09 здесь было состояние «смонтирован»,
 * которое у каждого нового элемента начиналось с false, — и `initial={false}`
 * получали все, в том числе появившиеся позже: анимации не было нигде.
 * `useHydrated` отвечает false только при гидрации серверной разметки и true
 * для всего, что смонтировано после.
 *
 * Для входа по скроллу это не нужно: `whileInView` у блоков ниже сгиба
 * скрывает то, чего пользователь ещё не видит, и вреда не приносит.
 */
export function Appear({ children, className, y = 8, durationMs = 300, ...rest }: Props) {
  const hydrated = useHydrated();
  const [animateIn] = useState(hydrated);

  return (
    <m.div
      className={className}
      initial={animateIn ? { opacity: 0, y } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durationMs / 1000, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </m.div>
  );
}

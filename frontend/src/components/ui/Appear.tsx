import { motion, type MotionProps } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

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
 * Здесь `initial` не задаётся вовсе на первом рендере — ни на сервере, ни при
 * гидрации, — поэтому элемент виден сразу. Анимация включается со второго
 * рендера: то, что смонтировано позже (переключение вкладки, догрузка
 * страницы ленты, ответ на действие), появляется с движением, как и задумано.
 *
 * Для входа по скроллу это не нужно: `whileInView` у блоков ниже сгиба
 * скрывает то, чего пользователь ещё не видит, и вреда не приносит.
 */
export function Appear({ children, className, y = 8, durationMs = 300, ...rest }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <motion.div
      className={className}
      initial={mounted ? { opacity: 0, y } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durationMs / 1000, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

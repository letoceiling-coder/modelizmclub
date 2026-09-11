import { AnimatePresence, m, useReducedMotion, type Transition } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  /** Remount key — swaps children when this changes (tab id, step number, etc). */
  switchKey: string | number;
  children: ReactNode;
  className?: string;
  transition?: Transition;
  initial?: Record<string, number>;
  /**
   * Проигрывать ли появление для того ребёнка, который отрисован сразу.
   * На /feed это стоило 3,3 секунды LCP: баннер приезжал с сервера готовым и
   * был на экране к 3,4 с, но на гидрации framer-motion применял к нему
   * opacity 0 и заново проявлял — браузер записывал новую отрисовку LCP уже
   * после разбора бандла, на 6,7 с. Для переключения вкладок и шагов
   * появление нужно, для первого кадра — нет.
   */
  animateOnMount?: boolean;
  animate?: Record<string, number>;
  exit?: Record<string, number>;
  /**
   * Тег обёртки. По умолчанию блок; внутри <button> нужен `span` — <div>
   * там невалиден по модели содержимого и ломает гидрацию.
   */
  as?: "div" | "span";
}

/**
 * AnimatePresence mode="wait" cross-fade that degrades to a plain instant
 * swap under prefers-reduced-motion.
 *
 * framer-motion no-ops animations under reduced motion WITHOUT firing the
 * exiting element's completion callback, so mode="wait" — which gates
 * mounting the next child on that callback — hangs forever: the next
 * tab/step never appears (or, without mode="wait", the old child never
 * unmounts and both stack in the DOM). Under reduced motion this skips
 * AnimatePresence entirely so React's ordinary conditional rendering
 * unmounts the old child and mounts the new one synchronously.
 */
export function ReducedMotionSwitch({
  switchKey,
  children,
  className,
  animateOnMount = false,
  initial = { opacity: 0, y: 8 },
  animate = { opacity: 1, y: 0 },
  exit = { opacity: 0, y: -8 },
  transition = { duration: 0.2 },
  as = "div",
}: Props) {
  const reduce = useReducedMotion();
  // Первый отрисованный ребёнок не получает начального состояния вовсе.
  // framer-motion пишет `initial` инлайн-стилем в серверный HTML, и баннер
  // ленты приезжал с opacity:0: картинка была загружена к 3,1 с, а видимой
  // становилась только после гидрации, на 6,7 с. LCP считался по второму
  // моменту. Переключения слайдов и вкладок анимируются как прежде.
  const firstRender = useRef(true);
  const isFirst = firstRender.current;
  useEffect(() => {
    firstRender.current = false;
  }, []);
  const Plain = as;
  const Motion = as === "span" ? m.span : m.div;

  if (reduce) {
    return (
      <Plain key={switchKey} className={className}>
        {children}
      </Plain>
    );
  }
  return (
    <AnimatePresence mode="wait">
      <Motion
        key={switchKey}
        className={className}
        initial={!animateOnMount && isFirst ? false : initial}
        animate={animate}
        exit={exit}
        transition={transition}
      >
        {children}
      </Motion>
    </AnimatePresence>
  );
}

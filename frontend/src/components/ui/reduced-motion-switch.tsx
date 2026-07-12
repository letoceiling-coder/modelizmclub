import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  /** Remount key — swaps children when this changes (tab id, step number, etc). */
  switchKey: string | number;
  children: ReactNode;
  className?: string;
  transition?: Transition;
  initial?: Record<string, number>;
  animate?: Record<string, number>;
  exit?: Record<string, number>;
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
  switchKey, children, className,
  initial = { opacity: 0, y: 8 }, animate = { opacity: 1, y: 0 }, exit = { opacity: 0, y: -8 },
  transition = { duration: 0.2 },
}: Props) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div key={switchKey} className={className}>{children}</div>;
  }
  return (
    <AnimatePresence mode="wait">
      <motion.div key={switchKey} className={className} initial={initial} animate={animate} exit={exit} transition={transition}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

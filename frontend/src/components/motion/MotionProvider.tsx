import { LazyMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Ждём простоя браузера, прежде чем тянуть движок.
 *
 * Без этой паузы LazyMotion начинал загрузку сразу при монтировании корня:
 * на локальной сборке 11.09 чанки возможностей стартовали на 1 673 мс, до
 * `load` на 3 636 мс, — то есть делили канал с картинками первого экрана,
 * включая картинку LCP. В разметке их не было и гидрацию они не держали, но
 * на медленной сети лишние ~25 КБ brotli в этот момент — это прямо LCP.
 *
 * `requestIdleCallback` с потолком в 2 с: движок всё равно приедет, даже
 * если браузер так и не освободится. Safari до 17 его не знает — там
 * обычный `setTimeout`.
 */
function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 2000 });
    } else {
      setTimeout(resolve, 1);
    }
  });
}

const loadFeatures = () =>
  whenIdle()
    .then(() => import("./motion-features"))
    .then((mod) => mod.default);

/**
 * Анимации без движка в главном чанке.
 *
 * `motion.div` тянет полный движок framer-motion в тот чанк, где стоит. До
 * 11.09 он был в главном: 124,7 КБ сырых (motion-dom, framer-motion,
 * motion-utils) на каждой странице, до первой отрисовки, — хотя на первом
 * экране почти ничего не анимируется, а первый экран намеренно не прячется
 * (см. Appear и CLAUDE.md).
 *
 * `m.div` — тот же компонент без возможностей. Возможности (domMax) приходят
 * отдельным чанком, когда браузер освободится (см. whenIdle ниже). В разметке
 * его нет, гидрацию он не задерживает. До прихода чанка `m` рисует элемент в
 * его начальном состоянии без движения — на первом экране это и так правило,
 * а диалоги и меню открываются позже, когда чанк обычно уже здесь; если нет —
 * откроются без анимации, но откроются.
 *
 * Не strict: два админских файла используют Reorder и useDragControls, им
 * нужен полный `motion`, и они живут в ленивом чанке админки. Импорт
 * `motion` в остальном коде запрещён правилом eslint — один случайный
 * `motion.div` на первом экране молча вернул бы движок туда, откуда его
 * вынесли.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}

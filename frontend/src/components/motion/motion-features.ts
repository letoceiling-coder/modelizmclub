import { domMax } from "framer-motion";

/**
 * Набор возможностей анимации, который LazyMotion догружает после первого
 * экрана. domMax, а не лёгкий domAnimation: в проекте есть layoutId и drag,
 * без них эти анимации молча перестали бы работать.
 */
export default domMax;

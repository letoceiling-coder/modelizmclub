import cover from "@/assets/cover-modelizm.jpg";
import cover640 from "@/assets/cover-modelizm-640.webp";
import cover960 from "@/assets/cover-modelizm-960.webp";
import cover1440 from "@/assets/cover-modelizm-1440.webp";
import cover1920 from "@/assets/cover-modelizm-1920.webp";

/**
 * Обложка первого экрана — это и есть LCP главной.
 *
 * Замерено 11.09 наблюдателем `largest-contentful-paint` на проде: элемент
 * LCP — именно она, площадь 439 760 px, вес 120,7 КБ. Отдавалась одним
 * файлом 1920×1080 JPEG всем подряд, включая телефон шириной 375 px, где
 * такой размер избыточен впятеро.
 *
 * Размеры и вес после пережатия (WebP, качество 72):
 *
 *    640 px    4,9 КБ
 *    960 px   11,9 КБ
 *   1440 px   26,4 КБ
 *   1920 px   46,0 КБ
 *
 * То есть телефон с DPR 2 берёт 960 px и 11,9 КБ вместо 120,7 КБ.
 *
 * JPEG остаётся в `src` запасным вариантом: браузер, который понимает
 * `srcset`, до него не дойдёт, а тот, который не понимает, получит рабочую
 * картинку вместо пустого места.
 */
export const HERO_COVER = {
  src: cover,
  srcSet: [`${cover640} 640w`, `${cover960} 960w`, `${cover1440} 1440w`, `${cover1920} 1920w`].join(
    ", ",
  ),
  sizes: "100vw",
  width: 1920,
  height: 1080,
} as const;

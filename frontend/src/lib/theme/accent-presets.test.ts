import { describe, expect, it } from "vitest";

import { ACCENT_PRESET_LIST } from "./accent-presets";

/**
 * Текст на заливке акцента должен проходить WCAG AA.
 *
 * Норма — 4,5 для текста мельче 18,66 px полужирного или 24 px обычного.
 * Текст кнопки действия — `text-sm`, то есть 14 px, так что послабление для
 * крупного текста не применяется.
 *
 * Аудит 26.09 замерил у пресета blue 3,50: белый на `#627FFF`. Комментарий
 * в пресете при этом утверждал, что «white reads well on the blue fill».
 * Поэтому проверка считает контраст, а не сверяет цвета со списком: список
 * пришлось бы обновлять руками, а утверждение о читаемости — это и есть
 * контраст.
 */
function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("контраст пресетов акцента", () => {
  it.each(ACCENT_PRESET_LIST.map((p) => [p.label, p] as const))(
    "%s: текст на заливке проходит AA",
    (_label, preset) => {
      const ratio = contrastRatio(preset.fill, preset.foreground);

      expect(
        ratio,
        `${preset.foreground} на ${preset.fill} даёт ${ratio.toFixed(2)} при норме 4,5`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(ACCENT_PRESET_LIST.map((p) => [p.label, p] as const))(
    "%s: наведение и нажатие тоже проходят AA",
    (_label, preset) => {
      for (const [имя, цвет] of [
        ["hover", preset.hover],
        ["active", preset.active],
      ] as const) {
        const ratio = contrastRatio(цвет, preset.foreground);

        expect(
          ratio,
          `${имя}: ${preset.foreground} на ${цвет} даёт ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  /**
   * Заливка отделена от `primary` не из аккуратности: у них противоположные
   * требования. `primary` — цвет ссылки на фоне страницы, и на тёмной теме
   * (`#1a1a1e`) он должен быть светлым; заливка несёт на себе текст и должна
   * быть тёмной. Один цвет оба требования не выполняет — проверено расчётом:
   * при 4,5 против белого контраст против `#1a1a1e` падает ниже 4,5.
   */
  it.each(ACCENT_PRESET_LIST.map((p) => [p.label, p] as const))(
    "%s: цвет ссылки различим на тёмном фоне",
    (_label, preset) => {
      const ratio = contrastRatio(preset.primary, "#1a1a1e");

      expect(
        ratio,
        `${preset.primary} на тёмном фоне даёт ${ratio.toFixed(2)} при норме 4,5`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});

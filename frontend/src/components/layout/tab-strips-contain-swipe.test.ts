import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Лента вкладок не отдаёт горизонтальный жест системе.
 *
 * Шаг 4 промпта 01: «Свайп двигает только вкладки, не страницу».
 *
 * У вкладок мессенджера это уже сделано — `HorizontalScrollNav` ставит
 * `overscroll-x-contain`, и в коммите про них написано прямо: без этого у
 * края ленты iOS включал возврат назад. У вкладок профиля, сущностей и у
 * общего примитива `ui/tabs` свойства не было, то есть на телефоне у края
 * ленты жест уходил системе.
 *
 * Замер настоящим касанием (CDP) на 360px: обе проверенные ленты
 * прокручиваются и страницу не двигают — ни до правки, ни после. То есть в
 * эмуляции разницы не видно, и подтвердить её может только настоящий
 * телефон: `BLOCKED: проверяет владелец`. Свойство добавлено потому, что
 * симптом описан, причина названа в соседнем компоненте, а цена правки —
 * одно свойство, которое прокрутку внутри ленты не меняет (проверено: лента
 * мессенджера с ним прокручивается 8 → 163).
 *
 * Проверка читает исходник: свойство задаётся классом, и пропадает вместе
 * с ним.
 */
const СТРИПЫ: Array<[string, string]> = [
  ["общий примитив вкладок", join(import.meta.dirname, "..", "ui", "tabs.tsx")],
  ["вкладки сущностей", join(import.meta.dirname, "..", "entity", "EntityTabs.tsx")],
  ["вкладки мессенджера", join(import.meta.dirname, "..", "ui", "HorizontalScrollNav.tsx")],
  ["фильтры ленты", join(import.meta.dirname, "..", "feed", "FeedFilterTabs.tsx")],
];

describe("ленты вкладок удерживают горизонтальный жест", () => {
  for (const [имя, путь] of СТРИПЫ) {
    it(`${имя}: overscroll-x-contain на прокручиваемой ленте`, () => {
      const источник = readFileSync(путь, "utf8");

      expect(источник).toMatch(/overscroll-x-contain|overscrollBehaviorX/);
    });
  }
});

/**
 * Профиль берёт ряд вкладок у общего компонента, а не собирает свой.
 *
 * Своего ряда у него было два недостатка сразу: ни `role="tablist"`, ни
 * `role="tab"` — диктор читал семь вкладок как семь кнопок, — и удержание
 * жеста приходилось ставить отдельной строкой. Проверка на `overscroll` у
 * профиля поэтому снята: свойство теперь живёт в `EntityTabs`, и следить
 * надо за тем, что профиль им пользуется.
 */
describe("вкладки профиля", () => {
  const PROFILE = join(import.meta.dirname, "..", "profile", "ProfileView.tsx");

  it("ряд берётся из общего EntityTabs", () => {
    const источник = readFileSync(PROFILE, "utf8");

    expect(источник).toContain("<EntityTabs");
    expect(источник).toContain('from "@/components/entity/EntityTabs"');
  });

  it("своего ряда кнопок не осталось", () => {
    const источник = readFileSync(PROFILE, "utf8");

    // Подчёркивание выбранной вкладки своей тенью — признак самодельного ряда.
    expect(источник).not.toContain("inset 0 -3px 0 var(--accent)");
  });
});

/**
 * Общий ряд вкладок ведёт себя как tablist.
 *
 * Роли там стояли и раньше, а поведения при них не было: стрелки не
 * переключали, и `tabIndex` оставлял в обходе Tab все вкладки подряд. То
 * есть разметка обещала диктору навигацию, которой не существовало.
 */
describe("семантика общего ряда вкладок", () => {
  const ENTITY = join(import.meta.dirname, "..", "entity", "EntityTabs.tsx");

  it("роли на месте", () => {
    const источник = readFileSync(ENTITY, "utf8");

    expect(источник).toContain('role="tablist"');
    expect(источник).toContain('role="tab"');
    expect(источник).toContain("aria-selected");
  });

  it("стрелки переключают вкладку", () => {
    const источник = readFileSync(ENTITY, "utf8");

    expect(источник).toContain("ArrowRight");
    expect(источник).toContain("ArrowLeft");
    expect(источник).toContain("onKeyDown");
  });

  it("в обходе Tab только выбранная вкладка", () => {
    const источник = readFileSync(ENTITY, "utf8");

    expect(источник).toContain("tabIndex={isActive ? 0 : -1}");
  });
});

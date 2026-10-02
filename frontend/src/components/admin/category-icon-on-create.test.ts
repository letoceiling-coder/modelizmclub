import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Иконку спрашивают и при создании направления, не только при правке.
 *
 * До 03.10 вопрос про иконку стоял только в цепочке правки — третьим из
 * пяти. Заведённое направление появлялось без значка, и взяться ему было
 * неоткуда, пока человек не откроет правку и не пройдёт два вопроса до
 * нужного. Снаружи это и есть «иконки не редактируются»: завёл десять
 * разделов, ни у одного значка нет.
 *
 * Замерено на проде 03.10: иконка стоит у 3 направлений из 100.
 */
const СЕКЦИЯ = join(import.meta.dirname, "AdminCategoriesSection.tsx");

function блок(имя: string): string {
  const s = readFileSync(СЕКЦИЯ, "utf8");
  const начало = s.indexOf(`const ${имя} = async`);
  expect(начало, `обработчик ${имя} не найден — проверка смотрит не туда`).toBeGreaterThan(-1);
  const конец = s.indexOf("\n  };\n", начало);

  return s.slice(начало, конец);
}

describe("создание направления", () => {
  it("спрашивает иконку у корневого раздела", () => {
    expect(блок("addRoot")).toContain("promptIcon");
  });

  it("спрашивает иконку у подкатегории", () => {
    expect(блок("addSub")).toContain("promptIcon");
  });

  it("отправляет её на сервер, а не только спрашивает", () => {
    for (const имя of ["addRoot", "addSub"]) {
      const b = блок(имя);
      const вызов = b.indexOf("createAdminCategory(");
      expect(вызов, `${имя}: вызова создания нет`).toBeGreaterThan(-1);
      // Спросить и не отправить — ровно то же, что не спрашивать.
      expect(b.slice(вызов), `${имя}: иконка спрошена, но не отправлена`).toContain("icon,");
    }
  });

  it("правка иконки на месте и не потерялась", () => {
    expect(блок("edit")).toContain("promptIcon");
  });
});

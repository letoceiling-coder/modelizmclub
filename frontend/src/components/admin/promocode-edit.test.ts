import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Промокод правится, а не переводится заново.
 *
 * Админка умела только создать и удалить: опечатку в сроке или проценте
 * исправляли удалением и заводом заново, и вместе со строкой уходила
 * история применений. Она про деньги — кто и когда применил код,
 * единственный способ разобрать спор о скидке.
 *
 * Проверка читает исходник: отрисовки в прогоне нет, а то, что форма
 * отправляет правку и что удаление спрашивает, видно по коду.
 */
const СЕКЦИЯ = join(import.meta.dirname, "AdminMonetizationSection.tsx");

function источник(): string {
  return readFileSync(СЕКЦИЯ, "utf8");
}

describe("правка промокода", () => {
  it("форма отправляет правку, а не создание", () => {
    const s = источник();

    expect(s).toContain("updateAdminPromocode(editing.code");
  });

  it("в строке списка есть кнопка правки", () => {
    expect(источник()).toContain("начатьПравку(p)");
  });

  it("оповещения в правке не показываются", () => {
    // `update` на сервере отбрасывает `notify_*` и ничего не рассылает:
    // показать поля значило бы обещать рассылку, которой не будет.
    const s = источник();

    expect(s).toContain("{!editing && (");
    expect(s).toContain("{!editing && form.notifyAll && (");
  });
});

describe("удаление промокода", () => {
  it("спрашивает подтверждение", () => {
    const s = источник();
    const удаление = s.indexOf("deletePromocode(p.code)");
    expect(удаление, "удаления в коде нет — проверка смотрит не туда").toBeGreaterThan(-1);

    // Подтверждение — до запроса, а не после.
    const вопрос = s.lastIndexOf("askConfirm({", удаление);
    expect(вопрос, "удаление уходит без подтверждения").toBeGreaterThan(-1);
    expect(s.slice(вопрос, удаление)).toContain("deleteConfirm");
  });

  it("говорит, что уйдёт история, когда код уже применяли", () => {
    expect(источник()).toContain("deleteConfirmUsed");
  });
});

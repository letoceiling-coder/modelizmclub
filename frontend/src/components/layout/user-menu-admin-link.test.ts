import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Вход в админку — первый пункт меню аватара, и по праву с сервера.
 *
 * До 01.10 пункт стоял предпоследним и показывался по `me.isAdmin`,
 * которое считается в браузере как `role === "owner"`. Модератор и
 * администратор направления входа не видели, хотя разделы им открыты.
 *
 * Условие теперь `me.canOpenAdmin` — поле `can_open_admin` из ответа
 * сервера, равное «разделов больше нуля» по той же карте, что охраняет
 * маршруты. Что сервер отвечает верно по всем четырём ролям,
 * проверяет `backend/tests/Feature/CanOpenAdminTest.php`; здесь — что
 * меню берёт именно это поле и ставит пункт первым.
 */
const MENU = join(import.meta.dirname, "UserMenu.tsx");

function источник(): string {
  return readFileSync(MENU, "utf8");
}

/** Пункты меню по порядку: к чему ведёт каждая ссылка. */
function пункты(): string[] {
  const s = источник();
  const начало = s.indexOf("<DropdownMenuContent");
  expect(начало, "содержимое меню не найдено — проверка смотрит не туда").toBeGreaterThan(-1);

  return [...s.slice(начало).matchAll(/<Link to=\{?(ROUTES\.\w+|"[^"]+")\}?/g)].map((m) => m[1]);
}

describe("меню аватара", () => {
  it("вход в админку — первым, выше профиля", () => {
    const порядок = пункты();

    expect(порядок[0]).toBe("ROUTES.admin");
    expect(порядок[1]).toBe("ROUTES.profile");
  });

  it("показывается по праву с сервера, а не по роли в браузере", () => {
    // Условия в разметке, а не любое упоминание: `me.isAdmin` остаётся в
    // пояснении рядом, и первая версия этой проверки падала на нём же.
    const условия = [...источник().matchAll(/\{me\.(\w+) &&/g)].map((m) => m[1]);

    expect(условия).toContain("canOpenAdmin");
    expect(условия, "роль в браузере больше не решает, кто видит админку").not.toContain("isAdmin");
  });

  it("пункт ровно один — прежний снизу убран", () => {
    expect(пункты().filter((x) => x === "ROUTES.admin")).toHaveLength(1);
  });
});

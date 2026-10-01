import { readFileSync, readdirSync, statSync } from "node:fs";
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
 * маршруты. Что сервер отвечает верно по всем четырём ролям и не теряет
 * поле на входе, проверяет `backend/tests/Feature/CanOpenAdminTest.php`;
 * здесь — что интерфейс берёт именно это поле.
 */
const МЕНЮ = join(import.meta.dirname, "UserMenu.tsx");
const SRC = join(import.meta.dirname, "..", "..");

function источник(): string {
  return readFileSync(МЕНЮ, "utf8");
}

/**
 * Пункты меню по порядку: к чему ведёт каждая ссылка.
 *
 * `[\s\S]*?` между тегом и `to`: в файле есть и `<Link to={…}` в одну
 * строку, и перенос. Первая версия искала только одну строку — и не
 * увидела бы ни задвоения пункта, ни ссылки, написанной иначе. Литерал
 * пути ловится наравне с `ROUTES.*` по той же причине.
 */
function пункты(): string[] {
  const s = источник();
  const начало = s.indexOf("<DropdownMenuContent");
  expect(начало, "содержимое меню не найдено — проверка смотрит не туда").toBeGreaterThan(-1);

  return [...s.slice(начало).matchAll(/<Link[\s\S]{0,80}?\sto=\{?(ROUTES\.\w+|"[^"]+")\}?/g)].map(
    (m) => m[1],
  );
}

function файлы(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) файлы(full, out);
    else if (/\.tsx$/.test(name)) out.push(full);
  }

  return out;
}

describe("меню аватара", () => {
  it("вход в админку — первым, выше профиля", () => {
    const порядок = пункты();

    expect(порядок[0]).toBe("ROUTES.admin");
    expect(порядок[1]).toBe("ROUTES.profile");
  });

  it("пункт ровно один — прежний снизу убран", () => {
    const админские = пункты().filter((x) => x === "ROUTES.admin" || x === '"/admin"');

    expect(админские).toHaveLength(1);
  });

  it("условие обнимает именно ссылку на админку", () => {
    const s = источник();
    const условие = s.indexOf("{me.canOpenAdmin &&");
    expect(условие, "условия `me.canOpenAdmin` в файле нет").toBeGreaterThan(-1);

    // Ссылка на админку лежит внутри условия, а не рядом с ним: до
    // закрытия блока `)}`. Иначе условие стояло бы «где-то в файле» —
    // ровно то, чего первая версия этой проверки не отличала.
    const блок = s.slice(условие, s.indexOf(")}", условие));

    expect(блок).toContain("ROUTES.admin");
  });
});

/**
 * Одно условие на один вход.
 *
 * Ревью нашло второе место: на лендинге пункт «Админ-панель» стоял под
 * `me.isAdmin`, и модератор его там не видел, хотя в меню аватара уже
 * видел. Две карты прав, расходящиеся молча, — это ровно то, из-за чего
 * до 17.09 сервер отдавал модератору заявки, а меню их прятало.
 */
describe("право на админку", () => {
  it("нигде в разметке не решается ролью из браузера", () => {
    const нарушения: string[] = [];
    for (const файл of файлы(SRC)) {
      const s = readFileSync(файл, "utf8");
      // Условие в разметке, а не упоминание: пояснения рядом содержат
      // `me.isAdmin` словами, и на них падала первая версия проверки.
      if (/\{\s*me\.isAdmin\s*(&&|\?)/.test(s) || /\bme\.isAdmin\s*\?/.test(s)) {
        нарушения.push(файл.slice(SRC.length + 1));
      }
    }

    expect(нарушения).toEqual([]);
  });
});

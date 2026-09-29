import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Сводку читают одной ручкой — и Владелец, и модератор.
 *
 * До 29.09 `/admin/dashboard` была закрыта владельческим ключом, хотя
 * раздел объявлен модераторским и стоял у модератора в меню. Фронтенд
 * обходил это двумя лишними запросами и собирал объект, где шесть из
 * восьми чисел были нулями.
 *
 * На экране обход не был виден: нулевые карточки и так отфильтрованы по
 * `adminOnly`. Поэтому проверка смотрит не на экран, а на источник —
 * именно он расходился с правами.
 */
const ЭКРАН = join(import.meta.dirname, "AdminDashboardSection.tsx");
const КЛИЕНТ = join(import.meta.dirname, "..", "..", "lib", "api", "admin.ts");

const читать = (путь: string) => readFileSync(путь, "utf8");

describe("источник сводки", () => {
  it("обхода для модератора больше нет", () => {
    expect(читать(КЛИЕНТ), "мёртвая функция-обход осталась").not.toContain(
      "fetchModeratorDashboardStats",
    );
    expect(читать(ЭКРАН), "экран всё ещё зовёт обход").not.toContain(
      "fetchModeratorDashboardStats",
    );
  });

  it("сводка читается одной ручкой, без развилки по роли", () => {
    const экран = читать(ЭКРАН);
    const кусок = экран.slice(экран.indexOf("useEffect"), экран.indexOf("const allStats"));

    expect(кусок, "сводку зовут не для всех").toContain("fetchDashboard()");
    // Журнал действий остаётся владельческим — это другой раздел.
    expect(кусок, "журнал перестал быть владельческим").toContain('role === "owner"');
    expect(кусок, "нулевые числа всё ещё подставляются").not.toContain("usersTotal: 0");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Каталог: отбор из адреса доезжает до запроса, а неудачное обновление не
 * молчит.
 *
 * Шаг 5 задания: «отборы в адресе… состояния загрузки, пустоты и отказа».
 *
 * **Отбор терялся молча.** Он проходит путь «идентификатор из адреса →
 * имя раздела → обратно в идентификатор», и средним звеном служит дерево
 * каталога из `/public/bootstrap`. Дерево строится не из
 * `listing_categories` напрямую, а из «видимых зеркал» направлений
 * (`CategoryTaxonomyService::visibleMirrorIds`). Зеркал нет — дерево
 * пустое — имя не находится ни для какого идентификатора.
 *
 * Замер 06.10 на стенде: 30 направлений, у всех `in_listings`, ни у
 * одного нет `listing_category_id`; `listing_categories` в ответе
 * `bootstrap` — ноль элементов.
 *
 * | Адрес | Запрос к API до правки | После |
 * | --- | --- | --- |
 * | `/ads?q=Tamiya` | `?q=Tamiya&…` | то же |
 * | `/ads?category_id=1` | **`?per_page=24&sort=new`** | `?category_id=1&…` |
 * | `/ads?category_id=999` | **`?per_page=24&sort=new`** | `?category_id=999&…`, выдача пуста |
 *
 * API параметр понимает: `category_id=1` даёт одно объявление, `999` —
 * ноль. Под эту же потерю попадали крошки на странице объявления: они
 * ведут ровно на такой адрес.
 *
 * **Отказ обновления проглатывался.** Стояло `if (!refreshing)
 * setLoadState("error")`, то есть после первой успешной загрузки любой
 * отказ не оставлял следа. Замер: каталог открыт, запрос оборван, выбрана
 * сортировка «Сначала дешевле» — на экране прежняя выдача, сообщений
 * ноль. Человек читает её как ответ на новый отбор.
 *
 * Проверяем исходник: дерево, запросы и состояния в jsdom не поднять.
 * Поведение проверено в браузере.
 */
const ФАЙЛ = join(import.meta.dirname ?? __dirname, "ads.index.tsx");

function безКомментариев(): string {
  return readFileSync(ФАЙЛ, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ");
}

describe("каталог: отбор из адреса и отказ обновления", () => {
  const код = безКомментариев();

  it("нераспознанный раздел берётся прямо из адреса", () => {
    expect(код).toMatch(/search\.category_id/);
    expect(код).toMatch(/search\.subcategory_id/);
  });

  /*
   * Подстановка работает только пока человек не выбрал раздел сам: иначе
   * из адреса пришло бы устаревшее значение и перебило бы его выбор.
   */
  it("подстановка не перебивает выбор человека", () => {
    expect(код).toMatch(/filters\.category === DEFAULT_FILTERS\.category/);
  });

  it("раздел и подраздел значатся в зависимостях запроса", () => {
    const deps = код.match(/\}, \[q, filters, sort, taxonomyId[^\]]*\]\);/);
    expect(deps?.[0]).toBeTruthy();
    expect(deps?.[0]).toMatch(/categoryId/);
    expect(deps?.[0]).toMatch(/subcategoryId/);
  });

  it("отказ обновления объявляется, а не проглатывается", () => {
    // Пустой `catch {}` без разбора — ровно то, что было.
    expect(код).not.toMatch(/\}\s*catch\s*\{\s*if \(!refreshing\) setLoadState\("error"\);\s*\}/);
    expect(код).toMatch(/reportActionFailure\(err/);
  });

  it("первая неудачная загрузка по-прежнему даёт состояние с «Повторить»", () => {
    expect(код).toMatch(/setLoadState\("error"\)/);
    expect(код).toMatch(/loadState === "error"/);
  });
});

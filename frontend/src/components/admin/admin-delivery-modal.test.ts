import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Детали отправления — окном поверх страницы, а не блоком внизу.
 *
 * Раньше они раскрывались под таблицей: при длинном списке до них надо было
 * долистать, а закрыв — долистать обратно к той же строке. Окно этого не
 * требует вовсе.
 *
 * Тесты сторожат не вёрстку, а три обещания, которые легко потерять при
 * следующей правке: что это действительно окно, что оно не уводит со
 * страницы (иначе прокрутка списка пропадёт) и что состав полей на месте.
 */
const СЕКЦИЯ = join(import.meta.dirname, "AdminDeliverySection.tsx");
const текст = () => readFileSync(СЕКЦИЯ, "utf8");

describe("окно деталей доставки", () => {
  it("это окно, а не блок под таблицей", () => {
    const т = текст();

    expect(т).toContain("<Dialog open={selected !== null}");
    expect(т).toContain("<DialogContent");
    // Прежний блок «под таблицей» с рамкой акцентного цвета должен уйти.
    expect(т, "остался инлайновый блок деталей").not.toMatch(
      /\{selected && \(\s*<div\s*\n\s*style=\{\{\s*\n\s*\.\.\.card/,
    );
  });

  /**
   * Ширина — доля экрана, как просили, но не меньше разумного.
   *
   * Без нижней границы окно на узком-но-широком экране схлопывается в
   * колонку, где UUID и трек-номер переносятся посимвольно.
   */
  it("ширина задана долей экрана с нижней границей", () => {
    const т = текст();

    expect(т).toMatch(/sm:max-w-\[4\d vw\]|sm:max-w-\[4\dvw\]/);
    expect(т, "нет нижней границы ширины").toMatch(/sm:min-w-\[\d+px\]/);
    expect(т, "длинное содержимое должно прокручиваться внутри окна").toMatch(
      /max-h-\[\d+dvh\][\s\S]{0,40}overflow-y-auto/,
    );
  });

  /** Закрытие не уводит со страницы: список и его прокрутка остаются. */
  it("закрытие только гасит выбор, а не уводит со страницы", () => {
    const т = текст();

    expect(т).toContain("onOpenChange={(open) => !open && setSelected(null)}");
    expect(т, "переход увёл бы администратора со списка").not.toMatch(/navigate\(\s*\{\s*to:/);
  });

  /** Крестик рисует сам DialogContent, отдельная кнопка «Закрыть» — рядом. */
  it("есть и крестик, и кнопка закрытия", () => {
    const т = текст();

    expect(т, "нет явной кнопки закрытия").toContain('t("pages.adminCommon.close")');
    // Крестик приходит из DialogContent — проверяем, что он его рисует.
    const диалог = readFileSync(join(import.meta.dirname, "..", "ui", "dialog.tsx"), "utf8");
    expect(диалог, "DialogContent должен рисовать крестик").toMatch(
      /DialogPrimitive\.Close[\s\S]{0,120}<X /,
    );
  });

  /** Весь перечисленный состав в окне есть. */
  it("показывает объявление, UUID, провайдера, статус, трек, внешний id и заметку", () => {
    const окно = текст().slice(текст().indexOf("<Dialog open={selected"));

    for (const [что, признак] of [
      ["объявление", "selected.listingTitle"],
      ["UUID", "UUID: {selected.uuid}"],
      ["провайдер", "detailProvider"],
      ["статус", "detailStatus"],
      ["трек", "detailTrack"],
      ["внешний идентификатор", "detailExternalId"],
      ["заметка администратора", "adminNote"],
    ] as const) {
      expect(окно, `в окне нет: ${что}`).toContain(признак);
    }
  });

  /**
   * Длинные значения переносятся.
   *
   * UUID и внешний идентификатор перевозчика — строки без пробелов. В узком
   * окне они распирают его по горизонтали, если им этого не разрешить.
   */
  it("длинные идентификаторы не распирают окно", () => {
    const окно = текст().slice(текст().indexOf("<Dialog open={selected"));

    expect((окно.match(/wordBreak: "break-all"/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

import { describe, expect, it } from "vitest";
import { objectUpdateMatches } from "@/lib/hooks/useObjectUpdate";
import type { ObjectUpdate } from "@/lib/realtime/user";

const объявление: ObjectUpdate = { kind: "listing", uuid: "l-1", status: "published" };
const сделка: ObjectUpdate = { kind: "deal", uuid: "d-1", status: "paid" };

describe("событие касается этого экрана", () => {
  it("вид совпал, идентификатор не спрашивали — да", () => {
    expect(objectUpdateMatches(объявление, { kind: "listing" })).toBe(true);
  });

  it("вид не совпал — нет", () => {
    expect(objectUpdateMatches(сделка, { kind: "listing" })).toBe(false);
  });

  it("страница одного объекта берёт только его", () => {
    expect(objectUpdateMatches(сделка, { kind: "deal", uuid: "d-1" })).toBe(true);
    expect(objectUpdateMatches(сделка, { kind: "deal", uuid: "d-2" })).toBe(false);
  });

  /*
   * Список и страница одного объекта отличаются ровно этим полем, и
   * перепутать их легко в обе стороны: список с `uuid` перестал бы
   * обновляться вовсе, а страница без него перечитывалась бы на каждый чужой
   * шаг. На экране ни то, ни другое не заметно без второго окна.
   */
  it("список слушает любой объект своего вида", () => {
    expect(objectUpdateMatches(сделка, { kind: "deal" })).toBe(true);
    expect(objectUpdateMatches({ ...сделка, uuid: "d-99" }, { kind: "deal" })).toBe(true);
  });

  /*
   * `null` приходит сам: маршрут отдаёт параметр, которого ещё нет, — и
   * трактовать его как «жду объект с идентификатором null» значило бы
   * молча выключить обновление на такой странице.
   */
  it("незаполненный идентификатор — это «любой», а не «никакой»", () => {
    expect(objectUpdateMatches(объявление, { kind: "listing", uuid: null })).toBe(true);
    expect(objectUpdateMatches(объявление, { kind: "listing", uuid: undefined })).toBe(true);
  });

  it("пустая строка идентификатором не считается", () => {
    // Пустая строка приходит из `params.id` до разбора адреса; совпасть ей
    // не с чем, и молчать здесь правильнее, чем перечитывать наугад.
    expect(objectUpdateMatches(объявление, { kind: "listing", uuid: "" })).toBe(false);
  });
});

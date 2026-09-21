import { describe, expect, it } from "vitest";
import {
  CONTENT_SELECTOR,
  FIELD_SELECTOR,
  INIT_OPTIONS,
  YM_DISABLE_KEYS,
  YM_HIDE_CONTENT,
  markPrivate,
} from "@/lib/analytics/metrika";

/*
 * То, что 21.09 было написано наугад и оказалось неправдой.
 *
 * Прежняя проверка сверяла содержимое строковой константы, которая на
 * поведение не влияла вовсе, — зелёная проверка на пустом месте. Здесь
 * сверяется то, что уезжает Метрике и что ложится на узлы.
 */

describe("параметры счётчика", () => {
  it("Вебвизор включён, автоматическая отправка просмотра выключена", () => {
    expect(INIT_OPTIONS.webvisor).toBe(true);
    // Просмотры шлёт `Analytics`, и только он: иначе первая страница
    // считалась бы дважды.
    expect(INIT_OPTIONS.defer).toBe(true);
  });

  it("никаких `params` — это параметры визита, а не настройка маскировки", () => {
    /*
     * Ради этой строки проверка и написана. `params: { maskSelector: … }`
     * не маскировал ничего: параметра «маскировать по селектору» у Метрики
     * нет, а сам селектор уезжал в отчёты как произвольные данные визита.
     */
    expect(INIT_OPTIONS).not.toHaveProperty("params");
    expect(JSON.stringify(INIT_OPTIONS)).not.toContain("mask");
  });
});

describe("разметка для Вебвизора", () => {
  interface Узел {
    селектор: string;
    классы: string[];
  }

  function корень(): { root: ParentNode; узлы: Узел[] } {
    const узлы: Узел[] = [];
    const root = {
      querySelectorAll: (селектор: string) => {
        const узел: Узел = { селектор, классы: [] };
        узлы.push(узел);

        return [{ classList: { add: (c: string) => узел.классы.push(c) } }];
      },
    } as unknown as ParentNode;

    return { root, узлы };
  }

  it("поля ввода получают класс «не записывать ввод»", () => {
    const { root, узлы } = корень();
    markPrivate(root);

    const поля = узлы.find((u) => u.селектор === FIELD_SELECTOR);
    expect(поля?.классы).toEqual([YM_DISABLE_KEYS]);
  });

  it("помеченные узлы получают класс «не записывать содержимое»", () => {
    // Переписка — не поле ввода: Вебвизор пишет разметку, и отправленные
    // сообщения попали бы в запись обычным текстом.
    const { root, узлы } = корень();
    markPrivate(root);

    const содержимое = узлы.find((u) => u.селектор === CONTENT_SELECTOR);
    expect(содержимое?.классы).toEqual([YM_HIDE_CONTENT]);
  });

  it("классы — те, что понимает Метрика", () => {
    // Имена сопоставляются строкой: опечатка не ломает ничего видимого и
    // молча оставляет поле открытым в записи.
    expect(YM_DISABLE_KEYS).toBe("ym-disable-keys");
    expect(YM_HIDE_CONTENT).toBe("ym-hide-content");
  });

  it("закрываются все виды ввода, а не список чувствительных", () => {
    for (const вид of ["input", "textarea", "select", "[contenteditable]"]) {
      expect(FIELD_SELECTOR).toContain(вид);
    }
  });
});

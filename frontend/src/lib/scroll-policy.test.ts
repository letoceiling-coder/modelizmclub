import { beforeEach, describe, expect, it } from "vitest";
import { resetScrollPolicyForTests, scrollOnPathChange } from "./scroll-policy";

const go = (pathname: string) => scrollOnPathChange({ location: { pathname } });

describe("scrollOnPathChange", () => {
  beforeEach(() => resetScrollPolicyForTests());

  it("первая отрисовка и смена раздела — прокрутка управляется", () => {
    expect(go("/channels")).toBe(true);
    expect(go("/reviews")).toBe(true);
    expect(go("/ads/3ed80234")).toBe(true);
  });

  it("тот же путь (?post=, ?tab=, перечитывание данных) — прокрутку не трогаем", () => {
    go("/feed");
    expect(go("/feed")).toBe(false);
    expect(go("/feed")).toBe(false);
  });

  it("«назад» на прежний раздел — снова смена пути, позицию восстановит роутер", () => {
    go("/ads");
    go("/ads/3ed80234");
    expect(go("/ads")).toBe(true);
  });

  it("хвостовой слеш не считается другим путём", () => {
    go("/communities");
    expect(go("/communities/")).toBe(false);
  });
});

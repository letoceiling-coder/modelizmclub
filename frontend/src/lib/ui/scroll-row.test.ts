import { describe, expect, it } from "vitest";
import { wheelScrollTarget } from "@/lib/ui/scroll-row";

describe("wheelScrollTarget", () => {
  it("вертикальное колесо двигает ряд по горизонтали", () => {
    expect(wheelScrollTarget(0, 100, 0, 300)).toBe(100);
    expect(wheelScrollTarget(0, -40, 100, 300)).toBe(60);
  });
  it("не выходит за края", () => {
    expect(wheelScrollTarget(0, 500, 200, 300)).toBe(300);
    expect(wheelScrollTarget(0, -500, 20, 300)).toBe(0);
  });
  it("у края отдаёт прокрутку странице", () => {
    expect(wheelScrollTarget(0, 100, 300, 300)).toBeNull();
    expect(wheelScrollTarget(0, -100, 0, 300)).toBeNull();
  });
  it("ряд без переполнения колесо не трогает", () => {
    expect(wheelScrollTarget(0, 100, 0, 0)).toBeNull();
  });
  it("горизонтальный жест оставляет браузеру", () => {
    expect(wheelScrollTarget(80, 10, 0, 300)).toBeNull();
  });
});

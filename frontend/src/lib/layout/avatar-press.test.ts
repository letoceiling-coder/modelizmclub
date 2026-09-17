import { describe, expect, it } from "vitest";
import { avatarPressOpensProfile } from "./avatar-press";

describe("avatarPressOpensProfile", () => {
  it("левая кнопка мыши ведёт в профиль", () => {
    expect(avatarPressOpensProfile({ pointerType: "mouse", button: 0, ctrlKey: false })).toBe(true);
  });

  it("касание и перо открывают меню — наведения у них нет", () => {
    expect(avatarPressOpensProfile({ pointerType: "touch", button: 0, ctrlKey: false })).toBe(
      false,
    );
    expect(avatarPressOpensProfile({ pointerType: "pen", button: 0, ctrlKey: false })).toBe(false);
  });

  it("правая кнопка и ctrl-щелчок не уводят со страницы", () => {
    expect(avatarPressOpensProfile({ pointerType: "mouse", button: 2, ctrlKey: false })).toBe(
      false,
    );
    expect(avatarPressOpensProfile({ pointerType: "mouse", button: 0, ctrlKey: true })).toBe(false);
  });
});

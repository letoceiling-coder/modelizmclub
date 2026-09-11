import { describe, expect, it } from "vitest";

import { horizontalFocusDelta } from "./keep-focus-in-view";

describe("horizontalFocusDelta", () => {
  it("scrolls a chip cut at the right edge fully into view", () => {
    // замер 11.09: «Сохранённое» 273–385 в ряду 8–367 на 375
    expect(horizontalFocusDelta({ left: 273, right: 385 }, { left: 8, right: 367 })).toBe(26);
  });

  it("scrolls back when the element is cut at the left edge", () => {
    expect(horizontalFocusDelta({ left: 0, right: 90 }, { left: 8, right: 367 })).toBe(-16);
  });

  it("leaves a fully visible element alone", () => {
    expect(horizontalFocusDelta({ left: 226, right: 367 }, { left: 8, right: 367 })).toBe(0);
  });

  it("aligns an element wider than the row to its start", () => {
    expect(horizontalFocusDelta({ left: 50, right: 500 }, { left: 8, right: 367 })).toBe(34);
  });
});

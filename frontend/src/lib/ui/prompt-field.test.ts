import { describe, expect, it } from "vitest";

import { readPromptField } from "./prompt-field";

describe("readPromptField", () => {
  it("отказ оставляет прежнее значение, а не стирает правку", () => {
    expect(readPromptField(null, "Авиация")).toEqual({ kind: "value", value: "Авиация" });
  });

  it("стёртое поле — пустота, о которой надо сказать", () => {
    expect(readPromptField("", "Авиация")).toEqual({ kind: "empty" });
    expect(readPromptField("   ", "Авиация")).toEqual({ kind: "empty" });
  });

  it("введённое значение берётся без краевых пробелов", () => {
    expect(readPromptField("  Флот  ", "Авиация")).toEqual({ kind: "value", value: "Флот" });
  });

  it("отказ и стёртое поле различимы — прежний `!value` их путал", () => {
    const отказ = readPromptField(null, "Авиация");
    const стёрто = readPromptField("", "Авиация");

    expect(отказ).not.toEqual(стёрто);
  });
});

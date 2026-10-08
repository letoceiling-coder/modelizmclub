import { describe, expect, it } from "vitest";
import { passwordMatchState } from "./password-match";

describe("passwordMatchState — решение Ж1", () => {
  it("пустой повтор ничего не говорит", () => {
    expect(passwordMatchState("Parol1234!", "")).toBe("empty");
    expect(passwordMatchState("Parol1234!", "", { left: true })).toBe("empty");
  });

  it("повтор, совпадающий с началом пароля, оставляет поле нейтральным", () => {
    expect(passwordMatchState("Parol1234!", "P")).toBe("typing");
    expect(passwordMatchState("Parol1234!", "Parol")).toBe("typing");
    expect(passwordMatchState("Parol1234!", "Parol1234")).toBe("typing");
  });

  it("расхождение в одном знаке — несовпадение сразу, не дожидаясь отправки", () => {
    // Ровно случай со снимка владельца: отличается последний знак.
    expect(passwordMatchState("Parol1234!", "Parol1234?")).toBe("mismatch");
  });

  it("расхождение в середине — несовпадение, хотя длина ещё меньше", () => {
    expect(passwordMatchState("Parol1234!", "ParOl")).toBe("mismatch");
  });

  it("повтор длиннее пароля — несовпадение", () => {
    expect(passwordMatchState("Parol", "Parol1")).toBe("mismatch");
  });

  it("полное совпадение — состояние match", () => {
    expect(passwordMatchState("Parol1234!", "Parol1234!")).toBe("match");
    expect(passwordMatchState("Parol1234!", "Parol1234!", { left: true })).toBe("match");
  });

  it("уход из поля с неполным повтором даёт несовпадение", () => {
    expect(passwordMatchState("Parol1234!", "Parol", { left: true })).toBe("mismatch");
  });

  it("правка первого пароля пересчитывает состояние второго", () => {
    // Было совпадение…
    expect(passwordMatchState("Parol1234!", "Parol1234!")).toBe("match");
    // …человек дописал знак в первый пароль — повтор перестал совпадать.
    expect(passwordMatchState("Parol1234!x", "Parol1234!")).toBe("typing");
    // …а если изменил знак в середине — расхождение видно сразу.
    expect(passwordMatchState("ParOl1234!", "Parol1234!")).toBe("mismatch");
  });

  it("пустой пароль при заполненном повторе — несовпадение", () => {
    expect(passwordMatchState("", "Parol")).toBe("mismatch");
  });

  it("оба пустые — ничего не говорит", () => {
    expect(passwordMatchState("", "")).toBe("empty");
  });
});

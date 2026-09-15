import { describe, expect, it } from "vitest";
import { decideStoredIntent } from "./storedIntent";

const intent = (
  level: "registered" | "verified" | "subscriber",
  prompted?: "auth" | "verify" | "paywall",
) => ({
  key: "resume:community.join",
  level,
  createdAt: Date.now(),
  prompted,
});

describe("decideStoredIntent", () => {
  it("без намерения — ничего", () => {
    expect(decideStoredIntent("verified", null)).toEqual({ kind: "none" });
  });

  it("уровень достигнут — повторить действие", () => {
    expect(decideStoredIntent("subscriber", intent("subscriber"))).toEqual({ kind: "resume" });
  });

  it("вошёл с SMS, нужна подписка — окно подписки", () => {
    expect(decideStoredIntent("verified", intent("subscriber"))).toEqual({
      kind: "prompt",
      window: "paywall",
    });
  });

  it("вошёл без SMS, нужна подписка — сначала окно телефона", () => {
    expect(decideStoredIntent("registered", intent("subscriber"))).toEqual({
      kind: "prompt",
      window: "verify",
    });
  });

  it("окно уже показывали — не всплывает снова", () => {
    expect(decideStoredIntent("verified", intent("subscriber", "paywall"))).toEqual({
      kind: "wait",
    });
  });

  it("после подтверждения номера — следующий шаг, окно подписки", () => {
    expect(decideStoredIntent("verified", intent("subscriber", "verify"))).toEqual({
      kind: "prompt",
      window: "paywall",
    });
  });

  it("гость — окно не поднимаем", () => {
    expect(decideStoredIntent("guest", intent("verified"))).toEqual({ kind: "wait" });
  });
});

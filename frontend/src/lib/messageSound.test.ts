import { describe, expect, it } from "vitest";
import { shouldPlayMessagePing } from "@/lib/messageSound";

const base = {
  watchingDialogId: null,
  conversationUuid: "c1",
  muted: false,
  soundEnabled: true,
  alreadyPlayed: false,
};

describe("shouldPlayMessagePing", () => {
  it("звучит, если чат не открыт", () => {
    expect(shouldPlayMessagePing(base)).toBe(true);
  });
  it("звучит, если открыт другой диалог", () => {
    expect(shouldPlayMessagePing({ ...base, watchingDialogId: "c2" })).toBe(true);
  });
  it("молчит в открытом чате", () => {
    expect(shouldPlayMessagePing({ ...base, watchingDialogId: "c1" })).toBe(false);
  });
  it("молчит в диалоге «без звука»", () => {
    expect(shouldPlayMessagePing({ ...base, muted: true })).toBe(false);
  });
  it("молчит, если звук выключен в настройках", () => {
    expect(shouldPlayMessagePing({ ...base, soundEnabled: false })).toBe(false);
  });
  it("молчит во второй вкладке", () => {
    expect(shouldPlayMessagePing({ ...base, alreadyPlayed: true })).toBe(false);
  });
});

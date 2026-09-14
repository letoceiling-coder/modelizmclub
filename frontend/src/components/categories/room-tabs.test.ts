import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM_TAB, ROOM_TABS } from "./room-tabs";

describe("вкладки комнаты направления", () => {
  it("порядок: чат, участники, объявления, записи", () => {
    expect(ROOM_TABS).toEqual(["chat", "members", "ads", "posts"]);
  });

  it("без ?tab= открывается чат", () => {
    expect(DEFAULT_ROOM_TAB).toBe("chat");
  });
});

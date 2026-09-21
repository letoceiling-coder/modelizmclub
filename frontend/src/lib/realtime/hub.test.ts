import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Подписки на беседы не вытесняют друг друга.
 *
 * До 21.09 в hub.ts была одна ячейка активной беседы на всё приложение, и
 * писали в неё два места — мессенджер и чат направления. Первый же чат,
 * открытый поверх другого, молча отписал бы нижний. Проверка держит то, ради
 * чего ячейку заменили картой: открытие второй беседы не трогает первую, а
 * закрытие снимает ровно свою.
 *
 * Echo подменён: живой сокет здесь не нужен, нужен учёт подписок.
 */
const subscribed: string[] = [];
const unsubscribed: string[] = [];

vi.mock("@/lib/api/client", () => ({ getToken: () => "токен", API_BASE_URL: "" }));
vi.mock("@/lib/realtime/echo", () => ({
  getEcho: async () => ({}),
  isEchoConnected: () => true,
  onEchoReconnect: () => () => {},
  reconnectEcho: async () => {},
  resetEcho: () => {},
  subscribeConversation: async (uuid: string) => {
    subscribed.push(uuid);
    return () => unsubscribed.push(uuid);
  },
}));
vi.mock("@/lib/calls", () => ({ calls: { init: async () => {} }, syncIncomingOffer: () => {} }));
vi.mock("@/lib/realtime/user", () => ({
  initUserRealtime: async () => {},
  resetUserRealtime: () => {},
}));
vi.mock("@/lib/realtime/presence", () => ({
  initPresence: async () => {},
  resetPresence: () => {},
}));
vi.mock("@/lib/presence-heartbeat", () => ({
  startPresenceHeartbeat: () => {},
  stopPresenceHeartbeat: () => {},
}));
vi.mock("@/lib/store", () => ({ GUEST_USER: { id: "guest" } }));

const { openHubConversation } = await import("@/lib/realtime/hub");
const тик = () => new Promise((r) => setTimeout(r, 0));

describe("подписки на беседы", () => {
  beforeEach(() => {
    subscribed.length = 0;
    unsubscribed.length = 0;
  });

  it("вторая беседа не отписывает первую", async () => {
    const закрытьА = openHubConversation("a", () => {});
    await тик();
    const закрытьБ = openHubConversation("b", () => {});
    await тик();

    expect(subscribed).toEqual(["a", "b"]);
    expect(unsubscribed).toEqual([]);

    закрытьА();
    закрытьБ();
  });

  it("закрытие снимает ровно свою беседу", async () => {
    const закрытьА = openHubConversation("a", () => {});
    const закрытьБ = openHubConversation("b", () => {});
    await тик();

    закрытьБ();
    expect(unsubscribed).toEqual(["b"]);

    закрытьА();
    expect(unsubscribed).toEqual(["b", "a"]);
  });

  it("беседа, закрытая во время привязки, не остаётся подписанной", async () => {
    // Привязка асинхронная: между `openHubConversation` и ответом успевает
    // случиться закрытие. Номер попытки в записи для этого и хранится.
    const закрыть = openHubConversation("a", () => {});
    закрыть();
    await тик();

    expect(unsubscribed).toContain("a");
  });

  it("повторное открытие той же беседы не плодит подписок", async () => {
    const первое = openHubConversation("a", () => {});
    await тик();
    const второе = openHubConversation("a", () => {});
    await тик();

    expect(subscribed).toEqual(["a", "a"]);
    expect(unsubscribed).toEqual(["a"]);

    первое();
    второе();
  });
});

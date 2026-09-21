import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Живое обновление объектов по личному каналу.
 *
 * До 21.09 экран показывал прежнее состояние, пока страницу не перезагрузят:
 * колокольчик говорил «объявление одобрено», а карточка рядом висела «на
 * проверке». У одобрения уведомления не было вовсе — `decisionTarget` на
 * удачу намеренно молчит, — то есть человек не узнавал ничем.
 *
 * Проверяется разбор события: кому его отдавать и что отбрасывать. Само
 * перечитывание объекта делают экраны, здесь его нет.
 */
vi.mock("@/lib/api/client", () => ({ getToken: () => "токен" }));
vi.mock("@/lib/api/chat", () => ({ mapMessage: (m: unknown) => m }));
vi.mock("@/lib/store", () => ({
  GUEST_USER: { id: "guest" },
  getState: () => ({ dialogMeta: {} }),
}));
vi.mock("@/lib/messenger", () => ({
  messengerCache: { ingestIncoming: () => {}, markOwnStatus: () => {} },
}));
vi.mock("@/lib/calls", () => ({ ingestCallSignal: () => {} }));
vi.mock("@/lib/callAudio", () => ({ playMessagePing: () => {} }));
vi.mock("@/lib/messageSound", () => ({
  claimMessagePing: async () => false,
  isMessageSoundEnabled: () => false,
  shouldPlayMessagePing: () => false,
}));

/** Обработчик события личного канала, пойманный на подписке. */
let handle: (p: { type?: string; payload?: unknown }) => void = () => {};
vi.mock("@/lib/realtime/echo", () => ({
  subscribeUser: async (
    _uuid: string,
    onEvent: (p: { type?: string; payload?: unknown }) => void,
  ) => {
    handle = onEvent;
    return () => {};
  },
}));

const { initUserRealtime, onObjectUpdate } = await import("@/lib/realtime/user");
await initUserRealtime("00000000-0000-4000-8000-000000000001");

describe("событие «объект изменился»", () => {
  let got: unknown[] = [];
  let off: () => void = () => {};

  beforeEach(() => {
    got = [];
    off();
    off = onObjectUpdate((u) => got.push(u));
  });

  it("объявление доходит до подписчика вместе со статусом", () => {
    handle({
      type: "object.updated",
      payload: { kind: "listing", uuid: "u-1", status: "published" },
    });
    expect(got).toEqual([{ kind: "listing", uuid: "u-1", status: "published" }]);
  });

  it("сделка и запись — тоже", () => {
    handle({ type: "object.updated", payload: { kind: "deal", uuid: "d-1", status: "paid" } });
    handle({ type: "object.updated", payload: { kind: "post", uuid: "p-1", status: "published" } });
    expect(got.map((u) => (u as { kind: string }).kind)).toEqual(["deal", "post"]);
  });

  it("статус может не прийти — это не повод отбросить событие", () => {
    // Экран всё равно перечитывает объект запросом: статус в событии нужен
    // для решений вроде «куда перенести карточку», а не как источник истины.
    handle({ type: "object.updated", payload: { kind: "listing", uuid: "u-2" } });
    expect(got).toEqual([{ kind: "listing", uuid: "u-2", status: null }]);
  });

  it("неизвестный вид отбрасывается, а не доходит наполовину", () => {
    handle({ type: "object.updated", payload: { kind: "community", uuid: "c-1" } });
    expect(got).toEqual([]);
  });

  it("событие без идентификатора отбрасывается", () => {
    handle({ type: "object.updated", payload: { kind: "listing" } });
    expect(got).toEqual([]);
  });

  it("чужие типы событий сюда не попадают", () => {
    handle({ type: "notification", payload: { notification: { id: "n1" } } });
    handle({ type: "conversation.read", payload: { conversation_uuid: "c1" } });
    expect(got).toEqual([]);
  });

  it("отписка снимает ровно своего слушателя", () => {
    const второй: unknown[] = [];
    const off2 = onObjectUpdate((u) => второй.push(u));
    off();
    handle({ type: "object.updated", payload: { kind: "deal", uuid: "d-2", status: "shipped" } });
    expect(got).toEqual([]);
    expect(второй).toHaveLength(1);
    off2();
    off = () => {};
  });
});
